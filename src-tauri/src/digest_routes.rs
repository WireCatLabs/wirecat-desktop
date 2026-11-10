//! What a digest's route form offers: the Telegram bots `tg` keeps (a route's profile is a bot profile, as
//! `tg <profile> bot messages send` takes it), the owner's own Telegram users and the mailboxes `mail` keeps, each with
//! its address. Read from the tools' own `bot list`, `account list` and `session list`; nothing is written.
//! The ids and addresses are the owner's own and leave Rust unmasked, the exception routes already are (rule 4); never
//! logged.

use crate::{bots, catalog, tools};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RouteChoices {
    /// `tg` bot profiles: the profile part of a `telegram-bot:` route.
    pub bots: Vec<String>,
    /// The owner's own Telegram users, `user:<id>`, a bot can write to once the owner started it.
    pub own_chats: Vec<OwnChoice>,
    pub mailboxes: Vec<Mailbox>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnChoice {
    pub value: String,
    /// The `tg` profile the account is signed in under.
    pub profile: String,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Mailbox {
    pub profile: String,
    pub address: Option<String>,
}

/// A tool's profile list as JSON rows; nothing when it is not installed or answers otherwise.
fn rows(id: &str) -> Vec<Value> {
    let Ok(tool) = catalog::tool(id) else { return Vec::new() };
    let (Some(src), Some(bin)) = (&tool.profiles, tools::program(&tool.bin)) else { return Vec::new() };
    let args: Vec<&str> = src.args.iter().map(String::as_str).collect();
    crate::memo_server::run_tool(tool, &bin, &args, CALL)
        .ok()
        .and_then(|out| out.json())
        .and_then(|v| v["items"].as_array().cloned())
        .unwrap_or_default()
}

fn own_chats(rows: &[Value]) -> Vec<OwnChoice> {
    let mut out: Vec<OwnChoice> = Vec::new();
    for row in rows {
        let (Some(profile), Some(id)) = (row["profile"].as_str(), row["account"].as_str()) else { continue };
        if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) {
            continue;
        }
        let value = format!("user:{id}");
        if !out.iter().any(|o| o.value == value) {
            out.push(OwnChoice { value, profile: profile.to_string() });
        }
    }
    out
}

fn mailboxes(rows: &[Value]) -> Vec<Mailbox> {
    rows.iter()
        .filter_map(|row| {
            let profile = row["profile"].as_str()?.to_string();
            catalog::validate_profile(&profile).ok()?;
            let address = row["address"].as_str().filter(|a| a.contains('@')).map(str::to_string);
            Some(Mailbox { profile, address })
        })
        .collect()
}

pub fn choices() -> RouteChoices {
    let bots = catalog::tool("tg")
        .ok()
        .and_then(|tg| bots::list(tg).ok())
        .map(|list| list.into_iter().map(|b| b.name).collect())
        .unwrap_or_default();
    RouteChoices { bots, own_chats: own_chats(&rows("tg")), mailboxes: mailboxes(&rows("email")) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn offers_each_signed_in_telegram_user_once_as_a_chat_a_bot_takes() {
        let rows = json!([
            { "profile": "personal", "account": "1001", "signed_in": true },
            { "profile": "work", "account": "1001", "signed_in": true },
            { "profile": "spare", "account": null, "signed_in": false },
            { "profile": "odd", "account": "@name" }
        ]);
        let chats = own_chats(rows.as_array().unwrap());
        assert_eq!(chats, vec![OwnChoice { value: "user:1001".into(), profile: "personal".into() }]);
    }

    #[test]
    fn offers_every_mailbox_with_its_address_when_mail_names_one() {
        let rows = json!([
            { "profile": "work", "address": "owner@example.com" },
            { "profile": "old" },
            { "profile": "--bad", "address": "x@example.com" }
        ]);
        assert_eq!(
            mailboxes(rows.as_array().unwrap()),
            vec![
                Mailbox { profile: "work".into(), address: Some("owner@example.com".into()) },
                Mailbox { profile: "old".into(), address: None },
            ]
        );
    }
}
