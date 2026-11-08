//! "Rewrite records for better search": memo's own `models consents show|set|revoke`, which send notes, documents and
//! mail to a hosted model that writes facts and questions search reads beside each record. Off until the owner agrees
//! in the window. The interface sends a provider and model; Rust runs `set` only for a pair memo itself offers.

use crate::catalog::Tool;
use crate::skills::{body, call, failure};
use crate::{redact, run, tools};
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
    /// `set {provider} --model {model}` without `--yes`: what would be sent and what it costs; changes nothing.
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
    /// `None` for a model or endpoint memo has no price for.
    pub usd: Option<f64>,
}

/// Whether memo finds the provider's key, and where; never the key.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentKey {
    pub present: bool,
    /// `keyring`, `file` or `env`.
    pub source: Option<String>,
    /// The variable memo reads, such as `OPENAI_API_KEY`.
    pub env_var: Option<String>,
}

/// What the estimate and the consent are about: the setting in force, what `set` proposes, or memo's default offer.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentTarget {
    pub provider: String,
    pub model: String,
    pub endpoint_host: String,
    pub key: EnrichmentKey,
    pub price_known: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentOffer {
    pub provider: String,
    pub model: String,
    pub default: bool,
    pub usd_per_million_input: Option<f64>,
    pub usd_per_million_output: Option<f64>,
}

/// memo's benchmark, off against on: found in the top ten for a reworded question, first for the record's own words.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentMeasured {
    pub reworded_off: f64,
    pub reworded_on: f64,
    pub own_words_first_off: f64,
    pub own_words_first_on: f64,
}

/// Counts, the provider's address and whether a key exists; never a record or a key.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentStatus {
    pub on: bool,
    pub consented_at: Option<String>,
    pub target: Option<EnrichmentTarget>,
    pub records: u64,
    pub enriched: u64,
    pub pending: u64,
    pub estimate: EnrichmentEstimate,
    pub per_sync: Option<u64>,
    pub syncs_needed: Option<u64>,
    pub offered: Vec<EnrichmentOffer>,
    pub measured: Option<EnrichmentMeasured>,
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
        status: Box<EnrichmentStatus>,
    },
}

/// What a memo sync did with the waiting records (`item.enrichment` of `memo sync --json`, only while it is on).
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncEnrichment {
    /// `done`, `stopped` or `failed`.
    pub status: String,
    pub sent: u64,
    pub enriched: u64,
    pub failed: u64,
    pub left: u64,
    pub cost_usd: Option<f64>,
    /// memo's English sentence, masked.
    pub reason: Option<String>,
}

pub fn sync_enrichment(item: &Value) -> Option<SyncEnrichment> {
    let e = item.get("enrichment").filter(|e| e.is_object())?;
    Some(SyncEnrichment {
        status: e["status"].as_str()?.to_string(),
        sent: count(&e["sent"]),
        enriched: count(&e["enriched"]),
        failed: count(&e["failed"]),
        left: count(&e["left"]),
        cost_usd: e["cost_usd"].as_f64(),
        reason: e["reason"].as_str().map(redact::text),
    })
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

fn target_of(t: &Value) -> Option<EnrichmentTarget> {
    let key = &t["key"];
    Some(EnrichmentTarget {
        provider: text(&t["provider"])?,
        model: text(&t["model"])?,
        endpoint_host: text(&t["endpoint_host"])?,
        key: EnrichmentKey {
            present: key["present"].as_bool().unwrap_or(false),
            source: text(&key["source"]),
            env_var: text(&key["env_var"]),
        },
        price_known: t["price_known"].as_bool().unwrap_or(false),
    })
}

fn offer_of(o: &Value) -> Option<EnrichmentOffer> {
    Some(EnrichmentOffer {
        provider: text(&o["provider"])?,
        model: text(&o["model"])?,
        default: o["default"].as_bool().unwrap_or(false),
        usd_per_million_input: o["usd_per_million"]["input"].as_f64(),
        usd_per_million_output: o["usd_per_million"]["output"].as_f64(),
    })
}

fn measured_of(m: &Value) -> Option<EnrichmentMeasured> {
    Some(EnrichmentMeasured {
        reworded_off: m["reworded_at_10"]["off"].as_f64()?,
        reworded_on: m["reworded_at_10"]["on"].as_f64()?,
        own_words_first_off: m["own_words_first"]["off"].as_f64()?,
        own_words_first_on: m["own_words_first"]["on"].as_f64()?,
    })
}

fn status_of(v: &Value) -> Option<EnrichmentStatus> {
    let item = body(v);
    let estimate = &item["estimate"];
    Some(EnrichmentStatus {
        on: item["on"].as_bool()?,
        consented_at: text(&item["consented_at"]),
        target: target_of(&item["target"]),
        records: count(&item["records"]),
        enriched: count(&item["enriched"]),
        pending: count(&item["pending"]),
        estimate: EnrichmentEstimate {
            records: count(&estimate["records"]),
            input_tokens: count(&estimate["input_tokens"]),
            output_tokens: count(&estimate["output_tokens"]),
            usd: estimate["usd"].as_f64(),
        },
        per_sync: item["per_sync"].as_u64(),
        syncs_needed: item["syncs_needed"].as_u64(),
        offered: item["offered"].as_array().into_iter().flatten().filter_map(offer_of).collect(),
        measured: measured_of(&item["measured"]),
        deleted: item["deleted"].as_u64(),
    })
}

/// One of the catalog's commands; memo's words come back masked when it refuses. A keyring warning memo prints on
/// stderr beside a good answer is not a refusal.
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

fn with_choice(words: &[String], provider: &str, model: &str) -> Vec<String> {
    words
        .iter()
        .map(|w| match w.as_str() {
            "{provider}" => provider.to_string(),
            "{model}" => model.to_string(),
            _ => w.clone(),
        })
        .collect()
}

/// The pair goes to memo only when memo's own `show` offers it, so nothing the interface sends becomes an option.
fn offered(tool: &Tool, provider: &str, model: &str) -> Result<(), String> {
    let status = ask(tool, &source(tool)?.show, CALL)?.map_err(|()| too_old(tool))?;
    if status.offered.iter().any(|o| o.provider == provider && o.model == model) {
        Ok(())
    } else {
        Err(format!("memo does not offer {provider} {model} for search rewriting"))
    }
}

pub fn status(tool: &Tool) -> Result<Enrichment, String> {
    let src = source(tool)?;
    Ok(match ask(tool, &src.show, CALL)? {
        Ok(status) => Enrichment::Ready { status: Box::new(status) },
        Err(()) => Enrichment::Old { version: installed_version(tool) },
    })
}

/// What turning it on with this provider and model would send and cost. Changes nothing.
pub fn preview(tool: &Tool, provider: &str, model: &str) -> Result<EnrichmentStatus, String> {
    offered(tool, provider, model)?;
    ask(tool, &with_choice(&source(tool)?.preview, provider, model), CALL)?.map_err(|()| too_old(tool))
}

/// The owner agreed in the window; memo records when.
pub fn turn_on(tool: &Tool, provider: &str, model: &str) -> Result<EnrichmentStatus, String> {
    offered(tool, provider, model)?;
    ask(tool, &with_choice(&source(tool)?.on, provider, model), CALL)?.map_err(|()| too_old(tool))
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

    // Answers of memo 0.131.61 in a throwaway home; the "on" ones were turned on against a local fake endpoint.
    const SHOW_OFF: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-show-off.json");
    const PREVIEW: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-set-preview.json");
    const SHOW_ON: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-show-on.json");
    const REVOKE_ANSWER: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-revoke.json");
    const SYNC_DONE: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-sync-notes-enriched.json");
    const SYNC_NO_KEY: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-sync-notes-no-key.json");
    const UNKNOWN_PROVIDER: &str = include_str!("../tests/fixtures/enrichment/memo-0.131.61-set-unknown-provider.json");

    fn parse(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    fn output(code: i32, stdout: &str, stderr: &str) -> run::Output {
        run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn runs_memos_own_consent_commands_with_the_chosen_pair_in_place() {
        let src = source(catalog::tool("memo").unwrap()).unwrap();
        assert_eq!(src.show.join(" "), "models consents show --no-record --json");
        assert_eq!(
            with_choice(&src.preview, "openai", "gpt-4o-mini").join(" "),
            "models consents set openai --model gpt-4o-mini --no-record --json"
        );
        assert_eq!(
            with_choice(&src.on, "anthropic", "claude-haiku-5-5").join(" "),
            "models consents set anthropic --model claude-haiku-5-5 --yes --record --json"
        );
        assert_eq!(src.off.join(" "), "models consents revoke --record --json");
        assert!(!src.preview.contains(&"--yes".to_string()));
        assert!(source(catalog::tool("tg").unwrap()).is_err());
    }

    #[test]
    fn reads_memos_off_answer_with_its_default_offer_price_and_key() {
        let s = status_of(&parse(SHOW_OFF)).unwrap();
        assert!(!s.on);
        let t = s.target.unwrap();
        assert_eq!(
            (t.provider.as_str(), t.model.as_str(), t.endpoint_host.as_str()),
            ("openai", "gpt-4o-mini", "api.openai.com")
        );
        assert_eq!(t.key, EnrichmentKey { present: false, source: None, env_var: Some("OPENAI_API_KEY".into()) });
        assert!(t.price_known);
        assert_eq!((s.records, s.pending), (3, 3));
        assert_eq!(s.estimate.usd, Some(0.000_153));
        assert_eq!((s.per_sync, s.syncs_needed), (Some(600), Some(1)));
        assert_eq!(s.offered.len(), 2);
        assert!(s.offered[0].default);
        assert_eq!(s.offered[1].usd_per_million_output, Some(0.5));
        assert!((s.measured.unwrap().reworded_on - 0.79).abs() < 1e-9);
    }

    #[test]
    fn reads_the_preview_on_and_revoke_answers() {
        assert_eq!(status_of(&parse(PREVIEW)).unwrap().target.unwrap().endpoint_host, "api.openai.com");
        let on = status_of(&parse(SHOW_ON)).unwrap();
        assert!(on.on);
        assert!(on.consented_at.is_some());
        assert_eq!((on.enriched, on.pending, on.syncs_needed), (3, 0, Some(0)));
        let off = status_of(&parse(REVOKE_ANSWER)).unwrap();
        assert_eq!((off.on, off.deleted), (false, Some(3)));
        assert!(status_of(&json!({"item": {}})).is_none());
    }

    #[test]
    fn reads_what_a_sync_rewrote_and_why_one_sent_nothing() {
        let done = sync_enrichment(&parse(SYNC_DONE)["item"]).unwrap();
        assert_eq!((done.status.as_str(), done.sent, done.enriched, done.failed), ("done", 3, 3, 0));
        let none = sync_enrichment(&parse(SYNC_NO_KEY)["item"]).unwrap();
        assert_eq!((none.status.as_str(), none.sent, none.left), ("stopped", 0, 3));
        assert!(none.reason.unwrap().contains("nothing was sent"));
        assert_eq!(sync_enrichment(&json!({"notes": []})), None);
    }

    #[test]
    fn a_memo_without_the_command_is_too_old_and_any_other_refusal_is_not() {
        // memo 0.131.58's own answer, exit 2.
        let old = json!({"error": {"code": "validation_error", "reason": "input.invalid",
            "message": "unknown command 'consents'", "retry": {"safe": false}}});
        assert!(unknown_command(&output(2, "", ""), Some(&old)));
        assert!(unknown_command(&output(1, "", "error: unknown command 'consents'"), None));
        assert!(!unknown_command(&output(2, "", ""), Some(&parse(UNKNOWN_PROVIDER))));
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(Enrichment::Old { version: Some("0.131.50".into()) }).unwrap(),
            json!({"state": "old", "version": "0.131.50"})
        );
        let v =
            serde_json::to_value(Enrichment::Ready { status: Box::new(status_of(&parse(SHOW_OFF)).unwrap()) }).unwrap();
        assert_eq!(v["state"], "ready");
        assert_eq!(v["status"]["target"]["endpointHost"], "api.openai.com");
        assert_eq!(v["status"]["target"]["key"]["envVar"], "OPENAI_API_KEY");
        assert_eq!(v["status"]["perSync"], 600);
    }
}

/// The same functions the window's commands call, against a real memo in a throwaway home: `bin/enrichment-e2e`
/// installs it there, cuts the keyring and the network, and removes everything after. Nothing is synced, so no
/// record is sent anywhere.
#[cfg(test)]
mod e2e {
    use super::*;
    use crate::catalog;

    #[test]
    #[ignore = "needs a real memo in a throwaway home: bin/enrichment-e2e"]
    fn against_a_real_memo() {
        assert!(std::env::var("WIRECAT_ENRICH_E2E").is_ok(), "run through bin/enrichment-e2e");
        let memo = catalog::tool("memo").unwrap();
        let Enrichment::Ready { status } = status(memo).unwrap() else { panic!("this memo has no models consents") };
        assert!(!status.on);
        let target = status.target.unwrap();
        assert_eq!((target.provider.as_str(), target.endpoint_host.as_str()), ("openai", "api.openai.com"));
        assert!(!target.key.present);
        assert!(status.offered.iter().any(|o| o.provider == "anthropic"));

        let other = preview(memo, "anthropic", "claude-haiku-5-5").unwrap();
        assert!(!other.on);
        assert_eq!(other.target.unwrap().endpoint_host, "api.anthropic.com");
        assert!(other.estimate.usd.is_some());
        assert!(preview(memo, "openai", "--yes").unwrap_err().contains("does not offer"));

        let on = turn_on(memo, "openai", "gpt-4o-mini").unwrap();
        assert!(on.on && on.consented_at.is_some());
        let off = turn_off(memo).unwrap();
        assert_eq!((off.on, off.deleted), (false, Some(0)));
        println!("memo {:?}: show, preview, refused pair, on and off all read", installed_version(memo));
    }
}
