//! The signed list of community tools (docs/dev/cli-registry.md). cli-docs' deploy builds it from its reviewed
//! `tools.json` and signs it with minisign; the app keeps a copy only when the signature verifies against the key
//! compiled in from `registry-key.pub` (never the updater's key), it has not expired, and its version is not lower
//! than the copy already kept. A list fetched now takes effect at the next start, so no page changes under the owner.
//! Without a good copy the app has its built-in tools only.

use chrono::{DateTime, Utc};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const URL: &str = "https://wirecat.dev/registry/v1/desktop-tools.json";
const KEY_FILE: &str = include_str!("../registry-key.pub");
const PLACEHOLDER: &str = "REPLACE-WITH-THE-REGISTRY-PUBLIC-KEY";
const LIST: &str = "desktop-tools.json";
const SIG: &str = "desktop-tools.json.minisig";
const CHECKED: &str = "checked";
const SETTING: &str = "community-tools.json";
const MAX_SIG: usize = 4096;
const DAY: i64 = 24 * 60 * 60;

/// The registry key, or why this build fetches no list.
pub fn key() -> Result<PublicKey, String> {
    key_from(KEY_FILE)
}

fn key_from(text: &str) -> Result<PublicKey, String> {
    let line = text.lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with('#')).unwrap_or(PLACEHOLDER);
    if line == PLACEHOLDER {
        return Err("This copy of WireCat has no key for the community list yet, so the list is not fetched.".into());
    }
    PublicKey::from_base64(line).map_err(|e| format!("The community list's key in this build is broken ({e})."))
}

/// A list whose signature verified.
#[derive(Debug)]
pub struct List {
    pub version: u64,
    pub expires_at: DateTime<Utc>,
    pub tools: Vec<Value>,
}

/// Checks the signature first, so nothing in an unsigned file is even parsed.
fn open(list: &[u8], sig: &str, key: &PublicKey) -> Result<List, String> {
    if list.len() > crate::community::MAX_BYTES || sig.len() > MAX_SIG {
        return Err("The community list is larger than it may be.".into());
    }
    let signature = Signature::decode(sig).map_err(|_| "The community list's signature is unreadable.")?;
    key.verify(list, &signature, false).map_err(|_| "The community list's signature does not match WireCat's key.")?;
    let v: Value = serde_json::from_slice(list).map_err(|_| "The community list is not valid JSON.")?;
    let expires_at = v["expires_at"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok());
    match (v["format"].as_u64(), v["version"].as_u64(), expires_at, v["tools"].as_array()) {
        (Some(1), Some(version), Some(expires), Some(tools)) => {
            Ok(List { version, expires_at: expires.with_timezone(&Utc), tools: tools.clone() })
        }
        _ => Err("The community list has no format 1, version, expiry date or tools.".into()),
    }
}

/// A verified list is still taken only before it expires and when it is not older than the copy kept (`floor`), so an
/// old signed list replayed by a network in between cannot bring back a tool that was removed.
fn accept(list: List, now: DateTime<Utc>, floor: u64) -> Result<List, String> {
    if list.expires_at <= now {
        return Err(format!("The community list expired on {}.", list.expires_at.format("%Y-%m-%d")));
    }
    if list.version < floor {
        return Err(format!("The community list is older ({}) than the copy kept ({floor}).", list.version));
    }
    Ok(list)
}

fn dir() -> Option<PathBuf> {
    crate::node::app_data().map(|d| d.join("registry"))
}

fn read_cache(dir: &Path, key: &PublicKey) -> Result<List, String> {
    let list = std::fs::read(dir.join(LIST)).map_err(|_| "No community list has been fetched yet.")?;
    let sig = std::fs::read_to_string(dir.join(SIG)).map_err(|_| "No community list has been fetched yet.")?;
    open(&list, &sig, key)
}

/// The entries of the kept copy, checked again as if it had just arrived.
pub fn at_start() -> Result<Vec<Value>, String> {
    let key = key()?;
    let dir = dir().ok_or("The app's data folder is unknown.")?;
    cached(&dir, &key, Utc::now())
}

fn cached(dir: &Path, key: &PublicKey, now: DateTime<Utc>) -> Result<Vec<Value>, String> {
    Ok(accept(read_cache(dir, key)?, now, 0)?.tools)
}

/// Keeps a newly fetched list when it passes; a list that fails leaves the kept copy as it was.
fn refresh(
    dir: &Path,
    key: &PublicKey,
    now: DateTime<Utc>,
    fetch: impl Fn(&str, usize) -> Result<Vec<u8>, String>,
) -> Result<u64, String> {
    // An expired kept copy still sets the floor: only its signature is needed for that.
    let floor = read_cache(dir, key).map_or(0, |l| l.version);
    let list = fetch(URL, crate::community::MAX_BYTES)?;
    let sig = fetch(&format!("{URL}.minisig"), MAX_SIG)?;
    let sig = String::from_utf8(sig).map_err(|_| "The community list's signature is unreadable.")?;
    let version = accept(open(&list, &sig, key)?, now, floor)?.version;
    std::fs::create_dir_all(dir).map_err(|e| format!("Could not keep the community list: {e}"))?;
    for (name, bytes) in [(SIG, sig.as_bytes()), (LIST, &list[..])] {
        let partial = dir.join(format!("{name}.partial"));
        std::fs::write(&partial, bytes)
            .and_then(|()| std::fs::rename(&partial, dir.join(name)))
            .map_err(|e| format!("Could not keep the community list: {e}"))?;
    }
    Ok(version)
}

fn mark_checked(dir: &Path, now: DateTime<Utc>) {
    let _ = std::fs::create_dir_all(dir).and_then(|()| std::fs::write(dir.join(CHECKED), now.timestamp().to_string()));
}

fn due(dir: &Path, now: DateTime<Utc>) -> bool {
    let last = std::fs::read_to_string(dir.join(CHECKED)).ok().and_then(|s| s.trim().parse::<i64>().ok());
    last.is_none_or(|t| now.timestamp() - t >= DAY || t > now.timestamp())
}

fn fetch(url: &str, limit: usize) -> Result<Vec<u8>, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .https_only(true)
        .max_redirects(0)
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into();
    let mut response = agent.get(url).call().map_err(|e| format!("Could not fetch the community list: {e}"))?;
    response
        .body_mut()
        .with_config()
        .limit(limit as u64)
        .read_to_vec()
        .map_err(|e| format!("Could not fetch the community list: {e}"))
}

/// Fetches the list once when the owner shows community tools and a day has passed since the last check.
pub fn check_now() -> Result<Option<u64>, String> {
    if !shown() {
        return Ok(None);
    }
    let key = key()?;
    let dir = dir().ok_or("The app's data folder is unknown.")?;
    let now = Utc::now();
    if !due(&dir, now) {
        return Ok(None);
    }
    mark_checked(&dir, now);
    refresh(&dir, &key, now, fetch).map(Some)
}

/// Runs for the life of the app: at start, then whenever a day has passed.
pub fn keep_fresh() {
    loop {
        let _ = check_now();
        std::thread::sleep(Duration::from_hours(1));
    }
}

fn setting_file() -> Option<PathBuf> {
    crate::node::app_data().map(|d| d.join(SETTING))
}

/// "Enable community tools", off until the owner turns it on.
pub fn shown() -> bool {
    setting_file().is_some_and(|f| read_shown(&f))
}

pub fn read_shown(file: &Path) -> bool {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .is_some_and(|v| v["show"] == true)
}

pub fn set_shown(show: bool) -> Result<(), String> {
    let file = setting_file().ok_or("The app's data folder is unknown.")?;
    write_shown(&file, show)
}

pub fn write_shown(file: &Path, show: bool) -> Result<(), String> {
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not save the setting: {e}"))?;
    }
    std::fs::write(file, serde_json::json!({ "show": show }).to_string())
        .map_err(|e| format!("Could not save the setting: {e}"))
}

/// What the Settings page shows: the owner's choice, whether this build can fetch the list at all, and how many tools
/// the copy kept at start added.
#[derive(specta::Type, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "CommunityStatus")]
pub struct Status {
    pub show: bool,
    pub available: bool,
    pub listed: usize,
}

pub fn status() -> Status {
    Status {
        show: shown(),
        available: key().is_ok(),
        listed: crate::catalog::catalog().extra.count(crate::community::Source::Community),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Cursor;

    struct Signer {
        pk: minisign::PublicKey,
        sk: minisign::SecretKey,
    }

    impl Signer {
        fn new() -> Self {
            let pair = minisign::KeyPair::generate_unencrypted_keypair().unwrap();
            Signer { pk: pair.pk, sk: pair.sk }
        }

        fn key(&self) -> PublicKey {
            PublicKey::from_base64(&self.pk.to_base64()).unwrap()
        }

        fn sign(&self, bytes: &[u8]) -> String {
            minisign::sign(Some(&self.pk), &self.sk, Cursor::new(bytes), Some("test list"), None).unwrap().into_string()
        }
    }

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-05T12:00:00Z").unwrap().with_timezone(&Utc)
    }

    fn list(version: u64, expires_at: &str) -> Vec<u8> {
        json!({ "format": 1, "version": version, "generated_at": "2026-11-05T00:00:00Z", "expires_at": expires_at,
            "tools": [{ "id": "acme" }] })
        .to_string()
        .into_bytes()
    }

    fn served(list: Vec<u8>, sig: String) -> impl Fn(&str, usize) -> Result<Vec<u8>, String> {
        move |url, _| Ok(if url.ends_with(".minisig") { sig.clone().into_bytes() } else { list.clone() })
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-registry-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn a_list_signed_with_the_key_is_kept_and_read_at_start() {
        let s = Signer::new();
        let body = list(7, "2026-12-05T00:00:00Z");
        let dir = temp_dir("ok");
        assert_eq!(refresh(&dir, &s.key(), now(), served(body.clone(), s.sign(&body))), Ok(7));
        assert_eq!(cached(&dir, &s.key(), now()).unwrap()[0]["id"], "acme");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_bad_signature_another_key_or_a_changed_byte_is_refused() {
        let (s, other) = (Signer::new(), Signer::new());
        let body = list(1, "2026-12-05T00:00:00Z");
        let mut changed = body.clone();
        changed[3] ^= 1;
        for (bytes, sig) in [(body.clone(), other.sign(&body)), (changed, s.sign(&body)), (body.clone(), "x".into())] {
            assert!(open(&bytes, &sig, &s.key()).is_err());
        }
        let dir = temp_dir("bad");
        assert!(refresh(&dir, &s.key(), now(), served(body.clone(), other.sign(&body))).is_err());
        assert!(!dir.exists(), "nothing is kept from a refused list");
    }

    #[test]
    fn an_expired_list_is_refused_and_an_expired_copy_is_not_used() {
        let s = Signer::new();
        let body = list(1, "2026-11-01T00:00:00Z");
        let err = accept(open(&body, &s.sign(&body), &s.key()).unwrap(), now(), 0).unwrap_err();
        assert!(err.contains("expired"), "{err}");
        let dir = temp_dir("expired");
        let fresh = list(1, "2026-11-06T00:00:00Z");
        refresh(&dir, &s.key(), now(), served(fresh.clone(), s.sign(&fresh))).unwrap();
        let later = DateTime::parse_from_rfc3339("2026-11-07T00:00:00Z").unwrap().with_timezone(&Utc);
        assert!(cached(&dir, &s.key(), later).unwrap_err().contains("expired"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_older_list_never_replaces_the_copy_kept_even_after_it_expired() {
        let s = Signer::new();
        let dir = temp_dir("older");
        let new = list(9, "2026-11-06T00:00:00Z");
        refresh(&dir, &s.key(), now(), served(new.clone(), s.sign(&new))).unwrap();
        let later = DateTime::parse_from_rfc3339("2026-11-07T00:00:00Z").unwrap().with_timezone(&Utc);
        let old = list(8, "2026-12-01T00:00:00Z");
        let err = refresh(&dir, &s.key(), later, served(old.clone(), s.sign(&old))).unwrap_err();
        assert!(err.contains("older"), "{err}");
        assert_eq!(read_cache(&dir, &s.key()).unwrap().version, 9);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failed_fetch_keeps_the_copy_and_no_copy_means_built_in_only() {
        let s = Signer::new();
        let dir = temp_dir("fallback");
        assert!(cached(&dir, &s.key(), now()).unwrap_err().contains("No community list"));
        let body = list(3, "2026-12-05T00:00:00Z");
        refresh(&dir, &s.key(), now(), served(body.clone(), s.sign(&body))).unwrap();
        let offline = |_: &str, _: usize| -> Result<Vec<u8>, String> { Err("offline".into()) };
        assert!(refresh(&dir, &s.key(), now(), offline).is_err());
        assert_eq!(cached(&dir, &s.key(), now()).unwrap().len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_placeholder_key_disables_the_fetch_and_says_so() {
        let err = key_from("# comment\nREPLACE-WITH-THE-REGISTRY-PUBLIC-KEY\n").unwrap_err();
        assert!(err.contains("no key"), "{err}");
        assert!(key_from("").is_err());
        assert!(key_from("not base64").unwrap_err().contains("broken"));
        let s = Signer::new();
        assert!(key_from(&format!("# ours\n{}\n", s.pk.to_base64())).is_ok());
    }

    #[test]
    fn the_shipped_key_is_not_the_updaters() {
        use base64::Engine;
        let conf: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let updater = conf["plugins"]["updater"]["pubkey"].as_str().unwrap();
        let updater = String::from_utf8(base64::engine::general_purpose::STANDARD.decode(updater).unwrap()).unwrap();
        let line = KEY_FILE.lines().find(|l| !l.trim().is_empty() && !l.starts_with('#')).unwrap().trim();
        assert!(!line.is_empty() && !updater.contains(line));
    }

    #[test]
    #[ignore = "fetches the live list from wirecat.dev"]
    fn registry_live() {
        let key = key().expect("this build has the real registry key, not the placeholder");
        let dir = temp_dir("live");
        let version = refresh(&dir, &key, Utc::now(), fetch).expect("the live list passes");
        let kept = read_cache(&dir, &key).unwrap();
        let days = (kept.expires_at - Utc::now()).num_days();
        println!(
            "live list: version {version}, expires {} ({days} days left), {} tools",
            kept.expires_at,
            kept.tools.len()
        );
        assert!(days >= 1, "the live list expires within a day");
        assert_eq!(cached(&dir, &key, Utc::now()).unwrap().len(), kept.tools.len());

        let offline = |_: &str, _: usize| -> Result<Vec<u8>, String> { Err("offline".into()) };
        assert!(refresh(&dir, &key, Utc::now(), offline).is_err());
        assert_eq!(cached(&dir, &key, Utc::now()).unwrap().len(), kept.tools.len(), "the kept copy works offline");

        let list = std::fs::read(dir.join(LIST)).unwrap();
        let sig = std::fs::read_to_string(dir.join(SIG)).unwrap();
        let mut changed = list.clone();
        changed[list.len() / 2] ^= 1;
        let fresh = temp_dir("live-changed");
        let err = refresh(&fresh, &key, Utc::now(), served(changed, sig.clone())).unwrap_err();
        assert!(err.contains("does not match"), "{err}");
        assert!(!fresh.exists(), "nothing is kept from a changed list");

        let after = kept.expires_at + chrono::Duration::seconds(1);
        let fresh = temp_dir("live-expired");
        assert!(refresh(&fresh, &key, after, served(list.clone(), sig.clone())).unwrap_err().contains("expired"));
        assert!(cached(&dir, &key, after).unwrap_err().contains("expired"));

        // No newer list signed with the real key exists, so the kept floor is raised instead.
        let err = accept(open(&list, &sig, &key).unwrap(), Utc::now(), version + 1).unwrap_err();
        assert!(err.contains("older"), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn checks_at_most_once_a_day() {
        let dir = temp_dir("due");
        assert!(due(&dir, now()));
        mark_checked(&dir, now());
        assert!(!due(&dir, now() + chrono::Duration::hours(23)));
        assert!(due(&dir, now() + chrono::Duration::hours(24)));
        assert!(due(&dir, now() - chrono::Duration::hours(1)), "a clock set back does not stop the checks");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_setting_is_off_until_turned_on() {
        let dir = temp_dir("setting");
        let file = dir.join(SETTING);
        assert!(!read_shown(&file));
        write_shown(&file, true).unwrap();
        assert!(read_shown(&file));
        write_shown(&file, false).unwrap();
        assert!(!read_shown(&file));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
