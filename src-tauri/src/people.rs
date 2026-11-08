//! The People page: who is who across sources, through memo's own `people` and `review` commands. Names, addresses and
//! account ids are the owner's own data on the owner's own page, shown unmasked like the Memory page, never logged.
//! Every decision is the owner's: it passes `--from-app`, and memo refuses an agent the same moves.

use crate::catalog::{self, Tool};
use crate::skills::{body, failure, too_old};
use crate::{paths, run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_mins(1);
const LIST_LIMIT: &str = "5000";
const MATCH_LIMIT: &str = "50";
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// The app starts memo with no terminal, which memo takes as nobody's run; this says the owner decided here.
const FROM_APP: &str = "--from-app";
const IDENTITY_LINK: &str = "identity_link";
/// memo's own refusals the page words in the owner's language.
const WORDED: [&str; 3] = ["identity.stale", "identity.owner-only", "person.not-found"];

type Call<'a> = dyn Fn(&[String]) -> Result<Value, String> + Sync + 'a;

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn decision(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(std::iter::once(&FROM_APP)).chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn call_at(bin: &Path, args: &[String]) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(bin, &refs, Some(&paths::search_path()), TIMEOUT).map_err(|e| e.to_string())?;
    let json = out.json();
    let reason = json.as_ref().and_then(|v| v["error"]["reason"].as_str()).unwrap_or_default();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        Some(_) if WORDED.contains(&reason) => Err(reason.to_string()),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn number(v: &Value) -> Option<String> {
    let id = match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => return None,
    };
    (!id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit())).then_some(id)
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array().map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default()
}

/// `person:<uid>`, the only way the page names a person to memo.
fn person_ref(s: &str) -> Result<&str, String> {
    let uid = s.strip_prefix("person:").unwrap_or_default();
    if uid.is_empty() || uid.len() > 15 || uid.starts_with('0') || !uid.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not a person: {s}"));
    }
    Ok(s)
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
        reference: text(v, "ref").filter(|r| person_ref(r).is_ok())?,
        name: text(v, "name"),
        owner: v["owner"].as_bool().unwrap_or(false),
        tasks: v["tasks"].as_u64().unwrap_or(0),
    })
}

/// Two people memo thinks may be one, waiting for the owner.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub id: String,
    pub persons: Vec<String>,
    pub summary: Option<String>,
    pub reason: Option<String>,
    pub evidence: Vec<String>,
    /// The agent's or program's name; `None` for a match memo's own scan found.
    pub proposed_by: Option<String>,
    pub created_at: Option<String>,
}

fn matched(v: &Value) -> Option<Match> {
    let persons: Vec<String> = strings(&v["persons"]).into_iter().filter(|p| person_ref(p).is_ok()).collect();
    Some(Match {
        id: number(&v["id"])?,
        summary: text(v, "summary"),
        reason: text(v, "reason"),
        evidence: strings(&v["evidence"]),
        proposed_by: text(&v["proposed_by"], "name").or_else(|| text(v, "proposed_by")),
        created_at: text(v, "created_at"),
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
    Ready {
        people: Vec<Listed>,
        matches: Vec<Match>,
    },
}

fn read_with(call: &Call) -> Result<Read, String> {
    let (people, matches) = std::thread::scope(|s| {
        let p = s.spawn(|| call(&words(&["people", "list", "--limit", LIST_LIMIT])));
        let m = s.spawn(|| call(&words(&["people", "review", "--limit", MATCH_LIMIT])));
        let stopped = |_| Err("a read stopped".to_string());
        (p.join().unwrap_or_else(stopped), m.join().unwrap_or_else(|_| Err("a read stopped".to_string())))
    });
    let (people, matches) = (people?, matches?);
    Ok(Read::Ready { people: items(&people, listed), matches: items(&matches, matched) })
}

fn items<T>(v: &Value, parse: fn(&Value) -> Option<T>) -> Vec<T> {
    v["items"].as_array().into_iter().flatten().filter_map(parse).collect()
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
    /// `<provider>:<id>`, as memo names it; the page sends back only refs a person's own read listed.
    #[serde(rename = "identity")]
    pub reference: String,
    pub provider: String,
    pub name: Option<String>,
    pub username: Option<String>,
    pub seen_in: Vec<Seen>,
    /// How it was joined: `manual`, `same-email`, `account`…
    pub method: Option<String>,
    pub linked_by: Option<String>,
    pub linked_at: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct MergedIdentity {
    pub identity: String,
    pub name: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Merge {
    /// `merge:<to>-<from>`, what Undo merge takes.
    pub id: String,
    pub from: String,
    pub identities: Vec<MergedIdentity>,
    pub method: Option<String>,
    pub by: Option<String>,
    pub at: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    /// The person asked for was merged away into this one.
    pub merged_into: Option<String>,
    pub identities: Vec<Identity>,
    pub merges: Vec<Merge>,
    pub matches: Vec<Match>,
}

/// An identity ref memo printed goes back into a command line, so it must read as one word that is not an option.
fn identity_word(s: &str) -> Option<&str> {
    let (provider, id) = s.split_once(':')?;
    let named =
        !provider.is_empty() && provider.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    (named && !id.is_empty() && s.len() <= 400 && !s.chars().any(|c| c.is_whitespace() || c.is_control())).then_some(s)
}

fn merge_word(s: &str) -> Option<&str> {
    let (to, from) = s.strip_prefix("merge:")?.split_once('-')?;
    let uid = |u: &str| !u.is_empty() && u.len() <= 15 && u.bytes().all(|b| b.is_ascii_digit());
    (uid(to) && uid(from)).then_some(s)
}

fn identity(v: &Value) -> Option<Identity> {
    let id = text(v, "identity").filter(|i| identity_word(i).is_some())?;
    Some(Identity {
        provider: id.split_once(':').map(|(p, _)| p.to_string())?,
        reference: id,
        name: text(v, "name"),
        username: text(v, "username"),
        seen_in: v["seen_in"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|s| Some(Seen { account: text(s, "account")?, scope: text(s, "scope") }))
            .collect(),
        method: text(v, "method"),
        linked_by: text(v, "linked_by"),
        linked_at: text(v, "linked_at"),
    })
}

fn merge(v: &Value) -> Option<Merge> {
    Some(Merge {
        id: text(v, "id").filter(|m| merge_word(m).is_some())?,
        from: text(v, "from").map(|f| if f.starts_with("person:") { f } else { format!("person:{f}") })?,
        identities: v["identities"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|i| {
                let provider = text(i, "provider")?;
                let id = match &i["id"] {
                    Value::String(s) => s.clone(),
                    Value::Number(n) => n.to_string(),
                    _ => return None,
                };
                Some(MergedIdentity { identity: format!("{provider}:{id}"), name: text(i, "name") })
            })
            .collect(),
        method: text(v, "method"),
        by: text(v, "by"),
        at: text(v, "at"),
    })
}

fn person(v: &Value) -> Option<Person> {
    let item = body(v);
    let list = |key: &str| item[key].as_array().cloned().unwrap_or_default();
    Some(Person {
        reference: text(item, "ref").filter(|r| person_ref(r).is_ok())?,
        name: text(item, "name"),
        merged_into: text(item, "merged_into"),
        identities: list("identities").iter().filter_map(identity).collect(),
        merges: list("merges").iter().filter_map(merge).collect(),
        matches: list("matches").iter().filter_map(matched).collect(),
    })
}

fn show_with(call: &Call, reference: &str) -> Result<Person, String> {
    person(&call(&words(&["people", "show", person_ref(reference)?]))?)
        .ok_or_else(|| "Memo's answer did not describe the person".into())
}

pub fn show(reference: &str) -> Result<Person, String> {
    with_memo(|call| show_with(call, reference))
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Answer {
    /// The two are one person: memo joins them.
    Confirm,
    /// They are not: memo never proposes this pair again.
    Reject,
}

/// A match id from the page decides only an open `identity_link` about this person, never some other proposal.
fn open_match(call: &Call, reference: &str, id: &str) -> Result<(), String> {
    let id = number(&Value::String(id.into())).ok_or_else(|| format!("not a match: {id}"))?;
    let v = call(&words(&["review", "show", &id]))?;
    let item = body(&v);
    let about = [text(item, "subject"), text(item, "object")];
    if text(item, "kind").as_deref() != Some(IDENTITY_LINK) || !about.iter().any(|p| p.as_deref() == Some(reference)) {
        return Err("This match is not about this person any more. Read again.".into());
    }
    Ok(())
}

/// `review confirm` and `reject` decide each id on its own and exit 0 even when memo refused it, so the answer must
/// name this id as decided.
fn decided(v: &Value, id: &str) -> Result<(), String> {
    let item = body(v);
    let names = |key: &str| {
        item[key]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|d| number(&d["id"]).as_deref() == Some(id))
            .collect::<Vec<_>>()
    };
    if let Some(no) = names("refused").first() {
        return Err(text(no, "reason").or_else(|| text(no, "message")).unwrap_or_else(|| "Memo refused it".into()));
    }
    if names("decided").is_empty() {
        return Err("Memo did not say it decided the match.".into());
    }
    Ok(())
}

/// A rejection needs a reason in memo; the owner's few words, kept on one line.
fn reason_word(reason: Option<&str>) -> Result<String, String> {
    let t = reason.unwrap_or_default().trim();
    if t.is_empty() || t.chars().count() > 500 || t.chars().any(char::is_control) {
        return Err("Say in a few words why they are not one person.".into());
    }
    Ok(format!("--reason={t}"))
}

fn decide_with(call: &Call, reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Person, String> {
    let reference = person_ref(reference)?;
    open_match(call, reference, id)?;
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

/// Only identities the person's own read listed reach `people unlink`: memo matches a name it does not know exactly to
/// the nearest person, which here would move someone else's account.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Unlinked {
    /// The person as it is now, without the moved accounts.
    pub person: Person,
    /// The person the moved accounts now belong to.
    pub moved_to: String,
}

fn unlink_with(call: &Call, reference: &str, chosen: &[String]) -> Result<Unlinked, String> {
    let shown = show_with(call, reference)?;
    if chosen.is_empty() || chosen.len() >= shown.identities.len() {
        return Err("Choose some of this person's accounts to move, not all of them.".into());
    }
    let held: Vec<&str> = shown.identities.iter().map(|i| i.reference.as_str()).collect();
    if chosen.iter().any(|c| !held.contains(&c.as_str()) || identity_word(c).is_none()) {
        return Err("Choose only accounts this person has. Read again.".into());
    }
    let mut args = vec!["people", "unlink"];
    args.extend(chosen.iter().map(String::as_str));
    let moved = person(&call(&decision(&args))?).ok_or("Memo's answer did not describe the new person")?;
    Ok(Unlinked { person: show_with(call, reference)?, moved_to: moved.reference })
}

pub fn unlink(reference: &str, chosen: &[String]) -> Result<Unlinked, String> {
    with_memo(|call| unlink_with(call, reference, chosen))
}

fn unmerge_with(call: &Call, reference: &str, merge_id: &str) -> Result<Person, String> {
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

    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        decided: Value,
    }

    impl Fake {
        fn new(decided: Value) -> Fake {
            Fake { seen: Mutex::new(Vec::new()), decided }
        }
        #[expect(clippy::unnecessary_wraps, reason = "it stands in for a call to memo, which can fail")]
        fn call(&self, a: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(a.to_vec());
            Ok(match (a[0].as_str(), a[1].as_str()) {
                ("people", "list") => json!({"items":[
                    {"ref":"person:1","name":null,"owner":true,"tasks":4},
                    {"ref":"person:7","name":"Lena Ortiz","owner":false,"tasks":0},
                    {"ref":"--all","name":"x","owner":false,"tasks":0}]}),
                ("people", "review") => json!({"items":[match_row()]}),
                ("people", "show") => shown(),
                ("people", "unlink") => json!({"item":{"ref":"person:31","name":"Lena Ortiz","identities":[]}}),
                ("people", "unmerge") => json!({"item":{"ref":"person:7","name":"Lena Ortiz","identities":[]}}),
                ("review", "show") => {
                    json!({"item":{"id":"17100","kind":"identity_link","subject":"person:7","object":"person:9"}})
                }
                _ => self.decided.clone(),
            })
        }
        fn seen(&self) -> Vec<Vec<String>> {
            self.seen.lock().unwrap().clone()
        }
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    // `memo people review --json` from cli-memo #748 (`matchAnswer`), snake_cased.
    fn match_row() -> Value {
        json!({"id":"17100","persons":["person:7","person:9"],"summary":"telegram:Lena and email:lena@example.org",
            "reason":"the same phone, +34 600 000 000","evidence":["telegram:4411","email:lena@example.org"],
            "proposed_by":{"type":"bot","name":"memo"},"created_at":"2026-11-08T10:00:00.000Z"})
    }

    // `memo people show --json` from cli-memo #748 (`personAnswer` with merges and matches), snake_cased.
    fn shown() -> Value {
        json!({"item":{"ref":"person:7","name":"Lena Ortiz","identities":[
            {"identity":"telegram:4411","name":"Lena","username":"lena_o","seen_in":[{"account":"1","scope":"personal"}],
             "method":"account","linked_by":"memo","linked_at":"2026-10-01T10:00:00.000Z"},
            {"identity":"email:lena@example.org","name":"Lena Ortiz","username":null,
             "seen_in":[{"account":"2","scope":"work"},{"account":"3","scope":"personal"}],
             "method":"same-email","linked_by":"memo","linked_at":"2026-10-02T10:00:00.000Z"},
            {"identity":"crm:acct/88","name":"Lena O.","username":null,"seen_in":[],"method":"manual","linked_by":"owner",
             "linked_at":"2026-10-03T10:00:00.000Z"}],
            "merges":[{"id":"merge:7-12","from":"12","to":"7","identities":[{"provider":"email","id":"lena@example.org","name":"Lena Ortiz"}],
             "method":"same-email","by":"memo","at":"2026-10-02T10:00:00.000Z"}],
            "matches":[match_row()]}})
    }

    #[test]
    fn reads_everyone_and_the_matches_waiting_with_nothing_recorded() {
        let f = Fake::new(Value::Null);
        let Read::Ready { people, matches } = read_with(&|a: &[String]| f.call(a)).unwrap() else { panic!() };
        assert_eq!(people.iter().map(|p| p.reference.as_str()).collect::<Vec<_>>(), ["person:1", "person:7"]);
        assert!(people[0].owner);
        assert_eq!(matches[0].persons, ["person:7", "person:9"]);
        assert_eq!(matches[0].proposed_by.as_deref(), Some("memo"));
        let seen = f.seen();
        assert!(seen.contains(&strs(&["people", "list", "--limit", "5000", "--json", "--no-record"])));
        assert!(seen.iter().all(|a| !a.contains(&FROM_APP.to_string())), "a read never says the owner decided");
    }

    #[test]
    fn shows_identities_with_the_scope_of_every_account_and_the_merges() {
        let f = Fake::new(Value::Null);
        let p = show_with(&|a: &[String]| f.call(a), "person:7").unwrap();
        assert_eq!(p.identities.len(), 3);
        assert_eq!(p.identities[1].provider, "email");
        assert_eq!(p.identities[1].seen_in[0], Seen { account: "2".into(), scope: Some("work".into()) });
        assert_eq!(p.merges[0].id, "merge:7-12");
        assert_eq!(p.merges[0].from, "person:12");
        assert_eq!(p.merges[0].identities[0].identity, "email:lena@example.org");
        for bad in ["person:0", "person:7 ", "--json", "telegram:Lena"] {
            assert!(show_with(&|a: &[String]| f.call(a), bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn confirming_or_rejecting_a_match_is_the_owners_and_reads_the_person_again() {
        let f = Fake::new(
            json!({"item":{"decided":[{"id":"17100","kind":"identity_link","status":"confirmed"}],"refused":[]}}),
        );
        let call = |a: &[String]| f.call(a);
        decide_with(&call, "person:7", "17100", Answer::Confirm, None).unwrap();
        decide_with(&call, "person:7", "17100", Answer::Reject, Some("-two different Lenas")).unwrap();
        let seen = f.seen();
        assert_eq!(seen[0], strs(&["review", "show", "17100", "--json", "--no-record"]));
        assert_eq!(seen[1], strs(&["review", "confirm", "17100", "--from-app", "--json", "--no-record"]));
        assert_eq!(seen[2], strs(&["people", "show", "person:7", "--json", "--no-record"]));
        assert_eq!(
            seen[4],
            strs(&[
                "review",
                "reject",
                "17100",
                "--from-app",
                "--json",
                "--no-record",
                "--reason=-two different Lenas"
            ])
        );
        assert!(decide_with(&call, "person:7", "17100", Answer::Reject, Some("  ")).is_err());
    }

    #[test]
    fn a_match_about_someone_else_or_a_refused_or_silent_answer_is_a_failure() {
        let f = Fake::new(json!({"item":{"decided":[{"id":"17100"}],"refused":[]}}));
        assert!(decide_with(&|a: &[String]| f.call(a), "person:8", "17100", Answer::Confirm, None).is_err());
        assert!(f.seen().iter().all(|a| a[1] == "show"), "nothing was decided");
        let stale = Fake::new(json!({"item":{"decided":[],"refused":[{"id":"17100","reason":"identity.stale"}]}}));
        let err = decide_with(&|a: &[String]| stale.call(a), "person:7", "17100", Answer::Confirm, None).unwrap_err();
        assert_eq!(err, "identity.stale");
        let silent = Fake::new(json!({"item":{"decided":[],"refused":[]}}));
        assert!(decide_with(&|a: &[String]| silent.call(a), "person:7", "17100", Answer::Confirm, None).is_err());
    }

    #[test]
    fn unlinks_only_accounts_the_person_has_and_never_all_of_them() {
        let f = Fake::new(Value::Null);
        let call = |a: &[String]| f.call(a);
        let done = unlink_with(&call, "person:7", &strs(&["crm:acct/88"])).unwrap();
        assert_eq!(done.moved_to, "person:31");
        assert_eq!(f.seen()[1], strs(&["people", "unlink", "crm:acct/88", "--from-app", "--json", "--no-record"]));
        for bad in [vec!["telegram:Lena"], vec!["telegram:4411", "email:lena@example.org", "crm:acct/88"], vec![]] {
            let before = f.seen().len();
            assert!(unlink_with(&call, "person:7", &strs(&bad)).is_err(), "{bad:?}");
            assert!(f.seen()[before..].iter().all(|a| a[1] == "show"), "nothing was unlinked for {bad:?}");
        }
    }

    #[test]
    fn undoes_only_a_merge_the_person_shows() {
        let f = Fake::new(Value::Null);
        let call = |a: &[String]| f.call(a);
        unmerge_with(&call, "person:7", "merge:7-12").unwrap();
        assert_eq!(f.seen()[1], strs(&["people", "unmerge", "merge:7-12", "--from-app", "--json", "--no-record"]));
        assert!(unmerge_with(&call, "person:7", "merge:7-13").is_err());
        assert!(unmerge_with(&call, "person:7", "--all").is_err());
    }

    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        let f = Fake::new(Value::Null);
        let p = show_with(&|a: &[String]| f.call(a), "person:7").unwrap();
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["identities"][0]["seenIn"][0], json!({"account":"1","scope":"personal"}));
        assert_eq!(v["mergedInto"], Value::Null);
        assert_eq!(v["matches"][0]["proposedBy"], json!("memo"));
        let answers: Vec<Answer> = serde_json::from_value(json!(["confirm", "reject"])).unwrap();
        assert_eq!(answers, [Answer::Confirm, Answer::Reject]);
    }

    #[test]
    fn needs_the_catalogs_memo() {
        let tool = catalog::tool("memo").unwrap();
        let need = &tool.people.as_ref().unwrap().min_version;
        assert!(too_old(Some("0.131.63"), need));
        assert!(!too_old(Some(need), need));
    }
}
