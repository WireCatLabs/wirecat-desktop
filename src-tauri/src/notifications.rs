use crate::report;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::Duration;

// The contract lives in docs/dev/notifications-api.md. The request carries the app's version and OS and nothing about
// its owner: every language comes back at once, and what was read stays in the interface's storage.
const LIMIT: usize = 20;
const SEVERITIES: [&str; 3] = ["info", "update", "security"];
const LOCALES: [&str; 3] = ["en", "ru", "es"];

type Localized = BTreeMap<String, String>;

#[derive(Deserialize)]
struct Answer {
    notifications: Vec<Incoming>,
}

#[derive(Deserialize)]
struct Incoming {
    id: String,
    severity: String,
    title: Localized,
    body: Localized,
    link: Option<IncomingLink>,
    published_at: String,
    expires_at: Option<String>,
}

#[derive(Deserialize)]
struct IncomingLink {
    url: String,
    label: Option<Localized>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    id: String,
    severity: String,
    title: Localized,
    body: Localized,
    link: Option<Link>,
    published_at: String,
    expires_at: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Link {
    url: String,
    label: Localized,
}

pub fn fetch() -> Result<Vec<Notification>, String> {
    let url = format!("{}/v1/notifications", report::api_base()?);
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(10))).build().into();
    let mut request = agent
        .get(&url)
        .header("User-Agent", concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .query("version", env!("CARGO_PKG_VERSION"));
    if let Some(platform) = platform() {
        request = request.query("platform", platform);
    }
    let mut response = request.call().map_err(|e| format!("Could not reach the WireCat server: {e}"))?;
    let answer: Answer = response.body_mut().read_json().map_err(|e| format!("The WireCat server answered: {e}"))?;
    Ok(answer.notifications.into_iter().take(LIMIT).map(clean).collect())
}

/// The API knows these three; any other OS asks for the notifications meant for every platform.
fn platform() -> Option<&'static str> {
    let os = std::env::consts::OS;
    ["linux", "macos", "windows"].contains(&os).then_some(os)
}

/// The interface opens a link with the system browser, so only a plain https address is passed on.
fn clean(n: Incoming) -> Notification {
    let link =
        n.link.filter(|l| safe_url(&l.url)).map(|l| Link { label: locales(l.label.unwrap_or_default()), url: l.url });
    Notification {
        id: n.id,
        severity: if SEVERITIES.contains(&n.severity.as_str()) { n.severity } else { "info".into() },
        title: locales(n.title),
        body: locales(n.body),
        link,
        published_at: n.published_at,
        expires_at: n.expires_at,
    }
}

fn locales(mut texts: Localized) -> Localized {
    texts.retain(|lang, _| LOCALES.contains(&lang.as_str()));
    texts
}

fn safe_url(url: &str) -> bool {
    url.strip_prefix("https://").is_some_and(|rest| {
        !rest.is_empty() && !rest.starts_with('/') && !rest.chars().any(|c| c.is_whitespace() || c.is_control())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn incoming(value: serde_json::Value) -> Incoming {
        serde_json::from_value(value).unwrap()
    }

    fn sample(link: serde_json::Value, severity: &str) -> Incoming {
        incoming(json!({
            "id": "6f1c", "severity": severity,
            "title": { "en": "Hello", "ru": "Привет", "de": "Hallo" }, "body": { "en": "Text" },
            "link": link, "published_at": "2026-11-01T12:00:00Z", "expires_at": null
        }))
    }

    #[test]
    fn keeps_an_https_link_and_the_three_languages() {
        let n = clean(sample(json!({ "url": "https://wirecat.dev/en", "label": { "en": "Open" } }), "security"));
        assert_eq!(n.severity, "security");
        assert_eq!(n.title.keys().collect::<Vec<_>>(), ["en", "ru"]);
        assert_eq!(n.link.unwrap().url, "https://wirecat.dev/en");
    }

    #[test]
    fn drops_a_link_that_is_not_plain_https() {
        for url in ["http://wirecat.dev", "javascript:alert(1)", "file:///etc/passwd", "https:///x", "https://a b"] {
            assert!(clean(sample(json!({ "url": url }), "info")).link.is_none(), "{url}");
        }
    }

    #[test]
    fn reads_an_unknown_severity_as_info() {
        assert_eq!(clean(sample(serde_json::Value::Null, "urgent")).severity, "info");
    }
}
