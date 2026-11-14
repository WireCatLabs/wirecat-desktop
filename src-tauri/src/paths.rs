use serde::Serialize;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

static SEARCH_PATH: RwLock<Option<OsString>> = RwLock::new(None);
/// Building starts node and npm; a page that asks while the launch warm-up builds waits for it instead.
static BUILDING: Mutex<()> = Mutex::new(());

/// The PATH a terminal would have. Apps started from a desktop launcher miss what shell
/// profiles add (nvm, pnpm, Volta), so we merge the login shell's PATH and known folders.
pub fn search_path() -> OsString {
    if let Some(p) = SEARCH_PATH.read().unwrap().as_ref() {
        return p.clone();
    }
    let _one = BUILDING.lock().unwrap();
    if let Some(p) = SEARCH_PATH.read().unwrap().as_ref() {
        return p.clone();
    }
    let p = build_search_path(&[]);
    *SEARCH_PATH.write().unwrap() = Some(p.clone());
    p
}

/// Re-resolves after an install, adding folders npm reported (its global bin may be new).
pub fn refresh(extra: &[PathBuf]) -> OsString {
    let p = build_search_path(extra);
    *SEARCH_PATH.write().unwrap() = Some(p.clone());
    p
}

fn build_search_path(extra: &[PathBuf]) -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(p) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&p));
    }
    if let Some(p) = &login_shell().path {
        dirs.extend(std::env::split_paths(p));
    }
    dirs.extend(extra.iter().cloned());
    dirs.extend(known_dirs());

    let mut seen = std::collections::HashSet::new();
    dirs.retain(|d| !d.as_os_str().is_empty() && seen.insert(d.clone()));
    if let Some(found) = crate::node::installed() {
        place_managed(&mut dirs, crate::node::bin_dir(&found.dir));
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

/// The app's Node.js goes first only when the user's own setup cannot install tools, so a working nvm, Volta or
/// Homebrew Node keeps winning. It still stays on the path, so tools installed with it are found either way.
fn place_managed(dirs: &mut Vec<PathBuf>, bin: PathBuf) {
    let canonical = |p: &Path| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let ours = canonical(&bin);
    dirs.retain(|d| canonical(d) != ours);
    let own = std::env::join_paths(dirs.iter()).unwrap_or_default();
    if crate::system::own_setup_usable(&own) {
        dirs.push(bin);
    } else {
        dirs.insert(0, bin);
    }
}

#[derive(Default)]
struct ShellEnv {
    path: Option<OsString>,
    pnpm_home: Option<OsString>,
    shell: Option<String>,
    /// Why the shell gave no PATH: tools only it would find are then reported missing, so the interface says so.
    problem: Option<String>,
}

static LOGIN_SHELL: RwLock<Option<Arc<ShellEnv>>> = RwLock::new(None);

/// Asked once, as an interactive login shell is slow; only the app's own PATH edits change its rc files.
fn login_shell() -> Arc<ShellEnv> {
    if let Some(env) = LOGIN_SHELL.read().unwrap().as_ref() {
        return Arc::clone(env);
    }
    let env = Arc::new(read_login_shell());
    *LOGIN_SHELL.write().unwrap() = Some(Arc::clone(&env));
    env
}

/// Called after the app edits a shell profile, so the next reachability check reads it again.
pub fn forget_login_shell() {
    *LOGIN_SHELL.write().unwrap() = None;
}

#[cfg(unix)]
fn read_login_shell() -> ShellEnv {
    let shell = user_shell().unwrap_or_else(|| PathBuf::from("/bin/sh"));
    let script = "printf '__WIRECAT_PATH__%s__WIRECAT_PNPM__%s' \"$PATH\" \"$PNPM_HOME\"";
    let flags = terminal_flags(&shell, cfg!(target_os = "linux"));
    let failed = |problem: String| ShellEnv {
        shell: Some(shell.to_string_lossy().into_owned()),
        problem: Some(problem),
        ..ShellEnv::default()
    };
    let out = match crate::run::run(&shell, &[flags, script], None, Duration::from_secs(5)) {
        Ok(out) => out,
        Err(e) => return failed(e.to_string()),
    };
    let Some((_, rest)) = out.stdout.rsplit_once("__WIRECAT_PATH__") else {
        return failed(format!("it printed no PATH (exit {})", out.code.map_or_else(|| "?".into(), |c| c.to_string())));
    };
    let (path, pnpm) = rest.split_once("__WIRECAT_PNPM__").unwrap_or((rest, ""));
    let non_empty = |s: &str| (!s.trim().is_empty()).then(|| OsString::from(s.trim()));
    ShellEnv {
        path: non_empty(path),
        pnpm_home: non_empty(pnpm),
        shell: Some(shell.to_string_lossy().into_owned()),
        problem: None,
    }
}

/// Where `find` looks, for a "not found" that says why: every folder, and the shell whose PATH was or was not read.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Lookup {
    pub folders: Vec<String>,
    pub shell: Option<String>,
    pub shell_problem: Option<String>,
}

pub fn lookup() -> Lookup {
    let env = login_shell();
    Lookup {
        folders: std::env::split_paths(&absolute(&search_path())).map(|d| tilde(&d.to_string_lossy())).collect(),
        shell: env.shell.clone(),
        shell_problem: env.problem.clone(),
    }
}

/// The PATH a new terminal running `shell` ends with. Asked fresh each time: used right after the app edits a file.
#[cfg(unix)]
pub fn shell_path(shell: &Path) -> Option<OsString> {
    let flags = terminal_flags(shell, cfg!(target_os = "linux"));
    let out =
        crate::run::run(shell, &[flags, "printf '__WIRECAT_PATH__%s' \"$PATH\""], None, Duration::from_secs(5)).ok()?;
    let (_, path) = out.stdout.rsplit_once("__WIRECAT_PATH__")?;
    (!path.trim().is_empty()).then(|| OsString::from(path.trim()))
}

#[cfg(windows)]
pub fn shell_path(_shell: &Path) -> Option<OsString> {
    None
}

/// The shell a new terminal window starts, so the check reads the same file `profile.rs` writes. Linux terminals
/// start bash as a non-login shell, which reads `.bashrc`; a login bash reads only `.profile` or `.bash_profile`, and a
/// fresh account's `.profile` need not source `.bashrc`, so `-l` there misses the app's own PATH block. zsh and fish
/// read their interactive file in a login shell too. Any other shell (dash, ksh) gets no file from the app, so the
/// check asks what a login shell reads: `~/.profile`.
#[cfg(unix)]
pub(crate) fn terminal_flags(shell: &Path, linux: bool) -> &'static str {
    match shell.file_name().and_then(|n| n.to_str()) {
        Some("bash") if linux => "-ic",
        Some("bash" | "zsh" | "fish") => "-lic",
        _ => "-lc",
    }
}

/// The shell the user's terminal runs: the one they chose in the app, else the account's login shell, else `$SHELL`,
/// else `/bin/sh`. `$SHELL` comes last because it is what started the app: a session started before `chsh`, or a
/// launcher, keeps an old one. `None` only on Windows.
pub fn user_shell() -> Option<PathBuf> {
    if cfg!(windows) {
        return None;
    }
    let usable = |p: &PathBuf| p.is_absolute() && p.is_file();
    chosen_shell()
        .or_else(|| cached_account_shell().filter(usable))
        .or_else(|| std::env::var_os("SHELL").map(PathBuf::from).filter(usable))
        .or_else(|| Some(PathBuf::from("/bin/sh")))
}

fn cached_account_shell() -> Option<PathBuf> {
    static ACCOUNT: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    ACCOUNT.get_or_init(account_shell).clone()
}

/// The shells `/etc/shells` lists that exist on this computer, one per real program (`/bin/bash` and `/usr/bin/bash`
/// are often the same file), in the file's order.
pub fn installed_shells() -> Vec<PathBuf> {
    let listed = std::fs::read_to_string("/etc/shells").map(|c| parse_etc_shells(&c)).unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    listed
        .into_iter()
        .filter(|p| p.is_file())
        .filter(|p| seen.insert(std::fs::canonicalize(p).unwrap_or_else(|_| p.clone())))
        .collect()
}

fn parse_etc_shells(content: &str) -> Vec<PathBuf> {
    content.lines().map(str::trim).filter(|l| l.starts_with('/')).map(PathBuf::from).collect()
}

/// The interface sends a path back; only one of the listed shells is accepted, compared as text, never resolved.
pub fn validate_shell(shell: &str, listed: &[PathBuf]) -> Result<PathBuf, String> {
    listed
        .iter()
        .find(|p| p.as_os_str() == shell)
        .cloned()
        .ok_or_else(|| format!("{shell} is not one of the shells this computer lists in /etc/shells."))
}

fn chosen_file() -> Option<PathBuf> {
    crate::node::app_data().map(|d| d.join("terminal-shell.json"))
}

/// The shell the user said their terminal runs; ignored once it is no longer installed.
pub fn chosen_shell() -> Option<PathBuf> {
    let text = std::fs::read_to_string(chosen_file()?).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let shell = value["shell"].as_str()?;
    validate_shell(shell, &installed_shells()).ok()
}

pub fn choose_shell(shell: &Path) -> Result<(), String> {
    let file = chosen_file().ok_or("The app's data folder is unknown.")?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", tilde(&dir.to_string_lossy())))?;
    }
    let json = serde_json::json!({ "shell": shell.to_string_lossy() }).to_string();
    std::fs::write(&file, json).map_err(|e| format!("Could not save the shell choice: {e}"))?;
    forget_login_shell();
    Ok(())
}

#[cfg(target_os = "macos")]
fn account_shell() -> Option<PathBuf> {
    let user = ["USER", "LOGNAME"].iter().find_map(|v| std::env::var(v).ok()).filter(|u| valid_user(u))?;
    let out = crate::run::run(
        Path::new("/usr/bin/dscl"),
        &[".", "-read", &format!("/Users/{user}"), "UserShell"],
        None,
        Duration::from_secs(3),
    )
    .ok()?;
    parse_dscl_shell(&out.stdout)
}

/// The shell in this process's own passwd entry, looked up by user id: `$USER` and `$SHELL` can be missing or name
/// someone else when the app starts from a launcher, `sudo -u` or a cleared environment. getent asks the same NSS
/// sources getpwuid does (LDAP and systemd-homed accounts included), without unsafe code here.
#[cfg(all(unix, not(target_os = "macos")))]
fn account_shell() -> Option<PathBuf> {
    use std::os::unix::fs::MetadataExt;
    let uid = std::fs::metadata("/proc/self").ok()?.uid().to_string();
    // NixOS has neither of the usual two.
    let getent = ["/usr/bin/getent", "/bin/getent", "/run/current-system/sw/bin/getent"]
        .into_iter()
        .map(Path::new)
        .find(|p| p.is_file())?;
    let out = crate::run::run(getent, &["passwd", &uid], None, Duration::from_secs(3)).ok()?;
    parse_passwd_shell(&out.stdout, &uid)
}

/// The shell field (the last) of the passwd line whose user id (the third field) is `uid`.
#[cfg(any(all(unix, not(target_os = "macos")), test))]
fn parse_passwd_shell(passwd: &str, uid: &str) -> Option<PathBuf> {
    let line = passwd.lines().find(|l| l.split(':').nth(2) == Some(uid))?;
    let shell = line.split(':').nth(6)?.trim();
    (!shell.is_empty()).then(|| PathBuf::from(shell))
}

#[cfg(windows)]
fn account_shell() -> Option<PathBuf> {
    None
}

#[cfg(any(target_os = "macos", test))]
fn valid_user(user: &str) -> bool {
    !user.is_empty()
        && user.len() <= 64
        && !user.starts_with('-')
        && user.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '$'))
}

/// `UserShell: /bin/zsh`, as `dscl . -read /Users/<user> UserShell` prints it.
#[cfg(any(target_os = "macos", test))]
fn parse_dscl_shell(out: &str) -> Option<PathBuf> {
    let shell = out.lines().find_map(|l| l.strip_prefix("UserShell:"))?.trim();
    (!shell.is_empty()).then(|| PathBuf::from(shell))
}

#[cfg(windows)]
fn read_login_shell() -> ShellEnv {
    ShellEnv::default()
}

/// pnpm refuses global commands when its home is unknown, which is the case for an app started from a launcher.
pub fn pnpm_home() -> Option<OsString> {
    std::env::var_os("PNPM_HOME").or_else(|| login_shell().pnpm_home.clone())
}

pub fn home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// `XDG_DOWNLOAD_DIR` from `user-dirs.dirs` on Linux, where Downloads may be translated; `~/Downloads` otherwise.
pub fn downloads() -> Option<PathBuf> {
    let home = home()?;
    if cfg!(target_os = "linux")
        && let Ok(dirs) = std::fs::read_to_string(home.join(".config/user-dirs.dirs"))
        && let Some(dir) = dirs.lines().find_map(|l| l.strip_prefix("XDG_DOWNLOAD_DIR=")).map(|v| v.trim_matches('"'))
        && let Some(rest) = dir.strip_prefix("$HOME/")
        && !rest.contains("..")
    {
        return Some(home.join(rest));
    }
    Some(home.join("Downloads"))
}

fn known_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(windows) {
        for (var, sub) in [("APPDATA", "npm"), ("LOCALAPPDATA", "pnpm"), ("ProgramFiles", "nodejs")] {
            if let Some(base) = std::env::var_os(var) {
                dirs.push(PathBuf::from(base).join(sub));
            }
        }
        return dirs;
    }
    if let Some(home) = home() {
        for sub in [
            ".local/share/pnpm",
            ".local/share/pnpm/bin",
            "Library/pnpm",
            ".volta/bin",
            ".npm-global/bin",
            ".bun/bin",
            ".local/bin",
        ] {
            dirs.push(home.join(sub));
        }
        dirs.extend(nvm_bins(&home.join(".nvm/versions/node")));
    }
    let user = ["USER", "LOGNAME"].iter().find_map(|v| std::env::var(v).ok());
    dirs.extend(nix_dirs(home().as_deref(), user.as_deref()));
    dirs.push("/opt/homebrew/bin".into());
    dirs.push("/usr/local/bin".into());
    dirs.push("/usr/bin".into());
    dirs
}

/// Nix installs programs only into profile folders. A launcher's PATH on NixOS or nix-darwin can miss them, and so does
/// ours when the login shell does not answer in time.
fn nix_dirs(home: Option<&Path>, user: Option<&str>) -> Vec<PathBuf> {
    let mut dirs = vec![PathBuf::from("/run/current-system/sw/bin")];
    if let Some(user) = user.filter(|u| !u.is_empty() && !u.contains('/')) {
        dirs.push(PathBuf::from(format!("/etc/profiles/per-user/{user}/bin")));
    }
    if let Some(home) = home {
        dirs.push(home.join(".nix-profile/bin"));
        dirs.push(home.join(".local/state/nix/profile/bin"));
    }
    dirs.push("/nix/var/nix/profiles/default/bin".into());
    dirs
}

/// Newest Node first, so a tool installed under the current nvm version wins over old ones.
fn nvm_bins(root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else { return vec![] };
    let mut versions: Vec<(semver::Version, PathBuf)> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().trim_start_matches('v').to_string();
            Some((semver::Version::parse(&name).ok()?, e.path().join("bin")))
        })
        .collect();
    versions.sort_by(|a, b| b.0.cmp(&a.0));
    versions.into_iter().map(|(_, p)| p).collect()
}

/// A relative PATH entry (`node_modules/.bin`, `.`) resolves against a working folder; the app has none of its own, and
/// one anybody can write to, such as the temp folder, would let another user plant the `npm` the app runs.
fn absolute(path: &std::ffi::OsStr) -> OsString {
    std::env::join_paths(std::env::split_paths(path).filter(|p| p.is_absolute())).unwrap_or_default()
}

/// The first executable with this name on `path`, skipping relative entries.
pub fn which_in(bin: &str, path: &std::ffi::OsStr) -> Option<PathBuf> {
    which::which_in(bin, Some(absolute(path)), std::env::temp_dir()).ok()
}

/// Every executable with this name, in PATH order; the first one is the one a terminal runs.
pub fn find_all(bin: &str) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = which::which_in_all(bin, Some(absolute(&search_path())), std::env::temp_dir())
        .map(Iterator::collect)
        .unwrap_or_default();
    one_per_folder(&mut found);
    found
}

/// npm links one install as `tg`, `tg.cmd` and `tg.ps1`, and a PATHEXT that lists `.PS1` makes `which` return the last
/// one too: a second "copy" that cannot even start. A terminal runs the first match in a folder, so that one counts.
fn one_per_folder(found: &mut Vec<PathBuf>) {
    let real = |p: &Path| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let mut files = std::collections::HashSet::new();
    let mut folders = std::collections::HashSet::new();
    found.retain(|p| {
        let folder = p.parent().map(real);
        files.insert(real(p)) && folders.insert(folder)
    });
}

pub fn find(bin: &str) -> Option<PathBuf> {
    find_all(bin).into_iter().next()
}

/// Whether a terminal finds `bin` on its own PATH, without the folders this app adds to find tools. A coding agent
/// runs commands in such a shell, so a tool only the app can find is one the agent cannot run.
pub fn in_terminal(bin: &str) -> bool {
    let fresh = if cfg!(windows) { crate::profile::windows_terminal_path() } else { login_shell().path.clone() };
    let path = fresh.or_else(|| std::env::var_os("PATH"));
    path.is_some_and(|p| which_in(bin, &p).is_some())
}

/// The PATH `bash -l -c` ends with when started from `base`: Hermes runs every command from a snapshot of such a
/// shell, so a folder added to PATH only in `~/.zshrc` or `~/.bashrc` is missing there.
#[cfg(unix)]
pub fn bash_login_path(base: &std::ffi::OsStr) -> Option<OsString> {
    // A profile may print something of its own first; only what follows the marker is the PATH.
    let script = ["-l", "-c", "printf '__WIRECAT_PATH__%s' \"$PATH\""];
    let out = crate::run::run(Path::new("bash"), &script, Some(base), Duration::from_secs(5)).ok()?;
    let (_, path) = out.stdout.rsplit_once("__WIRECAT_PATH__")?;
    (!path.trim().is_empty()).then(|| OsString::from(path.trim()))
}

#[cfg(windows)]
pub fn bash_login_path(_base: &std::ffi::OsStr) -> Option<OsString> {
    login_shell().path.clone()
}

pub fn finds(bin: &str, path: &std::ffi::OsStr) -> bool {
    which_in(bin, path).is_some()
}

pub fn manager_for(path: &Path) -> &'static str {
    let s = path.to_string_lossy().replace('\\', "/").to_lowercase();
    if s.contains("/pnpm/") {
        "pnpm"
    } else if s.contains("/.bun/") {
        "bun"
    } else if s.contains("/.volta/") {
        "volta"
    } else {
        "npm"
    }
}

/// A path as the interface shows it: the home folder at its start as `~`, without Windows' `\\?\` prefix.
pub fn tilde(s: &str) -> String {
    tilde_with(s, home().as_deref())
}

/// Windows' long-path form as people write the path: `\\?\C:\x` is `C:\x`, `\\?\UNC\srv\share` is `\\srv\share`.
/// Any other `\\?\` path, such as a volume GUID, stays as it is.
pub fn plain_windows(s: &str) -> String {
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    match s.strip_prefix(r"\\?\") {
        Some(rest) if is_drive(rest) => rest.to_string(),
        _ => s.to_string(),
    }
}

fn is_drive(s: &str) -> bool {
    let mut c = s.chars();
    c.next().is_some_and(|d| d.is_ascii_alphabetic()) && c.next() == Some(':')
}

fn tilde_with(s: &str, home: Option<&Path>) -> String {
    let plain = plain_windows(s);
    let s = plain.as_str();
    match home.map(|h| Path::new(s).strip_prefix(h)) {
        Some(Ok(rest)) if rest.as_os_str().is_empty() => "~".to_string(),
        Some(Ok(rest)) => format!("~{}{}", std::path::MAIN_SEPARATOR, rest.to_string_lossy()),
        _ => s.to_string(),
    }
}

/// Every path inside a text, such as a tool's error, with the home folder as `~`. Only a whole path part matches:
/// with home `/home/a`, `/home/ab` stays.
pub fn tilde_text(s: &str) -> String {
    tilde_text_with(s, home().as_deref())
}

/// `plain_windows` for every long-path form inside a text.
fn plain_windows_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(at) = rest.find(r"\\?\") {
        out.push_str(&rest[..at]);
        let after = &rest[at + 4..];
        if let Some(unc) = after.strip_prefix(r"UNC\") {
            out.push_str(r"\\");
            rest = unc;
        } else {
            if !is_drive(after) {
                out.push_str(r"\\?\");
            }
            rest = after;
        }
    }
    out.push_str(rest);
    out
}

fn tilde_text_with(s: &str, home: Option<&Path>) -> String {
    let s = plain_windows_text(s);
    let Some(home) = home.map(|h| h.to_string_lossy().into_owned()).filter(|h| h.len() > 1) else { return s };
    let mut out = String::with_capacity(s.len());
    let mut rest = s.as_str();
    while let Some(at) = rest.find(&home) {
        let after = &rest[at + home.len()..];
        let whole = after.chars().next().is_none_or(|c| !(c.is_alphanumeric() || matches!(c, '_' | '-' | '.')));
        out.push_str(&rest[..at]);
        out.push_str(if whole { "~" } else { &home });
        rest = after;
    }
    out.push_str(rest);
    out
}

/// `tools::detect` reports paths with `~`; turn them back into real ones.
pub fn untilde(shown: &str) -> PathBuf {
    match (shown.strip_prefix('~'), home()) {
        (Some(rest), Some(home)) => home.join(rest.trim_start_matches(['/', '\\'])),
        _ => PathBuf::from(shown),
    }
}

#[cfg(test)]
mod tests {

    #[cfg(unix)]
    #[test]
    fn checks_each_shell_as_a_new_terminal_starts_it() {
        let flags = |s: &str, linux| terminal_flags(Path::new(s), linux);
        assert_eq!(flags("/bin/bash", true), "-ic");
        assert_eq!(flags("/usr/bin/bash", false), "-lic");
        assert_eq!(flags("/bin/zsh", true), "-lic");
        assert_eq!(flags("/bin/zsh", false), "-lic");
        assert_eq!(flags("/usr/bin/fish", true), "-lic");
        assert_eq!(flags("/bin/dash", true), "-lc");
        assert_eq!(flags("/bin/sh", false), "-lc");
    }

    #[test]
    fn reads_the_shell_from_the_passwd_line_of_a_user_id() {
        let passwd = "leemour:x:1000:1000:Slava,,,:/home/leemour:/usr/bin/zsh\n";
        assert_eq!(parse_passwd_shell(passwd, "1000"), Some(PathBuf::from("/usr/bin/zsh")));
        assert_eq!(parse_passwd_shell(passwd, "100"), None);
        assert_eq!(parse_passwd_shell("leemour:x:1000:1000::/home/leemour:\n", "1000"), None);
        assert_eq!(parse_passwd_shell("leemour:x:1000", "1000"), None);
        assert_eq!(parse_passwd_shell("", "1000"), None);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn finds_the_account_shell_by_user_id() {
        assert!(account_shell().is_some_and(|s| s.is_absolute()));
    }

    #[test]
    fn lists_only_absolute_shells_and_accepts_only_a_listed_one() {
        let listed = parse_etc_shells("# /etc/shells\n/bin/sh\n/usr/bin/zsh\n\n  /usr/bin/fish  \nbash\n");
        let as_paths: Vec<PathBuf> = ["/bin/sh", "/usr/bin/zsh", "/usr/bin/fish"].map(PathBuf::from).into();
        assert_eq!(listed, as_paths);
        assert_eq!(validate_shell("/usr/bin/zsh", &listed), Ok(PathBuf::from("/usr/bin/zsh")));
        assert!(validate_shell("/usr/bin/zsh -c id", &listed).is_err());
        assert!(validate_shell("/usr/bin/../bin/zsh", &listed).is_err());
        assert!(validate_shell("zsh", &listed).is_err());
        assert!(validate_shell("", &listed).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn shows_the_home_folder_as_tilde_only_where_a_path_starts_with_it() {
        let home = Some(Path::new("/home/a"));
        assert_eq!(tilde_with("/home/a", home), "~");
        assert_eq!(tilde_with("/home/a/Notes", home), "~/Notes");
        assert_eq!(tilde_with("/home/ab/Notes", home), "/home/ab/Notes");
        assert_eq!(tilde_with("/srv/home/a/Notes", home), "/srv/home/a/Notes");
        assert_eq!(tilde_with("/home/a/Notes", None), "/home/a/Notes");
        assert_eq!(tilde_text_with("cannot open /home/a/x and /home/ab/y", home), "cannot open ~/x and /home/ab/y");
        assert_eq!(tilde_text_with("in /home/a: denied; /home/a.bak", home), "in ~: denied; /home/a.bak");
    }

    #[test]
    fn writes_a_windows_long_path_as_people_write_it() {
        assert_eq!(plain_windows(r"\\?\C:\Users\a"), r"C:\Users\a");
        assert_eq!(plain_windows(r"\\?\UNC\srv\share\Notes"), r"\\srv\share\Notes");
        assert_eq!(plain_windows(r"\\?\Volume{1}\x"), r"\\?\Volume{1}\x");
        assert_eq!(plain_windows("/home/a"), "/home/a");
        assert_eq!(
            plain_windows_text(r"open \\?\UNC\srv\share\x and \\?\D:\y and \\?\Volume{1}"),
            r"open \\srv\share\x and D:\y and \\?\Volume{1}"
        );
    }

    #[cfg(windows)]
    #[test]
    fn shows_a_windows_path_without_its_long_path_prefix() {
        let home = Some(Path::new(r"C:\Users\a"));
        assert_eq!(tilde_with(r"\\?\C:\Users\a\Notes", home), r"~\Notes");
        assert_eq!(tilde_with(r"\\?\D:\Vault", home), r"D:\Vault");
        assert_eq!(tilde_with(r"C:\Users\ab\Notes", home), r"C:\Users\ab\Notes");
        assert_eq!(tilde_text_with(r"open \\?\C:\Users\a\x failed", home), r"open ~\x failed");
    }

    #[test]
    fn reads_the_shell_from_dscl_output() {
        assert_eq!(parse_dscl_shell("UserShell: /bin/zsh\n"), Some(PathBuf::from("/bin/zsh")));
        assert_eq!(parse_dscl_shell("UserShell:\n"), None);
        assert_eq!(parse_dscl_shell("<dscl_cmd> DS Error: -14136 (eDSRecordNotFound)"), None);
    }

    #[test]
    fn accepts_only_plain_account_names() {
        assert!(valid_user("leemour"));
        assert!(valid_user("first.last-2"));
        assert!(!valid_user(""));
        assert!(!valid_user("-o"));
        assert!(!valid_user("a b"));
        assert!(!valid_user("a/b"));
    }

    use super::*;

    #[cfg(unix)]
    #[test]
    fn a_relative_path_entry_never_finds_a_program_in_the_temp_folder() {
        use std::os::unix::fs::PermissionsExt;
        let planted = std::env::temp_dir().join(format!("wirecat-planted-{}", std::process::id()));
        let program = planted.join("npm");
        std::fs::create_dir_all(&planted).unwrap();
        std::fs::write(&program, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).unwrap();
        let relative = planted.file_name().unwrap().to_owned();
        let found = which_in("npm", &relative);
        std::fs::remove_dir_all(&planted).unwrap();
        assert_eq!(found, None);
        assert_eq!(absolute(std::ffi::OsStr::new("node_modules/.bin:/usr/bin:.")), OsString::from("/usr/bin"));
    }

    #[cfg(unix)]
    #[test]
    fn finds_a_program_installed_into_a_nix_profile() {
        use std::os::unix::fs::PermissionsExt;
        let home = std::env::temp_dir().join(format!("wirecat-nix-{}", std::process::id()));
        let bin = home.join(".nix-profile/bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join("openclaw"), "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(bin.join("openclaw"), std::fs::Permissions::from_mode(0o755)).unwrap();
        let dirs = nix_dirs(Some(&home), Some("slava"));
        let found = which_in("openclaw", &std::env::join_paths(&dirs).unwrap());
        std::fs::remove_dir_all(&home).unwrap();
        assert_eq!(found, Some(bin.join("openclaw")));
        assert!(dirs.contains(&PathBuf::from("/run/current-system/sw/bin")));
        assert!(dirs.contains(&PathBuf::from("/etc/profiles/per-user/slava/bin")));
        assert!(!nix_dirs(None, Some("../x")).iter().any(|d| d.starts_with("/etc/profiles")));
    }

    #[test]
    fn the_shims_of_one_install_are_one_copy() {
        let dir = std::env::temp_dir().join(format!("wirecat-shims-{}", std::process::id()));
        let other = dir.join("other");
        std::fs::create_dir_all(&other).unwrap();
        let mut found: Vec<PathBuf> =
            [dir.join("tg.cmd"), dir.join("tg.ps1"), other.join("tg.cmd")].into_iter().collect();
        for p in &found {
            std::fs::write(p, "").unwrap();
        }
        one_per_folder(&mut found);
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(found, [dir.join("tg.cmd"), other.join("tg.cmd")]);
    }

    #[test]
    fn manager_from_install_location() {
        assert_eq!(manager_for(Path::new("/home/u/.local/share/pnpm/bin/tg")), "pnpm");
        assert_eq!(manager_for(Path::new("/home/u/.nvm/versions/node/v24.1.0/bin/zm")), "npm");
        assert_eq!(manager_for(Path::new(r"C:\Users\u\AppData\Local\pnpm\tg.cmd")), "pnpm");
    }

    /// `cargo test -- --ignored real_terminal`: which tools a terminal finds, names and booleans only.
    #[test]
    #[ignore = "reads this computer's shell"]
    fn real_terminal() {
        if !crate::probe::allowed() {
            return;
        }
        for bin in ["tg", "max", "wa", "zm", "drive", "memo"] {
            let bash =
                bash_login_path(std::ffi::OsStr::new("/usr/local/bin:/usr/bin:/bin")).is_some_and(|p| finds(bin, &p));
            println!(
                "{bin}: app finds {}, terminal finds {}, bash -l finds {bash}",
                find(bin).is_some(),
                in_terminal(bin)
            );
        }
    }
}
