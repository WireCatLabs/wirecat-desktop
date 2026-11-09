//! The People page: who is who across sources, through memo's own `people` and `review` commands. Names, addresses and
//! account ids are the owner's own data on the owner's own page, shown unmasked like the Memory page, never logged.
//! Every decision is the owner's: it passes `--from-app`, and memo refuses an agent the same moves.

use crate::catalog::{self, Tool};
use crate::skills::{body, failure, too_old};
use crate::{run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_mins(1);
const LIST_LIMIT: &str = "5000";
const MATCH_LIMIT: &str = "500";
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// The app starts memo with no terminal, which memo takes as nobody's run; this says the owner decided here.
const FROM_APP: &str = "--from-app";
/// memo's own refusals the page words in the owner's language.
const WORDED: [&str; 4] = ["identity.stale", "identity.owner-only", "person.not-found", "proposal.wrong-state"];

type Call<'a> = dyn Fn(&[String]) -> Result<Value, String> + Sync + 'a;

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn decision(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(std::iter::once(&FROM_APP)).chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

/// memo answers a refused review decision with exit code 2 and the whole answer on stdout: it goes back as an answer,
/// so `decided` names memo's reason, rather than as the last line of its output.
fn answer(out: &run::Output) -> Result<Value, String> {
    let json = out.json();
    let reason = json.as_ref().and_then(|v| v["error"]["reason"].as_str()).unwrap_or_default();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        Some(v) if v.get("error").is_none() && body(&v)["refused"].is_array() => Ok(v),
        Some(_) if WORDED.contains(&reason) => Err(reason.to_string()),
        j => Err(failure(out, j.as_ref())),
    }
}

fn call_at(bin: &Path, args: &[String]) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    answer(&crate::memo_server::run(bin, &refs, TIMEOUT).map_err(|e| e.to_string())?)
}

fn text(v: &Value, key: &str) -> Option<String> {
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
fn person_ref(s: &str) -> Result<&str, String> {
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

#[derive(Serialize, Debug, PartialEq)]
pub struct Listed {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub owner: bool,
    pub tasks: u64,
}

fn listed(v: &Value) -> Option<Listed> {
    Some(Listed {
        reference: person_of(&v["ref"])?,
        name: text(v, "name"),
        owner: v["owner"].as_bool().unwrap_or(false),
        tasks: v["tasks"].as_u64().unwrap_or(0),
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
        proposer: by.is_object().then(|| Proposer {
            kind: text(by, "kind").or_else(|| text(by, "type")).unwrap_or_else(|| "person".into()),
            name: text(by, "name"),
        }),
        persons: (persons.len() == 2).then_some(persons)?,
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
    },
}

fn read_with(call: &Call) -> Result<Read, String> {
    let (people, matches) = std::thread::scope(|s| {
        let p = s.spawn(|| call(&words(&["people", "list", "--limit", LIST_LIMIT])));
        let m = s.spawn(|| call(&words(&["people", "review", "--limit", MATCH_LIMIT])));
        let joined =
            |h: std::thread::ScopedJoinHandle<'_, _>| h.join().unwrap_or_else(|_| Err("a read stopped".into()));
        (joined(p), joined(m))
    });
    let (people, matches) = (people?, matches?);
    let more = |v: &Value| v["page"]["has_more"].as_bool().unwrap_or(false);
    Ok(Read::Ready {
        people: list(&people, "items", listed),
        people_more: more(&people),
        matches: list(&matches, "items", matched),
        matches_more: more(&matches),
    })
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

fn with_memo<T>(f: impl FnOnce(&Call) -> Result<T, String>) -> Result<T, String> {
    let bin = tools::program(&memo()?.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args))
}

pub fn read() -> Result<Read, String> {
    let tool = memo()?;
    let need = tool.people.as_ref().ok_or("Memo has no People commands in the catalog")?.min_version.clone();
    let state = tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(Read::Missing) };
    if too_old(first.version.as_deref(), &need) {
        return Ok(Read::Old { version: first.version.clone(), need });
    }
    with_memo(read_with)
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
    pub seen_in: Vec<Seen>,
    /// How it was joined: `initial`, `manual`, `same-email`, `same-phone`, `proposal`, `unlink`, `undo-merge`…
    pub method: Option<String>,
    pub linked_at: Option<String>,
    /// It can be moved: its ref is one word memo can be handed back.
    pub movable: bool,
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

fn identity(v: &Value) -> Option<Identity> {
    let id = text(v, "identity")?;
    Some(Identity {
        provider: id.split_once(':').map_or_else(|| id.clone(), |(p, _)| p.to_string()),
        movable: sendable(&id).is_some(),
        reference: id,
        name: text(v, "name"),
        username: text(v, "username"),
        seen_in: list(v, "seen_in", |s| Some(Seen { account: id_text(&s["account"])?, scope: text(s, "scope") })),
        method: text(v, "method"),
        linked_at: text(v, "linked_at"),
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
    fn a_listed_person_keeps_memos_task_count() {
        let p = listed(&json!({ "ref": "person:7", "name": "Lena", "owner": false, "tasks": 3 })).unwrap();
        assert_eq!(p.tasks, 3);
    }

    #[test]
    fn reads_everyone_and_the_matches_with_whether_memo_has_more() {
        let f = Fake::new("confirm");
        let Read::Ready { people, people_more, matches, matches_more } = read_with(&|a: &[String]| f.call(a)).unwrap()
        else {
            panic!()
        };
        assert_eq!(people[0], Listed { reference: "person:1".into(), name: None, owner: true, tasks: 0 });
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
    fn says_when_memo_has_more_people_or_matches_than_were_read() {
        let more = |a: &[String]| -> Result<Value, String> {
            let mut v = if a[1] == "list" { fixture("list") } else { fixture("review") };
            v["page"]["has_more"] = json!(true);
            Ok(v)
        };
        let Read::Ready { people_more, matches_more, .. } = read_with(&more).unwrap() else { panic!() };
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
        for bad in ["-max:1", "1max:1", "max:a b", "max:", "Max:1"] {
            assert!(sendable(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn a_refusal_memo_exits_2_with_is_its_reason_not_raw_output() {
        for (fixture_name, reason) in [("stale", "identity.stale"), ("refused", "proposal.wrong-state")] {
            let out = run::Output { code: Some(2), stdout: fixture(fixture_name).to_string(), stderr: String::new() };
            let v = answer(&out).unwrap();
            let id = body(&v)["refused"][0]["id"].as_str().unwrap().to_string();
            assert_eq!(decided(&v, &id), Err(reason.to_string()));
        }
        assert_eq!(decided(&fixture("confirm"), "4"), Ok(()));
        let broken = run::Output { code: Some(1), stdout: "not json".into(), stderr: "boom".into() };
        assert_eq!(answer(&broken), Err("boom".into()));
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
        assert_eq!(f.seen()[1], strs(&["people", "unlink", "max:99", "--from-app", "--json", "--no-record"]));
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
}
