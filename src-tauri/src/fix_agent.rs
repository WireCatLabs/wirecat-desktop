use crate::{node, paths, terminal};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_PROMPT: usize = 20_000;
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

fn program(agent: &str) -> Result<&'static str, String> {
    match agent {
        "claude" => Ok("claude"),
        "codex" => Ok("codex"),
        "gemini" => Ok("gemini"),
        other => Err(format!("Unknown agent: {other}")),
    }
}

/// The prompt itself stays in the file; the agent gets only a sentence that names it.
fn args(agent: &str, file: &Path) -> Vec<String> {
    let sentence = format!("Read the file {} and follow the instructions in it.", file.display());
    if agent == "gemini" { vec!["-i".into(), sentence] } else { vec![sentence] }
}

fn validate(agent: &str, prompt: &str) -> Result<&'static str, String> {
    let program = program(agent)?;
    if prompt.trim().is_empty() {
        return Err("The prompt is empty.".into());
    }
    if prompt.chars().count() > MAX_PROMPT {
        return Err(format!("The prompt is longer than {MAX_PROMPT} characters."));
    }
    Ok(program)
}

pub fn run(agent: &str, prompt: &str) -> Result<AgentRun, String> {
    let program = validate(agent, prompt)?;
    let dir = node::app_data().ok_or("No data folder.")?.join("fix-prompts");
    let file = write_prompt(&dir, prompt).map_err(|e| format!("Could not save the prompt: {e}"))?;
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
    Ok(match terminal::open_agent(&bin, &args(agent, &file)) {
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

    #[test]
    fn claude_and_codex_get_one_sentence() {
        for agent in ["claude", "codex"] {
            assert_eq!(
                args(agent, Path::new("/d/1.md")),
                vec!["Read the file /d/1.md and follow the instructions in it."]
            );
        }
    }

    #[test]
    fn gemini_starts_interactive_with_the_sentence() {
        let a = args("gemini", Path::new("/d/1.md"));
        assert_eq!(a[0], "-i");
        assert_eq!(a.len(), 2);
    }

    #[test]
    fn rejects_unknown_agent_and_long_or_empty_prompt() {
        assert!(validate("bash", "hi").is_err());
        assert!(validate("claude", &"a".repeat(MAX_PROMPT + 1)).is_err());
        assert!(validate("claude", "  ").is_err());
        assert_eq!(validate("codex", &"a".repeat(MAX_PROMPT)), Ok("codex"));
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
