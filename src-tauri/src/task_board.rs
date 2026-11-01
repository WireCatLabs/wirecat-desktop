//! The Tasks page: project tasks through Memo's own `tasks`, `people` and `projects` commands. Titles, notes and names
//! are the owner's own data on the owner's own page, so they are not masked (as on the Memory page); they never go into
//! a log or a report. Every call passes `--no-record`: a desktop run is kept when it fails, and a failed edit would
//! keep the owner's notes in Memo's run log. Every write passes the revision the page read, so Memo refuses an edit made
//! on a stale copy (`task.stale`) instead of undoing an agent's change.

use crate::catalog::{self, Tool};
use crate::skills::failure;
use crate::{paths, run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const LIMIT: &str = "500";
pub const MAX_TITLE: usize = 500;
pub const MAX_NOTES: usize = 20_000;
const MAX_QUERY: usize = 2000;
const READ: Duration = Duration::from_mins(1);
const WRITE: Duration = Duration::from_secs(30);
const QUIET: [&str; 2] = ["--json", "--no-record"];
pub const STATES: [&str; 5] = ["open", "todo", "in_progress", "done", "dismissed"];
pub const PRIORITIES: [&str; 5] = ["low", "medium", "high", "critical", "none"];

/// One Memo command: its JSON on success, or the error object Memo printed.
type Call<'a> = dyn Fn(&[String]) -> Result<Value, Failure> + Sync + 'a;

#[derive(Debug, PartialEq)]
pub struct Failure {
    reason: Option<String>,
    message: String,
}

impl From<Failure> for String {
    fn from(f: Failure) -> String {
        f.message
    }
}

fn plain_word(s: &str, max: usize, extra: &[char]) -> bool {
    !s.is_empty()
        && s.len() <= max
        && !s.starts_with('-')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || extra.contains(&c))
}

/// `HRB-12`: a project's key, a dash and a number.
pub fn validate_key(key: &str) -> Result<&str, String> {
    let ok = key.split_once('-').is_some_and(|(p, n)| {
        plain_word(p, 8, &[])
            && p.chars().all(|c| !c.is_ascii_lowercase())
            && plain_word(n, 9, &[])
            && n.chars().all(|c| c.is_ascii_digit())
    });
    if ok { Ok(key) } else { Err(format!("not a task key: {key}")) }
}

pub fn validate_project(key: &str) -> Result<&str, String> {
    if plain_word(key, 8, &[]) && key.chars().all(|c| !c.is_ascii_lowercase()) {
        Ok(key)
    } else {
        Err(format!("not a project key: {key}"))
    }
}

pub fn validate_person(person: &str) -> Result<&str, String> {
    let ok = person
        .strip_prefix("person:")
        .is_some_and(|id| plain_word(id, 15, &[]) && id.bytes().all(|b| b.is_ascii_digit()));
    if ok { Ok(person) } else { Err(format!("not a person: {person}")) }
}

/// An agent's name as Memo keeps it (`hermes`, `claude-code`), or `none` to clear it.
pub fn validate_agent(agent: &str) -> Result<&str, String> {
    if plain_word(agent, 64, &['-', '_', '.']) { Ok(agent) } else { Err(format!("not an agent name: {agent}")) }
}

pub fn validate_state(state: &str) -> Result<&str, String> {
    STATES.contains(&state).then_some(state).ok_or_else(|| format!("not a task state: {state}"))
}

pub fn validate_priority(priority: &str) -> Result<&str, String> {
    PRIORITIES.contains(&priority).then_some(priority).ok_or_else(|| format!("not a priority: {priority}"))
}

/// A calendar day, `YYYY-MM-DD`, which Memo reads as local midnight; or `none` to clear the date.
pub fn validate_due(due: &str) -> Result<&str, String> {
    if due == "none" {
        return Ok(due);
    }
    let parts: Vec<&str> = due.split('-').collect();
    let ok = due.len() == 10
        && parts.len() == 3
        && parts.iter().all(|p| p.bytes().all(|b| b.is_ascii_digit()))
        && parts[1].parse::<u8>().is_ok_and(|m| (1..=12).contains(&m))
        && parts[2].parse::<u8>().is_ok_and(|d| (1..=31).contains(&d));
    if ok { Ok(due) } else { Err(format!("not a date: {due}")) }
}

pub fn validate_title(title: &str) -> Result<&str, String> {
    let t = title.trim();
    if t.is_empty() || t.chars().count() > MAX_TITLE || t.chars().any(char::is_control) {
        return Err(format!("a title is 1 to {MAX_TITLE} characters on one line"));
    }
    Ok(t)
}

/// Notes are Markdown, so line breaks and tabs stay; any other control character has no place in them.
pub fn validate_notes(notes: &str) -> Result<&str, String> {
    if notes.chars().count() > MAX_NOTES || notes.chars().any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t')) {
        return Err(format!("notes are at most {MAX_NOTES} characters"));
    }
    Ok(notes)
}

/// The owner's search words. The board shows project tasks only, so the query always narrows to `project:*`.
pub fn board_query(query: &str) -> Result<String, String> {
    let q = query.trim();
    if q.chars().count() > MAX_QUERY || q.chars().any(char::is_control) {
        return Err(format!("a search is at most {MAX_QUERY} characters on one line"));
    }
    Ok(if q.is_empty() { "project:*".into() } else { format!("project:* ({q})") })
}

#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Blocker {
    pub key: String,
    pub state: String,
}

#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub key: String,
    pub project: String,
    pub title: String,
    pub description: Option<String>,
    pub kind: Option<String>,
    pub state: String,
    pub priority: Option<f64>,
    pub priority_label: Option<String>,
    pub agent: Option<String>,
    pub revision: u64,
    pub parent: Option<String>,
    pub due_at: Option<String>,
    pub closed_at: Option<String>,
    pub claimed_by: Option<String>,
    pub claimed_until: Option<String>,
    /// People in the assignee role, as `person:<id>`; names come from `people list`.
    pub assignees: Vec<String>,
    /// `None` from `tasks show`, which does not work it out.
    pub ready: Option<bool>,
    pub blocked_by: Vec<Blocker>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn bare_key(reference: &str) -> String {
    reference.strip_prefix("task:").unwrap_or(reference).to_string()
}

/// One task from `tasks list`, or from `tasks show` and the writes, which still say `status` and `type`.
fn task(v: &Value) -> Option<Task> {
    let key = text(v, "key")?;
    let project = key.split_once('-')?.0.to_string();
    Some(Task {
        project,
        title: text(v, "title")?,
        description: text(v, "description"),
        kind: text(v, "kind").or_else(|| text(v, "type")),
        state: text(v, "state").or_else(|| text(v, "status"))?,
        priority: v["priority"].as_f64(),
        priority_label: text(v, "priority_label"),
        agent: text(v, "agent"),
        revision: v["revision"].as_u64()?,
        parent: text(v, "parent").map(|p| bare_key(&p)),
        due_at: text(v, "due_at"),
        closed_at: text(v, "closed_at"),
        claimed_by: text(v, "claimed_by"),
        claimed_until: text(v, "claimed_until"),
        assignees: v["assignments"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter(|x| x["role"].as_str().is_none_or(|r| r == "assignee"))
                    .filter_map(|x| text(x, "to"))
                    .collect()
            })
            .unwrap_or_default(),
        ready: v["ready"].as_bool(),
        blocked_by: v["blocked_by"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|b| Some(Blocker { key: bare_key(&text(b, "task")?), state: text(b, "state")? }))
                    .collect()
            })
            .unwrap_or_default(),
        key,
        created_at: text(v, "created_at")?,
        updated_at: text(v, "updated_at"),
    })
}

fn body(v: &Value) -> &Value {
    v.get("item").unwrap_or(v)
}

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

/// Everything after `--` is the query, options included, so the query comes last.
fn with_query(parts: &[&str], query: &str) -> Vec<String> {
    let mut args = words(parts);
    args.extend(["--".to_string(), query.to_string()]);
    args
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Read {
    Missing,
    /// The installed Memo lacks what the page needs; the page offers its update instead.
    #[serde(rename_all = "camelCase")]
    Old {
        version: Option<String>,
        need: String,
    },
    /// Memo could not read the search words; the page shows its reason under the search box.
    #[serde(rename_all = "camelCase")]
    BadQuery {
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    Ready {
        tasks: Vec<Task>,
        total: u64,
        /// More tasks match than one read holds.
        more: bool,
    },
}

fn call_at(bin: &Path, args: &[String], timeout: Duration) -> Result<Value, Failure> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(bin, &refs, Some(&paths::search_path()), timeout)
        .map_err(|e| Failure { reason: None, message: e.to_string() })?;
    let json = out.json();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        j => Err(Failure {
            reason: j.as_ref().and_then(|v| v["error"]["reason"].as_str()).map(str::to_string),
            message: failure(&out, j.as_ref()),
        }),
    }
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

fn too_old(version: Option<&str>, need: &str) -> bool {
    let Ok(need) = semver::Version::parse(need) else { return false };
    version.and_then(|v| semver::Version::parse(v).ok()).is_none_or(|v| v < need)
}

/// `None` when Memo can serve the page; otherwise what the page shows instead.
fn gate() -> Result<Option<Read>, String> {
    let tool = memo()?;
    let need = tool.task_board.as_ref().ok_or("Memo has no task board in the catalog")?.min_version.clone();
    let state = tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(Some(Read::Missing)) };
    if too_old(first.version.as_deref(), &need) {
        return Ok(Some(Read::Old { version: first.version.clone(), need }));
    }
    Ok(None)
}

fn with_memo<T>(timeout: Duration, f: impl FnOnce(&Call) -> Result<T, Failure>) -> Result<T, String> {
    let tool = memo()?;
    let bin = paths::find(&tool.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args, timeout)).map_err(String::from)
}

fn list_with(call: &Call, query: &str) -> Result<Read, Failure> {
    let q = board_query(query).map_err(|message| Failure { reason: None, message })?;
    let args = with_query(&["tasks", "list", "--sort", "priority", "--limit", LIMIT], &q);
    let v = match call(&args) {
        Ok(v) => v,
        Err(f) if f.reason.as_deref().is_some_and(|r| r.starts_with("query.")) => {
            return Ok(Read::BadQuery { message: f.message });
        }
        Err(f) => return Err(f),
    };
    let tasks: Vec<Task> = v["items"].as_array().map(|a| a.iter().filter_map(task).collect()).unwrap_or_default();
    let total = v["page"]["total"]["value"].as_u64().unwrap_or(tasks.len() as u64);
    Ok(Read::Ready { more: v["page"]["has_more"].as_bool().unwrap_or(false), total, tasks })
}

pub fn list(query: &str) -> Result<Read, String> {
    if let Some(r) = gate()? {
        return Ok(r);
    }
    with_memo(READ, |call| list_with(call, query))
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Facet {
    pub value: String,
    pub name: Option<String>,
    pub count: u64,
}

/// How many tasks each filter choice would show. Each facet ignores the query's own terms on that field, so a chosen
/// project still counts the others.
#[derive(Serialize, Debug, PartialEq)]
pub struct Counts {
    pub total: u64,
    pub project: Vec<Facet>,
    pub assignee: Vec<Facet>,
    pub priority: Vec<Facet>,
    pub state: Vec<Facet>,
}

fn counts_of(v: &Value) -> Counts {
    let item = body(v);
    let facet = |k: &str| {
        item[k]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|c| {
                        Some(Facet { value: text(c, "value")?, name: text(c, "name"), count: c["count"].as_u64()? })
                    })
                    .collect()
            })
            .unwrap_or_default()
    };
    Counts {
        total: item["total"].as_u64().unwrap_or(0),
        project: facet("project"),
        assignee: facet("assignee"),
        priority: facet("priority"),
        state: facet("state"),
    }
}

fn counts_with(call: &Call, query: &str) -> Result<Counts, Failure> {
    let q = board_query(query).map_err(|message| Failure { reason: None, message })?;
    Ok(counts_of(&call(&with_query(&["tasks", "counts"], &q))?))
}

pub fn counts(query: &str) -> Result<Counts, String> {
    with_memo(READ, |call| counts_with(call, query))
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Person {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub owner: bool,
}

fn people_with(call: &Call) -> Result<Vec<Person>, Failure> {
    let v = call(&words(&["people", "list"]))?;
    Ok(v["items"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|p| {
                    let reference = text(p, "ref")?;
                    validate_person(&reference).ok()?;
                    Some(Person { name: text(p, "name"), owner: p["owner"].as_bool().unwrap_or(false), reference })
                })
                .collect()
        })
        .unwrap_or_default())
}

pub fn people() -> Result<Vec<Person>, String> {
    with_memo(READ, people_with)
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Project {
    pub key: String,
    pub name: String,
}

/// Inboxes hold tasks made from messages, which the page leaves out.
fn projects_with(call: &Call) -> Result<Vec<Project>, Failure> {
    let v = call(&with_query(&["projects", "list"], "kind:project"))?;
    Ok(v["items"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|p| Some(Project { key: text(p, "key")?, name: text(p, "name").unwrap_or_default() }))
                .collect()
        })
        .unwrap_or_default())
}

pub fn projects() -> Result<Vec<Project>, String> {
    with_memo(READ, projects_with)
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Author {
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub name: Option<String>,
    pub owner: bool,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Change {
    pub field: String,
    pub from: Value,
    pub to: Value,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Event {
    pub at: String,
    pub kind: String,
    pub by: Option<Author>,
    pub changes: Vec<Change>,
}

fn event(v: &Value) -> Option<Event> {
    let by = &v["by"];
    Some(Event {
        at: text(v, "at")?,
        kind: text(v, "kind")?,
        by: by.is_object().then(|| Author {
            reference: text(by, "ref"),
            name: text(by, "name"),
            owner: by["owner"].as_bool().unwrap_or(false),
        }),
        changes: v["changes"]
            .as_object()
            .map(|o| {
                o.iter()
                    .filter_map(|(field, pair)| {
                        let pair = pair.as_array()?;
                        Some(Change {
                            field: field.clone(),
                            from: pair.first().cloned().unwrap_or(Value::Null),
                            to: pair.get(1).cloned().unwrap_or(Value::Null),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default(),
    })
}

fn history_with(call: &Call, key: &str) -> Result<Vec<Event>, Failure> {
    let v = call(&words(&["tasks", "history", key]))?;
    Ok(v["items"].as_array().map(|a| a.iter().filter_map(event).collect()).unwrap_or_default())
}

pub fn history(key: &str) -> Result<Vec<Event>, String> {
    let key = validate_key(key)?;
    with_memo(READ, |call| history_with(call, key))
}

fn shown(v: &Value) -> Result<Task, Failure> {
    task(body(v)).ok_or_else(|| Failure { reason: None, message: "Memo's answer did not describe the task".into() })
}

fn show_with(call: &Call, key: &str) -> Result<Task, Failure> {
    shown(&call(&words(&["tasks", "show", key]))?)
}

pub fn show(key: &str) -> Result<Task, String> {
    let key = validate_key(key)?;
    with_memo(READ, |call| show_with(call, key))
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LabelChange {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Write {
    #[serde(rename_all = "camelCase")]
    Saved {
        task: Task,
        /// A move put the card among tasks of another priority label.
        label: Option<LabelChange>,
        /// Other tasks Memo gave new priorities to make room; the page reads them again.
        renumbered: Vec<String>,
    },
    /// Someone changed the task after the page read it; nothing was written. `current` is the task as it is now and
    /// `last` the latest change, so the page can say who changed what.
    #[serde(rename_all = "camelCase")]
    Stale { current: Task, last: Option<Event> },
}

fn stale(f: &Failure) -> bool {
    f.reason.as_deref() == Some("task.stale")
}

/// A write, or the task as it now is when Memo refused it as stale.
fn write_with(call: &Call, key: &str, args: &[String]) -> Result<Write, Failure> {
    match call(args) {
        Ok(v) => Ok(saved(&v)?),
        Err(f) if stale(&f) => stale_with(call, key),
        Err(f) => Err(f),
    }
}

fn stale_with(call: &Call, key: &str) -> Result<Write, Failure> {
    let current = show_with(call, key)?;
    let last = history_with(call, key).ok().and_then(|mut h| h.pop());
    Ok(Write::Stale { current, last })
}

fn saved(v: &Value) -> Result<Write, Failure> {
    let item = body(v);
    // `tasks move` answers the task beside its label change; the other writes answer the task alone.
    if let Some(t) = item.get("task") {
        let label = &item["label"];
        return Ok(Write::Saved {
            task: shown(t)?,
            label: (label["changed"].as_bool() == Some(true))
                .then(|| LabelChange { from: text(label, "from"), to: text(label, "to") }),
            renumbered: item["renumbered"]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
                .unwrap_or_default(),
        });
    }
    Ok(Write::Saved { task: shown(item)?, label: None, renumbered: Vec::new() })
}

/// What one edit changes; anything left `None` stays as it is.
#[derive(Deserialize, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Edit {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due: Option<String>,
    pub agent: Option<String>,
    pub state: Option<String>,
}

/// Text goes as `--title=<text>`, so a title that starts with a dash is never read as an option.
fn edit_args(key: &str, revision: u64, edit: &Edit) -> Result<Vec<String>, String> {
    let mut args = vec!["tasks".to_string(), "update".into(), key.into()];
    if let Some(t) = &edit.title {
        args.push(format!("--title={}", validate_title(t)?));
    }
    if let Some(d) = &edit.description {
        args.push(format!("--description={}", validate_notes(d)?));
    }
    if let Some(p) = &edit.priority {
        args.push(format!("--priority={}", validate_priority(p)?));
    }
    if let Some(d) = &edit.due {
        args.push(format!("--due={}", validate_due(d)?));
    }
    if let Some(a) = &edit.agent {
        args.push(format!("--agent={}", validate_agent(a)?));
    }
    if let Some(s) = &edit.state {
        args.push(format!("--status={}", validate_state(s)?));
    }
    if args.len() == 3 {
        return Err("nothing to change".into());
    }
    args.push(format!("--revision={revision}"));
    args.extend(QUIET.iter().map(|s| (*s).to_string()));
    Ok(args)
}

pub fn update(key: &str, revision: u64, edit: &Edit) -> Result<Write, String> {
    let key = validate_key(key)?;
    let args = edit_args(key, revision, edit)?;
    with_memo(WRITE, |call| write_with(call, key, &args))
}

/// Where a dragged card lands: a column, and the card it goes above or below there.
#[derive(Deserialize, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub state: Option<String>,
    pub before: Option<String>,
    pub after: Option<String>,
}

fn move_args(key: &str, revision: u64, place: &Place) -> Result<Vec<String>, String> {
    let mut args = vec!["tasks".to_string(), "move".into(), key.into()];
    if let Some(s) = &place.state {
        args.push(format!("--status={}", validate_state(s)?));
    }
    match (&place.before, &place.after) {
        (Some(_), Some(_)) => return Err("a card goes before one task or after another, not both".into()),
        (Some(b), None) => args.push(format!("--before={}", validate_key(b)?)),
        (None, Some(a)) => args.push(format!("--after={}", validate_key(a)?)),
        (None, None) if place.state.is_none() => return Err("nowhere to move the task".into()),
        (None, None) => {}
    }
    args.push(format!("--revision={revision}"));
    args.extend(QUIET.iter().map(|s| (*s).to_string()));
    Ok(args)
}

pub fn move_task(key: &str, revision: u64, place: &Place) -> Result<Write, String> {
    let key = validate_key(key)?;
    let args = move_args(key, revision, place)?;
    with_memo(WRITE, |call| write_with(call, key, &args))
}

/// Makes `person` the one assignee (or nobody, with `None`): the others are taken off first, each write with the
/// revision the one before answered.
fn assign_with(call: &Call, key: &str, revision: u64, person: Option<&str>) -> Result<Write, Failure> {
    let current = show_with(call, key)?;
    if current.revision != revision {
        return stale_with(call, key);
    }
    let off: Vec<String> = current.assignees.iter().filter(|p| Some(p.as_str()) != person).cloned().collect();
    let has = person.is_some_and(|p| current.assignees.iter().any(|a| a == p));
    let mut result = Write::Saved { task: current, label: None, renumbered: Vec::new() };
    let mut rev = revision;
    for p in &off {
        let r = format!("--revision={rev}");
        result = write_with(call, key, &words(&["tasks", "assign", key, p, "--clear", &r]))?;
        match &result {
            Write::Saved { task, .. } => rev = task.revision,
            Write::Stale { .. } => return Ok(result),
        }
    }
    if let (Some(p), false) = (person, has) {
        let r = format!("--revision={rev}");
        result = write_with(call, key, &words(&["tasks", "assign", key, p, &r]))?;
    }
    Ok(result)
}

pub fn assign(key: &str, revision: u64, person: Option<&str>) -> Result<Write, String> {
    let key = validate_key(key)?;
    let person = person.map(validate_person).transpose()?;
    with_memo(WRITE, |call| assign_with(call, key, revision, person))
}

#[derive(Deserialize, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct New {
    pub project: String,
    pub title: String,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    pub due: Option<String>,
    pub state: Option<String>,
}

fn add_args(new: &New) -> Result<Vec<String>, String> {
    let mut args = vec![
        "tasks".to_string(),
        "add".into(),
        format!("--project={}", validate_project(&new.project)?),
        format!("--title={}", validate_title(&new.title)?),
    ];
    if let Some(p) = new.priority.as_deref().filter(|p| *p != "none") {
        args.push(format!("--priority={}", validate_priority(p)?));
    }
    if let Some(a) = &new.assignee {
        args.push(format!("--assignee={}", validate_person(a)?));
    }
    args.extend(QUIET.iter().map(|s| (*s).to_string()));
    Ok(args)
}

/// `tasks add` takes no due date or state, so a second write sets them on the task it answered.
fn create_with(call: &Call, new: &New) -> Result<Write, Failure> {
    let as_failure = |message: String| Failure { reason: None, message };
    let added = saved(&call(&add_args(new).map_err(as_failure)?)?)?;
    let Write::Saved { task, .. } = &added else { return Ok(added) };
    let state = new.state.as_deref().filter(|s| *s != "open");
    if new.due.is_none() && state.is_none() {
        return Ok(added);
    }
    let edit = Edit { due: new.due.clone(), state: state.map(str::to_string), ..Edit::default() };
    let args = edit_args(&task.key, task.revision, &edit).map_err(as_failure)?;
    write_with(call, &task.key, &args)
}

pub fn create(new: &New) -> Result<Write, String> {
    if let Some(d) = &new.due {
        validate_due(d)?;
    }
    if let Some(s) = &new.state {
        validate_state(s)?;
    }
    with_memo(WRITE, |call| create_with(call, new))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    /// A stand-in for Memo that remembers every command line and answers from a closure.
    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        answer: Box<Call<'static>>,
    }

    impl Fake {
        fn new(answer: impl Fn(&[String]) -> Result<Value, Failure> + Sync + 'static) -> Fake {
            Fake { seen: Mutex::new(Vec::new()), answer: Box::new(answer) }
        }
        fn call(&self, args: &[String]) -> Result<Value, Failure> {
            self.seen.lock().unwrap().push(args.to_vec());
            (self.answer)(args)
        }
        fn seen(&self) -> Vec<Vec<String>> {
            self.seen.lock().unwrap().clone()
        }
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    fn stale_failure() -> Failure {
        Failure {
            reason: Some("task.stale".into()),
            message: "task HRB-1 changed since revision 1; it is at 3: read it again".into(),
        }
    }

    // Captured from memo 0.131.2 against a throwaway store.
    fn listed() -> Value {
        json!({"ref":"task:HRB-1","id":"HRB-1","key":"HRB-1","title":"Draft the budget","description":null,
            "kind":"feature","state":"open","project":"project:1","source_message":null,"priority":0.734_375,
            "priority_label":"high","agent":"hermes","revision":5,"parent":null,"due_at":"2026-11-04T23:00:00.000Z",
            "closed_at":null,"reason":null,"category":null,"claimed_by":"hermes",
            "claimed_until":"2026-11-01T00:52:52.096Z","assignments":[{"to":"person:2","role":"assignee"},
            {"to":"person:3","role":"reviewer"}],"ready":false,"blocked_by":[{"task":"task:HRB-3","state":"open"}],
            "created_at":"2026-11-01T00:22:37.486Z","updated_at":"2026-11-01T00:22:53.525Z"})
    }

    fn card(revision: u64, assignees: &[&str]) -> Value {
        let assignments: Vec<Value> = assignees.iter().map(|p| json!({"to": p, "role": "assignee"})).collect();
        json!({"id":"HRB-1","ref":"task:HRB-1","key":"HRB-1","project":"project:1","title":"Draft the budget",
            "description":null,"type":"feature","status":"in_progress","priority":0.765_625,"priority_label":"critical",
            "agent":null,"revision":revision,"parent":null,"source":null,"due_at":null,"next_check_at":null,
            "closed_at":null,"reason":null,"verdict":null,"category":null,"claimed_by":null,"claimed_until":null,
            "close_certainty":null,"close_suggestion":null,"assignments":assignments,
            "created_at":"2026-11-01T00:22:37.486Z","updated_at":"2026-11-01T00:26:48.725Z"})
    }

    fn history_rows() -> Value {
        json!({"items":[
            {"at":"2026-11-01T00:22:37.486Z","kind":"created","by":{"ref":"person:1","name":"Slava","owner":true},"changes":null},
            {"at":"2026-11-01T00:22:46.062Z","kind":"due","by":{"ref":"person:1","name":"Slava","owner":true},
             "changes":{"due_at":[null,1_793_833_200_000_u64]}},
            {"at":"2026-11-01T00:23:01.000Z","kind":"status","by":{"ref":"bot:4","name":"hermes","owner":false},
             "changes":{"status":["open","in_progress"]}}]})
    }

    #[test]
    fn keys_people_and_values_are_plain_words() {
        assert!(validate_key("HRB-12").is_ok());
        assert!(validate_key("OPS2-1").is_ok());
        for bad in ["hrb-1", "HRB", "HRB-", "-HRB-1", "HRB-1;x", "HRB-1 ", "HRB-x", "--json"] {
            assert!(validate_key(bad).is_err(), "{bad}");
        }
        assert!(validate_person("person:12").is_ok());
        for bad in ["person:", "person:-1", "person:1 2", "bot:1", "12"] {
            assert!(validate_person(bad).is_err(), "{bad}");
        }
        assert!(validate_agent("claude-code").is_ok());
        assert!(validate_agent("--yes").is_err());
        assert!(validate_state("in_progress").is_ok());
        assert!(validate_state("waiting").is_err());
        assert!(validate_priority("none").is_ok());
        assert!(validate_priority("0.3").is_err());
        assert!(validate_due("2026-11-05").is_ok());
        assert!(validate_due("none").is_ok());
        for bad in ["2026-13-01", "2026-1-01", "tomorrow", "2d"] {
            assert!(validate_due(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn text_is_bounded_and_one_line_for_a_title() {
        assert_eq!(validate_title("  Send the budget ").unwrap(), "Send the budget");
        assert!(validate_title("two\nlines").is_err());
        assert!(validate_title(&"a".repeat(MAX_TITLE + 1)).is_err());
        assert!(validate_notes("a\nb\tc").is_ok());
        assert!(validate_notes("bell\u{7}").is_err());
    }

    #[test]
    fn the_query_always_stays_inside_projects() {
        assert_eq!(board_query("  ").unwrap(), "project:*");
        assert_eq!(board_query("-project:HRB").unwrap(), "project:* (-project:HRB)");
        assert!(board_query("a\nb").is_err());
    }

    #[test]
    fn reads_the_list_with_the_query_after_a_double_dash() {
        let fake = Fake::new(|_| {
            Ok(json!({"items":[listed()],"page":{"mode":"cursor","limit":500,"has_more":true,
                "total":{"value":612,"relation":"eq"}}}))
        });
        let read = list_with(&|a: &[String]| fake.call(a), "-project:OPS").unwrap();
        let Read::Ready { tasks, total, more } = read else { panic!("not ready") };
        assert_eq!((total, more), (612, true));
        let t = &tasks[0];
        assert_eq!(t.project, "HRB");
        assert_eq!(t.assignees, ["person:2"]);
        assert_eq!(t.blocked_by, [Blocker { key: "HRB-3".into(), state: "open".into() }]);
        assert_eq!(t.ready, Some(false));
        assert_eq!(t.kind.as_deref(), Some("feature"));
        assert_eq!(
            fake.seen()[0],
            strs(&[
                "tasks",
                "list",
                "--sort",
                "priority",
                "--limit",
                "500",
                "--json",
                "--no-record",
                "--",
                "project:* (-project:OPS)"
            ])
        );
    }

    #[test]
    fn a_query_memo_cannot_read_is_not_a_failed_read() {
        let fake = Fake::new(|_| {
            Err(Failure {
                reason: Some("query.invalid-syntax".into()),
                message: "tasks list: query.invalid-syntax at position 12".into(),
            })
        });
        assert_eq!(
            list_with(&|a: &[String]| fake.call(a), "(").unwrap(),
            Read::BadQuery { message: "tasks list: query.invalid-syntax at position 12".into() }
        );
        let busy = Fake::new(|_| Err(Failure { reason: Some("store.busy".into()), message: "busy".into() }));
        assert!(list_with(&|a: &[String]| busy.call(a), "").is_err());
    }

    #[test]
    fn the_card_names_of_show_read_as_the_list_names() {
        let t = task(&card(4, &["person:2"])).unwrap();
        assert_eq!(t.state, "in_progress");
        assert_eq!(t.kind.as_deref(), Some("feature"));
        assert_eq!(t.ready, None);
    }

    #[test]
    fn counts_keep_each_choice_with_its_name() {
        let c = counts_of(&json!({"item":{"total":3,
            "project":[{"value":"HRB","name":"Harbour launch","count":2}],
            "assignee":[{"value":"none","name":null,"count":2},{"value":"person:2","name":"Ana Ruiz","count":1}],
            "priority":[{"value":"critical","count":2}],"state":[{"value":"open","count":3}]}}));
        assert_eq!(c.total, 3);
        assert_eq!(c.assignee[1], Facet { value: "person:2".into(), name: Some("Ana Ruiz".into()), count: 1 });
        assert_eq!(c.priority[0].name, None);
    }

    #[test]
    fn people_and_projects_leave_out_what_the_page_cannot_use() {
        let fake = Fake::new(|a| {
            Ok(if a[0] == "people" {
                json!({"items":[{"ref":"person:1","name":null,"owner":true,"tasks":0},
                    {"ref":"person:2","name":"Ana Ruiz","owner":false,"tasks":1},{"ref":"--x","name":"x"}]})
            } else {
                json!({"items":[{"id":"1","ref":"project:1","key":"HRB","name":"Harbour launch","kind":"project"}]})
            })
        });
        let call = |a: &[String]| fake.call(a);
        let people = people_with(&call).unwrap();
        assert_eq!(people.len(), 2);
        assert!(people[0].owner);
        assert_eq!(projects_with(&call).unwrap(), [Project { key: "HRB".into(), name: "Harbour launch".into() }]);
        assert_eq!(fake.seen()[1], strs(&["projects", "list", "--json", "--no-record", "--", "kind:project"]));
    }

    #[test]
    fn history_keeps_who_and_each_change() {
        let fake = Fake::new(|_| Ok(history_rows()));
        let h = history_with(&|a: &[String]| fake.call(a), "HRB-1").unwrap();
        assert_eq!(h.len(), 3);
        assert!(h[0].changes.is_empty());
        assert_eq!(h[2].by.as_ref().unwrap().name.as_deref(), Some("hermes"));
        assert_eq!(h[2].changes[0], Change { field: "status".into(), from: json!("open"), to: json!("in_progress") });
    }

    #[test]
    fn an_edit_passes_text_as_one_word_and_the_revision() {
        let edit = Edit {
            title: Some("-x leads with a dash".into()),
            priority: Some("high".into()),
            due: Some("none".into()),
            agent: Some("none".into()),
            state: Some("todo".into()),
            ..Edit::default()
        };
        assert_eq!(
            edit_args("HRB-1", 7, &edit).unwrap(),
            strs(&[
                "tasks",
                "update",
                "HRB-1",
                "--title=-x leads with a dash",
                "--priority=high",
                "--due=none",
                "--agent=none",
                "--status=todo",
                "--revision=7",
                "--json",
                "--no-record"
            ])
        );
        assert!(edit_args("HRB-1", 7, &Edit::default()).is_err());
        assert!(edit_args("HRB-1", 7, &Edit { priority: Some("0.3".into()), ..Edit::default() }).is_err());
    }

    #[test]
    fn a_stale_edit_answers_the_task_as_it_is_now_and_who_changed_it() {
        let fake = Fake::new(|a| match a[1].as_str() {
            "update" => Err(stale_failure()),
            "show" => Ok(json!({"item": card(3, &[])})),
            _ => Ok(history_rows()),
        });
        let edit = Edit { title: Some("New".into()), ..Edit::default() };
        let args = edit_args("HRB-1", 1, &edit).unwrap();
        let Write::Stale { current, last } = write_with(&|a: &[String]| fake.call(a), "HRB-1", &args).unwrap() else {
            panic!("not stale")
        };
        assert_eq!(current.revision, 3);
        assert_eq!(last.unwrap().by.unwrap().name.as_deref(), Some("hermes"));
    }

    #[test]
    fn a_move_says_when_the_label_changed() {
        let fake = Fake::new(|_| {
            Ok(json!({"item":{"label":{"from":"high","to":"critical","changed":true},"renumbered":["HRB-4"],
                "task": card(6, &[])}}))
        });
        let place = Place { state: Some("in_progress".into()), before: Some("HRB-3".into()), after: None };
        let args = move_args("HRB-1", 5, &place).unwrap();
        assert_eq!(
            args,
            strs(&[
                "tasks",
                "move",
                "HRB-1",
                "--status=in_progress",
                "--before=HRB-3",
                "--revision=5",
                "--json",
                "--no-record"
            ])
        );
        let Write::Saved { task, label, renumbered } =
            write_with(&|a: &[String]| fake.call(a), "HRB-1", &args).unwrap()
        else {
            panic!("not saved")
        };
        assert_eq!(task.state, "in_progress");
        assert_eq!(label, Some(LabelChange { from: Some("high".into()), to: Some("critical".into()) }));
        assert_eq!(renumbered, ["HRB-4"]);
        assert!(move_args("HRB-1", 5, &Place::default()).is_err());
        let both = Place { state: None, before: Some("HRB-2".into()), after: Some("HRB-3".into()) };
        assert!(move_args("HRB-1", 5, &both).is_err());
    }

    #[test]
    fn assigning_takes_the_others_off_with_each_new_revision() {
        let fake = Fake::new(|a| {
            Ok(json!({"item": match (a[1].as_str(), a.iter().any(|w| w == "--clear")) {
                ("show", _) => card(4, &["person:2", "person:3"]),
                ("assign", true) if a[3] == "person:2" => card(5, &["person:3"]),
                ("assign", true) => card(6, &[]),
                _ => card(7, &["person:5"]),
            }}))
        });
        let out = assign_with(&|a: &[String]| fake.call(a), "HRB-1", 4, Some("person:5")).unwrap();
        let Write::Saved { task, .. } = out else { panic!("not saved") };
        assert_eq!(task.assignees, ["person:5"]);
        let seen = fake.seen();
        assert_eq!(
            seen[1],
            strs(&["tasks", "assign", "HRB-1", "person:2", "--clear", "--revision=4", "--json", "--no-record"])
        );
        assert_eq!(seen[2][5], "--revision=5");
        assert_eq!(seen[3], strs(&["tasks", "assign", "HRB-1", "person:5", "--revision=6", "--json", "--no-record"]));
    }

    #[test]
    fn assigning_on_a_stale_copy_writes_nothing() {
        let fake = Fake::new(|a| Ok(if a[1] == "history" { history_rows() } else { json!({"item": card(9, &[])}) }));
        let out = assign_with(&|a: &[String]| fake.call(a), "HRB-1", 4, None).unwrap();
        assert!(matches!(out, Write::Stale { .. }));
        assert!(fake.seen().iter().all(|a| a[1] != "assign"));
    }

    #[test]
    fn a_new_task_gets_its_date_and_column_in_a_second_write() {
        let fake = Fake::new(|a| Ok(json!({"item": card(if a[1] == "add" { 2 } else { 3 }, &[])})));
        let new = New {
            project: "HRB".into(),
            title: "Print flyers".into(),
            priority: Some("medium".into()),
            assignee: Some("person:2".into()),
            due: Some("2026-11-05".into()),
            state: Some("todo".into()),
        };
        let out = create_with(&|a: &[String]| fake.call(a), &new).unwrap();
        assert!(matches!(out, Write::Saved { .. }));
        let seen = fake.seen();
        assert_eq!(
            seen[0],
            strs(&[
                "tasks",
                "add",
                "--project=HRB",
                "--title=Print flyers",
                "--priority=medium",
                "--assignee=person:2",
                "--json",
                "--no-record"
            ])
        );
        assert_eq!(&seen[1][..5], strs(&["tasks", "update", "HRB-1", "--due=2026-11-05", "--status=todo"]));
        assert!(seen[1].contains(&"--revision=2".to_string()));
        let plain = Fake::new(|_| Ok(json!({"item": card(2, &[])})));
        create_with(&|a: &[String]| plain.call(a), &New { project: "HRB".into(), title: "x".into(), ..New::default() })
            .unwrap();
        assert_eq!(plain.seen().len(), 1);
    }

    #[test]
    fn the_interface_reads_camel_case_and_a_kind_tag() {
        let read = Read::Ready { tasks: vec![task(&listed()).unwrap()], total: 1, more: false };
        let v = serde_json::to_value(&read).unwrap();
        assert_eq!(v["kind"], "ready");
        assert_eq!(v["tasks"][0]["priorityLabel"], "high");
        assert_eq!(v["tasks"][0]["blockedBy"][0]["key"], "HRB-3");
        let bad = serde_json::to_value(Read::BadQuery { message: "x".into() }).unwrap();
        assert_eq!(bad["kind"], "badQuery");
        let w = Write::Stale { current: task(&card(3, &[])).unwrap(), last: None };
        assert_eq!(serde_json::to_value(&w).unwrap()["kind"], "stale");
        let p = serde_json::to_value(Person { reference: "person:1".into(), name: None, owner: true }).unwrap();
        assert_eq!(p["ref"], "person:1");
    }

    #[test]
    fn needs_the_catalogs_memo() {
        let tool = catalog::tool("memo").unwrap();
        let need = &tool.task_board.as_ref().unwrap().min_version;
        assert!(too_old(Some("0.130.0"), need));
        assert!(!too_old(Some(need), need));
        assert!(too_old(None, need));
    }

    /// Against a real memo with a throwaway store that holds projects HRB and OPS:
    /// `MEMO_BIN=<memo> cargo test task_board -- --ignored`. It writes to that store, so never point it at the owner's.
    #[test]
    #[ignore = "needs MEMO_BIN, a memo 0.131.2+ with a throwaway store"]
    fn reads_and_writes_through_a_real_memo() {
        let bin = std::path::PathBuf::from(std::env::var("MEMO_BIN").expect("MEMO_BIN"));
        let call = |a: &[String]| call_at(&bin, a, READ);
        let raw = call(&with_query(&["tasks", "list", "--limit", LIMIT], "project:* state:*")).unwrap();
        let Read::Ready { tasks, .. } = list_with(&call, "state:*").unwrap() else { panic!("not ready") };
        assert_eq!(tasks.len(), raw["items"].as_array().unwrap().len(), "a task did not parse");
        assert!(!projects_with(&call).unwrap().is_empty());
        assert!(people_with(&call).unwrap().iter().any(|p| p.owner));
        assert!(counts_with(&call, "").unwrap().state.iter().any(|f| f.value == "in_progress"));
        assert!(matches!(list_with(&call, "(").unwrap(), Read::BadQuery { .. }));

        let new = New {
            project: "HRB".into(),
            title: "-Probe the board".into(),
            due: Some("2026-12-01".into()),
            state: Some("todo".into()),
            ..New::default()
        };
        let Write::Saved { task: a, .. } = create_with(&call, &new).unwrap() else { panic!("not created") };
        assert_eq!((a.state.as_str(), a.title.as_str()), ("todo", "-Probe the board"));
        let new =
            New { project: "HRB".into(), title: "Probe two".into(), state: Some("todo".into()), ..New::default() };
        let Write::Saved { task: b, .. } = create_with(&call, &new).unwrap() else { panic!("not created") };
        let place = Place { state: Some("todo".into()), before: Some(a.key.clone()), after: None };
        let Write::Saved { task: moved, .. } =
            write_with(&call, &b.key, &move_args(&b.key, b.revision, &place).unwrap()).unwrap()
        else {
            panic!("not moved")
        };
        assert!(moved.priority > a.priority);
        let edit = Edit { title: Some("Probe edited".into()), ..Edit::default() };
        let args = edit_args(&a.key, a.revision.saturating_sub(1), &edit).unwrap();
        assert!(matches!(write_with(&call, &a.key, &args).unwrap(), Write::Stale { .. }));
        let args = edit_args(&a.key, a.revision, &Edit { state: Some("done".into()), ..Edit::default() }).unwrap();
        let Write::Saved { task: done, .. } = write_with(&call, &a.key, &args).unwrap() else { panic!("not saved") };
        assert!(done.closed_at.is_some());
        let owner = people_with(&call).unwrap().into_iter().find(|p| p.owner).unwrap();
        let Write::Saved { task: mine, .. } =
            assign_with(&call, &done.key, done.revision, Some(&owner.reference)).unwrap()
        else {
            panic!("not assigned")
        };
        assert_eq!(mine.assignees, [owner.reference]);
        let Write::Saved { task: nobody, .. } = assign_with(&call, &mine.key, mine.revision, None).unwrap() else {
            panic!("not cleared")
        };
        assert!(nobody.assignees.is_empty());
        assert!(history_with(&call, &a.key).unwrap().iter().any(|e| e.changes.iter().any(|c| c.field == "status")));
    }
}
