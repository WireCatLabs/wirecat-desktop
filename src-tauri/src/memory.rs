//! The Memory page: what agents and the owner told Memo, through Memo's own `memories`, `facts`, `actions` and
//! `agents` commands. The text is the owner's own data on the owner's own page, so it is not masked (as on the Search
//! page); it never goes into a log or a report. Every call passes `--no-record`: a desktop run is kept when it fails,
//! and a failed correction would keep the owner's text in Memo's run log.

use crate::catalog::{self, Tool};
use crate::skills::failure;
use crate::{paths, redact, run, tools};
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const LIMIT: &str = "500";
const ACTIVITY_LIMIT: &str = "30";
pub const MAX_TEXT: usize = 2000;
const READ: Duration = Duration::from_mins(1);
const WRITE: Duration = Duration::from_secs(30);
const QUIET: [&str; 2] = ["--json", "--no-record"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Memory,
    Fact,
    Action,
}

/// `memory:12`, `fact:3` or `action:5`. Memo names actions by a bare number; the page gives them a prefix so one
/// ref says what it is.
#[derive(Debug, PartialEq, Eq)]
pub struct Ref {
    kind: Kind,
    id: u64,
}

impl Ref {
    pub fn parse(s: &str) -> Result<Ref, String> {
        let bad = || format!("not a memory, fact or action: {s}");
        let (prefix, id) = s.split_once(':').ok_or_else(bad)?;
        let kind = match prefix {
            "memory" => Kind::Memory,
            "fact" => Kind::Fact,
            "action" => Kind::Action,
            _ => return Err(bad()),
        };
        if id.is_empty() || id.len() > 15 || !id.bytes().all(|b| b.is_ascii_digit()) {
            return Err(bad());
        }
        Ok(Ref { kind, id: id.parse().map_err(|_| bad())? })
    }

    /// The word Memo takes: `memory:12`, `fact:3`, or `5` for an action.
    fn memo(&self) -> String {
        match self.kind {
            Kind::Memory => format!("memory:{}", self.id),
            Kind::Fact => format!("fact:{}", self.id),
            Kind::Action => self.id.to_string(),
        }
    }

    fn noun(&self) -> &'static str {
        match self.kind {
            Kind::Memory => "memories",
            Kind::Fact => "facts",
            Kind::Action => "actions",
        }
    }
}

/// A correction is one or two sentences typed in the page; a control character has no place in it.
pub fn validate_text(text: &str) -> Result<&str, String> {
    let t = text.trim();
    if t.is_empty() || t.chars().count() > MAX_TEXT || t.chars().any(char::is_control) {
        return Err(format!("a correction is 1 to {MAX_TEXT} characters on one line"));
    }
    Ok(t)
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Author {
    #[serde(rename = "type")]
    pub kind: String,
    pub name: Option<String>,
}

/// One row of the page: a memory, a fact or an action an agent proposed, in one shape.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    #[serde(rename = "ref")]
    pub reference: String,
    #[serde(rename = "type")]
    pub record: &'static str,
    pub kind: String,
    /// An action has no text of its own: its payload's `text` or `title` when it has one.
    pub text: Option<String>,
    pub status: String,
    pub subject: Option<String>,
    pub subject_name: Option<String>,
    pub subject_is_owner: bool,
    pub author: Option<Author>,
    pub scope: Option<String>,
    pub project: Option<String>,
    pub supersedes: Option<String>,
    /// How many sources it cites: what Forget erases besides the record.
    pub links: usize,
    pub reason: Option<String>,
    pub account: Option<String>,
    pub target: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn author(v: &Value) -> Option<Author> {
    Some(Author { kind: text(v, "type")?, name: text(v, "name") })
}

fn record(v: &Value, record: &'static str) -> Option<Entry> {
    Some(Entry {
        reference: text(v, "ref")?,
        record,
        kind: text(v, "kind")?,
        text: text(v, "text"),
        status: text(v, "status")?,
        subject: text(v, "subject"),
        subject_name: text(v, "subject_name"),
        subject_is_owner: v["subject_is_owner"].as_bool().unwrap_or(false),
        author: author(&v["author"]),
        scope: text(v, "scope"),
        project: text(v, "project"),
        supersedes: text(v, "supersedes"),
        links: v["evidence"].as_array().map_or(0, Vec::len),
        reason: None,
        account: None,
        target: None,
        created_at: text(v, "created_at")?,
        updated_at: text(v, "updated_at"),
    })
}

fn memory(v: &Value) -> Option<Entry> {
    record(v, "memory")
}

fn fact(v: &Value) -> Option<Entry> {
    record(v, "fact")
}

fn action(v: &Value) -> Option<Entry> {
    let account = &v["account"];
    Some(Entry {
        reference: format!("action:{}", text(v, "id")?),
        record: "action",
        kind: text(v, "kind")?,
        text: text(&v["payload"], "text").or_else(|| text(&v["payload"], "title")),
        status: text(v, "status")?,
        subject: None,
        subject_name: None,
        subject_is_owner: false,
        author: author(&v["proposed_by"]),
        scope: None,
        project: None,
        supersedes: None,
        links: 0,
        reason: text(v, "reason"),
        account: text(account, "provider").map(|p| format!("{p}:{}", text(account, "account").unwrap_or_default())),
        target: text(v, "target"),
        created_at: text(v, "created_at")?,
        updated_at: text(v, "decided_at"),
    })
}

/// One tool call by an agent, from `memo agents list`: never its arguments, which Memo does not keep.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub agent: Option<String>,
    pub tool: String,
    pub tier: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub at: String,
}

fn activity(v: &Value) -> Option<Activity> {
    let error = match &v["error"] {
        Value::String(s) => Some(s.clone()),
        Value::Object(o) => o.get("message").and_then(Value::as_str).map(str::to_string),
        _ => None,
    };
    Some(Activity {
        id: text(v, "id")?,
        agent: text(&v["actor"], "name"),
        tool: text(v, "tool")?,
        tier: text(v, "tier"),
        status: text(v, "status")?,
        error: error.map(|e| redact::text(&e)),
        at: text(v, "started_at")?,
    })
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Read {
    Missing,
    /// The installed Memo lacks a command the page needs; the page offers its update instead.
    #[serde(rename_all = "camelCase")]
    Old {
        version: Option<String>,
        need: String,
    },
    #[serde(rename_all = "camelCase")]
    Ready {
        entries: Vec<Entry>,
        /// A list reached its limit: older entries exist that the page does not show.
        more: bool,
        /// `None` when only the activity log could not be read; the entries still show.
        activity: Option<Vec<Activity>>,
        activity_error: Option<String>,
    },
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Source {
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub kind: String,
    pub title: Option<String>,
    pub sender: Option<String>,
    pub at: Option<String>,
    pub excerpt: Option<String>,
    pub tool: Option<String>,
    /// Deleted from the store since; the record still cites it.
    pub missing: bool,
}

fn source(v: &Value) -> Option<Source> {
    Some(Source {
        reference: text(v, "ref"),
        kind: text(v, "kind")?,
        title: text(v, "title"),
        sender: text(v, "sender"),
        at: text(v, "at"),
        excerpt: text(v, "excerpt"),
        tool: text(v, "tool"),
        missing: v["missing"].as_bool().unwrap_or(false),
    })
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Forgot {
    #[serde(rename = "ref")]
    pub reference: String,
    pub links: u64,
}

/// One Memo command: its JSON on success, Memo's own reason otherwise.
type Call<'a> = dyn Fn(&[String]) -> Result<Value, String> + Sync + 'a;

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn body(v: &Value) -> &Value {
    v.get("item").unwrap_or(v)
}

fn call_at(bin: &Path, args: &[String], timeout: Duration) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(bin, &refs, Some(&paths::search_path()), timeout).map_err(|e| e.to_string())?;
    let json = out.json();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

fn too_old(version: Option<&str>, need: &str) -> bool {
    let Ok(need) = semver::Version::parse(need) else { return false };
    version.and_then(|v| semver::Version::parse(v).ok()).is_none_or(|v| v < need)
}

pub fn read() -> Result<Read, String> {
    let tool = memo()?;
    let need = tool.memory.as_ref().ok_or("Memo has no memory commands in the catalog")?.min_version.clone();
    let state = tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(Read::Missing) };
    if too_old(first.version.as_deref(), &need) {
        return Ok(Read::Old { version: first.version.clone(), need });
    }
    let bin = paths::find(&tool.bin).ok_or("Memo is not installed")?;
    read_with(&|args: &[String]| call_at(&bin, args, READ))
}

fn list(call: &Call, noun: &str, parse: fn(&Value) -> Option<Entry>) -> Result<(Vec<Entry>, bool), String> {
    let v = call(&words(&[noun, "list", "--limit", LIMIT]))?;
    let items = v["items"].as_array().map(|a| a.iter().filter_map(parse).collect()).unwrap_or_default();
    Ok((items, v["page"]["has_more"].as_bool().unwrap_or(false)))
}

/// The four lists at once: each is its own Node.js start, so one after another would take four times as long.
fn read_with(call: &Call) -> Result<Read, String> {
    let (memories, facts, actions, agents) = std::thread::scope(|s| {
        let m = s.spawn(|| list(call, "memories", memory));
        let f = s.spawn(|| list(call, "facts", fact));
        let a = s.spawn(|| list(call, "actions", action));
        let g = s.spawn(|| call(&words(&["agents", "list", "--limit", ACTIVITY_LIMIT])));
        let stopped = |_| Err("a read stopped".to_string());
        (
            m.join().unwrap_or_else(stopped),
            f.join().unwrap_or_else(stopped),
            a.join().unwrap_or_else(stopped),
            g.join().unwrap_or_else(|_| Err("a read stopped".to_string())),
        )
    });
    let (mut entries, mut more) = memories?;
    for (items, has_more) in [facts?, actions?] {
        entries.extend(items);
        more |= has_more;
    }
    // ISO 8601 in UTC, so the text order is the time order.
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let (activity, activity_error) = match agents {
        Ok(v) => {
            (Some(v["items"].as_array().map(|a| a.iter().filter_map(activity).collect()).unwrap_or_default()), None)
        }
        Err(e) => (None, Some(e)),
    };
    Ok(Read::Ready { entries, more, activity, activity_error })
}

fn with_memo<T>(f: impl FnOnce(&Call) -> Result<T, String>) -> Result<T, String> {
    let tool = memo()?;
    let bin = paths::find(&tool.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args, WRITE))
}

fn parse_entry(r: &Ref, v: &Value) -> Result<Entry, String> {
    let item = body(v);
    let parsed = match r.kind {
        Kind::Memory => memory(item),
        Kind::Fact => fact(item),
        // `actions confirm` answers the action and the task it became.
        Kind::Action => action(item.get("proposal").unwrap_or(item)),
    };
    parsed.ok_or_else(|| "Memo's answer did not describe the record".into())
}

fn sources_with(call: &Call, r: &Ref) -> Result<Vec<Source>, String> {
    if r.kind == Kind::Action {
        return Ok(Vec::new());
    }
    let v = call(&words(&[r.noun(), "show", &r.memo(), "--sources"]))?;
    Ok(body(&v)["sources"].as_array().map(|a| a.iter().filter_map(source).collect()).unwrap_or_default())
}

pub fn sources(reference: &str) -> Result<Vec<Source>, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| sources_with(call, &r))
}

fn confirm_with(call: &Call, r: &Ref) -> Result<Entry, String> {
    parse_entry(r, &call(&words(&[r.noun(), "confirm", &r.memo()]))?)
}

/// Approving an action makes it a task in the account that would act; Memo sends nothing.
pub fn confirm(reference: &str) -> Result<Entry, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| confirm_with(call, &r))
}

/// Memo has one word per record for "this does not hold": a memory goes stale, a proposed fact is rejected, an
/// accepted decision is reversed, an action is rejected. Any other fact can only be forgotten.
fn discard_with(call: &Call, r: &Ref) -> Result<Entry, String> {
    let verb = match r.kind {
        Kind::Memory => "invalidate",
        Kind::Action => "reject",
        Kind::Fact => {
            let shown = call(&words(&["facts", "show", &r.memo()]))?;
            let f = fact(body(&shown)).ok_or("Memo's answer did not describe the fact")?;
            match (f.status.as_str(), f.kind.as_str()) {
                ("proposed", _) => "reject",
                ("accepted", "decision") => "reverse",
                _ => return Err("Only a proposed fact or an accepted decision can be discarded.".into()),
            }
        }
    };
    parse_entry(r, &call(&words(&[r.noun(), verb, &r.memo()]))?)
}

pub fn discard(reference: &str) -> Result<Entry, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| discard_with(call, &r))
}

/// A word Memo gave back goes into a command line again, so it must not read as an option.
fn plain(word: &str) -> Option<&str> {
    (!word.is_empty() && !word.starts_with('-') && !word.chars().any(char::is_whitespace)).then_some(word)
}

/// The owner's version, written as the owner's with `--supersedes`: Memo marks the agent's one superseded. Memo needs
/// the kind, the scope and evidence for a new record, so they come from the old one; one whose sources are all gone
/// cites the old record itself. The text goes last, after `--`, so a text that starts with `-` is never an option.
fn correct_args(r: &Ref, old: &Value, text: &str) -> Result<Vec<String>, String> {
    let item = body(old);
    let field = |k: &str| text_field(item, k);
    let mut args: Vec<String> = vec![r.noun().into(), "add".into()];
    match r.kind {
        Kind::Memory => {
            let kind = field("kind").ok_or("Memo did not say the memory's kind")?;
            let scope = field("scope").ok_or("Memo did not say the memory's scope")?;
            args.extend(["--kind".into(), kind, "--scope".into(), scope]);
        }
        Kind::Fact => {
            if !matches!(field("status").as_deref(), Some("proposed" | "accepted")) {
                return Err("Memo corrects only a proposed or accepted fact; forget this one instead.".into());
            }
            let kind = field("kind").ok_or("Memo did not say the fact's kind")?;
            args.extend(["--kind".into(), kind]);
            for (key, option) in [("scope", "--scope"), ("project", "--project")] {
                if let Some(v) = field(key) {
                    args.extend([option.into(), v]);
                }
            }
        }
        Kind::Action => return Err("An action cannot be corrected; discard it instead.".into()),
    }
    if let Some(subject) = field("subject") {
        args.extend(["--subject".into(), subject]);
    }
    args.extend(["--supersedes".into(), r.memo()]);
    args.extend(QUIET.iter().map(|s| (*s).to_string()));
    let mut evidence: Vec<String> = item["evidence"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).filter_map(plain).map(str::to_string).collect())
        .unwrap_or_default();
    if evidence.is_empty() {
        evidence.push(r.memo());
    }
    args.push("--evidence".into());
    args.extend(evidence);
    args.extend(["--".into(), validate_text(text)?.to_string()]);
    Ok(args)
}

fn text_field(v: &Value, key: &str) -> Option<String> {
    text(v, key).filter(|s| plain(s).is_some())
}

fn correct_with(call: &Call, r: &Ref, text: &str) -> Result<Entry, String> {
    validate_text(text)?;
    if r.kind == Kind::Action {
        return Err("An action cannot be corrected; discard it instead.".into());
    }
    let old = call(&words(&[r.noun(), "show", &r.memo()]))?;
    let added = call(&correct_args(r, &old, text)?)?;
    let item = body(&added);
    match r.kind {
        Kind::Fact => fact(item),
        _ => memory(item),
    }
    .ok_or_else(|| "Memo's answer did not describe the correction".into())
}

pub fn correct(reference: &str, text: &str) -> Result<Entry, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| correct_with(call, &r, text))
}

/// Erases the record, its links to sources and its search entry, through Memo's own `remove`. Actions have none.
fn forget_with(call: &Call, r: &Ref) -> Result<Forgot, String> {
    if r.kind == Kind::Action {
        return Err("An action cannot be forgotten; discard it instead.".into());
    }
    let v = call(&words(&[r.noun(), "remove", &r.memo()]))?;
    let item = body(&v);
    if item["removed"].as_bool() != Some(true) {
        return Err("Memo did not say the record was erased".into());
    }
    Ok(Forgot { reference: r.memo(), links: item["links"].as_u64().unwrap_or(0) })
}

pub fn forget(reference: &str) -> Result<Forgot, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| forget_with(call, &r))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    /// A stand-in for Memo: answers by the first two words, and remembers every command line it was given.
    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        answer: Box<Call<'static>>,
    }

    impl Fake {
        fn new(answer: impl Fn(&[String]) -> Result<Value, String> + Sync + 'static) -> Fake {
            Fake { seen: Mutex::new(Vec::new()), answer: Box::new(answer) }
        }
        fn call(&self, args: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(args.to_vec());
            (self.answer)(args)
        }
        fn seen(&self) -> Vec<Vec<String>> {
            self.seen.lock().unwrap().clone()
        }
    }

    // Captured from memo 0.128.0 against a throwaway store.
    fn agent_memory() -> Value {
        json!({"ref":"memory:3","id":"3","kind":"summary","text":"Ana moves to Valencia","subject":"person:7",
            "subject_name":"Ana Ruiz","subject_is_owner":false,"author":{"type":"bot","id":"3","name":"claude-code"},
            "model":null,"confidence":null,"status":"proposed","scope":"personal","supersedes":null,
            "evidence":["document:1","document:2"],"last_verified_at":null,"created_at":"2026-10-31T20:55:43.713Z",
            "updated_at":"2026-10-31T20:55:43.713Z"})
    }

    fn decision(status: &str) -> Value {
        json!({"ref":"fact:1","id":"1","kind":"decision","text":"Launch moves to 2 March","status":status,
            "project":"HRB","subject":null,"subject_name":null,"subject_is_owner":false,"occurred_at":null,
            "supersedes":null,"author":{"type":"bot","id":"4","name":"hermes"},"model":null,"scope":"work",
            "origin":"agent","evidence":["document:2"],"created_at":"2026-10-31T20:55:43.937Z",
            "updated_at":"2026-10-31T20:55:43.937Z","confirmed_by":null})
    }

    fn proposal(status: &str) -> Value {
        json!({"id":"1","kind":"create_task","account":{"provider":"telegram","account":"1"},"target":"chat:telegram/1/77",
            "payload":{"title":"Send Kai the pricing table"},"reason":"Kai asked twice","status":status,
            "proposed_by":{"type":"bot","id":"4","name":"hermes"},"decided_by":null,"decided_at":null,
            "executed_at":null,"result":null,"error":null,"verdict":null,"created_at":"2026-10-31T20:56:09.193Z"})
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn takes_only_plain_refs_of_the_three_kinds() {
        assert_eq!(Ref::parse("memory:12").unwrap().memo(), "memory:12");
        assert_eq!(Ref::parse("fact:3").unwrap().memo(), "fact:3");
        assert_eq!(Ref::parse("action:5").unwrap().memo(), "5");
        for bad in [
            "memory:",
            "memory:-1",
            "memory:1 ",
            "note:1",
            "memory:1;x",
            "--json",
            "fact:1e3",
            "action:9999999999999999",
        ] {
            assert!(Ref::parse(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_correction_is_one_line_of_bounded_text() {
        assert_eq!(validate_text("  Kai prefers mornings ").unwrap(), "Kai prefers mornings");
        assert!(validate_text("   ").is_err());
        assert!(validate_text("two\nlines").is_err());
        assert!(validate_text(&"a".repeat(MAX_TEXT + 1)).is_err());
        assert!(validate_text(&"я".repeat(MAX_TEXT)).is_ok());
    }

    #[test]
    fn reads_memories_facts_and_actions_into_one_newest_first_list() {
        let fake = Fake::new(|a| {
            Ok(match a[0].as_str() {
                "memories" => json!({"items":[agent_memory()],"page":{"has_more":false}}),
                "facts" => json!({"items":[decision("proposed")],"page":{"has_more":true}}),
                "actions" => json!({"items":[proposal("proposed")],"page":{"has_more":false}}),
                _ => {
                    json!({"items":[{"id":"1","actor":{"type":"bot","id":"5","name":"claude-code"},"tool":"memories_list",
                    "tier":"read","target":null,"status":"ok","error":null,"started_at":"2026-10-31T20:57:31.459Z",
                    "finished_at":"2026-10-31T20:57:31.484Z"}]})
                }
            })
        });
        let Read::Ready { entries, more, activity, activity_error } = read_with(&|a: &[String]| fake.call(a)).unwrap()
        else {
            panic!("not ready")
        };
        assert!(more);
        assert_eq!(activity_error, None);
        assert_eq!(
            entries.iter().map(|e| e.reference.as_str()).collect::<Vec<_>>(),
            ["action:1", "fact:1", "memory:3"]
        );
        let m = &entries[2];
        assert_eq!(m.subject_name.as_deref(), Some("Ana Ruiz"));
        assert_eq!(m.author, Some(Author { kind: "bot".into(), name: Some("claude-code".into()) }));
        assert_eq!(m.links, 2);
        let a = &entries[0];
        assert_eq!(a.text.as_deref(), Some("Send Kai the pricing table"));
        assert_eq!(a.account.as_deref(), Some("telegram:1"));
        assert_eq!(a.reason.as_deref(), Some("Kai asked twice"));
        assert_eq!(activity.unwrap()[0].agent.as_deref(), Some("claude-code"));
        for args in fake.seen() {
            assert!(args.ends_with(&strs(&["--json", "--no-record"])), "{args:?}");
        }
    }

    #[test]
    fn a_failed_activity_log_still_shows_the_entries_but_a_failed_list_does_not() {
        let fake = Fake::new(|a| match a[0].as_str() {
            "agents" => Err("unknown command 'agents'".into()),
            _ => Ok(json!({"items":[]})),
        });
        let read = read_with(&|a: &[String]| fake.call(a)).unwrap();
        assert!(matches!(read, Read::Ready { activity: None, activity_error: Some(_), .. }));
        let busy = Fake::new(|a| match a[0].as_str() {
            "facts" => Err("the store is busy".into()),
            _ => Ok(json!({"items":[]})),
        });
        assert_eq!(read_with(&|a: &[String]| busy.call(a)), Err("the store is busy".into()));
    }

    #[test]
    fn approving_an_action_reads_the_proposal_out_of_the_answer() {
        let fake = Fake::new(|_| Ok(json!({"item":{"proposal":proposal("approved"),"task":{"id":"5bc8"}}})));
        let e = confirm_with(&|a: &[String]| fake.call(a), &Ref::parse("action:1").unwrap()).unwrap();
        assert_eq!(e.status, "approved");
        assert_eq!(fake.seen()[0], strs(&["actions", "confirm", "1", "--json", "--no-record"]));
    }

    #[test]
    fn discard_picks_memos_word_for_each_record() {
        let run = |reference: &str, status: &'static str| {
            let fake = Fake::new(move |a| {
                Ok(
                    json!({"item": if a[0] == "memories" { agent_memory() } else if a[0] == "facts" { decision(status) } else { proposal("rejected") }}),
                )
            });
            let out = discard_with(&|a: &[String]| fake.call(a), &Ref::parse(reference).unwrap());
            (out, fake.seen().into_iter().map(|a| a[1].clone()).collect::<Vec<_>>())
        };
        assert_eq!(run("memory:3", "").1, ["invalidate"]);
        assert_eq!(run("action:1", "").1, ["reject"]);
        assert_eq!(run("fact:1", "proposed").1, ["show", "reject"]);
        assert_eq!(run("fact:1", "accepted").1, ["show", "reverse"]);
        let (out, seen) = run("fact:1", "superseded");
        assert!(out.is_err());
        assert_eq!(seen, ["show"]);
    }

    #[test]
    fn a_correction_keeps_the_old_records_kind_scope_subject_and_sources() {
        let r = Ref::parse("memory:3").unwrap();
        let args = correct_args(&r, &json!({"item": agent_memory()}), "-Ana moved in November").unwrap();
        assert_eq!(
            args,
            strs(&[
                "memories",
                "add",
                "--kind",
                "summary",
                "--scope",
                "personal",
                "--subject",
                "person:7",
                "--supersedes",
                "memory:3",
                "--json",
                "--no-record",
                "--evidence",
                "document:1",
                "document:2",
                "--",
                "-Ana moved in November",
            ])
        );
    }

    #[test]
    fn a_correction_without_sources_cites_the_record_it_replaces() {
        let mut old = agent_memory();
        old["evidence"] = json!([]);
        let args = correct_args(&Ref::parse("memory:3").unwrap(), &old, "x").unwrap();
        let at = args.iter().position(|a| a == "--evidence").unwrap();
        assert_eq!(args[at + 1], "memory:3");
    }

    #[test]
    fn a_proposed_or_accepted_fact_is_corrected_with_its_own_kind() {
        let r = Ref::parse("fact:1").unwrap();
        let args = correct_args(&r, &decision("accepted"), "Launch moves to April").unwrap();
        assert_eq!(&args[..8], strs(&["facts", "add", "--kind", "decision", "--scope", "work", "--project", "HRB"]));
        let mut promise = decision("proposed");
        promise["kind"] = json!("promise");
        assert_eq!(&correct_args(&r, &promise, "x").unwrap()[..4], strs(&["facts", "add", "--kind", "promise"]));
        assert!(correct_args(&r, &decision("superseded"), "x").is_err());
    }

    #[test]
    fn forget_reports_how_many_links_went_and_refuses_actions() {
        let fake = Fake::new(|_| Ok(json!({"item":{"ref":"memory:3","removed":true,"links":2}})));
        let call = |a: &[String]| fake.call(a);
        assert_eq!(forget_with(&call, &Ref::parse("memory:3").unwrap()).unwrap().links, 2);
        assert_eq!(fake.seen()[0], strs(&["memories", "remove", "memory:3", "--json", "--no-record"]));
        assert!(forget_with(&call, &Ref::parse("action:1").unwrap()).is_err());
    }

    #[test]
    fn a_missing_source_stays_listed() {
        let fake = Fake::new(|_| {
            Ok(json!({"item":{"sources":[{"ref":"document:1","kind":"document","title":"Ana","sender":null,
                "at":"2026-10-31T20:55:39.452Z","excerpt":null,"tool":"obsidian","missing":true}]}}))
        });
        let s = sources_with(&|a: &[String]| fake.call(a), &Ref::parse("memory:5").unwrap()).unwrap();
        assert!(s[0].missing);
        assert_eq!(s[0].excerpt, None);
        assert_eq!(fake.seen()[0], strs(&["memories", "show", "memory:5", "--sources", "--json", "--no-record"]));
    }

    #[test]
    fn the_interface_reads_camel_case_names_and_a_kind_tag() {
        let read = Read::Ready {
            entries: vec![memory(&agent_memory()).unwrap()],
            more: false,
            activity: None,
            activity_error: None,
        };
        let v = serde_json::to_value(read).unwrap();
        assert_eq!(v["kind"], "ready");
        assert!(v.get("activityError").is_some());
        let e = &v["entries"][0];
        for key in ["ref", "type", "subjectName", "subjectIsOwner", "createdAt", "updatedAt", "links"] {
            assert!(e.get(key).is_some(), "{key}");
        }
        assert_eq!(e["author"]["type"], "bot");
        assert_eq!(serde_json::to_value(Read::Old { version: None, need: "0.128.0".into() }).unwrap()["kind"], "old");
    }

    #[test]
    fn a_memo_before_the_minimum_or_one_that_cannot_say_is_too_old() {
        assert!(too_old(Some("0.127.0"), "0.128.0"));
        assert!(too_old(None, "0.128.0"));
        assert!(!too_old(Some("0.128.0"), "0.128.0"));
        assert!(!too_old(Some("0.130.2"), "0.128.0"));
    }

    /// Against a real memo with a throwaway store: `MEMO_BIN=<memo> cargo test memory -- --ignored`. It writes to that
    /// store, so never point it at the owner's.
    #[test]
    #[ignore = "needs MEMO_BIN, a memo 0.130.0+ with a throwaway store"]
    fn reads_and_writes_through_a_real_memo() {
        let bin = std::path::PathBuf::from(std::env::var("MEMO_BIN").expect("MEMO_BIN"));
        let call = |a: &[String]| call_at(&bin, a, READ);
        let raw =
            |noun: &str| call(&words(&[noun, "list", "--limit", LIMIT])).unwrap()["items"].as_array().unwrap().len();
        let Read::Ready { entries, activity, .. } = read_with(&call).unwrap() else { panic!("not ready") };
        assert_eq!(entries.len(), raw("memories") + raw("facts") + raw("actions"), "an item did not parse");
        assert!(activity.is_some());

        let added = call(&strs(&[
            "memories",
            "add",
            "--kind",
            "summary",
            "--scope",
            "work",
            "--evidence",
            "memory:2",
            "--json",
            "--no-record",
            "--",
            "Probe: Kai is in Lisbon",
        ]))
        .unwrap();
        let r = Ref::parse(body(&added)["ref"].as_str().unwrap()).unwrap();
        assert!(!sources_with(&call, &r).unwrap().is_empty());
        assert_eq!(discard_with(&call, &r).unwrap().status, "stale");
        let fixed = correct_with(&call, &r, "-Probe: Kai is in Porto").unwrap();
        assert_eq!((fixed.status.as_str(), fixed.supersedes.as_deref()), ("confirmed", Some(r.memo().as_str())));
        assert_eq!(fixed.text.as_deref(), Some("-Probe: Kai is in Porto"));
        let old = call(&words(&["memories", "show", &r.memo()])).unwrap();
        assert_eq!(body(&old)["status"], "superseded");
        let fixed_ref = Ref::parse(&fixed.reference).unwrap();
        assert_eq!(forget_with(&call, &fixed_ref).unwrap().links, 1);
        assert!(call(&words(&["memories", "show", &fixed.reference])).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn runs_a_real_program_and_reads_memos_error_on_a_failure() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("wirecat-memory-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let bin = dir.join("memo");
        std::fs::write(
            &bin,
            "#!/bin/sh\ncase \"$*\" in\n*--no-record*) ;;\n*) echo 'no --no-record' >&2; exit 9;;\nesac\n\
             if [ \"$1\" = facts ]; then echo '{\"error\":{\"code\":\"not_found\",\"message\":\"the fact fact:9 is not in the local store\"}}'; exit 6; fi\n\
             echo '{\"items\":[],\"page\":{\"has_more\":false}}'\n",
        )
        .unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(call_at(&bin, &words(&["memories", "list"]), READ).unwrap()["items"], json!([]));
        assert_eq!(
            call_at(&bin, &words(&["facts", "confirm", "fact:9"]), READ),
            Err("the fact fact:9 is not in the local store".into())
        );
        assert!(call_at(&bin, &strs(&["memories", "list"]), READ).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}
