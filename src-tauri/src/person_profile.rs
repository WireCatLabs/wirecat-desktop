//! What the owner compares before joining two people: their contacts, companies, activity and latest messages, from
//! memo's `context` and the person's row in `people check`. Only what the match dialog shows leaves Rust; message
//! text is the owner's own data on the owner's own page, like the People page's names, and is never logged.

use crate::people::{Call, person_ref, text, with_memo};
use serde::Serialize;
use serde_json::Value;

/// Messages, events and calls of each kind memo reads: the dialogs show the newest few messages and every call read.
const CONTEXT_LIMIT: &str = "10";
const RECENT_SHOWN: usize = 3;
/// `people check` gives at most 50 people with a name like the words; the person is found among them by ref.
const CHECK_LIMIT: &str = "50";
const NAME_WORDS: usize = 6;
const TEXT_CHARS: usize = 280;

#[derive(Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Organization {
    pub name: Option<String>,
    pub role: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Recent {
    /// `message` or `event`.
    pub kind: &'static str,
    pub at: Option<String>,
    pub text: String,
    pub outgoing: Option<bool>,
    pub provider: Option<String>,
    pub chat: Option<String>,
    /// `msg:<provider>/<account>/<chat>/<id>`, which the app opens in its conversation view.
    pub locator: Option<String>,
}

#[derive(Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub phones: Vec<String>,
    pub emails: Vec<String>,
    pub organizations: Vec<Organization>,
    pub last_contact: Option<String>,
    /// Messages and mail they sent, every account together; `None` when their row was not found.
    pub messages_from: Option<u64>,
    pub tasks: Option<u64>,
    /// `tasks` counts only the tasks the context read, and memo has more.
    pub tasks_more: bool,
    pub deals: u64,
    pub recent: Vec<Recent>,
    /// Their calls and recorded meetings, newest first; `None` from a memo before cli-core 0.650.0, which reads none.
    pub meetings: Option<Vec<crate::calls::ClientCall>>,
}

fn clipped(s: &str) -> String {
    let s = s.trim();
    match s.char_indices().nth(TEXT_CHARS) {
        Some((at, _)) => format!("{}…", s[..at].trim_end()),
        None => s.to_string(),
    }
}

fn push_new(list: &mut Vec<String>, value: Option<String>) {
    if let Some(v) = value
        && !list.contains(&v)
    {
        list.push(v);
    }
}

fn message(v: &Value) -> Option<Recent> {
    Some(Recent {
        kind: "message",
        at: text(v, "timestamp"),
        text: clipped(v.get("text")?.as_str()?),
        outgoing: v.get("outgoing").and_then(Value::as_bool),
        provider: text(v, "provider"),
        chat: text(v, "chat_title"),
        locator: text(v, "locator").filter(|l| l.starts_with("msg:")),
    })
}

fn event(v: &Value) -> Option<Recent> {
    Some(Recent {
        kind: "event",
        at: text(v, "starts_at"),
        text: clipped(&text(v, "title")?),
        outgoing: None,
        provider: None,
        chat: None,
        locator: None,
    })
}

fn items<'a>(v: &'a Value, path: &[&str]) -> impl Iterator<Item = &'a Value> {
    path.iter().fold(v, |v, k| &v[*k]).as_array().into_iter().flatten()
}

/// The words of a name `people check` takes, after `--` so none reads as an option.
fn name_words(name: &str) -> Vec<String> {
    name.split_whitespace()
        .map(|w| w.chars().filter(|c| !c.is_control()).collect::<String>())
        .filter(|w| !w.is_empty())
        .take(NAME_WORDS)
        .collect()
}

fn profile_of(context: &Value, row: Option<&Value>) -> Profile {
    let item = &context["item"];
    let mut p = Profile::default();
    if let Some(row) = row {
        push_new(&mut p.phones, text(row, "phone"));
        push_new(&mut p.emails, text(row, "email"));
        p.last_contact = text(row, "last_contact");
        p.messages_from = row["messages_from"].as_u64();
        p.tasks = row["tasks"].as_u64();
    }
    // A memo that reports a phone or an address on each identity; older ones give only the row's one.
    for identity in items(item, &["messages", "person", "identities"]) {
        push_new(&mut p.phones, text(identity, "phone"));
        push_new(&mut p.emails, text(identity, "email"));
    }
    let business = &item["business"];
    // An ended membership or an agent's unconfirmed guess is not where they work now.
    let current = |r: &&Value| matches!(r["standing"].as_str(), Some("confirmed" | "reported") | None);
    p.organizations = items(business, &["organizations", "items"])
        .filter(|o| items(o, &["roles"]).any(|r| current(&r)))
        .map(|o| Organization {
            name: text(o, "name"),
            role: items(o, &["roles"]).filter(current).find_map(|r| text(r, "position").or_else(|| text(r, "role"))),
        })
        .collect();
    p.deals = business["deals"]["total"].as_u64().unwrap_or_default();
    if p.tasks.is_none() {
        p.tasks = items(item, &["tasks", "items"]).count().try_into().ok();
        p.tasks_more = item["tasks"]["has_more"].as_bool().unwrap_or(false);
    }
    let last = &item["messages"]["last"];
    if p.last_contact.is_none() {
        p.last_contact =
            ["from_them", "from_me", "from_them_anywhere"].iter().filter_map(|k| text(&last[*k], "timestamp")).max();
    }
    let mut recent: Vec<Recent> = items(item, &["messages", "recent", "direct"])
        .chain(items(item, &["messages", "recent", "groups"]))
        .filter_map(message)
        .collect();
    if recent.is_empty() {
        recent = items(item, &["events", "recent"]).filter_map(event).collect();
    }
    recent.sort_by(|a, b| b.at.cmp(&a.at));
    recent.truncate(RECENT_SHOWN);
    p.recent = recent;
    p.meetings = crate::calls::calls_of(&item["messages"]);
    p
}

fn profile_with(call: &Call, reference: &str) -> Result<Profile, String> {
    let context = call(&crate::people::words(&["context", reference, "--limit", CONTEXT_LIMIT, "--trimmed"]))?;
    let name = text(&context["item"]["messages"]["person"], "name").unwrap_or_default();
    let words = name_words(&name);
    let row = if words.is_empty() {
        None
    } else {
        let mut args: Vec<String> =
            ["people", "check", "--json", "--no-record", "--limit", CHECK_LIMIT, "--"].map(String::from).to_vec();
        args.extend(words);
        // The row adds counts the context lacks; without it the dialog still shows everything else.
        call(&args)
            .ok()
            .and_then(|v| items(&v, &["items"]).find(|r| text(r, "ref").as_deref() == Some(reference)).cloned())
    };
    Ok(profile_of(&context, row.as_ref()))
}

pub fn profile(reference: &str) -> Result<Profile, String> {
    let reference = person_ref(reference)?;
    with_memo(|call| profile_with(call, reference))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn context() -> Value {
        json!({ "item": {
            "messages": {
                "person": { "uid": "7", "name": "Lena  Ortiz", "identities": [
                    { "provider": "telegram", "id": "4411", "phone": "+34600111222" },
                    { "provider": "email", "id": "lena@example.org" }
                ] },
                "last": {
                    "from_them": { "timestamp": "2026-11-01T10:00:00Z" },
                    "from_me": { "timestamp": "2026-11-03T09:00:00Z" },
                    "from_them_anywhere": null
                },
                "recent": {
                    "direct": [
                        { "locator": "msg:telegram/1/4411/30", "provider": "telegram", "chat_title": "Lena",
                          "timestamp": "2026-11-03T09:00:00Z", "outgoing": true, "text": "See you" },
                        { "locator": "msg:telegram/1/4411/29", "provider": "telegram", "chat_title": "Lena",
                          "timestamp": "2026-11-01T10:00:00Z", "outgoing": false, "text": "x".repeat(400) }
                    ],
                    "groups": [
                        { "locator": "msg:telegram/1/-100/5", "provider": "telegram", "chat_title": "Harbour",
                          "timestamp": "2026-11-02T10:00:00Z", "outgoing": false, "text": "Hi all" },
                        { "locator": "msg:telegram/1/-100/4", "provider": "telegram", "chat_title": "Harbour",
                          "timestamp": "2026-10-02T10:00:00Z", "outgoing": false, "text": "Old" }
                    ]
                }
            },
            "events": { "recent": [{ "ref": "event:1", "title": "Call", "starts_at": "2026-10-01T10:00:00Z" }] },
            "tasks": { "items": [{ "id": "t1" }, { "id": "t2" }], "has_more": true },
            "business": {
                "organizations": { "items": [
                    { "ref": "organization:3", "name": "Northstar", "roles": [
                        { "kind": "member-of", "role": null, "standing": "confirmed" },
                        { "kind": "member-of", "role": "member", "position": "Buyer", "standing": "reported" }
                    ] },
                    { "ref": "organization:4", "name": "Old Co", "roles": [
                        { "kind": "member-of", "position": "Intern", "standing": "ended" }
                    ] },
                    { "ref": "organization:5", "name": "Guessed Co", "roles": [
                        { "kind": "member-of", "standing": "proposed" }
                    ] }
                ], "total": 1 },
                "deals": { "items": [{ "ref": "deal:1" }], "total": 4 },
                "projects": { "items": [], "total": 0 }
            }
        } })
    }

    fn row() -> Value {
        json!({ "ref": "person:7", "phone": "+34600111222", "email": "lena@example.org",
                "messages_from": 120, "last_contact": "2026-11-04T08:00:00Z", "tasks": 3 })
    }

    #[test]
    fn takes_counts_and_contacts_from_the_row_and_the_rest_from_the_context() {
        let p = profile_of(&context(), Some(&row()));
        assert_eq!(p.phones, ["+34600111222"]);
        assert_eq!(p.emails, ["lena@example.org"]);
        assert_eq!(p.messages_from, Some(120));
        assert_eq!(p.last_contact.as_deref(), Some("2026-11-04T08:00:00Z"));
        assert_eq!(p.tasks, Some(3));
        assert_eq!(p.deals, 4);
        assert_eq!(p.organizations, [Organization { name: Some("Northstar".into()), role: Some("Buyer".into()) }]);
    }

    #[test]
    fn without_a_row_it_counts_what_the_context_holds() {
        let p = profile_of(&context(), None);
        assert_eq!(p.phones, ["+34600111222"]);
        assert_eq!(p.emails, Vec::<String>::new());
        assert_eq!(p.messages_from, None);
        assert_eq!((p.tasks, p.tasks_more), (Some(2), true));
        assert_eq!(p.last_contact.as_deref(), Some("2026-11-03T09:00:00Z"));
    }

    #[test]
    fn shows_the_newest_messages_of_dialogs_and_groups_clipped() {
        let p = profile_of(&context(), None);
        let texts: Vec<_> = p.recent.iter().map(|r| r.text.chars().take(8).collect::<String>()).collect();
        assert_eq!(texts, ["See you", "Hi all", "xxxxxxxx"]);
        assert_eq!(p.recent[2].text.chars().count(), TEXT_CHARS + 1);
        assert_eq!(p.recent[0].locator.as_deref(), Some("msg:telegram/1/4411/30"));
        assert_eq!(p.recent[0].outgoing, Some(true));
    }

    #[test]
    fn with_no_message_it_shows_the_latest_meetings() {
        let mut c = context();
        c["item"]["messages"]["recent"] = json!({ "direct": [], "groups": [] });
        let p = profile_of(&c, None);
        assert_eq!(p.recent.len(), 1);
        assert_eq!((p.recent[0].kind, p.recent[0].text.as_str()), ("event", "Call"));
    }

    #[test]
    fn a_memo_on_cli_core_0_650_lists_their_calls_and_an_older_one_none() {
        assert_eq!(profile_of(&context(), None).meetings, None);
        let mut v = context();
        v["item"]["messages"]["meetings"] = json!([
            { "ref": "meeting:4/77", "meeting_id": 77, "account": { "provider": "asterisk", "account": "office" },
              "title": "+34 600 111 222 → 201", "started_at": "2026-11-12T09:30:00.000Z", "duration_ms": 184_000,
              "has_transcript": true, "event": null, "people": ["person:7"] }
        ]);
        let calls = profile_of(&v, None).meetings.unwrap();
        assert_eq!((calls[0].meeting_id, calls[0].tool.as_deref()), (77, Some("pbx")));
    }

    #[test]
    fn reads_the_context_then_finds_the_row_by_ref_among_people_with_that_name() {
        let seen = Mutex::new(Vec::<Vec<String>>::new());
        let call = |a: &[String]| {
            seen.lock().unwrap().push(a.to_vec());
            Ok(if a[0] == "context" {
                context()
            } else {
                json!({ "items": [{ "ref": "person:70", "messages_from": 1 }, row()] })
            })
        };
        let p = profile_with(&call, "person:7").unwrap();
        assert_eq!(p.messages_from, Some(120));
        let seen = seen.lock().unwrap();
        assert_eq!(seen[0], ["context", "person:7", "--limit", "10", "--trimmed", "--json", "--no-record"]);
        assert_eq!(seen[1], ["people", "check", "--json", "--no-record", "--limit", "50", "--", "Lena", "Ortiz"]);
    }

    #[test]
    fn a_failed_check_still_gives_the_context() {
        let call = |a: &[String]| if a[0] == "context" { Ok(context()) } else { Err("store.busy".to_string()) };
        assert_eq!(profile_with(&call, "person:7").unwrap().deals, 4);
    }

    #[test]
    fn a_name_cannot_become_an_option_or_a_control_character() {
        assert_eq!(name_words(" --json\u{7}  Ana \n"), ["--json", "Ana"]);
    }

    #[test]
    fn refuses_anything_but_a_person() {
        assert!(profile("telegram:4411").is_err());
        assert!(profile("person:7 --all").is_err());
    }
}
