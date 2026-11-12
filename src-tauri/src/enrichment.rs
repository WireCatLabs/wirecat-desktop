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
    /// The first memo that takes `set … --base-url`; `None` until one is released, which counts as too old.
    pub base_url: Gate,
    /// `set {provider} --model {model} {baseUrl}` without `--yes`: what would be sent and what it costs; changes nothing.
    pub preview: Vec<String>,
    pub on: Vec<String>,
    pub off: Vec<String>,
    /// `models keys set --help`: a memo with the command prints its own usage; an older one prints `models`'s.
    pub keys_probe: Vec<String>,
    /// `models keys set {provider}`: the key goes on stdin, never as an argument.
    pub key_set: Vec<String>,
    pub key_remove: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Gate {
    pub min_version: Option<String>,
}

impl Gate {
    pub fn open(&self, version: Option<&str>) -> bool {
        self.min_version.as_deref().is_some_and(|need| !tools::older(version, need))
    }
}

/// memo's reasons the window words itself: an address that is plain http to another computer, and local only.
const WORDED: [&str; 2] = ["model.address-refused", "local-only.refused"];

/// memo's refusal: one of `WORDED` as its id, anything else in memo's own words, masked.
pub(crate) fn refusal_of(out: &run::Output, json: Option<&Value>) -> String {
    match crate::skills::reason(json) {
        Some(reason) if WORDED.contains(&reason) => reason.to_string(),
        _ => failure(out, json),
    }
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
    /// The address when the owner gave one (a server on this computer, `OpenRouter`…), so the form can show it again.
    pub base_url: Option<String>,
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
    /// Whether this memo stores a provider key itself (`models keys`); without it the window names the variable.
    pub keys: bool,
    /// Whether this memo takes a model address (`set … --base-url`); without it only memo's offers are shown.
    pub addresses: bool,
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
    /// memo's English sentence, masked; the window shows it only for a `reason_id` it has no words for.
    pub reason: Option<String>,
    /// `enrichment.no-key`, `.key-rejected`, `.unreachable`, `.rate-limited`, `.bad-replies`, `.cancelled`, `.error`.
    pub reason_id: Option<String>,
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
        reason_id: e["reason_id"].as_str().filter(|r| r.starts_with("enrichment.")).map(str::to_string),
    })
}

fn source(tool: &Tool) -> Result<&EnrichmentSource, String> {
    tool.enrichment.as_ref().ok_or_else(|| format!("{} has no search rewriting", tool.name))
}

fn unknown_command(out: &run::Output, json: Option<&Value>) -> bool {
    let message = json.and_then(|v| v["error"]["message"].as_str()).unwrap_or(&out.stderr);
    crate::memo_cli::unknown_to_cli(message)
}

fn count(v: &Value) -> u64 {
    v.as_u64().unwrap_or(0)
}

fn text(v: &Value) -> Option<String> {
    v.as_str().map(str::to_string)
}

// cli-core's `DEFAULT_BASE_URLS`: an endpoint other than these is an address the owner gave.
const DEFAULT_ENDPOINTS: [&str; 2] = ["https://api.openai.com/v1", "https://api.anthropic.com"];

fn target_of(t: &Value) -> Option<EnrichmentTarget> {
    let key = &t["key"];
    Some(EnrichmentTarget {
        provider: text(&t["provider"])?,
        model: text(&t["model"])?,
        endpoint_host: text(&t["endpoint_host"])?,
        base_url: text(&t["endpoint"]).filter(|e| !DEFAULT_ENDPOINTS.contains(&e.as_str())),
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
        keys: false,
        addresses: false,
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
        return Err(refusal_of(&out, json.as_ref()));
    }
    json.as_ref().and_then(status_of).map(Ok).ok_or_else(|| "memo gave an answer the app cannot read".to_string())
}

fn too_old(tool: &Tool) -> String {
    format!("{} is too old to rewrite records for search", too_old_name(tool))
}

/// What the owner picks: one of memo's offers, or a model at an address he gives.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentChoice {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

impl EnrichmentChoice {
    fn address(&self) -> Option<&str> {
        self.base_url.as_deref().map(str::trim).filter(|u| !u.is_empty())
    }
}

fn with_choice(words: &[String], provider: &str, model: &str, base_url: Option<&str>) -> Vec<String> {
    let mut out = Vec::with_capacity(words.len() + 2);
    for w in words {
        match w.as_str() {
            "{provider}" => out.push(provider.to_string()),
            "{model}" => out.push(model.to_string()),
            "{baseUrl}" => out.extend(base_url.into_iter().flat_map(|u| ["--base-url".to_string(), u.to_string()])),
            _ => out.push(w.clone()),
        }
    }
    out
}

/// The words for this choice. memo's own offer goes as it is; a model at an address is checked here, as search harder
/// checks one, since memo lists no models for it and nothing the interface sends may become an option.
fn choice_words(
    tool: &Tool,
    src: &EnrichmentSource,
    words: &[String],
    c: &EnrichmentChoice,
) -> Result<Vec<String>, String> {
    let Some(address) = c.address() else {
        offered(tool, &c.provider, &c.model)?;
        return Ok(with_choice(words, &c.provider, &c.model, None));
    };
    if !src.base_url.open(tools::installed_version(tool).as_deref()) {
        return Err("This memo cannot use a model address yet. It comes with a memo update.".into());
    }
    if c.provider != "openai" {
        return Err("A model address is for an OpenAI-compatible API.".into());
    }
    let model = crate::search_harder::checked_model(&c.model)?;
    let address = crate::search_harder::checked_base_url(address)?;
    Ok(with_choice(words, &c.provider, model, Some(&address)))
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

fn with_keys(tool: &Tool, src: &EnrichmentSource, mut status: EnrichmentStatus) -> EnrichmentStatus {
    status.keys = call(tool, &src.keys_probe, CALL).is_ok_and(|(out, _)| knows_keys(&out));
    status.addresses = src.base_url.open(tools::installed_version(tool).as_deref());
    status
}

fn knows_keys(out: &run::Output) -> bool {
    out.code == Some(0) && out.stdout.lines().any(|l| l.starts_with("Usage:") && l.contains("models keys set"))
}

pub fn status(tool: &Tool) -> Result<Enrichment, String> {
    let src = source(tool)?;
    Ok(match ask(tool, &src.show, CALL)? {
        Ok(status) => Enrichment::Ready { status: Box::new(with_keys(tool, src, status)) },
        Err(()) => Enrichment::Old { version: tools::installed_version(tool) },
    })
}

/// What turning it on with this choice would send and cost. Changes nothing.
pub fn preview(tool: &Tool, choice: &EnrichmentChoice) -> Result<EnrichmentStatus, String> {
    let src = source(tool)?;
    let args = choice_words(tool, src, &src.preview, choice)?;
    let status = ask(tool, &args, CALL)?.map_err(|()| too_old(tool))?;
    Ok(with_keys(tool, src, status))
}

/// The owner agreed in the window; memo records when.
pub fn turn_on(tool: &Tool, choice: &EnrichmentChoice) -> Result<EnrichmentStatus, String> {
    let src = source(tool)?;
    let args = choice_words(tool, src, &src.on, choice)?;
    let status = ask(tool, &args, CALL)?.map_err(|()| too_old(tool))?;
    Ok(with_keys(tool, src, status))
}

/// A provider memo offers, so nothing the interface sends becomes an option.
fn offered_provider(tool: &Tool, src: &EnrichmentSource, provider: &str) -> Result<(), String> {
    let status = ask(tool, &src.show, CALL)?.map_err(|()| too_old(tool))?;
    if status.offered.iter().any(|o| o.provider == provider) {
        Ok(())
    } else {
        Err(format!("memo offers no provider {provider}"))
    }
}

/// A key as the owner pasted it: one line, no control characters, of a size an API key has.
fn checked_key(key: &str) -> Result<&str, String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("Paste the key first.".into());
    }
    if key.len() > 4096 || key.chars().any(char::is_control) {
        return Err("That does not look like an API key: paste it on one line.".into());
    }
    Ok(key)
}

fn masked(text: &str, key: &str) -> String {
    redact::text(&if key.is_empty() { text.to_string() } else { text.replace(key, "•••") })
}

/// memo's `models keys set`: the key on stdin, closed after it, so it is never an argument, an environment variable or a
/// log line. memo keeps it in the system keyring (a private file when none answers). Any refusal is masked first.
pub fn set_key(tool: &Tool, provider: &str, key: &str) -> Result<EnrichmentStatus, String> {
    let src = source(tool)?;
    let key = checked_key(key)?;
    offered_provider(tool, src, provider)?;
    let bin = tools::program(&tool.bin).ok_or("the tool is not installed")?;
    let args = with_choice(&src.key_set, provider, "", None);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&crate::paths::search_path()));
    let out = run::run_with_input(cmd, Some(format!("{key}\n").as_bytes()), CALL, || false)
        .map_err(|e| format!("Could not run memo: {e}."))?;
    let code = out.code;
    let json = out.json();
    if code != Some(0) {
        if unknown_command(&out, json.as_ref()) {
            return Err(format!("{} cannot store a key yet. Update it on the Tools page.", too_old_name(tool)));
        }
        return Err(masked(&failure(&out, json.as_ref()), key));
    }
    if json.as_ref().map(body).and_then(|b| b["stored"].as_bool()) != Some(true) {
        return Err("memo did not say it stored the key".into());
    }
    after_key(tool, src)
}

/// memo's `models keys remove`: a key in an environment variable stays, and memo says where it removed one from.
pub fn remove_key(tool: &Tool, provider: &str) -> Result<EnrichmentStatus, String> {
    let src = source(tool)?;
    offered_provider(tool, src, provider)?;
    let (out, json) = call(tool, &with_choice(&src.key_remove, provider, "", None), CALL)?;
    if out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    after_key(tool, src)
}

fn after_key(tool: &Tool, src: &EnrichmentSource) -> Result<EnrichmentStatus, String> {
    let status = ask(tool, &src.show, CALL)?.map_err(|()| too_old(tool))?;
    Ok(with_keys(tool, src, status))
}

fn too_old_name(tool: &Tool) -> String {
    tools::installed_version(tool).map_or("This memo".into(), |v| format!("memo {v}"))
}

/// Turns it off and deletes what the model wrote.
pub fn turn_off(tool: &Tool) -> Result<EnrichmentStatus, String> {
    let src = source(tool)?;
    let status = ask(tool, &src.off, REVOKE)?.map_err(|()| too_old(tool))?;
    Ok(with_keys(tool, src, status))
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

    fn memo_source() -> &'static EnrichmentSource {
        source(catalog::tool("memo").unwrap()).unwrap()
    }

    #[test]
    fn runs_memos_own_consent_commands_with_the_chosen_pair_in_place() {
        let src = memo_source();
        assert_eq!(src.show.join(" "), "models consents show --no-record --json");
        assert_eq!(
            with_choice(&src.preview, "openai", "gpt-4o-mini", None).join(" "),
            "models consents set openai --model gpt-4o-mini --no-record --json"
        );
        assert_eq!(
            with_choice(&src.on, "anthropic", "claude-haiku-5-5", None).join(" "),
            "models consents set anthropic --model claude-haiku-5-5 --yes --record --json"
        );
        assert_eq!(src.off.join(" "), "models consents revoke --record --json");
        assert!(!src.preview.contains(&"--yes".to_string()));
        assert!(source(catalog::tool("tg").unwrap()).is_err());
    }

    #[test]
    fn a_model_at_an_address_goes_as_one_checked_flag_and_only_from_a_released_memo() {
        let src = memo_source();
        assert_eq!(
            with_choice(&src.on, "openai", "llama3.1:8b", Some("http://localhost:11434/v1")).join(" "),
            "models consents set openai --model llama3.1:8b --base-url http://localhost:11434/v1 --yes --record --json"
        );
        // memo 0.131.85 (cli-core 0.642.0) is the first with `consents set --base-url`.
        assert_eq!(src.base_url.min_version.as_deref(), Some("0.131.85"));
        assert!(!src.base_url.open(Some("0.131.84")));
        assert!(!Gate { min_version: None }.open(Some("9.0.0")));
        let gate = Gate { min_version: Some("0.131.86".into()) };
        assert!(!gate.open(Some("0.131.84")));
        assert!(gate.open(Some("0.131.86")));
        let choice = |base_url: &str| EnrichmentChoice {
            provider: "openai".into(),
            model: "m".into(),
            base_url: Some(base_url.into()),
        };
        assert_eq!(choice("  ").address(), None);
        assert_eq!(choice(" http://localhost:1234/v1 ").address(), Some("http://localhost:1234/v1"));
    }

    #[test]
    fn words_memos_address_and_local_only_refusals_and_passes_the_rest_on() {
        let refused = |reason: &str| {
            json!({"error": {"code": "validation_error", "reason": reason,
                "message": "this address is not allowed: use https, or http only on this computer"}})
        };
        let out = output(2, "", "");
        assert_eq!(refusal_of(&out, Some(&refused("model.address-refused"))), "model.address-refused");
        assert_eq!(refusal_of(&out, Some(&refused("local-only.refused"))), "local-only.refused");
        assert!(refusal_of(&out, Some(&refused("input.invalid"))).starts_with("this address is not allowed"));
    }

    #[test]
    fn reads_the_address_the_owner_gave_and_not_a_providers_own() {
        assert_eq!(status_of(&parse(SHOW_OFF)).unwrap().target.unwrap().base_url, None);
        let on = status_of(&parse(SHOW_ON)).unwrap().target.unwrap();
        assert_eq!(on.base_url.as_deref(), Some("http://127.0.0.1:18765/v1"));
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
    fn the_key_command_is_found_by_its_own_usage_line() {
        let new = output(0, "Usage: memo models keys set [options] <provider>\n\nstore a key", "");
        let old = output(0, "Usage: memo models [options] [command]\n\nmodels that run on this machine", "");
        assert!(knows_keys(&new));
        assert!(!knows_keys(&old));
        assert!(!knows_keys(&output(1, "Usage: memo models keys set", "")));
        let src = memo_source();
        assert_eq!(with_choice(&src.key_set, "openai", "", None).join(" "), "models keys set openai --record --json");
        assert!(!src.key_set.iter().any(|w| w.contains("key=") || w == "{key}"));
        assert_eq!(
            with_choice(&src.key_remove, "anthropic", "", None).join(" "),
            "models keys remove anthropic --record --json"
        );
    }

    #[test]
    fn a_pasted_key_is_one_trimmed_line_and_never_echoed_back() {
        assert_eq!(checked_key("  synthetic-test-key \n").unwrap(), "synthetic-test-key");
        assert!(checked_key("   ").is_err());
        assert!(checked_key("two\nlines").is_err());
        let said = masked("the provider refused synthetic-test-key (HTTP 401)", "synthetic-test-key");
        assert!(!said.contains("synthetic-test-key"));
        assert!(said.contains("•••"));
    }

    #[test]
    fn reads_the_reason_id_of_a_sync_that_sent_nothing() {
        let item = json!({"enrichment": {"status": "failed", "sent": 3, "enriched": 0, "failed": 3, "left": 3,
            "cost_usd": null, "reason": "openai refused the key", "reason_id": "enrichment.key-rejected"}});
        let e = sync_enrichment(&item).unwrap();
        assert_eq!((e.status.as_str(), e.reason_id.as_deref()), ("failed", Some("enrichment.key-rejected")));
        let odd = json!({"enrichment": {"status": "stopped", "reason_id": "--yes"}});
        assert_eq!(sync_enrichment(&odd).unwrap().reason_id, None);
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

        let pick = |provider: &str, model: &str| EnrichmentChoice {
            provider: provider.into(),
            model: model.into(),
            base_url: None,
        };
        let other = preview(memo, &pick("anthropic", "claude-haiku-5-5")).unwrap();
        assert!(!other.on);
        assert_eq!(other.target.unwrap().endpoint_host, "api.anthropic.com");
        assert!(other.estimate.usd.is_some());
        assert!(preview(memo, &pick("openai", "--yes")).unwrap_err().contains("does not offer"));

        let on = turn_on(memo, &pick("openai", "gpt-4o-mini")).unwrap();
        assert!(on.on && on.consented_at.is_some());
        let off = turn_off(memo).unwrap();
        assert_eq!((off.on, off.deleted), (false, Some(0)));
        println!("memo {:?}: show, preview, refused pair, on and off all read", tools::installed_version(memo));
    }
}
