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
    let mut out = crate::paths::tilde_text(s);
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

/// Words that are chat titles often enough but carry no one's identity, and that a report needs to stay readable.
/// Compared after folding case; the tools' own names from the catalog and the owner's profile names are added to them.
const ORDINARY: &[&str] = &[
    "wirecat",
    "saved messages",
    "deleted account",
    "telegram notifications",
    "notifications",
    "sync",
    "error",
    "errors",
    "test",
    "tests",
    "bot",
    "bots",
    "support",
    "notes",
    "news",
    "work",
    "family",
    "friends",
    "chat",
    "chats",
    "group",
    "home",
    "general",
    "admin",
    "info",
    "help",
    "team",
    "user",
    "users",
    "name",
    "mail",
    "email",
    "number",
    "secret",
    "token",
    "hash",
    "redacted",
    "null",
    "true",
    "false",
    "none",
    "unknown",
    "default",
    "personal",
    "profile",
    "account",
    "server",
    "status",
    "доступ",
    "избранное",
    "удалённый аккаунт",
    "уведомления",
    "чат",
    "чаты",
    "работа",
    "семья",
    "друзья",
    "новости",
    "заметки",
    "поддержка",
    "тест",
    "бот",
    "группа",
    "общий",
    "дом",
    "помощь",
    "команда",
    "инфо",
    "ошибка",
];

const NAME: &str = "[name]";

/// Values the interface branches on (`"expired"`, `"invalid_json"`): a contact called "Missing" must not change them.
const CODES: &[&str] = &["kind", "state", "status", "code", "reason", "level", "severity"];

/// Names of people and chats the messenger tools keep on this computer (`names.rs`), masked as `[name]`.
///
/// The rule: a name matches only as a whole, ignoring case (Cyrillic too), and only where it stands as a word of
/// its own: a letter or digit right before or after it means it is part of another word. Where names overlap, the one
/// starting first wins, then the longest ("Anna Petrova" before "Anna"). A name is skipped when it has fewer than 3
/// characters, no letter at all, or is an ordinary word (`ORDINARY`, a tool's name, a profile name): "Mom" is still
/// masked, "Work" and "Telegram" are not, because masking them would make every report unreadable.
#[derive(Default)]
pub struct Names {
    matcher: Option<aho_corasick::AhoCorasick>,
}

impl Names {
    pub fn new(candidates: impl IntoIterator<Item = String>, keep: &[String]) -> Self {
        let tool_names = crate::catalog::catalog().tools.iter().map(|t| fold(&t.name));
        let ordinary: std::collections::HashSet<String> =
            ORDINARY.iter().map(|w| fold(w)).chain(tool_names).chain(keep.iter().map(|k| fold(k))).collect();
        let mut names: Vec<String> = candidates
            .into_iter()
            .map(|c| fold(&c.split_whitespace().collect::<Vec<_>>().join(" ")))
            .filter(|n| n.chars().count() >= 3 && n.chars().any(char::is_alphabetic) && !ordinary.contains(n))
            .collect();
        names.sort_unstable();
        names.dedup();
        // Overlapping search reports every name at every place; `text` then picks the matches itself.
        let matcher = (!names.is_empty()).then(|| aho_corasick::AhoCorasick::new(&names).ok()).flatten();
        Self { matcher }
    }

    pub fn text(&self, s: &str) -> String {
        let Some(matcher) = &self.matcher else { return s.to_string() };
        let (folded, origin) = folded_with_origin(s);
        let mut found: Vec<(usize, usize)> = matcher
            .find_overlapping_iter(&folded)
            .map(|m| (origin[m.start()], origin[m.end()]))
            .filter(|&(start, end)| stands_alone(s, start, end))
            .collect();
        found.sort_unstable_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
        let mut out = String::with_capacity(s.len());
        let mut at = 0;
        for (start, end) in found {
            if start >= at {
                out.push_str(&s[at..start]);
                out.push_str(NAME);
                at = end;
            }
        }
        out.push_str(&s[at..]);
        out
    }

    pub fn json(&self, value: &mut Value) {
        if self.matcher.is_none() {
            return;
        }
        match value {
            Value::Object(map) => map
                .iter_mut()
                .filter(|(k, v)| !(v.is_string() && CODES.contains(&k.as_str())))
                .for_each(|(_, v)| self.json(v)),
            Value::Array(items) => items.iter_mut().for_each(|v| self.json(v)),
            Value::String(s) => *s = self.text(s),
            _ => {}
        }
    }
}

/// Lower case one character for one, so a match in the folded text maps back to the original exactly. The few
/// characters whose lower case is longer ("İ") stay as they are; whitespace becomes a space, so a name broken over two
/// lines still matches.
fn fold_char(c: char) -> char {
    if c.is_whitespace() {
        return ' ';
    }
    let mut lower = c.to_lowercase();
    match (lower.next(), lower.next()) {
        (Some(l), None) => l,
        _ => c,
    }
}

fn fold(s: &str) -> String {
    s.trim().chars().map(fold_char).collect()
}

/// The folded text and, for each of its byte offsets that starts a character (and its end), the original's offset.
fn folded_with_origin(s: &str) -> (String, Vec<usize>) {
    let mut folded = String::with_capacity(s.len());
    let mut origin = Vec::with_capacity(s.len() + 1);
    for (at, c) in s.char_indices() {
        let f = fold_char(c);
        origin.extend(std::iter::repeat_n(at, f.len_utf8()));
        folded.push(f);
    }
    origin.push(s.len());
    (folded, origin)
}

fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// A name's edge that is a letter needs a non-letter beside it; an edge such as an emoji or ")" needs nothing.
fn stands_alone(s: &str, start: usize, end: usize) -> bool {
    let name = &s[start..end];
    let first = name.chars().next().is_some_and(is_word);
    let last = name.chars().next_back().is_some_and(is_word);
    let before = s[..start].chars().next_back().is_some_and(is_word);
    let after = s[end..].chars().next().is_some_and(is_word);
    !(first && before || last && after)
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
            "Authorization": "Bearer x", "api_hash": hex, "session": session,
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

    fn names(list: &[&str]) -> super::Names {
        super::Names::new(list.iter().map(|n| (*n).to_string()), &["personal".to_string()])
    }

    #[test]
    fn masks_latin_and_cyrillic_names_whole_and_ignoring_case() {
        let n = names(&["Anna Petrova", "Анна Петрова", "Book club", "Олег"]);
        assert_eq!(n.text("anna petrova wrote in BOOK CLUB"), "[name] wrote in [name]");
        assert_eq!(n.text("АННА ПЕТРОВА и олег"), "[name] и [name]");
        assert_eq!(n.text("Anna\nPetrova"), "[name]");
        assert_eq!(n.text("Annabel and Олеговна stay"), "Annabel and Олеговна stay");
    }

    #[test]
    fn prefers_the_longest_name_where_names_overlap() {
        let n = names(&["Anna", "Anna Petrova", "Petrova Team"]);
        assert_eq!(n.text("Anna Petrova Team"), "[name] Team");
        assert_eq!(n.text("Anna and Anna Petrova"), "[name] and [name]");
    }

    #[test]
    fn edges_that_are_not_letters_need_no_gap() {
        let n = names(&["Mom ❤️", "Anna (work)", "adam_k"]);
        assert_eq!(n.text("chat Mom ❤️!"), "chat [name]!");
        assert_eq!(n.text("x:Anna (work)."), "x:[name].");
        assert_eq!(n.text("@adam_k's, \"adam_k\""), "@[name]'s, \"[name]\"");
        assert_eq!(n.text("adam_kk"), "adam_kk");
    }

    #[test]
    fn skips_short_numeric_and_ordinary_names() {
        let n = names(&["Al", "Ян", "12345", "Work", "Telegram", "Семья", "personal", "Bob"]);
        assert_eq!(
            n.text("Al, Ян, 12345, work, Telegram, семья, personal, bob"),
            "Al, Ян, 12345, work, Telegram, семья, personal, [name]"
        );
    }

    #[test]
    fn masks_every_string_in_json_and_keeps_the_rest() {
        let n = names(&["Book club"]);
        let mut v = json!({
            "error": {"message": "cannot read Book club", "code": "book club"},
            "chats": ["book club"], "count": 3, "state": "Book club"
        });
        n.json(&mut v);
        assert_eq!(
            v,
            json!({
                "error": {"message": "cannot read [name]", "code": "book club"},
                "chats": ["[name]"], "count": 3, "state": "Book club"
            })
        );
        assert_eq!(super::Names::default().text("Book club"), "Book club");
    }

    #[test]
    fn ten_thousand_names_stay_quick() {
        let many: Vec<String> = (0..10_000).map(|i| format!("Пользователь{i} Иванов")).collect();
        let started = std::time::Instant::now();
        let n = super::Names::new(many, &[]);
        let text = "Пользователь9999 Иванов написал. ".repeat(500);
        let masked = n.text(&text);
        assert!(!masked.contains("Иванов"));
        assert!(started.elapsed() < std::time::Duration::from_secs(10), "{:?}", started.elapsed());
    }
}
