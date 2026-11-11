//! The agent that runs the background jobs memo keeps on a timer: Claude Code or Codex, the two `schedule agent`
//! starts. memo has no default of its own, so the owner's choice is kept here, in the app's data folder, and is never
//! made for him: with several agents installed and none chosen, a job waits for his answer.
//!
//! Digests stay on Claude Code: memo's `digest add` starts claude and takes no agent yet.
//!
//! A failed run's own files are read only to sort the failure; only the matched line, masked, leaves Rust.

use crate::{memory_add, node, paths, redact};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// `schedule agent`'s harness, and the id memo's reader list gives the same program.
const AGENTS: [(&str, &str); 2] = [("claude", "claude-code"), ("codex", "codex")];
const FILE: &str = "background-agent.json";
/// An agent prints its refusal last; the head of a long report is never needed for it.
const TAIL: u64 = 64 * 1024;
const MAX_LINE: usize = 240;

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub installed: bool,
    /// `None` where memo could not say: too old for its reader list, or not installed.
    pub signed_in: Option<bool>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundAgents {
    pub agents: Vec<Agent>,
    pub chosen: Option<String>,
    /// The agent a new job starts: the chosen one, or the only one installed. `None` asks the owner.
    pub effective: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Saved {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    agent: Option<String>,
    /// The agent the mail-triage schedule was last made with here: memo's `schedule list` does not say.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mail_triage: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TroubleKind {
    NoCredit,
    Limit,
    SignedOut,
}

/// Why an agent refused a run, sorted from its own words; `line` is that sentence, masked.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentTrouble {
    pub agent: Option<String>,
    pub kind: TroubleKind,
    pub line: String,
}

pub fn check(id: &str) -> Result<&'static str, String> {
    AGENTS.iter().map(|(h, _)| *h).find(|h| *h == id).ok_or_else(|| format!("not an agent for background jobs: {id}"))
}

fn file() -> Option<PathBuf> {
    node::app_data().map(|d| d.join(FILE))
}

fn load_from(path: Option<&Path>) -> Saved {
    let saved: Saved = path
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    Saved {
        agent: saved.agent.filter(|a| check(a).is_ok()),
        mail_triage: saved.mail_triage.filter(|a| check(a).is_ok()),
    }
}

fn store_to(path: Option<&Path>, saved: &Saved) -> Result<(), String> {
    let path = path.ok_or("No data folder.")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not save the choice: {e}"))?;
    }
    let text = serde_json::to_string(saved).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| format!("Could not save the choice: {e}"))
}

pub fn installed(harness: &str) -> bool {
    !paths::find_all(harness).is_empty()
}

pub fn any_installed() -> bool {
    AGENTS.iter().any(|(h, _)| installed(h))
}

/// The chosen agent, or the only one installed; several and none chosen is the owner's question, not a guess.
fn effective_of(chosen: Option<&str>, installed: &[&str]) -> Option<String> {
    match (chosen, installed) {
        (Some(c), _) => Some(c.to_string()),
        (None, [only]) => Some((*only).to_string()),
        _ => None,
    }
}

/// The agent a job turned on now runs with.
pub fn effective() -> Option<String> {
    let have: Vec<&str> = AGENTS.iter().map(|(h, _)| *h).filter(|h| installed(h)).collect();
    effective_of(load_from(file().as_deref()).agent.as_deref(), &have)
}

fn agents_with(
    chosen: Option<String>,
    readers: &[memory_add::Reader],
    on_path: impl Fn(&str) -> bool,
) -> BackgroundAgents {
    let agents: Vec<Agent> = AGENTS
        .iter()
        .map(|(harness, reader)| {
            let found = readers.iter().find(|r| r.id == *reader);
            let installed = found.map_or_else(|| on_path(harness), |r| r.available || on_path(harness));
            Agent {
                id: (*harness).to_string(),
                installed,
                signed_in: found.and_then(|r| r.signed_in).filter(|_| installed),
            }
        })
        .collect();
    let have: Vec<&str> = agents.iter().filter(|a| a.installed).map(|a| a.id.as_str()).collect();
    let effective = effective_of(chosen.as_deref(), &have);
    BackgroundAgents { agents, chosen, effective }
}

/// memo's own reader list says whether each agent is signed in; without memo, PATH alone says installed.
pub fn list() -> BackgroundAgents {
    let readers = memory_add::readers().unwrap_or_default();
    agents_with(load_from(file().as_deref()).agent, &readers, installed)
}

pub fn choose(id: &str) -> Result<BackgroundAgents, String> {
    let id = check(id)?;
    let path = file();
    let mut saved = load_from(path.as_deref());
    saved.agent = Some(id.to_string());
    store_to(path.as_deref(), &saved)?;
    Ok(list())
}

pub fn mail_triage() -> Option<String> {
    load_from(file().as_deref()).mail_triage
}

pub fn set_mail_triage(agent: Option<&str>) -> Result<(), String> {
    let path = file();
    let mut saved = load_from(path.as_deref());
    saved.mail_triage = agent.map(str::to_string);
    store_to(path.as_deref(), &saved)
}

/// Each agent's refusals as its docs word them (code.claude.com/docs/en/errors; openai/codex `protocol/src/error.rs`
/// and `login/src/auth/manager.rs`), lower case. `None` is a sentence both could print.
const PATTERNS: [(&str, Option<&str>, TroubleKind); 21] = [
    ("credit balance is too low", Some("claude"), TroubleKind::NoCredit),
    ("monthly spend limit", Some("claude"), TroubleKind::NoCredit),
    ("individual spend limit", Some("claude"), TroubleKind::NoCredit),
    ("shared budget", Some("claude"), TroubleKind::NoCredit),
    ("you've hit your session limit", Some("claude"), TroubleKind::Limit),
    ("you've hit your weekly limit", Some("claude"), TroubleKind::Limit),
    ("you've hit your opus limit", Some("claude"), TroubleKind::Limit),
    ("you've hit your sonnet limit", Some("claude"), TroubleKind::Limit),
    ("usage limit reached", Some("claude"), TroubleKind::Limit),
    ("please run /login", Some("claude"), TroubleKind::SignedOut),
    ("oauth token revoked", Some("claude"), TroubleKind::SignedOut),
    ("invalid api key", Some("claude"), TroubleKind::SignedOut),
    ("out of credits", Some("codex"), TroubleKind::NoCredit),
    ("spend cap", Some("codex"), TroubleKind::NoCredit),
    ("quota exceeded. check your plan", Some("codex"), TroubleKind::NoCredit),
    ("to use codex with your chatgpt plan", Some("codex"), TroubleKind::NoCredit),
    ("you've hit your usage limit", Some("codex"), TroubleKind::Limit),
    ("please log out and sign in again", Some("codex"), TroubleKind::SignedOut),
    ("unexpected status 401", Some("codex"), TroubleKind::SignedOut),
    ("not logged in", None, TroubleKind::SignedOut),
    ("api error: 401", None, TroubleKind::SignedOut),
];

/// The first known refusal in the text, newest line first; `agent` is the one the job was started with, if known.
pub fn classify(text: &str, agent: Option<&str>) -> Option<AgentTrouble> {
    text.lines().rev().find_map(|line| {
        let said = line.to_lowercase().replace('\u{2019}', "'");
        let (_, by, kind) = PATTERNS.iter().find(|(needle, _, _)| said.contains(needle))?;
        let shown: String = redact::text(line.trim()).chars().take(MAX_LINE).collect();
        Some(AgentTrouble { agent: agent.or(*by).map(str::to_string), kind: *kind, line: shown })
    })
}

fn tail(path: &Path) -> Option<String> {
    let mut f = std::fs::File::open(path).ok()?;
    let len = f.metadata().ok()?.len();
    f.seek(SeekFrom::Start(len.saturating_sub(TAIL))).ok()?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// A failed run's report (`<stamp>.md`, the agent's answer) and its stderr (`<stamp>.log` beside it), as memo's
/// `schedule list` names the report. Only a file in a `runs` folder is read.
pub fn trouble_of_run(last: &Value, agent: Option<&str>) -> Option<AgentTrouble> {
    if last["exit_code"].as_i64().unwrap_or(0) == 0 {
        return None;
    }
    let report = PathBuf::from(last["output"].as_str()?);
    let in_runs = report.parent().and_then(Path::file_name).is_some_and(|n| n == "runs");
    if !report.is_absolute() || !in_runs || report.extension().is_none_or(|e| e != "md") {
        return None;
    }
    let errors = report.with_extension("log");
    [errors, report].iter().filter_map(|p| tail(p)).find_map(|t| classify(&t, agent))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn reader(id: &str, available: bool, signed_in: Option<bool>) -> memory_add::Reader {
        memory_add::Reader {
            id: id.into(),
            available,
            signed_in,
            model: None,
            provider: None,
            leaves_computer: true,
            reads_files: false,
            chosen: false,
            problem: None,
        }
    }

    #[test]
    fn never_picks_one_of_several_for_the_owner() {
        assert_eq!(effective_of(None, &["claude", "codex"]), None);
        assert_eq!(effective_of(None, &["codex"]), Some("codex".into()));
        assert_eq!(effective_of(None, &[]), None);
        assert_eq!(effective_of(Some("claude"), &["claude", "codex"]), Some("claude".into()));
    }

    #[test]
    fn lists_both_agents_from_memos_readers() {
        let readers =
            [reader("claude-code", true, Some(true)), reader("codex", false, None), reader("ollama", true, None)];
        let a = agents_with(None, &readers, |_| false);
        assert_eq!(a.agents.len(), 2);
        assert!(a.agents[0].installed && a.agents[0].signed_in == Some(true));
        assert!(!a.agents[1].installed);
        assert_eq!(a.effective.as_deref(), Some("claude"), "the only one installed");
        let both =
            agents_with(None, &[reader("claude-code", true, Some(true)), reader("codex", true, Some(false))], |_| {
                false
            });
        assert_eq!(both.effective, None);
        let without_memo = agents_with(Some("codex".into()), &[], |h| h == "codex");
        assert!(without_memo.agents[1].installed && without_memo.agents[1].signed_in.is_none());
        assert_eq!(without_memo.effective.as_deref(), Some("codex"));
    }

    #[test]
    fn keeps_the_choice_and_drops_an_unknown_one() {
        let dir = std::env::temp_dir().join(format!("wc-background-agent-{}", std::process::id()));
        let path = dir.join(FILE);
        store_to(Some(&path), &Saved { agent: Some("codex".into()), mail_triage: Some("claude".into()) }).unwrap();
        assert_eq!(load_from(Some(&path)), Saved { agent: Some("codex".into()), mail_triage: Some("claude".into()) });
        std::fs::write(&path, r#"{"agent":"bash"}"#).unwrap();
        assert_eq!(load_from(Some(&path)), Saved::default());
        assert!(check("--all").is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sorts_the_agents_own_refusals() {
        let cases = [
            ("Credit balance is too low", Some("claude"), TroubleKind::NoCredit),
            ("You've hit your session limit · resets 3:45pm", Some("claude"), TroubleKind::Limit),
            ("You\u{2019}ve hit your weekly limit · resets Mon 12:00am", Some("claude"), TroubleKind::Limit),
            ("Not logged in · Please run /login", Some("claude"), TroubleKind::SignedOut),
            ("Please run /login · API Error: 401 OAuth token has expired", Some("claude"), TroubleKind::SignedOut),
            ("ERROR: You've hit your usage limit. Try again at 3:45 PM.", Some("codex"), TroubleKind::Limit),
            ("Quota exceeded. Check your plan and billing details.", Some("codex"), TroubleKind::NoCredit),
            ("Your workspace is out of credits. Add credits to continue.", Some("codex"), TroubleKind::NoCredit),
            (
                "Your access token could not be refreshed. Please log out and sign in again.",
                Some("codex"),
                TroubleKind::SignedOut,
            ),
        ];
        for (text, agent, kind) in cases {
            let t = classify(&format!("some report\n{text}\n"), None).unwrap_or_else(|| panic!("{text}"));
            assert_eq!((t.agent.as_deref(), t.kind), (agent, kind), "{text}");
        }
        assert_eq!(classify("Not logged in", Some("codex")).unwrap().agent.as_deref(), Some("codex"));
        assert_eq!(classify("Not logged in", None).unwrap().agent, None);
        assert_eq!(classify("Invoice from Ana Ruiz is due", None), None);
    }

    #[test]
    fn reads_only_a_failed_runs_own_files() {
        let runs = std::env::temp_dir().join(format!("wc-background-runs-{}", std::process::id())).join("runs");
        std::fs::create_dir_all(&runs).unwrap();
        let report = runs.join("1.md");
        std::fs::write(&report, "Credit balance is too low").unwrap();
        std::fs::write(runs.join("1.log"), "").unwrap();
        let failed = json!({"exit_code": 1, "output": report.to_string_lossy()});
        assert_eq!(trouble_of_run(&failed, Some("claude")).unwrap().kind, TroubleKind::NoCredit);
        assert_eq!(trouble_of_run(&json!({"exit_code": 0, "output": report.to_string_lossy()}), None), None);
        let elsewhere = runs.parent().unwrap().join("1.md");
        std::fs::write(&elsewhere, "Credit balance is too low").unwrap();
        assert_eq!(trouble_of_run(&json!({"exit_code": 1, "output": elsewhere.to_string_lossy()}), None), None);
        std::fs::remove_dir_all(runs.parent().unwrap()).unwrap();
    }
}
