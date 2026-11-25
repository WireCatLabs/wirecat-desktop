//! The Bots tab of Contacts: the programs that write to the owner, through memo's `bots list` and `bots show`
//! (cli-core #3356). A bot is not a person: `people list` leaves it out, so the tab reads it here. Names and addresses
//! are the owner's own data on the owner's own page, never logged.

use crate::catalog;
use crate::people::{Call, KindCount, Listed, Page, sendable, text, with_memo, words};
use serde::Serialize;
use serde_json::Value;

/// How memo names a bot. cli-core will call it `bot:<id>` and keep this one as an alias; only this constant changes.
pub const SENDER_BOT_PREFIX: &str = "sender-bot:";
const MAX_PAGE: u32 = 200;
const MAX_QUERY: usize = 100;

pub fn bot_ref(s: &str) -> Result<&str, String> {
    let id = s.strip_prefix(SENDER_BOT_PREFIX).unwrap_or_default();
    if id.is_empty() || id.len() > 15 || id.starts_with('0') || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not a bot: {s}"));
    }
    Ok(s)
}

/// Whether the installed memo has `bots list`; a null `minVersion` in the catalog is not released yet.
pub fn open() -> bool {
    let Ok(tool) = catalog::tool("memo") else { return false };
    let gate = tool.people.as_ref().and_then(|p| p.sender_bots.as_ref());
    gate.is_some_and(|g| g.open(crate::tools::installed_version(tool).as_deref()))
}

fn identities(v: &Value) -> impl Iterator<Item = &Value> {
    v["identities"].as_array().into_iter().flatten()
}

/// A bot as a row of the shared table: its first address, else its first handle, else its first account.
fn row(v: &Value) -> Option<Listed> {
    let reference = bot_ref(v["ref"].as_str()?).ok()?.to_string();
    let email = identities(v).find_map(|i| i["identity"].as_str()?.strip_prefix("email:").map(str::to_string));
    let handle = identities(v).find_map(|i| {
        let username = text(i, "username")?;
        let provider = i["identity"].as_str()?.split_once(':')?.0.to_string();
        Some((username.trim_start_matches('@').to_string(), provider))
    });
    let first = identities(v).find_map(|i| text(i, "identity"));
    Some(Listed {
        reference,
        name: text(v, "name"),
        display_name: text(v, "display_name"),
        kind: Some("bot".into()),
        contact: email.clone().or(first),
        email,
        username: handle.as_ref().map(|h| h.0.clone()),
        username_source: handle.map(|h| h.1),
        messages_from: v["messages_from"].as_u64(),
        last_contact: text(v, "last_contact"),
        bot: true,
        ..Listed::default()
    })
}

fn page_args(page: u32, size: u32, query: &str) -> Result<Vec<String>, String> {
    if page == 0 || !(1..=MAX_PAGE).contains(&size) {
        return Err(format!("a page is 1 to {MAX_PAGE} bots, from page 1"));
    }
    let query = query.trim();
    if query.chars().count() > MAX_QUERY || query.chars().any(char::is_control) {
        return Err(format!("a name to look for is at most {MAX_QUERY} characters on one line"));
    }
    let mut args = vec!["bots".to_string(), "list".into()];
    if !query.is_empty() {
        args.push(format!("name:{}", serde_json::to_string(query).map_err(|e| e.to_string())?));
    }
    let (size, page) = (size.to_string(), page.to_string());
    args.extend(words(&["--limit", &size, "--page", &page]));
    Ok(args)
}

fn total_of(v: &Value) -> Option<KindCount> {
    let total = &v["page"]["total"];
    Some(KindCount { value: total["value"].as_u64()?, more: total["relation"].as_str().is_some_and(|r| r != "eq") })
}

fn page_with(call: &Call, page: u32, size: u32, query: &str) -> Result<Page, String> {
    let v = call(&page_args(page, size, query)?)?;
    Ok(Page {
        people: v["items"].as_array().into_iter().flatten().filter_map(row).collect(),
        total: total_of(&v),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
    })
}

/// One page of the bots, by name, as memo sorts them.
pub fn page(page: u32, size: u32, query: &str) -> Result<Page, String> {
    with_memo(|call| page_with(call, page, size, query))
}

pub(crate) fn count_with(call: &Call) -> Option<KindCount> {
    total_of(&call(&words(&["bots", "list", "--limit", "1"])).ok()?)
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BotIdentity {
    pub identity: String,
    pub name: Option<String>,
    pub username: Option<String>,
}

/// One move of an account between a person and a bot; `from` and `to` are `None` for nobody.
#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BotMove {
    pub identity: String,
    pub from: Option<String>,
    pub to: Option<String>,
    /// `rules` or `owner`.
    pub author: String,
    pub reason: Option<String>,
    pub at: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SenderBot {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub organization: Option<String>,
    /// `owner` when the owner said it is a program: no rule gives it back to a person.
    pub author: String,
    /// The signals that sorted it, or the owner's words.
    pub reason: Option<String>,
    pub identities: Vec<BotIdentity>,
    pub messages_from: Option<u64>,
    pub last_contact: Option<String>,
    /// `direct`, `group` or `broadcast`: how its messages reached the owner.
    pub reach: Option<String>,
    pub signals: Vec<String>,
    pub moves: Vec<BotMove>,
}

fn shown(v: &Value) -> Option<SenderBot> {
    let v = crate::skills::body(v);
    Some(SenderBot {
        reference: bot_ref(v["ref"].as_str()?).ok()?.to_string(),
        name: text(v, "name"),
        display_name: text(v, "display_name"),
        organization: text(v, "organization"),
        author: text(v, "author").unwrap_or_else(|| "rules".into()),
        reason: text(v, "reason"),
        identities: identities(v)
            .filter_map(|i| {
                Some(BotIdentity {
                    identity: text(i, "identity")?,
                    name: text(i, "name"),
                    username: text(i, "username"),
                })
            })
            .collect(),
        messages_from: v["messages_from"].as_u64(),
        last_contact: text(v, "last_contact"),
        reach: text(v, "reach"),
        signals: v["signals"].as_array().into_iter().flatten().filter_map(|s| s.as_str().map(str::to_string)).collect(),
        moves: v["moves"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|m| {
                Some(BotMove {
                    identity: text(m, "identity")?,
                    from: text(m, "from"),
                    to: text(m, "to"),
                    author: text(m, "author").unwrap_or_else(|| "rules".into()),
                    reason: text(m, "reason"),
                    at: text(m, "at")?,
                })
            })
            .collect(),
    })
}

fn show_with(call: &Call, reference: &str) -> Result<SenderBot, String> {
    let reference = sendable(bot_ref(reference)?).ok_or("not a bot")?;
    shown(&call(&words(&["bots", "show", reference]))?).ok_or_else(|| "Memo's answer did not describe the bot".into())
}

pub fn show(reference: &str) -> Result<SenderBot, String> {
    with_memo(|call| show_with(call, reference))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn strs(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn a_bot_ref_is_the_prefix_and_a_number() {
        assert!(bot_ref("sender-bot:12").is_ok());
        for bad in ["sender-bot:", "sender-bot:012", "sender-bot:1 --yes", "bot:3", "person:3"] {
            assert!(bot_ref(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_page_asks_memo_by_name_with_its_limit() {
        assert_eq!(
            page_args(2, 50, " shop ").unwrap(),
            strs(&["bots", "list", "name:\"shop\"", "--limit", "50", "--page", "2", "--json", "--no-record"])
        );
        assert!(page_args(0, 50, "").is_err());
        assert!(page_args(1, 500, "").is_err());
        assert!(page_args(1, 50, "a\nb").is_err());
    }

    #[test]
    fn a_bot_becomes_a_row_with_its_first_address_or_handle() {
        let seen = Mutex::new(Vec::new());
        let call = |a: &[String]| {
            seen.lock().unwrap().push(a.to_vec());
            Ok(json!({
                "items": [
                    {"ref": "sender-bot:3", "name": null, "display_name": "Harbour Shop",
                     "identities": [{"identity": "email:noreply@shop.example", "name": "Harbour Shop", "username": null}],
                     "messages_from": 41, "last_contact": "2026-11-24T10:00:00Z", "reach": "broadcast", "signals": []},
                    {"ref": "sender-bot:4", "display_name": "Parcel bot",
                     "identities": [{"identity": "telegram:777", "name": null, "username": "parcel_bot"}]},
                    {"ref": "sender-bot:5", "identities": [{"identity": "max:55", "name": null, "username": null}]},
                    {"ref": "person:6"}
                ],
                "page": {"has_more": true, "total": {"value": 120, "relation": "eq"}}
            }))
        };
        let got = page_with(&call, 1, 50, "").unwrap();
        assert_eq!(got.total, Some(KindCount { value: 120, more: false }));
        assert!(got.more);
        assert_eq!(got.people.len(), 3);
        assert_eq!(got.people[0].email.as_deref(), Some("noreply@shop.example"));
        assert_eq!(got.people[0].messages_from, Some(41));
        assert!(got.people[0].bot);
        assert_eq!(got.people[1].username.as_deref(), Some("parcel_bot"));
        assert_eq!(got.people[1].username_source.as_deref(), Some("telegram"));
        assert_eq!(got.people[2].contact.as_deref(), Some("max:55"));
    }

    #[test]
    fn show_reads_identities_and_moves() {
        let call = |a: &[String]| {
            assert_eq!(a[..3], strs(&["bots", "show", "sender-bot:3"]));
            Ok(json!({"item": {
                "ref": "sender-bot:3", "display_name": "Harbour Shop", "organization": "organization:2",
                "author": "owner", "reason": "a program",
                "identities": [{"identity": "email:noreply@shop.example", "name": "Harbour Shop", "username": null}],
                "messages_from": 41, "reach": "broadcast", "signals": ["no-reply", "bulk-mail"],
                "moves": [{"identity": "email:noreply@shop.example", "from": "person:9", "to": "sender-bot:3",
                           "author": "owner", "reason": null, "at": "2026-11-25T09:00:00Z"}]
            }}))
        };
        let bot = show_with(&call, "sender-bot:3").unwrap();
        assert_eq!(bot.organization.as_deref(), Some("organization:2"));
        assert_eq!(bot.signals, strs(&["no-reply", "bulk-mail"]));
        assert_eq!(bot.moves[0].from.as_deref(), Some("person:9"));
        assert!(show_with(&call, "person:3").is_err());
    }
}
