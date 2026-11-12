//! The Analytics page's message counts: a messenger's own `stats messages show` for one profile, by day, sender or
//! chat (`stats` in the catalog). Every run reads the local store only (`--offline`, never `--sync-first`) and passes
//! `--no-record`. Without `--source` the tool counts the profile's own account, so the page sums the profiles it was
//! given and says which. Sender and chat names are the owner's own data shown on the owner's own page, an exception
//! to rule 4 like `search.rs`: they are never logged or put in a report.

use crate::cache::REFUSED;
use crate::catalog::{self, AggregateSource, StatsSource, Tool};
use crate::run;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const STATS: &str = "stats";
/// The owner's ruling (NEED-2511): messages in chats he muted count nowhere on the page.
const UNMUTED: &str = "muted:false";
/// The key under which a copy too old for `muted:` is remembered, so its counts skip the term until it is updated.
const MUTED_FIELD: &str = "muted:";
/// Reply times and waiting chats learned `muted:` apart from search, so a copy is remembered for each on its own.
const MUTED_REPLIES: &str = "muted: replies";
/// The key under which a copy too old for `participants_count` is remembered, so it counts private chats alone.
const SIZE_FIELD: &str = "participants_count:";
// Longer than the `--timeout 60s` in the templates, so the tool's own time-limit answer comes back, not a kill.
const TIMEOUT: Duration = Duration::from_secs(90);
/// Ranked rows for senders and chats; the page shows ten and keeps the rest for its table.
const TOP: u32 = 25;
/// The most rows the tool answers in one run: a larger `--limit` is refused as `query.invalid-limit`.
const MAX_ROWS: u32 = 1000;
/// Days per run when counting by hour or by day: 41 calendar days of hours, or 991 days, still fit in `MAX_ROWS`.
const HOUR_SPAN: u32 = 40;
const DAY_SPAN: u32 = 990;
/// All time by hour reads the last year only: a decade of hourly rows would take ninety runs for one heat map.
pub const ALL_HOURS_DAYS: u32 = 360;
/// All time by day stops at the first empty stretch, or after this many (about 32 years).
const DAY_STRETCHES: u32 = 12;

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
    /// The days back the period covers, as `(oldest, newest)`; `previous` is the same length just before it.
    fn span(self, previous: bool) -> Result<Option<(u32, u32)>, String> {
        match (self.days(), previous) {
            (None, true) => Err("all time has no period before it".into()),
            (None, false) => Ok(None),
            (Some(d), true) => Ok(Some((d * 2, d))),
            (Some(d), false) => Ok(Some((d, 0))),
        }
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
    /// Personal conversations: private chats and groups under ten people, the owner's ruling for these counts.
    Close,
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
            Self::Close => Some("(kind:private OR (kind:group participants_count<10))"),
        }
    }
}

/// One count the page asks for: the period (or the one before it), how to group, and which messages.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
pub struct Ask {
    pub period: Period,
    pub by: By,
    #[serde(default)]
    pub only: Only,
    #[serde(default)]
    pub previous: bool,
    /// Calendar days in the zone, in place of the period: the same weekdays of last week.
    #[serde(default)]
    pub range: Option<Range>,
    /// Every sender or chat the tool holds, up to `MAX_ROWS`, not the page's top rows.
    #[serde(default)]
    pub full: bool,
}

/// `from` to `to`, both `YYYY-MM-DD` and both included; no `to` is up to now.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
pub struct Range {
    pub from: String,
    pub to: Option<String>,
}

fn validate_day(day: &str) -> Result<(), String> {
    let b = day.as_bytes();
    let ok = b.len() == 10
        && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() });
    if ok { Ok(()) } else { Err(format!("not a day: {day}")) }
}

impl Range {
    fn term(&self) -> Result<String, String> {
        self.term_on("date")
    }

    fn term_on(&self, field: &str) -> Result<String, String> {
        validate_day(&self.from)?;
        match &self.to {
            Some(to) => {
                validate_day(to)?;
                Ok(format!("{field}:[{} TO {to}]", self.from))
            }
            None => Ok(format!("{field}>={}", self.from)),
        }
    }
}

/// One run's stretch: the period term (none for all time) and the rows to ask for.
#[derive(Debug, PartialEq, Eq)]
struct Stretch {
    term: Option<String>,
    limit: u32,
}

/// A day or hour count longer than `MAX_ROWS` rows is read in stretches, newest first, and added up.
fn stretches(ask: &Ask) -> Result<Vec<Stretch>, String> {
    let ranked = if ask.full { MAX_ROWS } else { TOP };
    if let Some(range) = &ask.range {
        let limit = match ask.by {
            By::Sender | By::Chat => ranked,
            By::Day | By::Hour => MAX_ROWS,
        };
        return Ok(vec![Stretch { term: Some(range.term()?), limit }]);
    }
    let span = ask.period.span(ask.previous)?;
    let (per, size) = match ask.by {
        By::Sender | By::Chat => {
            return Ok(vec![Stretch { term: span.map(|(old, new)| window(old, new)), limit: ranked }]);
        }
        By::Hour => (HOUR_SPAN, 24),
        By::Day => (DAY_SPAN, 1),
    };
    let (oldest, newest) = match (span, ask.by) {
        (Some(s), _) => s,
        (None, By::Hour) => (ALL_HOURS_DAYS, 0),
        // All time by day: open-ended, read until a stretch comes back empty.
        (None, _) => (per * DAY_STRETCHES, 0),
    };
    let mut out = Vec::new();
    let mut new = newest;
    while new < oldest {
        let old = (new + per).min(oldest);
        out.push(Stretch { term: Some(window(old, new)), limit: ((old - new + 1) * size).min(MAX_ROWS) });
        new = old;
    }
    Ok(out)
}

/// `date>=30d` for the newest stretch, `date:[60d TO 30d}` for the ones before: no message counted twice.
fn window(old: u32, new: u32) -> String {
    if new == 0 { format!("date>={old}d") } else { format!("date:[{old}d TO {new}d}}") }
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
        /// Asked for `Close` of a copy that cannot tell a group's size, so only private chats are counted.
        #[serde(rename = "privateOnly", skip_serializing_if = "std::ops::Not::not")]
        private_only: bool,
    },
    /// The installed version has no `stats messages show`: the answer is "update it".
    Old { message: String },
    Failed {
        message: String,
        /// The tool's error code, such as `not_found` for a profile that holds nothing yet.
        code: Option<String>,
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

fn args_for(
    src: &StatsSource,
    profile: &str,
    ask: &Ask,
    timezone: &str,
    part: &Stretch,
    unmuted: bool,
) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    validate_timezone(timezone)?;
    let terms: Vec<String> = part
        .term
        .clone()
        .into_iter()
        .chain(ask.only.term().map(str::to_string))
        .chain(unmuted.then(|| UNMUTED.to_string()))
        .collect();
    let mut args: Vec<String> = src
        .messages
        .iter()
        .map(|a| match a.as_str() {
            "{profile}" => profile.to_string(),
            "{by}" => ask.by.word().to_string(),
            "{timezone}" => timezone.to_string(),
            "{limit}" => part.limit.to_string(),
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

/// Every run one count takes, in order: one, or one per stretch of a long day or hour count.
pub fn args(
    src: &StatsSource,
    profile: &str,
    ask: &Ask,
    timezone: &str,
    unmuted: bool,
) -> Result<Vec<Vec<String>>, String> {
    stretches(ask)?.iter().map(|part| args_for(src, profile, ask, timezone, part, unmuted)).collect()
}

/// The tool's copy predates `muted:` (search refuses the field; reply times refuse any field past date, chat and kind):
/// the count is read again without it, and that copy is not asked with it again.
fn unknown_muted(message: &str) -> bool {
    (message.contains("query.unknown-field") && message.contains("muted"))
        || message.contains("reads date:, chat: and kind: terms")
}

pub fn messages(tool: &Tool, profile: &str, ask: Ask, timezone: &str) -> Result<Counts, String> {
    let src = source(tool)?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    if let Some(message) = REFUSED.known(&tool.id, STATS, &bin) {
        return Ok(Counts::Old { message });
    }
    let private = Ask { only: Only::Private, ..ask.clone() };
    if ask.only == Only::Close && REFUSED.known(&tool.id, SIZE_FIELD, &bin).is_some() {
        return Ok(private_only(unmuted_count(tool, &bin, src, profile, &private, timezone)?));
    }
    let counts = unmuted_count(tool, &bin, src, profile, &ask, timezone)?;
    if let Counts::Failed { message, .. } = &counts
        && ask.only == Only::Close
        && unknown_size(message)
    {
        REFUSED.remember(&tool.id, SIZE_FIELD, &bin, message);
        return Ok(private_only(unmuted_count(tool, &bin, src, profile, &private, timezone)?));
    }
    Ok(counts)
}

fn unknown_size(message: &str) -> bool {
    message.contains("query.unknown-field") && message.contains("participants_count")
}

fn private_only(counts: Counts) -> Counts {
    match counts {
        Counts::Ready { total, rows, more, .. } => Counts::Ready { total, rows, more, private_only: true },
        other => other,
    }
}

fn unmuted_count(
    tool: &Tool,
    bin: &std::path::Path,
    src: &StatsSource,
    profile: &str,
    ask: &Ask,
    timezone: &str,
) -> Result<Counts, String> {
    let unmuted = REFUSED.known(&tool.id, MUTED_FIELD, bin).is_none();
    let counts = count(tool, bin, &args(src, profile, ask, timezone, unmuted)?, ask)?;
    if let Counts::Failed { message, .. } = &counts
        && unmuted
        && unknown_muted(message)
    {
        REFUSED.remember(&tool.id, MUTED_FIELD, bin, message);
        return count(tool, bin, &args(src, profile, ask, timezone, false)?, ask);
    }
    Ok(counts)
}

fn count(tool: &Tool, bin: &std::path::Path, runs: &[Vec<String>], ask: &Ask) -> Result<Counts, String> {
    let open_ended = ask.range.is_none() && ask.period == Period::All && ask.by == By::Day;
    let mut sum = Sum::default();
    for (n, args) in runs.iter().enumerate() {
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        let out = crate::memo_server::run_tool(tool, bin, &refs, TIMEOUT).map_err(|e| e.to_string())?;
        let counts = read(&out);
        match counts {
            Counts::Ready { total, rows, more, .. } => {
                if open_ended && n > 0 && total == 0 {
                    break;
                }
                sum.add(total, rows, more);
            }
            Counts::Old { message } => {
                REFUSED.remember(&tool.id, STATS, bin, &message);
                return Ok(Counts::Old { message });
            }
            failed @ Counts::Failed { .. } => return Ok(failed),
        }
    }
    Ok(sum.done())
}

/// Stretches added up: a day or hour cut by a stretch's edge appears in both, so equal keys add.
#[derive(Default)]
struct Sum {
    total: u64,
    rows: Vec<Row>,
    more: bool,
}

impl Sum {
    fn add(&mut self, total: u64, rows: Vec<Row>, more: bool) {
        self.total += total;
        self.more |= more;
        for r in rows {
            match self.rows.iter_mut().find(|x| x.key == r.key) {
                Some(x) => x.count += r.count,
                None => self.rows.push(r),
            }
        }
    }

    fn done(mut self) -> Counts {
        self.rows.sort_by(|a, b| a.key.cmp(&b.key));
        Counts::Ready { total: self.total, rows: self.rows, more: self.more, private_only: false }
    }
}

/// An aggregate the page reads as the tool printed it: counts, times and, for a series or a chat, its name.
#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Aggregate {
    Ready {
        body: Value,
    },
    Old {
        message: String,
    },
    Failed {
        message: String,
        /// The tool's error code, such as `not_found` for a profile that holds nothing yet.
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
}

const AGGREGATES: [&str; 10] = [
    "responses",
    "waiting",
    "coverage",
    "meetings",
    "meetingsWeek",
    "meetingsSeries",
    "mail",
    "taskSources",
    "taskMeetings",
    "projectActivity",
];
/// The counts made of a messenger's messages, which leave muted chats out like every other count on the page.
const COUNTS_MESSAGES: [&str; 2] = ["responses", "waiting"];
/// Rows to ask for when the period is all time: a day or week row per bar, years of them.
const ALL_ROWS: u32 = 5000;

pub fn aggregate_args(
    src: &AggregateSource,
    profile: Option<&str>,
    period: Period,
    range: Option<&Range>,
    timezone: &str,
    unmuted: bool,
) -> Result<Vec<String>, String> {
    validate_timezone(timezone)?;
    let wants_profile = src.args.iter().any(|a| a == "{profile}");
    match (wants_profile, profile) {
        (true, Some(p)) => catalog::validate_profile(p)?,
        (true, None) => return Err("this count needs a profile".into()),
        (false, Some(_)) => return Err("this tool has no profiles".into()),
        (false, None) => {}
    }
    let days = period.days();
    let since = match (&src.date, range, days) {
        (Some(field), Some(range), _) => Some(range.term_on(field)?),
        (Some(field), None, Some(days)) => Some(format!("{field}>={days}d")),
        _ => None,
    };
    let terms: Vec<String> = since.into_iter().chain(unmuted.then(|| UNMUTED.to_string())).collect();
    let term = (!terms.is_empty()).then(|| terms.join(" "));
    let limit = days.map_or(ALL_ROWS, |d| (d + 7).max(50));
    let mut args: Vec<String> = Vec::with_capacity(src.args.len());
    for a in &src.args {
        match a.as_str() {
            "{profile}" => args.push(profile.unwrap_or_default().to_string()),
            "{timezone}" => args.push(timezone.to_string()),
            "{limit}" => args.push(limit.to_string()),
            // All time has no start: the option goes with its value.
            "{since}" => match days {
                Some(d) => args.push(format!("{d}d")),
                None => {
                    args.pop();
                }
            },
            // For a command whose own default is a window, so all time must be said.
            "{sinceOrAll}" => args.push(days.map_or_else(|| "all".to_string(), |d| format!("{d}d"))),
            other => args.push(other.to_string()),
        }
    }
    match term {
        Some(t) => {
            if let Some(q) = args.iter_mut().find(|a| *a == "{query}") {
                *q = t;
            }
        }
        None => args.retain(|a| a != "--" && a != "{query}"),
    }
    Ok(args)
}

pub fn aggregate(
    tool: &Tool,
    which: &str,
    profile: Option<&str>,
    period: Period,
    range: Option<&Range>,
    timezone: &str,
) -> Result<Aggregate, String> {
    let name = AGGREGATES.iter().find(|n| **n == which).ok_or("not a known count")?;
    let src = tool.aggregates.get(*name).ok_or("this tool has no such count")?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    if let Some(min) = &src.min_version
        && crate::tools::older(crate::tools::version_of(&bin).as_deref(), min)
    {
        return Ok(Aggregate::Old { message: format!("needs {} {min} or newer", tool.bin) });
    }
    let unmuted = COUNTS_MESSAGES.contains(name) && REFUSED.known(&tool.id, MUTED_REPLIES, &bin).is_none();
    let answer = run_aggregate(tool, &bin, &aggregate_args(src, profile, period, range, timezone, unmuted)?)?;
    if let Aggregate::Failed { message, .. } = &answer
        && unmuted
        && unknown_muted(message)
    {
        REFUSED.remember(&tool.id, MUTED_REPLIES, &bin, message);
        return run_aggregate(tool, &bin, &aggregate_args(src, profile, period, range, timezone, false)?);
    }
    Ok(answer)
}

fn run_aggregate(tool: &Tool, bin: &std::path::Path, args: &[String]) -> Result<Aggregate, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = crate::memo_server::run_tool(tool, bin, &refs, TIMEOUT).map_err(|e| e.to_string())?;
    let json = out.json();
    if out.code == Some(0)
        && let Some(v) = json.as_ref().filter(|v| v.get("error").is_none())
    {
        let body = v.get("item").cloned().unwrap_or_else(|| v.clone());
        return Ok(Aggregate::Ready { body });
    }
    let message = json
        .as_ref()
        .and_then(|v| v["error"]["message"].as_str())
        .map_or_else(|| last_line(&out.stderr, &out.stdout), str::to_string);
    let code = json.as_ref().and_then(|v| v["error"]["code"].as_str()).map(str::to_string);
    Ok(if crate::memo_cli::unknown_to_cli(&message) {
        Aggregate::Old { message }
    } else {
        Aggregate::Failed { message, code }
    })
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
        return Counts::Ready { total, rows, more, private_only: false };
    }
    let message = json
        .as_ref()
        .and_then(|v| v["error"]["message"].as_str())
        .map_or_else(|| last_line(&out.stderr, &out.stdout), str::to_string);
    let code = json.as_ref().and_then(|v| v["error"]["code"].as_str()).map(str::to_string);
    if crate::memo_cli::unknown_to_cli(&message) { Counts::Old { message } } else { Counts::Failed { message, code } }
}

fn last_line(stderr: &str, stdout: &str) -> String {
    let text = if stderr.trim().is_empty() { stdout } else { stderr };
    text.lines().rev().map(str::trim).find(|l| !l.is_empty()).unwrap_or("the tool gave no answer").to_string()
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
        Ask { period, by, only: Only::All, previous: false, range: None, full: false }
    }

    /// The one run a count takes; a count read in stretches fails here.
    fn one(ask: Ask) -> Vec<String> {
        let mut runs = args(src("tg"), "personal", &ask, "Europe/Madrid", false).unwrap();
        assert_eq!(runs.len(), 1, "{ask:?}");
        runs.remove(0)
    }

    fn limit(a: &[String]) -> u32 {
        a.windows(2).find(|w| w[0] == "--limit").map(|w| w[1].parse().unwrap()).unwrap()
    }

    #[test]
    fn a_period_is_a_fixed_term_after_the_separator() {
        let a = one(ask(Period::Month, By::Day));
        assert_eq!(&a[..4], ["personal", "stats", "messages", "show"]);
        assert_eq!(&a[a.len() - 2..], ["--", "date>=30d"]);
        assert!(a.windows(2).any(|w| w == ["--by", "day"]));
        assert!(a.windows(2).any(|w| w == ["--timezone", "Europe/Madrid"]));
    }

    #[test]
    fn muted_chats_are_left_out_of_every_count_that_reads_messages() {
        let runs =
            args(src("tg"), "p", &Ask { only: Only::Sent, ..ask(Period::Quarter, By::Hour) }, "UTC", true).unwrap();
        assert!(runs.len() > 1);
        assert!(runs.iter().all(|a| a.last().unwrap().ends_with(" from:me muted:false")), "{runs:?}");
        let tg = catalog::tool("tg").unwrap();
        let r = aggregate_args(&tg.aggregates["responses"], Some("p"), Period::Week, None, "UTC", true).unwrap();
        assert_eq!(&r[r.len() - 2..], ["--", "date>=7d muted:false"]);
        let ever = aggregate_args(&tg.aggregates["responses"], Some("p"), Period::All, None, "UTC", true).unwrap();
        assert_eq!(&ever[ever.len() - 2..], ["--", "muted:false"]);
        let waiting = aggregate_args(&tg.aggregates["waiting"], Some("p"), Period::Week, None, "UTC", true).unwrap();
        assert_eq!(&waiting[waiting.len() - 2..], ["--", "muted:false"]);
        let plain = aggregate_args(&tg.aggregates["waiting"], Some("p"), Period::Week, None, "UTC", false).unwrap();
        assert!(!plain.iter().any(|a| a == "--" || a.starts_with('{')), "{plain:?}");
        assert!(COUNTS_MESSAGES.iter().all(|n| AGGREGATES.contains(n)));
    }

    #[test]
    fn close_chats_are_one_parenthesised_term_and_a_copy_without_the_size_field_is_told_apart() {
        let a = one(Ask { only: Only::Close, ..ask(Period::Month, By::Sender) });
        assert_eq!(a.last().unwrap(), "date>=30d (kind:private OR (kind:group participants_count<10))");
        assert!(unknown_size("search: query.unknown-field at position 39 — no field \"participants_count\""));
        assert!(!unknown_size("search: query.unknown-field at position 1 — no field \"muted\""));
    }

    #[test]
    fn a_task_count_takes_calendar_days_on_its_own_date_field() {
        let memo = catalog::tool("memo").unwrap();
        let range = Range { from: "2026-11-09".into(), to: Some("2026-11-11".into()) };
        let a =
            aggregate_args(&memo.aggregates["taskSources"], None, Period::Month, Some(&range), "UTC", false).unwrap();
        assert_eq!(&a[a.len() - 2..], ["--", "created:[2026-11-09 TO 2026-11-11]"]);
        let bad = Range { from: "next week".into(), to: None };
        assert!(
            aggregate_args(&memo.aggregates["taskSources"], None, Period::Month, Some(&bad), "UTC", false).is_err()
        );
    }

    #[test]
    fn a_copy_without_the_muted_field_is_told_apart_from_other_failures() {
        assert!(unknown_muted("search: query.unknown-field at position 1 — no field \"muted\""));
        assert!(!unknown_muted("search: query.unknown-field at position 1 — no field \"mood\""));
        assert!(!unknown_muted("search: query.invalid-limit — use 1–1000 results"));
        assert!(unknown_muted("stats messages responses reads date:, chat: and kind: terms, AND-ed — not words"));
    }

    #[test]
    fn a_kind_of_message_and_the_period_before_are_fixed_terms_too() {
        let a = one(Ask { only: Only::Photo, previous: true, ..ask(Period::Week, By::Sender) });
        assert_eq!(a.last().map(String::as_str), Some("date:[14d TO 7d} has:photo"));
        let sent = one(Ask { only: Only::Sent, ..ask(Period::Month, By::Chat) });
        assert_eq!(&sent[sent.len() - 2..], ["--", "date>=30d from:me"]);
        assert!(args(src("tg"), "p", &Ask { previous: true, ..ask(Period::All, By::Day) }, "UTC", false).is_err());
    }

    #[test]
    fn no_run_asks_for_more_rows_than_the_tool_answers() {
        for period in [Period::Week, Period::Month, Period::Quarter, Period::All] {
            for by in [By::Day, By::Hour, By::Sender, By::Chat] {
                for full in [false, true] {
                    for a in args(src("tg"), "p", &Ask { full, ..ask(period, by) }, "UTC", false).unwrap() {
                        assert!(limit(&a) <= MAX_ROWS, "{period:?} {by:?}: {}", limit(&a));
                    }
                }
            }
        }
        // 30 days by hour fit in one run: BUG-694 asked for 1488 and got "no messages".
        assert_eq!(limit(&one(ask(Period::Month, By::Hour))), 744);
    }

    #[test]
    fn a_long_hourly_count_reads_back_to_back_stretches() {
        let runs = args(src("tg"), "p", &ask(Period::Quarter, By::Hour), "UTC", false).unwrap();
        let terms: Vec<&str> = runs.iter().map(|a| a.last().unwrap().as_str()).collect();
        assert_eq!(terms, ["date>=40d", "date:[80d TO 40d}", "date:[90d TO 80d}"]);
        let year = args(src("tg"), "p", &ask(Period::All, By::Hour), "UTC", false).unwrap();
        assert_eq!(year.last().unwrap().last().unwrap(), &format!("date:[{ALL_HOURS_DAYS}d TO 320d}}"));
        let days = args(src("wa"), "p", &ask(Period::All, By::Day), "UTC", false).unwrap();
        assert_eq!(u32::try_from(days.len()).unwrap(), DAY_STRETCHES);
        assert_eq!(days[1].last().unwrap(), "date:[1980d TO 990d}");
        let top = one(ask(Period::All, By::Sender));
        assert!(!top.iter().any(|w| w == "--" || w == "{query}"));
        assert_eq!(limit(&top), TOP);
        assert_eq!(limit(&one(Ask { full: true, ..ask(Period::Month, By::Chat) })), MAX_ROWS);
    }

    #[test]
    fn a_range_of_days_takes_the_place_of_the_period() {
        let r = |from: &str, to: Option<&str>| Range { from: from.into(), to: to.map(str::to_string) };
        let a =
            one(Ask { range: Some(r("2026-11-02", Some("2026-11-03"))), full: true, ..ask(Period::Month, By::Chat) });
        assert_eq!(a.last().unwrap(), "date:[2026-11-02 TO 2026-11-03]");
        assert_eq!(limit(&a), MAX_ROWS);
        assert_eq!(
            one(Ask { range: Some(r("2026-11-04", None)), ..ask(Period::Month, By::Chat) }).last().unwrap(),
            "date>=2026-11-04"
        );
        for bad in ["2026-11-4", "today", "2026-11-02 OR x", "--json"] {
            assert!(
                args(src("tg"), "p", &Ask { range: Some(r(bad, None)), ..ask(Period::Week, By::Chat) }, "UTC", false)
                    .is_err()
            );
        }
    }

    #[test]
    fn stretches_add_up_and_a_day_cut_in_two_counts_once_in_full() {
        let mut sum = Sum::default();
        let row = |k: &str, n| Row { key: k.into(), name: None, count: n };
        sum.add(3, vec![row("2026-10-02", 1), row("2026-10-03", 2)], false);
        sum.add(4, vec![row("2026-09-01", 3), row("2026-10-02", 1)], true);
        assert_eq!(
            sum.done(),
            Counts::Ready {
                total: 7,
                more: true,
                rows: vec![row("2026-09-01", 3), row("2026-10-02", 2), row("2026-10-03", 2)],
                private_only: false,
            }
        );
    }

    #[test]
    fn refuses_a_profile_or_zone_that_could_be_a_flag() {
        assert!(args(src("tg"), "--all", &ask(Period::Week, By::Day), "UTC", false).is_err());
        assert!(args(src("tg"), "personal", &ask(Period::Week, By::Day), "--json", false).is_err());
        assert!(args(src("tg"), "personal", &ask(Period::Week, By::Day), "Europe/Madrid now", false).is_err());
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
                private_only: false,
            }
        );
    }

    #[test]
    fn an_unknown_command_means_the_tool_is_too_old() {
        let c = read(&output(1, "", "unknown command 'stats'\n"));
        assert!(matches!(c, Counts::Old { .. }));
        let err = json!({"error":{"code":"validation_error","message":"the store is locked"}});
        assert_eq!(
            read(&output(1, "", &err.to_string())),
            Counts::Failed { message: "the store is locked".into(), code: Some("validation_error".into()) }
        );
    }

    #[test]
    fn aggregates_read_the_local_store_and_put_the_period_on_their_own_field() {
        for t in &catalog::catalog().tools {
            for (name, a) in &t.aggregates {
                assert!(AGGREGATES.contains(&name.as_str()), "{}: {name}", t.id);
                assert!(a.args.iter().any(|w| w == "--no-record"), "{}: {name}", t.id);
                assert!(!a.args.iter().any(|w| w == "--sync-first" || w == "--record"), "{}: {name}", t.id);
            }
        }
        let zm = catalog::tool("zm").unwrap();
        let a = aggregate_args(&zm.aggregates["meetings"], Some("personal"), Period::Week, None, "UTC", false).unwrap();
        assert_eq!(&a[a.len() - 2..], ["--", "started_at>=7d"]);
        let week =
            aggregate_args(&zm.aggregates["meetingsWeek"], Some("p"), Period::Month, None, "Europe/Madrid", false)
                .unwrap();
        assert!(week.windows(2).any(|w| w == ["--since-time", "30d"]));
        assert!(week.windows(2).any(|w| w == ["--timezone", "Europe/Madrid"]));
        let ever =
            aggregate_args(&zm.aggregates["meetingsSeries"], Some("p"), Period::All, None, "UTC", false).unwrap();
        assert!(!ever.iter().any(|w| w == "--since-time" || w.starts_with('{')));
        assert!(ever.windows(2).any(|w| w == ["--limit", &ALL_ROWS.to_string()]));
        let memo = catalog::tool("memo").unwrap();
        let t = aggregate_args(&memo.aggregates["taskSources"], None, Period::Month, None, "UTC", false).unwrap();
        assert_eq!(&t[t.len() - 2..], ["--", "created>=30d"]);
        let week = aggregate_args(&memo.aggregates["projectActivity"], None, Period::Week, None, "UTC", false).unwrap();
        assert!(week.windows(2).any(|w| w == ["--since-time", "7d"]));
        let all = aggregate_args(&memo.aggregates["projectActivity"], None, Period::All, None, "UTC", false).unwrap();
        assert!(all.windows(2).any(|w| w == ["--since-time", "all"]));
        let mail = catalog::tool("email").unwrap();
        assert!(aggregate_args(&mail.aggregates["mail"], None, Period::Week, None, "UTC", false).is_err());
        let m = aggregate_args(&mail.aggregates["mail"], Some("ya"), Period::Week, None, "UTC", false).unwrap();
        assert_eq!(&m[..4], ["ya", "stats", "messages", "show"]);
        assert!(m.windows(2).any(|w| w == ["--limit", "50"]));
        let tg = catalog::tool("tg").unwrap();
        let c = aggregate_args(&tg.aggregates["coverage"], Some("personal"), Period::All, None, "UTC", false).unwrap();
        assert_eq!(&c[..4], ["personal", "store", "chats", "status"]);
    }

    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        let c = Counts::Ready {
            total: 1,
            rows: vec![Row { key: "2026-11-01".into(), name: None, count: 1 }],
            more: false,
            private_only: false,
        };
        assert_eq!(
            serde_json::to_value(c).unwrap(),
            json!({"kind":"ready","total":1,"more":false,"rows":[{"key":"2026-11-01","name":null,"count":1}]})
        );
    }

    /// Times reply time and waiting on you against the owner's own store, through the page's own path. Read only:
    /// `--offline --no-record`, counts only.
    /// `WIRECAT_PROBES=tg:personal cargo test real_reply_counts_timing -- --ignored --nocapture`.
    #[test]
    #[ignore = "reads the owner's real store"]
    fn real_reply_counts_timing() {
        for (id, profile) in crate::probe::accounts() {
            let (tool, Some(profile)) = (catalog::tool(&id).unwrap(), profile) else { continue };
            for which in ["responses", "waiting", "coverage"] {
                for period in [Period::Month, Period::All] {
                    let started = std::time::Instant::now();
                    let answer = aggregate(tool, which, Some(&profile), period, None, "Europe/Madrid");
                    let kind = match &answer {
                        Ok(Aggregate::Ready { body }) if body.as_object().is_some_and(|o| !o.is_empty()) => "ready",
                        Ok(Aggregate::Ready { .. }) => "empty",
                        Ok(Aggregate::Old { .. }) => "old",
                        Ok(Aggregate::Failed { .. }) => "failed",
                        Err(_) => "error",
                    };
                    println!("{id} {profile} {which} {period:?}: {kind} in {} ms", started.elapsed().as_millis());
                }
            }
        }
    }
}
