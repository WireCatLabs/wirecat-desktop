//! The People page: who is who across sources, through memo's own `people` and `review` commands. Names, addresses and
//! account ids are the owner's own data on the owner's own page, shown unmasked like the Memory page, never logged.
//! Every decision is the owner's: it passes `--from-app`, and memo refuses an agent the same moves.

use crate::catalog::{self, Tool};
use crate::skills::{body, failure, too_old};
use crate::{run, tools};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_mins(1);
const LIST_LIMIT: &str = "5000";
const MATCH_LIMIT: &str = "500";
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// The app starts memo with no terminal, which memo takes as nobody's run; this says the owner decided here.
const FROM_APP: &str = "--from-app";
/// memo's own refusals the page words in the owner's language.
const WORDED: [&str; 8] = [
    "identity.stale",
    "identity.owner-only",
    "person.not-found",
    "person.unknown",
    "person.no-doubt",
    "person.test-data",
    "person.owner",
    "proposal.wrong-state",
];
/// What `people links resolve` is refused with by a memo from before it; the page offers the update.
const KEEP_TOO_OLD: &str = "memo.too-old";
/// How a memo older than kinds of people (UX-133) refuses `kind:` and `--sort`: the page then reads it the old way.
const OLDER: [&str; 2] = ["query.unknown-field", "input.invalid"];
/// How a memo that has kinds, but not this one (0.131.75 has no `stranger`), refuses it: no one is of that kind yet.
const UNKNOWN_KIND: &str = "query.unknown-value";
/// The kinds memo sorts people into, the list's tabs in this order.
pub const KINDS: [&str; 5] = ["person", "organization", "automated", "stranger", "unsorted"];

pub(crate) type Call<'a> = dyn Fn(&[String]) -> Result<Value, String> + Sync + 'a;

pub(crate) fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn decision(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(std::iter::once(&FROM_APP)).chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

/// memo answers a refused review decision with exit code 2 and the whole answer on stdout: it goes back as an answer,
/// so `decided` names memo's reason, rather than as the last line of its output. Only a `people list` gives an `OLDER`
/// refusal back bare: elsewhere `input.invalid` is a real refusal and keeps memo's words.
fn answer(out: &run::Output, listing: bool, resolving: bool) -> Result<Value, String> {
    let json = out.json();
    let reason = json.as_ref().and_then(|v| v["error"]["reason"].as_str()).unwrap_or_default();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        // `resolve_with` needs memo's reason and its words both: the refs of an ambiguous company are only in the words.
        Some(v) if resolving && !reason.is_empty() => Ok(v),
        Some(v) if v.get("error").is_none() && body(&v)["refused"].is_array() => Ok(v),
        Some(_) if WORDED.contains(&reason) || (listing && (OLDER.contains(&reason) || reason == UNKNOWN_KIND)) => {
            Err(reason.to_string())
        }
        j => Err(failure(out, j.as_ref())),
    }
}

fn call_at(bin: &Path, args: &[String]) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let listing = args.get(1).is_some_and(|w| w == "list");
    let resolving = args.get(1).is_some_and(|w| w == "resolve");
    answer(&crate::memo_server::run(bin, &refs, TIMEOUT).map_err(|e| e.to_string())?, listing, resolving)
}

pub(crate) fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

/// An id memo prints as a string or a number.
fn id_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// memo names proposals by a bare number; anything else is not one.
fn number(v: &Value) -> Option<String> {
    id_text(v).filter(|id| id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()))
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array().map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default()
}

fn list<T>(v: &Value, key: &str, parse: fn(&Value) -> Option<T>) -> Vec<T> {
    v[key].as_array().into_iter().flatten().filter_map(parse).collect()
}

/// `person:<uid>`, the only way the page names a person to memo.
pub(crate) fn person_ref(s: &str) -> Result<&str, String> {
    let uid = s.strip_prefix("person:").unwrap_or_default();
    if uid.is_empty() || uid.len() > 15 || uid.starts_with('0') || !uid.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not a person: {s}"));
    }
    Ok(s)
}

/// memo prints a merged person's uid bare and a person's ref whole; the page always gets the ref.
fn person_of(v: &Value) -> Option<String> {
    let id = id_text(v)?;
    let r = if id.starts_with("person:") { id } else { format!("person:{id}") };
    person_ref(&r).is_ok().then_some(r)
}

/// An identity goes back into a command line only as one word that cannot read as an option: a provider that starts
/// with a letter, then an id with no space or control character. Others are shown, never sent.
fn sendable(s: &str) -> Option<&str> {
    let (provider, id) = s.split_once(':')?;
    let named = provider.starts_with(|c: char| c.is_ascii_lowercase())
        && provider.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    (named && !id.is_empty() && s.len() <= 400 && !s.chars().any(|c| c.is_whitespace() || c.is_control())).then_some(s)
}

/// A person in the list. An older memo gives only the ref, name, owner and tasks; the rest is then `None`.
#[derive(Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Listed {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub owner: bool,
    pub tasks: u64,
    /// The name cleaned, or a handle, phone or email when the name is not one.
    pub display_name: Option<String>,
    pub kind: Option<String>,
    /// The phone, else the email, else the `@username`.
    pub contact: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    /// A messenger handle, without its `@`.
    pub username: Option<String>,
    /// The messenger `username` is on (`telegram`, `max`…); absent before memo carries `username_source`.
    pub username_source: Option<String>,
    /// Messages and mail this person sent, every account together.
    pub messages_from: Option<u64>,
    pub last_contact: Option<String>,
    /// memo names `bot` among the signals that sorted this person: a messenger bot, whatever kind it landed in.
    pub bot: bool,
}

fn listed(v: &Value) -> Option<Listed> {
    Some(Listed {
        reference: person_of(&v["ref"])?,
        name: text(v, "name"),
        owner: v["owner"].as_bool().unwrap_or(false),
        tasks: v["tasks"].as_u64().unwrap_or(0),
        display_name: text(v, "display_name"),
        kind: text(v, "kind"),
        contact: text(v, "contact"),
        phone: text(v, "phone"),
        email: text(v, "email"),
        username: text(v, "username").map(|u| u.trim_start_matches('@').to_string()),
        username_source: text(v, "username_source"),
        messages_from: v["messages_from"].as_u64(),
        last_contact: text(v, "last_contact"),
        bot: v["kind_signals"].as_array().is_some_and(|a| a.iter().any(|s| s.as_str() == Some("bot"))),
    })
}

/// Who suggested a match: memo's own matching (`rule`), an agent, or a person, who may have no name.
#[derive(Serialize, Debug, PartialEq)]
pub struct Proposer {
    pub kind: String,
    pub name: Option<String>,
}

/// Two people memo thinks may be one, waiting for the owner.
#[derive(Serialize, Debug, PartialEq)]
pub struct Match {
    pub id: String,
    /// The person `identity` is on, then the one it would join.
    pub persons: Vec<String>,
    pub identity: Option<String>,
    pub with: Option<String>,
    /// `person` joins the two people; `identity` moves only `identity`. Absent from a memo before #748's last change.
    pub joins: Option<String>,
    /// `agent`, `phone`, `email` or `guest-email`.
    pub signal: Option<String>,
    pub candidates: Vec<String>,
    pub reason: Option<String>,
    pub evidence: Vec<String>,
    pub proposer: Option<Proposer>,
    /// How sure memo is; `people review` already lists the matches by it, highest first.
    pub score: Option<f64>,
    /// `role` or `line`: the address is a shared mailbox, which memo only suggests and never joins by itself.
    pub shared: Option<String>,
    pub mailbox: Option<String>,
}

fn matched(v: &Value) -> Option<Match> {
    let persons: Vec<String> = v["persons"].as_array()?.iter().filter_map(person_of).collect();
    let by = &v["proposed_by"];
    Some(Match {
        id: number(&v["id"])?,
        identity: text(v, "identity"),
        with: text(v, "with"),
        joins: text(v, "joins"),
        signal: text(v, "signal"),
        candidates: v["candidates"].as_array().into_iter().flatten().filter_map(person_of).collect(),
        reason: text(v, "reason"),
        evidence: strings(&v["evidence"]),
        proposer: proposer_of(by),
        score: v["score"].as_f64(),
        shared: text(v, "shared"),
        mailbox: text(v, "mailbox"),
        persons: (persons.len() == 2).then_some(persons)?,
    })
}

/// Identities an agent says are not this person, waiting for the owner: `unlink` moves them to one new person,
/// `unmerge` undoes `merge`. It names one person, never a pair, so it is never read as a match.
#[derive(Serialize, Debug, PartialEq)]
pub struct Split {
    pub id: String,
    pub person: String,
    /// `unlink` or `unmerge`.
    pub op: String,
    pub identities: Vec<String>,
    pub merge: Option<String>,
    pub reason: Option<String>,
    pub evidence: Vec<String>,
    pub proposer: Option<Proposer>,
}

fn proposer_of(by: &Value) -> Option<Proposer> {
    by.is_object().then(|| Proposer {
        kind: text(by, "kind").or_else(|| text(by, "type")).unwrap_or_else(|| "person".into()),
        name: text(by, "name"),
    })
}

fn split_row(v: &Value) -> Option<Split> {
    if v["kind"].as_str() != Some("identity_split") {
        return None;
    }
    Some(Split {
        id: number(&v["id"])?,
        person: person_of(&v["person"])?,
        op: text(v, "split")?,
        identities: strings(&v["identities"]),
        merge: text(v, "merge"),
        reason: text(v, "reason"),
        evidence: strings(&v["evidence"]),
        proposer: proposer_of(&v["proposed_by"]),
    })
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Read {
    Missing,
    /// The installed memo lacks the commands the page needs; the page offers its update instead.
    #[serde(rename_all = "camelCase")]
    Old {
        version: Option<String>,
        need: String,
    },
    /// `*_more`: memo has more than the page read; the page says so instead of implying it showed everyone.
    #[serde(rename_all = "camelCase")]
    Ready {
        people: Vec<Listed>,
        people_more: bool,
        matches: Vec<Match>,
        matches_more: bool,
        /// Splits an agent proposed, from the same review read as the matches.
        splits: Vec<Split>,
        /// memo lists one kind at a time; false from a memo older than kinds, which lists everyone.
        kinded: bool,
    },
}

type Joined<'a> = std::thread::ScopedJoinHandle<'a, Result<Value, String>>;

fn joined(h: Joined<'_>) -> Result<Value, String> {
    h.join().unwrap_or_else(|_| Err("a read stopped".into()))
}

/// A kind's total; `more` when memo gave only a floor (`relation` other than `eq`), which the tab shows as "N+".
#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct KindCount {
    pub value: u64,
    pub more: bool,
}

/// Each kind's total, from a one-row page of each; a kind memo gives no total for (in a group, or an older memo) is left
/// out. Two at a time: memo keeps two servers, and the list must not wait behind the counts for a third.
fn counts_with(call: &Call) -> BTreeMap<String, KindCount> {
    let count = |k: &str| {
        let total = &call(&words(&["people", "list", &format!("kind:{k}"), "--limit", "1"])).ok()?["page"]["total"];
        Some(KindCount { value: total["value"].as_u64()?, more: total["relation"].as_str().is_some_and(|r| r != "eq") })
    };
    KINDS
        .chunks(2)
        .flat_map(|pair| {
            std::thread::scope(|s| {
                let asked: Vec<_> = pair.iter().map(|k| (*k, s.spawn(move || count(k)))).collect();
                asked.into_iter().filter_map(|(k, h)| Some((k.to_string(), h.join().ok()??))).collect::<Vec<_>>()
            })
        })
        .collect()
}

fn read_with(call: &Call, kind: &str) -> Result<Read, String> {
    let kind = KINDS.iter().find(|k| **k == kind).copied().unwrap_or("person");
    let (people, matches) = std::thread::scope(|s| {
        let m = s.spawn(|| call(&words(&["people", "review", "--limit", MATCH_LIMIT])));
        let asked = format!("kind:{kind}");
        // The table reads its rows a page at a time (`page`); this one row tells a memo with kinds from one without.
        let people = match call(&words(&["people", "list", &asked, "--limit", "1"])) {
            Err(e) if OLDER.contains(&e.as_str()) => {
                call(&words(&["people", "list", "--limit", LIST_LIMIT])).map(|v| (v, false))
            }
            Err(e) if e == UNKNOWN_KIND && kind == "stranger" => {
                Ok((json!({"items": [], "page": {"has_more": false}}), true))
            }
            r => r.map(|v| (v, true)),
        };
        (people, joined(m))
    });
    let ((people, kinded), matches) = (people?, matches?);
    let more = |v: &Value| v["page"]["has_more"].as_bool().unwrap_or(false);
    Ok(Read::Ready {
        people: list(&people, "items", listed),
        people_more: more(&people),
        matches: list(&matches, "items", matched),
        matches_more: more(&matches),
        splits: list(&matches, "items", split_row),
        kinded,
    })
}

/// One page of one kind of people, as memo sorts them; `total` is memo's count of everyone the page is cut from.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub people: Vec<Listed>,
    pub total: Option<KindCount>,
    pub more: bool,
}

/// The orders memo's `people list --sort` takes, each in its one direction.
const SORTS: [&str; 4] = ["interactions", "recent", "name", "tasks"];
const MAX_PAGE: u32 = 200;
const MAX_QUERY: usize = 100;

fn page_args(kind: &str, page: u32, size: u32, query: &str, sort: &str) -> Result<Vec<String>, String> {
    let kind = KINDS.iter().find(|k| **k == kind).ok_or("not a kind of people")?;
    let sort = SORTS.iter().find(|s| **s == sort).ok_or("not an order memo sorts people by")?;
    if page == 0 || !(1..=MAX_PAGE).contains(&size) {
        return Err(format!("a page is 1 to {MAX_PAGE} people, from page 1"));
    }
    let query = query.trim();
    if query.chars().count() > MAX_QUERY || query.chars().any(char::is_control) {
        return Err(format!("a name to look for is at most {MAX_QUERY} characters on one line"));
    }
    let mut args = vec!["people".to_string(), "list".into(), format!("kind:{kind}")];
    if !query.is_empty() {
        args.push(format!("name:{}", serde_json::to_string(query).map_err(|e| e.to_string())?));
    }
    let (size, page) = (size.to_string(), page.to_string());
    args.extend(words(&["--sort", sort, "--limit", &size, "--page", &page]));
    Ok(args)
}

fn page_with(call: &Call, kind: &str, page: u32, size: u32, query: &str, sort: &str) -> Result<Page, String> {
    let v = match call(&page_args(kind, page, size, query, sort)?) {
        Err(e) if e == UNKNOWN_KIND && kind == "stranger" => json!({"items": [], "page": {"has_more": false}}),
        r => r?,
    };
    let total = &v["page"]["total"];
    Ok(Page {
        people: list(&v, "items", listed),
        total: total["value"]
            .as_u64()
            .map(|value| KindCount { value, more: total["relation"].as_str().is_some_and(|r| r != "eq") }),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
    })
}

/// One page of the list, read on its own: turning a page or searching never reads the matches again.
pub fn page(kind: &str, page: u32, size: u32, query: &str, sort: &str) -> Result<Page, String> {
    with_memo(|call| page_with(call, kind, page, size, query, sort))
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

pub(crate) fn with_memo<T>(f: impl FnOnce(&Call) -> Result<T, String>) -> Result<T, String> {
    let bin = tools::program(&memo()?.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args))
}

/// How many people memo holds of each kind, for the list's tabs; read apart from the list so it never waits on them.
pub fn kinds() -> Result<BTreeMap<String, KindCount>, String> {
    with_memo(|call| Ok(counts_with(call)))
}

pub fn read(kind: &str) -> Result<Read, String> {
    let tool = memo()?;
    let need = tool.people.as_ref().ok_or("Memo has no People commands in the catalog")?.min_version.clone();
    let state = tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(Read::Missing) };
    if too_old(first.version.as_deref(), &need) {
        return Ok(Read::Old { version: first.version.clone(), need });
    }
    with_memo(|call| read_with(call, kind))
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Seen {
    pub account: String,
    /// `personal` or `work`: the page badges each account so the owner sees which side of life saw it.
    pub scope: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    /// `<provider>:<id>`, as memo names it.
    #[serde(rename = "identity")]
    pub reference: String,
    pub provider: String,
    pub name: Option<String>,
    pub username: Option<String>,
    /// As this source gave them; absent before memo carries them on identities.
    pub phone: Option<String>,
    pub email: Option<String>,
    /// Every phone and address the source gave, `phone` and `email` among them, as a CRM contact holds several.
    pub phones: Vec<String>,
    pub emails: Vec<String>,
    pub seen_in: Vec<Seen>,
    /// How it was joined: `initial`, `manual`, `same-email`, `same-phone`, `proposal`, `unlink`, `undo-merge`…
    pub method: Option<String>,
    pub linked_at: Option<String>,
    /// It can be moved: its ref is one word memo can be handed back.
    pub movable: bool,
    /// A messenger bot; false until memo's `people show` carries `is_bot`.
    pub bot: bool,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Merge {
    /// `merge:<to>-<from>`, what Undo merge takes.
    pub id: String,
    pub from: String,
    pub identities: Vec<String>,
    pub method: Option<String>,
    pub at: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub display_name: Option<String>,
    /// The person asked for was merged away: memo answers with the person it is part of now, whose ref this is.
    pub merged_into: Option<String>,
    pub identities: Vec<Identity>,
    pub merges: Vec<Merge>,
    pub matches: Vec<Match>,
}

fn merge_word(s: &str) -> Option<&str> {
    let (to, from) = s.strip_prefix("merge:")?.split_once('-')?;
    let uid = |u: &str| !u.is_empty() && u.len() <= 15 && u.bytes().all(|b| b.is_ascii_digit());
    (uid(to) && uid(from)).then_some(s)
}

/// The list memo gives, else the one value an older memo gives, each once.
fn every(v: &Value, many: &str, one: &str) -> Vec<String> {
    let mut found: Vec<String> = text(v, one).into_iter().collect();
    for value in strings(&v[many]) {
        if !value.trim().is_empty() && !found.contains(&value) {
            found.push(value);
        }
    }
    found
}

fn identity(v: &Value) -> Option<Identity> {
    let id = text(v, "identity")?;
    Some(Identity {
        provider: id.split_once(':').map_or_else(|| id.clone(), |(p, _)| p.to_string()),
        movable: sendable(&id).is_some(),
        reference: id,
        name: text(v, "name"),
        username: text(v, "username"),
        phone: text(v, "phone"),
        email: text(v, "email"),
        phones: every(v, "phones", "phone"),
        emails: every(v, "emails", "email"),
        seen_in: list(v, "seen_in", |s| Some(Seen { account: id_text(&s["account"])?, scope: text(s, "scope") })),
        method: text(v, "method"),
        linked_at: text(v, "linked_at"),
        bot: v["is_bot"].as_bool().unwrap_or(false),
    })
}

fn merge(v: &Value) -> Option<Merge> {
    Some(Merge {
        id: text(v, "id").filter(|m| merge_word(m).is_some())?,
        from: person_of(&v["from"])?,
        identities: list(v, "identities", |i| Some(format!("{}:{}", text(i, "provider")?, id_text(&i["id"])?))),
        method: text(v, "method"),
        at: text(v, "at"),
    })
}

fn person(v: &Value) -> Option<Person> {
    let item = body(v);
    Some(Person {
        reference: person_of(&item["ref"])?,
        name: text(item, "name"),
        display_name: text(item, "display_name"),
        merged_into: person_of(&item["merged_into"]),
        identities: list(item, "identities", identity),
        merges: list(item, "merges", merge),
        matches: list(item, "matches", matched),
    })
}

fn show_with(call: &Call, who: &str) -> Result<Person, String> {
    person(&call(&words(&["people", "show", who]))?).ok_or_else(|| "Memo's answer did not describe the person".into())
}

pub fn show(reference: &str) -> Result<Person, String> {
    let reference = person_ref(reference)?;
    with_memo(|call| show_with(call, reference))
}

/// The person who has this account, found only by an exact match: memo picks the nearest name for a ref it does not
/// know exactly, and a search must never show someone else as the answer.
fn find_with(call: &Call, account: &str) -> Result<Option<Person>, String> {
    let account = account.trim();
    let asked = if account.contains(':') { account.to_string() } else { format!("email:{account}") };
    let sent = sendable(&asked).ok_or("Search for an account as <messenger>:<id> or an email address.")?;
    let found = match show_with(call, sent) {
        Ok(p) => p,
        Err(e) if e == "person.not-found" => return Ok(None),
        Err(e) => return Err(e),
    };
    let asked = asked.to_lowercase();
    let value = asked.split_once(':').map_or("", |(_, v)| v).trim_start_matches('@').to_string();
    let exact = found.identities.iter().any(|i| {
        i.reference.to_lowercase() == asked
            || (i.provider == asked.split(':').next().unwrap_or_default()
                && i.username.as_deref().is_some_and(|u| u.to_lowercase() == value))
    });
    Ok(exact.then_some(found))
}

pub fn find(account: &str) -> Result<Option<Person>, String> {
    with_memo(|call| find_with(call, account))
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Answer {
    /// The two are one person: memo joins them.
    Confirm,
    /// They are not: memo never proposes this pair again.
    Reject,
}

/// memo names this id under `decided`, or under `refused` with its reason.
fn decided(v: &Value, id: &str) -> Result<(), String> {
    let item = body(v);
    let named =
        |key: &str| item[key].as_array().into_iter().flatten().find(|d| number(&d["id"]).as_deref() == Some(id));
    if let Some(no) = named("refused") {
        return Err(text(no, "reason").or_else(|| text(no, "message")).unwrap_or_else(|| "Memo refused it".into()));
    }
    named("decided").map(|_| ()).ok_or_else(|| "Memo did not say it decided the match.".into())
}

/// A rejection needs a reason in memo; the owner's few words, kept on one line.
fn reason_word(reason: Option<&str>) -> Result<String, String> {
    let t = reason.unwrap_or_default().trim();
    if t.is_empty() || t.chars().count() > 500 || t.chars().any(char::is_control) {
        return Err("Say in a few words why they are not one person.".into());
    }
    Ok(format!("--reason={t}"))
}

/// A match id from the page decides only a match open on this person as memo shows them now, whatever names its
/// sides: after a merge the person the owner opened is not the one the match first named.
fn decide_with(call: &Call, reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Person, String> {
    let reference = person_ref(reference)?;
    let open = show_with(call, reference)?.matches.into_iter().any(|m| m.id == id);
    if !open {
        return Err("This match is not open on this person any more. Read again.".into());
    }
    let mut args = decision(&["review", if answer == Answer::Confirm { "confirm" } else { "reject" }, id]);
    if answer == Answer::Reject {
        args.push(reason_word(reason)?);
    }
    decided(&call(&args)?, id)?;
    show_with(call, reference)
}

pub fn decide(reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Person, String> {
    with_memo(|call| decide_with(call, reference, id, answer, reason))
}

/// The owner's answer to a split an agent proposed; a turn-down needs the owner's reason. Answers the person as memo
/// shows them after it.
fn decide_split_with(
    call: &Call,
    reference: &str,
    id: &str,
    answer: Answer,
    reason: Option<&str>,
) -> Result<Person, String> {
    let reference = person_ref(reference)?;
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err("Not a proposal memo listed. Read again.".into());
    }
    let why = match answer {
        Answer::Reject => {
            Some(reason_word(reason).map_err(|_| "Say in a few words why they belong together.".to_string())?)
        }
        Answer::Confirm => None,
    };
    // `people confirm` takes a match's id too, and both share one sequence: only a split listed on this person goes.
    let review = call(&words(&["people", "review", "--limit", MATCH_LIMIT]))?;
    if !list(&review, "items", split_row).iter().any(|s| s.id == id && s.person == reference) {
        return Err("This split is not open on this person any more. Read again.".into());
    }
    let mut args = decision(&["people", if answer == Answer::Confirm { "confirm" } else { "reject" }, id]);
    args.extend(why);
    decided(&call(&args)?, id)?;
    show_with(call, reference)
}

pub fn decide_split(reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Person, String> {
    with_memo(|call| decide_split_with(call, reference, id, answer, reason))
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Organization {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
}

/// What `people resolve … company` did: the mailbox went to `organization` and the two people stay apart, or memo's
/// refusal with its reason and words; `organizations` are the ones an ambiguous address could go to.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Resolved {
    Done { organization: Option<String>, mailbox: Option<String>, person: Person },
    Refused { reason: String, message: String, organizations: Vec<Organization> },
}

/// A memo before `people resolve`: the page asks for its update.
const OLD_MEMO: &str = "memo.old";

fn organization_ref(s: &str) -> Option<&str> {
    let id = s.strip_prefix("organization:")?;
    (!id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit())).then_some(s)
}

/// memo names the organizations an address matches only in its message: `2 organizations match acme.example
/// (organization:1, organization:2); name the one meant as a reference`.
fn named_organizations(message: &str) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for word in message.split(|c: char| !(c.is_ascii_alphanumeric() || c == ':')) {
        if let Some(r) = organization_ref(word).filter(|r| !found.iter().any(|f| f == r)) {
            found.push(r.to_string());
        }
    }
    found
}

fn company_name(name: Option<&str>) -> Result<Option<String>, String> {
    let Some(t) = name.map(str::trim).filter(|t| !t.is_empty()) else { return Ok(None) };
    if t.chars().count() > 200 || t.chars().any(char::is_control) {
        return Err("Name the company in one line.".into());
    }
    Ok(Some(format!("--name={t}")))
}

/// The owner says a shared mailbox is a company's: memo gives the address to that organization and turns the match
/// down, so the two people stay apart and are not suggested again on it.
fn resolve_with(
    call: &Call,
    reference: &str,
    id: &str,
    organization: Option<&str>,
    name: Option<&str>,
) -> Result<Resolved, String> {
    let reference = person_ref(reference)?;
    if number(&json!(id)).is_none() {
        return Err("Not a match memo listed. Read again.".into());
    }
    let organization = match organization {
        Some(o) => Some(organization_ref(o).ok_or("Not an organization memo listed.")?),
        None => None,
    };
    let name = company_name(name)?;
    // The pairs of one mailbox go one by one; one memo already closed is skipped, as memo says of a decided one.
    if !show_with(call, reference)?.matches.into_iter().any(|m| m.id == id) {
        let message = format!("{id} is not open on {reference} any more");
        return Ok(Resolved::Refused { reason: "proposal.wrong-state".into(), message, organizations: Vec::new() });
    }
    let mut args = decision(&["people", "resolve", id, "company"]);
    if let Some(o) = organization {
        args.insert(4, o.to_string());
    }
    args.extend(name);
    let v = call(&args)?;
    if let Some(reason) = v["error"]["reason"].as_str() {
        let message = text(&v["error"], "message").unwrap_or_default();
        let reason = if message.starts_with("unknown command") { OLD_MEMO } else { reason };
        let organizations = if reason == "organization.ambiguous" {
            named_organizations(&message)
                .into_iter()
                .map(|r| {
                    let name = call(&words(&["organizations", "show", &r])).ok().and_then(|o| text(body(&o), "name"));
                    Organization { reference: r, name }
                })
                .collect()
        } else {
            Vec::new()
        };
        return Ok(Resolved::Refused { reason: reason.to_string(), message, organizations });
    }
    let item = body(&v);
    Ok(Resolved::Done {
        organization: text(item, "organization"),
        mailbox: text(item, "mailbox"),
        person: show_with(call, reference)?,
    })
}

pub fn resolve(reference: &str, id: &str, organization: Option<&str>, name: Option<&str>) -> Result<Resolved, String> {
    with_memo(|call| resolve_with(call, reference, id, organization, name))
}

/// The memo move that would set a doubted person right; `None` from a memo that gives only the command line.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Move {
    Unmerge { merge: String },
    Unlink { identities: Vec<String> },
}

#[derive(Serialize, Debug, PartialEq)]
pub struct DoubtIdentity {
    pub identity: String,
    pub name: Option<String>,
}

/// A person whose identities may be wrongly joined, from `people links check`.
#[derive(Serialize, Debug, PartialEq)]
pub struct Doubt {
    pub person: String,
    pub name: Option<String>,
    pub owner: bool,
    /// `owner-other-name`, `test-data`, `shared-address` or `mixed-names`; a newer memo may add one.
    pub reason: String,
    pub identities: Vec<DoubtIdentity>,
    pub moves: Vec<Move>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Doubts {
    pub items: Vec<Doubt>,
    /// Absent in a group, where memo cannot count without naming people outside it.
    pub total: Option<u64>,
    pub more: bool,
}

fn move_of(v: &Value) -> Option<Move> {
    match v["op"].as_str()? {
        "unmerge" => Some(Move::Unmerge { merge: merge_word(v["merge"].as_str()?).map(|_| text(v, "merge"))?? }),
        "unlink" => Some(Move::Unlink { identities: strings(&v["identities"]) }),
        _ => None,
    }
}

fn doubt(v: &Value) -> Option<Doubt> {
    Some(Doubt {
        person: person_of(&v["person"])?,
        name: text(v, "name"),
        owner: v["owner"].as_bool().unwrap_or(false),
        reason: text(v, "reason")?,
        identities: v["identities"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|i| Some(DoubtIdentity { identity: text(i, "identity")?, name: text(i, "name") }))
            .collect(),
        moves: list(v, "moves", move_of),
    })
}

const MAX_DOUBTS: u32 = 50;

fn doubts_with(call: &Call, page: u32, size: u32) -> Result<Doubts, String> {
    if page == 0 || page > MAX_PAGE || size == 0 || size > MAX_DOUBTS {
        return Err("Not a page memo can give.".into());
    }
    let v = call(&words(&["people", "links", "check", "--limit", &size.to_string(), "--page", &page.to_string()]))?;
    Ok(Doubts {
        items: list(&v, "items", doubt),
        total: v["page"]["total"]["value"].as_u64(),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
    })
}

/// People that look wrongly joined, a page at a time, the owner first.
pub fn doubts(page: u32, size: u32) -> Result<Doubts, String> {
    with_memo(|call| doubts_with(call, page, size))
}

/// The accounts in doubt the owner says belong together; memo then stops listing the person until one of them moves.
#[derive(Serialize, Debug, PartialEq)]
pub struct Kept {
    pub person: String,
    pub kept: Vec<String>,
}

fn keep_with(call: &Call, reference: &str) -> Result<Kept, String> {
    let reference = person_ref(reference)?;
    let v = call(&decision(&["people", "links", "resolve", reference, "keep"]))
        .map_err(|e| if e.contains("unknown command") { KEEP_TOO_OLD.to_string() } else { e })?;
    let item = body(&v);
    Ok(Kept {
        person: person_of(&item["person"]).unwrap_or_else(|| reference.to_string()),
        kept: strings(&item["kept"]),
    })
}

pub fn keep(reference: &str) -> Result<Kept, String> {
    with_memo(|call| keep_with(call, reference))
}

fn test_data_with(call: &Call, reference: &str) -> Result<(), String> {
    let reference = person_ref(reference)?;
    call(&decision(&["people", "links", "resolve", reference, "test"]))
        .map_err(|e| if e.contains("unknown command") { KEEP_TOO_OLD.to_string() } else { e })?;
    Ok(())
}

/// The owner says a person is test data: memo hides them from every list until the owner keeps them.
pub fn test_data(reference: &str) -> Result<(), String> {
    with_memo(|call| test_data_with(call, reference))
}

/// A person memo hides as test data.
#[derive(Serialize, Debug, PartialEq)]
pub struct TestPerson {
    pub person: String,
    pub name: Option<String>,
}

/// The people memo hides as test data: the first page of them, and how many there are.
#[derive(Serialize, Debug, PartialEq)]
pub struct TestPeople {
    pub items: Vec<TestPerson>,
    pub total: u64,
}

const TEST_PAGE: &str = "50";

fn test_people_with(call: &Call) -> Result<TestPeople, String> {
    let v = match call(&words(&["people", "list", "kind:test", "--limit", TEST_PAGE])) {
        Err(e) if e == UNKNOWN_KIND || OLDER.contains(&e.as_str()) => {
            return Ok(TestPeople { items: vec![], total: 0 });
        }
        r => r?,
    };
    let items: Vec<TestPerson> = list(&v, "items", |p| {
        Some(TestPerson { person: person_of(&p["ref"])?, name: text(p, "display_name").or_else(|| text(p, "name")) })
    });
    let total = v["page"]["total"]["value"].as_u64().unwrap_or(items.len() as u64);
    Ok(TestPeople { items, total })
}

/// The people memo hides as test data, for the line under «Check the links».
pub fn test_people() -> Result<TestPeople, String> {
    with_memo(test_people_with)
}

/// The owner says a person writes from a company's shared mailbox: memo records them as the organization's contact.
/// The address stays the organization's; memo has no link between a person and one address.
fn contact_with(call: &Call, reference: &str, organization: &str) -> Result<(), String> {
    let reference = person_ref(reference)?;
    let organization = organization_ref(organization).ok_or("Not an organization memo listed.")?;
    let v = call(&decision(&["relationships", "add", reference, organization, "--role", "contact"]))?;
    match v["error"]["message"].as_str() {
        Some(message) => Err(message.to_string()),
        None => Ok(()),
    }
}

pub fn contact(reference: &str, organization: &str) -> Result<(), String> {
    with_memo(|call| contact_with(call, reference, organization))
}

/// What joining a group did: the person they are now, the people joined and the matches memo confirmed so far, and why
/// it stopped, if it did.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Merged {
    pub person: Person,
    pub joined: Vec<String>,
    pub confirmed: Vec<String>,
    pub stopped: Option<String>,
}

const NO_PAIR: &str = "No open match joins them any more. Read again.";

/// Joins the chosen people of one group into one, a match at a time. Each step takes any chosen person with an open
/// match to the person kept so far, found by its two people and not by an id: each confirm makes memo fold the group's
/// other pairs into one, so the ids the page read go stale, and a pair the owner rejected before is routed around. A
/// failure after the first join is reported with what was joined, because those joins stay done.
fn merge_with(call: &Call, chosen: &[String]) -> Result<Merged, String> {
    let mut refs: Vec<&str> = Vec::new();
    for c in chosen {
        let r = person_ref(c)?;
        if !refs.contains(&r) {
            refs.push(r);
        }
    }
    let [first, rest @ ..] = refs.as_slice() else {
        return Err("Choose at least two people to join.".into());
    };
    if rest.is_empty() {
        return Err("Choose at least two people to join.".into());
    }
    let mut kept = show_with(call, first)?;
    let mut left = Vec::new();
    for r in rest {
        left.push((*r, show_with(call, r)?.reference));
    }
    let mut joined = vec![(*first).to_string()];
    let mut confirmed: Vec<String> = Vec::new();
    let stop = |kept: Person, joined: Vec<String>, confirmed: Vec<String>, why: String| {
        if confirmed.is_empty() { Err(why) } else { Ok(Merged { person: kept, joined, confirmed, stopped: Some(why) }) }
    };
    while !left.is_empty() {
        let between = |now: &String| {
            kept.matches.iter().find(|m| {
                m.joins.as_deref() != Some("identity") && m.persons.contains(&kept.reference) && m.persons.contains(now)
            })
        };
        let next = left.iter().position(|(_, now)| *now == kept.reference).map(|i| (i, None)).or_else(|| {
            left.iter().enumerate().find_map(|(i, (_, now))| between(now).map(|m| (i, Some(m.id.clone()))))
        });
        let Some((i, id)) = next else {
            return stop(kept, joined, confirmed, NO_PAIR.into());
        };
        let (who, _) = left.remove(i);
        let Some(id) = id else {
            joined.push(who.to_string());
            continue;
        };
        if let Err(e) = call(&decision(&["review", "confirm", &id])).and_then(|v| decided(&v, &id)) {
            return stop(kept, joined, confirmed, e);
        }
        confirmed.push(id);
        joined.push(who.to_string());
        match show_with(call, &kept.reference) {
            Ok(person) => kept = person,
            Err(e) => return stop(kept, joined, confirmed, e),
        }
    }
    Ok(Merged { person: kept, joined, confirmed, stopped: None })
}

pub fn join_group(chosen: &[String]) -> Result<Merged, String> {
    with_memo(|call| merge_with(call, chosen))
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Unlinked {
    /// The person as it is now, without the moved accounts.
    pub person: Person,
    /// The person the moved accounts now belong to.
    pub moved_to: String,
}

/// Only identities the person's own read listed reach `people unlink`: memo matches a name it does not know exactly to
/// the nearest person, which here would move someone else's account.
fn unlink_with(call: &Call, reference: &str, chosen: &[String]) -> Result<Unlinked, String> {
    let reference = person_ref(reference)?;
    let mut chosen: Vec<&str> = chosen.iter().map(String::as_str).collect();
    chosen.sort_unstable();
    chosen.dedup();
    let shown = show_with(call, reference)?;
    if chosen.is_empty() || chosen.len() >= shown.identities.len() {
        return Err("Choose some of this person's accounts to move, not all of them.".into());
    }
    let held = |c: &str| shown.identities.iter().any(|i| i.reference == c && i.movable);
    if chosen.iter().any(|c| !held(c) || sendable(c).is_none()) {
        return Err("Choose only accounts this person has. Read again.".into());
    }
    let mut args = vec!["people", "unlink"];
    args.extend(chosen);
    args.extend(["--from", reference]);
    let moved = person(&call(&decision(&args))?).ok_or("Memo's answer did not describe the new person")?;
    Ok(Unlinked { person: show_with(call, reference)?, moved_to: moved.reference })
}

pub fn unlink(reference: &str, chosen: &[String]) -> Result<Unlinked, String> {
    with_memo(|call| unlink_with(call, reference, chosen))
}

fn unmerge_with(call: &Call, reference: &str, merge_id: &str) -> Result<Person, String> {
    let reference = person_ref(reference)?;
    let shown = show_with(call, reference)?;
    if merge_word(merge_id).is_none() || !shown.merges.iter().any(|m| m.id == merge_id) {
        return Err("This merge is not on this person any more. Read again.".into());
    }
    person(&call(&decision(&["people", "unmerge", merge_id]))?).ok_or("Memo's answer did not describe the person")?;
    show_with(call, reference)
}

pub fn unmerge(reference: &str, merge_id: &str) -> Result<Person, String> {
    with_memo(|call| unmerge_with(call, reference, merge_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    // Real answers of cli-memo #748 on a throwaway store; see tests/fixtures/people/README.md.
    fn fixture(name: &str) -> Value {
        let text = match name {
            "list" => include_str!("../tests/fixtures/people/list.json"),
            "review" => include_str!("../tests/fixtures/people/review.json"),
            "show" => include_str!("../tests/fixtures/people/show.json"),
            "show-moved" => include_str!("../tests/fixtures/people/show-moved.json"),
            "confirm" => include_str!("../tests/fixtures/people/confirm.json"),
            "reject" => include_str!("../tests/fixtures/people/reject.json"),
            "refused" => include_str!("../tests/fixtures/people/refused.json"),
            "stale" => include_str!("../tests/fixtures/people/stale.json"),
            "unlink" => include_str!("../tests/fixtures/people/unlink.json"),
            "unmerge" => include_str!("../tests/fixtures/people/unmerge.json"),
            "review-split" => include_str!("../tests/fixtures/people/review-split.json"),
            "links-check" => include_str!("../tests/fixtures/people/links-check.json"),
            "split-confirm" => include_str!("../tests/fixtures/people/split-confirm.json"),
            _ => panic!("no fixture {name}"),
        };
        serde_json::from_str(text).unwrap()
    }

    /// memo by its first two words; a decision answers with `decided` as set.
    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        decided: &'static str,
    }

    impl Fake {
        fn new(decided: &'static str) -> Fake {
            Fake { seen: Mutex::new(Vec::new()), decided }
        }
        fn call(&self, a: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(a.to_vec());
            match (a[0].as_str(), a[1].as_str()) {
                ("people", "list") => Ok(fixture("list")),
                ("people", "review") => Ok(fixture("review")),
                ("people", "show") if a[2].starts_with("person:") => Ok(fixture("show")),
                ("people", "show") => Err("person.not-found".into()),
                ("people", "unlink") => Ok(fixture("unlink")),
                ("people", "unmerge") => Ok(fixture("unmerge")),
                _ => Ok(fixture(self.decided)),
            }
        }
        fn seen(&self) -> Vec<Vec<String>> {
            self.seen.lock().unwrap().clone()
        }
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn a_match_carries_memos_score_and_its_shared_mailbox() {
        let v = json!({"id": "7", "persons": ["person:1", "person:2"], "signal": "email", "score": 0.82,
            "shared": "role", "mailbox": "info@acme.example", "candidates": [], "evidence": []});
        let m = matched(&v).unwrap();
        assert_eq!(
            (m.score, m.shared.as_deref(), m.mailbox.as_deref()),
            (Some(0.82), Some("role"), Some("info@acme.example"))
        );
        let old = matched(&fixture("review")["items"][0]).unwrap();
        assert_eq!((old.score, old.shared, old.mailbox), (None, None, None));
    }

    fn resolving(answer: Value) -> (Fake, impl Fn(&[String]) -> Option<Value>) {
        let f = Fake::new("confirm");
        let reply = move |a: &[String]| match (a[0].as_str(), a[1].as_str()) {
            ("people", "resolve") => Some(answer.clone()),
            ("organizations", "show") => Some(json!({"item": {"ref": a[2], "name": format!("Acme {}", &a[2][13..])}})),
            _ => None,
        };
        (f, reply)
    }

    #[test]
    fn a_shared_mailbox_goes_to_a_company_with_memos_own_words() {
        let done = json!({"item": {"id": "3", "kind": "identity_link", "status": "rejected",
            "mailbox": "info@acme.example", "organization": "organization:4"}});
        let (f, reply) = resolving(done);
        let call = |a: &[String]| reply(a).map_or_else(|| f.call(a), Ok);
        let Resolved::Done { organization, mailbox, person } =
            resolve_with(&call, "person:8", "3", Some("organization:4"), Some(" Acme ")).unwrap()
        else {
            panic!("not done")
        };
        assert_eq!((organization.as_deref(), mailbox.as_deref()), (Some("organization:4"), Some("info@acme.example")));
        assert_eq!(person.reference, "person:8");
        assert!(f.seen().iter().any(|a| a.first().map(String::as_str) == Some("people") && a[1] == "show"));
        assert!(resolve_with(&call, "person:8", "3", Some("person:4"), None).is_err());
        let closed = resolve_with(&call, "person:8", "9", None, None).unwrap();
        assert!(matches!(closed, Resolved::Refused { ref reason, .. } if reason == "proposal.wrong-state"));
    }

    #[test]
    fn sends_the_organization_before_the_options_and_the_name_as_one_word() {
        let seen = Mutex::new(Vec::new());
        let f = Fake::new("confirm");
        let call = |a: &[String]| {
            if a[1] == "resolve" {
                seen.lock().unwrap().push(a.to_vec());
                return Ok(json!({"item": {"mailbox": "info@acme.example", "organization": "organization:4"}}));
            }
            f.call(a)
        };
        resolve_with(&call, "person:8", "3", Some("organization:4"), None).unwrap();
        resolve_with(&call, "person:8", "3", None, Some("Acme Ltd")).unwrap();
        let seen = seen.into_inner().unwrap();
        let tail = ["--from-app", "--json", "--no-record"];
        assert_eq!(seen[0], strs(&[&["people", "resolve", "3", "company", "organization:4"][..], &tail].concat()));
        assert_eq!(seen[1], strs(&[&["people", "resolve", "3", "company"][..], &tail, &["--name=Acme Ltd"]].concat()));
    }

    #[test]
    fn an_ambiguous_company_comes_back_with_the_organizations_to_pick_from() {
        let refused = json!({"error": {"code": "validation_error", "reason": "organization.ambiguous",
            "message": "2 organizations match acme.example (organization:1, organization:12); name the one meant as a reference"}});
        let (f, reply) = resolving(refused);
        let call = |a: &[String]| reply(a).map_or_else(|| f.call(a), Ok);
        let Resolved::Refused { reason, message, organizations } =
            resolve_with(&call, "person:8", "3", None, None).unwrap()
        else {
            panic!("not refused")
        };
        assert_eq!(reason, "organization.ambiguous");
        assert!(message.contains("organization:12"));
        assert_eq!(
            organizations,
            [
                Organization { reference: "organization:1".into(), name: Some("Acme 1".into()) },
                Organization { reference: "organization:12".into(), name: Some("Acme 12".into()) },
            ]
        );
        let unnamed =
            json!({"error": {"reason": "organization.unnamed", "message": "info@gmail.com is a free mailbox"}});
        let (f, reply) = resolving(unnamed);
        let call = |a: &[String]| reply(a).map_or_else(|| f.call(a), Ok);
        let r = resolve_with(&call, "person:8", "3", None, None).unwrap();
        assert!(matches!(r, Resolved::Refused { ref reason, ref organizations, .. }
            if reason == "organization.unnamed" && organizations.is_empty()));
        let (f, reply) =
            resolving(json!({"error": {"reason": "input.invalid", "message": "unknown command 'resolve'"}}));
        let call = |a: &[String]| reply(a).map_or_else(|| f.call(a), Ok);
        let r = resolve_with(&call, "person:8", "3", None, None).unwrap();
        assert!(matches!(r, Resolved::Refused { ref reason, .. } if reason == OLD_MEMO));
    }

    #[test]
    fn only_a_resolve_gets_memos_refusal_back_whole() {
        let out = run::Output {
            code: Some(2),
            stdout: r#"{"error":{"reason":"organization.unnamed","message":"a free mailbox"}}"#.into(),
            stderr: String::new(),
        };
        assert_eq!(answer(&out, false, true).unwrap()["error"]["reason"], "organization.unnamed");
        assert!(answer(&out, false, false).is_err());
    }

    #[test]
    fn a_split_is_never_read_as_a_match_and_keeps_its_own_row() {
        let call = |a: &[String]| -> Result<Value, String> {
            Ok(if a[1] == "review" { fixture("review-split") } else { fixture("list") })
        };
        let Read::Ready { matches, splits, .. } = read_with(&call, "person").unwrap() else { panic!() };
        assert_eq!(matches.len(), 1);
        assert_eq!(splits.len(), 2);
        assert_eq!(splits[0].person, "person:3");
        assert_eq!(splits[0].op, "unlink");
        assert_eq!(splits[0].identities, ["phone:+447700900188", "seed:demo/contact/mila"]);
        assert_eq!(splits[0].proposer, Some(Proposer { kind: "agent".into(), name: Some("claude-code".into()) }));
        assert_eq!(splits[1].merge.as_deref(), Some("merge:3-2"));
    }

    #[test]
    fn a_split_is_decided_by_the_owner_with_peoples_own_commands() {
        let f = Fake::new("split-confirm");
        let listed = |a: &[String]| if a[1] == "review" { Ok(fixture("review-split")) } else { f.call(a) };
        decide_split_with(&listed, "person:3", "1", Answer::Confirm, None).unwrap();
        assert_eq!(f.seen()[0], strs(&["people", "confirm", "1", "--from-app", "--json", "--no-record"]));
        let gone = decide_split_with(&listed, "person:8", "1", Answer::Confirm, None).unwrap_err();
        assert!(gone.contains("not open"), "{gone}");
        assert!(decide_split_with(&listed, "person:3", "5", Answer::Confirm, None).is_err(), "a match id is no split");

        let r = Fake::new("split-confirm");
        let listed = |a: &[String]| if a[1] == "review" { Ok(fixture("review-split")) } else { r.call(a) };
        let no = decide_split_with(&listed, "person:3", "1", Answer::Reject, Some("  ")).unwrap_err();
        assert!(no.contains("belong together"), "{no}");
        assert!(r.seen().is_empty(), "nothing is sent without a reason");
        assert!(decide_split_with(&listed, "person:3", "1 --yes", Answer::Confirm, None).is_err());
        decide_split_with(&listed, "person:3", "1", Answer::Reject, Some("one man")).unwrap();
        assert_eq!(
            r.seen()[0],
            strs(&["people", "reject", "1", "--from-app", "--json", "--no-record", "--reason=one man"])
        );
    }

    #[test]
    fn keeping_a_person_passes_from_app_and_names_an_older_memo() {
        let call = |args: &[String]| {
            assert_eq!(args[..5], ["people", "links", "resolve", "person:7", "keep"]);
            assert!(args.iter().any(|a| a == FROM_APP));
            Ok(json!({"item": {"person": "person:7", "kept": ["email:a@b.c"]}}))
        };
        assert_eq!(
            keep_with(&call, "person:7").unwrap(),
            Kept { person: "person:7".into(), kept: vec!["email:a@b.c".into()] }
        );
        let old = |_: &[String]| Err("unknown command 'resolve'".to_string());
        assert_eq!(keep_with(&old, "person:7").unwrap_err(), KEEP_TOO_OLD);
        let refused = |_: &[String]| Err("person.no-doubt".to_string());
        assert_eq!(keep_with(&refused, "person:7").unwrap_err(), "person.no-doubt");
        assert!(keep_with(&refused, "--help").is_err());
    }

    #[test]
    fn calling_a_person_test_data_passes_from_app_and_names_an_older_memo() {
        let call = |args: &[String]| {
            assert_eq!(args[..5], ["people", "links", "resolve", "person:7", "test"]);
            assert!(args.iter().any(|a| a == FROM_APP));
            Ok(json!({"item": {"person": "person:7", "identities": ["email:a@b.test"]}}))
        };
        assert_eq!(test_data_with(&call, "person:7"), Ok(()));
        let old = |_: &[String]| Err("unknown command 'resolve'".to_string());
        assert_eq!(test_data_with(&old, "person:7").unwrap_err(), KEEP_TOO_OLD);
        assert!(test_data_with(&call, "--help").is_err());
    }

    #[test]
    fn hidden_test_people_are_read_and_an_older_memo_hides_none() {
        let call = |args: &[String]| {
            assert_eq!(args[..3], ["people", "list", "kind:test"]);
            Ok(json!({"items": [{"ref": "person:9", "name": null, "display_name": "Ann Lee"}],
                "page": {"total": {"value": 3, "relation": "eq"}}}))
        };
        assert_eq!(
            test_people_with(&call).unwrap(),
            TestPeople {
                items: vec![TestPerson { person: "person:9".into(), name: Some("Ann Lee".into()) }],
                total: 3
            }
        );
        let old = |_: &[String]| Err(UNKNOWN_KIND.to_string());
        assert_eq!(test_people_with(&old).unwrap(), TestPeople { items: vec![], total: 0 });
    }

    #[test]
    fn an_identity_lists_every_phone_and_address() {
        let v = json!({"identity": "bitrix24:p.example/contact/7", "phone": "+34600000001",
            "phones": ["+34600000001", "+34600000002"], "email": "a@b.test", "seen_in": []});
        let i = identity(&v).unwrap();
        assert_eq!(i.phones, ["+34600000001", "+34600000002"]);
        assert_eq!(i.emails, ["a@b.test"]);
    }

    #[test]
    fn a_person_who_writes_from_a_mailbox_becomes_the_organizations_contact() {
        let f = Fake::new("confirm");
        let call = |a: &[String]| f.call(a);
        contact_with(&call, "person:7", "organization:4").unwrap();
        assert_eq!(
            f.seen(),
            vec![strs(&[
                "relationships",
                "add",
                "person:7",
                "organization:4",
                "--role",
                "contact",
                "--from-app",
                "--json",
                "--no-record"
            ])]
        );
        assert!(contact_with(&call, "person:7", "--help").is_err());
        assert!(contact_with(&call, "--role", "organization:4").is_err());
        let refused = |_: &[String]| Ok(json!({"error": {"message": "no organization:4"}}));
        assert_eq!(contact_with(&refused, "person:7", "organization:4").unwrap_err(), "no organization:4");
    }

    #[test]
    fn doubts_carry_their_moves_and_memos_total_and_skip_an_unknown_move() {
        let seen = Mutex::new(Vec::new());
        let call = |a: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(a.to_vec());
            Ok(fixture("links-check"))
        };
        let d = doubts_with(&call, 2, 10).unwrap();
        assert_eq!(
            seen.lock().unwrap()[0],
            strs(&["people", "links", "check", "--limit", "10", "--page", "2", "--json", "--no-record"])
        );
        assert_eq!((d.total, d.more, d.items.len()), (Some(2), true, 2));
        assert_eq!(d.items[0].reason, "mixed-names");
        assert_eq!(d.items[0].moves.len(), 0);
        assert_eq!(
            d.items[1].moves,
            [
                Move::Unmerge { merge: "merge:4-7".into() },
                Move::Unlink { identities: vec!["seed:demo/contact/olga s".into()] }
            ]
        );
        assert!(doubts_with(&call, 0, 10).is_err());
        assert!(doubts_with(&call, 1, 500).is_err());
    }

    #[test]
    fn a_listed_person_keeps_memos_task_count() {
        let p = listed(&json!({ "ref": "person:7", "name": "Lena", "owner": false, "tasks": 3 })).unwrap();
        assert_eq!(p.tasks, 3);
    }

    #[test]
    fn reads_everyone_and_the_matches_with_whether_memo_has_more() {
        let f = Fake::new("confirm");
        let Read::Ready { people, people_more, matches, matches_more, .. } =
            read_with(&|a: &[String]| f.call(a), "person").unwrap()
        else {
            panic!()
        };
        assert_eq!(
            people[0],
            Listed {
                reference: "person:1".into(),
                owner: true,
                kind: Some("person".into()),
                messages_from: Some(0),
                ..Listed::default()
            }
        );
        assert!(!people_more && !matches_more);
        let agent = &matches[0];
        assert_eq!(agent.persons, ["person:8", "person:3"]);
        assert_eq!(agent.joins.as_deref(), Some("person"));
        assert_eq!(agent.signal.as_deref(), Some("agent"));
        assert_eq!(agent.proposer, Some(Proposer { kind: "agent".into(), name: Some("claude-code".into()) }));
        assert_eq!(matches[1].proposer.as_ref().map(|p| p.kind.as_str()), Some("rule"));
        assert_eq!(matches[1].candidates.len(), 3);
        assert!(f.seen().iter().all(|a| !a.contains(&FROM_APP.to_string())), "a read never says the owner decided");
    }

    #[test]
    fn lists_one_kind_by_interactions_with_every_kinds_total() {
        let seen = Mutex::new(Vec::new());
        let call = |a: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(a.to_vec());
            if a[1] == "review" {
                return Ok(fixture("review"));
            }
            let total = match a[2].as_str() {
                "kind:person" => 1240,
                "kind:organization" => 87,
                "kind:automated" => 412,
                "kind:stranger" => {
                    return Ok(json!({"items": [], "page": {"total": {"value": 5000, "relation": "gte"}}}));
                }
                _ => return Ok(json!({"items": [], "page": {"has_more": true}})),
            };
            Ok(json!({"items": [{
                "ref": "person:12", "name": "\"Kai Sample \"", "display_name": "Kai Sample", "kind": "person",
                "owner": false, "tasks": 2, "contact": "+34600000001", "messages_from": 314,
                "last_contact": "2026-11-08T10:12:00.000Z"
            }], "page": {"has_more": true, "total": {"value": total, "relation": "eq"}}}))
        };
        let Read::Ready { people, kinded, .. } = read_with(&call, "organization").unwrap() else { panic!() };
        assert!(kinded);
        let kinds = counts_with(&call);
        assert_eq!(kinds.get("person"), Some(&KindCount { value: 1240, more: false }));
        assert_eq!(kinds.get("automated"), Some(&KindCount { value: 412, more: false }));
        assert_eq!(kinds.get("stranger"), Some(&KindCount { value: 5000, more: true }), "a floor reads N+");
        assert_eq!(kinds.get("unsorted"), None, "no total, no count");
        assert_eq!(people[0].display_name.as_deref(), Some("Kai Sample"));
        assert_eq!(people[0].contact.as_deref(), Some("+34600000001"));
        assert_eq!(people[0].messages_from, Some(314));
        let asked = seen.lock().unwrap().clone();
        assert!(asked.contains(&words(&["people", "list", "kind:organization", "--limit", "1"])));
        assert_eq!(read_with(&call, "nonsense").map(|_| ()), Ok(()));
        assert!(
            seen.lock().unwrap().iter().all(|a| !a.iter().any(|w| w.contains("nonsense"))),
            "an unknown kind is person"
        );
    }

    #[test]
    fn reads_one_page_of_one_kind_with_memos_total_and_the_name_as_one_word() {
        let seen = Mutex::new(Vec::new());
        let call = |a: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(a.to_vec());
            Ok(json!({"items": [{
                "ref": "person:12", "name": "Kai Sample", "owner": false, "tasks": 0, "contact": "+34600000001",
                "phone": "+34600000001", "email": "kai@example.com", "username": "@kai_s", "username_source": "telegram"
            }], "page": {"has_more": true, "next_page": 3, "total": {"value": 1240, "relation": "eq"}}}))
        };
        let page = page_with(&call, "organization", 2, 50, "  kai \"s\" ", "recent").unwrap();
        assert_eq!(page.total, Some(KindCount { value: 1240, more: false }));
        assert!(page.more);
        let kai = &page.people[0];
        assert_eq!(
            (kai.phone.as_deref(), kai.email.as_deref(), kai.username.as_deref()),
            (Some("+34600000001"), Some("kai@example.com"), Some("kai_s"))
        );
        assert_eq!(kai.username_source.as_deref(), Some("telegram"));
        assert_eq!(
            seen.lock().unwrap()[0],
            strs(&[
                "people",
                "list",
                "kind:organization",
                r#"name:"kai \"s\"""#,
                "--sort",
                "recent",
                "--limit",
                "50",
                "--page",
                "2",
                "--json",
                "--no-record"
            ])
        );
        page_with(&call, "person", 1, 50, "", "interactions").unwrap();
        assert!(!seen.lock().unwrap()[1].iter().any(|w| w.starts_with("name:")), "no name, no term");
    }

    #[test]
    fn a_page_refuses_what_memo_should_never_be_asked() {
        let call = |_: &[String]| -> Result<Value, String> { panic!("memo is never asked") };
        assert!(page_with(&call, "everyone", 1, 50, "", "interactions").is_err());
        assert!(page_with(&call, "person", 1, 50, "", "--all").is_err());
        assert!(page_with(&call, "person", 0, 50, "", "interactions").is_err());
        assert!(page_with(&call, "person", 1, 5000, "", "interactions").is_err());
        assert!(page_with(&call, "person", 1, 50, "a\nb", "interactions").is_err());
        assert!(page_with(&call, "person", 1, 50, &"x".repeat(101), "interactions").is_err());
    }

    #[test]
    fn an_older_memo_without_kinds_is_read_the_old_way() {
        let older = |a: &[String]| -> Result<Value, String> {
            match (a[1].as_str(), a.get(2).map(String::as_str)) {
                ("review", _) => Ok(fixture("review")),
                ("list", Some(k)) if k.starts_with("kind:") => Err("query.unknown-field".into()),
                _ => {
                    let mut v = fixture("list");
                    for p in v["items"].as_array_mut().unwrap() {
                        p.as_object_mut()
                            .unwrap()
                            .retain(|k, _| ["ref", "name", "owner", "tasks"].contains(&k.as_str()));
                    }
                    Ok(v)
                }
            }
        };
        let Read::Ready { people, kinded, .. } = read_with(&older, "person").unwrap() else { panic!() };
        assert!(!kinded);
        assert!(counts_with(&older).is_empty());
        assert_eq!(people[0].kind, None);
        let out = run::Output {
            code: Some(2),
            stdout: json!({"error": {"code": "validation_error", "reason": "input.invalid", "message": "unknown option '--sort'"}}).to_string(),
            stderr: String::new(),
        };
        assert_eq!(answer(&out, true, false), Err("input.invalid".into()));
        assert_ne!(answer(&out, false, false), Err("input.invalid".into()), "a decision keeps memo's words");
    }

    #[test]
    fn a_kind_memo_does_not_know_yet_is_an_empty_tab() {
        let no_strangers = |a: &[String]| -> Result<Value, String> {
            match (a[1].as_str(), a.get(2).map(String::as_str)) {
                ("review", _) => Ok(fixture("review")),
                ("list", Some("kind:stranger")) => Err(UNKNOWN_KIND.into()),
                _ => Ok(fixture("list")),
            }
        };
        let Read::Ready { people, kinded, .. } = read_with(&no_strangers, "stranger").unwrap() else { panic!() };
        assert!(people.is_empty() && kinded);
        assert!(!counts_with(&no_strangers).contains_key("stranger"));
        let out = run::Output {
            code: Some(2),
            stdout:
                json!({"error": {"code": "validation_error", "reason": UNKNOWN_KIND, "message": "kind takes person"}})
                    .to_string(),
            stderr: String::new(),
        };
        assert_eq!(answer(&out, true, false), Err(UNKNOWN_KIND.into()));
    }

    #[test]
    fn says_when_memo_has_more_people_or_matches_than_were_read() {
        let more = |a: &[String]| -> Result<Value, String> {
            let mut v = if a[1] == "list" { fixture("list") } else { fixture("review") };
            v["page"]["has_more"] = json!(true);
            Ok(v)
        };
        let Read::Ready { people_more, matches_more, .. } = read_with(&more, "person").unwrap() else { panic!() };
        assert!(people_more && matches_more);
    }

    #[test]
    fn a_proposer_without_a_name_is_a_person_not_memos_matching() {
        let mut row = fixture("review")["items"][0].clone();
        row["proposed_by"] = json!({"type":"person","id":"1"});
        assert_eq!(matched(&row).unwrap().proposer, Some(Proposer { kind: "person".into(), name: None }));
    }

    #[test]
    fn shows_every_identity_and_marks_which_can_be_moved() {
        let mut v = fixture("show");
        v["item"]["identities"][0]["identity"] = json!("crm:acct 88");
        let p = person(&v).unwrap();
        assert_eq!(p.identities.len(), 3, "an identity that cannot be sent back is still shown");
        assert!(!p.identities[0].movable);
        assert!(p.identities[1].movable);
        assert_eq!(p.identities[2].seen_in[0], Seen { account: "1".into(), scope: Some("personal".into()) });
        assert_eq!(p.merges[0].from, "person:4");
        assert_eq!(p.merges[0].identities, ["telegram:55"]);
        assert_eq!(person(&fixture("show-moved")).unwrap().merged_into.as_deref(), Some("person:2"));
        let shown = json!({"item": {"ref": "person:2", "name": "null #9", "display_name": "Kai"}});
        assert_eq!(person(&shown).unwrap().display_name.as_deref(), Some("Kai"));
        for bad in ["-max:1", "1max:1", "max:a b", "max:", "Max:1"] {
            assert!(sendable(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn a_refusal_memo_exits_2_with_is_its_reason_not_raw_output() {
        for (fixture_name, reason) in [("stale", "identity.stale"), ("refused", "proposal.wrong-state")] {
            let out = run::Output { code: Some(2), stdout: fixture(fixture_name).to_string(), stderr: String::new() };
            let v = answer(&out, false, false).unwrap();
            let id = body(&v)["refused"][0]["id"].as_str().unwrap().to_string();
            assert_eq!(decided(&v, &id), Err(reason.to_string()));
        }
        assert_eq!(decided(&fixture("confirm"), "4"), Ok(()));
        let broken = run::Output { code: Some(1), stdout: "not json".into(), stderr: "boom".into() };
        assert_eq!(answer(&broken, false, false), Err("boom".into()));
    }

    #[test]
    fn decides_only_a_match_open_on_the_person_as_memo_shows_them_now() {
        let f = Fake::new("confirm");
        let call = |a: &[String]| f.call(a);
        assert!(decide_with(&call, "person:8", "4", Answer::Confirm, None).is_err(), "not open on person:8");
        assert!(f.seen().iter().all(|a| a[1] == "show"), "nothing was decided");
        let confirmed = Fake::new("confirm");
        let err = decide_with(&|a: &[String]| confirmed.call(a), "person:8", "3", Answer::Confirm, None).unwrap_err();
        assert!(err.contains("did not say"), "{err}: the fixture decided 4, not 3");
        let stale = Fake::new("stale");
        let err = decide_with(&|a: &[String]| stale.call(a), "person:8", "3", Answer::Confirm, None).unwrap_err();
        assert_eq!(err, "identity.stale");
        assert_eq!(stale.seen()[1], strs(&["review", "confirm", "3", "--from-app", "--json", "--no-record"]));
    }

    #[test]
    fn a_rejection_carries_the_owners_reason_as_one_word() {
        let seen: Mutex<Vec<Vec<String>>> = Mutex::new(Vec::new());
        let call = |a: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(a.to_vec());
            if a[0] != "review" {
                return Ok(fixture("show"));
            }
            let mut v = fixture("reject");
            v["item"]["decided"][0]["id"] = json!("3");
            Ok(v)
        };
        decide_with(&call, "person:8", "3", Answer::Reject, Some("-two Anas")).unwrap();
        assert_eq!(
            seen.lock().unwrap()[1],
            strs(&["review", "reject", "3", "--from-app", "--json", "--no-record", "--reason=-two Anas"])
        );
        assert!(decide_with(&call, "person:8", "3", Answer::Reject, Some("  ")).is_err());
    }

    #[test]
    fn unlinks_only_movable_accounts_the_person_has_once_each_and_never_all() {
        let f = Fake::new("confirm");
        let call = |a: &[String]| f.call(a);
        let done = unlink_with(&call, "person:8", &strs(&["max:99", "max:99"])).unwrap();
        assert_eq!(done.moved_to, "person:11");
        assert_eq!(
            f.seen()[1],
            strs(&["people", "unlink", "max:99", "--from", "person:8", "--from-app", "--json", "--no-record"])
        );
        for bad in [vec!["telegram:Lena"], vec!["max:66", "max:99", "telegram:55"], vec![]] {
            let before = f.seen().len();
            assert!(unlink_with(&call, "person:8", &strs(&bad)).is_err(), "{bad:?}");
            assert!(f.seen()[before..].iter().all(|a| a[1] == "show"), "nothing was unlinked for {bad:?}");
        }
    }

    #[test]
    fn undoes_only_a_merge_the_person_shows() {
        let f = Fake::new("confirm");
        let call = |a: &[String]| f.call(a);
        unmerge_with(&call, "person:8", "merge:8-4").unwrap();
        assert_eq!(f.seen()[1], strs(&["people", "unmerge", "merge:8-4", "--from-app", "--json", "--no-record"]));
        assert!(unmerge_with(&call, "person:8", "merge:8-13").is_err());
        assert!(unmerge_with(&call, "person:8", "--all").is_err());
    }

    #[test]
    fn finds_a_person_only_by_an_account_they_really_have() {
        let f = Fake::new("confirm");
        let found = |account: &str, shown: &'static str| {
            let call =
                |a: &[String]| -> Result<Value, String> { if a[1] == "show" { Ok(fixture(shown)) } else { f.call(a) } };
            find_with(&call, account)
        };
        assert_eq!(found("max:99", "show").unwrap().unwrap().reference, "person:8");
        assert!(found("max:9", "show").unwrap().is_none(), "memo's nearest guess is not an answer");
        assert!(found("lena@example.org", "show").unwrap().is_none());
        let none = |a: &[String]| f.call(a);
        assert!(find_with(&none, "telegram:404").unwrap().is_none());
        assert!(find_with(&none, "max:a b").is_err());
    }

    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        let v = serde_json::to_value(person(&fixture("show")).unwrap()).unwrap();
        assert_eq!(v["identities"][0]["seenIn"][0], json!({"account":"2","scope":"personal"}));
        assert_eq!(v["identities"][0]["movable"], json!(true));
        assert_eq!(v["mergedInto"], Value::Null);
        assert_eq!(v["matches"][0]["proposer"], json!({"kind":"rule","name":"rule"}));
        let answers: Vec<Answer> = serde_json::from_value(json!(["confirm", "reject"])).unwrap();
        assert_eq!(answers, [Answer::Confirm, Answer::Reject]);
    }

    #[test]
    fn needs_the_catalogs_memo() {
        let tool = catalog::tool("memo").unwrap();
        let need = &tool.people.as_ref().unwrap().min_version;
        assert!(too_old(Some("0.131.64"), need));
        assert!(!too_old(Some(need), need));
    }

    /// memo on one group of three that share a phone: each confirm joins the pair into its second person and folds the
    /// pairs left into one per pair, the lowest id kept, as cli-core's `settleLinks` does.
    struct Group {
        merged: Mutex<Vec<(u32, u32)>>,
        open: Mutex<Vec<(u32, u32, u32)>>,
        seen: Mutex<Vec<Vec<String>>>,
        refuse: Option<u32>,
    }

    impl Group {
        fn new(refuse: Option<u32>) -> Group {
            Group::with(refuse, vec![(10, 1, 2), (11, 1, 3), (12, 2, 3)])
        }
        fn with(refuse: Option<u32>, open: Vec<(u32, u32, u32)>) -> Group {
            Group { merged: Mutex::new(Vec::new()), open: Mutex::new(open), seen: Mutex::new(Vec::new()), refuse }
        }
        fn now(&self, mut p: u32) -> u32 {
            let merged = self.merged.lock().unwrap();
            while let Some(&(_, into)) = merged.iter().find(|(from, _)| *from == p) {
                p = into;
            }
            p
        }
        #[allow(clippy::unnecessary_wraps, reason = "it stands in for memo's call, which can fail")]
        fn call(&self, a: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(a.to_vec());
            if a[0] == "review" {
                let id: u32 = a[2].parse().unwrap();
                if self.refuse == Some(id) {
                    return Ok(json!({"item": {"decided": [], "refused": [{"id": a[2], "reason": "identity.stale"}]}}));
                }
                let (_, from, to) = *self.open.lock().unwrap().iter().find(|m| m.0 == id).unwrap();
                let pair = (self.now(from), self.now(to));
                self.merged.lock().unwrap().push(pair);
                let mut kept: Vec<(u32, u32, u32)> = Vec::new();
                let open = self.open.lock().unwrap().clone();
                for (id, a, b) in open {
                    let (a, b) = (self.now(a), self.now(b));
                    if a != b && !kept.iter().any(|k| (k.1, k.2) == (a, b) || (k.1, k.2) == (b, a)) {
                        kept.push((id, a, b));
                    }
                }
                *self.open.lock().unwrap() = kept;
                return Ok(json!({"item": {"decided": [{"id": a[2]}], "refused": []}}));
            }
            let asked: u32 = a[2].trim_start_matches("person:").parse().unwrap();
            let p = self.now(asked);
            let matches: Vec<Value> = self
                .open
                .lock()
                .unwrap()
                .iter()
                .filter(|m| m.1 == p || m.2 == p)
                .map(|m| json!({"id": m.0.to_string(), "persons": [format!("person:{}", m.1), format!("person:{}", m.2)], "joins": "person", "signal": "phone"}))
                .collect();
            Ok(
                json!({"item": {"ref": format!("person:{p}"), "merged_into": (p != asked).then(|| format!("person:{p}")), "identities": [], "merges": [], "matches": matches}}),
            )
        }
        fn confirmed(&self) -> Vec<String> {
            self.seen.lock().unwrap().iter().filter(|a| a[0] == "review").map(|a| a[2].clone()).collect()
        }
    }

    #[test]
    fn joins_all_three_of_a_group_by_the_pair_left_open_after_each_join() {
        let g = Group::new(None);
        let merged = merge_with(&|a: &[String]| g.call(a), &strs(&["person:1", "person:2", "person:3"])).unwrap();
        assert_eq!(merged.joined, ["person:1", "person:2", "person:3"]);
        assert_eq!(merged.confirmed, ["10", "11"]);
        assert_eq!(merged.stopped, None);
        assert_eq!(merged.person.reference, "person:3");
        assert_eq!(g.confirmed(), ["10", "11"], "the pair 1–3 became 2–3 and kept its id; 12 was folded away");
        assert!(g.seen.lock().unwrap().iter().filter(|a| a[0] == "review").all(|a| a.contains(&FROM_APP.to_string())));
    }

    #[test]
    fn routes_around_a_pair_with_no_open_match() {
        let g = Group::with(None, vec![(11, 1, 3), (12, 2, 3)]);
        let merged = merge_with(&|a: &[String]| g.call(a), &strs(&["person:1", "person:2", "person:3"])).unwrap();
        assert_eq!(merged.joined, ["person:1", "person:3", "person:2"]);
        assert_eq!(merged.stopped, None);
        let apart = Group::with(None, vec![(11, 1, 3), (12, 2, 3)]);
        let err = merge_with(&|a: &[String]| apart.call(a), &strs(&["person:1", "person:2"])).unwrap_err();
        assert_eq!(err, NO_PAIR, "nothing joins 1 and 2 without 3");
    }

    #[test]
    fn joins_two_of_three_and_leaves_the_third_open() {
        let g = Group::new(None);
        let merged = merge_with(&|a: &[String]| g.call(a), &strs(&["person:1", "person:3"])).unwrap();
        assert_eq!(merged.joined, ["person:1", "person:3"]);
        assert_eq!(g.confirmed(), ["11"]);
        assert_eq!(merged.person.matches.len(), 1, "person:2 still waits as one match");
    }

    #[test]
    fn a_refusal_after_the_first_join_says_what_was_joined() {
        let g = Group::new(Some(11));
        let call = |a: &[String]| g.call(a);
        let merged = merge_with(&call, &strs(&["person:1", "person:2", "person:3"])).unwrap();
        assert_eq!(merged.joined, ["person:1", "person:2"]);
        assert_eq!(merged.stopped.as_deref(), Some("identity.stale"));
        let first = Group::new(Some(10));
        assert_eq!(
            merge_with(&|a: &[String]| first.call(a), &strs(&["person:1", "person:2"])).unwrap_err(),
            "identity.stale"
        );
        for one in [strs(&["person:1"]), strs(&["person:1", "person:1"]), strs(&["person:1", "max:2"])] {
            assert!(merge_with(&call, &one).is_err(), "{one:?}");
        }
    }

    #[test]
    fn marks_a_bot_by_memo_s_bot_signal_and_an_account_by_is_bot() {
        let row = listed(&json!({"ref": "person:4", "kind": "automated", "kind_signals": ["bot"]})).unwrap();
        assert!(row.bot);
        assert!(!listed(&json!({"ref": "person:5", "kind_signals": ["added"]})).unwrap().bot);
        assert!(identity(&json!({"identity": "telegram:7", "is_bot": true})).unwrap().bot);
        assert!(!identity(&json!({"identity": "telegram:8"})).unwrap().bot);
    }
}
