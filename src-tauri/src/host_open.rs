//! Opening a page or a folder in the owner's own programs, and starting any other program of theirs.
//!
//! The `AppImage` starts the app with its own libraries first on `LD_LIBRARY_PATH` and its GTK and GIO modules in the
//! environment. A program of the system started with them loads the `AppImage`'s older `GLib`: `gio` stops with
//! "undefined symbol", and a browser started by `xdg-open` may fail the same way after the launcher has already
//! exited 0, so nothing opens and nothing reports it. Every program the app starts gets the environment without them.

use std::ffi::{OsStr, OsString};
use std::process::Command;

/// Set only by the `AppImage`'s own launcher (`AppRun`), so their values come from it, not from the owner.
const APPIMAGE_ONLY: [&str; 12] = [
    "APPDIR",
    "APPIMAGE",
    "ARGV0",
    "OWD",
    "GTK_THEME",
    "GTK_DATA_PREFIX",
    "GTK_EXE_PREFIX",
    "GTK_PATH",
    "GTK_IM_MODULE_FILE",
    "GDK_PIXBUF_MODULE_FILE",
    "GIO_MODULE_DIR",
    "GSETTINGS_SCHEMA_DIR",
];

#[derive(Debug, PartialEq, Eq)]
pub enum Change {
    Remove(OsString),
    Set(OsString, OsString),
}

/// What to change in `vars` so a child sees the system's environment: nothing outside an `AppImage`.
pub fn host_env(vars: impl IntoIterator<Item = (OsString, OsString)>) -> Vec<Change> {
    let vars: Vec<_> = vars.into_iter().collect();
    let Some(appdir) = vars.iter().find(|(k, _)| k == "APPDIR").map(|(_, v)| v.to_string_lossy().into_owned()) else {
        return Vec::new();
    };
    let appdir = appdir.trim_end_matches('/');
    if appdir.is_empty() {
        return Vec::new();
    }
    let mut changes = Vec::new();
    for (name, value) in &vars {
        if APPIMAGE_ONLY.iter().any(|n| name == n) {
            changes.push(Change::Remove(name.clone()));
            continue;
        }
        let value = value.to_string_lossy();
        if !value.contains(appdir) {
            continue;
        }
        let kept: Vec<_> = value.split(':').filter(|p| !p.is_empty() && !p.starts_with(appdir)).collect();
        changes.push(if kept.is_empty() {
            Change::Remove(name.clone())
        } else {
            Change::Set(name.clone(), kept.join(":").into())
        });
    }
    changes
}

/// Gives `cmd` the system's environment instead of the `AppImage`'s.
pub fn for_host(cmd: &mut Command) -> &mut Command {
    for change in host_env(std::env::vars_os()) {
        match change {
            Change::Remove(name) => cmd.env_remove(name),
            Change::Set(name, value) => cmd.env(name, value),
        };
    }
    cmd
}

/// An https page in the owner's browser, a new mail to one address in their mail program, or a call to one number in
/// their phone program. Anything else is refused.
pub fn url(url: &str) -> Result<(), String> {
    let parsed = tauri::Url::parse(url).map_err(|_| format!("Not a web address: {url}"))?;
    match parsed.scheme() {
        "https" => {}
        "mailto" if one_address(&parsed) => {}
        "tel" if one_number(&parsed) => {}
        _ => return Err(format!("Only https pages open from WireCat: {url}")),
    }
    open(url.as_ref())
}

/// A bare address: no query, since some mail programs take `?attach=` and would send a local file.
fn one_address(parsed: &tauri::Url) -> bool {
    let address = parsed.path();
    parsed.query().is_none()
        && parsed.fragment().is_none()
        && address.matches('@').count() == 1
        && !address.starts_with('@')
        && !address.ends_with('@')
        && address.bytes().all(|b| b.is_ascii_alphanumeric() || b"@.-_+".contains(&b))
}

/// Digits alone, a leading `+` allowed: nothing a phone program could read as a code to dial or a parameter.
fn one_number(parsed: &tauri::Url) -> bool {
    let number = parsed.path().strip_prefix('+').unwrap_or_else(|| parsed.path());
    parsed.query().is_none()
        && parsed.fragment().is_none()
        && (3..=20).contains(&number.len())
        && number.bytes().all(|b| b.is_ascii_digit())
}

/// A folder or file in the program the system chose for it.
pub fn path(path: &std::path::Path) -> Result<(), String> {
    open(path.as_os_str())
}

#[cfg(target_os = "linux")]
fn open(target: &OsStr) -> Result<(), String> {
    // `xdg-open` waits for the browser it starts when the desktop has no handler of its own; one still running after
    // this long has handed the page over. A launcher that fails sooner is reported, and the next one is tried.
    launch(open::commands(target), std::time::Duration::from_secs(3))
}

#[cfg(target_os = "linux")]
fn launch(launchers: Vec<Command>, handed_over: std::time::Duration) -> Result<(), String> {
    use std::process::Stdio;
    use std::time::{Duration, Instant};

    let mut failures = Vec::new();
    for mut cmd in launchers {
        let program = cmd.get_program().to_string_lossy().into_owned();
        let spawned = for_host(&mut cmd).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn();
        let mut child = match spawned {
            Ok(child) => child,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => {
                failures.push(format!("{program}: {e}"));
                continue;
            }
        };
        let started = Instant::now();
        loop {
            match child.try_wait() {
                Ok(Some(status)) if status.success() => return Ok(()),
                Ok(Some(status)) => {
                    failures.push(format!("{program} {}", exit_words(&program, status.code())));
                    break;
                }
                Ok(None) if started.elapsed() >= handed_over => {
                    // Reaped in the background so it does not stay a zombie once the browser closes.
                    std::thread::spawn(move || child.wait());
                    return Ok(());
                }
                Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                Err(e) => return Err(format!("{program}: {e}")),
            }
        }
    }
    if failures.is_empty() {
        Err("No program to open links was found (xdg-open, gio, kde-open).".into())
    } else {
        Err(failures.join("; "))
    }
}

#[cfg(not(target_os = "linux"))]
fn open(target: &OsStr) -> Result<(), String> {
    open::that_detached(target).map_err(|e| e.to_string())
}

/// Only xdg-open documents what its exit codes mean (`man xdg-open`); gio uses 2 for any launch error.
#[cfg(target_os = "linux")]
fn exit_words(program: &str, code: Option<i32>) -> String {
    match (program, code) {
        ("xdg-open", Some(1)) => "refused the address (exit 1)".into(),
        ("xdg-open", Some(2)) => "found no such file (exit 2)".into(),
        ("xdg-open", Some(3)) => "found no program for it (exit 3)".into(),
        ("xdg-open", Some(4)) => "could not open it (exit 4)".into(),
        (_, Some(c)) => format!("failed (exit {c})"),
        (_, None) => "was stopped by a signal".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(list: &[(&str, &str)]) -> Vec<(OsString, OsString)> {
        list.iter().map(|(k, v)| (OsString::from(k), OsString::from(v))).collect()
    }

    #[test]
    fn outside_an_appimage_nothing_changes() {
        let env = vars(&[("PATH", "/usr/bin"), ("LD_LIBRARY_PATH", "/opt/lib"), ("GTK_THEME", "Adwaita:dark")]);
        assert_eq!(host_env(env), Vec::<Change>::new());
    }

    #[test]
    fn the_appimage_entries_go_and_the_owners_stay() {
        let env = vars(&[
            ("APPDIR", "/tmp/.mount_wirecat"),
            ("PATH", "/tmp/.mount_wirecat/usr/bin/:/tmp/.mount_wirecat/usr/sbin/:/home/me/bin:/usr/bin"),
            ("LD_LIBRARY_PATH", "/tmp/.mount_wirecat/usr/lib/:/tmp/.mount_wirecat/lib/:"),
            ("XDG_DATA_DIRS", "/tmp/.mount_wirecat/usr/share:/usr/share:/run/current-system/sw/share"),
            ("GIO_MODULE_DIR", "/tmp/.mount_wirecat//usr/lib/gio/modules"),
            ("GTK_THEME", "Adwaita:light"),
            ("HOME", "/home/me"),
        ]);
        let changes = host_env(env);
        assert!(changes.contains(&Change::Set("PATH".into(), "/home/me/bin:/usr/bin".into())));
        assert!(changes.contains(&Change::Remove("LD_LIBRARY_PATH".into())));
        assert!(
            changes.contains(&Change::Set("XDG_DATA_DIRS".into(), "/usr/share:/run/current-system/sw/share".into()))
        );
        assert!(changes.contains(&Change::Remove("GIO_MODULE_DIR".into())));
        assert!(changes.contains(&Change::Remove("GTK_THEME".into())));
        assert!(changes.contains(&Change::Remove("APPDIR".into())));
        assert!(!changes.iter().any(|c| matches!(c, Change::Remove(n) | Change::Set(n, _) if n == "HOME")));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_launcher_that_fails_is_reported_and_the_next_one_tried() {
        let fail = |code: &str| {
            let mut c = Command::new("sh");
            c.args(["-c", &format!("exit {code}")]);
            c
        };
        let short = std::time::Duration::from_secs(2);
        assert_eq!(launch(vec![fail("4"), fail("0")], short), Ok(()));
        assert_eq!(
            launch(vec![fail("4"), Command::new("false")], short),
            Err("sh failed (exit 4); false failed (exit 1)".into())
        );
        assert!(launch(vec![Command::new("wirecat-no-such-launcher")], short).unwrap_err().starts_with("No program"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_launcher_still_running_has_handed_the_page_over() {
        let mut slow = Command::new("sleep");
        slow.arg("5");
        assert_eq!(launch(vec![slow], std::time::Duration::from_millis(200)), Ok(()));
    }

    #[test]
    fn only_https_pages_open() {
        assert!(url("http://example.com").unwrap_err().contains("Only https"));
        assert!(url("file:///etc/passwd").unwrap_err().contains("Only https"));
        assert!(url("not a url").unwrap_err().contains("Not a web address"));
    }

    #[test]
    fn tel_opens_only_one_number() {
        let parse = |u: &str| tauri::Url::parse(u).unwrap();
        assert!(one_number(&parse("tel:+34600000001")));
        assert!(one_number(&parse("tel:88001234567")));
        assert!(!one_number(&parse("tel:+34 600")));
        assert!(!one_number(&parse("tel:*21*123#")));
        assert!(!one_number(&parse("tel:+34600000001?call=1")));
        assert!(!one_number(&parse("tel:12")));
    }

    #[test]
    fn mailto_opens_only_one_bare_address() {
        let parse = |u: &str| tauri::Url::parse(u).unwrap();
        assert!(one_address(&parse("mailto:lena.o+work@example.com")));
        assert!(!one_address(&parse("mailto:lena@example.com?attach=/etc/passwd")));
        assert!(!one_address(&parse("mailto:a@example.com,b@example.com")));
        assert!(!one_address(&parse("mailto:a%0A@example.com")));
        assert!(!one_address(&parse("mailto:example.com")));
        assert!(url("mailto:a@example.com?body=x").unwrap_err().contains("Only https"));
    }
}
