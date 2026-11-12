//! The agent that runs the background jobs memo keeps on a timer: the mail agent and the digests. The agents are the
//! Agents page's own (`skills::agents`), joined with the ones memo says it can start without a person
//! (`schedule agents`) and with memo's reader list for "signed in". Every agent found is listed; one that cannot run a
//! job says why. memo has no default agent, so the owner's choice is kept here, in the app's data folder, and is never
//! made for him: with several ready and none chosen, a job waits for his answer.
//!
//! A failed run's own files are read only to sort the failure; only the matched line, masked, leaves Rust.

use crate::{digest_schedule, memory_add, node, paths, redact, skills};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;

const SUPPORTED: [&str; 4] = ["schedule", "agents", "list", "--json"];
/// What a memo from before `schedule agents list` can start; only claude reports a run's cost. Both hold the agent to
/// the CLIs' commands (claude) or folders (codex).
const FALLBACK: [(&str, bool); 2] = [("claude", true), ("codex", false)];
const FILE: &str = "background-agent.json";
/// An agent prints its refusal last; the head of a long stderr is never needed for it.
const TAIL: u64 = 64 * 1024;
/// A refusal in the report is the whole answer, one sentence. A longer report is the agent's work, which may quote
/// mail that talks about credits or logins, so it is never matched.
const SHORT_REPORT: u64 = 2048;
const MAX_LINE: usize = 240;

/// Why an agent can or cannot run a job. None is hidden: the owner sees each agent found and the reason.
#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentState {
    Ready,
    NotInstalled,
    /// Its settings folder is there, its program is not on PATH: memo cannot start it.
    ProgramMissing,
    /// memo cannot start it without a person.
    NotSupported,
    /// This memo is too old to say; a newer one may start it.
    NeedsNewerMemo,
    /// memo starts it, but nothing holds it to the CLIs' commands: a job that reads mail could be made to run anything.
    /// The owner decided such an agent runs no background job (NEED-2571 A); `reason` says why, in memo's words.
    Unrestricted,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub state: AgentState,
    /// `None` where memo's reader list does not say.
    pub signed_in: Option<bool>,
    /// False for an agent that does not report what a run costs: the cost limits cannot stop it.
    pub reports_cost: bool,
    /// memo's own sentence for why an unrestricted agent is not held to the CLIs' commands.
    pub reason: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundAgents {
    pub agents: Vec<Agent>,
    pub chosen: Option<String>,
    /// The agent a new job starts: the chosen one when ready, or the only one ready. `None` asks the owner.
    pub effective: Option<String>,
    /// False when this memo cannot list its agents: only Claude Code and Codex, and digests stay on Claude Code.
    pub listed: bool,
}

/// One agent memo can start, as `schedule agents` lists it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Runnable {
    pub id: String,
    pub name: Option<String>,
    pub programs: Vec<String>,
    pub reports_cost: bool,
    pub restricted: bool,
    /// Why it is not restricted, from memo, shown beside the greyed agent.
    pub reason: Option<String>,
    /// memo's own PATH check, by the programs it starts: Cursor's agent is `cursor-agent`, never the `cursor` editor.
    pub installed: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Saved {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    agent: Option<String>,
    /// The agent the mail-triage schedule was last made with here, for a memo whose `schedule list` does not say.
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

/// An agent id becomes an argument: one word of lower-case letters, digits and dashes, never an option.
fn id_word(id: &str) -> bool {
    !id.is_empty()
        && !id.starts_with('-')
        && id.len() <= 40
        && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// memo's `schedule agents`; the one place its shape is read.
fn parse_supported(v: &Value) -> Vec<Runnable> {
    let text = |v: &Value| v.as_str().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
    v["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|i| {
            let id = text(&i["id"]).filter(|id| id_word(id))?;
            let programs = i["programs"].as_array().into_iter().flatten().filter_map(text).collect();
            // cli-core names it `reportsCost`; a `--json` answer may carry it in snake case.
            let reports_cost = i["reports_cost"].as_bool().or_else(|| i["reportsCost"].as_bool()).unwrap_or(false);
            Some(Runnable {
                id,
                name: text(&i["name"]),
                programs,
                reports_cost,
                restricted: i["restricted"].as_bool().unwrap_or(false),
                reason: text(&i["restricted_reason"]).or_else(|| text(&i["restrictedReason"])),
                installed: i["installed"].as_bool(),
            })
        })
        .collect()
}

fn fallback() -> Vec<Runnable> {
    FALLBACK
        .iter()
        .map(|(id, cost)| Runnable {
            id: (*id).into(),
            name: None,
            programs: vec![(*id).into()],
            reports_cost: *cost,
            restricted: true,
            reason: None,
            installed: None,
        })
        .collect()
}

/// What this memo can start, and whether it said so itself; an old memo, or none, gets the two every memo starts.
pub fn supported() -> (Vec<Runnable>, bool) {
    let Ok(Ok(memo)) = digest_schedule::memo() else { return (fallback(), false) };
    let args: Vec<String> = SUPPORTED.iter().map(|w| (*w).to_string()).collect();
    match skills::call(memo, &args, Duration::from_secs(30)) {
        // Every memo starts claude: an answer with none in it is one this parser does not read, not "no agent".
        Ok((out, Some(v))) if out.code == Some(0) => match parse_supported(skills::body(&v)) {
            listed if listed.is_empty() => (fallback(), false),
            listed => (listed, true),
        },
        _ => (fallback(), false),
    }
}

/// An id the owner or the page sent, checked against what this memo starts, and allowed to run a job unattended,
/// before it becomes an argument; with whether its runs report their cost.
pub fn check(id: &str) -> Result<(String, bool), String> {
    let refused = || format!("not an agent for background jobs: {id}");
    if !id_word(id) {
        return Err(refused());
    }
    let found = supported().0.into_iter().find(|r| r.id == id).ok_or_else(refused)?;
    if !found.restricted {
        return Err(format!("{id} runs every command without asking, so it does not run background jobs yet"));
    }
    Ok((found.id, found.reports_cost))
}

/// Whether an agent's runs report their cost: memo refuses the cost caps for one that does not.
pub fn reports_cost(id: &str) -> bool {
    supported().0.iter().find(|r| r.id == id).is_some_and(|r| r.reports_cost)
}

fn file() -> Option<PathBuf> {
    node::app_data().map(|d| d.join(FILE))
}

fn load_from(path: Option<&Path>) -> Saved {
    let saved: Saved = path
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    Saved { agent: saved.agent.filter(|a| id_word(a)), mail_triage: saved.mail_triage.filter(|a| id_word(a)) }
}

fn store_to(path: Option<&Path>, saved: &Saved) -> Result<(), String> {
    let path = path.ok_or("No data folder.")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not save the choice: {e}"))?;
    }
    let text = serde_json::to_string(saved).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| format!("Could not save the choice: {e}"))
}

/// The chosen agent while it is ready, else the only one ready. A chosen agent that went away asks again: another
/// one is never taken in its place.
fn effective_of(chosen: Option<&str>, ready: &[&str]) -> Option<String> {
    match (chosen, ready) {
        (Some(c), _) => ready.contains(&c).then(|| c.to_string()),
        (None, [only]) => Some((*only).to_string()),
        _ => None,
    }
}

/// The reader list names Claude Code `claude-code`; every other agent has the same id there.
fn reader_id(id: &str) -> &str {
    if id == "claude" { "claude-code" } else { id }
}

struct Seen<'a> {
    id: &'a str,
    name: &'a str,
    /// `program`, `folder`, or `None`: as the Agents page says.
    by: Option<&'a str>,
}

fn join(
    registry: &[Seen],
    supported: &[Runnable],
    listed: bool,
    readers: &[memory_add::Reader],
    on_path: impl Fn(&str) -> bool,
    chosen: Option<String>,
) -> BackgroundAgents {
    let known = registry.iter().map(|f| (f.id.to_string(), f.name.to_string(), f.by));
    let extra = supported
        .iter()
        .filter(|r| !registry.iter().any(|f| f.id == r.id))
        .map(|r| (r.id.clone(), r.name.clone().unwrap_or_else(|| r.id.clone()), None));
    let agents: Vec<Agent> = known
        .chain(extra)
        .map(|(id, name, seen)| {
            let runnable = supported.iter().find(|r| r.id == id);
            // memo starts the agent by its own program names, so its answer decides; the Agents page's says only
            // whether the agent's settings are on this computer.
            let program = runnable.map(|r| r.installed.unwrap_or_else(|| r.programs.iter().any(|p| on_path(p))));
            let state = match (program, seen) {
                (Some(true), _) if runnable.is_some_and(|r| !r.restricted) => AgentState::Unrestricted,
                (Some(true), _) => AgentState::Ready,
                (Some(false), Some(_)) => AgentState::ProgramMissing,
                (Some(false), None) => AgentState::NotInstalled,
                (None, _) if !listed => AgentState::NeedsNewerMemo,
                (None, _) => AgentState::NotSupported,
            };
            let signed_in = readers.iter().find(|r| r.id == reader_id(&id)).and_then(|r| r.signed_in);
            Agent {
                id,
                name,
                state,
                signed_in: signed_in.filter(|_| state == AgentState::Ready),
                reports_cost: runnable.is_some_and(|r| r.reports_cost),
                reason: runnable.filter(|r| !r.restricted).and_then(|r| r.reason.clone()),
            }
        })
        .collect();
    let ready: Vec<&str> = agents.iter().filter(|a| a.state == AgentState::Ready).map(|a| a.id.as_str()).collect();
    let effective = effective_of(chosen.as_deref(), &ready);
    BackgroundAgents { agents, chosen, effective, listed }
}

pub fn list() -> BackgroundAgents {
    let registry = skills::agents();
    let found: Vec<Seen> = registry.iter().map(|a| Seen { id: a.id, name: a.name, by: a.found_by }).collect();
    let (supported, listed) = supported();
    let readers = memory_add::readers().unwrap_or_default();
    join(&found, &supported, listed, &readers, |p| paths::find(p).is_some(), load_from(file().as_deref()).agent)
}

/// Whether some agent can run a job now, chosen or not.
pub fn any_ready() -> bool {
    list().agents.iter().any(|a| a.state == AgentState::Ready)
}

/// The agent a job turned on now runs with.
pub fn effective() -> Option<String> {
    list().effective
}

pub fn choose(id: &str) -> Result<BackgroundAgents, String> {
    let (id, _) = check(id)?;
    let path = file();
    let mut saved = load_from(path.as_deref());
    saved.agent = Some(id);
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

/// The first known refusal in the text, newest line first; `agent` is the one the job was started with, if known. A
/// sentence of one agent's own is never pinned on another: Gemini CLI printing "please run /login" is still Gemini.
pub fn classify(text: &str, agent: Option<&str>) -> Option<AgentTrouble> {
    text.lines().rev().find_map(|line| {
        let said = line.to_lowercase().replace('\u{2019}', "'");
        let (_, by, kind) = PATTERNS.iter().find(|(needle, _, _)| said.contains(needle))?;
        let shown: String = redact::text(line.trim()).chars().take(MAX_LINE).collect();
        Some(AgentTrouble { agent: agent.or(*by).map(str::to_string), kind: *kind, line: shown })
    })
}

fn tail(path: &Path, most: u64) -> Option<String> {
    let mut f = std::fs::File::open(path).ok()?;
    let len = f.metadata().ok()?.len();
    f.seek(SeekFrom::Start(len.saturating_sub(most))).ok()?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// A failed run's report (`<stamp>.md`, the agent's answer) and its stderr (`<stamp>.log` beside it), as memo's
/// `schedule list` names the report. Only a file in a `runs` folder is read.
pub fn trouble_of_run(last: &Value, agent: Option<&str>) -> Option<AgentTrouble> {
    let failed = last["exit_code"].as_i64().is_some_and(|c| c != 0) || last["ok"].as_bool() == Some(false);
    if !failed {
        return None;
    }
    let report = PathBuf::from(last["output"].as_str()?);
    let in_runs = report.parent().and_then(Path::file_name).is_some_and(|n| n == "runs");
    if !report.is_absolute() || !in_runs || report.extension().is_none_or(|e| e != "md") {
        return None;
    }
    let errors = tail(&report.with_extension("log"), TAIL);
    let short = std::fs::metadata(&report).is_ok_and(|m| m.len() <= SHORT_REPORT);
    let answer = if short { tail(&report, SHORT_REPORT) } else { None };
    [errors, answer].into_iter().flatten().find_map(|t| classify(&t, agent))
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

    fn found<'a>(id: &'a str, found_by: Option<&'a str>) -> Seen<'a> {
        Seen { id, name: id, by: found_by }
    }

    fn runnable(id: &str, cost: bool) -> Runnable {
        Runnable {
            id: id.into(),
            name: None,
            programs: vec![id.into()],
            reports_cost: cost,
            restricted: id == "claude" || id == "codex",
            reason: None,
            installed: None,
        }
    }

    #[test]
    fn never_picks_one_of_several_for_the_owner() {
        assert_eq!(effective_of(None, &["claude", "codex"]), None);
        assert_eq!(effective_of(None, &["codex"]), Some("codex".into()));
        assert_eq!(effective_of(None, &[]), None);
        assert_eq!(effective_of(Some("claude"), &["claude", "codex"]), Some("claude".into()));
        assert_eq!(effective_of(Some("gemini"), &["codex"]), None, "a chosen agent that went away asks again");
    }

    #[test]
    fn reads_memos_list_of_agents_it_starts() {
        let v = json!({"items": [
            {"id": "claude", "name": "Claude Code", "programs": ["claude"], "reports_cost": true},
            {"id": "kimi", "name": "Kimi CLI", "programs": ["kimi"], "reports_cost": false, "installed": true,
             "restricted": false, "restricted_reason": "approves every command in print mode", "path": "/usr/bin/kimi"},
            {"id": "--all", "programs": []}, {"name": "no id"}
        ]});
        let r = parse_supported(&v);
        assert_eq!(r.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), ["claude", "kimi"]);
        assert!(r[0].reports_cost && !r[1].reports_cost);
        assert_eq!(r[1].programs, ["kimi"]);
        assert_eq!((r[0].installed, r[1].installed), (None, Some(true)));
        assert!(!r[1].restricted && r[1].reason.as_deref() == Some("approves every command in print mode"));
    }

    #[test]
    fn lists_every_agent_found_and_says_why_one_cannot_run() {
        let registry = [
            found("claude", Some("program")),
            found("codex", Some("folder")),
            found("cursor", Some("program")),
            found("gemini", None),
        ];
        let supported =
            [runnable("claude", true), runnable("codex", false), runnable("gemini", false), runnable("grok", false)];
        let readers = [reader("claude-code", true, Some(true)), reader("codex", true, Some(false))];
        let a = join(&registry, &supported, true, &readers, |p| p == "grok" || p == "claude", None);
        let state = |id: &str| a.agents.iter().find(|x| x.id == id).unwrap().state;
        assert_eq!(state("claude"), AgentState::Ready);
        assert_eq!(state("codex"), AgentState::ProgramMissing);
        assert_eq!(state("cursor"), AgentState::NotSupported, "found, but memo cannot start it");
        assert_eq!(state("gemini"), AgentState::NotInstalled);
        assert_eq!(
            state("grok"),
            AgentState::Unrestricted,
            "found by memo's program name, but it approves every command"
        );
        assert_eq!(a.agents.len(), 5);
        assert_eq!(a.effective.as_deref(), Some("claude"), "the only one ready: Grok is found but not offered");
        let both = join(&registry, &supported, true, &readers, |p| p == "codex" || p == "claude", None);
        assert_eq!(both.effective, None, "two ready, none chosen");
        assert_eq!(a.agents[0].signed_in, Some(true));
        assert_eq!(a.agents[1].signed_in, None, "only a ready agent says whether it is signed in");

        let old = join(&registry, &fallback(), false, &[], |p| p == "claude", Some("claude".into()));
        assert_eq!(old.agents.iter().find(|x| x.id == "cursor").unwrap().state, AgentState::NeedsNewerMemo);
        assert_eq!(old.effective.as_deref(), Some("claude"));
        assert!(!old.agents.iter().find(|x| x.id == "codex").unwrap().reports_cost);

        // The `cursor` editor is on PATH, the agent memo starts (`cursor-agent`) is not: memo's answer decides.
        let cursor = Runnable { installed: Some(false), ..runnable("cursor", false) };
        let c = join(&registry, &[cursor], true, &[], |_| true, None);
        assert_eq!(c.agents.iter().find(|x| x.id == "cursor").unwrap().state, AgentState::ProgramMissing);
        let programs = vec!["cursor-agent".into(), "agent".into()];
        let cursor = Runnable { programs, ..runnable("cursor", true) };
        let c = join(&registry, &[cursor], true, &[], |p| p == "cursor", None);
        let state = |c: &BackgroundAgents| c.agents.iter().find(|x| x.id == "cursor").unwrap().state;
        assert_eq!(state(&c), AgentState::ProgramMissing, "memo's programs, never the registry's `cursor`");
        let mut held = runnable("cursor", true);
        held.restricted = false;
        let c = join(&registry, &[held], true, &[], |_| true, None);
        assert_eq!(state(&c), AgentState::Unrestricted, "memo's `restricted` decides, for any agent");
    }

    #[test]
    fn refuses_an_id_that_could_be_an_option() {
        assert!(!id_word("--all"));
        assert!(!id_word("bash -c"));
        assert!(!id_word(""));
        assert!(id_word("gemini"));
    }

    #[test]
    fn keeps_the_choice_and_drops_an_unknown_one() {
        let dir = std::env::temp_dir().join(format!("wc-background-agent-{}", std::process::id()));
        let path = dir.join(FILE);
        store_to(Some(&path), &Saved { agent: Some("codex".into()), mail_triage: Some("claude".into()) }).unwrap();
        assert_eq!(load_from(Some(&path)), Saved { agent: Some("codex".into()), mail_triage: Some("claude".into()) });
        std::fs::write(&path, r#"{"agent":"--all"}"#).unwrap();
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
        let long = runs.join("2.md");
        std::fs::write(&long, format!("{}\nFwd: Your workspace is out of credits.\n", "Invoice due. ".repeat(400)))
            .unwrap();
        assert_eq!(trouble_of_run(&json!({"exit_code": 1, "output": long.to_string_lossy()}), None), None);
        std::fs::write(runs.join("2.log"), "ERROR: You've hit your usage limit. Try again later.").unwrap();
        let t = trouble_of_run(&json!({"exit_code": 1, "output": long.to_string_lossy()}), None).unwrap();
        assert_eq!(
            (t.agent.as_deref(), t.kind),
            (Some("codex"), TroubleKind::Limit),
            "stderr is read whatever its size"
        );
        std::fs::remove_dir_all(runs.parent().unwrap()).unwrap();
    }
}
