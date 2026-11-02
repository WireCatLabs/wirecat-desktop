use crate::{catalog, node, paths, storage, terminal};
use std::path::{Path, PathBuf};

/// Agents whose docs name a way to start an interactive session with a first prompt, and the words before it:
/// Claude Code `claude "query"` (code.claude.com/docs/en/cli-reference), Codex `codex [PROMPT]`
/// (developers.openai.com/codex/cli/reference), Gemini CLI `gemini -i "…"` (`--prompt-interactive`,
/// gemini-cli docs/cli/cli-reference.md), `OpenCode` `opencode --prompt "…"` (opencode.ai/docs/cli). Cursor's docs
/// name the program `agent`, which detection does not look for; Hermes and `OpenClaw` are reached through chat apps.
const AGENTS: [(&str, &str, &[&str]); 4] = [
    ("claude", "claude", &[]),
    ("codex", "codex", &[]),
    ("gemini", "gemini", &["-i"]),
    ("opencode", "opencode", &["--prompt"]),
];

const MAX_PROMPT: usize = 16 * 1024;

/// Writes the prompt to a file of the app's own and opens a terminal in the tool's settings folder, running the agent
/// with one fixed sentence that points at that file. The prompt's text never reaches a command line.
pub fn start(agent: &str, tool: &str, prompt: &str) -> Result<(), String> {
    let (_, program, flags) = AGENTS.iter().find(|(id, ..)| *id == agent).ok_or("WireCat cannot start that agent")?;
    let tool = catalog::tool(tool)?;
    if prompt.trim().is_empty() || prompt.len() > MAX_PROMPT || prompt.contains('\0') {
        return Err("The prompt is empty or too long.".into());
    }
    let exe = paths::find(program).ok_or_else(|| format!("{program} is not on this computer's PATH."))?;
    let folder = storage::config_folder(&tool.id)?;
    let dir = if folder.is_dir() { folder } else { paths::home().ok_or("no home folder")? };
    let base = node::app_data().ok_or("no app data folder")?.join("agent-prompts");
    std::fs::create_dir_all(&base).map_err(|e| format!("Could not create {}: {e}", base.display()))?;
    let file = base.join(format!("{}-settings.md", tool.id));
    write_private(&file, prompt)?;
    let mut args: Vec<String> = flags.iter().map(|f| (*f).to_string()).collect();
    args.push(sentence(&file));
    terminal::open_in(&dir, &exe, &args, &base.join(format!("{}-settings.cmd", tool.id)))
}

fn sentence(file: &Path) -> String {
    format!("Read the file {} and do what it asks.", file.display())
}

fn write_private(file: &PathBuf, text: &str) -> Result<(), String> {
    std::fs::write(file, text).map_err(|e| format!("Could not write {}: {e}", file.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(file, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_an_agent_without_a_documented_first_prompt() {
        for agent in ["cursor", "hermes", "openclaw", "sh", ""] {
            assert!(start(agent, "tg", "fix it").is_err(), "{agent}");
        }
    }

    #[test]
    fn refuses_an_empty_or_huge_prompt_before_touching_anything() {
        assert!(start("claude", "tg", "  ").is_err());
        assert!(start("claude", "tg", &"x".repeat(MAX_PROMPT + 1)).is_err());
        assert!(start("claude", "nope", "fix it").is_err());
    }

    #[test]
    fn the_sentence_names_only_the_prompt_file() {
        let s = sentence(Path::new("/home/u/.local/share/dev.wirecat.desktop/agent-prompts/tg-settings.md"));
        assert_eq!(
            s,
            "Read the file /home/u/.local/share/dev.wirecat.desktop/agent-prompts/tg-settings.md and do what it asks."
        );
    }
}
