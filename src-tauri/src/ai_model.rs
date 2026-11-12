//! Settings "AI model": the one model memo and the other tools share (`memo models ai …`). The key goes on
//! memo's stdin only, never on the command line, which other programs can read. Runs go through
//! `memory_add::with_memo`, so a refusal of a run fed the key answers only with a reason the page words.

use crate::memory::{plain, text, words};
use crate::memory_add::{link, one_line, with_memo_worded};
use crate::skills::body;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const READ: Duration = Duration::from_secs(30);
/// The check waits for the provider, and a model on this computer may need a while to load.
const CHECK: Duration = Duration::from_mins(2);
const PROVIDERS: [&str; 3] = ["anthropic", "openai", "ollama"];
const MAX_KEY: usize = 400;
const WORDED: [&str; 2] = ["ai.", "local-only.refused"];
const OLLAMA_TAGS: &str = "http://127.0.0.1:11434/api/tags";
const OPENROUTER_MODELS: &str = "https://openrouter.ai/api/v1/models";
const LIST: Duration = Duration::from_secs(10);
/// The whole of the bigger list was about 840 KB on 2026-11-11.
const MAX_LIST_BYTES: u64 = 8 * 1024 * 1024;
const MAX_MODELS: usize = 2000;
const MAX_MODEL_NAME: usize = 200;
const LIST_FAILED: &str = "ai.list-unreachable";

/// memo's message can quote what the provider answered, including part of a key. Only a reason the page words, or
/// commander's refusal of a command an older memo lacks, goes on; anything else comes back as `memo.refused`.
fn guarded(e: String) -> String {
    let old = e.contains("unknown command") || e.contains("unknown option");
    let worded = e.starts_with("ai.") || e == "local-only.refused" || e == crate::memory_add::REFUSED;
    if worded || old && e.len() < 200 { e } else { crate::memory_add::REFUSED.into() }
}

fn with_memo<T>(timeout: Duration, f: impl FnOnce(&crate::memory_add::Feed) -> Result<T, String>) -> Result<T, String> {
    with_memo_worded(timeout, &WORDED, f).map_err(guarded)
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiKey {
    pub stored: bool,
    /// `keyring`, `file` or `environment`; the key itself never comes back.
    pub source: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub origin: Option<String>,
    pub beta: bool,
    /// The owner agreed that pictures go to this model.
    pub images: bool,
    pub key: AiKey,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AiChecked {
    pub ok: bool,
    pub reason: String,
    pub ms: Option<u64>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub origin: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiOff {
    pub changed: bool,
    pub key_kept: bool,
}

/// No `Debug`: it holds the key, and a stray `{:?}` would print it.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetModel {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub key: Option<String>,
    pub images: bool,
}

fn model_of(v: &Value) -> AiModel {
    let item = body(v);
    AiModel {
        provider: text(item, "provider"),
        model: text(item, "model"),
        base_url: text(item, "base_url"),
        origin: text(item, "origin"),
        beta: item["beta"].as_bool().unwrap_or(false),
        images: item["images"].as_bool().unwrap_or(false),
        key: AiKey { stored: item["key"]["stored"].as_bool().unwrap_or(false), source: text(&item["key"], "source") },
    }
}

fn set_args(s: &SetModel) -> Result<(Vec<String>, Option<String>), String> {
    let provider =
        PROVIDERS.iter().find(|p| **p == s.provider).ok_or_else(|| format!("not a provider: {}", s.provider))?;
    let mut args: Vec<String> = ["models", "ai", "set", provider].iter().map(|a| (*a).to_string()).collect();
    // One word each, so a value that starts with `-` is never read as an option.
    args.push(format!("--model={}", one_line("A model", &s.model, 200)?));
    if let Some(url) = s.base_url.as_deref().map(str::trim).filter(|u| !u.is_empty()) {
        args.push(format!("--base-url={}", link(url)?));
    }
    let key = s.key.as_deref().map(str::trim).filter(|k| !k.is_empty());
    if let Some(k) = key
        && (k.len() > MAX_KEY || k.chars().any(|c| c.is_whitespace() || c.is_control()))
    {
        return Err("Paste the key as the provider shows it: one word, no spaces.".into());
    }
    if key.is_some() {
        args.push("--secret-stdin".into());
    }
    // Consent is per call: memo drops it when the flag is missing, so one `set` carries the owner's whole choice.
    if s.images {
        args.push("--allow-remote".into());
    }
    args.push("--from-app".into());
    args.extend(words(&[]));
    Ok((args, key.map(str::to_string)))
}

fn show_with(feed: &crate::memory_add::Feed) -> Result<AiModel, String> {
    Ok(model_of(&feed(&words(&["models", "ai", "show"]), None)?))
}

fn owner_words(parts: &[&str]) -> Vec<String> {
    let mut args = words(parts);
    args.insert(parts.len(), "--from-app".into());
    args
}

pub fn show() -> Result<AiModel, String> {
    with_memo(READ, show_with)
}

fn set_with(feed: &crate::memory_add::Feed, s: &SetModel) -> Result<AiModel, String> {
    let (args, key) = set_args(s)?;
    Ok(model_of(&feed(&args, key.as_deref().map(str::as_bytes))?))
}

pub fn set(s: &SetModel) -> Result<AiModel, String> {
    with_memo(READ, |feed| set_with(feed, s))
}

pub fn off() -> Result<AiOff, String> {
    with_memo(READ, |feed| {
        let v = feed(&owner_words(&["models", "ai", "unset"]), None)?;
        let item = body(&v);
        Ok(AiOff {
            changed: item["changed"].as_bool().unwrap_or(false),
            key_kept: item["key_kept"].as_bool().unwrap_or(true),
        })
    })
}

fn checked(v: &Value) -> AiChecked {
    let item = body(v);
    let ok = item["ok"].as_bool().unwrap_or(false);
    let reason = text(item, "reason").filter(|r| plain(r).is_some() && r.len() <= 60 && r.starts_with("ai."));
    AiChecked {
        ok,
        reason: reason.unwrap_or_else(|| (if ok { "ai.ok" } else { "ai.failed" }).into()),
        ms: item["ms"].as_u64(),
        provider: text(item, "provider"),
        model: text(item, "model"),
        origin: text(item, "origin"),
    }
}

/// A check that fails may exit with a code: its reason is still the answer, not an error.
pub fn check() -> Result<AiChecked, String> {
    with_memo(CHECK, |feed| match feed(&owner_words(&["models", "ai", "check"]), None) {
        Ok(v) => Ok(checked(&v)),
        Err(reason) if reason.starts_with("ai.") => {
            Ok(AiChecked { ok: false, reason, ms: None, provider: None, model: None, origin: None })
        }
        Err(e) => Err(e),
    })
}

fn model_names(v: &Value, array: &str, field: &str) -> Vec<String> {
    let mut names: Vec<String> = v[array]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|m| text(m, field))
        .filter(|n| n.len() <= MAX_MODEL_NAME && !n.chars().any(char::is_control))
        .take(MAX_MODELS)
        .collect();
    names.sort();
    names.dedup();
    names
}

/// The lists that need no key, from fixed addresses. The official providers' lists need the key, which only memo
/// reads, so they wait for a `models ai list` in memo.
pub fn list(source: &str) -> Result<Vec<String>, String> {
    let (url, array, field) = match source {
        "ollama" => (OLLAMA_TAGS, "models", "name"),
        "openrouter" => (OPENROUTER_MODELS, "data", "id"),
        _ => return Err(format!("not a model list: {source}")),
    };
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(LIST)).max_redirects(0).build().into();
    let body = agent
        .get(url)
        .call()
        .map_err(|_| LIST_FAILED.to_string())?
        .body_mut()
        .with_config()
        .limit(MAX_LIST_BYTES)
        .read_to_string()
        .map_err(|_| LIST_FAILED.to_string())?;
    let value: Value = serde_json::from_str(&body).map_err(|_| LIST_FAILED.to_string())?;
    Ok(model_names(&value, array, field))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    type Seen = Mutex<Vec<(Vec<String>, Option<String>)>>;

    fn input(provider: &str, key: Option<&str>) -> SetModel {
        SetModel {
            provider: provider.into(),
            model: "claude-haiku-4-5".into(),
            base_url: None,
            key: key.map(str::to_string),
            images: true,
        }
    }

    #[test]
    fn the_key_goes_on_stdin_and_never_into_the_arguments() {
        let (args, stdin) = set_args(&input("anthropic", Some("  sk-ant-test-123 "))).unwrap();
        assert_eq!(stdin.as_deref(), Some("sk-ant-test-123"));
        assert!(!args.iter().any(|a| a.contains("sk-ant")), "{args:?}");
        assert_eq!(
            args,
            [
                "models",
                "ai",
                "set",
                "anthropic",
                "--model=claude-haiku-4-5",
                "--secret-stdin",
                "--allow-remote",
                "--from-app",
                "--json",
                "--no-record"
            ]
        );
    }

    #[test]
    fn without_a_key_nothing_is_fed_and_images_off_omits_the_flag() {
        let mut s = input("ollama", None);
        s.images = false;
        s.key = Some("   ".into());
        let (args, stdin) = set_args(&s).unwrap();
        assert!(stdin.is_none());
        assert!(!args.iter().any(|a| a == "--secret-stdin" || a == "--allow-remote"), "{args:?}");
    }

    #[test]
    fn the_address_is_one_word_and_only_http_or_https() {
        let mut s = input("openai", Some("sk-test"));
        s.base_url = Some(" https://openrouter.ai/api/v1 ".into());
        let (args, _) = set_args(&s).unwrap();
        assert!(args.contains(&"--base-url=https://openrouter.ai/api/v1".to_string()));
        for bad in ["file:///etc/passwd", "-https://x", "https://a b", "ftp://x"] {
            s.base_url = Some(bad.into());
            assert!(set_args(&s).is_err(), "{bad}");
        }
        s.base_url = Some("  ".into());
        assert!(!set_args(&s).unwrap().0.iter().any(|a| a.starts_with("--base-url")));
    }

    #[test]
    fn refuses_what_memo_could_read_as_something_else() {
        assert!(set_args(&input("--help", None)).is_err());
        assert!(set_args(&input("gemini", None)).is_err());
        let mut s = input("openai", Some("two words"));
        assert!(set_args(&s).is_err());
        s.key = Some("a".repeat(MAX_KEY + 1));
        assert!(set_args(&s).is_err());
        s.key = None;
        s.model = "bad\nmodel".into();
        assert!(set_args(&s).is_err());
        s.model = "-x".into();
        assert!(set_args(&s).is_ok_and(|(a, _)| a.contains(&"--model=-x".to_string())));
    }

    #[test]
    fn a_save_is_one_call_and_never_revokes() {
        let seen: Seen = Mutex::new(Vec::new());
        let feed = |a: &[String], _: Option<&[u8]>| -> Result<Value, String> {
            seen.lock().unwrap().push((a.to_vec(), None));
            Ok(json!({"item": {"provider": "ollama", "model": "llava", "images": false, "key": {"stored": false}}}))
        };
        let mut s = input("ollama", None);
        s.images = false;
        set_with(&feed, &s).unwrap();
        s.images = true;
        set_with(&feed, &s).unwrap();
        let seen = seen.lock().unwrap();
        assert_eq!(seen.len(), 2);
        assert!(seen.iter().all(|(a, _)| a[2] == "set"));
        assert!(!seen[0].0.contains(&"--allow-remote".to_string()));
        assert!(seen[1].0.contains(&"--allow-remote".to_string()));
    }

    #[test]
    fn calls_match_the_contract_and_carry_no_key() {
        let seen: Seen = Mutex::new(Vec::new());
        let feed = |a: &[String], i: Option<&[u8]>| -> Result<Value, String> {
            seen.lock().unwrap().push((a.to_vec(), i.map(|b| String::from_utf8_lossy(b).to_string())));
            Ok(json!({"item": {"changed": true, "key_kept": true}}))
        };
        show_with(&feed).unwrap();
        feed(&owner_words(&["models", "ai", "unset"]), None).unwrap();
        feed(&owner_words(&["models", "ai", "check"]), None).unwrap();
        let seen = seen.lock().unwrap();
        assert_eq!(seen[0].0, ["models", "ai", "show", "--json", "--no-record"]);
        assert_eq!(seen[1].0, ["models", "ai", "unset", "--from-app", "--json", "--no-record"]);
        assert!(seen.iter().all(|(_, input)| input.is_none()));
    }

    #[test]
    fn memos_words_never_reach_the_page_but_a_reason_or_an_old_memo_does() {
        assert_eq!(guarded("ai.no-credit".into()), "ai.no-credit");
        assert_eq!(guarded("local-only.refused".into()), "local-only.refused");
        assert_eq!(guarded("error: unknown command 'ai'".into()), "error: unknown command 'ai'");
        assert_eq!(guarded("Incorrect API key provided: sk-proj-****abcd".into()), crate::memory_add::REFUSED);
    }

    #[test]
    fn a_model_list_keeps_only_clean_names_in_order() {
        let v = json!({"data": [{"id": "b/two"}, {"id": "a/one"}, {"id": "a/one"}, {"id": "bad\nname"},
            {"id": "x".repeat(MAX_MODEL_NAME + 1)}, {"name": "no id"}]});
        assert_eq!(model_names(&v, "data", "id"), ["a/one", "b/two"]);
        assert_eq!(model_names(&json!({"error": "nope"}), "data", "id"), Vec::<String>::new());
    }

    #[test]
    fn only_the_two_fixed_lists_can_be_asked_for() {
        assert_eq!(list("https://example.org").unwrap_err(), "not a model list: https://example.org");
    }

    #[test]
    fn reads_memos_answers() {
        let m = model_of(&json!({"item": {"provider": "openai", "model": "openai/gpt-4o-mini",
            "base_url": "https://openrouter.ai/api/v1", "origin": "https://openrouter.ai", "beta": false,
            "images": true, "key": {"stored": true, "source": "file"}}}));
        assert_eq!(
            serde_json::to_value(&m).unwrap(),
            json!({"provider":"openai","model":"openai/gpt-4o-mini","baseUrl":"https://openrouter.ai/api/v1",
                "origin":"https://openrouter.ai","beta":false,"images":true,"key":{"stored":true,"source":"file"}})
        );
        let none = model_of(&json!({"item": {"provider": null, "model": null, "images": false,
            "key": {"stored": false, "source": null}}}));
        assert!(none.provider.is_none() && !none.images && !none.key.stored);
        let c = checked(&json!({"item": {"ok": false, "reason": "ai.key-rejected", "ms": 120}}));
        assert_eq!((c.ok, c.reason.as_str(), c.ms), (false, "ai.key-rejected", Some(120)));
        assert_eq!(checked(&json!({"item": {"ok": false, "reason": "has space"}})).reason, "ai.failed");
        assert_eq!(checked(&json!({"item": {"ok": false, "reason": "toString"}})).reason, "ai.failed");
        assert_eq!(checked(&json!({"item": {"ok": true}})).reason, "ai.ok");
    }
}
