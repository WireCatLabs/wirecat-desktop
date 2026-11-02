use crate::paths;
use std::path::Path;
use std::process::{Command, Stdio};

/// Setup flows (QR codes, phone codes, browser sign-in) belong to the CLI, so we open them
/// in the user's terminal instead of re-implementing them.
pub fn open(bin: &Path, args: &[String]) -> Result<(), String> {
    let mut line = format!("{} {}", quote(&bin.to_string_lossy()), args.join(" "));
    // The new terminal reads the user's own PATH, where an older Node may come first; a tool installed with
    // WireCat's Node.js would then start under it and fail. `env` works the same from sh, zsh and fish.
    if cfg!(unix) && crate::node::in_use().is_some() {
        line = format!("env PATH={} {line}", quote(&paths::search_path().to_string_lossy()));
    }
    launch(&line).map_err(|e| {
        let run = format!("{} {}", bin.file_name().unwrap_or_default().to_string_lossy(), args.join(" "));
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!("{AUTOMATION} Or run this yourself: {run}")
        } else {
            format!("Could not open a terminal. Run this yourself: {run}")
        }
    })
}

/// macOS asks once whether `WireCat` may control Terminal; after a No, every `do script` fails with error -1743.
const AUTOMATION: &str = "macOS did not let WireCat open Terminal. Allow it in System Settings, Privacy & Security, \
Automation, under WireCat.";

/// A fixed line from `tailscale::terminal_line`: Tailscale's own install command. It asks for the password itself;
/// the app runs no `sudo`.
pub fn open_line(line: &str) -> Result<(), String> {
    launch(line).map_err(|_| format!("Could not open a terminal. Run this yourself: {line}"))
}

/// Runs `program` with `args` in `dir`, every part quoted: the arguments are app-built sentences, not catalog words.
/// On Windows the lines go into `script` (a `.cmd` file) and the terminal runs that file, because two layers of `cmd`
/// re-read quotes and a line with more than one quoted part loses them.
pub fn open_in(dir: &Path, program: &Path, args: &[String], script: &Path) -> Result<(), String> {
    let line = command_in(dir, program, args, script)?;
    launch(&line).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            AUTOMATION.into()
        } else {
            "Could not open a terminal.".into()
        }
    })
}

fn command_in(dir: &Path, program: &Path, args: &[String], script: &Path) -> Result<String, String> {
    let parts = [dir.to_string_lossy(), program.to_string_lossy()];
    let all = parts.iter().map(AsRef::as_ref).chain(args.iter().map(String::as_str));
    if cfg!(windows) {
        let body = windows_script(&parts[0], &parts[1], args)?;
        std::fs::write(script, body).map_err(|e| format!("Could not write {}: {e}", script.display()))?;
        return Ok(quote(&script.to_string_lossy()));
    }
    if all.clone().any(|p| p.contains('\0')) {
        return Err("A path holds a NUL character.".into());
    }
    let run = std::iter::once(parts[1].as_ref()).chain(args.iter().map(String::as_str)).map(quote).collect::<Vec<_>>();
    let env = if crate::node::in_use().is_some() {
        format!("env PATH={} ", quote(&paths::search_path().to_string_lossy()))
    } else {
        String::new()
    };
    let line = format!("cd {} && {env}{}", quote(&parts[0]), run.join(" "));
    Ok(line)
}

/// A `.cmd` file that runs `program` in `dir`. The file is UTF-8 and cmd reads a batch file in the console's code
/// page, so `chcp 65001` comes first: a user folder named in Cyrillic would otherwise break both paths.
fn windows_script(dir: &str, program: &str, args: &[String]) -> Result<String, String> {
    // In a .cmd file `%` expands even inside quotes, and a quote cannot be escaped at all.
    let mut parts = [dir, program].into_iter().chain(args.iter().map(String::as_str));
    if parts.any(|p| p.contains(['"', '%', '\n', '\r', '\0'])) {
        return Err("A path holds a character a Windows command file cannot carry.".into());
    }
    let quoted: Vec<String> = args.iter().map(|a| format!("\"{a}\"")).collect();
    Ok(format!("@echo off\r\nchcp 65001 >nul\r\ncd /d \"{dir}\"\r\n\"{program}\" {}\r\n", quoted.join(" ")))
}

/// Arguments are validated catalog words and profile names; only the binary path can hold spaces.
fn quote(s: &str) -> String {
    if cfg!(windows) { format!("\"{s}\"") } else { format!("'{}'", s.replace('\'', r"'\''")) }
}

#[cfg(target_os = "linux")]
fn launch(line: &str) -> std::io::Result<()> {
    let script = format!("{line}; echo; printf 'Press Enter to close. '; read _");
    let path = paths::search_path();
    let mut candidates: Vec<(String, Vec<&str>)> = Vec::new();
    if let Ok(t) = std::env::var("TERMINAL") {
        candidates.push((t, vec!["-e"]));
    }
    for (term, flag) in [
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
    ] {
        candidates.push((term.to_string(), flag));
    }
    for (term, flag) in candidates {
        let Some(exe) = paths::find(&term) else { continue };
        let spawned = Command::new(exe)
            .args(flag)
            .args(["sh", "-c", &script])
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
fn launch(line: &str) -> std::io::Result<()> {
    let escaped = line.replace('\\', "\\\\").replace('"', "\\\"");
    // Waited for, not only spawned: a refused Automation permission is known only from osascript's exit.
    let out = Command::new("osascript")
        .args([
            "-e",
            &format!("tell application \"Terminal\" to do script \"{escaped}\""),
            "-e",
            "tell application \"Terminal\" to activate",
        ])
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
fn launch(line: &str) -> std::io::Result<()> {
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

    #[test]
    fn a_windows_script_switches_to_utf8_and_quotes_each_part() {
        let args = ["Read the file C:\\x.md and do what it asks.".to_string()];
        let body = windows_script(r"C:\Users\Иван\AppData\Roaming\tg-cli\Config", r"C:\npm\codex.cmd", &args).unwrap();
        assert_eq!(
            body,
            "@echo off\r\nchcp 65001 >nul\r\ncd /d \"C:\\Users\\Иван\\AppData\\Roaming\\tg-cli\\Config\"\r\n\
             \"C:\\npm\\codex.cmd\" \"Read the file C:\\x.md and do what it asks.\"\r\n"
        );
        for bad in ["50%", "a\"b", "a\nb"] {
            assert!(windows_script(r"C:\d", r"C:\p.exe", &[bad.into()]).is_err(), "{bad}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn quotes_every_part_of_an_agent_line_so_a_sentence_stays_one_argument() {
        let line = command_in(
            Path::new("/home/u/.config/tg-cli"),
            Path::new("/usr/bin/claude"),
            &["-i".into(), "Read the file /x/it's; rm -rf ~.md and do what it asks.".into()],
            Path::new("/unused.cmd"),
        )
        .unwrap();
        assert!(line.starts_with("cd '/home/u/.config/tg-cli' && "), "{line}");
        assert!(
            line.ends_with(r"'/usr/bin/claude' '-i' 'Read the file /x/it'\''s; rm -rf ~.md and do what it asks.'"),
            "{line}"
        );
    }
}
