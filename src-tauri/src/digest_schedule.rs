//! The morning digest kept as a schedule, as a memo without `digest list` keeps it (`digest_book.rs` reads that memo
//! through here), memo's other schedules beside it, read only, and `digest backfill`. Everything goes through memo's
//! own `schedule list|agent|remove|run` and `digest backfill`; memo writes the schedule file and
//! the timer (systemd, launchd or Task Scheduler). Nothing here touches either.
//!
//! memo has no pause: off is `schedule remove` (the runs stay), on is `schedule agent` again with the time and routes
//! the page last read. `schedule agent` under an existing name replaces that schedule, so a new time is the same call.
//! Routes name the owner's own chat and mailbox; they leave Rust unmasked, an exception to rule 4 like the digest
//! itself, and are never logged.

use crate::catalog::{self, Tool};
use crate::skills::{body, call, failure};
use crate::{redact, tools};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const NAME: &str = "morning-digest";
const PROMPT: &str = "Run memo skill show morning-digest and follow it.";
/// The mail agent's minimum: `schedule agent` with its caps. A memo without `--deliver-to` refuses that option itself,
/// and its words reach the page.
const MIN_MEMO: &str = "0.131.26";
const MAX_ROUTES: usize = 4;
/// A cap beyond this is a typo, not a choice.
const MAX_USD: f64 = 50.0;
/// One run is an agent reading a day of messages; a backfill builds up to a month of them.
const RUN_TIMEOUT: Duration = Duration::from_mins(20);
const BACKFILL_TIMEOUT: Duration = Duration::from_hours(3);
const MAX_BACKFILL_DAYS: i64 = 31;
const RANGE: [&str; 2] = ["--since-time", "--until-time"];
/// memo 0.131.72 and older name the range `--from` and `--to`.
const OLD_RANGE: [&str; 2] = ["--from", "--to"];

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum DigestSchedules {
    NoMemo,
    Old {
        version: Option<String>,
        need: String,
    },
    /// `digest`: the morning digest's schedule, `None` when there is none. `harness`: Claude Code is on PATH, so a
    /// schedule can be made.
    #[serde(rename_all = "camelCase")]
    Ready {
        digest: Option<Box<DigestSchedule>>,
        others: Vec<OtherSchedule>,
        harness: bool,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigestSchedule {
    /// memo's words, `daily at 08:30`.
    pub when: String,
    /// `08:30`, for a schedule that runs daily at a time.
    pub time: Option<String>,
    pub routes: Vec<Route>,
    pub notify: Option<String>,
    pub last: Option<ScheduleRun>,
    pub spent_today_usd: Option<f64>,
    pub max_cost_usd: Option<f64>,
    /// 0 is no daily cap.
    pub max_cost_per_day_usd: Option<f64>,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RouteKind {
    TelegramBot,
    Email,
}

/// One `--deliver-to`: `telegram-bot:<profile>/<chat>` or `email:<profile>/<address>`.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    /// The whole route, as memo takes it back.
    pub value: String,
    pub kind: RouteKind,
    pub profile: String,
    pub to: String,
}

/// A schedule's last run, without its output: an agent's answer quotes messages.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRun {
    pub at: String,
    pub exit_code: i64,
    /// Why a failed run failed: an error code and reason id, never the message.
    pub reason: Option<String>,
    pub failures: Option<u64>,
    pub failing_since: Option<String>,
    pub cost_usd: Option<f64>,
    pub skipped: Option<crate::mail_agent::Skipped>,
    pub deliveries: Vec<Delivery>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Delivery {
    pub kind: Option<RouteKind>,
    pub ok: bool,
    pub reason: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OtherSchedule {
    pub name: String,
    /// `agent` or `command`.
    pub kind: String,
    pub when: String,
    pub last: Option<ScheduleRun>,
    pub spent_today_usd: Option<f64>,
    pub max_cost_usd: Option<f64>,
    pub max_cost_per_day_usd: Option<f64>,
    /// The agent it starts, `None` from a memo that does not say.
    pub harness: Option<String>,
    /// Why its last run failed, when the agent's own words say: memo's `digest list` keeps no run files.
    pub trouble: Option<crate::background_agent::AgentTrouble>,
}

/// `digest backfill`: the price first (no `--yes`), then what it built.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum Backfill {
    /// This memo has no `digest backfill` yet.
    Unsupported,
    /// `days`: the days it would build; `skipped`: those that already have a digest.
    #[serde(rename_all = "camelCase")]
    Estimate { days: u64, skipped: u64, estimate_usd: Option<f64> },
    #[serde(rename_all = "camelCase")]
    Done { built: u64, skipped: u64, cost_usd: Option<f64> },
}

pub(crate) fn memo() -> Result<Result<&'static Tool, DigestSchedules>, String> {
    let memo = catalog::tool("memo")?;
    let state = tools::detect(memo, false);
    let Some(first) = state.installs.first() else { return Ok(Err(DigestSchedules::NoMemo)) };
    if crate::tools::older(first.version.as_deref(), MIN_MEMO) {
        return Ok(Err(DigestSchedules::Old { version: first.version.clone(), need: MIN_MEMO.into() }));
    }
    Ok(Ok(memo))
}

fn words(list: &[&str]) -> Vec<String> {
    list.iter().map(|w| (*w).to_string()).collect()
}

pub fn status() -> Result<DigestSchedules, String> {
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(memo, &words(&["schedule", "list", "--no-record", "--json"]), Duration::from_secs(30))?;
    match json {
        Some(v) if out.code == Some(0) => Ok(read(&v, crate::background_agent::effective().is_some())),
        j => Err(failure(&out, j.as_ref())),
    }
}

pub(crate) fn read(v: &Value, harness: bool) -> DigestSchedules {
    let items = v["items"].as_array().map(Vec::as_slice).unwrap_or_default();
    let digest = items.iter().find(|i| i["name"].as_str() == Some(NAME)).map(|i| {
        Box::new(DigestSchedule {
            when: text(&i["when"]),
            time: daily_time(i["when"].as_str().unwrap_or_default()),
            routes: i["deliver_to"].as_array().into_iter().flatten().filter_map(|r| route(r.as_str()?)).collect(),
            notify: i["notify"].as_str().map(str::to_string),
            last: run_of(&i["last"]),
            spent_today_usd: i["spent_today_usd"].as_f64(),
            max_cost_usd: i["max_cost_usd"].as_f64(),
            max_cost_per_day_usd: i["max_cost_per_day_usd"].as_f64(),
        })
    });
    let others = items
        .iter()
        .filter(|i| i["name"].as_str().is_some_and(|n| n != NAME))
        .map(|i| OtherSchedule {
            name: text(&i["name"]),
            kind: text(&i["kind"]),
            when: text(&i["when"]),
            last: run_of(&i["last"]),
            spent_today_usd: i["spent_today_usd"].as_f64(),
            max_cost_usd: i["max_cost_usd"].as_f64(),
            max_cost_per_day_usd: i["max_cost_per_day_usd"].as_f64(),
            harness: i["harness"].as_str().map(str::to_string),
            trouble: crate::background_agent::trouble_of_run(&i["last"], i["harness"].as_str()),
        })
        .collect();
    DigestSchedules::Ready { digest, others, harness }
}

fn text(v: &Value) -> String {
    v.as_str().unwrap_or_default().to_string()
}

/// `daily at 08:30` → `08:30`.
pub(crate) fn daily_time(when: &str) -> Option<String> {
    when.strip_prefix("daily at ").filter(|t| is_time(t)).map(str::to_string)
}

pub(crate) fn is_time(t: &str) -> bool {
    let Some((h, m)) = t.split_once(':') else { return false };
    let two = |s: &str| (s.len() == 2 && s.bytes().all(|b| b.is_ascii_digit())).then(|| s.parse::<u8>().ok()).flatten();
    two(h).is_some_and(|h| h <= 23) && two(m).is_some_and(|m| m <= 59)
}

/// A route memo would take, or `None`: the shape `schedule agent --deliver-to` documents, nothing else.
pub(crate) fn route(text: &str) -> Option<Route> {
    let (kind, rest) = text.split_once(':')?;
    let (profile, to) = rest.split_once('/')?;
    catalog::validate_profile(profile).ok()?;
    let kind = match kind {
        "telegram-bot" => {
            let id = to.strip_prefix("user:").unwrap_or(to);
            let digits = id.strip_prefix('-').unwrap_or(id);
            (!digits.is_empty() && digits.len() <= 20 && digits.bytes().all(|b| b.is_ascii_digit()))
                .then_some(RouteKind::TelegramBot)?
        }
        "email" => {
            let (user, host) = to.split_once('@')?;
            let plain = |s: &str| !s.is_empty() && !s.contains(['@', '/', ' ', '\t', '\n', '\r', '"', '<', '>']);
            (to.len() <= 254 && plain(user) && plain(host) && host.contains('.')).then_some(RouteKind::Email)?
        }
        _ => return None,
    };
    Some(Route { value: text.to_string(), kind, profile: profile.to_string(), to: to.to_string() })
}

fn kind_of(route: &str) -> Option<RouteKind> {
    match route.split_once(':')?.0 {
        "telegram-bot" => Some(RouteKind::TelegramBot),
        "email" => Some(RouteKind::Email),
        _ => None,
    }
}

pub(crate) fn run_of(v: &Value) -> Option<ScheduleRun> {
    Some(ScheduleRun {
        at: v["at"].as_str()?.to_string(),
        exit_code: v["exit_code"].as_i64()?,
        reason: v["reason"].as_str().map(redact::text),
        failures: v["failures"].as_u64(),
        failing_since: v["failing_since"].as_str().map(str::to_string),
        cost_usd: v["cost_usd"].as_f64(),
        skipped: skipped(&v["skipped"]),
        deliveries: v["deliveries"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|d| Delivery {
                kind: d["to"].as_str().and_then(kind_of),
                ok: d["ok"].as_bool().unwrap_or(false),
                reason: d["reason"].as_str().map(redact::text),
            })
            .collect(),
    })
}

fn skipped(v: &Value) -> Option<crate::mail_agent::Skipped> {
    Some(crate::mail_agent::Skipped {
        at: v["at"].as_str()?.to_string(),
        why: redact::text(v["why"].as_str()?),
        reason: v["reason"].as_str().map(redact::text),
    })
}

fn usd(value: f64) -> String {
    format!("{}", (value * 100.0).round() / 100.0)
}

/// The words of `schedule agent` for the digest, every value checked; memo replaces a schedule of the same name.
/// `harness`: the agent for background jobs, checked against what this memo starts.
fn agent_args(
    harness: &str,
    time: &str,
    routes: &[String],
    max_cost: f64,
    max_cost_per_day: f64,
) -> Result<Vec<String>, String> {
    if !is_time(time) {
        return Err(format!("not a time of day: {time}"));
    }
    if routes.len() > MAX_ROUTES {
        return Err(format!("at most {MAX_ROUTES} routes"));
    }
    if let Some(bad) = routes.iter().find(|r| route(r).is_none()) {
        return Err(format!("not a route memo takes: {}", redact::text(bad)));
    }
    let cap = |v: f64, zero: bool| v.is_finite() && v <= MAX_USD && (v > 0.0 || (zero && v == 0.0));
    if !cap(max_cost, false) || !cap(max_cost_per_day, true) {
        return Err("a cost cap is out of range".into());
    }
    let mut args = words(&["schedule", "agent", NAME, harness, PROMPT, "--at", time]);
    args.extend(["--max-cost".into(), usd(max_cost), "--max-cost-per-day".into(), usd(max_cost_per_day)]);
    args.extend(["--notify-on".into(), "always".into()]);
    for r in routes {
        args.extend(["--deliver-to".into(), r.clone()]);
    }
    args.push("--json".into());
    Ok(args)
}

/// Makes the schedule, or replaces it with a new time or routes.
pub fn save(time: &str, routes: &[String], max_cost: f64, max_cost_per_day: f64) -> Result<DigestSchedules, String> {
    let harness = crate::background_agent::effective().ok_or("Choose the agent for background jobs first.")?;
    let args = agent_args(&harness, time, routes, max_cost, max_cost_per_day)?;
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(memo, &args, Duration::from_mins(1))?;
    if out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    status()
}

pub fn remove() -> Result<DigestSchedules, String> {
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(memo, &words(&["schedule", "remove", NAME, "--json"]), Duration::from_mins(1))?;
    // Already gone is what the owner asked for.
    let gone = json.as_ref().and_then(|v| v["error"]["code"].as_str()) == Some("not_found");
    if out.code != Some(0) && !gone {
        return Err(failure(&out, json.as_ref()));
    }
    status()
}

/// Runs the digest now, as its timer would: it costs a run and delivers to its routes. A run that failed is in the
/// answer's `last`; only memo refusing to run it is an error.
pub fn run_now() -> Result<DigestSchedules, String> {
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(memo, &words(&["schedule", "run", NAME, "--json"]), RUN_TIMEOUT)?;
    if json.as_ref().is_some_and(|v| v.get("error").is_some()) || json.is_none() && out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    status()
}

fn backfill_args(
    name: Option<&str>,
    from: &str,
    to: &str,
    yes: bool,
    [since, until]: [&str; 2],
) -> Result<Vec<String>, String> {
    let name = crate::digest_book::name_arg(name)?;
    let day = |d: &str| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").map_err(|_| format!("not a day: {d}"));
    let (start, end) = (day(from)?, day(to)?);
    let span = (end - start).num_days();
    if !(0..MAX_BACKFILL_DAYS).contains(&span) {
        return Err(format!("from {from} to {to} is not 1 to {MAX_BACKFILL_DAYS} days"));
    }
    let mut args = words(&["digest", "backfill"]);
    args.extend(name);
    args.extend(words(&[since, from, until, to, "--json"]));
    if yes {
        args.push("--yes".into());
    }
    Ok(args)
}

/// A count memo may give as a number or as the list of days.
fn count(v: &Value) -> u64 {
    v.as_u64().or_else(|| v.as_array().map(|a| a.len() as u64)).unwrap_or(0)
}

fn read_backfill(v: &Value, yes: bool) -> Backfill {
    let b = body(v);
    if yes {
        let built = if b.get("built").is_some() { &b["built"] } else { &b["days"] };
        Backfill::Done {
            built: count(built),
            skipped: count(&b["skipped"]),
            cost_usd: b["cost_usd"].as_f64().or_else(|| b["spent_usd"].as_f64()),
        }
    } else {
        Backfill::Estimate {
            days: count(&b["days"]),
            skipped: count(&b["skipped"]),
            estimate_usd: b["estimate_usd"].as_f64(),
        }
    }
}

fn error_starts(json: Option<&Value>, prefixes: &[&str]) -> bool {
    json.and_then(|v| v["error"]["message"].as_str()).is_some_and(|m| prefixes.iter().any(|p| m.starts_with(p)))
}

/// memo checks its required options before its unknown ones, so 0.131.72 asks for `--from` first.
fn old_range(json: Option<&Value>) -> bool {
    error_starts(json, &["unknown option '--since-time'", "required option '--from"])
}

fn unknown_command(json: Option<&Value>) -> bool {
    error_starts(json, &["unknown command 'digest'", "unknown command 'backfill'"])
}

/// Without `yes`, memo only prices the days; with it, memo builds them, writes each as that day's run and delivers
/// none of them.
pub fn backfill(name: Option<&str>, from: &str, to: &str, yes: bool) -> Result<Backfill, String> {
    let args = backfill_args(name, from, to, yes, RANGE)?;
    let Ok(memo) = memo()? else { return Ok(Backfill::Unsupported) };
    let timeout = if yes { BACKFILL_TIMEOUT } else { Duration::from_mins(1) };
    let (mut out, mut json) = call(memo, &args, timeout)?;
    if old_range(json.as_ref()) {
        (out, json) = call(memo, &backfill_args(name, from, to, yes, OLD_RANGE)?, timeout)?;
    }
    if unknown_command(json.as_ref()) {
        return Ok(Backfill::Unsupported);
    }
    match json {
        Some(v) if out.code == Some(0) => Ok(read_backfill(&v, yes)),
        j => Err(failure(&out, j.as_ref())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_digest_and_lists_the_other_schedules() {
        let v = json!({"items": [
            {"name": "mail-triage", "kind": "agent", "when": "every 30m", "spent_today_usd": 5.01,
             "max_cost_usd": 1, "max_cost_per_day_usd": 5, "last": {"at": "2026-11-08T21:00:00Z", "exit_code": 0,
             "output": "Invoice from Ana Ruiz", "trace_id": "t", "cost_usd": 0.4,
             "skipped": {"at": "2026-11-08T21:30:00Z", "why": "cap", "reason": "cost.day-cap"}}},
            {"name": "morning-digest", "kind": "agent", "when": "daily at 08:30", "notify": "always",
             "deliver_to": ["telegram-bot:personal/user:1001", "email:work/owner@example.com", "sms:x/1"],
             "spent_today_usd": 0.27, "max_cost_usd": 0.5, "max_cost_per_day_usd": 1,
             "last": {"at": "2026-11-08T07:30:00Z", "exit_code": 0, "output": "☀️ …", "trace_id": "t2",
                      "cost_usd": 0.27, "deliveries": [{"to": "telegram-bot:personal/user:1001", "ok": true},
                      {"to": "email:work/owner@example.com", "ok": false, "reason": "smtp.refused"}]}}
        ]});
        let DigestSchedules::Ready { digest: Some(d), others, harness: true } = read(&v, true) else { panic!() };
        assert_eq!(d.time.as_deref(), Some("08:30"));
        assert_eq!(
            d.routes.iter().map(|r| (r.kind, r.profile.as_str())).collect::<Vec<_>>(),
            [(RouteKind::TelegramBot, "personal"), (RouteKind::Email, "work")]
        );
        let last = d.last.unwrap();
        assert_eq!(last.cost_usd, Some(0.27));
        assert_eq!(
            last.deliveries[1],
            Delivery { kind: Some(RouteKind::Email), ok: false, reason: Some("smtp.refused".into()) }
        );
        assert_eq!(others.len(), 1);
        assert_eq!(others[0].when, "every 30m");
        assert_eq!(others[0].last.as_ref().unwrap().skipped.as_ref().unwrap().reason.as_deref(), Some("cost.day-cap"));
        assert!(matches!(read(&json!({"items": []}), false), DigestSchedules::Ready { digest: None, .. }));
    }

    #[test]
    fn takes_only_routes_of_the_documented_shape() {
        for ok in [
            "telegram-bot:personal/1001",
            "telegram-bot:personal/user:1001",
            "telegram-bot:p/-1002",
            "email:work/a.b@example.com",
        ] {
            assert!(route(ok).is_some(), "{ok}");
        }
        for bad in [
            "telegram-bot:personal/@name",
            "telegram-bot:--all/1",
            "telegram-bot:personal",
            "email:work/owner",
            "email:work/a@b@example.com",
            "email:work/a b@example.com",
            "sms:x/1",
            "",
        ] {
            assert!(route(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn builds_schedule_agent_with_every_value_checked() {
        let routes = vec!["telegram-bot:personal/user:1001".to_string()];
        assert_eq!(
            agent_args("claude", "08:30", &routes, 0.5, 1.0).unwrap().join(" "),
            "schedule agent morning-digest claude Run memo skill show morning-digest and follow it. --at 08:30 \
             --max-cost 0.5 --max-cost-per-day 1 --notify-on always --deliver-to telegram-bot:personal/user:1001 --json"
        );
        assert!(agent_args("claude", "8:30", &routes, 0.5, 1.0).is_err());
        assert!(agent_args("claude", "24:00", &routes, 0.5, 1.0).is_err());
        assert!(agent_args("claude", "08:30", &["--yes".to_string()], 0.5, 1.0).is_err());
        assert!(agent_args("claude", "08:30", &routes, 0.0, 1.0).is_err());
        assert!(agent_args("claude", "08:30", &routes, 0.5, 0.0).is_ok(), "0 a day is no daily cap");
        assert!(agent_args("claude", "08:30", &routes, f64::NAN, 1.0).is_err());
        assert!(agent_args("claude", "08:30", &[], 0.5, 1.0).is_ok(), "no route is the desktop notice only");
    }

    #[test]
    fn backfill_prices_first_and_reads_both_shapes() {
        assert_eq!(
            backfill_args(None, "2026-11-01", "2026-11-07", false, RANGE).unwrap().join(" "),
            "digest backfill --since-time 2026-11-01 --until-time 2026-11-07 --json"
        );
        assert_eq!(
            backfill_args(None, "2026-11-01", "2026-11-07", false, OLD_RANGE).unwrap().join(" "),
            "digest backfill --from 2026-11-01 --to 2026-11-07 --json"
        );
        assert!(
            backfill_args(None, "2026-11-01", "2026-11-07", true, RANGE).unwrap().ends_with(&["--yes".to_string()])
        );
        assert!(backfill_args(None, "2026-11-07", "2026-11-01", false, RANGE).is_err());
        assert!(backfill_args(None, "2026-10-01", "2026-11-07", false, RANGE).is_err());
        assert!(backfill_args(None, "--yes", "2026-11-07", false, RANGE).is_err());
        assert_eq!(
            backfill_args(Some("weekly"), "2026-11-01", "2026-11-07", false, RANGE).unwrap()[..3].join(" "),
            "digest backfill weekly"
        );
        assert_eq!(
            backfill_args(Some("morning-digest"), "2026-11-01", "2026-11-07", false, RANGE).unwrap()[2],
            "--since-time"
        );
        assert!(backfill_args(Some("-x"), "2026-11-01", "2026-11-07", false, RANGE).is_err());

        let estimate = json!({"item": {"days": ["2026-11-01", "2026-11-02"], "skipped": 1, "estimate_usd": 0.54}});
        assert_eq!(
            read_backfill(&estimate, false),
            Backfill::Estimate { days: 2, skipped: 1, estimate_usd: Some(0.54) }
        );
        assert_eq!(
            read_backfill(&json!({"built": 6, "skipped": [], "cost_usd": 1.6}), true),
            Backfill::Done { built: 6, skipped: 0, cost_usd: Some(1.6) }
        );
        let unknown = json!({"error": {"code": "validation_error", "message": "unknown command 'digest'"}});
        assert!(unknown_command(Some(&unknown)));
        assert!(!unknown_command(Some(&json!({"error": {"message": "unknown option '--since-time'"}}))));
    }

    #[test]
    fn an_older_memo_gets_the_old_range() {
        let error = |m: &str| json!({"error": {"code": "validation_error", "message": m}});
        assert!(old_range(Some(&error("required option '--from <date>' not specified"))));
        assert!(old_range(Some(&error("unknown option '--since-time'"))));
        assert!(!old_range(Some(&error("required option '--name <name>' not specified"))));
        assert!(!old_range(None));
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(
            serde_json::to_value(Backfill::Estimate { days: 7, skipped: 0, estimate_usd: Some(1.89) }).unwrap(),
            json!({"state": "estimate", "days": 7, "skipped": 0, "estimateUsd": 1.89})
        );
        assert_eq!(serde_json::to_value(RouteKind::TelegramBot).unwrap(), json!("telegramBot"));
    }
}
