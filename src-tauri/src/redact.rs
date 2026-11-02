use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

fn sensitive_key() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)token|secret|password|passwd|cookie|credential|api_?key|auth_key|session_string|phone|e?mail|address|account|^name$|first_name|last_name|username|viewer_id|device_id|user_id|zoomuser|client_id|principal|proxy|base_url|authorization|bearer|api_?hash|^session$|_session$|jwt|passphrase|private_?key|^auth$|otp|chat_title|display_name")
            .unwrap()
    })
}

fn sensitive_text() -> &'static [(Regex, &'static str)] {
    static R: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    R.get_or_init(|| {
        vec![
            // A login code or token in a callback address is the credential itself.
            (
                Regex::new(r#"(?i)([?&#](?:access_token|refresh_token|id_token|token|code|key|api_key|secret|password|signature|sig|auth)=)[^&#\s'"]+"#).unwrap(),
                "${1}•••",
            ),
            (Regex::new(r"(?i)\bbearer\s+[\w\-.~+/]+=*").unwrap(), "Bearer •••"),
            (Regex::new(r"\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}").unwrap(), "[token]"),
            // Session strings and other long opaque keys. Nothing readable runs this long without a dot or a slash.
            (Regex::new(r"[A-Za-z0-9+_-]{80,}={0,2}").unwrap(), "[secret]"),
            (Regex::new(r"\b[0-9a-f]{32}\b").unwrap(), "[hash]"),
            (Regex::new(r"\b[\w-]+(?:\.[\w-]+)*\.ts\.net\b").unwrap(), "[tailnet name]"),
            (Regex::new(r"(?i)(/home/|/Users/|\\Users\\)[^/\\\s]+").unwrap(), "${1}[user]"),
            (Regex::new(r"[\w.+-]+@[\w-]+\.[\w.-]+").unwrap(), "[email]"),
            (Regex::new(r"\+\d[\d\s-]{7,}\d").unwrap(), "[number]"),
            (Regex::new(r"\b\d{6,}:[\w-]{30,}\b").unwrap(), "[bot token]"),
            (Regex::new(r"\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com").unwrap(), "[client id]"),
        ]
    })
}

/// Doctor output reaches the screen and the clipboard, so identifiers and secrets are masked.
/// Booleans and nulls stay: "token present: true" is the useful part and reveals nothing.
pub fn json(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (k, v) in map.iter_mut() {
                if sensitive_key().is_match(k)
                    && (matches!(v, Value::String(_) | Value::Number(_)) || is_scalar_list(v))
                {
                    *v = Value::String("•••".into());
                } else {
                    json(v);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(json),
        Value::String(s) => *s = text(s),
        _ => {}
    }
}

fn is_scalar_list(v: &Value) -> bool {
    v.as_array().is_some_and(|a| a.iter().all(|x| x.is_string() || x.is_number()))
}

pub fn text(s: &str) -> String {
    let mut out = crate::paths::tilde(s);
    for (re, with) in sensitive_text() {
        out = re.replace_all(&out, *with).into_owned();
    }
    ipv4()
        .replace_all(&out, |c: &regex::Captures| {
            let ip = &c[0];
            if ip.starts_with("127.") || ip == "0.0.0.0" { ip.to_string() } else { "[ip]".to_string() }
        })
        .into_owned()
}

/// Loopback stays: "127.0.0.1:8765" is the useful part of a server's answer and says nothing about anyone.
fn ipv4() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b").unwrap())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn masks_identifiers_keeps_flags() {
        let mut v = json!({
            "items": [{"profile": "personal", "account": "+34 600 000 000", "name": "Ann"}],
            "token": {"present": true, "from": "keyring"},
            "mail": {"accounts": [{"address": "a@b.com"}]},
            "note": "write to a@b.com, or call +34 600 000 000",
            "expires_at": "2026-10-25T03:12:00Z"
        });
        super::json(&mut v);
        assert_eq!(v["items"][0]["profile"], "personal");
        assert_eq!(v["items"][0]["account"], "•••");
        assert_eq!(v["items"][0]["name"], "•••");
        assert_eq!(v["token"]["present"], true);
        assert_eq!(v["mail"]["accounts"][0]["address"], "•••");
        assert_eq!(v["note"], "write to [email], or call [number]");
        assert_eq!(v["expires_at"], "2026-10-25T03:12:00Z");
    }

    #[test]
    fn masks_settings_that_may_carry_credentials() {
        let mut v = json!({
            "proxy": "http://user:pw@host:8080",
            "embedding_base_url": "https://key@example.test/v1",
            "client_id": "abc123",
            "principal": "someone",
            "limit": 20
        });
        super::json(&mut v);
        for key in ["proxy", "embedding_base_url", "client_id", "principal"] {
            assert_eq!(v[key], "•••", "{key}");
        }
        assert_eq!(v["limit"], 20);
    }

    #[test]
    fn masks_credentials_in_keys_addresses_and_free_text() {
        let session = format!("1BAAOMCOgAQ1nH3C5rQ-_r2ZbbzVhR4JmLhTzv1wq8kLSVm6TjTdP4mRzD0P{}=", "a".repeat(40));
        // Built here so no literal in the repository looks like a real credential to a secret scanner.
        let jwt = &format!("eyJ{}.eyJ{}.{}", "a".repeat(12), "b".repeat(16), "c".repeat(20));
        let hex = "0123456789abcdef".repeat(2);
        let mut v = json!({
            "Authorization": "Bearer x", "api_hash": hex, "session": session.clone(),
            "jwt": jwt, "passphrase": "hunter2", "private_key": "k", "chat_title": "Family chat",
            "code": "rate_limited", "from": "config defaults", "key": "FLOOD_WAIT"
        });
        super::json(&mut v);
        for key in ["Authorization", "api_hash", "session", "jwt", "passphrase", "private_key", "chat_title"] {
            assert_eq!(v[key], "•••", "{key}");
        }
        assert_eq!(v["code"], "rate_limited");
        assert_eq!(v["from"], "config defaults");
        assert_eq!(v["key"], "FLOOD_WAIT");

        let line = format!(
            "GET https://x.example/cb?access_token=abc123def456&code=XYZ&state=ok Authorization: Bearer abc.def-1 \
             jwt {jwt} session {session} hash {hex} from 81.2.69.160 via 127.0.0.1:8765 \
             at annas-mbp.tail1a2b.ts.net in /home/bob/x and C:\\Users\\bob\\x"
        );
        let masked = super::text(&line);
        for gone in
            ["abc123def456", "XYZ", "abc.def-1", jwt, &session, "0123456789abcdef", "81.2.69.160", "annas-mbp", "bob"]
        {
            assert!(!masked.contains(gone), "{gone} in {masked}");
        }
        let url = "https://github.com/WireCatLabs/wirecat-desktop/releases/latest/download/latest-release-notes-for-every-platform.json";
        assert_eq!(super::text(url), url);
        for kept in ["state=ok", "127.0.0.1:8765", "/home/[user]/x"] {
            assert!(masked.contains(kept), "{kept} missing from {masked}");
        }
    }

    #[test]
    fn masks_google_client_ids_in_file_names() {
        assert_eq!(
            super::text("client_secret_1234567-abc9def.apps.googleusercontent.com.json"),
            "client_secret_[client id].json"
        );
    }
}
