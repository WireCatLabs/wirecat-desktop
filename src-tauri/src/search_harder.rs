//! "Search harder": memo's own `models search-consents show|set|revoke` and `search all --harder`, where a hosted model
//! reorders the first hits of one search. Off until the owner agrees in the window, and then only a search he starts
//! with the button sends anything. memo offers no list of models here, so Rust checks the provider, the model's name
//! and the address itself before any of them becomes an argument.

use crate::catalog::{SearchShape, Tool};
use crate::enrichment::EnrichmentKey;
use crate::skills::{body, call, failure};
use crate::{search, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);
// The model waits at most 5 s inside memo; the rest is memo's own search.
const SEARCH: Duration = Duration::from_secs(90);
const PROVIDERS: [&str; 2] = ["anthropic", "openai"];
const MAX_MODEL: usize = 200;
const MAX_URL: usize = 500;
// cli-core's `DEFAULT_BASE_URLS`: an endpoint other than these is an address the owner gave.
const DEFAULT_ENDPOINTS: [&str; 2] = ["https://api.anthropic.com", "https://api.openai.com/v1"];
const OWNER_ONLY: &str = "search-harder.owner-only";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHarderSource {
    /// The first memo on npm with both `search-consents set <provider>` and `search all --harder`; `None` until one
    /// is released, which counts as too old.
    pub min_version: Option<String>,
    pub show: Vec<String>,
    /// `set {provider} {model} {baseUrl}` without `--yes`: what would be sent and where; changes nothing.
    pub preview: Vec<String>,
    pub on: Vec<String>,
    pub off: Vec<String>,
    /// `{limit}` and `{query}` filled here; the query goes after `--`.
    pub search: Vec<String>,
}

/// What `show` and `set` report; never a question or a hit.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HarderStatus {
    pub on: bool,
    pub provider: String,
    pub model: String,
    pub endpoint_host: String,
    /// The address when the owner gave one (`OpenRouter`…), so the form can show it again.
    pub base_url: Option<String>,
    /// memo proposed the provider and model the owner chose for enrichment.
    pub proposed_from_enrichment: bool,
    pub consented_at: Option<String>,
    /// How many of the first hits go to the model, and how much of each one's text.
    pub candidates: u64,
    pub chars_per_hit: u64,
    /// `None` for a model memo has no price for.
    pub usd_per_million_input: Option<f64>,
    pub usd_per_million_output: Option<f64>,
    pub key: EnrichmentKey,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum SearchHarder {
    /// The installed memo is older than `need`, or `need` is `None`: no memo with it is released yet.
    Old {
        version: Option<String>,
        need: Option<String>,
    },
    Ready {
        status: Box<HarderStatus>,
    },
}

/// What the owner picks in the window. A missing model is memo's default for the provider.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarderChoice {
    pub provider: String,
    pub model: Option<String>,
    pub base_url: Option<String>,
}

/// What memo's `meta.ranking` says of one search harder: whether the model's order replaced memo's own, and the model
/// and cost of the call.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HarderOutcome {
    pub applied: bool,
    /// memo's id for why not (`harder.no-key`), which the interface words in its own language.
    pub reason: Option<String>,
    /// memo's English for the same, shown only for an id the interface does not know.
    pub why: Option<String>,
    pub provider: String,
    pub model: String,
    /// `None` when memo has no price for the model.
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HarderAnswer {
    pub answer: search::Answer,
    /// Only beside hits.
    pub outcome: Option<HarderOutcome>,
}

fn source(tool: &Tool) -> Result<&SearchHarderSource, String> {
    tool.search_harder.as_ref().ok_or_else(|| format!("{} cannot search harder", tool.name))
}

fn installed_version(tool: &Tool) -> Option<String> {
    tools::detect(tool, false).installs.first().and_then(|i| i.version.clone())
}

fn gate(src: &SearchHarderSource, version: Option<&str>) -> bool {
    src.min_version.as_deref().is_some_and(|need| !tools::older(version, need))
}

fn too_old(tool: &Tool, src: &SearchHarderSource) -> Result<(), String> {
    if gate(src, installed_version(tool).as_deref()) {
        Ok(())
    } else {
        Err("This memo cannot search harder yet. It comes with a memo update.".into())
    }
}

fn checked_model(model: &str) -> Result<&str, String> {
    let model = model.trim();
    let ok = !model.is_empty()
        && model.len() <= MAX_MODEL
        && !model.starts_with('-')
        && model.chars().all(|c| c.is_ascii_alphanumeric() || "._:/-@+".contains(c));
    if ok { Ok(model) } else { Err(format!("not a model name: {model}")) }
}

/// An HTTP or HTTPS address with a host and no user, password, query or fragment, as memo itself accepts.
fn checked_base_url(raw: &str) -> Result<String, String> {
    let raw = raw.trim();
    let bad = || format!("not a model API address: {raw}");
    if raw.len() > MAX_URL || raw.starts_with('-') {
        return Err(bad());
    }
    let url = tauri::Url::parse(raw).map_err(|_| bad())?;
    let ok = matches!(url.scheme(), "https" | "http")
        && url.host_str().is_some_and(|h| !h.is_empty())
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none();
    if ok { Ok(raw.trim_end_matches('/').to_string()) } else { Err(bad()) }
}

/// The words `{model}` and `{baseUrl}` stand for: a flag and its value, or nothing.
fn choice_words(choice: &HarderChoice) -> Result<(Vec<String>, Vec<String>), String> {
    if !PROVIDERS.contains(&choice.provider.as_str()) {
        return Err(format!("search harder calls anthropic or openai, not {}", choice.provider));
    }
    let model = choice.model.as_deref().map(str::trim).filter(|m| !m.is_empty());
    let base_url = choice.base_url.as_deref().map(str::trim).filter(|u| !u.is_empty());
    if base_url.is_some() && model.is_none() {
        return Err("Name the model that address serves.".into());
    }
    let model = model.map(checked_model).transpose()?.map(|m| vec!["--model".into(), m.to_string()]);
    let base_url = base_url.map(checked_base_url).transpose()?.map(|u| vec!["--base-url".into(), u]);
    Ok((model.unwrap_or_default(), base_url.unwrap_or_default()))
}

fn with_choice(words: &[String], choice: &HarderChoice) -> Result<Vec<String>, String> {
    let (model, base_url) = choice_words(choice)?;
    let mut out = Vec::with_capacity(words.len() + 4);
    for w in words {
        match w.as_str() {
            "{provider}" => out.push(choice.provider.clone()),
            "{model}" => out.extend(model.iter().cloned()),
            "{baseUrl}" => out.extend(base_url.iter().cloned()),
            _ => out.push(w.clone()),
        }
    }
    Ok(out)
}

fn search_args(src: &SearchHarderSource, query: &str, limit: u32) -> Result<Vec<String>, String> {
    search::validate_query(query)?;
    if !(1..=search::MAX_LIMIT).contains(&limit) {
        return Err(format!("limit must be 1 to {}", search::MAX_LIMIT));
    }
    Ok(src
        .search
        .iter()
        .map(|a| match a.as_str() {
            "{query}" => query.to_string(),
            "{limit}" => limit.to_string(),
            _ => a.clone(),
        })
        .collect())
}

fn host_of(endpoint: &str) -> String {
    tauri::Url::parse(endpoint).ok().and_then(|u| u.host_str().map(str::to_string)).unwrap_or_default()
}

fn status_of(v: &Value) -> Option<HarderStatus> {
    let item = body(v);
    let text = |k: &str| item[k].as_str().map(str::to_string);
    let endpoint = text("endpoint")?;
    let key = &item["key"];
    Some(HarderStatus {
        on: item["on"].as_bool()?,
        provider: text("provider")?,
        model: text("model")?,
        endpoint_host: host_of(&endpoint),
        base_url: (!DEFAULT_ENDPOINTS.contains(&endpoint.as_str())).then_some(endpoint),
        proposed_from_enrichment: item["proposed_from"].as_str() == Some("enrichment"),
        consented_at: text("consented_at"),
        candidates: item["candidates"].as_u64().unwrap_or(0),
        chars_per_hit: item["chars_per_hit"].as_u64().unwrap_or(0),
        usd_per_million_input: item["usd_per_million"]["input"].as_f64(),
        usd_per_million_output: item["usd_per_million"]["output"].as_f64(),
        key: EnrichmentKey {
            present: key["present"].as_bool().unwrap_or(false),
            source: key["source"].as_str().map(str::to_string),
            env_var: key["env_var"].as_str().map(str::to_string),
        },
    })
}

/// memo refuses `--yes` when it sees an AI agent's variables, which a `WireCat` started from such a terminal inherits.
fn refusal(out: &crate::run::Output, json: Option<&Value>) -> String {
    if json.and_then(|v| v["error"]["reason"].as_str()) == Some(OWNER_ONLY) {
        return "memo lets only you allow this, and WireCat was started from an AI agent's terminal. Open WireCat \
                from the app menu and turn it on there."
            .into();
    }
    failure(out, json)
}

fn ask(tool: &Tool, args: &[String], timeout: Duration) -> Result<HarderStatus, String> {
    let (out, json) = call(tool, args, timeout)?;
    if out.code != Some(0) {
        return Err(refusal(&out, json.as_ref()));
    }
    json.as_ref().and_then(status_of).ok_or_else(|| "memo gave an answer the app cannot read".to_string())
}

pub fn status(tool: &Tool) -> Result<SearchHarder, String> {
    let src = source(tool)?;
    let version = installed_version(tool);
    if !gate(src, version.as_deref()) {
        return Ok(SearchHarder::Old { version, need: src.min_version.clone() });
    }
    Ok(SearchHarder::Ready { status: Box::new(ask(tool, &src.show, CALL)?) })
}

/// What turning it on with this choice would send, and where. Changes nothing.
pub fn preview(tool: &Tool, choice: &HarderChoice) -> Result<HarderStatus, String> {
    let src = source(tool)?;
    too_old(tool, src)?;
    ask(tool, &with_choice(&src.preview, choice)?, CALL)
}

/// The owner agreed in the window; memo records when.
pub fn turn_on(tool: &Tool, choice: &HarderChoice) -> Result<HarderStatus, String> {
    let src = source(tool)?;
    too_old(tool, src)?;
    ask(tool, &with_choice(&src.on, choice)?, CALL)
}

pub fn turn_off(tool: &Tool) -> Result<HarderStatus, String> {
    let src = source(tool)?;
    too_old(tool, src)?;
    ask(tool, &src.off, CALL)
}

const NOT_REORDERED: &str = "not reordered by the model: ";

/// memo's `order` note leaves the general notes: the outcome says it, in the owner's language. No `meta.ranking`, no
/// outcome: the window then claims nothing about the order.
fn with_outcome(answer: search::Answer, body: Option<&Value>) -> HarderAnswer {
    let search::Answer::Hits { hits, has_more, paged, notes, total } = answer else {
        return HarderAnswer { answer, outcome: None };
    };
    let order = body
        .and_then(|b| b["missing"].as_array())
        .into_iter()
        .flatten()
        .find(|m| m["field"].as_str() == Some("order"))
        .and_then(|m| m["why"].as_str())
        .map(str::to_string);
    let notes = notes.into_iter().filter(|n| Some(n) != order.as_ref()).collect();
    let outcome = body.map(|b| &b["meta"]["ranking"]).filter(|r| r.is_object()).map(|r| {
        let text = |k: &str| r[k].as_str().map(str::to_string);
        let applied = r["applied"].as_bool() == Some(true);
        HarderOutcome {
            applied,
            reason: text("reason_id").filter(|_| !applied),
            why: order.filter(|_| !applied).map(|w| w.strip_prefix(NOT_REORDERED).map_or(w.clone(), str::to_string)),
            provider: text("provider").unwrap_or_default(),
            model: text("model").unwrap_or_default(),
            cost_usd: r["cost_usd"].as_f64(),
        }
    });
    HarderAnswer { answer: search::Answer::Hits { hits, has_more, paged, notes, total }, outcome }
}

/// One search the owner asked to search harder: the question and its first hits go to the model he agreed to.
pub fn run(tool: &Tool, query: &str, limit: u32) -> Result<HarderAnswer, String> {
    let src = source(tool)?;
    too_old(tool, src)?;
    let args = search_args(src, query, limit)?;
    let bin = tools::program(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = crate::run::run(&bin, &refs, Some(&crate::paths::search_path()), SEARCH).map_err(|e| e.to_string())?;
    let answer = search::read_shaped(SearchShape::Items, false, &out, limit);
    Ok(with_outcome(answer, out.json().as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog;
    use serde_json::json;

    // Answers of memo 0.131.73 (cli-core 0.620.0, Anthropic only, no `--harder` yet) in a throwaway home.
    const SHOW_OFF: &str = include_str!("../tests/fixtures/search-harder/memo-0.131.73-show-off.json");
    const OPENAI_REFUSED: &str = include_str!("../tests/fixtures/search-harder/memo-0.131.73-set-openai-refused.json");
    const AGENT_REFUSED: &str =
        include_str!("../tests/fixtures/search-harder/memo-0.131.73-set-yes-agent-refused.json");
    const UNKNOWN_OPTION: &str =
        include_str!("../tests/fixtures/search-harder/memo-0.131.73-harder-unknown-option.json");
    const ALL_NOTES: &str = include_str!("../tests/fixtures/search-harder/memo-0.131.73-search-all-notes.json");
    // Not from a released memo: written from the source of cli-core abc155262 (#2792).
    const OPENAI_PREVIEW: &str =
        include_str!("../tests/fixtures/search-harder/source-cli-core-abc155262-set-openai-preview.json");
    const ON_OPENROUTER: &str =
        include_str!("../tests/fixtures/search-harder/source-cli-core-abc155262-show-on-openrouter.json");
    const NOT_APPLIED: &str = include_str!("../tests/fixtures/search-harder/memo-0.131.74-harder-no-consent.json");

    fn parse(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    fn output(code: i32, stdout: &str, stderr: &str) -> crate::run::Output {
        crate::run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    fn memo_source() -> &'static SearchHarderSource {
        source(catalog::tool("memo").unwrap()).unwrap()
    }

    fn choice(provider: &str, model: Option<&str>, base_url: Option<&str>) -> HarderChoice {
        HarderChoice {
            provider: provider.into(),
            model: model.map(str::to_string),
            base_url: base_url.map(str::to_string),
        }
    }

    #[test]
    fn runs_memos_own_commands_with_the_choice_in_place() {
        let src = memo_source();
        assert_eq!(src.show.join(" "), "models search-consents show --no-record --json");
        assert_eq!(
            with_choice(&src.preview, &choice("openai", None, None)).unwrap().join(" "),
            "models search-consents set openai --no-record --json"
        );
        assert_eq!(
            with_choice(&src.on, &choice("anthropic", Some("claude-haiku-5-5"), None)).unwrap().join(" "),
            "models search-consents set anthropic --model claude-haiku-5-5 --yes --record --json"
        );
        let router = choice("openai", Some("deepseek/deepseek-chat"), Some("https://openrouter.ai/api/v1/"));
        assert_eq!(
            with_choice(&src.on, &router).unwrap().join(" "),
            "models search-consents set openai --model deepseek/deepseek-chat --base-url https://openrouter.ai/api/v1 \
             --yes --record --json"
        );
        assert_eq!(src.off.join(" "), "models search-consents revoke --record --json");
        assert!(!src.preview.contains(&"--yes".to_string()));
        assert!(source(catalog::tool("tg").unwrap()).is_err());
    }

    #[test]
    fn nothing_the_window_sends_becomes_a_flag() {
        let src = memo_source();
        for bad in [
            choice("gemini", None, None),
            choice("--yes", None, None),
            choice("openai", Some("--yes"), None),
            choice("openai", Some("gpt 4o"), None),
            choice("openai", Some("gpt\n4o"), None),
            choice("openai", Some(&"m".repeat(MAX_MODEL + 1)), None),
            choice("openai", None, Some("https://openrouter.ai/api/v1")),
            choice("openai", Some("m"), Some("--yes")),
            choice("openai", Some("m"), Some("file:///etc/passwd")),
            choice("openai", Some("m"), Some("https://user:secret@openrouter.ai/api/v1")),
            choice("openai", Some("m"), Some("https://openrouter.ai/api/v1?key=secret")),
            choice("openai", Some("m"), Some("https://openrouter.ai/api/v1#x")),
            choice("openai", Some("m"), Some("openrouter.ai")),
        ] {
            assert!(with_choice(&src.on, &bad).is_err(), "{bad:?}");
        }
        let local = choice("openai", Some("llama3.1:8b"), Some("http://localhost:11434/v1"));
        assert!(with_choice(&src.preview, &local).unwrap().contains(&"http://localhost:11434/v1".to_string()));
        assert_eq!(
            with_choice(&src.preview, &choice("openai", Some("  "), Some(" "))).unwrap().join(" "),
            "models search-consents set openai --no-record --json"
        );
    }

    #[test]
    fn the_search_sends_only_with_harder_and_is_never_recorded() {
        let src = memo_source();
        let args = search_args(src, "-tag:work budget", 50).unwrap();
        assert_eq!(
            args.join(" "),
            "search all --only notes --harder --limit 50 --no-record --json -- -tag:work budget"
        );
        assert!(search_args(src, "budget", 0).is_err());
        assert!(search_args(src, "budget", search::MAX_LIMIT + 1).is_err());
        assert!(search_args(src, "  ", 10).is_err());
    }

    #[test]
    fn a_memo_not_yet_released_counts_as_too_old() {
        let mut src = SearchHarderSource {
            min_version: None,
            show: vec![],
            preview: vec![],
            on: vec![],
            off: vec![],
            search: vec![],
        };
        assert!(!gate(&src, Some("9.0.0")));
        src.min_version = Some("0.132.0".into());
        assert!(!gate(&src, Some("0.131.73")));
        assert!(!gate(&src, None));
        assert!(gate(&src, Some("0.132.0")));
        // The first memo on npm with `--harder` and `meta.ranking`.
        assert_eq!(memo_source().min_version.as_deref(), Some("0.131.74"));
    }

    #[test]
    fn reads_the_released_anthropic_only_answer() {
        let s = status_of(&parse(SHOW_OFF)).unwrap();
        assert!(!s.on);
        assert_eq!((s.provider.as_str(), s.model.as_str()), ("anthropic", "claude-haiku-5-5"));
        assert_eq!((s.endpoint_host.as_str(), s.base_url.as_deref()), ("api.anthropic.com", None));
        assert_eq!((s.candidates, s.chars_per_hit), (30, 400));
        assert_eq!(s.usd_per_million_input, None);
        assert_eq!(s.key, EnrichmentKey { present: false, source: None, env_var: Some("ANTHROPIC_API_KEY".into()) });
        assert!(!s.proposed_from_enrichment);
    }

    #[test]
    fn reads_the_provider_choice_and_a_custom_address() {
        let p = status_of(&parse(OPENAI_PREVIEW)).unwrap();
        assert_eq!(
            (p.provider.as_str(), p.model.as_str(), p.endpoint_host.as_str()),
            ("openai", "gpt-4o-mini", "api.openai.com")
        );
        assert_eq!((p.usd_per_million_input, p.usd_per_million_output), (Some(0.15), Some(0.6)));
        assert!(p.proposed_from_enrichment);
        let on = status_of(&parse(ON_OPENROUTER)).unwrap();
        assert!(on.on && on.consented_at.is_some());
        assert_eq!(on.base_url.as_deref(), Some("https://openrouter.ai/api/v1"));
        assert_eq!(on.endpoint_host, "openrouter.ai");
        assert_eq!(on.usd_per_million_input, None);
        assert!(status_of(&json!({"item": {"on": false}})).is_none());
    }

    #[test]
    fn an_agents_terminal_gets_plain_words_and_other_refusals_memos() {
        let json = parse(AGENT_REFUSED);
        assert!(refusal(&output(1, "", ""), Some(&json)).contains("app menu"));
        let json = parse(OPENAI_REFUSED);
        assert_eq!(refusal(&output(2, "", ""), Some(&json)), "search all --harder calls anthropic only, not openai");
    }

    /// memo 0.131.74's answer as if the model had reordered it: the fields cli-base 0.94.0's `meta.ranking` sets then.
    fn reordered() -> Value {
        let mut v = parse(NOT_APPLIED);
        v["missing"] = json!([]);
        v["meta"]["ranking"] = json!({"applied": true, "provider": "openai", "model": "gpt-4o-mini",
            "endpoint": "https://api.openai.com/v1", "sent": 2, "cost_usd": 0.0002, "ms": 900});
        v
    }

    #[test]
    fn the_outcome_is_memos_ranking_block() {
        let body = reordered();
        let applied = with_outcome(
            search::read_shaped(SearchShape::Items, false, &output(0, &body.to_string(), ""), 50),
            Some(&body),
        );
        let outcome = applied.outcome.unwrap();
        assert!(outcome.applied);
        assert_eq!((outcome.reason, outcome.why), (None, None));
        assert_eq!((outcome.model.as_str(), outcome.cost_usd), ("gpt-4o-mini", Some(0.0002)));
        let search::Answer::Hits { hits, paged, .. } = &applied.answer else { panic!() };
        assert_eq!((hits.len(), *paged), (2, false));

        let kept = with_outcome(
            search::read_shaped(SearchShape::Items, false, &output(0, NOT_APPLIED, ""), 50),
            Some(&parse(NOT_APPLIED)),
        );
        let outcome = kept.outcome.unwrap();
        assert!(!outcome.applied);
        assert_eq!(outcome.reason.as_deref(), Some("harder.no-consent"));
        assert!(outcome.why.unwrap().starts_with("the owner has not agreed"));
        let search::Answer::Hits { notes, .. } = &kept.answer else { panic!() };
        assert!(notes.iter().all(|n| !n.contains("reordered")), "{notes:?}");

        let plain = with_outcome(
            search::read_shaped(SearchShape::Items, false, &output(0, ALL_NOTES, ""), 50),
            Some(&parse(ALL_NOTES)),
        );
        assert_eq!(plain.outcome, None);

        let old =
            search::read_shaped(SearchShape::Items, false, &output(2, "", &parse(UNKNOWN_OPTION).to_string()), 50);
        let old = with_outcome(old, None);
        assert!(matches!(old.answer, search::Answer::Old { .. }));
        assert_eq!(old.outcome, None);
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(SearchHarder::Old { version: Some("0.131.73".into()), need: None }).unwrap(),
            json!({"state": "old", "version": "0.131.73", "need": null})
        );
        let v = serde_json::to_value(SearchHarder::Ready { status: Box::new(status_of(&parse(SHOW_OFF)).unwrap()) })
            .unwrap();
        assert_eq!(v["status"]["endpointHost"], "api.anthropic.com");
        assert_eq!(v["status"]["key"]["envVar"], "ANTHROPIC_API_KEY");
        assert_eq!(v["status"]["charsPerHit"], 400);
        let a = with_outcome(
            search::read_shaped(SearchShape::Items, false, &output(0, NOT_APPLIED, ""), 50),
            Some(&parse(NOT_APPLIED)),
        );
        let v = serde_json::to_value(a).unwrap();
        assert_eq!(v["answer"]["kind"], "hits");
        assert_eq!(v["outcome"]["reason"], "harder.no-consent");
        assert_eq!(v["outcome"]["costUsd"], 0.0);
    }
}
