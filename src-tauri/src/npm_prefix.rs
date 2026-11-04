//! Where `npm install --global` puts a tool. npm's own global folder when the user may write there; otherwise a folder
//! in the user's home, chosen without asking: nobody should need administrator rights to install a tool.

use crate::paths;
use std::path::{Path, PathBuf};

/// `~/.local` on Unix, whose `bin` many systems already put on a terminal's PATH; `%APPDATA%\npm` on Windows, npm's own
/// per-user default there.
pub fn user_prefix() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("npm"))
    } else {
        paths::home().map(|h| h.join(".local"))
    }
}

/// npm's own global folder when it is writable, otherwise the user's; `None` when neither is.
pub fn for_install(own: Option<PathBuf>) -> Option<PathBuf> {
    own.filter(|p| writable(p)).or_else(|| user_prefix().filter(|p| writable(p)))
}

/// An update stays in the folder of the copy it replaces, so it never leaves a second copy that shadows the first.
pub fn for_update(copy: &Path, own: Option<PathBuf>) -> Option<PathBuf> {
    of_copy(copy).filter(|p| writable(p)).or_else(|| for_install(own))
}

/// The prefix a globally installed program belongs to: npm links it into `<prefix>/bin` on Unix and into the prefix
/// itself on Windows.
pub fn of_copy(copy: &Path) -> Option<PathBuf> {
    let dir = copy.parent()?;
    if cfg!(windows) {
        return Some(dir.to_path_buf());
    }
    (dir.file_name()? == "bin").then(|| dir.parent().map(Path::to_path_buf)).flatten()
}

/// The folder npm links executables into: `<prefix>/bin` on Unix, the prefix itself on Windows.
pub fn bin_dir(prefix: &Path) -> PathBuf {
    if cfg!(windows) { prefix.to_path_buf() } else { prefix.join("bin") }
}

/// npm creates the global folder on its first install, so a fresh `%APPDATA%\npm` is missing, not locked: the
/// nearest folder that exists is the one that must be writable.
pub fn writable(prefix: &Path) -> bool {
    let dir = if cfg!(windows) { prefix.to_path_buf() } else { prefix.join("lib") };
    let Some(existing) = dir.ancestors().find(|d| d.exists()) else { return false };
    if !existing.is_dir() {
        return false;
    }
    let probe = existing.join(format!(".wirecat-write-test-{}", std::process::id()));
    match std::fs::write(&probe, b"") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// A terminal finds what npm links into the user prefix only when that folder is on the user's PATH: Windows' npm
/// installer adds it, a zip or winget Node.js does not, and many Linux and macOS profiles leave `~/.local/bin` out.
/// `None` when nothing needed doing; never an error, the install is done either way.
pub fn reachable_from_terminal(prefix: &Path, id: &str, bin: &str) -> Option<crate::terminal_path::PathFix> {
    if user_prefix().is_none_or(|u| u != prefix) || paths::in_terminal(bin) {
        return None;
    }
    let missing = [(id.to_string(), bin_dir(prefix))];
    Some(crate::terminal_path::apply(&missing, crate::profile::plan_folder, crate::profile::add_folder))
}

/// Run at launch, after the search path is built, so the only extra cost is a registry read and a few file checks.
pub fn keep_tools_on_windows_path() {
    if !cfg!(windows) {
        return;
    }
    let node = crate::node::in_use().map(|n| crate::node::bin_dir(&n.dir));
    let user = user_prefix()
        .filter(|p| crate::catalog::catalog().tools.iter().any(|t| p.join(format!("{}.cmd", t.bin)).is_file()));
    crate::profile::keep_tools_on_windows_path(node.as_deref(), user.as_deref());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-prefix-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_global_folder_npm_has_not_created_yet_is_writable() {
        let home = temp("missing");
        assert!(writable(&home.join("AppData/Roaming/npm")));
        assert!(!home.join("AppData").exists(), "the check must not create folders");
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_prefix_under_a_file_is_not_writable() {
        let home = temp("file");
        std::fs::write(home.join("file"), b"").unwrap();
        assert!(!writable(&home.join("file/npm")));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_read_only_global_folder_is_not_writable() {
        use std::os::unix::fs::PermissionsExt;
        let home = temp("readonly");
        let lib = home.join("lib");
        std::fs::create_dir_all(&lib).unwrap();
        std::fs::set_permissions(&lib, std::fs::Permissions::from_mode(0o555)).unwrap();
        // root writes anywhere, so the check has nothing to tell apart.
        let root = std::fs::write(lib.join("root"), b"").is_ok();
        let result = writable(&home);
        std::fs::set_permissions(&lib, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::remove_dir_all(&home).unwrap();
        assert!(root || !result);
    }

    #[test]
    fn finds_the_prefix_a_copy_was_linked_from() {
        if cfg!(windows) {
            assert_eq!(
                of_copy(Path::new(r"C:\Users\u\AppData\Roaming\npm\tg.cmd")),
                Some(r"C:\Users\u\AppData\Roaming\npm".into())
            );
        } else {
            assert_eq!(of_copy(Path::new("/home/u/.local/bin/tg")), Some("/home/u/.local".into()));
            assert_eq!(of_copy(Path::new("/opt/odd/tg")), None);
        }
    }
}
