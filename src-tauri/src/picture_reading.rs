//! Settings "Reading pictures": memo's `models picture-reading show|set`, whether `images read` may give a picture the
//! owner chose to their coding agent (Claude Code or Codex), and with which model. Only the owner turns it on; the
//! window says so with `--from-app`.

use crate::catalog::Tool;
use crate::skills::{body, call, failure};
use crate::{run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);
/// memo's reasons the window words itself.
const WORDED: [&str; 2] = ["picture-reading.owner-only", "picture-reading.agent-missing"];
const MODES: [&str; 2] = ["never", "request"];
const AGENTS: [&str; 2] = ["claude", "codex"];
const MAX_MODEL: usize = 100;
const MAX_EXTRACTOR: usize = 120;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PictureReadingSource {
    /// The first memo on npm with `models picture-reading`; `None` means none is released, which counts as too old.
    pub min_version: Option<String>,
    pub show: Vec<String>,
    /// `{mode}` filled here; `{agent}` and `{model}` become a flag and its value, or nothing.
    pub set: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PictureReadingSetting {
    /// `never` or `request`.
    pub mode: String,
    /// `claude` or `codex`; `None` while never.
    pub agent: Option<String>,
    /// The agent's model; `None` for its own default.
    pub model: Option<String>,
    /// What a read picture's text is marked with: `agent:claude`, `agent:codex/gpt-5`.
    pub extractor: Option<String>,
    /// When the owner turned it on.
    pub since: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum PictureReading {
    /// The installed memo is older than `need`, or `need` is `None`: no memo with it is released yet.
    Old {
        version: Option<String>,
        need: Option<String>,
    },
    Ready {
        setting: PictureReadingSetting,
    },
}

fn memo() -> Result<(&'static Tool, &'static PictureReadingSource), String> {
    let tool = crate::catalog::tool("memo")?;
    let src = tool.picture_reading.as_ref().ok_or("memo has no picture reading")?;
    Ok((tool, src))
}

fn installed_version(tool: &Tool) -> Option<String> {
    tools::detect(tool, false).installs.first().and_then(|i| i.version.clone())
}

fn gate(src: &PictureReadingSource, version: Option<&str>) -> bool {
    src.min_version.as_deref().is_some_and(|need| !tools::older(version, need))
}

/// cli-core's `PICTURE_MODEL`: the name goes into the agent's argv, so it never starts with a dash.
pub(crate) fn checked_model(model: &str) -> Result<&str, String> {
    let ok = model.len() <= MAX_MODEL
        && model.starts_with(|c: char| c.is_ascii_alphanumeric())
        && model.chars().all(|c| c.is_ascii_alphanumeric() || "._:/-".contains(c));
    if ok { Ok(model) } else { Err(format!("not a model name: {model}")) }
}

fn set_args(
    src: &PictureReadingSource,
    mode: &str,
    agent: Option<&str>,
    model: Option<&str>,
) -> Result<Vec<String>, String> {
    if !MODES.contains(&mode) {
        return Err(format!("picture reading is never or request, not {mode}"));
    }
    let on = mode == "request";
    let agent = match agent.filter(|_| on) {
        Some(a) if AGENTS.contains(&a) => vec!["--agent".to_string(), a.to_string()],
        Some(a) => return Err(format!("pictures are read by claude or codex, not {a}")),
        None => vec![],
    };
    let model = model.map(str::trim).filter(|m| on && !m.is_empty()).map(checked_model).transpose()?;
    let model = model.map(|m| vec!["--model".to_string(), m.to_string()]).unwrap_or_default();
    let mut out = Vec::with_capacity(src.set.len() + 4);
    for w in &src.set {
        match w.as_str() {
            "{mode}" => out.push(mode.to_string()),
            "{agent}" => out.extend(agent.iter().cloned()),
            "{model}" => out.extend(model.iter().cloned()),
            _ => out.push(w.clone()),
        }
    }
    Ok(out)
}

fn clean(v: &Value, max: usize) -> Option<String> {
    v.as_str().filter(|s| !s.is_empty() && s.len() <= max && !s.chars().any(char::is_control)).map(str::to_string)
}

fn setting_of(v: &Value) -> Option<PictureReadingSetting> {
    let item = body(v);
    let mode = item["mode"].as_str().filter(|m| MODES.contains(m))?.to_string();
    let on = mode == "request";
    Some(PictureReadingSetting {
        agent: item["agent"].as_str().filter(|a| on && AGENTS.contains(a)).map(str::to_string),
        model: clean(&item["model"], MAX_MODEL).filter(|_| on),
        extractor: clean(&item["extractor"], MAX_EXTRACTOR).filter(|_| on),
        since: clean(&item["since"], 40).filter(|_| on),
        mode,
    })
}

fn refusal(out: &run::Output, json: Option<&Value>) -> String {
    match json.and_then(|v| v["error"]["reason"].as_str()) {
        Some(reason) if WORDED.contains(&reason) => reason.to_string(),
        _ => failure(out, json),
    }
}

fn ask(tool: &Tool, args: &[String]) -> Result<PictureReadingSetting, String> {
    let (out, json) = call(tool, args, CALL)?;
    if out.code != Some(0) {
        return Err(refusal(&out, json.as_ref()));
    }
    json.as_ref().and_then(setting_of).ok_or_else(|| "memo gave an answer the app cannot read".to_string())
}

pub fn status() -> Result<PictureReading, String> {
    let (tool, src) = memo()?;
    let version = installed_version(tool);
    if !gate(src, version.as_deref()) {
        return Ok(PictureReading::Old { version, need: src.min_version.clone() });
    }
    Ok(PictureReading::Ready { setting: ask(tool, &src.show)? })
}

/// The owner chose in Settings; memo's answer is the whole new setting.
pub fn set(mode: &str, agent: Option<&str>, model: Option<&str>) -> Result<PictureReadingSetting, String> {
    let (tool, src) = memo()?;
    if !gate(src, installed_version(tool).as_deref()) {
        return Err("This memo cannot read pictures yet. It comes with a memo update.".into());
    }
    ask(tool, &set_args(src, mode, agent, model)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn output(code: i32) -> run::Output {
        run::Output { code: Some(code), stdout: String::new(), stderr: String::new() }
    }

    #[test]
    fn runs_memos_own_commands_and_says_it_is_the_owner() {
        let (_, src) = memo().unwrap();
        assert_eq!(src.show.join(" "), "models picture-reading show --no-record --json");
        assert_eq!(
            set_args(src, "request", Some("codex"), Some(" gpt-5 ")).unwrap().join(" "),
            "models picture-reading set request --agent codex --model gpt-5 --from-app --record --json"
        );
        assert_eq!(
            set_args(src, "request", Some("claude"), Some("")).unwrap().join(" "),
            "models picture-reading set request --agent claude --from-app --record --json"
        );
        assert_eq!(
            set_args(src, "never", Some("claude"), Some("opus")).unwrap().join(" "),
            "models picture-reading set never --from-app --record --json"
        );
    }

    #[test]
    fn refuses_a_mode_agent_or_model_memo_would_not_take() {
        let (_, src) = memo().unwrap();
        assert!(set_args(src, "always", Some("claude"), None).is_err());
        assert!(set_args(src, "request", Some("gemini"), None).is_err());
        assert!(set_args(src, "request", Some("claude"), Some("--yes")).is_err());
        assert!(set_args(src, "request", Some("claude"), Some("a b")).is_err());
        assert!(set_args(src, "request", Some("claude"), Some(&"m".repeat(101))).is_err());
    }

    #[test]
    fn opens_from_memo_0_131_86() {
        let (_, src) = memo().unwrap();
        assert_eq!(src.min_version.as_deref(), Some("0.131.86"));
        assert!(!gate(src, Some("0.131.85")));
        assert!(gate(src, Some("0.131.86")));
    }

    // Written from cli-core's `src/cli/picture-reading-command.ts` (#2881), not captured from a run.
    #[test]
    fn reads_the_setting_and_drops_what_never_has() {
        let on = json!({"item": {"mode": "request", "agent": "codex", "model": "gpt-5",
            "extractor": "agent:codex/gpt-5", "since": "2026-11-12T09:12:00.000Z", "changed": true}});
        let s = setting_of(&on).unwrap();
        assert_eq!(
            (s.mode.as_str(), s.agent.as_deref(), s.model.as_deref()),
            ("request", Some("codex"), Some("gpt-5"))
        );
        assert_eq!(s.extractor.as_deref(), Some("agent:codex/gpt-5"));
        let never = setting_of(&json!({"item": {"mode": "never", "agent": "claude", "model": null,
            "extractor": null, "since": "1970-01-01T00:00:00.000Z"}}))
        .unwrap();
        assert_eq!((never.agent, never.since), (None, None));
        assert!(setting_of(&json!({"item": {"mode": "sometimes"}})).is_none());
    }

    #[test]
    fn words_memos_picture_reading_refusals_and_passes_the_rest_on() {
        let refused = |reason: &str| json!({"error": {"reason": reason, "message": "memo's own words"}});
        assert_eq!(refusal(&output(1), Some(&refused("picture-reading.owner-only"))), "picture-reading.owner-only");
        assert_eq!(
            refusal(&output(2), Some(&refused("picture-reading.agent-missing"))),
            "picture-reading.agent-missing"
        );
        assert_eq!(refusal(&output(2), Some(&refused("input.invalid"))), "memo's own words");
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(PictureReading::Old { version: Some("0.131.85".into()), need: None }).unwrap(),
            json!({"state": "old", "version": "0.131.85", "need": null})
        );
        let setting = setting_of(&json!({"mode": "request", "agent": "claude"})).unwrap();
        assert_eq!(
            serde_json::to_value(PictureReading::Ready { setting }).unwrap(),
            json!({"state": "ready", "setting": {"mode": "request", "agent": "claude", "model": null,
                "extractor": null, "since": null}})
        );
    }
}
