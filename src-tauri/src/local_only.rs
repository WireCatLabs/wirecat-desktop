//! Settings "Only this computer": memo's `models local-only show|set`, one switch that keeps every model call of every
//! `WireCat` tool on this computer, and where each feature sends its data now. Only the owner turns it off; the window
//! says so with `--from-app`.

use crate::catalog::Tool;
use crate::skills::{body, call, failure};
use crate::{redact, run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);
/// memo's reasons the window words itself.
const WORDED: [&str; 2] = ["local-only.refused", "local-only.owner-only"];
/// What memo reports for a section it cannot read, which counts as on: no real time the owner turned it on.
const UNREADABLE_SINCE: &str = "1970-01-01T00:00:00.000Z";
const MAX_ID: usize = 40;
const MAX_TITLE: usize = 120;
const MAX_ADDRESS: usize = 500;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOnlySource {
    /// The first memo on npm with `models local-only`; `None` would mean none is released, which counts as too old.
    pub min_version: Option<String>,
    pub show: Vec<String>,
    pub on: Vec<String>,
    pub off: Vec<String>,
}

/// One feature and where its data goes now: `this-computer`, `elsewhere`, `agent` or `off`.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalOnlyFeature {
    pub id: String,
    /// memo's English name, shown only for an id the window has no words for.
    pub title: String,
    #[serde(rename = "where")]
    pub place: String,
    pub address: Option<String>,
    /// Local only is on and stops this feature until it uses a model on this computer.
    pub refused: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalOnlyStatus {
    pub on: bool,
    /// When the owner turned it on; `None` while off, or when memo could not read the setting (which counts as on).
    pub since: Option<String>,
    pub features: Vec<LocalOnlyFeature>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum LocalOnly {
    /// The installed memo is older than `need`, or `need` is `None`: no memo with it is released yet.
    Old {
        version: Option<String>,
        need: Option<String>,
    },
    Ready {
        status: Box<LocalOnlyStatus>,
    },
}

fn memo() -> Result<(&'static Tool, &'static LocalOnlySource), String> {
    let tool = crate::catalog::tool("memo")?;
    let src = tool.local_only.as_ref().ok_or("memo has no local only")?;
    Ok((tool, src))
}

fn installed_version(tool: &Tool) -> Option<String> {
    tools::detect(tool, false).installs.first().and_then(|i| i.version.clone())
}

fn gate(src: &LocalOnlySource, version: Option<&str>) -> bool {
    src.min_version.as_deref().is_some_and(|need| !tools::older(version, need))
}

fn clean(v: &Value, max: usize) -> Option<String> {
    v.as_str().filter(|s| !s.is_empty() && s.len() <= max && !s.chars().any(char::is_control)).map(str::to_string)
}

fn feature_of(f: &Value) -> Option<LocalOnlyFeature> {
    let id = clean(&f["id"], MAX_ID).filter(|id| {
        id.starts_with(|c: char| c.is_ascii_lowercase())
            && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    })?;
    Some(LocalOnlyFeature {
        title: clean(&f["title"], MAX_TITLE).unwrap_or_else(|| id.clone()),
        id,
        place: clean(&f["where"], MAX_ID)?,
        address: clean(&f["address"], MAX_ADDRESS).map(|a| redact::text(&a)),
        refused: f["refused"].as_bool().unwrap_or(false),
    })
}

fn status_of(v: &Value) -> Option<LocalOnlyStatus> {
    let item = body(v);
    let on = item["on"].as_bool()?;
    Some(LocalOnlyStatus {
        on,
        since: item["since"].as_str().filter(|s| on && *s != UNREADABLE_SINCE).map(str::to_string),
        features: item["features"].as_array()?.iter().filter_map(feature_of).collect(),
    })
}

/// memo's refusal: one of `WORDED` as its id, anything else in memo's own words, masked.
fn refusal(out: &run::Output, json: Option<&Value>) -> String {
    match json.and_then(|v| v["error"]["reason"].as_str()) {
        Some(reason) if WORDED.contains(&reason) => reason.to_string(),
        _ => failure(out, json),
    }
}

fn ask(tool: &Tool, args: &[String]) -> Result<LocalOnlyStatus, String> {
    let (out, json) = call(tool, args, CALL)?;
    if out.code != Some(0) {
        return Err(refusal(&out, json.as_ref()));
    }
    json.as_ref().and_then(status_of).ok_or_else(|| "memo gave an answer the app cannot read".to_string())
}

pub fn status() -> Result<LocalOnly, String> {
    let (tool, src) = memo()?;
    let version = installed_version(tool);
    if !gate(src, version.as_deref()) {
        return Ok(LocalOnly::Old { version, need: src.min_version.clone() });
    }
    Ok(LocalOnly::Ready { status: Box::new(ask(tool, &src.show)?) })
}

/// The owner moved the switch in Settings; memo's answer is the whole new state.
pub fn set(on: bool) -> Result<LocalOnlyStatus, String> {
    let (tool, src) = memo()?;
    if !gate(src, installed_version(tool).as_deref()) {
        return Err("This memo has no local only yet. It comes with a memo update.".into());
    }
    ask(tool, if on { &src.on } else { &src.off })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Written from cli-core 0.642.0's `src/cli/local-only-command.ts` (memo 0.131.85), not captured from a run.
    fn answer(on: bool, since: Option<&str>) -> Value {
        json!({"item": {"on": on, "since": since, "features": [
            {"id": "ai_model", "title": "AI model", "where": "this-computer",
             "address": "http://localhost:11434", "refused": false, "note": "`memo models ai set` chooses it"},
            {"id": "enrichment", "title": "Rewrite records for better search", "where": "elsewhere",
             "address": "https://api.openai.com/v1", "refused": on, "note": "`memo models consents`"},
            {"id": "digest", "title": "Digest", "where": "agent", "address": null, "refused": false,
             "note": "runs Claude Code or Codex"},
            {"id": "--yes", "title": "odd", "where": "off", "address": null, "refused": false, "note": ""}
        ]}})
    }

    fn output(code: i32) -> run::Output {
        run::Output { code: Some(code), stdout: String::new(), stderr: String::new() }
    }

    #[test]
    fn runs_memos_own_commands_and_says_it_is_the_owner_only_when_turning_off() {
        let (_, src) = memo().unwrap();
        assert_eq!(src.show.join(" "), "models local-only show --no-record --json");
        assert_eq!(src.on.join(" "), "models local-only set on --from-app --record --json");
        assert_eq!(src.off.join(" "), "models local-only set off --from-app --record --json");
    }

    #[test]
    fn a_memo_not_yet_released_counts_as_too_old() {
        let (_, src) = memo().unwrap();
        // memo 0.131.85 (cli-core 0.642.0) is the first with `models local-only`.
        assert_eq!(src.min_version.as_deref(), Some("0.131.85"));
        assert!(!gate(src, Some("0.131.84")));
        assert!(!gate(&LocalOnlySource { min_version: None, show: vec![], on: vec![], off: vec![] }, Some("9.0.0")));
        let released = LocalOnlySource { min_version: Some("0.131.86".into()), show: vec![], on: vec![], off: vec![] };
        assert!(!gate(&released, Some("0.131.84")));
        assert!(gate(&released, Some("0.131.86")));
    }

    #[test]
    fn reads_each_feature_with_where_it_runs_and_drops_an_odd_id() {
        let s = status_of(&answer(true, Some("2026-11-12T09:00:00.000Z"))).unwrap();
        assert!(s.on);
        assert_eq!(s.since.as_deref(), Some("2026-11-12T09:00:00.000Z"));
        assert_eq!(s.features.len(), 3);
        assert_eq!(s.features[0].place, "this-computer");
        assert_eq!(s.features[0].address.as_deref(), Some("http://localhost:11434"));
        assert!(s.features[1].refused);
        assert_eq!((s.features[2].place.as_str(), s.features[2].address.as_deref()), ("agent", None));
        let off = status_of(&answer(false, None)).unwrap();
        assert!(!off.on && off.since.is_none() && !off.features[1].refused);
        assert!(status_of(&json!({"item": {"on": true}})).is_none());
    }

    #[test]
    fn an_unreadable_setting_is_on_with_no_date() {
        let s = status_of(&answer(true, Some(UNREADABLE_SINCE))).unwrap();
        assert!(s.on);
        assert_eq!(s.since, None);
    }

    #[test]
    fn words_memos_local_only_refusals_and_passes_the_rest_on() {
        let refused =
            |reason: &str| json!({"error": {"reason": reason, "message": "only the owner turns local only off"}});
        assert_eq!(refusal(&output(1), Some(&refused("local-only.owner-only"))), "local-only.owner-only");
        assert_eq!(refusal(&output(1), Some(&refused("local-only.refused"))), "local-only.refused");
        assert_eq!(refusal(&output(2), Some(&refused("input.invalid"))), "only the owner turns local only off");
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(LocalOnly::Old { version: Some("0.131.84".into()), need: None }).unwrap(),
            json!({"state": "old", "version": "0.131.84", "need": null})
        );
        let status = status_of(&answer(true, Some("2026-11-12T09:00:00.000Z"))).unwrap();
        let v = serde_json::to_value(LocalOnly::Ready { status: Box::new(status) }).unwrap();
        assert_eq!(v["state"], "ready");
        assert_eq!(v["status"]["features"][1]["where"], "elsewhere");
        assert_eq!(v["status"]["features"][1]["refused"], true);
    }
}
