use crate::{node, npm_prefix, paths, run};
use serde::Serialize;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::time::Duration;

/// The interface's three platforms; every other Unix is treated as Linux.
#[derive(specta::Type, Serialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Os {
    #[default]
    Linux,
    Macos,
    Windows,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Os::Macos
        } else if cfg!(windows) {
            Os::Windows
        } else {
            Os::Linux
        }
    }
}

#[derive(specta::Type, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Readiness {
    pub os: String,
    pub arch: String,
    pub node: Program,
    pub npm: Program,
    pub pnpm: Program,
    /// Where `npm install -g` puts new tools (npm's own folder, or the user's when that one needs administrator
    /// rights), and whether we may write there; false only when neither folder is writable.
    pub npm_prefix: Option<String>,
    pub npm_prefix_writable: Option<bool>,
    /// The Node.js the app downloaded, if any; `active` when the app runs tools with it.
    pub managed: Option<Managed>,
}

#[derive(specta::Type, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Managed {
    pub version: String,
    pub dir: String,
    pub active: bool,
}

#[derive(specta::Type, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    pub path: Option<String>,
    pub version: Option<String>,
    pub ok: bool,
    pub problem: Option<String>,
}

pub fn readiness() -> Readiness {
    let node = std::thread::spawn(|| program("node", Some(node_supported)));
    let npm = std::thread::spawn(|| program("npm", None));
    let pnpm = std::thread::spawn(|| program("pnpm", None));
    let prefix = npm_prefix().map(|own| npm_prefix::for_install(Some(own.clone())).unwrap_or(own));
    let managed = node::installed().map(|m| Managed {
        version: m.version.to_string(),
        dir: paths::tilde(&m.dir.to_string_lossy()),
        active: node::in_use().is_some(),
    });
    Readiness {
        os: os_name(),
        arch: std::env::consts::ARCH.to_string(),
        node: node.join().unwrap_or_default(),
        npm: npm.join().unwrap_or_default(),
        pnpm: pnpm.join().unwrap_or_default(),
        npm_prefix_writable: prefix.as_ref().map(|p| npm_prefix::writable(p)),
        npm_prefix: prefix.map(|p| paths::tilde(&p.to_string_lossy())),
        managed,
    }
}

/// The name `bin/sandbox` launched this copy under; `None` in the real app.
pub fn sandbox() -> Option<String> {
    sandbox_from(std::env::var("WIRECAT_SANDBOX").ok())
}

fn sandbox_from(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn sandbox_title(name: &str) -> String {
    format!("WireCat — sandbox {name}")
}

fn os_name() -> String {
    match std::env::consts::OS {
        "macos" => "macOS".into(),
        "linux" => "Linux".into(),
        "windows" => "Windows".into(),
        other => other.into(),
    }
}

type VersionCheck = fn(&semver::Version) -> Result<(), String>;

fn program(bin: &str, check: Option<VersionCheck>) -> Program {
    program_in(bin, check, &paths::search_path())
}

fn program_in(bin: &str, check: Option<VersionCheck>, search: &OsStr) -> Program {
    let Some(path) = paths::which_in(bin, search) else {
        return Program { problem: Some("not found".into()), ..Default::default() };
    };
    let shown = Some(paths::tilde(&path.to_string_lossy()));
    let out = match run::run(&path, &["--version"], Some(search), Duration::from_secs(15)) {
        Ok(o) if o.code == Some(0) => o,
        Ok(o) => return Program { path: shown, problem: Some(first_line(&o.stderr)), ..Default::default() },
        Err(e) => return Program { path: shown, problem: Some(e.to_string()), ..Default::default() },
    };
    let version = out.stdout.trim().trim_start_matches('v').to_string();
    let problem = match (check, semver::Version::parse(&version)) {
        (Some(check), Ok(v)) => check(&v).err(),
        _ => None,
    };
    Program { path: shown, ok: problem.is_none(), version: Some(version), problem }
}

/// `WireCat` tools declare `^22.16.0 || >=24`.
pub fn node_supported(v: &semver::Version) -> Result<(), String> {
    if (v.major == 22 && v.minor >= 16) || v.major >= 24 {
        Ok(())
    } else {
        Err(format!("version {v} is too old; WireCat tools need 22.16 or newer, or 24+"))
    }
}

/// The app's own npm always installs into its runtime folder, whatever a `~/.npmrc` says; that `prefix=/usr/local`
/// is often the very reason the user's own npm needed administrator rights.
pub fn npm_prefix() -> Option<PathBuf> {
    let npm = paths::find("npm")?;
    node::owner_of(&npm).or_else(|| npm_prefix_of(&npm, &paths::search_path()))
}

fn npm_prefix_of(npm: &std::path::Path, search: &OsStr) -> Option<PathBuf> {
    let out = run::run(npm, &["prefix", "-g"], Some(search), Duration::from_secs(15)).ok()?;
    let p = out.stdout.trim();
    (out.code == Some(0) && !p.is_empty()).then(|| PathBuf::from(p))
}

/// Whether the user's own Node.js and npm, found on `search` (which must not include the app's runtime), can install
/// tools. It takes the path explicitly because it runs while the search path itself is being built.
pub fn own_setup_usable(search: &OsStr) -> bool {
    if !program_in("node", Some(node_supported), search).ok {
        return false;
    }
    let Some(npm) = paths::which_in("npm", search) else { return false };
    npm_prefix::for_install(npm_prefix_of(&npm, search)).is_some()
}

fn first_line(s: &str) -> String {
    s.lines().find(|l| !l.trim().is_empty()).unwrap_or("failed").trim().to_string()
}

/// Turns the app's start at login on or off, and answers whether it is on now.
pub fn set_autostart(manager: &tauri_plugin_autostart::AutoLaunchManager, on: bool) -> Result<bool, String> {
    // The entry names this very program: a test copy or a development build would start at every login instead.
    if on && (sandbox().is_some() || cfg!(debug_assertions)) {
        return Err("a test or development copy of WireCat does not start at login".into());
    }
    // Nothing to remove on a computer where it was never on; the platforms differ in how they say so.
    if !on && !manager.is_enabled().unwrap_or(true) {
        return Ok(false);
    }
    if on { manager.enable() } else { manager.disable() }.map_err(|e| e.to_string())?;
    manager.is_enabled().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_range_matches_tool_engines() {
        let v = |s| semver::Version::parse(s).unwrap();
        assert!(node_supported(&v("22.16.0")).is_ok());
        assert!(node_supported(&v("22.15.9")).is_err());
        assert!(node_supported(&v("23.4.0")).is_err());
        assert!(node_supported(&v("24.0.0")).is_ok());
    }

    #[test]
    fn a_sandbox_is_named_only_by_a_non_empty_variable() {
        assert_eq!(sandbox_from(Some(" demo ".into())).as_deref(), Some("demo"));
        assert_eq!(sandbox_from(Some("  ".into())), None);
        assert_eq!(sandbox_from(None), None);
        assert_eq!(sandbox_title("demo"), "WireCat — sandbox demo");
    }
}
