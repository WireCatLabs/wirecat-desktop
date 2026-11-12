//! One file of a stored message, by its `msg:` reference and its place among the message's attachments: its text read
//! from the picture by the owner's coding agent (`<messenger> images read`), or the saved copy opened. memo's `show`
//! names the messenger and the profile signed in to the message's account, as the conversation page reads it.

use crate::catalog::Tool;
use crate::conversation::{ChatPlace, LISTS};
use crate::skills::{body, call, failure};
use crate::{deep_link, run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const SHOW: Duration = Duration::from_mins(1);
/// cli-core gives the agent ten minutes before it stops it.
const READ: Duration = Duration::from_mins(11);
const MAX_TEXT: usize = 20_000;
const MAX_ATTACHMENT: u32 = 1000;
/// The messenger's refusals the window words itself; `unavailable` names the agent to install after a colon.
const WORDED: [&str; 6] = [
    "picture-reading.off",
    "picture-reading.unavailable",
    "picture-reading.not-a-picture",
    "picture-reading.unavailable-file",
    "picture-reading.failed",
    "picture-reading.timeout",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagesReadSource {
    /// The first version with `images read` (cli-core 0.643.0); `None` until one is released, which counts as too old.
    pub min_version: Option<String>,
    /// `{profile}`, `{ref}` and `{attachment}` filled here.
    pub read: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum PictureRead {
    /// The messenger is older than `need`, or `need` is `None`: no version with `images read` is released yet.
    Old { tool: String, version: Option<String>, need: Option<String> },
    Read {
        /// What the agent read, as the store keeps it now; the picture's own words, shown as plain text only.
        text: String,
        extractor: Option<String>,
        /// The origin of the text it replaced, if the attachment had one.
        replaced: Option<String>,
    },
}

/// The message a `msg:` reference names, read back exactly as `message_ref` writes it.
fn place_of(reference: &str) -> Result<(ChatPlace, String), String> {
    let bad = || "not a message of the store".to_string();
    let parts: Vec<&str> = reference.strip_prefix("msg:").ok_or_else(bad)?.split('/').collect();
    let [provider, account, chat, message] = parts[..] else { return Err(bad()) };
    let decoded = |p: &str| deep_link::decode(p).ok_or_else(bad);
    let message = decoded(message)?;
    let place = ChatPlace {
        provider: provider.to_string(),
        account: decoded(account)?,
        chat: decoded(chat)?,
        message: Some(message.clone()),
    };
    place.validate()?;
    if place.message_ref(&message) != reference {
        return Err(bad());
    }
    Ok((place, message))
}

fn memo() -> Result<&'static Tool, String> {
    crate::catalog::tool("memo")
}

/// The messenger memo reads the chat with, and the profile signed in to its account.
fn messenger_of(place: &ChatPlace) -> Result<(&'static Tool, String), String> {
    let args: Vec<String> =
        ["show", &place.chat_ref(), "--no-record", "--json"].iter().map(|s| (*s).to_string()).collect();
    let (out, json) = call(memo()?, &args, SHOW)?;
    let shown = json
        .as_ref()
        .filter(|_| out.code == Some(0))
        .and_then(|v| crate::conversation::shown(v, false))
        .ok_or_else(|| failure(&out, json.as_ref()))?;
    let program = shown.tool.filter(|t| LISTS.contains(&t.as_str())).ok_or("Only a messenger's pictures are read.")?;
    let tool = crate::catalog::catalog()
        .tools
        .iter()
        .find(|t| t.bin == program && t.part_of.is_none())
        .ok_or_else(|| format!("{program} is not a messenger the app knows"))?;
    // Every listed profile is signed in to the same account, so any of them reads the same picture.
    let profile =
        shown.chat.profiles.into_iter().next().ok_or("No profile on this computer is signed in to this account.")?;
    Ok((tool, profile))
}

fn read_args(src: &ImagesReadSource, profile: &str, reference: &str, attachment: u32) -> Vec<String> {
    src.read
        .iter()
        .map(|w| match w.as_str() {
            "{profile}" => profile.to_string(),
            "{ref}" => reference.to_string(),
            "{attachment}" => attachment.to_string(),
            _ => w.clone(),
        })
        .collect()
}

fn clipped(t: &str) -> String {
    if t.chars().count() <= MAX_TEXT {
        return t.to_string();
    }
    let mut cut: String = t.chars().take(MAX_TEXT).collect();
    cut.push('…');
    cut
}

fn read_of(v: &Value) -> Option<PictureRead> {
    let item = body(v);
    let short = |key: &str| item[key].as_str().filter(|s| s.len() <= 120).map(str::to_string);
    Some(PictureRead::Read {
        text: clipped(item["text"].as_str()?),
        extractor: short("extractor"),
        replaced: short("replaced"),
    })
}

fn refusal(out: &run::Output, json: Option<&Value>) -> String {
    let error = json.map(|v| &v["error"]);
    match crate::skills::reason(json) {
        // cli-core says "Claude Code is not installed" or "Codex CLI is not installed".
        Some("picture-reading.unavailable") => {
            let codex = error.and_then(|e| e["message"].as_str()).is_some_and(|m| m.starts_with("Codex"));
            format!("picture-reading.unavailable:{}", if codex { "codex" } else { "claude" })
        }
        Some(reason) if WORDED.contains(&reason) => reason.to_string(),
        _ => failure(out, json),
    }
}

fn checked(reference: &str, attachment: u32) -> Result<ChatPlace, String> {
    if !(1..=MAX_ATTACHMENT).contains(&attachment) {
        return Err("not a file of the message".into());
    }
    Ok(place_of(reference)?.0)
}

/// The owner pressed "Read the picture": one picture goes to the agent chosen in Settings, and its text is kept.
pub fn read_picture(reference: &str, attachment: u32) -> Result<PictureRead, String> {
    let place = checked(reference, attachment)?;
    let (tool, profile) = messenger_of(&place)?;
    let src = tool.images_read.as_ref().ok_or_else(|| format!("{} reads no pictures", tool.name))?;
    let version = tools::installed_version(tool);
    if src.min_version.as_deref().is_none_or(|need| tools::older(version.as_deref(), need)) {
        return Ok(PictureRead::Old { tool: tool.id.clone(), version, need: src.min_version.clone() });
    }
    let (out, json) = call(tool, &read_args(src, &profile, reference, attachment), READ)?;
    if out.code != Some(0) {
        return Err(refusal(&out, json.as_ref()));
    }
    json.as_ref().and_then(read_of).ok_or_else(|| format!("{} gave an answer the app cannot read", tool.name))
}

/// The saved copy memo names for this file now; the window never sends a path.
fn local_path_of(v: &Value, reference: &str, attachment: u32) -> Option<String> {
    let message = v["items"].as_array()?.iter().find(|m| m["ref"].as_str() == Some(reference))?;
    let file = message["attachments"].as_array()?.get(usize::try_from(attachment).ok()?.checked_sub(1)?)?;
    file["local_path"].as_str().filter(|p| !p.is_empty()).map(str::to_string)
}

pub fn open_file(reference: &str, attachment: u32) -> Result<(), String> {
    checked(reference, attachment)?;
    let args: Vec<String> =
        ["messages", "show", reference, "--before-n", "0", "--after-n", "0", "--no-record", "--json"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
    let (out, json) = call(memo()?, &args, SHOW)?;
    if out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    let path =
        json.as_ref().and_then(|v| local_path_of(v, reference, attachment)).ok_or("This file is not saved here.")?;
    let file = std::path::Path::new(&path)
        .canonicalize()
        .ok()
        .filter(|f| f.is_file())
        .ok_or("The saved file is not on this computer any more.")?;
    crate::memory::open_file(&file)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const REF: &str = "msg:telegram/1001/-2002/77";

    fn output(code: i32) -> run::Output {
        run::Output { code: Some(code), stdout: String::new(), stderr: String::new() }
    }

    #[test]
    fn reads_a_message_reference_only_as_the_store_writes_it() {
        let (place, message) = place_of("msg:email/owner%40example.com/t%2F1/%3Cid%3E").unwrap();
        assert_eq!(
            (place.account.as_str(), place.chat.as_str(), message.as_str()),
            ("owner@example.com", "t/1", "<id>")
        );
        for bad in
            ["chat:telegram/1/2", "msg:telegram/1/2", "msg:telegram/1/2/3/4", "msg:Tele/1/2/3", "msg:telegram/1/%2/3"]
        {
            assert!(place_of(bad).is_err(), "{bad}");
        }
        assert!(place_of("msg:email/owner@example.com/t/1").is_err());
        assert!(checked(REF, 0).is_err());
    }

    #[test]
    fn runs_each_messengers_own_images_read_and_none_is_released_yet() {
        for id in ["tg", "max", "wa"] {
            let src = crate::catalog::tool(id).unwrap().images_read.as_ref().unwrap();
            // No messenger on npm has cli-core 0.643.0's `images read` yet; its first version becomes the gate here.
            assert_eq!(src.min_version, None);
            assert_eq!(
                read_args(src, "personal", REF, 2).join(" "),
                "personal images read msg:telegram/1001/-2002/77 --attachment 2 --record --json"
            );
        }
    }

    // Written from cli-core's `src/services/attachments.ts` `readPicture` (#2881), not captured from a run.
    #[test]
    fn keeps_the_text_the_agent_read() {
        let v = json!({"item": {"ref": REF, "attachment": 2, "origin": "agent", "extractor": "agent:claude",
            "chars": 11, "replaced": "ocr", "text": "OPEN 9 - 18"}});
        assert_eq!(
            read_of(&v),
            Some(PictureRead::Read {
                text: "OPEN 9 - 18".into(),
                extractor: Some("agent:claude".into()),
                replaced: Some("ocr".into())
            })
        );
        let long = json!({"item": {"text": "a".repeat(MAX_TEXT + 5)}});
        let Some(PictureRead::Read { text, .. }) = read_of(&long) else { panic!() };
        assert_eq!(text.chars().count(), MAX_TEXT + 1);
    }

    #[test]
    fn words_the_picture_reading_refusals_and_names_the_agent_to_install() {
        let refused = |reason: &str, message: &str| json!({"error": {"reason": reason, "message": message}});
        assert_eq!(refusal(&output(1), Some(&refused("picture-reading.off", "off"))), "picture-reading.off");
        assert_eq!(
            refusal(&output(1), Some(&refused("picture-reading.unavailable", "Codex CLI is not installed"))),
            "picture-reading.unavailable:codex"
        );
        assert_eq!(
            refusal(&output(1), Some(&refused("picture-reading.unavailable", "Claude Code is not installed"))),
            "picture-reading.unavailable:claude"
        );
        assert_eq!(refusal(&output(1), Some(&refused("auth.expired", "sign in again"))), "sign in again");
    }

    #[test]
    fn finds_the_saved_copy_of_the_asked_file_only() {
        let v = json!({"items": [
            {"ref": "msg:telegram/1001/-2002/76", "attachments": [{"kind": "photo", "local_path": "/x/other.jpg"}]},
            {"ref": REF, "attachments": [{"kind": "webpage"}, {"kind": "photo", "local_path": "/x/sign.jpg"}]}
        ]});
        assert_eq!(local_path_of(&v, REF, 2).as_deref(), Some("/x/sign.jpg"));
        assert_eq!(local_path_of(&v, REF, 1), None);
        assert_eq!(local_path_of(&v, REF, 3), None);
        assert_eq!(local_path_of(&v, "msg:telegram/1001/-2002/75", 1), None);
    }
}
