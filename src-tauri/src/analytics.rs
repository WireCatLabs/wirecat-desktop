//! The Analytics page's message counts: a messenger's own `stats messages show` for one profile, by day, sender or
//! chat (`stats` in the catalog). Every run reads the local store only (`--offline`, never `--sync-first`) and passes
//! `--no-record`. Without `--source` the tool counts the profile's own account, so the page sums the profiles it was
//! given and says which. Sender and chat names are the owner's own data shown on the owner's own page, an exception
//! to rule 4 like `search.rs`: they are never logged or put in a report.

use crate::cache::REFUSED;
use crate::catalog::{self, StatsSource, Tool};
use crate::{paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const STATS: &str = "stats";
// Longer than the `--timeout 60s` in the templates, so the tool's own time-limit answer comes back, not a kill.
const TIMEOUT: Duration = Duration::from_secs(90);
/// Ranked rows for senders and chats; the page shows ten and keeps the rest for its table.
const TOP: u32 = 25;
/// Days in "all": the tool keeps the oldest rows when there are more, so the limit must cover the whole history.
const ALL_DAYS: u32 = 20_000;

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum Period {
    #[serde(rename = "7d")]
    Week,
    #[serde(rename = "30d")]
    Month,
    #[serde(rename = "90d")]
    Quarter,
    #[serde(rename = "all")]
    All,
}

impl Period {
    /// The query term the tool reads; "all" has none. `previous` is the window of the same length just before it.
    fn term(self, previous: bool) -> Result<Option<String>, String> {
        let days = match self {
            Self::Week => 7,
            Self::Month => 30,
            Self::Quarter => 90,
            Self::All if previous => return Err("all time has no period before it".into()),
            Self::All => return Ok(None),
        };
        Ok(Some(if previous { format!("date:[{}d TO {days}d]", days * 2) } else { format!("date>={days}d") }))
    }

    fn days(self) -> Option<u32> {
        match self {
            Self::Week => Some(7),
            Self::Month => Some(30),
            Self::Quarter => Some(90),
            Self::All => None,
        }
    }
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum By {
    Day,
    Hour,
    Sender,
    Chat,
}

impl By {
    fn word(self) -> &'static str {
        match self {
            Self::Day => "day",
            Self::Hour => "hour",
            Self::Sender => "sender",
            Self::Chat => "chat",
        }
    }
}

/// Which messages to count: a fixed term of the tool's own query language, never the owner's words.
#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Only {
    #[default]
    All,
    Sent,
    Photo,
    Voice,
    Video,
    File,
    Link,
    Private,
    Group,
    Channel,
}

impl Only {
    fn term(self) -> Option<&'static str> {
        match self {
            Self::All => None,
            Self::Sent => Some("from:me"),
            Self::Photo => Some("has:photo"),
            Self::Voice => Some("has:voice"),
            Self::Video => Some("has:video"),
            Self::File => Some("has:file"),
            Self::Link => Some("has:link"),
            Self::Private => Some("kind:private"),
            Self::Group => Some("kind:group"),
            Self::Channel => Some("kind:channel"),
        }
    }
}

/// One count the page asks for: the period (or the one before it), how to group, and which messages.
#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
pub struct Ask {
    pub period: Period,
    pub by: By,
    #[serde(default)]
    pub only: Only,
    #[serde(default)]
    pub previous: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Row {
    /// A day (`2026-11-02`), a sender's id (`me` for the owner's own messages) or a chat's id.
    pub key: String,
    pub name: Option<String>,
    pub count: u64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Counts {
    Ready {
        total: u64,
        rows: Vec<Row>,
        /// More rows than the limit: the tool cut the list.
        more: bool,
    },
    /// The installed version has no `stats messages show`: the answer is "update it".
    Old {
        message: String,
    },
    Failed {
        message: String,
    },
}

/// An IANA zone as `Intl` names it (`Europe/Madrid`, `UTC`, `Etc/GMT+3`): never a flag, never a second word.
pub fn validate_timezone(zone: &str) -> Result<(), String> {
    let ok = (1..=64).contains(&zone.len())
        && zone.starts_with(|c: char| c.is_ascii_alphabetic())
        && zone.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '+'));
    if ok { Ok(()) } else { Err(format!("not a valid time zone: {zone}")) }
}

fn source(tool: &Tool) -> Result<&StatsSource, String> {
    tool.stats.as_ref().ok_or_else(|| "This tool keeps no messages to count.".into())
}

pub fn args(src: &StatsSource, profile: &str, ask: Ask, timezone: &str) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    validate_timezone(timezone)?;
    let limit = match (ask.by, ask.period.days()) {
        (By::Day, None) => ALL_DAYS,
        (By::Day, Some(_)) => 200,
        (By::Hour, None) => ALL_DAYS * 24,
        (By::Hour, Some(d)) => d * 2 * 24 + 48,
        (By::Sender | By::Chat, _) => TOP,
    };
    let terms: Vec<String> =
        ask.period.term(ask.previous)?.into_iter().chain(ask.only.term().map(str::to_string)).collect();
    let mut args: Vec<String> = src
        .messages
        .iter()
        .map(|a| match a.as_str() {
            "{profile}" => profile.to_string(),
            "{by}" => ask.by.word().to_string(),
            "{timezone}" => timezone.to_string(),
            "{limit}" => limit.to_string(),
            other => other.to_string(),
        })
        .collect();
    // An empty word after `--` would be read as a query of its own, so with no terms both go.
    if terms.is_empty() {
        args.retain(|a| a != "--" && a != "{query}");
    } else if let Some(q) = args.iter_mut().find(|a| *a == "{query}") {
        *q = terms.join(" ");
    }
    Ok(args)
}

pub fn messages(tool: &Tool, profile: &str, ask: Ask, timezone: &str) -> Result<Counts, String> {
    let src = source(tool)?;
    let args = args(src, profile, ask, timezone)?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    if let Some(message) = REFUSED.known(&tool.id, STATS, &bin) {
        return Ok(Counts::Old { message });
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), TIMEOUT).map_err(|e| e.to_string())?;
    let counts = read(&out);
    if let Counts::Old { message } = &counts {
        REFUSED.remember(&tool.id, STATS, &bin, message);
    }
    Ok(counts)
}

/// The answer sits under `item`; an older envelope put it first in `items`.
fn body(v: &Value) -> Option<&Value> {
    v.get("item").or_else(|| v["items"].get(0)).filter(|b| b["rows"].is_array())
}

fn read(out: &run::Output) -> Counts {
    let json = out.json();
    if out.code == Some(0)
        && let Some(v) = &json
        && let Some(b) = body(v)
    {
        let rows = b["rows"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|r| {
                Some(Row {
                    key: r["key"].as_str()?.to_string(),
                    name: r["name"].as_str().map(str::trim).filter(|n| !n.is_empty()).map(str::to_string),
                    count: r["count"].as_u64()?,
                })
            })
            .collect::<Vec<_>>();
        let total = b["total"].as_u64().unwrap_or_else(|| rows.iter().map(|r| r.count).sum());
        let more = v["meta"]["truncated"].as_bool().unwrap_or(false);
        return Counts::Ready { total, rows, more };
    }
    let message = json
        .as_ref()
        .and_then(|v| v["error"]["message"].as_str())
        .map_or_else(|| last_line(&out.stderr, &out.stdout), str::to_string);
    if too_old(&message) { Counts::Old { message } } else { Counts::Failed { message } }
}

fn last_line(stderr: &str, stdout: &str) -> String {
    let text = if stderr.trim().is_empty() { stdout } else { stderr };
    text.lines().rev().map(str::trim).find(|l| !l.is_empty()).unwrap_or("the tool gave no answer").to_string()
}

fn too_old(message: &str) -> bool {
    message.starts_with("unknown command")
        || message.starts_with("unknown option")
        || message.starts_with("too many arguments")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn src(id: &str) -> &'static StatsSource {
        catalog::tool(id).unwrap().stats.as_ref().unwrap()
    }

    fn output(code: i32, stdout: &str, stderr: &str) -> run::Output {
        run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn only_the_messengers_count_and_only_from_the_local_store() {
        for t in &catalog::catalog().tools {
            let Some(s) = &t.stats else {
                assert!(!matches!(t.id.as_str(), "tg" | "max" | "wa"), "{} has no stats", t.id);
                continue;
            };
            for must in ["--offline", "--no-record", "--json"] {
                assert!(s.messages.iter().any(|a| a == must), "{}: {must}", t.id);
            }
            assert!(!s.messages.iter().any(|a| a == "--sync-first" || a == "--record"), "{}", t.id);
            assert_eq!(s.messages.last().map(String::as_str), Some("{query}"), "{}: the query goes last", t.id);
        }
    }

    const fn ask(period: Period, by: By) -> Ask {
        Ask { period, by, only: Only::All, previous: false }
    }

    #[test]
    fn a_period_is_a_fixed_term_after_the_separator() {
        let a = args(src("tg"), "personal", ask(Period::Month, By::Day), "Europe/Madrid").unwrap();
        assert_eq!(&a[..4], ["personal", "stats", "messages", "show"]);
        assert_eq!(&a[a.len() - 2..], ["--", "date>=30d"]);
        assert!(a.windows(2).any(|w| w == ["--by", "day"]));
        assert!(a.windows(2).any(|w| w == ["--timezone", "Europe/Madrid"]));
    }

    #[test]
    fn a_kind_of_message_and_the_period_before_are_fixed_terms_too() {
        let a = args(
            src("tg"),
            "personal",
            Ask { period: Period::Week, by: By::Sender, only: Only::Photo, previous: true },
            "UTC",
        )
        .unwrap();
        assert_eq!(a.last().map(String::as_str), Some("date:[14d TO 7d] has:photo"));
        let sent = args(src("tg"), "p", Ask { only: Only::Sent, ..ask(Period::All, By::Day) }, "UTC").unwrap();
        assert_eq!(&sent[sent.len() - 2..], ["--", "from:me"]);
        assert!(args(src("tg"), "p", Ask { previous: true, ..ask(Period::All, By::Day) }, "UTC").is_err());
    }

    #[test]
    fn all_time_drops_the_query_and_keeps_every_day() {
        let a = args(src("wa"), "personal", ask(Period::All, By::Day), "UTC").unwrap();
        assert!(!a.iter().any(|w| w == "--" || w == "{query}"));
        assert!(a.windows(2).any(|w| w == ["--limit", &ALL_DAYS.to_string()]));
        let top = args(src("max"), "work", ask(Period::All, By::Sender), "UTC").unwrap();
        assert!(top.windows(2).any(|w| w == ["--limit", &TOP.to_string()]));
    }

    #[test]
    fn refuses_a_profile_or_zone_that_could_be_a_flag() {
        assert!(args(src("tg"), "--all", ask(Period::Week, By::Day), "UTC").is_err());
        assert!(args(src("tg"), "personal", ask(Period::Week, By::Day), "--json").is_err());
        assert!(args(src("tg"), "personal", ask(Period::Week, By::Day), "Europe/Madrid now").is_err());
        assert!(validate_timezone("America/Argentina/Buenos_Aires").is_ok());
        assert!(validate_timezone("Etc/GMT+3").is_ok());
    }

    #[test]
    fn periods_and_groupings_read_as_the_interface_sends_them() {
        assert_eq!(serde_json::from_value::<Period>(json!("90d")).unwrap(), Period::Quarter);
        assert_eq!(serde_json::from_value::<By>(json!("sender")).unwrap(), By::Sender);
        let a: Ask = serde_json::from_value(json!({"period":"7d","by":"hour"})).unwrap();
        assert_eq!(a, ask(Period::Week, By::Hour));
        assert!(serde_json::from_value::<Only>(json!("has:photo")).is_err());
        assert!(serde_json::from_value::<Period>(json!("365d")).is_err());
    }

    #[test]
    fn reads_rows_under_item_with_the_owner_as_me() {
        let body = json!({"item":{"by":"sender","total":12,"rows":[
            {"key":"me","name":null,"count":7},
            {"key":"42","ref":"person:telegram/42","name":" Ana ","count":5}
        ]},"meta":{"run_id":"r","duration_ms":3,"complete":true,"truncated":true}});
        let c = read(&output(0, &body.to_string(), ""));
        assert_eq!(
            c,
            Counts::Ready {
                total: 12,
                more: true,
                rows: vec![
                    Row { key: "me".into(), name: None, count: 7 },
                    Row { key: "42".into(), name: Some("Ana".into()), count: 5 },
                ],
            }
        );
    }

    #[test]
    fn an_unknown_command_means_the_tool_is_too_old() {
        let c = read(&output(1, "", "unknown command 'stats'\n"));
        assert!(matches!(c, Counts::Old { .. }));
        let err = json!({"error":{"code":"validation_error","message":"the store is locked"}});
        assert_eq!(read(&output(1, "", &err.to_string())), Counts::Failed { message: "the store is locked".into() });
    }

    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        let c =
            Counts::Ready { total: 1, rows: vec![Row { key: "2026-11-01".into(), name: None, count: 1 }], more: false };
        assert_eq!(
            serde_json::to_value(c).unwrap(),
            json!({"kind":"ready","total":1,"more":false,"rows":[{"key":"2026-11-01","name":null,"count":1}]})
        );
    }
}
