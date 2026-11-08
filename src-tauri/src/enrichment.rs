//! "Rewrite records for better search": memo's own `models consents show|set|revoke`, which send notes, documents and
//! mail to a hosted model that writes facts and questions search reads beside each record. Off until the owner agrees
//! in the window; the catalog fixes the provider and model, so the interface sends only the tool id.

use crate::catalog::Tool;
use crate::skills::{body, call, failure};
use crate::{run, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);
/// Revoke deletes every row the model wrote and queues the records again, which takes longer on a large store.
const REVOKE: Duration = Duration::from_mins(2);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentSource {
    pub show: Vec<String>,
    /// `set` without `--yes`: what would be sent and what it costs; changes nothing.
    pub preview: Vec<String>,
    pub on: Vec<String>,
    pub off: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentEstimate {
    pub records: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    /// `None` for a model memo has no price for, and in `show` while enrichment is off.
    pub usd: Option<f64>,
}

/// Counts and the provider's address, never a record. `provider`, `model` and `endpoint` are the setting in force,
/// so a preview of a change still shows them empty while it is off.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentStatus {
    pub on: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub endpoint: Option<String>,
    pub consented_at: Option<String>,
    pub records: u64,
    pub enriched: u64,
    pub pending: u64,
    pub estimate: EnrichmentEstimate,
    /// Only after revoke: how many records' model text memo deleted.
    pub deleted: Option<u64>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum Enrichment {
    /// memo answers "unknown command": its release has no `models consents` yet.
    Old {
        version: Option<String>,
    },
    Ready {
        status: EnrichmentStatus,
    },
}

fn source(tool: &Tool) -> Result<&EnrichmentSource, String> {
    tool.enrichment.as_ref().ok_or_else(|| format!("{} has no search rewriting", tool.name))
}

fn unknown_command(out: &run::Output, json: Option<&Value>) -> bool {
    let message = json.and_then(|v| v["error"]["message"].as_str()).unwrap_or(&out.stderr);
    message.contains("unknown command")
}

fn count(v: &Value) -> u64 {
    v.as_u64().unwrap_or(0)
}

fn text(v: &Value) -> Option<String> {
    v.as_str().map(str::to_string)
}

fn status_of(v: &Value) -> Option<EnrichmentStatus> {
    let item = body(v);
    let estimate = &item["estimate"];
    Some(EnrichmentStatus {
        on: item["on"].as_bool()?,
        provider: text(&item["provider"]),
        model: text(&item["model"]),
        endpoint: text(&item["endpoint"]),
        consented_at: text(&item["consented_at"]),
        records: count(&item["records"]),
        enriched: count(&item["enriched"]),
        pending: count(&item["pending"]),
        estimate: EnrichmentEstimate {
            records: count(&estimate["records"]),
            input_tokens: count(&estimate["input_tokens"]),
            output_tokens: count(&estimate["output_tokens"]),
            usd: estimate["usd"].as_f64(),
        },
        deleted: item["deleted"].as_u64(),
    })
}

/// One of the catalog's commands; memo's words come back masked when it refuses.
fn ask(tool: &Tool, args: &[String], timeout: Duration) -> Result<Result<EnrichmentStatus, ()>, String> {
    let (out, json) = call(tool, args, timeout)?;
    if out.code != Some(0) {
        if unknown_command(&out, json.as_ref()) {
            return Ok(Err(()));
        }
        return Err(failure(&out, json.as_ref()));
    }
    json.as_ref().and_then(status_of).map(Ok).ok_or_else(|| "memo gave an answer the app cannot read".to_string())
}

fn installed_version(tool: &Tool) -> Option<String> {
    tools::detect(tool, false).installs.first().and_then(|i| i.version.clone())
}

fn too_old(tool: &Tool) -> String {
    let who = installed_version(tool).map_or("This memo".into(), |v| format!("memo {v}"));
    format!("{who} is too old to rewrite records for search")
}

pub fn status(tool: &Tool) -> Result<Enrichment, String> {
    let src = source(tool)?;
    Ok(match ask(tool, &src.show, CALL)? {
        Ok(status) => Enrichment::Ready { status },
        Err(()) => Enrichment::Old { version: installed_version(tool) },
    })
}

/// What turning it on would send and cost. Changes nothing.
pub fn preview(tool: &Tool) -> Result<EnrichmentStatus, String> {
    ask(tool, &source(tool)?.preview, CALL)?.map_err(|()| too_old(tool))
}

/// The owner agreed in the window; memo records when.
pub fn turn_on(tool: &Tool) -> Result<EnrichmentStatus, String> {
    ask(tool, &source(tool)?.on, CALL)?.map_err(|()| too_old(tool))
}

/// Turns it off and deletes what the model wrote.
pub fn turn_off(tool: &Tool) -> Result<EnrichmentStatus, String> {
    ask(tool, &source(tool)?.off, REVOKE)?.map_err(|()| too_old(tool))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog;
    use serde_json::json;

    fn output(code: i32, stdout: &str, stderr: &str) -> run::Output {
        run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn runs_memos_own_consent_commands_for_one_fixed_model() {
        let src = source(catalog::tool("memo").unwrap()).unwrap();
        assert_eq!(src.show.join(" "), "models consents show --no-record --json");
        assert_eq!(src.preview.join(" "), "models consents set openai --model gpt-4o-mini --no-record --json");
        assert_eq!(src.on.join(" "), "models consents set openai --model gpt-4o-mini --yes --record --json");
        assert_eq!(src.off.join(" "), "models consents revoke --record --json");
        assert!(!src.preview.contains(&"--yes".to_string()));
        assert!(source(catalog::tool("tg").unwrap()).is_err());
    }

    #[test]
    fn reads_the_state_and_the_estimate() {
        let v = json!({"item": {"on": false, "provider": null, "model": null, "endpoint": null, "consented_at": null,
            "records": 10444, "enriched": 0, "pending": 10444, "changed": false, "consent": "Enrichment sends…",
            "estimate": {"records": 10444, "input_tokens": 689_496, "output_tokens": 691_880, "usd": 0.5186}}});
        let s = status_of(&v).unwrap();
        assert!(!s.on);
        assert_eq!((s.records, s.enriched, s.pending), (10444, 0, 10444));
        assert_eq!(s.estimate.usd, Some(0.5186));
        assert_eq!(s.estimate.input_tokens, 689_496);
        assert_eq!(s.deleted, None);
    }

    #[test]
    fn reads_on_with_its_endpoint_and_a_revoke_with_what_it_deleted() {
        let on = json!({"item": {"on": true, "provider": "openai", "model": "gpt-4o-mini",
            "endpoint": "https://api.openai.com/v1", "consented_at": "2026-11-08T10:00:00.000Z", "records": 300,
            "enriched": 16, "pending": 284, "estimate": {"records": 284, "input_tokens": 1, "output_tokens": 2,
            "usd": null}}});
        let s = status_of(&on).unwrap();
        assert_eq!(s.endpoint.as_deref(), Some("https://api.openai.com/v1"));
        assert_eq!(s.estimate.usd, None);
        let off = json!({"item": {"on": false, "records": 300, "enriched": 0, "pending": 300, "deleted": 16,
            "estimate": {"records": 300, "input_tokens": 1, "output_tokens": 2, "usd": null}}});
        assert_eq!(status_of(&off).unwrap().deleted, Some(16));
        assert!(status_of(&json!({"item": {}})).is_none());
    }

    #[test]
    fn a_memo_without_the_command_is_too_old_and_any_other_refusal_is_not() {
        let old = json!({"error": {"code": "validation_error", "message": "unknown command 'consents'"}});
        assert!(unknown_command(&output(2, "", ""), Some(&old)));
        assert!(unknown_command(&output(1, "", "error: unknown command 'consents'"), None));
        let agent = json!({"error": {"code": "permission_error", "message": "only the owner turns enrichment on"}});
        assert!(!unknown_command(&output(1, "", ""), Some(&agent)));
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(Enrichment::Old { version: Some("0.131.50".into()) }).unwrap(),
            json!({"state": "old", "version": "0.131.50"})
        );
        let s = status_of(&json!({"on": true, "records": 1, "enriched": 1, "pending": 0,
            "estimate": {"records": 0, "input_tokens": 0, "output_tokens": 0, "usd": 0}}))
        .unwrap();
        let v = serde_json::to_value(Enrichment::Ready { status: s }).unwrap();
        assert_eq!(v["state"], "ready");
        assert_eq!(v["status"]["consentedAt"], Value::Null);
        assert_eq!(v["status"]["estimate"]["inputTokens"], 0);
    }
}
