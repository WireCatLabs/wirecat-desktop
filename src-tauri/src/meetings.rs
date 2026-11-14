//! The Meetings page: meetings, calls and calendar events of every account, through memo's own `meetings list|show`.
//! Titles, names and transcript text are the owner's own data on the owner's own page, shown unmasked like the
//! Documents and People pages, never logged.

use crate::catalog::{self, Tool};
use crate::memo_cli::{self, Failure};
use crate::skills::body;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_mins(1);
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// memo's own bounds: a list page holds 1–1000 rows, a transcript read 1–2000 lines.
const MAX_LIMIT: u32 = 1_000;
pub const TRANSCRIPT_PART: u32 = 1_000;
const MAX_QUERY: usize = 2_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingsPageSource {
    pub min_version: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingSource {
    pub provider: String,
    pub account: String,
    pub source: String,
    pub label: String,
    /// `calendar` or `meeting`: which kind of record of this row the source gave.
    pub via: String,
    /// The calendar's own name inside the account, for a calendar copy.
    pub calendar: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingLink {
    pub source: String,
    pub url: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingPerson {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingParticipant {
    pub name: Option<String>,
    pub email: Option<String>,
    pub person: Option<MeetingPerson>,
    pub organizer: bool,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingDocument {
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: Option<String>,
    pub role: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools, reason = "the flags mirror memo's answer, one per thing a meeting has")]
pub struct MeetingRow {
    #[serde(rename = "ref")]
    pub reference: String,
    /// `meeting`, `call` or `event`.
    pub kind: String,
    pub title: Option<String>,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub all_day: bool,
    pub timezone: Option<String>,
    pub status: Option<String>,
    /// Join links, `https` only: each opens in its own app.
    pub links: Vec<MeetingLink>,
    pub sources: Vec<MeetingSource>,
    pub participants: Vec<MeetingParticipant>,
    pub participants_count: u64,
    pub has_recording: bool,
    pub has_transcript: bool,
    pub has_summary: bool,
    pub documents: Vec<MeetingDocument>,
    pub pending_findings: u64,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingPage {
    pub meetings: Vec<MeetingRow>,
    pub total: u64,
    /// memo stopped counting: `total` is a floor.
    pub total_more: bool,
    pub more: bool,
    /// Every account memo read (`provider:account`): what a `source:` term may name. memo refuses one it does not hold,
    /// so the Source menu offers only these.
    pub accounts: Vec<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MeetingsRead {
    Missing,
    /// The installed memo has no Meetings page commands; the page offers its update.
    Old {
        version: Option<String>,
        need: String,
    },
    Ready {
        page: MeetingPage,
    },
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingSection {
    pub label: String,
    pub text: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingSummary {
    pub source: String,
    pub title: Option<String>,
    pub overview: Option<String>,
    pub sections: Vec<MeetingSection>,
    pub next_steps: Vec<String>,
    /// The notes document the summary came from, `https` only.
    pub url: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptLine {
    pub position: u64,
    pub offset_ms: u64,
    pub speaker: Option<String>,
    pub person: Option<MeetingPerson>,
    pub text: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    pub source: String,
    pub language: Option<String>,
    pub offset: u64,
    pub total: u64,
    pub has_more: bool,
    pub lines: Vec<TranscriptLine>,
}

/// A batch of findings that cite the meeting; Memory decides it.
#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct MeetingFindings {
    pub id: String,
    pub status: String,
    pub findings: u64,
    pub pending: u64,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingDetails {
    pub meeting: MeetingRow,
    pub description: Option<String>,
    pub location: Option<String>,
    pub summaries: Vec<MeetingSummary>,
    pub transcript: Option<Transcript>,
    pub findings: Vec<MeetingFindings>,
}

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn count(v: &Value, key: &str) -> u64 {
    v[key].as_u64().unwrap_or(0)
}

fn flag(v: &Value, key: &str) -> bool {
    v[key].as_bool().unwrap_or(false)
}

fn items_at<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v[key].as_array().map_or(&[], Vec::as_slice)
}

fn strings(v: &Value, key: &str) -> Vec<String> {
    items_at(v, key).iter().filter_map(|s| s.as_str().map(str::to_string)).collect()
}

/// `event:<id>` or `meeting:<account>/<id>`, as memo lists them; it goes to memo after `--`.
fn meeting_ref(s: &str) -> Result<&str, String> {
    let ok = match s.split_once(':') {
        Some(("event", id)) => !id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()),
        Some(("meeting", rest)) => rest.split_once('/').is_some_and(|(a, id)| !a.is_empty() && !id.is_empty()),
        _ => false,
    };
    if !ok || s.len() > 300 || s.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(format!("not a meeting: {s}"));
    }
    Ok(s)
}

/// An instant with its offset, as the page builds a window's ends from local midnights.
fn instant(s: &str) -> Result<&str, String> {
    if chrono::DateTime::parse_from_rfc3339(s).is_err() {
        return Err(format!("not an instant: {s}"));
    }
    Ok(s)
}

fn person_of(v: &Value) -> Option<MeetingPerson> {
    Some(MeetingPerson { reference: text(v, "ref")?, name: text(v, "name") })
}

fn row_of(v: &Value) -> Option<MeetingRow> {
    let reference = text(v, "ref")?;
    meeting_ref(&reference).ok()?;
    Some(MeetingRow {
        reference,
        kind: text(v, "kind").unwrap_or_else(|| "event".into()),
        title: text(v, "title"),
        started_at: text(v, "started_at"),
        ended_at: text(v, "ended_at"),
        duration_ms: v["duration_ms"].as_u64(),
        all_day: flag(v, "all_day"),
        timezone: text(v, "timezone"),
        status: text(v, "status"),
        links: items_at(v, "links")
            .iter()
            .filter_map(|l| Some(MeetingLink { source: text(l, "source")?, url: text(l, "url")? }))
            .filter(|l| l.url.starts_with("https://"))
            .collect(),
        sources: items_at(v, "sources")
            .iter()
            .filter_map(|s| {
                Some(MeetingSource {
                    provider: text(s, "provider")?,
                    account: text(s, "account").unwrap_or_default(),
                    source: text(s, "source")?,
                    label: text(s, "label").unwrap_or_default(),
                    via: text(s, "via").unwrap_or_default(),
                    calendar: text(s, "calendar"),
                })
            })
            .collect(),
        participants: items_at(v, "participants")
            .iter()
            .map(|p| MeetingParticipant {
                name: text(p, "name"),
                email: text(p, "email"),
                person: person_of(&p["person"]),
                organizer: flag(p, "organizer"),
            })
            .collect(),
        participants_count: count(v, "participants_count"),
        has_recording: flag(v, "has_recording"),
        has_transcript: flag(v, "has_transcript"),
        has_summary: flag(v, "has_summary"),
        documents: items_at(v, "documents")
            .iter()
            .filter_map(|d| {
                Some(MeetingDocument { reference: text(d, "ref")?, title: text(d, "title"), role: text(d, "role") })
            })
            .collect(),
        pending_findings: count(v, "pending_findings"),
    })
}

fn transcript_of(v: &Value) -> Option<Transcript> {
    if !v.is_object() {
        return None;
    }
    Some(Transcript {
        source: text(v, "source").unwrap_or_default(),
        language: text(v, "language"),
        offset: count(v, "offset"),
        total: count(v, "total"),
        has_more: flag(v, "has_more"),
        lines: items_at(v, "lines")
            .iter()
            .map(|l| TranscriptLine {
                position: count(l, "position"),
                offset_ms: count(l, "offset_ms"),
                speaker: text(l, "speaker"),
                person: person_of(&l["person"]),
                text: l["text"].as_str().unwrap_or_default().to_string(),
            })
            .collect(),
    })
}

fn details_of(v: &Value) -> Option<MeetingDetails> {
    Some(MeetingDetails {
        meeting: row_of(v)?,
        description: text(v, "description"),
        location: text(v, "location"),
        summaries: items_at(v, "summaries")
            .iter()
            .map(|s| MeetingSummary {
                source: text(s, "source").unwrap_or_default(),
                title: text(s, "title"),
                overview: text(s, "overview"),
                sections: items_at(s, "sections")
                    .iter()
                    .filter_map(|x| Some(MeetingSection { label: text(x, "label")?, text: text(x, "text")? }))
                    .collect(),
                next_steps: strings(s, "next_steps"),
                url: text(s, "url").filter(|u| u.starts_with("https://")),
            })
            .collect(),
        transcript: transcript_of(&v["transcript"]),
        findings: items_at(v, "findings")
            .iter()
            .filter_map(|f| {
                Some(MeetingFindings {
                    id: f["id"].as_u64().map(|n| n.to_string()).or_else(|| text(f, "id"))?,
                    status: text(f, "status").unwrap_or_default(),
                    findings: count(f, "findings"),
                    pending: count(f, "pending"),
                })
            })
            .collect(),
    })
}

/// What a read covers: a calendar's visible days, oldest first so a cut window is whole up to its last day, or the
/// whole history newest first for the table.
#[derive(Debug, PartialEq)]
pub enum Window<'a> {
    Days { from: &'a str, to: &'a str },
    All,
}

type Call<'a> = memo_cli::Call<'a>;

/// The search and the window go to memo as one word after `--`, so neither can read as an option. `--order` is always
/// passed: a memo from before these commands has Core's own `meetings list`, and refuses it as unknown.
fn list_args(query: &str, window: &Window, page: u32, limit: u32) -> Result<Vec<String>, String> {
    let q = query.trim();
    if q.len() > MAX_QUERY || q.chars().any(char::is_control) {
        return Err("That search is too long.".into());
    }
    let (span, order) = match window {
        Window::Days { from, to } => (format!("started_at:[{} TO {}}}", instant(from)?, instant(to)?), "start"),
        Window::All => ("started_at:[* TO *]".to_string(), "recent"),
    };
    let (limit, page) = (limit.to_string(), page.to_string());
    let mut args = words(&["meetings", "list", "--order", order, "--limit", &limit, "--page", &page]);
    args.extend(["--".to_string(), if q.is_empty() { span } else { format!("{span} {q}") }]);
    Ok(args)
}

fn list_with(call: &Call, query: &str, window: &Window, page: u32, limit: u32) -> Result<MeetingPage, Failure> {
    let v = call(&list_args(query, window, page, limit).map_err(Failure::plain)?)?;
    let total = &v["page"]["total"];
    let meetings: Vec<MeetingRow> = items_at(&v, "items").iter().filter_map(row_of).collect();
    Ok(MeetingPage {
        total: total["value"].as_u64().unwrap_or(meetings.len() as u64),
        total_more: total["relation"].as_str().is_some_and(|r| r != "eq"),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
        accounts: strings(&v["meta"], "accounts"),
        meetings,
    })
}

fn show_with(call: &Call, reference: &str, cursor: u64) -> Result<MeetingDetails, Failure> {
    let (cursor, limit) = (cursor.to_string(), TRANSCRIPT_PART.to_string());
    let mut args = words(&["meetings", "show", "--cursor", &cursor, "--limit", &limit]);
    args.extend(["--".to_string(), reference.to_string()]);
    let v = call(&args)?;
    details_of(body(&v)).ok_or_else(|| Failure::plain("Memo's answer about this meeting could not be read."))
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

/// Rows of one window or one table page, or why memo cannot give them.
pub fn list(query: &str, window: &Window, page: u32, limit: u32) -> Result<MeetingsRead, String> {
    if page == 0 || !(1..=MAX_LIMIT).contains(&limit) {
        return Err("That page of meetings does not exist.".into());
    }
    let tool = memo()?;
    let need = tool.meetings_page.as_ref().ok_or("Memo has no Meetings commands in the catalog")?.min_version.clone();
    let state = crate::tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(MeetingsRead::Missing) };
    if crate::tools::older(first.version.as_deref(), &need) {
        return Ok(MeetingsRead::Old { version: first.version.clone(), need });
    }
    let version = first.version.clone();
    memo_cli::with_memo(TIMEOUT, |call| match list_with(call, query, window, page, limit) {
        Err(f) if f.unknown_command() => Ok(MeetingsRead::Old { version, need }),
        r => r.map(|page| MeetingsRead::Ready { page }),
    })
}

pub fn show(reference: &str, cursor: u64) -> Result<MeetingDetails, String> {
    let reference = meeting_ref(reference)?;
    memo_cli::with_memo(TIMEOUT, |call| show_with(call, reference, cursor))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn row() -> Value {
        json!({
            "ref": "event:665", "kind": "meeting", "title": "Board review",
            "started_at": "2026-11-13T11:00:00.000Z", "ended_at": "2026-11-13T14:00:00.000Z",
            "duration_ms": 10_800_000, "all_day": false, "timezone": "Europe/Madrid", "status": "confirmed",
            "url": "https://meet.google.com/abc-defg-hij",
            "links": [{ "source": "meet", "url": "https://meet.google.com/abc-defg-hij" },
                      { "source": "zoom", "url": "zoommtg://zoom.us/join?confno=1" }],
            "sources": [{ "provider": "google-calendar", "account": "ana@example.org",
                          "source": "google-calendar:ana@example.org", "label": "Google Calendar · ana@example.org",
                          "via": "calendar", "calendar": "primary", "ref": "event:665" }],
            "meetings": ["meeting:ana@example.org/91"],
            "participants": [{ "name": "Lena Ortiz", "email": "lena@example.org",
                               "person": { "ref": "person:7", "name": "Lena Ortiz" }, "organizer": true },
                             { "name": null, "email": "kai@example.org", "person": null, "organizer": false }],
            "participants_count": 2, "has_recording": true, "has_transcript": true, "has_summary": false,
            "documents": [{ "ref": "document:40", "title": "Q4 plan", "role": "attachment" }],
            "pending_findings": 3, "untrusted": ["title"]
        })
    }

    #[test]
    fn reads_a_calendar_window_oldest_first_as_one_query_word() {
        let seen = Mutex::new(Vec::new());
        let call = |args: &[String]| {
            seen.lock().unwrap().push(args.to_vec());
            Ok(json!({ "items": [row(), { "ref": "note:1" }],
                       "page": { "has_more": false, "total": { "value": 1, "relation": "eq" } },
                       "meta": { "accounts": ["google-calendar:ana@example.org", "zoom:ana@example.org"] } }))
        };
        let window = Window::Days { from: "2026-11-09T00:00:00+01:00", to: "2026-11-16T00:00:00+01:00" };
        let page = list_with(&call, " kind:call ", &window, 1, 500).unwrap();
        assert_eq!(page.meetings.len(), 1, "a row that is not a meeting is left out");
        assert_eq!(page.meetings[0].links.len(), 1, "only an https join link is kept");
        assert_eq!(page.meetings[0].participants[0].person.as_ref().unwrap().reference, "person:7");
        assert_eq!(page.meetings[0].pending_findings, 3);
        assert_eq!(page.accounts, ["google-calendar:ana@example.org", "zoom:ana@example.org"]);
        assert_eq!(
            seen.lock().unwrap()[0],
            [
                "meetings",
                "list",
                "--order",
                "start",
                "--limit",
                "500",
                "--page",
                "1",
                "--json",
                "--no-record",
                "--",
                "started_at:[2026-11-09T00:00:00+01:00 TO 2026-11-16T00:00:00+01:00} kind:call"
            ]
        );
    }

    #[test]
    fn reads_the_table_over_all_time_newest_first() {
        let args = list_args("", &Window::All, 2, 25).unwrap();
        assert_eq!(args[2..4], ["--order", "recent"]);
        assert_eq!(args.last().unwrap(), "started_at:[* TO *]");
    }

    #[test]
    fn refuses_a_window_end_that_is_not_an_instant() {
        let window = Window::Days { from: "2026-11-09", to: "2026-11-16T00:00:00Z] OR *" };
        assert!(list_args("", &window, 1, 500).is_err());
    }

    #[test]
    fn takes_only_meeting_and_event_refs() {
        assert!(meeting_ref("event:665").is_ok());
        assert!(meeting_ref("meeting:ana@example.org/91").is_ok());
        for bad in ["event:", "event:6a", "meeting:91", "person:7", "--json", "meeting:a/1 x"] {
            assert!(meeting_ref(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn reads_a_meeting_with_its_transcript_summaries_and_findings() {
        let call = |args: &[String]| {
            assert_eq!(args[..6], ["meetings", "show", "--cursor", "1000", "--limit", "1000"]);
            assert_eq!(args.last().unwrap(), "event:665");
            let mut v = row();
            v["description"] = json!("Agenda");
            v["summaries"] = json!([{ "meeting": "meeting:ana@example.org/91", "source": "zoom", "title": null,
                "overview": "The board agreed.", "sections": [{ "label": "Budget", "text": "Up 4%" }],
                "next_steps": ["Send the plan"], "url": null }]);
            v["transcript"] = json!({ "meeting": "meeting:ana@example.org/91", "source": "zoom", "language": "en",
                "offset": 1000, "total": 1200, "has_more": true,
                "lines": [{ "position": 1000, "offset_ms": 4000, "end_ms": 9000, "speaker": "Lena",
                            "person": { "ref": "person:7", "name": "Lena Ortiz" }, "text": "Numbers first." }] });
            v["findings"] = json!([{ "id": 12, "status": "proposed", "findings": 4, "pending": 3 }]);
            Ok(json!({ "item": v }))
        };
        let d = show_with(&call, "event:665", 1_000).unwrap();
        let t = d.transcript.unwrap();
        assert_eq!((t.offset, t.total, t.has_more, t.lines[0].offset_ms), (1000, 1200, true, 4000));
        assert_eq!(d.summaries[0].sections[0].text, "Up 4%");
        assert_eq!(d.findings[0].id, "12");
        assert_eq!(d.description.as_deref(), Some("Agenda"));
        assert_eq!(d.meeting.sources[0].calendar.as_deref(), Some("primary"));
        assert_eq!(d.summaries[0].url, None);
    }

    #[test]
    fn keeps_a_summary_notes_link_only_when_it_is_https() {
        let mut v = row();
        v["summaries"] = json!([
            { "source": "meet", "sections": [], "next_steps": [], "url": "https://docs.google.com/document/d/1" },
            { "source": "meet", "sections": [], "next_steps": [], "url": "javascript:alert(1)" }
        ]);
        let d = details_of(&v).unwrap();
        assert_eq!(d.summaries[0].url.as_deref(), Some("https://docs.google.com/document/d/1"));
        assert_eq!(d.summaries[1].url, None);
    }

    #[test]
    fn reads_a_meeting_without_a_transcript() {
        let mut v = row();
        v["transcript"] = Value::Null;
        assert!(details_of(&v).unwrap().transcript.is_none());
    }
}
