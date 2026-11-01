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
    /// An action has no text of its own: memo's one-line summary of what it would do.
    pub text: Option<String>,
    pub status: String,
    pub subject: Option<String>,
    pub subject_name: Option<String>,
    pub subject_is_owner: bool,
    pub author: Option<Author>,
    pub scope: Option<String>,
    pub project: Option<String>,
    pub project_name: Option<String>,
    pub supersedes: Option<String>,
    /// How many sources it cites: what Forget erases besides the record.
    pub links: usize,
    pub reason: Option<String>,
    pub account: Option<String>,
    pub target: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    /// A findings batch's facts and tasks; absent on every other record.
    pub findings: Option<Vec<Finding>>,
    pub model: Option<String>,
    /// How sure the agent said it was, 0 to 1; memo keeps it on memories only.
    pub confidence: Option<f64>,
}

/// Memo stages an agent's cited facts and follow-ups as an action of this kind, decided with the fingerprint
/// `actions show` gives.
const FINDINGS: &str = "evidence_findings";

/// One fact or task in a findings batch, as `projects actions confirm` creates it.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    /// `fact` or `task`.
    pub kind: String,
    /// A fact's statement or a task's title.
    pub text: String,
    pub reason: Option<String>,
    pub evidence: Vec<String>,
    /// After review: `accepted` or `rejected`.
    pub outcome: Option<String>,
}

fn findings_of(v: &Value) -> Vec<Finding> {
    let outcome = |id: &str| {
        v["result"]["items"]
            .as_array()
            .and_then(|items| items.iter().find(|i| i["id"].as_str() == Some(id)))
            .and_then(|i| text(i, "status"))
    };
    v["payload"]["findings"]
        .as_array()
        .map(|all| {
            all.iter()
                .filter_map(|f| {
                    let id = text(f, "id")?;
                    Some(Finding {
                        outcome: outcome(&id),
                        kind: text(f, "kind")?,
                        text: text(f, "statement").or_else(|| text(f, "title"))?,
                        reason: text(f, "reason"),
                        evidence: f["evidence"]
                            .as_array()
                            .map(|e| e.iter().filter_map(|x| text(x, "reference")).collect())
                            .unwrap_or_default(),
                        id,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
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
        project_name: text(v, "project_name"),
        supersedes: text(v, "supersedes"),
        links: v["evidence"].as_array().map_or(0, Vec::len),
        reason: None,
        account: None,
        target: None,
        created_at: text(v, "created_at")?,
        updated_at: text(v, "updated_at"),
        findings: None,
        model: text(v, "model"),
        confidence: v["confidence"].as_f64(),
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
    let kind = text(v, "kind")?;
    let batch = kind == FINDINGS;
    Some(Entry {
        reference: format!("action:{}", text(v, "id")?),
        record: "action",
        text: text(v, "summary"),
        status: text(v, "status")?,
        subject: text(v, "subject"),
        subject_name: text(v, "subject_name"),
        subject_is_owner: false,
        author: author(&v["proposed_by"]),
        scope: None,
        project: text(v, "project"),
        project_name: text(v, "project_name"),
        supersedes: None,
        links: 0,
        reason: text(v, "reason"),
        account: text(account, "provider").map(|p| format!("{p}:{}", text(account, "account").unwrap_or_default())),
        target: text(v, "target"),
        created_at: text(v, "created_at")?,
        updated_at: text(v, "decided_at"),
        model: text(&v["payload"], "agent_model"),
        confidence: None,
        findings: batch.then(|| findings_of(v)),
        kind,
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
        // Deciding one batch changes its project, so memo refuses to confirm the other batches staged before it.
        Some(v) if v["error"]["reason"].as_str() == Some("evidence-findings.stale") => {
            Err("The project changed since the agent proposed these findings. Discard them, or ask the agent to look \
                 again."
                .into())
        }
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
    // `actions list` reads every findings batch's sources back unless brief; the page reads them on opening one.
    let mut parts = vec![noun, "list", "--limit", LIMIT];
    if noun == "actions" {
        parts.push("--brief");
    }
    let v = call(&words(&parts))?;
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

/// An action answers its sources in `show` itself; a memory or a fact only with `--sources`.
fn sources_with(call: &Call, r: &Ref) -> Result<Vec<Source>, String> {
    let v = if r.kind == Kind::Action {
        call(&words(&["actions", "show", &r.memo()]))?
    } else {
        call(&words(&[r.noun(), "show", &r.memo(), "--sources"]))?
    };
    Ok(body(&v)["sources"].as_array().map(|a| a.iter().filter_map(source).collect()).unwrap_or_default())
}

pub fn sources(reference: &str) -> Result<Vec<Source>, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| sources_with(call, &r))
}

/// A findings batch is decided with the fingerprint `actions show` gives, so the owner decides on the batch as it is
/// now. `accept` names the findings to create; Memo rejects the others. Only IDs the batch itself holds reach the
/// command line.
fn review_with(call: &Call, r: &Ref, accept: Option<&[String]>) -> Result<Option<Entry>, String> {
    if r.kind != Kind::Action {
        return Ok(None);
    }
    let shown = call(&words(&["actions", "show", &r.memo()]))?;
    let item = body(&shown);
    if text(item, "kind").as_deref() != Some(FINDINGS) {
        return Ok(None);
    }
    let held: Vec<String> = findings_of(item).into_iter().map(|f| f.id).collect();
    let accept: Vec<String> = match accept {
        None => held.clone(),
        Some(ids) => ids.to_vec(),
    };
    if accept.iter().any(|id| !held.contains(id) || plain(id).is_none()) {
        return Err("Pick only findings this batch holds.".into());
    }
    let fingerprint = text_field(item, "fingerprint").ok_or("Memo did not give these findings' fingerprint")?;
    // `actions confirm` with no finding named creates them all, so nothing accepted is a rejection.
    let mut args: Vec<String> = vec!["actions".into(), if accept.is_empty() { "reject" } else { "confirm" }.into()];
    args.push(r.memo());
    args.extend(accept);
    args.extend(["--fingerprint".into(), fingerprint]);
    args.extend(QUIET.iter().map(|s| (*s).to_string()));
    parse_entry(r, &call(&args)?).map(Some)
}

fn confirm_with(call: &Call, r: &Ref, accept: Option<&[String]>) -> Result<Entry, String> {
    if let Some(e) = review_with(call, r, accept)? {
        return Ok(e);
    }
    parse_entry(r, &call(&words(&[r.noun(), "confirm", &r.memo()]))?)
}

/// Approving an action makes it a task in the account that would act; Memo sends nothing. Approving findings creates
/// the facts and tasks named in `accept` (all of them when it is absent).
pub fn confirm(reference: &str, accept: Option<&[String]>) -> Result<Entry, String> {
    let r = Ref::parse(reference)?;
    with_memo(|call| confirm_with(call, &r, accept))
}

/// Memo has one word per record for "this does not hold": a memory goes stale, a proposed fact is rejected, an
/// accepted decision is reversed, an action is rejected. Any other fact can only be forgotten.
fn discard_with(call: &Call, r: &Ref) -> Result<Entry, String> {
    if let Some(e) = review_with(call, r, Some(&[]))? {
        return Ok(e);
    }
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
            if let Some(scope) = field("scope") {
                args.extend(["--scope".into(), scope]);
            }
        }
        Kind::Action => return Err("An action cannot be corrected; discard it instead.".into()),
    }
    if let Some(project) = field("project") {
        args.extend(["--project".into(), project]);
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

/// What a cited source says, read back through memo: a message with its neighbours in the chat or thread, or a note.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Context {
    Messages {
        items: Vec<ContextMessage>,
    },
    Note {
        title: Option<String>,
        text: String,
        file: bool,
    },
    /// memo has no command that reads this kind of ref back.
    Unsupported {
        prefix: String,
    },
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextMessage {
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub sender: Option<String>,
    pub at: Option<String>,
    pub text: String,
    /// The cited message, among its neighbours.
    pub anchor: bool,
}

const AROUND: &str = "3";
const CONTEXT_CHARS: usize = 4000;

enum SourceRef<'a> {
    Message(&'a str),
    Note(&'a str),
    Other(&'a str),
}

/// A ref the interface hands back: memo's own word, checked before it becomes an argument.
fn source_ref(s: &str) -> Result<SourceRef<'_>, String> {
    let bad = || format!("not a source reference: {s}");
    let (prefix, rest) = s.split_once(':').ok_or_else(bad)?;
    if rest.is_empty() || s.len() > 400 || plain(s).is_none() || !prefix.bytes().all(|b| b.is_ascii_lowercase()) {
        return Err(bad());
    }
    match prefix {
        "msg" if rest.bytes().all(|b| b.is_ascii_alphanumeric() || b"%._@/+-=~".contains(&b)) => {
            Ok(SourceRef::Message(s))
        }
        "note" | "document" if rest.bytes().all(|b| b.is_ascii_digit()) => Ok(SourceRef::Note(s)),
        "msg" | "note" | "document" => Err(bad()),
        _ => Ok(SourceRef::Other(prefix)),
    }
}

fn clipped(t: &str) -> String {
    if t.chars().count() <= CONTEXT_CHARS {
        return t.to_string();
    }
    let mut cut: String = t.chars().take(CONTEXT_CHARS).collect();
    cut.push('…');
    cut
}

/// Messengers and mail answer in their own shapes; the fields a reader needs, from whichever one is there.
fn context_message(v: &Value, asked: &str) -> Option<ContextMessage> {
    let sender = text(v, "sender_name")
        .or_else(|| text(v, "senderName"))
        .or_else(|| text(&v["from"], "name"))
        .or_else(|| text(&v["from"], "address"))
        .or_else(|| text(v, "from"));
    let reference = text(v, "ref");
    Some(ContextMessage {
        anchor: v["anchor"].as_bool().unwrap_or(false) || reference.as_deref() == Some(asked),
        sender,
        at: text(v, "timestamp").or_else(|| text(v, "date")).or_else(|| text(v, "at")),
        text: clipped(&text(v, "text").or_else(|| text(v, "body")).or_else(|| text(v, "subject"))?),
        reference,
    })
}

fn context_with(call: &Call, reference: &str) -> Result<Context, String> {
    match source_ref(reference)? {
        SourceRef::Message(r) => {
            let v = call(&words(&["messages", "show", r, "--before-n", AROUND, "--after-n", AROUND]))?;
            let items = v["items"].as_array().map_or_else(|| vec![body(&v).clone()], Clone::clone);
            Ok(Context::Messages { items: items.iter().filter_map(|m| context_message(m, r)).collect() })
        }
        SourceRef::Note(r) => {
            let v = call(&words(&["notes", "show", r]))?;
            let note = body(&v);
            Ok(Context::Note {
                title: text(note, "title"),
                text: clipped(&text(note, "text").unwrap_or_default()),
                file: text(note, "source").as_deref() == Some("file") && text(note, "path").is_some(),
            })
        }
        SourceRef::Other(prefix) => Ok(Context::Unsupported { prefix: prefix.to_string() }),
    }
}

pub fn context(reference: &str) -> Result<Context, String> {
    with_memo(|call| context_with(call, reference))
}

/// The file a note was read from, found again from memo's answer, never from the interface: only a file inside one of
/// memo's configured folders.
fn note_file(call: &Call, reference: &str) -> Result<std::path::PathBuf, String> {
    let SourceRef::Note(r) = source_ref(reference)? else {
        return Err("Only a note or a document has a file to open.".into());
    };
    let shown = call(&words(&["notes", "show", r]))?;
    let note = body(&shown);
    let path = text(note, "path").filter(|_| text(note, "source").as_deref() == Some("file"));
    let path = path.ok_or("Memo keeps no file for this note.")?;
    let folders = call(&words(&["folders", "list"]))?;
    let roots: Vec<std::path::PathBuf> = folders["items"]
        .as_array()
        .map(|a| a.iter().filter_map(|f| text(f, "path")).map(std::path::PathBuf::from).collect())
        .unwrap_or_default();
    let folder = text(note, "folder_id").and_then(|id| {
        folders["items"]
            .as_array()?
            .iter()
            .find(|f| text(f, "id").as_deref() == Some(&id))
            .and_then(|f| text(f, "path"))
    });
    let joined = match folder {
        Some(root) if !Path::new(&path).is_absolute() => Path::new(&root).join(&path),
        _ => std::path::PathBuf::from(&path),
    };
    let file = joined.canonicalize().map_err(|_| "The note's file is not on this computer any more.".to_string())?;
    let inside = roots.iter().filter_map(|r| r.canonicalize().ok()).any(|root| file.starts_with(root));
    if !inside || !file.is_file() {
        return Err("The note's file is outside Memo's folders.".into());
    }
    Ok(file)
}

pub fn open_source(reference: &str) -> Result<(), String> {
    let file = with_memo(|call| note_file(call, reference))?;
    tauri_plugin_opener::open_path(&file, None::<&str>).map_err(|e| e.to_string())
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

    // Captured from memo 0.131.11 against a throwaway store.
    fn agent_memory() -> Value {
        json!({"ref":"memory:3","id":"3","kind":"summary","text":"Ana moves to Valencia","subject":"person:7",
            "subject_name":"Ana Ruiz","subject_is_owner":false,"project":"project:1","project_name":"Harbour",
            "author":{"type":"bot","id":"3","name":"claude-code"},
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
            "executed_at":null,"result":null,"error":null,"verdict":null,"created_at":"2026-10-31T20:56:09.193Z",
            "summary":"Create task chat:telegram/1/77: Send Kai the pricing table","project":null,"project_name":null})
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
        assert_eq!(m.project_name.as_deref(), Some("Harbour"));
        let a = &entries[0];
        assert_eq!(a.text.as_deref(), Some("Create task chat:telegram/1/77: Send Kai the pricing table"));
        assert_eq!(a.account.as_deref(), Some("telegram:1"));
        assert_eq!(a.reason.as_deref(), Some("Kai asked twice"));
        assert_eq!(activity.unwrap()[0].agent.as_deref(), Some("claude-code"));
        assert!(fake.seen().iter().any(|a| a[0] == "actions" && a.contains(&"--brief".to_string())));
        assert!(!fake.seen().iter().any(|a| a[0] == "projects"), "memo names the projects itself");
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
        let e = confirm_with(&|a: &[String]| fake.call(a), &Ref::parse("action:1").unwrap(), None).unwrap();
        assert_eq!(e.status, "approved");
        assert_eq!(fake.seen().last().unwrap(), &strs(&["actions", "confirm", "1", "--json", "--no-record"]));
    }

    // The payload as cli-core's `evidenceFindings.stage` keeps it, read back with memo 0.131.11's `actions show`.
    fn findings_batch(status: &str, result: &Value) -> Value {
        json!({"id":"9","kind":"evidence_findings","account":null,"target":"project:1","payload":{"schema_version":1,
            "key":"nbb-eval","extractor":"codex-nbb-evaluation","findings":[
                {"id":"f1","kind":"fact","project":"project:1","type":"decision",
                 "statement":"The eval set moves to 120 queries.","evidence":[{"reference":"document:3","fingerprint":"a"}]},
                {"id":"f2","kind":"task","project":"project:1","type":"task","title":"Add 40 Spanish queries",
                 "reason":"Lena asked for Spanish coverage","commitment":"explicit",
                 "evidence":[{"reference":"msg:telegram/1/77/42","fingerprint":"b"}]}]},
            "reason":"","status":status,"proposed_by":{"type":"bot","id":"3","name":"codex-nbb-evaluation"},
            "decided_by":null,"decided_at":null,"executed_at":null,"result":result,"error":null,"verdict":null,
            "created_at":"2026-11-01T00:16:37.495Z","summary":"Create 1 fact and 1 task in Northbridge Bench",
            "project":"project:1","project_name":"Northbridge Bench","fingerprint":"5adf3e","subject":"project:1",
            "subject_name":"Northbridge Bench","sources":[{"ref":"document:3","kind":"document","title":"Eval plan",
            "sender":null,"at":"2026-10-31T20:55:39.452Z","excerpt":"The eval set moves to 120 queries.",
            "tool":"notes","missing":false}]})
    }

    #[test]
    fn a_findings_batch_reads_its_facts_tasks_and_project_name() {
        let fake = Fake::new(|a| {
            Ok(match a[0].as_str() {
                "actions" => json!({"items":[findings_batch("proposed", &Value::Null)]}),
                "facts" => json!({"items":[decision("accepted")]}),
                _ => json!({"items":[]}),
            })
        });
        let Read::Ready { entries, .. } = read_with(&|a: &[String]| fake.call(a)).unwrap() else { panic!("not ready") };
        let batch = entries.iter().find(|e| e.reference == "action:9").unwrap();
        assert_eq!(batch.project_name.as_deref(), Some("Northbridge Bench"));
        assert_eq!(batch.subject_name.as_deref(), Some("Northbridge Bench"));
        let found = batch.findings.as_ref().unwrap();
        assert_eq!(
            found.iter().map(|f| f.text.as_str()).collect::<Vec<_>>(),
            ["The eval set moves to 120 queries.", "Add 40 Spanish queries"]
        );
        assert_eq!(found[1].evidence, ["msg:telegram/1/77/42"]);
    }

    #[test]
    fn a_cited_message_comes_back_with_its_neighbours_and_other_refs_say_so() {
        let fake = Fake::new(|_| {
            Ok(json!({"items":[
                {"ref":"msg:telegram/1/77/41","sender_name":"Kai Sample","timestamp":"2026-10-30T10:00:00Z","text":"Mondays are packed."},
                {"ref":"msg:telegram/1/77/42","sender_name":"Kai Sample","timestamp":"2026-10-30T10:01:00Z","text":"Friday after 3?","anchor":true}
            ]}))
        });
        let call = |a: &[String]| fake.call(a);
        let Context::Messages { items } = context_with(&call, "msg:telegram/1/77/42").unwrap() else { panic!() };
        assert_eq!(items.iter().map(|m| m.anchor).collect::<Vec<_>>(), [false, true]);
        assert_eq!(
            fake.seen()[0],
            strs(&[
                "messages",
                "show",
                "msg:telegram/1/77/42",
                "--before-n",
                "3",
                "--after-n",
                "3",
                "--json",
                "--no-record"
            ])
        );
        assert_eq!(context_with(&call, "meeting:88").unwrap(), Context::Unsupported { prefix: "meeting".into() });
        for bad in ["msg:a b", "--json", "note:1x", "msg:", "document:-1", "msg:x;rm"] {
            assert!(context_with(&call, bad).is_err(), "{bad}");
        }
        assert_eq!(fake.seen().len(), 1, "only the message read reaches memo");
    }

    #[test]
    fn a_note_file_opens_only_inside_memos_folders() {
        let dir = std::env::temp_dir().join(format!("wirecat-memo-open-{}", std::process::id()));
        let notes = dir.join("notes");
        std::fs::create_dir_all(&notes).unwrap();
        std::fs::write(notes.join("Kai.md"), "x").unwrap();
        std::fs::write(dir.join("outside.md"), "x").unwrap();
        let root = notes.to_string_lossy().to_string();
        let answer = move |path: &'static str| {
            let root = root.clone();
            Fake::new(move |a| {
                Ok(if a[0] == "folders" {
                    json!({"items":[{"id":"1","path":root}]})
                } else {
                    json!({"item":{"ref":"note:3","source":"file","folder_id":"1","path":path,"text":"x"}})
                })
            })
        };
        let inside = answer("Kai.md");
        assert_eq!(
            note_file(&|a: &[String]| inside.call(a), "note:3").unwrap(),
            notes.join("Kai.md").canonicalize().unwrap()
        );
        let escape = answer("../outside.md");
        assert!(note_file(&|a: &[String]| escape.call(a), "note:3").is_err());
        assert!(note_file(&|a: &[String]| inside.call(a), "msg:telegram/1/2/3").is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn findings_are_decided_by_id_with_the_fingerprint_show_gives() {
        let fake = Fake::new(|a| {
            Ok(json!({"item": match a[1].as_str() {
                "show" => findings_batch("proposed", &Value::Null),
                "reject" => findings_batch("rejected", &json!({"accepted":[]})),
                _ => findings_batch("approved", &json!({"accepted":["f2"]})),
            }}))
        });
        let call = |a: &[String]| fake.call(a);
        let r = Ref::parse("action:9").unwrap();
        assert_eq!(confirm_with(&call, &r, Some(&strs(&["f2"]))).unwrap().status, "approved");
        assert_eq!(discard_with(&call, &r).unwrap().status, "rejected");
        let seen = fake.seen();
        assert_eq!(
            seen[1],
            strs(&["actions", "confirm", "9", "f2", "--fingerprint", "5adf3e", "--json", "--no-record"])
        );
        assert_eq!(seen[3], strs(&["actions", "reject", "9", "--fingerprint", "5adf3e", "--json", "--no-record"]));
        assert_eq!(seen.len(), 4, "the decision's answer is the batch as it now is");
        assert!(confirm_with(&call, &r, Some(&strs(&["--all"]))).is_err());
    }

    #[test]
    fn a_batch_shows_the_sources_memo_reads_back_with_it() {
        let fake = Fake::new(|_| Ok(json!({"item": findings_batch("proposed", &Value::Null)})));
        let s = sources_with(&|a: &[String]| fake.call(a), &Ref::parse("action:9").unwrap()).unwrap();
        assert_eq!(s[0].title.as_deref(), Some("Eval plan"));
        assert_eq!(fake.seen()[0], strs(&["actions", "show", "9", "--json", "--no-record"]));
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
        assert_eq!(run("action:1", "").1, ["show", "reject"]);
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
                "--project",
                "project:1",
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
    #[ignore = "needs MEMO_BIN, a memo 0.131.11+ with a throwaway store"]
    fn reads_and_writes_through_a_real_memo() {
        let bin = std::path::PathBuf::from(std::env::var("MEMO_BIN").expect("MEMO_BIN"));
        let call = |a: &[String]| call_at(&bin, a, READ);
        let raw =
            |noun: &str| call(&words(&[noun, "list", "--limit", LIMIT])).unwrap()["items"].as_array().unwrap().len();
        let Read::Ready { entries, activity, .. } = read_with(&call).unwrap() else { panic!("not ready") };
        assert_eq!(entries.len(), raw("memories") + raw("facts") + raw("actions"), "an item did not parse");
        assert!(activity.is_some());
        assert!(
            entries.iter().filter(|e| e.record == "action").all(|e| e.text.is_some()),
            "every action has a summary"
        );
        if let Some(batch) = entries.iter().find(|e| e.findings.is_some()) {
            assert!(batch.project_name.is_some());
            assert!(!sources_with(&call, &Ref::parse(&batch.reference).unwrap()).unwrap().is_empty());
        }
        if let Some(waiting) = entries.iter().find(|e| e.findings.is_some() && e.status == "proposed") {
            let r = Ref::parse(&waiting.reference).unwrap();
            let first = waiting.findings.as_ref().unwrap()[0].id.clone();
            let decided = confirm_with(&call, &r, Some(&[first])).unwrap();
            assert_eq!(decided.status, "approved");
            assert_eq!(
                decided.findings.unwrap().iter().filter(|f| f.outcome.as_deref() == Some("accepted")).count(),
                1
            );
        }

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
