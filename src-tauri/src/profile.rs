use crate::paths;
use serde::Serialize;
use std::path::{Path, PathBuf};

const START: &str = "# Added by WireCat Desktop: Node.js for WireCat tools. Delete this block to undo.";
const END: &str = "# End of WireCat Desktop block";
// A second block, so the Node.js line (replaced on every Node.js update) never overwrites the tool folders.
const TOOLS_START: &str = "# Added by WireCat Desktop: folders of WireCat tools. Delete this block to undo.";
const TOOLS_END: &str = "# End of WireCat Desktop tools block";

/// What "Add to PATH" would do, shown in full before anything is written.
#[derive(specta::Type, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPlan {
    /// `bash`, `zsh`, `fish`, `windows`, or the shell's own name when we do not edit its files.
    pub shell: String,
    /// The file the line goes into (`~`-shortened); for Windows, the registry value.
    pub file: Option<String>,
    pub line: String,
    pub added: bool,
    /// False when the user has to add the line themselves (an unknown shell, an unusual folder name).
    pub automatic: bool,
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum Shell {
    Bash,
    Zsh,
    Fish,
    Other,
}

fn kind(program: &Path) -> Shell {
    match program.file_name().and_then(|n| n.to_str()) {
        Some("bash") => Shell::Bash,
        Some("zsh") => Shell::Zsh,
        Some("fish") => Shell::Fish,
        _ => Shell::Other,
    }
}

/// A startup file that gets the app's blocks, and the shell that reads it.
#[derive(Debug, PartialEq, Clone)]
struct Target {
    shell: Shell,
    file: PathBuf,
}

/// The files of one shell and the program that checks them, for the reachability report.
pub struct ShellFiles {
    pub name: String,
    pub program: Option<PathBuf>,
    pub files: Vec<PathBuf>,
    /// The shell the user's terminal runs; the others are only kept in step.
    pub primary: bool,
}

#[derive(Clone)]
struct Env {
    macos: bool,
    /// The terminal's shell: `paths::user_shell`.
    shell: Option<PathBuf>,
    /// `/etc/shells` entries that exist.
    installed: Vec<PathBuf>,
    home: PathBuf,
    zdotdir: Option<PathBuf>,
    xdg_config: Option<PathBuf>,
}

impl Env {
    fn current() -> Option<Self> {
        let abs = |v: &str| std::env::var_os(v).map(PathBuf::from).filter(|p| p.is_absolute());
        Some(Self {
            macos: cfg!(target_os = "macos"),
            shell: paths::user_shell(),
            installed: paths::installed_shells(),
            home: paths::home()?,
            zdotdir: abs("ZDOTDIR"),
            xdg_config: abs("XDG_CONFIG_HOME"),
        })
    }

    fn shell(&self) -> (Shell, String) {
        let name = self.shell.as_deref().and_then(|s| s.file_name()?.to_str()).unwrap_or("sh");
        (self.shell.as_deref().map_or(Shell::Other, kind), name.to_string())
    }

    fn fish_dir(&self) -> PathBuf {
        self.xdg_config.clone().unwrap_or_else(|| self.home.join(".config")).join("fish")
    }

    /// Terminal emulators on Linux start interactive non-login shells (`.bashrc`); macOS Terminal starts login shells,
    /// and login bash reads `.bash_profile` instead. zsh reads `.zshrc` in both. fish gets its own file in `conf.d`.
    fn file(&self, shell: Shell) -> Option<PathBuf> {
        match shell {
            Shell::Bash if self.macos => Some(self.home.join(".bash_profile")),
            Shell::Bash => Some(self.home.join(".bashrc")),
            Shell::Zsh => Some(self.zdotdir.as_ref().unwrap_or(&self.home).join(".zshrc")),
            Shell::Fish => Some(self.fish_dir().join("conf.d/wirecat-desktop.fish")),
            Shell::Other => None,
        }
    }

    /// Every file the blocks go into. The terminal's shell always gets its file, created when missing. Another
    /// installed shell gets one only when the user already uses it: its file exists (fish: its config folder), because
    /// a new `~/.zshrc` would skip zsh's first-run setup and a new fish folder clutters a home that never ran fish.
    /// On Linux a login bash (SSH, `bash -l`) reads `~/.bash_profile` and not `~/.bashrc`; when that file exists and
    /// does not load `~/.bashrc`, it gets the block too. A missing one is left alone: login bash then reads
    /// `~/.profile`, which loads `~/.bashrc` on the usual distributions.
    fn targets(&self, exists: &dyn Fn(&Path) -> bool, read: &dyn Fn(&Path) -> Option<String>) -> Vec<Target> {
        let mut out: Vec<Target> = Vec::new();
        let push = |out: &mut Vec<Target>, shell, file: PathBuf| {
            if !out.iter().any(|t| t.file == file) {
                out.push(Target { shell, file });
            }
        };
        let primary = self.shell().0;
        if let Some(file) = self.file(primary) {
            push(&mut out, primary, file);
        }
        for other in [Shell::Bash, Shell::Zsh, Shell::Fish] {
            if other == primary || !self.installed.iter().any(|p| kind(p) == other) {
                continue;
            }
            let Some(file) = self.file(other) else { continue };
            let used = if other == Shell::Fish { exists(&self.fish_dir()) } else { exists(&file) };
            if used {
                push(&mut out, other, file);
            }
        }
        if !self.macos && out.iter().any(|t| t.shell == Shell::Bash) {
            let login = self.home.join(".bash_profile");
            if read(&login).is_some_and(|c| !sources_bashrc(&c)) {
                push(&mut out, Shell::Bash, login);
            }
        }
        out
    }

    /// Every file the app may ever have written, for `remove`.
    fn all_files(&self) -> Vec<PathBuf> {
        let mut files: Vec<PathBuf> =
            [Shell::Bash, Shell::Zsh, Shell::Fish].iter().filter_map(|s| self.file(*s)).collect();
        for extra in [self.home.join(".bash_profile"), self.home.join(".bashrc")] {
            if !files.contains(&extra) {
                files.push(extra);
            }
        }
        files
    }

    /// `$HOME/...` keeps the line readable and correct if the home folder is ever renamed. `None` when the folder
    /// holds a character that would need escaping inside double quotes; then the user adds it by hand.
    fn line(&self, shell: Shell, bin: &Path) -> (String, bool) {
        let raw = bin.to_string_lossy();
        let shown = match bin.strip_prefix(&self.home) {
            Ok(rest) => format!("$HOME/{}", rest.to_string_lossy()),
            Err(_) => raw.to_string(),
        };
        let safe = !raw.chars().any(|c| matches!(c, '"' | '$' | '`' | '\\' | '\n' | '\r'));
        let line = match shell {
            Shell::Fish => format!("set -gx PATH \"{shown}\" $PATH"),
            _ => format!("export PATH=\"{shown}:$PATH\""),
        };
        (line, safe && shell != Shell::Other)
    }

    fn shell_files(&self, targets: &[Target]) -> Vec<ShellFiles> {
        let primary = self.shell().0;
        let mut out: Vec<ShellFiles> = Vec::new();
        for t in targets {
            let name = match t.shell {
                Shell::Bash => "bash",
                Shell::Zsh => "zsh",
                Shell::Fish => "fish",
                Shell::Other => continue,
            };
            if let Some(entry) = out.iter_mut().find(|s| s.name == name) {
                entry.files.push(t.file.clone());
                continue;
            }
            let program = if t.shell == primary {
                self.shell.clone()
            } else {
                self.installed.iter().find(|p| kind(p) == t.shell).cloned()
            };
            out.push(ShellFiles {
                name: name.into(),
                program,
                files: vec![t.file.clone()],
                primary: t.shell == primary,
            });
        }
        out
    }
}

/// A line that loads `~/.bashrc` (`. ~/.bashrc`, `source "$HOME/.bashrc"`, `[ -f ~/.bashrc ] && . ~/.bashrc`).
fn sources_bashrc(content: &str) -> bool {
    content.lines().map(str::trim).any(|l| !l.starts_with('#') && l.contains(".bashrc"))
}

fn exists(p: &Path) -> bool {
    p.exists()
}

fn read_some(p: &Path) -> Option<String> {
    std::fs::read_to_string(p).ok()
}

/// The block always goes in front of PATH: tools start with `#!/usr/bin/env node`, and an older Node earlier in
/// PATH would run them and fail. The same folder in the tools block goes, so a file never lists it twice.
fn insert_block(content: &str, line: &str) -> String {
    insert_marked(&drop_folder(content, line), START, END, &[line.to_string()])
}

fn insert_marked(content: &str, start: &str, end: &str, lines: &[String]) -> String {
    let mut out = remove_marked(content, start, end);
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
    if !out.is_empty() {
        out.push('\n');
    }
    let mut block = vec![start];
    block.extend(lines.iter().map(String::as_str));
    block.extend([end, ""]);
    out + &block.join("\n")
}

fn remove_block(content: &str) -> String {
    remove_marked(content, START, END)
}

/// The lines between two markers, in file order; empty when there is no such block.
fn marked_lines(content: &str, start_marker: &str, end_marker: &str) -> Vec<String> {
    let Some(start) = content.find(start_marker) else { return vec![] };
    let body = &content[start + start_marker.len()..];
    let Some(end) = body.find(end_marker) else { return vec![] };
    body[..end].lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect()
}

fn tools_lines(content: &str) -> Vec<String> {
    marked_lines(content, TOOLS_START, TOOLS_END)
}

/// Whether either block already puts this exact line on PATH.
fn has_line(content: &str, line: &str) -> bool {
    let line = line.to_string();
    tools_lines(content).contains(&line) || marked_lines(content, START, END).contains(&line)
}

/// Adds one folder's line to the tools block, newest first. A folder the Node.js block already holds (tools installed
/// with the app's Node.js live beside it) is not repeated, and a copy left in the tools block by an older app goes.
fn insert_folder(content: &str, line: &str) -> String {
    if marked_lines(content, START, END).iter().any(|l| l == line) {
        return drop_folder(content, line);
    }
    let mut lines = tools_lines(content);
    if lines.iter().any(|l| l == line) {
        return content.to_string();
    }
    lines.insert(0, line.to_string());
    insert_marked(content, TOOLS_START, TOOLS_END, &lines)
}

/// Takes one line out of the tools block, and the block itself once it is empty.
fn drop_folder(content: &str, line: &str) -> String {
    let mut lines = tools_lines(content);
    if !lines.iter().any(|l| l == line) {
        return content.to_string();
    }
    lines.retain(|l| l != line);
    if lines.is_empty() {
        remove_marked(content, TOOLS_START, TOOLS_END)
    } else {
        // Rewritten in place, so the block keeps its position relative to the Node.js one.
        let Some(start) = content.find(TOOLS_START) else { return content.to_string() };
        let Some(end_rel) = content[start..].find(TOOLS_END) else { return content.to_string() };
        let mut block = vec![TOOLS_START.to_string()];
        block.extend(lines);
        block.push(TOOLS_END.to_string());
        format!("{}{}{}", &content[..start], block.join("\n"), &content[start + end_rel + TOOLS_END.len()..])
    }
}

fn remove_marked(content: &str, start_marker: &str, end_marker: &str) -> String {
    let Some(start) = content.find(start_marker) else { return content.to_string() };
    let Some(end_rel) = content[start..].find(end_marker) else { return content.to_string() };
    let mut end = start + end_rel + end_marker.len();
    if content[end..].starts_with('\n') {
        end += 1;
    }
    let before = &content[..start];
    // Drop the blank line insert_block put in front, but nothing the user wrote.
    let before = before.strip_suffix("\n\n").map_or_else(|| before.to_string(), |b| format!("{b}\n"));
    format!("{before}{}", &content[end..])
}

pub fn plan(bin: &Path) -> PathPlan {
    if cfg!(windows) {
        return windows::plan(bin);
    }
    let Some(env) = Env::current() else {
        return PathPlan {
            shell: "sh".into(),
            file: None,
            line: format!("export PATH=\"{}:$PATH\"", bin.display()),
            added: false,
            automatic: false,
        };
    };
    let (shell, name) = env.shell();
    let file = env.file(shell);
    let (line, automatic) = env.line(shell, bin);
    // The exact line: a block left by an older Node.js version does not put this one on PATH.
    let added = file
        .as_ref()
        .and_then(|f| std::fs::read_to_string(f).ok())
        .is_some_and(|c| c.contains(START) && c.contains(&line));
    PathPlan { shell: name, file: file.map(|f| paths::tilde(&f.to_string_lossy())), line, added, automatic }
}

/// `plan` for a tool folder, which lives in its own block beside the Node.js one, or in the Node.js one itself.
pub fn plan_folder(dir: &Path) -> PathPlan {
    let mut plan = plan(dir);
    if cfg!(windows) {
        return plan;
    }
    plan.added = Env::current()
        .and_then(|env| env.file(env.shell().0))
        .and_then(|f| std::fs::read_to_string(f).ok())
        .is_some_and(|c| has_line(&c, &plan.line));
    plan
}

/// The shells whose files the app writes, and those files, for the reachability report. Empty on Windows.
pub fn shell_files() -> Vec<ShellFiles> {
    if cfg!(windows) {
        return vec![];
    }
    Env::current().map(|env| env.shell_files(&env.targets(&exists, &read_some))).unwrap_or_default()
}

/// Writes `edit`'s change into every target file. The terminal's own file must succeed; another shell's file that
/// cannot be written is skipped, since that shell is not the one the user's terminal runs.
fn write_all(bin: &Path, edit: impl Fn(&str, &str) -> String) -> Result<(), String> {
    let env = Env::current().ok_or("Your home folder is unknown.")?;
    let result = write_targets(&env, bin, edit);
    crate::paths::forget_login_shell();
    result
}

fn write_targets(env: &Env, bin: &Path, edit: impl Fn(&str, &str) -> String) -> Result<(), String> {
    let primary = env.shell().0;
    let mut wrote = false;
    for target in env.targets(&exists, &read_some) {
        let (line, automatic) = env.line(target.shell, bin);
        if !automatic {
            continue;
        }
        let result = read(&target.file).and_then(|content| {
            let updated = edit(&content, &line);
            if updated != content {
                write(&target.file, &updated)?;
            }
            Ok(())
        });
        match result {
            Ok(()) => wrote = true,
            Err(e) if target.shell == primary => return Err(e),
            Err(_) => {}
        }
    }
    if wrote { Ok(()) } else { Err("Add the line to your shell's startup file yourself.".into()) }
}

/// Puts a tool folder on the user's PATH next to the Node.js one; adding the same folder again changes nothing.
pub fn add_folder(dir: &Path) -> Result<PathPlan, String> {
    if cfg!(windows) {
        ensure_on_windows_path(dir)?;
        return Ok(plan(dir));
    }
    write_all(dir, insert_folder)?;
    Ok(plan_folder(dir))
}

pub fn add(bin: &Path) -> Result<PathPlan, String> {
    if cfg!(windows) {
        windows::set(bin, true)?;
        return Ok(plan(bin));
    }
    write_all(bin, insert_block)?;
    Ok(plan(bin))
}

/// Takes the Node.js block, and the same folder in a tools block, out of every file the app may have written.
pub fn remove(bin: &Path) -> Result<PathPlan, String> {
    if cfg!(windows) {
        windows::set(bin, false)?;
        return Ok(plan(bin));
    }
    let env = Env::current().ok_or("Your home folder is unknown.")?;
    let result = remove_from(&env, bin);
    crate::paths::forget_login_shell();
    result.map(|()| plan(bin))
}

fn remove_from(env: &Env, bin: &Path) -> Result<(), String> {
    let fish = env.file(Shell::Fish);
    for file in env.all_files().into_iter().filter(|f| f.exists()) {
        let shell = if Some(&file) == fish.as_ref() { Shell::Fish } else { Shell::Bash };
        let line = env.line(shell, bin).0;
        let content = read(&file)?;
        let left = drop_folder(&remove_block(&content), &line);
        if shell == Shell::Fish && left.trim().is_empty() {
            // The fish file is ours alone; an empty one would only be clutter.
            std::fs::remove_file(&file).map_err(|e| failed("delete", &file, &e))?;
        } else if left != content {
            write(&file, &left)?;
        }
    }
    Ok(())
}

/// Adds a folder to the end of the user Path unless it is there already; an entry the user placed keeps its place.
pub fn ensure_on_windows_path(dir: &Path) -> Result<(), String> {
    let value = windows::read().unwrap_or_default();
    if windows::contains(&value, &dir.to_string_lossy()) {
        return Ok(());
    }
    windows::set_at_end(dir)
}

/// At launch on Windows: puts back on the user Path the folders tools run from, when they are missing there. `WireCat`'s
/// own Node.js goes in front, as after setup; `%APPDATA%\npm` at the end. Only registry reads when nothing is missing.
pub fn keep_tools_on_windows_path(node: Option<&Path>, user_npm: Option<&Path>) {
    let value = windows::read().unwrap_or_default();
    let (front, end) = windows_missing(&value, node, user_npm, |name| std::env::var(name).ok());
    if let Some(dir) = front {
        let _ = windows::set(dir, true);
    }
    if let Some(dir) = end {
        let _ = ensure_on_windows_path(dir);
    }
}

/// Which of the two folders the user Path lacks; its entries are compared expanded, so `%APPDATA%\npm` counts.
fn windows_missing<'a>(
    user_path: &str,
    node: Option<&'a Path>,
    user_npm: Option<&'a Path>,
    var: impl Fn(&str) -> Option<String>,
) -> (Option<&'a Path>, Option<&'a Path>) {
    let expanded = windows::expand(user_path, var);
    let missing = |dir: Option<&'a Path>| dir.filter(|d| !windows::contains(&expanded, &d.to_string_lossy()));
    (missing(node), missing(user_npm))
}

/// The PATH a terminal opened now gets: the system Path, then the user Path, read fresh from the registry. The app's
/// own environment is the one it started with, so a folder added since then would be missing from it.
pub fn windows_terminal_path() -> Option<std::ffi::OsString> {
    let joined: Vec<String> =
        [windows::read_system(), windows::read()].into_iter().flatten().filter(|v| !v.is_empty()).collect();
    (!joined.is_empty()).then(|| windows::expand(&joined.join(";"), |name| std::env::var(name).ok()).into())
}

fn read(file: &Path) -> Result<String, String> {
    match std::fs::read_to_string(file) {
        Ok(c) => Ok(c),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(failed("read", file, &e)),
    }
}

/// Writes through a symlink to its target (dotfile managers link `~/.zshrc`), via a sibling temp file so a crash
/// never leaves a half-written profile.
fn write(file: &Path, content: &str) -> Result<(), String> {
    let real = std::fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    if let Some(dir) = real.parent() {
        std::fs::create_dir_all(dir).map_err(|e| failed("create", dir, &e))?;
    }
    let tmp = real.with_extension(format!("wirecat-{}", std::process::id()));
    std::fs::write(&tmp, content).map_err(|e| failed("write", &tmp, &e))?;
    if let Ok(meta) = std::fs::metadata(&real) {
        let _ = std::fs::set_permissions(&tmp, meta.permissions());
    }
    std::fs::rename(&tmp, &real).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        failed("write", &real, &e)
    })
}

fn failed(what: &str, path: &Path, e: &std::io::Error) -> String {
    format!("Could not {what} {}: {e}", paths::tilde(&path.to_string_lossy()))
}

/// The user's own PATH in `HKCU\Environment`: no administrator rights, and the value keeps its `REG_EXPAND_SZ` type
/// so entries like `%USERPROFILE%\...` keep working. `setx` is avoided: it cuts values at 1024 characters.
mod windows {
    use super::PathPlan;
    use std::path::Path;

    pub fn read() -> Option<String> {
        imp::read()
    }

    pub fn read_system() -> Option<String> {
        imp::read_system()
    }

    pub fn set_at_end(bin: &Path) -> Result<(), String> {
        let dir = bin.to_string_lossy().to_string();
        if dir.contains(';') {
            return Err("The folder name contains a semicolon; add it to PATH yourself.".into());
        }
        let mut kept = entries(&imp::read().unwrap_or_default()).join(";");
        if !kept.is_empty() {
            kept.push(';');
        }
        imp::write(&(kept + &dir))
    }

    /// `%NAME%` as Windows expands a `REG_EXPAND_SZ` value; an unknown name stays as written, as there.
    pub fn expand(value: &str, var: impl Fn(&str) -> Option<String>) -> String {
        let mut out = String::new();
        let mut rest = value;
        while let Some(start) = rest.find('%') {
            out.push_str(&rest[..start]);
            let after = &rest[start + 1..];
            match after.find('%') {
                Some(end) if end > 0 => {
                    let name = &after[..end];
                    match var(name) {
                        Some(v) => out.push_str(&v),
                        None => out.push_str(&rest[start..=start + end + 1]),
                    }
                    rest = &after[end + 1..];
                }
                _ => {
                    out.push('%');
                    rest = after;
                }
            }
        }
        out + rest
    }

    pub fn entries(value: &str) -> Vec<&str> {
        value.split(';').filter(|e| !e.trim().is_empty()).collect()
    }

    fn same(a: &str, b: &str) -> bool {
        a.trim_end_matches('\\').eq_ignore_ascii_case(b.trim_end_matches('\\'))
    }

    pub fn with(value: &str, dir: &str, add: bool) -> String {
        let mut kept: Vec<&str> = entries(value).into_iter().filter(|e| !same(e, dir)).collect();
        if add {
            kept.insert(0, dir);
        }
        kept.join(";")
    }

    pub fn contains(value: &str, dir: &str) -> bool {
        entries(value).iter().any(|e| same(e, dir))
    }

    pub fn plan(bin: &Path) -> PathPlan {
        let dir = bin.to_string_lossy().to_string();
        PathPlan {
            shell: "windows".into(),
            file: Some(r"HKEY_CURRENT_USER\Environment\Path".into()),
            added: imp::read().is_some_and(|v| contains(&v, &dir)),
            automatic: cfg!(windows) && !dir.contains(';'),
            line: dir,
        }
    }

    pub fn set(bin: &Path, add: bool) -> Result<(), String> {
        let dir = bin.to_string_lossy().to_string();
        if dir.contains(';') {
            return Err("The folder name contains a semicolon; add it to PATH yourself.".into());
        }
        imp::write(&with(&imp::read().unwrap_or_default(), &dir, add))
    }

    #[cfg(windows)]
    mod imp {
        use winreg::RegKey;
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WRITE, REG_EXPAND_SZ};

        pub fn read() -> Option<String> {
            let env = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags("Environment", KEY_READ).ok()?;
            env.get_value::<String, _>("Path").ok()
        }

        pub fn read_system() -> Option<String> {
            let env = RegKey::predef(HKEY_LOCAL_MACHINE)
                .open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", KEY_READ)
                .ok()?;
            env.get_value::<String, _>("Path").ok()
        }

        pub fn write(value: &str) -> Result<(), String> {
            let env = RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
                .map_err(|e| format!("Could not open your environment settings: {e}"))?;
            let wide: Vec<u8> = value.encode_utf16().chain(std::iter::once(0)).flat_map(u16::to_le_bytes).collect();
            env.set_raw_value("Path", &winreg::RegValue { bytes: wide.into(), vtype: REG_EXPAND_SZ })
                .map_err(|e| format!("Could not change your PATH: {e}"))?;
            broadcast();
            Ok(())
        }

        /// Tells Explorer the environment changed, so terminals opened from now on see the new PATH without signing out.
        #[allow(unsafe_code)] // one documented Win32 call; the string outlives it
        fn broadcast() {
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                HWND_BROADCAST, SMTO_ABORTIFHUNG, SendMessageTimeoutW, WM_SETTINGCHANGE,
            };
            let name: Vec<u16> = "Environment".encode_utf16().chain(std::iter::once(0)).collect();
            let mut result = 0usize;
            // SAFETY: `name` is a NUL-terminated UTF-16 string alive for the whole call; `result` is a valid out pointer.
            unsafe {
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_SETTINGCHANGE,
                    0,
                    name.as_ptr() as isize,
                    SMTO_ABORTIFHUNG,
                    5000,
                    &raw mut result,
                );
            }
        }
    }

    #[cfg(not(windows))]
    mod imp {
        pub fn read() -> Option<String> {
            None
        }
        pub fn read_system() -> Option<String> {
            None
        }
        pub fn write(_: &str) -> Result<(), String> {
            Err("The Windows PATH can only be changed on Windows.".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(macos: bool, shell: &str) -> Env {
        Env {
            macos,
            shell: Some(shell.into()),
            installed: vec![],
            home: PathBuf::from("/home/u"),
            zdotdir: None,
            xdg_config: None,
        }
    }

    /// The files a plan writes, given the installed shells and the files that exist (with their content).
    fn planned(e: &Env, installed: &[&str], disk: &[(&str, &str)]) -> Vec<String> {
        let e = Env { installed: installed.iter().map(PathBuf::from).collect(), ..e.clone() };
        let exists = |p: &Path| disk.iter().any(|(f, _)| Path::new(f) == p);
        let read = |p: &Path| disk.iter().find(|(f, _)| Path::new(f) == p).map(|(_, c)| (*c).to_string());
        e.targets(&exists, &read).into_iter().map(|t| t.file.to_string_lossy().to_string()).collect()
    }

    const ALL: [&str; 4] = ["/bin/sh", "/bin/bash", "/usr/bin/zsh", "/usr/bin/fish"];

    #[test]
    fn a_bash_user_gets_only_bashrc_and_a_missing_one_is_created() {
        assert_eq!(planned(&env(false, "/bin/bash"), &["/bin/sh", "/bin/bash"], &[]), ["/home/u/.bashrc"]);
        assert_eq!(planned(&env(false, "/bin/bash"), &ALL, &[]), ["/home/u/.bashrc"], "no zshrc, no fish folder");
    }

    #[test]
    fn another_installed_shell_is_written_only_when_its_file_exists() {
        let disk = [("/home/u/.zshrc", "")];
        assert_eq!(planned(&env(false, "/bin/bash"), &ALL, &disk), ["/home/u/.bashrc", "/home/u/.zshrc"]);
        assert_eq!(planned(&env(false, "/bin/bash"), &["/bin/bash"], &disk), ["/home/u/.bashrc"], "zsh not installed");
        let disk = [("/home/u/.bashrc", "")];
        assert_eq!(planned(&env(false, "/usr/bin/zsh"), &ALL, &disk), ["/home/u/.zshrc", "/home/u/.bashrc"]);
    }

    #[test]
    fn fish_is_written_when_its_config_folder_exists() {
        let disk = [("/home/u/.config/fish", "")];
        assert_eq!(
            planned(&env(false, "/bin/bash"), &ALL, &disk),
            ["/home/u/.bashrc", "/home/u/.config/fish/conf.d/wirecat-desktop.fish"]
        );
        let mut e = env(false, "/usr/bin/fish");
        e.xdg_config = Some("/home/u/xdg".into());
        assert_eq!(planned(&e, &ALL, &[]), ["/home/u/xdg/fish/conf.d/wirecat-desktop.fish"]);
    }

    #[test]
    fn macos_bash_writes_the_login_file() {
        assert_eq!(planned(&env(true, "/bin/bash"), &ALL, &[]), ["/home/u/.bash_profile"]);
        let disk = [("/home/u/.bash_profile", "")];
        assert_eq!(planned(&env(true, "/bin/zsh"), &ALL, &disk), ["/home/u/.zshrc", "/home/u/.bash_profile"]);
    }

    #[test]
    fn a_bash_profile_that_skips_bashrc_gets_the_block_too() {
        let skips = [("/home/u/.bash_profile", "export EDITOR=vim\n# . ~/.bashrc\n")];
        assert_eq!(planned(&env(false, "/bin/bash"), &ALL, &skips), ["/home/u/.bashrc", "/home/u/.bash_profile"]);
        let loads = [("/home/u/.bash_profile", "[ -f ~/.bashrc ] && . ~/.bashrc\n")];
        assert_eq!(planned(&env(false, "/bin/bash"), &ALL, &loads), ["/home/u/.bashrc"]);
        assert_eq!(planned(&env(false, "/usr/bin/zsh"), &["/usr/bin/zsh"], &skips), ["/home/u/.zshrc"], "no bash");
    }

    #[test]
    fn zdotdir_moves_the_zsh_file_for_both_roles() {
        let mut e = env(false, "/usr/bin/zsh");
        e.zdotdir = Some("/home/u/.config/zsh".into());
        assert_eq!(planned(&e, &ALL, &[]), ["/home/u/.config/zsh/.zshrc"]);
        let mut b = env(false, "/bin/bash");
        b.zdotdir = Some("/home/u/.config/zsh".into());
        let disk = [("/home/u/.zshrc", ""), ("/home/u/.config/zsh/.zshrc", "")];
        assert_eq!(planned(&b, &ALL, &disk), ["/home/u/.bashrc", "/home/u/.config/zsh/.zshrc"]);
    }

    #[test]
    fn an_unknown_terminal_shell_still_keeps_the_used_shells_in_step() {
        let disk = [("/home/u/.bashrc", "")];
        assert_eq!(planned(&env(false, "/bin/dash"), &ALL, &disk), ["/home/u/.bashrc"]);
        let report = {
            let e = Env { installed: ALL.iter().map(PathBuf::from).collect(), ..env(false, "/usr/bin/zsh") };
            e.shell_files(&[
                Target { shell: Shell::Zsh, file: "/home/u/.zshrc".into() },
                Target { shell: Shell::Bash, file: "/home/u/.bashrc".into() },
                Target { shell: Shell::Bash, file: "/home/u/.bash_profile".into() },
            ])
        };
        assert_eq!(report.len(), 2);
        assert!(report[0].primary && report[0].program == Some("/usr/bin/zsh".into()));
        assert_eq!(report[1].program, Some(PathBuf::from("/bin/bash")));
        assert_eq!(report[1].files.len(), 2);
    }

    #[test]
    fn a_folder_already_in_the_node_block_is_never_listed_twice() {
        let node = "export PATH=\"/n:$PATH\"";
        let with_node = insert_block("export A=1\n", node);
        assert_eq!(insert_folder(&with_node, node), with_node);
        // A file written by an older app version holds the same folder in both blocks.
        let both = insert_marked(&with_node, TOOLS_START, TOOLS_END, &[node.to_string()]);
        let cleaned = insert_folder(&both, node);
        assert_eq!(cleaned.matches(node).count(), 1);
        assert!(!cleaned.contains(TOOLS_START));
        assert_eq!(insert_block(&both, node).matches(node).count(), 1);
        assert!(has_line(&with_node, node));
    }

    #[test]
    fn dropping_one_folder_keeps_the_others_in_place() {
        let (a, b) = ("export PATH=\"/a:$PATH\"", "export PATH=\"/b:$PATH\"");
        let two = insert_folder(&insert_folder("x\n", a), b);
        let one = drop_folder(&two, b);
        assert_eq!(tools_lines(&one), vec![a.to_string()]);
        assert!(one.starts_with("x\n"));
        assert_eq!(drop_folder(&one, a), "x\n");
    }

    #[test]
    fn remove_lists_every_file_the_app_may_have_written() {
        let files = env(false, "/bin/dash").all_files();
        for f in [".bashrc", ".zshrc", ".config/fish/conf.d/wirecat-desktop.fish", ".bash_profile"] {
            assert!(files.contains(&PathBuf::from("/home/u").join(f)), "{f}");
        }
        assert_eq!(env(true, "/bin/zsh").all_files().len(), 4);
    }

    #[test]
    fn picks_the_file_each_shell_reads() {
        let file = |macos, shell| {
            let e = env(macos, shell);
            e.file(e.shell().0).map(|p| p.to_string_lossy().to_string())
        };
        assert_eq!(file(false, "/bin/bash").as_deref(), Some("/home/u/.bashrc"));
        assert_eq!(file(true, "/bin/bash").as_deref(), Some("/home/u/.bash_profile"));
        assert_eq!(file(true, "/bin/zsh").as_deref(), Some("/home/u/.zshrc"));
        assert_eq!(file(false, "/usr/bin/fish").as_deref(), Some("/home/u/.config/fish/conf.d/wirecat-desktop.fish"));
        assert_eq!(file(false, "/bin/tcsh"), None);
        let mut z = env(false, "/bin/zsh");
        z.zdotdir = Some("/home/u/.config/zsh".into());
        assert_eq!(z.file(Shell::Zsh), Some(PathBuf::from("/home/u/.config/zsh/.zshrc")));
    }

    #[test]
    fn writes_the_line_relative_to_home_and_refuses_odd_folders() {
        let e = env(false, "/bin/zsh");
        let bin = Path::new("/home/u/.local/share/dev.wirecat.desktop/node/v24.22.1/bin");
        assert_eq!(
            e.line(Shell::Zsh, bin),
            ("export PATH=\"$HOME/.local/share/dev.wirecat.desktop/node/v24.22.1/bin:$PATH\"".into(), true)
        );
        assert_eq!(
            e.line(Shell::Fish, bin).0,
            "set -gx PATH \"$HOME/.local/share/dev.wirecat.desktop/node/v24.22.1/bin\" $PATH"
        );
        assert!(!e.line(Shell::Bash, Path::new("/home/u/we$ird/bin")).1);
        assert!(!e.line(Shell::Other, bin).1);
    }

    #[test]
    fn inserts_once_replaces_in_place_and_removes_cleanly() {
        let original = "alias ll='ls -l'\nexport EDITOR=vim";
        let once = insert_block(original, "export PATH=\"/a:$PATH\"");
        let twice = insert_block(&once, "export PATH=\"/b:$PATH\"");
        assert_eq!(twice.matches(START).count(), 1);
        assert!(twice.contains("/b:$PATH") && !twice.contains("/a:$PATH"));
        assert_eq!(remove_block(&twice), "alias ll='ls -l'\nexport EDITOR=vim\n");
        assert_eq!(remove_block(original), original);
        assert_eq!(remove_block(&insert_block("", "x")), "");
    }

    #[test]
    fn several_folders_share_a_tools_block_beside_the_node_block() {
        let (a, b, node) = ("export PATH=\"/a:$PATH\"", "export PATH=\"/b:$PATH\"", "export PATH=\"/n:$PATH\"");
        let original = "export EDITOR=vim\n";
        let with_node = insert_block(original, node);
        let one = insert_folder(&with_node, a);
        assert_eq!(insert_folder(&one, a), one, "the same folder twice changes nothing");
        let two = insert_folder(&one, b);
        assert_eq!(tools_lines(&two), vec![b.to_string(), a.to_string()]);
        let node_again = insert_block(&two, "export PATH=\"/n2:$PATH\"");
        assert_eq!(tools_lines(&node_again).len(), 2, "a Node.js update keeps the tool folders");
        assert_eq!(node_again.matches(START).count(), 1);
        let without_node = remove_block(&node_again);
        assert!(!without_node.contains("/n2:") && without_node.contains(TOOLS_START));
        assert_eq!(remove_marked(&without_node, TOOLS_START, TOOLS_END), original);
    }

    #[test]
    fn writes_every_used_file_once_and_removes_from_all_of_them() {
        let home = std::env::temp_dir().join(format!("wirecat-shells-{}", std::process::id()));
        std::fs::create_dir_all(home.join(".config/fish")).unwrap();
        std::fs::write(home.join(".zshrc"), "export A=1\n").unwrap();
        std::fs::write(home.join(".bash_profile"), "export B=2\n").unwrap();
        let e = Env {
            macos: false,
            shell: Some("/bin/bash".into()),
            installed: ALL.iter().map(PathBuf::from).collect(),
            home: home.clone(),
            zdotdir: None,
            xdg_config: None,
        };
        let bin = home.join(".local/share/dev.wirecat.desktop/node/v24.22.1/bin");
        let tools = home.join(".local/bin");
        for _ in 0..2 {
            write_targets(&e, &bin, insert_block).unwrap();
            write_targets(&e, &tools, insert_folder).unwrap();
            write_targets(&e, &bin, insert_folder).unwrap();
        }
        let fish = home.join(".config/fish/conf.d/wirecat-desktop.fish");
        for file in [home.join(".bashrc"), home.join(".zshrc"), home.join(".bash_profile"), fish.clone()] {
            let c = std::fs::read_to_string(&file).unwrap();
            assert_eq!(c.matches(START).count(), 1, "{}", file.display());
            assert_eq!(c.matches(TOOLS_START).count(), 1, "{}", file.display());
            assert_eq!(c.matches("node/v24.22.1/bin").count(), 1, "{}", file.display());
        }
        assert!(std::fs::read_to_string(&fish).unwrap().contains("set -gx PATH \"$HOME/.local/bin\" $PATH"));
        remove_from(&e, &bin).unwrap();
        for f in [".bashrc", ".zshrc", ".bash_profile"] {
            assert!(!std::fs::read_to_string(home.join(f)).unwrap().contains(START), "{f}");
        }
        assert!(std::fs::read_to_string(home.join(".zshrc")).unwrap().starts_with("export A=1\n\n"));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn edits_a_real_file_through_a_symlink() {
        let dir = std::env::temp_dir().join(format!("wirecat-profile-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let real = dir.join("dotfiles-zshrc");
        std::fs::write(&real, "export A=1\n").unwrap();
        let link = dir.join(".zshrc");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&real, &link).unwrap();
        #[cfg(not(unix))]
        std::fs::copy(&real, &link).unwrap();
        write(&link, &insert_block(&read(&link).unwrap(), "export PATH=\"/n:$PATH\"")).unwrap();
        write(&link, &insert_block(&read(&link).unwrap(), "export PATH=\"/n:$PATH\"")).unwrap();
        let target = if cfg!(unix) { &real } else { &link };
        assert_eq!(std::fs::read_to_string(target).unwrap().matches(START).count(), 1);
        #[cfg(unix)]
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        write(&link, &remove_block(&read(&link).unwrap())).unwrap();
        assert_eq!(std::fs::read_to_string(target).unwrap(), "export A=1\n");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn at_launch_only_the_missing_tool_folders_go_back_on_the_user_path() {
        let node = Path::new(r"C:\Users\u\AppData\Local\dev.wirecat.desktop\node\v26.13.0");
        let npm = Path::new(r"C:\Users\u\AppData\Roaming\npm");
        let var = |n: &str| (n == "APPDATA").then(|| r"C:\Users\u\AppData\Roaming".to_string());
        assert_eq!(windows_missing("", Some(node), Some(npm), var), (Some(node), Some(npm)));
        let both = format!(r"{};%APPDATA%\npm\", node.display());
        assert_eq!(windows_missing(&both, Some(node), Some(npm), var), (None, None));
        assert_eq!(windows_missing(r"C:\Other", None, None, var), (None, None));
        assert_eq!(windows_missing(&node.display().to_string(), None, Some(npm), var), (None, Some(npm)));
    }

    #[test]
    fn windows_path_variables_expand_like_a_new_terminal() {
        let var = |n: &str| (n == "USERPROFILE").then(|| r"C:\Users\u".to_string());
        assert_eq!(windows::expand(r"%USERPROFILE%\bin;C:\x", var), r"C:\Users\u\bin;C:\x");
        assert_eq!(windows::expand(r"%NOPE%\bin;100%;%", var), r"%NOPE%\bin;100%;%");
    }

    #[test]
    fn windows_path_entries_are_added_in_front_once_and_removed() {
        let v = r"C:\Users\u\AppData\Roaming\npm;%USERPROFILE%\bin;";
        let dir = r"C:\Users\u\AppData\Local\dev.wirecat.desktop\node\v24.22.1";
        let added = windows::with(v, dir, true);
        assert!(added.starts_with(dir));
        assert_eq!(windows::with(&added, dir, true), added);
        assert!(windows::contains(&added, &format!("{}\\", dir.to_lowercase())));
        assert_eq!(windows::with(&added, dir, false), r"C:\Users\u\AppData\Roaming\npm;%USERPROFILE%\bin");
    }
}
