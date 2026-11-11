//! Account groups for the Settings page, through Memo's own `groups list`, `add`, `remove` and `move` (cli-core's
//! group calls, WC-ACCT-13). A member is named by its source, `telegram:102` or `bitrix24:acme.example`: the owner's
//! own account ids on the owner's own page, shown when an account has no profile name and never logged. Memo makes
//! each change in one write and answers with every group again, so the page shows what Memo holds, not a guess.

use crate::memo_cli::{Call, Failure, memo, with_memo};
use crate::tools;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const READ: Duration = Duration::from_secs(30);
const WRITE: Duration = Duration::from_secs(30);
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// The default group: every account, computed by Memo, never saved and never changed.
pub const ALL: &str = "all";
const RESERVED: [&str; 2] = [ALL, "bots"];
const MAX_GROUP: usize = 64;
const MAX_SOURCE: usize = 300;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    /// `<provider>:<account>`, the one word Memo takes back for this account.
    pub source: String,
    pub provider: String,
    /// `tg work`, `b24 work`: every profile any app recorded for the account.
    pub profiles: Vec<String>,
    /// The other saved groups that hold it too.
    pub also_in: Vec<String>,
    /// `personal` or `work`: whether work views read it. Absent from a memo before account scopes.
    pub scope: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub name: String,
    pub members: Vec<Member>,
    /// Accounts whose profile is named like the group: shown to add, never added by Memo.
    pub suggested: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Read {
    Missing,
    /// The installed Memo has no `groups` command yet.
    #[serde(rename_all = "camelCase")]
    Old {
        version: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Ready {
        /// The saved groups, then `all`, as Memo orders them.
        groups: Vec<Group>,
        /// Saved entries that name no account any more.
        unresolved: Vec<String>,
    },
}

fn plain(s: &str, max: usize, ok: impl Fn(char) -> bool) -> bool {
    !s.is_empty() && s.len() <= max && !s.starts_with('-') && s.chars().all(ok)
}

/// WC-ACCT-4's words: letters, digits, `-` and `_`. `all` and `bots` already mean something to Memo.
pub fn validate_group(name: &str) -> Result<&str, String> {
    let ok = plain(name, MAX_GROUP, |c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && !RESERVED.iter().any(|r| r.eq_ignore_ascii_case(name));
    if ok { Ok(name) } else { Err(format!("not a group name: {name}")) }
}

/// `provider:account` as `groups list` printed it: one argument, no space, no control character, no leading dash.
pub fn validate_source(source: &str) -> Result<&str, String> {
    let ok = source.split_once(':').is_some_and(|(provider, account)| {
        plain(provider, 32, |c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
            && plain(account, MAX_SOURCE, |c| !c.is_whitespace() && !c.is_control())
    });
    if ok { Ok(source) } else { Err("not an account Memo listed".into()) }
}

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array().map(|a| a.iter().filter_map(|s| s.as_str().map(str::to_string)).collect()).unwrap_or_default()
}

fn member(v: &Value) -> Option<Member> {
    let provider = v["provider"].as_str()?;
    let account = v["account"].as_str()?;
    Some(Member {
        source: format!("{provider}:{account}"),
        provider: provider.to_string(),
        profiles: strings(&v["profiles"]),
        also_in: strings(&v["also_in"]),
        scope: v["scope"].as_str().map(str::to_string),
    })
}

fn group(v: &Value) -> Option<Group> {
    Some(Group {
        name: v["group"].as_str()?.to_string(),
        members: v["members"].as_array().map(|a| a.iter().filter_map(member).collect()).unwrap_or_default(),
        suggested: v["suggested"]
            .as_array()
            .map(|a| a.iter().filter_map(|s| s["member"].as_str().map(str::to_string)).collect())
            .unwrap_or_default(),
    })
}

fn ready(v: &Value) -> Read {
    Read::Ready {
        groups: v["items"].as_array().map(|a| a.iter().filter_map(group).collect()).unwrap_or_default(),
        unresolved: v["missing"]
            .as_array()
            .map(|a| a.iter().filter_map(|m| m["field"].as_str().map(str::to_string)).collect())
            .unwrap_or_default(),
    }
}

fn answer(call: &Call, args: &[String]) -> Result<Read, Failure> {
    match call(args) {
        Ok(v) => Ok(ready(&v)),
        Err(f) if f.unknown_command() => Ok(Read::Old { version: None }),
        Err(f) => Err(f),
    }
}

fn with_version(read: Read, version: Option<String>) -> Read {
    match read {
        Read::Old { .. } => Read::Old { version },
        r => r,
    }
}

fn run(timeout: Duration, args: Vec<String>) -> Result<Read, String> {
    run_with(timeout, |call| answer(call, &args))
}

fn run_with(timeout: Duration, f: impl FnOnce(&Call) -> Result<Read, Failure>) -> Result<Read, String> {
    let state = tools::detect(memo()?, false);
    let Some(first) = state.installs.first() else { return Ok(Read::Missing) };
    let version = first.version.clone();
    Ok(with_version(with_memo(timeout, f)?, version))
}

pub fn read() -> Result<Read, String> {
    run(READ, words(&["groups", "list"]))
}

fn add_args(group: &str, source: &str) -> Result<Vec<String>, String> {
    Ok(words(&["groups", "add", validate_group(group)?, validate_source(source)?]))
}

fn remove_args(group: &str, source: &str) -> Result<Vec<String>, String> {
    Ok(words(&["groups", "remove", validate_group(group)?, validate_source(source)?]))
}

fn move_args(source: &str, from: &str, to: &str) -> Result<Vec<String>, String> {
    if from == to {
        return Err("an account moves to another group".into());
    }
    Ok(words(&["groups", "move", validate_source(source)?, validate_group(from)?, validate_group(to)?]))
}

/// A memo before `groups update`; the page asks for its update.
pub const OLD_MEMO: &str = "memo.old";

fn scope_args(source: &str, scope: &str) -> Result<Vec<String>, String> {
    if !["personal", "work"].contains(&scope) {
        return Err("an account is personal or work".into());
    }
    Ok(words(&["groups", "update", validate_source(source)?, &format!("--scope={scope}")]))
}

/// `groups update` answers with the one account, so the board is read again after it.
fn scope_with(call: &Call, args: &[String]) -> Result<Read, Failure> {
    match call(args) {
        // The board stays: only the switch needs a newer memo, and the page says so beside it.
        Err(f) if f.unknown_command() => Err(Failure::plain(OLD_MEMO)),
        Err(f) => Err(f),
        Ok(_) => answer(call, &words(&["groups", "list"])),
    }
}

/// Moves an account to the personal or the work side: work views and work agents read only work accounts.
pub fn set_scope(source: &str, scope: &str) -> Result<Read, String> {
    let args = scope_args(source, scope)?;
    run_with(WRITE, |call| scope_with(call, &args))
}

/// Puts an account in a group, which Memo makes when it is new; the account stays in its other groups.
pub fn add(group: &str, source: &str) -> Result<Read, String> {
    run(WRITE, add_args(group, source)?)
}

pub fn remove(group: &str, source: &str) -> Result<Read, String> {
    run(WRITE, remove_args(group, source)?)
}

/// Out of one saved group and into another in one write. A card dragged out of `all` is an `add`: nothing leaves it.
pub fn move_member(source: &str, from: &str, to: &str) -> Result<Read, String> {
    run(WRITE, move_args(source, from, to)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    // `memo groups list --json` from memo #698 on a synthetic store: tg personal, tg work, max personal, b24 work.
    fn listed() -> Value {
        json!({"items":[
            {"group":"work","members":[{"provider":"telegram","account":"1002","entries":["telegram:1002"],
                "reason":"setting","profiles":["tg work"],"also_in":["personal"],"scope":"work"}],
             "duplicates":[{"member":"telegram:1002","groups":["work","personal"]}],
             "suggested":[{"group":"work","member":"bitrix24:acme.example","because":"profile named work (b24 work)"}]},
            {"group":"personal","members":[{"provider":"telegram","account":"1001","entries":["telegram:1001"],
                "reason":"setting","profiles":["tg personal"],"also_in":[]}],"duplicates":[],"suggested":[]},
            {"group":"all","members":[{"provider":"bitrix24","account":"acme.example","entries":["bitrix24:acme.example"],
                "reason":"all","profiles":["b24 work"],"also_in":[]}],"duplicates":[],"suggested":[]}],
            "missing":[{"field":"email:gone@example.com","why":"a saved group entry that names no account"}],
            "page":{"mode":"page","limit":3,"has_more":false}})
    }

    #[test]
    fn reads_every_group_with_its_profiles_duplicates_and_suggestions() {
        let Read::Ready { groups, unresolved } = ready(&listed()) else { panic!("not ready") };
        assert_eq!(groups.iter().map(|g| g.name.as_str()).collect::<Vec<_>>(), ["work", "personal", ALL]);
        let work = &groups[0];
        assert_eq!(work.members[0].source, "telegram:1002");
        assert_eq!(work.members[0].profiles, ["tg work"]);
        assert_eq!(work.members[0].also_in, ["personal"]);
        assert_eq!(work.suggested, ["bitrix24:acme.example"]);
        assert_eq!(unresolved, ["email:gone@example.com"]);
        let v = serde_json::to_value(&groups[0]).unwrap();
        assert_eq!(v["members"][0]["alsoIn"][0], "personal");
    }

    #[test]
    fn a_memo_without_groups_is_old_and_any_other_failure_stays_an_error() {
        let old = |_: &[String]| Err(Failure::plain("unknown command 'groups'"));
        assert_eq!(answer(&old, &words(&["groups", "list"])).unwrap(), Read::Old { version: None });
        let busy = |_: &[String]| Err(Failure::plain("the store is busy"));
        assert_eq!(answer(&busy, &words(&["groups", "list"])).unwrap_err().message, "the store is busy");
        assert_eq!(
            with_version(Read::Old { version: None }, Some("0.131.0".into())),
            Read::Old { version: Some("0.131.0".into()) }
        );
    }

    #[test]
    fn builds_memos_own_words_for_each_change() {
        let tail = ["--json", "--no-record"];
        let with = |v: &[&str]| strs(&[v, &tail].concat());
        assert_eq!(add_args("work", "telegram:1001").unwrap(), with(&["groups", "add", "work", "telegram:1001"]));
        assert_eq!(remove_args("work", "max:2001").unwrap(), with(&["groups", "remove", "work", "max:2001"]));
        assert_eq!(
            move_args("email:me@work.example", "personal", "work").unwrap(),
            with(&["groups", "move", "email:me@work.example", "personal", "work"])
        );
    }

    #[test]
    fn an_accounts_scope_is_set_by_memo_and_the_board_read_again() {
        let seen = std::sync::Mutex::new(Vec::new());
        let call = |a: &[String]| {
            seen.lock().unwrap().push(a.to_vec());
            Ok(if a[1] == "update" {
                json!({"item": {"provider": "telegram", "account": "1002", "scope": "work"}})
            } else {
                listed()
            })
        };
        let args = scope_args("telegram:1002", "work").unwrap();
        let Read::Ready { groups, .. } = scope_with(&call, &args).unwrap() else { panic!("not ready") };
        assert_eq!(groups[0].members[0].scope.as_deref(), Some("work"));
        let seen = seen.into_inner().unwrap();
        assert_eq!(seen[0], strs(&["groups", "update", "telegram:1002", "--scope=work", "--json", "--no-record"]));
        assert_eq!(seen[1], strs(&["groups", "list", "--json", "--no-record"]));
        let old = |_: &[String]| Err(Failure::plain("unknown command 'update'"));
        assert_eq!(scope_with(&old, &args).unwrap_err().message, OLD_MEMO);
        assert!(scope_args("telegram:1002", "account").is_err());
        assert!(scope_args("-x:1", "work").is_err());
    }

    #[test]
    fn refuses_all_reserved_names_and_anything_that_is_not_one_plain_word() {
        for bad in ["all", "ALL", "bots", "", "-x", "a b", "work;rm", "w/x", &"g".repeat(MAX_GROUP + 1)] {
            assert!(validate_group(bad).is_err(), "{bad}");
        }
        assert!(validate_group("client-acme_2").is_ok());
        for bad in ["telegram", ":1", "telegram:", "Telegram:1", "-t:1", "telegram:-1", "telegram:1 2", "tg:a\nb"] {
            assert!(validate_source(bad).is_err(), "{bad}");
        }
        assert!(validate_source("bitrix24:acme.example").is_ok());
        assert!(move_args("telegram:1", "work", "work").is_err());
        assert!(add_args(ALL, "telegram:1").is_err());
    }

    /// Against a real memo with `groups` and a throwaway store whose accounts are `telegram:1001` (tg personal) and
    /// `max:2001`: `MEMO_BIN=<memo> cargo test groups -- --ignored`. It writes to that store, so never the owner's.
    #[test]
    #[ignore = "needs MEMO_BIN, a memo with groups and a throwaway store"]
    fn adds_moves_and_removes_through_a_real_memo() {
        let bin = std::path::PathBuf::from(std::env::var("MEMO_BIN").expect("MEMO_BIN"));
        let call = |a: &[String]| crate::memo_cli::call_at(&bin, a, READ);
        let names = |r: &Read| match r {
            Read::Ready { groups, .. } => groups.iter().map(|g| (g.name.clone(), g.members.len())).collect::<Vec<_>>(),
            other => panic!("not ready: {other:?}"),
        };
        let listed = answer(&call, &words(&["groups", "list"])).unwrap();
        assert_eq!(names(&listed).last().map(|(n, _)| n.as_str()), Some(ALL));
        let added = answer(&call, &add_args("probe-a", "telegram:1001").unwrap()).unwrap();
        assert!(names(&added).contains(&("probe-a".into(), 1)));
        let copied = answer(&call, &add_args("probe-b", "telegram:1001").unwrap()).unwrap();
        let Read::Ready { groups, .. } = &copied else { panic!("not ready") };
        let a = groups.iter().find(|g| g.name == "probe-a").unwrap();
        assert!(a.members[0].also_in.contains(&"probe-b".to_string()));
        assert!(a.members[0].profiles.iter().any(|p| p.starts_with("tg ")));
        let moved = answer(&call, &move_args("max:2001", "probe-a", "probe-b").unwrap());
        assert!(moved.unwrap_err().message.contains("not in group"));
        let emptied = answer(&call, &remove_args("probe-a", "telegram:1001").unwrap()).unwrap();
        assert!(names(&emptied).contains(&("probe-a".into(), 0)), "an emptied group stays");
        answer(&call, &move_args("telegram:1001", "probe-b", "probe-a").unwrap()).unwrap();
    }
}
