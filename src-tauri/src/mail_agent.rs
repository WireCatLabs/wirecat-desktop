//! The mail agent: memo's own `schedule agent` that reads new mail and proposes what it asks of the owner. On and off
//! are memo's `schedule agent` and `schedule remove`; memo writes the systemd timer, launchd agent or scheduled task.
//! Nothing here writes a timer.

use crate::catalog::{self, Tool};
use crate::skills::{body, call, failure, too_old};
use crate::{paths, redact, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MailAgentSource {
    /// The tool that keeps the schedule: memo, whose store the mail lands in.
    pub via: String,
    pub min_version: String,
    /// The schedule's name, as `schedule list` shows it.
    pub name: String,
    /// The agent program the schedule starts; memo refuses the schedule when it is not on PATH.
    pub harness: String,
    pub list: Vec<String>,
    pub on: Vec<String>,
    pub off: Vec<String>,
    pub waiting: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum MailAgent {
    NoMemo,
    Old {
        version: Option<String>,
        need: String,
    },
    /// `harness`: whether the agent program is on PATH, so turning it on can work.
    #[serde(rename_all = "camelCase")]
    Off {
        harness: bool,
    },
    /// `spent_today_usd` is `None` where memo does not report it; the caps are `None` from a memo built on cli-core older than 0.584, and
    /// `max_cost_per_day_usd` is 0 when there is no daily cap.
    #[serde(rename_all = "camelCase")]
    On {
        when: String,
        last: Option<LastRun>,
        spent_today_usd: Option<f64>,
        max_cost_usd: Option<f64>,
        max_cost_per_day_usd: Option<f64>,
    },
}

/// The last run without its output: the agent's answer may quote mail.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastRun {
    pub at: String,
    pub exit_code: i64,
    /// Why a failed run failed: an error code and reason id, never the message.
    pub reason: Option<String>,
    pub failures: Option<u64>,
    /// The last time memo did not start a run, after this one.
    pub skipped: Option<Skipped>,
}

/// `why` is memo's English sentence. `reason` is its dotted id, absent in an older memo, and the screen translates by it.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
pub struct Skipped {
    pub at: String,
    pub why: String,
    pub reason: Option<String>,
}

fn source(tool: &Tool) -> Result<&MailAgentSource, String> {
    tool.mail_agent.as_ref().ok_or_else(|| format!("{} has no mail agent", tool.name))
}

/// memo, or what the section shows instead of a switch.
fn gate(src: &MailAgentSource) -> Result<Result<&'static Tool, MailAgent>, String> {
    let via = catalog::tool(&src.via)?;
    let state = tools::detect(via, false);
    let Some(first) = state.installs.first() else { return Ok(Err(MailAgent::NoMemo)) };
    if too_old(first.version.as_deref(), &src.min_version) {
        return Ok(Err(MailAgent::Old { version: first.version.clone(), need: src.min_version.clone() }));
    }
    Ok(Ok(via))
}

pub fn status(tool: &Tool) -> Result<MailAgent, String> {
    let src = source(tool)?;
    let via = match gate(src)? {
        Ok(via) => via,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(via, &src.list, Duration::from_secs(30))?;
    match json {
        Some(v) if out.code == Some(0) => Ok(read(src, &v)),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn read(src: &MailAgentSource, v: &Value) -> MailAgent {
    let found = v["items"].as_array().into_iter().flatten().find(|i| i["name"].as_str() == Some(src.name.as_str()));
    let Some(item) = found else { return MailAgent::Off { harness: !paths::find_all(&src.harness).is_empty() } };
    MailAgent::On {
        when: item["when"].as_str().unwrap_or_default().to_string(),
        last: last_run(&item["last"]),
        spent_today_usd: item["spent_today_usd"].as_f64(),
        max_cost_usd: item["max_cost_usd"].as_f64(),
        max_cost_per_day_usd: item["max_cost_per_day_usd"].as_f64(),
    }
}

fn last_run(v: &Value) -> Option<LastRun> {
    Some(LastRun {
        at: v["at"].as_str()?.to_string(),
        exit_code: v["exit_code"].as_i64()?,
        reason: v["reason"].as_str().map(redact::text),
        failures: v["failures"].as_u64(),
        skipped: skipped(&v["skipped"]),
    })
}

fn skipped(v: &Value) -> Option<Skipped> {
    Some(Skipped {
        at: v["at"].as_str()?.to_string(),
        why: redact::text(v["why"].as_str()?),
        reason: v["reason"].as_str().map(redact::text),
    })
}

/// Turns the schedule on or off with memo's own command; memo's words come back when it refuses, masked.
pub fn set(tool: &Tool, on: bool) -> Result<MailAgent, String> {
    let src = source(tool)?;
    let via = match gate(src)? {
        Ok(via) => via,
        Err(shown) => return Ok(shown),
    };
    let args = if on { &src.on } else { &src.off };
    let (out, json) = call(via, args, Duration::from_mins(1))?;
    // Removing a schedule that is already gone leaves it off, which is what the owner asked for.
    let gone = !on && json.as_ref().and_then(|v| v["error"]["code"].as_str()) == Some("not_found");
    if out.code != Some(0) && !gone {
        return Err(failure(&out, json.as_ref()));
    }
    status(tool)
}

/// How many proposals wait for the owner's decision, from memo's `review status`; `None` when memo does not say.
pub fn waiting(tool: &Tool) -> Result<Option<u64>, String> {
    let src = source(tool)?;
    let Ok(via) = gate(src)? else { return Ok(None) };
    let (out, json) = call(via, &src.waiting, Duration::from_mins(1))?;
    Ok(match json {
        Some(v) if out.code == Some(0) => body(&v)["waiting"]["count"].as_u64(),
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn src() -> &'static MailAgentSource {
        source(catalog::tool("email").unwrap()).unwrap()
    }

    #[test]
    fn runs_memos_own_schedule_commands() {
        let s = src();
        assert_eq!(s.via, "memo");
        assert_eq!(s.list.join(" "), "schedule list name:mail-triage --no-record --json");
        assert_eq!(
            s.on,
            [
                "schedule",
                "agent",
                "mail-triage",
                "claude",
                "Run memo skill show mail-triage and follow it.",
                "--every",
                "5m",
                "--on-new-mail",
                "mail-triage",
                "--max-cost",
                "1",
                "--json"
            ]
        );
        assert_eq!(s.off.join(" "), "schedule remove mail-triage --json");
        assert_eq!(s.waiting.join(" "), "review status --no-record --json");
        assert!(source(catalog::tool("tg").unwrap()).is_err());
    }

    #[test]
    fn reads_the_schedule_by_its_exact_name() {
        let v = json!({"items": [
            {"name": "mail-triage-old", "kind": "agent", "when": "every 1h", "last": null},
            {"name": "mail-triage", "kind": "agent", "when": "every 5m", "spent_today_usd": 0.42, "last": {
                "at": "2026-11-05T21:54:36Z", "exit_code": 0, "output": "Invoice from Ana Ruiz", "trace_id": "t1"}}
        ]});
        assert_eq!(
            read(src(), &v),
            MailAgent::On {
                when: "every 5m".into(),
                last: Some(LastRun {
                    at: "2026-11-05T21:54:36Z".into(),
                    exit_code: 0,
                    reason: None,
                    failures: None,
                    skipped: None
                }),
                spent_today_usd: Some(0.42),
                max_cost_usd: None,
                max_cost_per_day_usd: None,
            }
        );
    }

    #[test]
    fn a_missing_schedule_is_off_and_a_failed_run_keeps_its_streak() {
        assert!(matches!(read(src(), &json!({"items": []})), MailAgent::Off { .. }));
        let v = json!({"items": [{"name": "mail-triage", "kind": "agent", "when": "every 5m", "last": {
            "at": "2026-11-05T21:54:36Z", "exit_code": 1, "output": "", "reason": "provider_error (claude.exit)",
            "failures": 2}}]});
        let MailAgent::On { last: Some(last), spent_today_usd, .. } = read(src(), &v) else { panic!("on") };
        assert_eq!(last.reason.as_deref(), Some("provider_error (claude.exit)"));
        assert_eq!(last.failures, Some(2));
        assert_eq!(last.skipped, None);
        assert_eq!(spent_today_usd, None);
    }

    #[test]
    fn reads_the_caps_and_the_skip_at_the_days_cap() {
        let why = "today's runs cost $5.02, the $5.00 a day allowed; it runs again tomorrow";
        let v = json!({"items": [{"name": "mail-triage", "kind": "agent", "when": "every 5m",
            "spent_today_usd": 5.02, "max_cost_usd": 1, "max_cost_per_day_usd": 5, "last": {
            "at": "2026-11-05T21:54:36Z", "exit_code": 0, "output": "", "cost_usd": 0.9,
            "skipped": {"at": "2026-11-05T22:04:36Z", "why": why, "reason": "cost.day-cap"}}}]});
        let MailAgent::On { last: Some(last), max_cost_usd, max_cost_per_day_usd, .. } = read(src(), &v) else {
            panic!("on")
        };
        assert_eq!(
            last.skipped,
            Some(Skipped { at: "2026-11-05T22:04:36Z".into(), why: why.into(), reason: Some("cost.day-cap".into()) })
        );
        assert_eq!((max_cost_usd, max_cost_per_day_usd), (Some(1.0), Some(5.0)));
    }

    #[test]
    fn says_which_memo_is_too_old() {
        assert!(too_old(Some("0.131.25"), "0.131.26"));
        assert!(!too_old(Some("0.131.38"), "0.131.26"));
        assert!(too_old(None, "0.131.26"));
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        let on = MailAgent::On {
            when: "every 5m".into(),
            last: None,
            spent_today_usd: Some(1.5),
            max_cost_usd: Some(1.0),
            max_cost_per_day_usd: Some(0.0),
        };
        assert_eq!(
            serde_json::to_value(on).unwrap(),
            json!({"state": "on", "when": "every 5m", "last": null, "spentTodayUsd": 1.5, "maxCostUsd": 1.0,
                "maxCostPerDayUsd": 0.0})
        );
        assert_eq!(serde_json::to_value(MailAgent::NoMemo).unwrap(), json!({"state": "noMemo"}));
        assert_eq!(
            serde_json::to_value(MailAgent::Off { harness: true }).unwrap(),
            json!({"state": "off", "harness": true})
        );
    }
}
