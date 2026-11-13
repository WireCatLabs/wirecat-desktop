//! A client's calls and recorded meetings, as cli-core 0.650.0 and later reads them: `meetings` on a CRM's
//! `deals show` and `leads show`, and on memo's person context. A CLI from before leaves the field out, and the card
//! shows nothing. A call opens in the tool that recorded it (catalog `meetings`, found by cli-core's provider name)
//! with the profile the owner chose. Titles, names and transcripts are other people's words on the owner's own page:
//! shown as plain text, never logged.

use crate::catalog::{self, MeetingsSource, Tool};
use crate::memo_cli::Failure;
use serde::Serialize;
use serde_json::Value;
use specta::Type;
use std::time::Duration;

const READ: Duration = Duration::from_mins(1);

/// One item of cli-core's `meetings`: the row the card lists.
#[derive(Serialize, Type, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClientCall {
    /// `meeting:<account>/<meeting>`.
    #[serde(rename = "ref")]
    pub reference: String,
    /// The stored id the recording tool's `meetings show` and `meetings transcript` take.
    pub meeting_id: u32,
    pub provider: String,
    pub account: String,
    /// The catalog tool that opens it; `None` when no tool in `WireCat` records this provider's calls.
    pub tool: Option<String>,
    /// The source's own line: a phone line puts the direction, the manager and the client's number in it.
    pub title: Option<String>,
    pub started_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub has_transcript: bool,
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

pub(crate) fn tool_for(provider: &str) -> Option<(&'static Tool, &'static MeetingsSource)> {
    catalog::catalog().tools.iter().find_map(|t| t.meetings.as_ref().filter(|m| m.provider == provider).map(|m| (t, m)))
}

fn call(v: &Value) -> Option<ClientCall> {
    let account = &v["account"];
    let provider = text(account, "provider")?;
    Some(ClientCall {
        reference: text(v, "ref").filter(|r| r.starts_with("meeting:"))?,
        meeting_id: v["meeting_id"].as_u64().and_then(|id| u32::try_from(id).ok())?,
        tool: tool_for(&provider).map(|(t, _)| t.id.clone()),
        provider,
        account: text(account, "account")?,
        title: text(v, "title"),
        started_at: text(v, "started_at"),
        duration_ms: v["duration_ms"].as_u64(),
        has_transcript: v["has_transcript"].as_bool().unwrap_or(false),
    })
}

/// `None` when the answer has no `meetings` at all: the installed CLI is older than cli-core 0.650.0.
pub fn calls_of(answer: &Value) -> Option<Vec<ClientCall>> {
    Some(answer.get("meetings")?.as_array()?.iter().filter_map(call).collect())
}

/// What the recording tool printed for one call, as it printed it: the interface reads the participants and lines.
#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CallOpened {
    #[specta(type = specta_typescript::Unknown)]
    pub show: Value,
    /// Only when the call has a transcript.
    #[specta(type = Option<specta_typescript::Unknown>)]
    pub transcript: Option<Value>,
}

fn words(template: &[String], profile: &str, id: u32) -> Result<Vec<String>, Failure> {
    catalog::validate_profile(profile).map_err(Failure::plain)?;
    let id = id.to_string();
    Ok(template
        .iter()
        .map(|w| match w.as_str() {
            "{profile}" => profile.to_string(),
            "{id}" => id.clone(),
            _ => w.clone(),
        })
        .collect())
}

pub(crate) fn open_with(
    call: &dyn Fn(&[String]) -> Result<Value, Failure>,
    src: &MeetingsSource,
    profile: &str,
    id: u32,
    transcript: bool,
) -> Result<CallOpened, Failure> {
    let show = call(&words(&src.show, profile, id)?)?;
    let transcript = if transcript { Some(call(&words(&src.transcript, profile, id)?)?) } else { None };
    Ok(CallOpened { show, transcript })
}

pub fn open(tool: &str, profile: &str, id: u32, transcript: bool) -> Result<CallOpened, Failure> {
    let tool = catalog::tool(tool).map_err(Failure::plain)?;
    let src = tool.meetings.as_ref().ok_or_else(|| Failure::plain(format!("{} records no calls", tool.name)))?;
    let bin =
        crate::tools::program(&tool.bin).ok_or_else(|| Failure::plain(format!("{} is not installed", tool.name)))?;
    open_with(&|args: &[String]| crate::memo_cli::spawn_at(&bin, args, READ), src, profile, id, transcript)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    /// cli-core's `deals show` item since 0.650.0 (`src/crm/cli/index.ts`), with a call from a phone line and a Zoom
    /// meeting; the numbers and names are made up.
    fn shown() -> Value {
        json!({
            "ref": "deal:12",
            "meetings": [
                { "ref": "meeting:4/77", "meeting_id": 77, "account": { "provider": "asterisk", "account": "office" },
                  "title": "+34 600 111 222 → 201", "started_at": "2026-11-12T09:30:00.000Z", "duration_ms": 184_000,
                  "has_transcript": true, "event": null, "people": ["person:7"] },
                { "ref": "meeting:2/5", "meeting_id": 5, "account": { "provider": "zoom", "account": "ana@example.org" },
                  "title": null, "started_at": null, "duration_ms": null, "has_transcript": false, "event": "event:3",
                  "people": ["person:7"] },
                { "ref": "meeting:9/1", "meeting_id": 1, "account": { "provider": "beeline", "account": "line" },
                  "title": "Входящий звонок · Ана ↔ +79001112233", "started_at": "2026-11-11T08:00:00.000Z",
                  "duration_ms": 60_000, "has_transcript": false, "event": null, "people": ["person:7"] },
                { "ref": "deal:1", "meeting_id": 1, "account": { "provider": "zoom", "account": "x" } }
            ]
        })
    }

    #[test]
    fn each_call_keeps_its_line_time_length_transcript_and_the_tool_that_opens_it() {
        let calls = calls_of(&shown()).unwrap();
        assert_eq!(calls.len(), 3, "a ref that is not a meeting is left out");
        assert_eq!(calls[0].tool.as_deref(), Some("pbx"));
        assert_eq!(calls[0].meeting_id, 77);
        assert_eq!(calls[0].duration_ms, Some(184_000));
        assert!(calls[0].has_transcript);
        assert_eq!(calls[1].tool.as_deref(), Some("zm"));
        assert_eq!(calls[1].title, None);
        assert_eq!(calls[2].tool, None, "beeline is not a WireCat tool yet");
    }

    #[test]
    fn an_older_cli_without_meetings_gives_nothing_not_an_empty_list() {
        assert_eq!(calls_of(&json!({ "ref": "deal:12" })), None);
        assert_eq!(calls_of(&json!({ "meetings": [] })), Some(vec![]));
    }

    #[test]
    fn a_call_opens_with_the_chosen_profile_and_reads_the_transcript_only_when_there_is_one() {
        let (_, src) = tool_for("asterisk").unwrap();
        let seen = Mutex::new(Vec::new());
        let call = |args: &[String]| -> Result<Value, Failure> {
            seen.lock().unwrap().push(args.to_vec());
            Ok(json!({ "item": {} }))
        };
        let opened = open_with(&call, src, "office", 77, false).unwrap();
        assert_eq!(opened.transcript, None);
        open_with(&call, src, "office", 77, true).unwrap();
        assert!(open_with(&call, src, "--yes", 77, false).is_err());
        let seen = seen.lock().unwrap();
        assert_eq!(seen.len(), 3);
        assert_eq!(seen[0], ["office", "meetings", "show", "77", "--no-record", "--json"]);
        assert_eq!(seen[2], ["office", "meetings", "transcript", "77", "--no-record", "--json"]);
    }
}
