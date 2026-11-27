//! The app's own pnpm, which installs official tools. npm gives every global package its own `node_modules`, so each
//! tool carried a full copy of cli-core and its dependencies (about 340 MB a tool). pnpm keeps one copy of each file
//! in a store and links it into every tool, across cli-core versions too, so each tool keeps its exact pin.
//! Plan: `docs/dev/plans/2026-11-27-pnpm-shared-install.md`.
//!
//! The app installs pnpm itself with npm, which comes with every Node.js: the user may have no pnpm, and corepack is not
//! shipped with Node.js 25 and later. The user's own pnpm, if any, is never used for these copies.

use crate::{node, npm_prefix};
use std::path::{Path, PathBuf};

pub const VERSION: &str = "11.28.8";
/// pnpm publishes from its release workflow on the version's tag.
pub const BUILT_BY: &str = "https://github.com/pnpm/pnpm/.github/workflows/release.yml@refs/tags/v11.28.8";

const REGISTRY: &str = "https://registry.npmjs.org/";

/// Dependencies whose install scripts must run; pnpm skips every other one. `better-sqlite3` builds the driver every
/// store opens through; `ssh2` and `cpu-features` build optional speedups and fall back without them.
const BUILDS: [&str; 3] = ["better-sqlite3", "ssh2", "cpu-features"];

/// `<app local data>/pnpm`; `WIRECAT_PNPM_DIR` moves it for tests. One folder, so the store and the tools sit on the
/// same drive: pnpm can link a file only within one drive.
fn root() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("WIRECAT_PNPM_DIR") {
        return Some(PathBuf::from(dir));
    }
    node::app_data().map(|d| d.join("pnpm"))
}

/// `PNPM_HOME` for the tools: pnpm links their programs into `bin` and keeps each tool's folder under `global`.
pub fn home() -> Option<PathBuf> {
    root().map(|r| r.join("home"))
}

pub fn bin_dir() -> Option<PathBuf> {
    home().map(|h| h.join("bin"))
}

fn store() -> Option<PathBuf> {
    root().map(|r| r.join("store"))
}

/// Where npm installs pnpm itself, as a global prefix of its own.
fn prefix() -> Option<PathBuf> {
    root().map(|r| r.join("program"))
}

fn program_at(prefix: &Path) -> PathBuf {
    npm_prefix::bin_dir(prefix).join(if cfg!(windows) { "pnpm.cmd" } else { "pnpm" })
}

fn installed_version(prefix: &Path) -> Option<String> {
    let lib = if cfg!(windows) { prefix.join("node_modules") } else { prefix.join("lib").join("node_modules") };
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(lib.join("pnpm/package.json")).ok()?).ok()?;
    manifest["version"].as_str().map(str::to_string)
}

/// The app's pnpm when it is installed at `VERSION`.
pub fn program() -> Option<PathBuf> {
    let prefix = prefix()?;
    let program = program_at(&prefix);
    (program.is_file() && installed_version(&prefix).as_deref() == Some(VERSION)).then_some(program)
}

pub fn is_program(path: &Path) -> bool {
    prefix().is_some_and(|p| path.starts_with(p))
}

/// A copy of a tool this pnpm installed.
pub fn owns(copy: &Path) -> bool {
    home().is_some_and(|h| copy.starts_with(h))
}

/// What npm runs to install pnpm `VERSION` into the app's folder, from the public registry whatever `.npmrc` says,
/// as provenance is checked there.
pub fn setup_args() -> Option<(PathBuf, Vec<String>)> {
    let prefix = prefix()?;
    let args = vec![
        "install".into(),
        "--global".into(),
        format!("pnpm@{VERSION}"),
        format!("--registry={REGISTRY}"),
        "--no-fund".into(),
        "--no-audit".into(),
    ];
    Some((prefix, args))
}

/// `pnpm add --global` with the app's store and the builds the tools need.
pub fn add_args(spec: &str, extra: &[&str]) -> Vec<String> {
    let mut args: Vec<String> = vec!["add".into(), "--global".into(), spec.into()];
    if let Some(store) = store() {
        args.push(format!("--store-dir={}", store.display()));
    }
    args.extend(BUILDS.iter().map(|b| format!("--allow-build={b}")));
    args.extend(extra.iter().map(|s| (*s).to_string()));
    args
}

pub fn remove_args(package: &str) -> Vec<String> {
    vec!["remove".into(), "--global".into(), package.into()]
}

/// The environment the app's pnpm runs with: its own home, whatever `PNPM_HOME` the user set.
pub fn configure(cmd: &mut std::process::Command) {
    if let Some(home) = home() {
        cmd.env("PNPM_HOME", home);
    }
}

/// Store drivers whose build did not run. pnpm 11 keeps a global install's packages in the store under
/// `v11/links/@/<name>/<version>/<hash>/node_modules/<name>`; this layout is pinned with `VERSION`. Without the build
/// the tool starts and lists its commands, and fails only once a command opens its store.
pub fn unbuilt_drivers() -> Vec<PathBuf> {
    store().map_or_default(|s| unbuilt_in(&s))
}

fn unbuilt_in(store: &Path) -> Vec<PathBuf> {
    let base = store.join("v11").join("links").join("@").join("better-sqlite3");
    let dirs = |p: &Path| -> Vec<PathBuf> {
        std::fs::read_dir(p).map_or_default(|r| r.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect())
    };
    dirs(&base)
        .iter()
        .flat_map(|version| dirs(version))
        .map(|hash| hash.join("node_modules").join("better-sqlite3"))
        .filter(|pkg| pkg.join("package.json").is_file())
        .filter(|pkg| !pkg.join("build").join("Release").join("better_sqlite3.node").is_file())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_a_driver_whose_build_did_not_run() {
        let store = std::env::temp_dir().join(format!("wirecat-own-pnpm-{}", std::process::id()));
        let links = store.join("v11/links/@/better-sqlite3/12.11.1");
        let built = links.join("aaa/node_modules/better-sqlite3");
        let unbuilt = links.join("bbb/node_modules/better-sqlite3");
        for pkg in [&built, &unbuilt] {
            std::fs::create_dir_all(pkg).unwrap();
            std::fs::write(pkg.join("package.json"), "{}").unwrap();
        }
        std::fs::create_dir_all(built.join("build/Release")).unwrap();
        std::fs::write(built.join("build/Release/better_sqlite3.node"), "").unwrap();
        assert_eq!(unbuilt_in(&store), vec![unbuilt]);
        assert_eq!(unbuilt_in(&store.join("missing")), Vec::<PathBuf>::new());
        let _ = std::fs::remove_dir_all(&store);
    }

    #[test]
    fn the_workflow_tag_is_the_pinned_version() {
        assert!(BUILT_BY.ends_with(&format!("@refs/tags/v{VERSION}")));
    }

    #[test]
    fn adds_with_the_store_and_the_allowed_builds() {
        let args = add_args("@wirecat/tg-cli@1.0.0", &["--x"]);
        assert_eq!(&args[..3], ["add", "--global", "@wirecat/tg-cli@1.0.0"]);
        assert!(args.iter().any(|a| a == "--allow-build=better-sqlite3"));
        assert_eq!(args.last().unwrap(), "--x");
    }
}
