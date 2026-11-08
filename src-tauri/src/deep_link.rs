//! `wirecat://open/v1/…` links: the v1 grammar of cli-core's `src/domain/links.ts`, checked against its shared fixture
//! (`src/domain/links-v1.fixture.json`). Only `wirecat://open/v1/` within 512 characters reaches the interface; a
//! link opens a screen and never performs an action. Any program can start the app with such a link, so nothing here
//! trusts it beyond the grammar.

use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;
use tauri::ipc::Channel;

const APP_PREFIX: &str = "wirecat://open";
const VERSION: &str = "v1";
const MAX_PATH: usize = 512;
const MAX_SEGMENTS: usize = 6;

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskFilter {
    Overdue,
    Today,
    Tomorrow,
    New,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Target {
    Message {
        provider: String,
        account: String,
        chat: String,
        message: String,
    },
    Chat {
        provider: String,
        account: String,
        chat: String,
    },
    Task {
        id: String,
    },
    Tasks {
        filter: TaskFilter,
        #[serde(skip_serializing_if = "Option::is_none")]
        since: Option<String>,
    },
    Proposal {
        id: String,
    },
    Digest {
        date: String,
    },
    Sync {
        tool: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        account: Option<String>,
    },
}

/// What the interface gets for one link: where it goes, or nothing for a link it must not follow. The refused text
/// itself never reaches the webview.
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct Opened {
    pub target: Option<Target>,
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// As JavaScript's `decodeURIComponent`: a `%` must start two hex digits and the bytes must be UTF-8.
pub(crate) fn decode(part: &str) -> Option<String> {
    let bytes = part.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hi = hex(*bytes.get(i + 1)?)?;
            let lo = hex(*bytes.get(i + 2)?)?;
            out.push((hi << 4) | lo);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

fn digits(s: &str, len: usize) -> Option<u32> {
    (s.len() == len && s.bytes().all(|b| b.is_ascii_digit())).then(|| s.parse().ok()).flatten()
}

/// `2026-11-08`, with the ranges JavaScript's `Date.parse` takes: a day 1 to 31 in any month, as the TypeScript side reads it.
pub fn is_date(s: &str) -> bool {
    let mut it = s.split('-');
    let (Some(y), Some(m), Some(d), None) = (it.next(), it.next(), it.next(), it.next()) else { return false };
    digits(y, 4).is_some()
        && digits(m, 2).is_some_and(|m| (1..=12).contains(&m))
        && digits(d, 2).is_some_and(|d| (1..=31).contains(&d))
}

/// `2026-11-07T08:00[:00[.000]](Z|±hh:mm)`.
fn is_date_time(s: &str) -> bool {
    let Some((date, time)) = s.split_once('T') else { return false };
    if !is_date(date) {
        return false;
    }
    let (clock, zone) = if let Some(clock) = time.strip_suffix('Z') {
        (clock, None)
    } else if time.len() > 6 && matches!(time.as_bytes()[time.len() - 6], b'+' | b'-') {
        (&time[..time.len() - 6], Some(&time[time.len() - 5..]))
    } else {
        return false;
    };
    if let Some(zone) = zone {
        let Some((h, m)) = zone.split_once(':') else { return false };
        if !(digits(h, 2).is_some_and(|h| h <= 23) && digits(m, 2).is_some_and(|m| m <= 59)) {
            return false;
        }
    }
    let (clock, fraction) = clock.split_once('.').map_or((clock, None), |(c, f)| (c, Some(f)));
    if fraction.is_some_and(|f| f.is_empty() || !f.bytes().all(|b| b.is_ascii_digit())) {
        return false;
    }
    let parts: Vec<&str> = clock.split(':').collect();
    if fraction.is_some() && parts.len() != 3 {
        return false;
    }
    let (Some(h), Some(m)) = (parts.first().and_then(|h| digits(h, 2)), parts.get(1).and_then(|m| digits(m, 2))) else {
        return false;
    };
    let s = match parts.get(2) {
        None => Some(0),
        Some(s) => digits(s, 2),
    };
    parts.len() <= 3 && m <= 59 && s.is_some_and(|s| s <= 59) && (h <= 23 || (h == 24 && m == 0 && s == Some(0)))
}

fn target_of(parts: Vec<String>) -> Option<Target> {
    let mut it = parts.into_iter();
    let kind = it.next()?;
    let rest: Vec<String> = it.collect();
    let one = |n: usize| rest.len() == n;
    let at = |i: usize| rest[i].clone();
    Some(match kind.as_str() {
        "msg" if one(4) => Target::Message { provider: at(0), account: at(1), chat: at(2), message: at(3) },
        "chat" if one(3) => Target::Chat { provider: at(0), account: at(1), chat: at(2) },
        "task" if one(1) => Target::Task { id: at(0) },
        "tasks" if one(1) => {
            let filter = match rest[0].as_str() {
                "overdue" => TaskFilter::Overdue,
                "today" => TaskFilter::Today,
                "tomorrow" => TaskFilter::Tomorrow,
                _ => return None,
            };
            Target::Tasks { filter, since: None }
        }
        "tasks" if one(2) && rest[0] == "new" && (is_date(&rest[1]) || is_date_time(&rest[1])) => {
            Target::Tasks { filter: TaskFilter::New, since: Some(at(1)) }
        }
        "proposal" if one(1) => Target::Proposal { id: at(0) },
        "digest" if one(1) && is_date(&rest[0]) => Target::Digest { date: at(0) },
        "sync" if one(1) => Target::Sync { tool: at(0), account: None },
        "sync" if one(2) => Target::Sync { tool: at(0), account: Some(at(1)) },
        _ => return None,
    })
}

/// The target of a `wirecat://open/v1/…` link, or `None` for anything else: another scheme or host, the web form,
/// another version, an unknown kind, a part too many, too few or empty, a part that does not decode, a long path.
pub fn parse(link: &str) -> Option<Target> {
    let path = link.trim().strip_prefix(APP_PREFIX)?;
    if path.len() > MAX_PATH {
        return None;
    }
    // A later version may add extras as a query; a v1 reader ignores them rather than refusing the link.
    let rest = path.strip_prefix(&format!("/{VERSION}/"))?.split('?').next()?;
    let raw: Vec<&str> = rest.split('/').collect();
    if raw.len() + 1 > MAX_SEGMENTS || raw.iter().any(|p| p.is_empty()) {
        return None;
    }
    target_of(raw.into_iter().map(decode).collect::<Option<Vec<_>>>()?)
}

/// Links that arrive before the interface listens (a cold start from a link), and the channel once it does.
#[derive(Default)]
pub struct Links {
    pending: Mutex<Vec<Opened>>,
    listener: Mutex<Option<Channel<Opened>>>,
}

impl Links {
    fn deliver(&self, opened: Opened) {
        let listener = self.listener.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(channel) = listener.as_ref()
            && channel.send(opened.clone()).is_ok()
        {
            return;
        }
        drop(listener);
        self.pending.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(opened);
    }

    /// The interface's one listener: what came before it is sent at once, in order.
    pub fn listen(&self, channel: Channel<Opened>) {
        let waiting: Vec<Opened> =
            std::mem::take(&mut *self.pending.lock().unwrap_or_else(std::sync::PoisonError::into_inner));
        for opened in waiting {
            let _ = channel.send(opened);
        }
        *self.listener.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(channel);
    }
}

/// Brings the main window to the front, as a click on a link or a notification expects.
pub fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Hands one link to the interface; at most one per batch, the first: an OS that sends several means one click.
pub fn open<'a>(app: &tauri::AppHandle, urls: impl IntoIterator<Item = &'a str>) {
    let Some(first) = urls.into_iter().next() else { return };
    app.state::<Links>().deliver(Opened { target: parse(first) });
    show_window(app);
}

/// Opens a target the app itself chose, such as the day of a digest notification the owner clicked.
pub fn open_target(app: &tauri::AppHandle, target: Target) {
    app.state::<Links>().deliver(Opened { target: Some(target) });
    show_window(app);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../src/domain/links-v1.fixture.json")).unwrap()
    }

    #[test]
    fn reads_every_valid_link_of_the_shared_fixture() {
        let f = fixture();
        for one in f["valid"].as_array().unwrap() {
            let app = one["app"].as_str().unwrap();
            let target = parse(app).unwrap_or_else(|| panic!("refused {app}"));
            assert_eq!(serde_json::to_value(&target).unwrap(), one["target"], "{app}");
        }
        for one in f["ignored_query"].as_array().unwrap() {
            let link = format!("{APP_PREFIX}{}", one["path"].as_str().unwrap());
            assert_eq!(serde_json::to_value(parse(&link).unwrap()).unwrap(), one["target"]);
        }
    }

    #[test]
    fn refuses_every_refused_path_of_the_shared_fixture() {
        for one in fixture()["refused"].as_array().unwrap() {
            let path = one["path"].as_str().unwrap();
            assert_eq!(parse(path), None, "{}", one["why"]);
            assert_eq!(parse(&format!("{APP_PREFIX}{path}")), None, "{}", one["why"]);
        }
    }

    #[test]
    fn drops_anything_that_is_not_wirecat_open_v1() {
        for link in [
            "https://wirecat.dev/o#/v1/task/80",
            "/v1/task/80",
            "wirecat://opener/v1/task/80",
            "wirecat://open//v1/task/80",
            "WIRECAT://open/v1/task/80",
            "file:///etc/passwd",
            "",
        ] {
            assert_eq!(parse(link), None, "{link}");
        }
        assert_eq!(parse("wirecat://open/v1/task/80"), Some(Target::Task { id: "80".into() }));
    }

    #[test]
    fn reads_dates_and_times_as_javascript_does() {
        for ok in ["2026-11-07", "2026-02-30T08:00Z", "2026-11-07T08:00:00.5+03:00", "2026-11-07T24:00Z"] {
            assert!(is_date(ok) || is_date_time(ok), "{ok}");
        }
        for bad in ["2026-13-01", "2026-11-07T08:00:60Z", "2026-11-07T08:00", "2026-11-07T8:00Z", "2026-11-7"] {
            assert!(!is_date(bad) && !is_date_time(bad), "{bad}");
        }
    }

    #[test]
    fn a_part_must_decode_to_utf8() {
        assert_eq!(decode("owner%40example.com").as_deref(), Some("owner@example.com"));
        assert_eq!(decode("%E0%A4%A"), None);
        assert_eq!(decode("%FF"), None);
        assert_eq!(decode("a+b").as_deref(), Some("a+b"));
    }
}
