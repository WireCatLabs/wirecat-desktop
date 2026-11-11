use crate::{node, paths, terminal};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) const MAX_PROMPT: usize = 20_000;
const KEEP: usize = 20;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRun {
    pub started: bool,
    pub agent: String,
    pub file: String,
    pub reason: Option<RunFailure>,
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RunFailure {
    Missing,
    Terminal,
    Automation,
}

/// How an agent starts interactive in a terminal with a first prompt: `flags`, then the prompt, or with `file_flag`
/// the flag and the prompt file.
#[derive(Debug, PartialEq, Eq)]
struct Launch {
    program: &'static str,
    flags: &'static [&'static str],
    file_flag: Option<&'static str>,
}

const fn text(program: &'static str, flags: &'static [&'static str]) -> Launch {
    Launch { program, flags, file_flag: None }
}

fn launch(agent: &str) -> Result<Launch, String> {
    Ok(match agent {
        // https://code.claude.com/docs/en/cli-reference: `claude "query"`
        "claude" => text("claude", &[]),
        // https://learn.chatgpt.com/docs/developer-commands?surface=cli: `codex [PROMPT]`
        "codex" => text("codex", &[]),
        // https://geminicli.com/docs/cli/cli-reference/: `gemini -i "…"`
        "gemini" => text("gemini", &["-i"]),
        // https://cursor.com/docs/cli/overview: `agent "…"`. https://cursor.com/install links both `agent` and the
        // legacy `cursor-agent` to one program; `agent` is too common a name to look for on PATH.
        "cursor" => text("cursor-agent", &[]),
        // https://opencode.ai/v1/docs/cli/: `opencode --prompt`. The v2 docs move it to `opencode mini --prompt`;
        // npm's `latest` is still 1.x.
        "opencode" => text("opencode", &["--prompt"]),
        // https://hermes-agent.nousresearch.com/docs/reference/cli-commands: `--query-file` seeds an interactive
        // session on a terminal and takes the text verbatim, on every platform.
        "hermes" => Launch { program: "hermes", flags: &["chat"], file_flag: Some("--query-file") },
        // https://docs.openclaw.ai/cli/tui: `openclaw chat --message "…"`, the local terminal UI.
        "openclaw" => text("openclaw", &["chat", "--message"]),
        other => return Err(format!("Unknown agent: {other}")),
    })
}

/// The arguments before the prompt, and whether the shell should read the prompt file into the last one. On Unix it
/// does (`terminal::open_agent`), so the agent gets the owner's text. Windows has no safe way: npm installs agents as
/// `.cmd` files, and cmd ends an argument at a newline and caps the expanded line at 8191 characters
/// (<https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation>);
/// there the agent gets a sentence naming the file.
fn args(launch: &Launch, file: &Path, unix: bool) -> (Vec<String>, bool) {
    let mut args: Vec<String> = launch.flags.iter().map(ToString::to_string).collect();
    if let Some(flag) = launch.file_flag {
        args.extend([flag.to_string(), file.display().to_string()]);
        return (args, false);
    }
    if !unix {
        args.push(format!("Read the file {} and follow the instructions in it.", file.display()));
    }
    (args, unix)
}

/// The prompt as the agent gets it: a leading `-` would be read as an option.
fn guarded(prompt: &str) -> String {
    if prompt.starts_with('-') { format!(" {prompt}") } else { prompt.to_string() }
}

fn validate(agent: &str, prompt: &str) -> Result<Launch, String> {
    let launch = launch(agent)?;
    if prompt.trim().is_empty() {
        return Err("The prompt is empty.".into());
    }
    if prompt.chars().count() > MAX_PROMPT {
        return Err(format!("The prompt is longer than {MAX_PROMPT} characters."));
    }
    if prompt.contains('\0') {
        return Err("The prompt holds a NUL character.".into());
    }
    Ok(launch)
}

pub fn run(agent: &str, prompt: &str) -> Result<AgentRun, String> {
    let launch = validate(agent, prompt)?;
    let program = launch.program;
    let dir = node::app_data().ok_or("No data folder.")?.join("agent-prompts");
    let file = write_prompt(&dir, &guarded(prompt)).map_err(|e| format!("Could not save the prompt: {e}"))?;
    prune(&dir, KEEP);
    let result = |started, reason, message| AgentRun {
        started,
        agent: agent.to_string(),
        file: paths::tilde(&file.to_string_lossy()),
        reason,
        message,
    };
    let Some(bin) = paths::find(program) else {
        return Ok(result(false, Some(RunFailure::Missing), Some(format!("{program} is not installed."))));
    };
    let (args, reads_file) = args(&launch, &file, cfg!(unix));
    Ok(match terminal::open_agent(&bin, &args, reads_file.then_some(file.as_path())) {
        Ok(()) => result(true, None, None),
        Err(m) => {
            let reason = if terminal::is_automation(&m) { RunFailure::Automation } else { RunFailure::Terminal };
            result(false, Some(reason), Some(m))
        }
    })
}

fn write_prompt(dir: &Path, prompt: &str) -> std::io::Result<PathBuf> {
    use std::io::Write;
    create_private_dir(dir)?;
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis());
    let file = dir.join(format!("{millis}.md"));
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(&file)?.write_all(prompt.as_bytes())?;
    Ok(file)
}

fn create_private_dir(dir: &Path) -> std::io::Result<()> {
    let mut builder = std::fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    std::os::unix::fs::DirBuilderExt::mode(&mut builder, 0o700);
    builder.create(dir)
}

/// Only our own `<millis>.md` files in that folder; names sort by age because the millisecond count only grows.
fn prune(dir: &Path, keep: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut files: Vec<(u128, PathBuf)> = entries
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            let stamp = path.file_name()?.to_str()?.strip_suffix(".md")?.parse().ok()?;
            Some((stamp, path))
        })
        .collect();
    files.sort();
    let surplus = files.len().saturating_sub(keep);
    for (_, path) in files.into_iter().take(surplus) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SENTENCE: &str = "Read the file /d/1.md and follow the instructions in it.";

    fn start(agent: &str, unix: bool) -> (&'static str, Vec<String>, bool) {
        let launch = launch(agent).unwrap();
        let (args, reads_file) = args(&launch, Path::new("/d/1.md"), unix);
        (launch.program, args, reads_file)
    }

    fn words(list: &[&str]) -> Vec<String> {
        list.iter().map(ToString::to_string).collect()
    }

    #[test]
    fn on_unix_each_agent_gets_its_flags_and_then_the_prompt_file_read_by_the_shell() {
        assert_eq!(start("claude", true), ("claude", words(&[]), true));
        assert_eq!(start("codex", true), ("codex", words(&[]), true));
        assert_eq!(start("gemini", true), ("gemini", words(&["-i"]), true));
        assert_eq!(start("cursor", true), ("cursor-agent", words(&[]), true));
        assert_eq!(start("opencode", true), ("opencode", words(&["--prompt"]), true));
        assert_eq!(start("openclaw", true), ("openclaw", words(&["chat", "--message"]), true));
    }

    #[test]
    fn on_windows_the_agent_gets_a_sentence_naming_the_file() {
        assert_eq!(start("claude", false), ("claude", words(&[SENTENCE]), false));
        assert_eq!(start("gemini", false), ("gemini", words(&["-i", SENTENCE]), false));
        assert_eq!(start("openclaw", false), ("openclaw", words(&["chat", "--message", SENTENCE]), false));
    }

    #[test]
    fn hermes_reads_the_prompt_file_itself_everywhere() {
        let expected = ("hermes", words(&["chat", "--query-file", "/d/1.md"]), false);
        assert_eq!(start("hermes", true), expected);
        assert_eq!(start("hermes", false), expected);
    }

    #[test]
    fn a_prompt_that_starts_with_a_dash_is_not_read_as_an_option() {
        assert_eq!(guarded("--help me"), " --help me");
        assert_eq!(guarded("Fix -x"), "Fix -x");
    }

    #[test]
    fn rejects_unknown_agent_and_long_empty_or_nul_prompt() {
        assert!(validate("bash", "hi").is_err());
        assert!(validate("claude", &"a".repeat(MAX_PROMPT + 1)).is_err());
        assert!(validate("claude", "  ").is_err());
        assert!(validate("claude", "a\0b").is_err());
        assert_eq!(validate("codex", &"a".repeat(MAX_PROMPT)).map(|l| l.program), Ok("codex"));
    }

    #[test]
    fn keeps_the_newest_and_leaves_foreign_files() {
        let dir = std::env::temp_dir().join(format!("wc-fix-prune-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for n in 1..=25 {
            std::fs::write(dir.join(format!("{n}.md")), "x").unwrap();
        }
        std::fs::write(dir.join("notes.txt"), "x").unwrap();
        std::fs::write(dir.join("keep.md"), "x").unwrap();
        prune(&dir, 20);
        let mut left: Vec<String> =
            std::fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        left.sort();
        assert_eq!(left.len(), 22);
        assert!(!left.contains(&"5.md".to_string()) && left.contains(&"6.md".to_string()));
        assert!(left.contains(&"notes.txt".to_string()) && left.contains(&"keep.md".to_string()));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
