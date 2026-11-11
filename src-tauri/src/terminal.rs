use crate::paths;
use std::ffi::OsString;
use std::path::Path;
#[cfg(not(target_os = "macos"))]
use std::process::Command;
#[cfg(target_os = "linux")]
use std::process::Stdio;

/// Setup flows (QR codes, phone codes, browser sign-in) belong to the CLI, so we open them
/// in the user's terminal instead of re-implementing them.
pub fn open(bin: &Path, args: &[String]) -> Result<(), String> {
    open_in_shell(bin, args, false, None).map_err(|e| {
        let run = format!("{} {}", bin.file_name().unwrap_or_default().to_string_lossy(), args.join(" "));
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!("{AUTOMATION} Or run this yourself: {run}")
        } else {
            format!("Could not open a terminal. Run this yourself: {run}")
        }
    })
}

/// Like `open`, but every argument is quoted: they can hold free text (a sentence around a file path). With
/// `prompt_file`, the shell reads that file into one last argument, so the prompt itself is never part of the line.
pub fn open_agent(bin: &Path, args: &[String], prompt_file: Option<&Path>) -> Result<(), String> {
    open_in_shell(bin, args, true, prompt_file).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            AUTOMATION.to_string()
        } else {
            "Could not open a terminal.".to_string()
        }
    })
}

/// True when `open_agent` failed because macOS refused Terminal control.
pub fn is_automation(message: &str) -> bool {
    message == AUTOMATION
}

/// The line runs in the shell the user's own terminal runs, not `sh`, so their rc files apply (an agent's API key
/// exported in `.zshrc`) and the window stays in that shell when the command ends.
fn open_in_shell(bin: &Path, args: &[String], quote_args: bool, prompt_file: Option<&Path>) -> std::io::Result<()> {
    let shell = paths::user_shell();
    let syntax = line_syntax(shell.as_deref());
    let mut line = command_line(syntax, bin, args, quote_args, app_node_path().as_deref());
    if let Some(file) = prompt_file {
        line = format!(
            "{line} {}",
            file_text(syntax, file).ok_or_else(|| std::io::Error::other("cmd cannot read a file into an argument"))?
        );
    }
    launch(shell.as_deref(), &line, syntax)
}

/// The file's text as one argument, trailing newlines dropped. The shell substitutes it after parsing the line, so
/// nothing in the text is expanded. POSIX: <https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_06_03>
/// (no field splitting inside double quotes); `command` skips an alias such as `cat=bat`. fish:
/// <https://fishshell.com/docs/current/cmds/string-collect.html> (one argument, not split at newlines). cmd has no
/// such form, and its 8191-character line could not hold the text anyway.
fn file_text(syntax: Syntax, file: &Path) -> Option<String> {
    let path = file.to_string_lossy();
    match syntax {
        Syntax::Posix => Some(format!("\"$(command cat {})\"", quote(syntax, &path))),
        Syntax::Fish => Some(format!("(string collect < {})", quote(syntax, &path))),
        Syntax::Cmd => None,
    }
}

/// The new terminal reads the user's own PATH, where an older Node may come first; a tool installed with
/// `WireCat`'s Node.js would then start under it and fail. `env` works the same from sh, zsh and fish.
fn app_node_path() -> Option<OsString> {
    (cfg!(unix) && crate::node::in_use().is_some()).then(paths::search_path)
}

/// macOS asks once whether `WireCat` may control Terminal; after a No, every `do script` fails with error -1743.
const AUTOMATION: &str = "macOS did not let WireCat open Terminal. Allow it in System Settings, Privacy & Security, \
Automation, under WireCat.";

/// A fixed line from `tailscale::terminal_line` (Tailscale's own install command) or `package_update` (the update
/// package Rust saved). It asks for the password itself; the app runs no `sudo`. It is written for `sh`, so a fish user's terminal gets it through `/bin/sh`.
pub fn open_line(line: &str) -> Result<(), String> {
    launch(paths::user_shell().as_deref(), line, Syntax::Posix)
        .map_err(|_| format!("Could not open a terminal. Run this yourself: {line}"))
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Syntax {
    Posix,
    Fish,
    Cmd,
}

/// The syntax `shell` reads, for the shells the app knows; `None` for any other (nu, xonsh, elvish).
fn reads(shell: &Path) -> Option<Syntax> {
    match shell.file_name()?.to_str()? {
        "sh" | "bash" | "zsh" | "dash" | "ksh" | "ksh93" | "mksh" | "ash" | "yash" => Some(Syntax::Posix),
        "fish" => Some(Syntax::Fish),
        _ => None,
    }
}

/// Windows has no user shell here and runs cmd; a shell the app does not know gets a POSIX line run by `/bin/sh`.
fn line_syntax(shell: Option<&Path>) -> Syntax {
    match shell {
        None => Syntax::Cmd,
        Some(s) => reads(s).unwrap_or(Syntax::Posix),
    }
}

/// Arguments are validated catalog words and profile names (plain in every shell); only the binary path, the PATH
/// value and an agent's sentence can hold spaces or quotes. fish reads `\\` and `\'` inside single quotes, so its
/// backslashes are doubled; POSIX takes everything literally up to the next quote.
fn quote(syntax: Syntax, s: &str) -> String {
    match syntax {
        Syntax::Posix => format!("'{}'", s.replace('\'', r"'\''")),
        Syntax::Fish => format!("'{}'", s.replace('\\', r"\\").replace('\'', r"\'")),
        Syntax::Cmd => format!("\"{s}\""),
    }
}

fn command_line(
    syntax: Syntax,
    bin: &Path,
    args: &[String],
    quote_args: bool,
    path: Option<&std::ffi::OsStr>,
) -> String {
    let args: Vec<String> = if quote_args { args.iter().map(|a| quote(syntax, a)).collect() } else { args.to_vec() };
    let line = format!("{} {}", quote(syntax, &bin.to_string_lossy()), args.join(" "));
    let line = match path {
        Some(p) if syntax != Syntax::Cmd => format!("env PATH={} {line}", quote(syntax, &p.to_string_lossy())),
        _ => line,
    };
    // cmd drops the first and last quote of a `/k` line that starts with one; the extra pair is what it eats.
    if syntax == Syntax::Cmd && quote_args { format!("\"{line}\"") } else { line }
}

/// The program and arguments a Linux terminal is given: the user's shell runs the line the way a new window starts
/// it, then becomes that shell (`exec`), so the window stays open like any terminal. A line in another syntax runs
/// in `/bin/sh` first.
#[cfg(all(unix, any(target_os = "linux", test)))]
fn shell_argv(shell: &Path, line: &str, syntax: Syntax) -> Vec<String> {
    let name = shell.to_string_lossy();
    if reads(shell) == Some(syntax) {
        let flags = paths::terminal_flags(shell, true);
        // Linux terminals start bash without `-l` (see `terminal_flags`); every other shell as a login shell.
        let again = if flags == "-ic" { String::new() } else { " -l".to_string() };
        return vec![name.to_string(), flags.to_string(), format!("{line}; exec {}{again}", quote(syntax, &name))];
    }
    let again = if reads(shell).is_some() { " -l" } else { "" };
    vec!["/bin/sh".into(), "-c".into(), format!("{line}; exec {}{again}", quote(Syntax::Posix, &name))]
}

/// What Terminal types into its new window. That window already runs the user's shell and stays open; only a line in
/// another syntax is wrapped in `/bin/sh -c`.
#[cfg(all(unix, any(target_os = "macos", test)))]
fn terminal_app_script(shell: Option<&Path>, line: &str, syntax: Syntax) -> String {
    let typed = match shell.and_then(reads) {
        Some(s) if s == syntax => line.to_string(),
        _ => format!("/bin/sh -c {}", quote(Syntax::Posix, line)),
    };
    let escaped = typed.replace('\\', "\\\\").replace('"', "\\\"");
    format!("tell application \"Terminal\" to do script \"{escaped}\"")
}

#[cfg(target_os = "linux")]
fn launch(shell: Option<&Path>, line: &str, syntax: Syntax) -> std::io::Result<()> {
    let argv = shell_argv(shell.unwrap_or(Path::new("/bin/sh")), line, syntax);
    let path = paths::search_path();
    for (term, flag) in terminals(std::env::var("TERMINAL").ok()) {
        let Some(exe) = paths::find(&term) else { continue };
        let spawned = crate::host_open::for_host(&mut Command::new(exe))
            .args(flag)
            .args(&argv)
            .env("PATH", &path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        // A terminal that refuses its arguments (a `$TERMINAL` without `-e`) exits at once with an error; the next
        // one is tried. One that keeps running, or hands the window to its server and exits 0, has opened it.
        if let Ok(mut child) = spawned
            && !exited_with_error(&mut child)
        {
            return Ok(());
        }
    }
    Err(std::io::Error::other("no terminal found"))
}

/// The owner's own choice first: `$TERMINAL`, then `xdg-terminal-exec`, the freedesktop default-terminal launcher
/// that GNOME's own default-terminal setting points to on Ubuntu, then Debian's `x-terminal-emulator`, which is the
/// system's pick, not the owner's; then the terminals people install most.
#[cfg(any(target_os = "linux", test))]
fn terminals(own: Option<String>) -> Vec<(String, Vec<&'static str>)> {
    let known = [
        ("xdg-terminal-exec", vec!["--"]),
        ("x-terminal-emulator", vec!["-e"]),
        ("gnome-terminal", vec!["--"]),
        ("ptyxis", vec!["--"]),
        ("konsole", vec!["-e"]),
        ("xfce4-terminal", vec!["-x"]),
        ("kitty", vec![]),
        ("alacritty", vec!["-e"]),
        ("wezterm", vec!["start", "--"]),
        ("foot", vec![]),
        ("xterm", vec!["-e"]),
    ];
    own.filter(|t| !t.trim().is_empty())
        .map(|t| (t, vec!["-e"]))
        .into_iter()
        .chain(known.into_iter().map(|(t, f)| (t.to_string(), f)))
        .collect()
}

#[cfg(target_os = "linux")]
fn exited_with_error(child: &mut std::process::Child) -> bool {
    for _ in 0..6 {
        match child.try_wait() {
            Ok(Some(status)) => return !status.success(),
            Ok(None) => std::thread::sleep(std::time::Duration::from_millis(50)),
            Err(_) => return false,
        }
    }
    false
}

#[cfg(target_os = "macos")]
fn launch(shell: Option<&Path>, line: &str, syntax: Syntax) -> std::io::Result<()> {
    // Waited for, not only spawned: a refused Automation permission is known only from osascript's exit.
    let out = std::process::Command::new("osascript")
        .args(["-e", &terminal_app_script(shell, line, syntax), "-e", "tell application \"Terminal\" to activate"])
        .output()?;
    if out.status.success() {
        Ok(())
    } else if String::from_utf8_lossy(&out.stderr).contains("-1743") {
        Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied))
    } else {
        Err(std::io::Error::other("osascript failed"))
    }
}

// `start` reads its first quoted argument as the window title, and cmd does not understand Rust's
// backslash-escaped quotes, so the command line is passed raw.
#[cfg(windows)]
fn launch(_shell: Option<&Path>, line: &str, _syntax: Syntax) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    Command::new("cmd")
        .raw_arg(format!("/c start \"WireCat\" cmd /k {line}"))
        .env("PATH", paths::search_path())
        .spawn()
        .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    fn words(list: &[&str]) -> Vec<String> {
        list.iter().map(ToString::to_string).collect()
    }

    const SENTENCE: &str = "Read the file /home/o'neil/a\\b.md and follow it.";

    #[test]
    fn knows_each_shells_syntax() {
        assert_eq!(line_syntax(Some(Path::new("/usr/bin/zsh"))), Syntax::Posix);
        assert_eq!(line_syntax(Some(Path::new("/bin/bash"))), Syntax::Posix);
        assert_eq!(line_syntax(Some(Path::new("/usr/bin/fish"))), Syntax::Fish);
        assert_eq!(line_syntax(Some(Path::new("/usr/bin/nu"))), Syntax::Posix);
        assert_eq!(reads(Path::new("/usr/bin/nu")), None);
        assert_eq!(line_syntax(None), Syntax::Cmd);
    }

    #[test]
    fn quotes_a_sentence_for_posix_and_for_fish() {
        assert_eq!(quote(Syntax::Posix, SENTENCE), r"'Read the file /home/o'\''neil/a\b.md and follow it.'");
        assert_eq!(quote(Syntax::Fish, SENTENCE), r"'Read the file /home/o\'neil/a\\b.md and follow it.'");
    }

    #[test]
    fn leaves_catalog_words_plain_unless_asked() {
        let bin = Path::new("/home/u/My Tools/tg");
        let args = words(&["personal", "session", "start"]);
        assert_eq!(
            command_line(Syntax::Posix, bin, &args, false, None),
            "'/home/u/My Tools/tg' personal session start"
        );
        let path = Some(OsStr::new("/a b:/usr/bin"));
        assert_eq!(
            command_line(Syntax::Fish, bin, &args, false, path),
            "env PATH='/a b:/usr/bin' '/home/u/My Tools/tg' personal session start"
        );
    }

    #[test]
    fn windows_line_is_unchanged() {
        let bin = Path::new(r"C:\Users\u\AppData\Roaming\npm\claude.cmd");
        let args = words(&["Read the file x.md"]);
        assert_eq!(
            command_line(Syntax::Cmd, bin, &args, true, Some(OsStr::new("ignored"))),
            r#"""C:\Users\u\AppData\Roaming\npm\claude.cmd" "Read the file x.md"""#
        );
        assert_eq!(
            command_line(Syntax::Cmd, bin, &words(&["setup"]), false, None),
            format!("\"{}\" setup", bin.display())
        );
    }

    #[cfg(unix)]
    #[test]
    fn zsh_runs_the_line_as_a_login_shell_and_stays_in_zsh() {
        let line = command_line(Syntax::Posix, Path::new("/usr/bin/claude"), &words(&[SENTENCE]), true, None);
        assert_eq!(
            shell_argv(Path::new("/usr/bin/zsh"), &line, Syntax::Posix),
            words(&[
                "/usr/bin/zsh",
                "-lic",
                r"'/usr/bin/claude' 'Read the file /home/o'\''neil/a\b.md and follow it.'; exec '/usr/bin/zsh' -l",
            ])
        );
    }

    #[cfg(unix)]
    #[test]
    fn bash_runs_the_line_as_linux_terminals_start_it() {
        assert_eq!(
            shell_argv(Path::new("/bin/bash"), "'/b/tg' personal setup", Syntax::Posix),
            words(&["/bin/bash", "-ic", "'/b/tg' personal setup; exec '/bin/bash'"])
        );
    }

    #[cfg(unix)]
    #[test]
    fn an_update_install_line_runs_in_the_users_own_shell_and_leaves_it_open() {
        let line = "sudo dnf install '/home/u/My Downloads/wirecat-0.2.0-1.x86_64.rpm'";
        assert_eq!(
            shell_argv(Path::new("/usr/bin/zsh"), line, Syntax::Posix),
            words(&["/usr/bin/zsh", "-lic", &format!("{line}; exec '/usr/bin/zsh' -l")])
        );
        assert_eq!(
            shell_argv(Path::new("/usr/bin/bash"), line, Syntax::Posix),
            words(&["/usr/bin/bash", "-ic", &format!("{line}; exec '/usr/bin/bash'")])
        );
    }

    const HOSTILE: &str = "it's \"$HOME\" $(touch /tmp/wc-pwned) `id` ${PATH} \\n \\' !! !$ %PATH% & | ; > < * ? ~\n\
        second line\twith a tab\r\n«ünïcödé» 日本語 😀 '' '\\''";

    /// The shells themselves decide, not a string compare: the line has to hand `printf` the file's exact text as one
    /// argument, from a folder whose name is hostile too.
    #[cfg(unix)]
    #[test]
    fn a_hostile_prompt_file_reaches_the_program_unchanged() {
        let dir = std::env::temp_dir().join(format!("wc agent 'it's' $(x) {}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("1.md");
        std::fs::write(&file, HOSTILE).unwrap();
        let mut ran = 0;
        for (shell, syntax) in
            [("sh", Syntax::Posix), ("bash", Syntax::Posix), ("zsh", Syntax::Posix), ("fish", Syntax::Fish)]
        {
            let line = command_line(syntax, Path::new("printf"), &words(&["%s|"]), true, None);
            let line = format!("{line} {}", file_text(syntax, &file).unwrap());
            let Ok(out) = std::process::Command::new(shell).args(["-c", &line]).output() else { continue };
            assert_eq!(String::from_utf8_lossy(&out.stdout), format!("{HOSTILE}|"), "{shell}");
            ran += 1;
        }
        std::fs::remove_dir_all(&dir).unwrap();
        assert!(ran >= 1, "no shell ran");
    }

    #[test]
    fn the_prompt_never_enters_the_line_and_cmd_gets_no_file_form() {
        let file = Path::new("/home/o'neil/agent-prompts/1.md");
        assert_eq!(file_text(Syntax::Posix, file).unwrap(), r#""$(command cat '/home/o'\''neil/agent-prompts/1.md')""#);
        assert_eq!(file_text(Syntax::Fish, file).unwrap(), r"(string collect < '/home/o\'neil/agent-prompts/1.md')");
        assert_eq!(file_text(Syntax::Cmd, file), None);
    }

    #[cfg(unix)]
    #[test]
    fn terminal_app_types_only_the_file_path_never_the_prompt() {
        let file = Path::new("/Users/u/Library/Application Support/dev.wirecat.desktop/agent-prompts/1.md");
        let line = format!("'/b/claude' {}", file_text(Syntax::Posix, file).unwrap());
        assert_eq!(
            terminal_app_script(Some(Path::new("/bin/zsh")), &line, Syntax::Posix),
            r#"tell application "Terminal" to do script "'/b/claude' \"$(command cat '/Users/u/Library/Application Support/dev.wirecat.desktop/agent-prompts/1.md')\"""#
        );
    }

    #[cfg(unix)]
    #[test]
    fn fish_gets_a_fish_line() {
        let line = command_line(Syntax::Fish, Path::new("/usr/bin/claude"), &words(&[SENTENCE]), true, None);
        assert_eq!(
            shell_argv(Path::new("/usr/bin/fish"), &line, Syntax::Fish),
            words(&[
                "/usr/bin/fish",
                "-lic",
                r"'/usr/bin/claude' 'Read the file /home/o\'neil/a\\b.md and follow it.'; exec '/usr/bin/fish' -l",
            ])
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_posix_line_for_fish_or_an_unknown_shell_runs_in_sh_first() {
        let line = "curl -fsSL https://tailscale.com/install.sh | sh";
        assert_eq!(
            shell_argv(Path::new("/usr/bin/fish"), line, Syntax::Posix),
            words(&["/bin/sh", "-c", &format!("{line}; exec '/usr/bin/fish' -l")])
        );
        assert_eq!(
            shell_argv(Path::new("/usr/bin/nu"), "'/b/tg' setup", Syntax::Posix),
            words(&["/bin/sh", "-c", "'/b/tg' setup; exec '/usr/bin/nu'"])
        );
    }

    #[test]
    fn the_owners_terminal_comes_before_the_systems_pick() {
        let names = |own: Option<&str>| -> Vec<String> {
            terminals(own.map(String::from)).into_iter().take(3).map(|(t, _)| t).collect()
        };
        assert_eq!(names(Some("kitty")), ["kitty", "xdg-terminal-exec", "x-terminal-emulator"]);
        assert_eq!(names(None), ["xdg-terminal-exec", "x-terminal-emulator", "gnome-terminal"]);
        assert_eq!(names(Some(" ")), ["xdg-terminal-exec", "x-terminal-emulator", "gnome-terminal"]);
        assert_eq!(terminals(None)[0].1, ["--"]);
    }

    #[cfg(unix)]
    #[test]
    fn terminal_app_types_the_line_for_its_shell() {
        let posix = r"'/b/claude' 'it'\''s'";
        assert_eq!(
            terminal_app_script(Some(Path::new("/bin/zsh")), posix, Syntax::Posix),
            r#"tell application "Terminal" to do script "'/b/claude' 'it'\\''s'""#
        );
        assert_eq!(
            terminal_app_script(Some(Path::new("/opt/homebrew/bin/fish")), r"'/b/claude' 'it\'s'", Syntax::Fish),
            r#"tell application "Terminal" to do script "'/b/claude' 'it\\'s'""#
        );
        assert_eq!(
            terminal_app_script(Some(Path::new("/opt/homebrew/bin/nu")), "'/b/tg' setup", Syntax::Posix),
            r#"tell application "Terminal" to do script "/bin/sh -c ''\\''/b/tg'\\'' setup'""#
        );
    }
}
