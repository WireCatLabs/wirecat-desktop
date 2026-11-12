//! The Digests page's table: every digest memo keeps by name, through
//! `memo digest list|add|edit|run|pause|resume|remove` (docs/dev/plans/2026-11-09-people-clients-digests.md,
//! "Digests by name"; memo's own help is the source of truth).
//!
//! A memo without `digest list` has one digest, `morning-digest`, kept as a schedule: the page then reads
//! `schedule list` and writes through `schedule agent|remove|run` (`digest_schedule.rs`), and what that memo cannot do
//! (a second digest, several times, weekdays, sources, a run that is not sent) is refused before memo runs.
//! Titles, briefs and routes are the owner's own words and leave Rust unmasked, like the digest itself; never logged.

use crate::background_agent::{self, AgentTrouble, Pick};
use crate::catalog::Tool;
use crate::digest_schedule::{self, DigestSchedules, OtherSchedule, Route, is_time, route};
use crate::enrichment::Gate;
use crate::picture_reading::checked_model;
use crate::skills::{call, failure};
use crate::{digests, redact, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

pub const MORNING: &str = "morning-digest";
/// memo's `DIGEST_SOURCES`: what a digest can read.
const SOURCES: [&str; 9] = ["telegram", "max", "whatsapp", "mail", "meetings", "tasks", "drive", "calendar", "crm"];
/// The sources a memo reads only from `digests.moreSources.minVersion` on.
const MORE_SOURCES: [&str; 3] = ["drive", "calendar", "crm"];
/// memo's refusals of a save the window words itself.
const WORDED: [&str; 3] = ["digest.agent-unchosen", "agent.cost-unknown", "agent.unrestricted"];
const WEEKDAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX_TIMES: usize = 6;
const MAX_ROUTES: usize = 4;
const MAX_NAME: usize = 40;
const MAX_TITLE: usize = 80;
/// memo's own limit on a brief; memo checks it again.
const MAX_BRIEF: usize = 4000;
const MAX_USD: f64 = 50.0;
const CALL: Duration = Duration::from_mins(1);
const RUN_TIMEOUT: Duration = Duration::from_mins(20);

/// What `digest add|edit` take from which memo on; a gate whose `minVersion` is null is not released yet.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestsSource {
    /// `--model`; `--agent` itself is tried and dropped for an older memo (`without_agent`).
    #[serde(default)]
    pub agent: Option<Gate>,
    /// `--source drive|calendar|crm`.
    #[serde(default)]
    pub more_sources: Option<Gate>,
    /// `--allow-dangerous` on `digest add|edit`: an agent memo starts only with the owner's consent writes a digest.
    #[serde(default)]
    pub agent_consent: Option<Gate>,
}

/// What the installed memo's `digest add|edit` take beyond the digests by name.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct Opened {
    agent: bool,
    more_sources: bool,
    agent_consent: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum DigestBook {
    NoMemo,
    Old {
        version: Option<String>,
        need: String,
    },
    /// `named`: this memo keeps digests by name (`digest list`); without it there is only `morning-digest`.
    /// `harness`: an agent for background jobs is ready, so a new digest can be written.
    #[serde(rename_all = "camelCase")]
    Ready {
        digests: Vec<DigestItem>,
        others: Vec<OtherSchedule>,
        harness: bool,
        named: bool,
        /// This memo takes the agent's model (`--model`).
        agent: bool,
        /// This memo reads Drive, Calendar and a CRM too.
        more_sources: bool,
        /// This memo writes a digest in an agent that needs the owner's consent, once he gives it on the digest.
        agent_consent: bool,
        /// memo lists a digest only while its schedule exists: a morning digest taken off schedule the old way has
        /// past days and no row, and the daily template brings it back by its name.
        morning_rests: bool,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigestItem {
    pub name: String,
    pub title: Option<String>,
    /// `HH:MM`, each a run; empty for a digest that has no time yet.
    pub times: Vec<String>,
    /// Empty is every day.
    pub weekdays: Vec<String>,
    /// Empty is every connected source.
    pub sources: Vec<String>,
    pub routes: Vec<Route>,
    pub brief: Option<String>,
    pub scheduled: bool,
    /// The model named on the agent's command line; `None` for the agent's own default.
    pub model: Option<String>,
    pub max_cost_usd: Option<f64>,
    pub max_cost_per_day_usd: Option<f64>,
    pub spent_today_usd: Option<f64>,
    pub last: Option<DigestRun>,
    pub next_at: Option<String>,
    /// The agent that writes it, `None` from a memo that does not say.
    pub agent: Option<String>,
    /// Why its last run failed, when the agent's own words say: no credit, a limit, signed out.
    pub trouble: Option<AgentTrouble>,
    /// Why its timer will not start it until the owner acts, with memo's command that fixes it.
    pub needs: Option<String>,
}

/// The last run, without its output: the output quotes messages and the page reads the day itself.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigestRun {
    pub at: String,
    pub ok: bool,
    pub cost_usd: Option<f64>,
}

/// One digest as the form saves it.
#[derive(specta::Type, Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigestSpec {
    pub name: String,
    pub title: String,
    pub times: Vec<String>,
    pub weekdays: Vec<String>,
    pub sources: Vec<String>,
    pub routes: Vec<String>,
    pub brief: Option<String>,
    /// `None` keeps the model; `""` is the agent's own default.
    pub model: Option<String>,
    pub max_cost_usd: f64,
    pub max_cost_per_day_usd: f64,
    pub scheduled: bool,
    /// The agent to write it: on an edit, the digest's own unless the owner moves it; `None` on a new one is the
    /// agent for background jobs.
    #[serde(default)]
    pub agent: Option<String>,
    /// The owner ticked his consent to an agent memo cannot limit ([`background_agent::ACK_FLAG`]).
    #[serde(default)]
    pub allow_dangerous: bool,
}

/// Where a run made now goes: everywhere the schedule sends it, only into the app, or to some of its routes.
#[derive(specta::Type, Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum SendTo {
    All,
    Here,
    Only { routes: Vec<String> },
}

fn words(list: &[&str]) -> Vec<String> {
    list.iter().map(|w| (*w).to_string()).collect()
}

/// A name memo keys files by: lower-case letters, digits and dashes, never an option.
pub fn check_name(name: &str) -> Result<(), String> {
    let ok = !name.is_empty()
        && name.len() <= MAX_NAME
        && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && name.as_bytes()[0].is_ascii_alphanumeric();
    if ok { Ok(()) } else { Err(format!("not a digest name: {}", redact::text(name))) }
}

fn check_routes(routes: &[String]) -> Result<(), String> {
    if routes.len() > MAX_ROUTES {
        return Err(format!("at most {MAX_ROUTES} routes"));
    }
    match routes.iter().find(|r| route(r).is_none()) {
        Some(bad) => Err(format!("not a route memo takes: {}", redact::text(bad))),
        None => Ok(()),
    }
}

fn usd(value: f64) -> String {
    format!("{}", (value * 100.0).round() / 100.0)
}

/// Every value of the form checked, and the options `digest add|edit` take; the times sorted and once each.
/// `costed`: the agent reports what a run costs; memo refuses the caps for one that does not.
fn spec_options(spec: &DigestSpec, costed: bool, open: Opened) -> Result<Vec<String>, String> {
    check_name(&spec.name)?;
    let title = spec.title.trim();
    if title.is_empty() || title.chars().count() > MAX_TITLE || title.chars().any(char::is_control) {
        return Err(format!("a title is 1 to {MAX_TITLE} characters on one line"));
    }
    let mut times = spec.times.clone();
    times.sort();
    times.dedup();
    if times.is_empty() || times.len() > MAX_TIMES {
        return Err(format!("1 to {MAX_TIMES} times a day"));
    }
    if let Some(bad) = times.iter().find(|t| !is_time(t)) {
        return Err(format!("not a time of day: {}", redact::text(bad)));
    }
    if let Some(bad) = spec.weekdays.iter().find(|d| !WEEKDAYS.contains(&d.as_str())) {
        return Err(format!("not a weekday: {}", redact::text(bad)));
    }
    if let Some(bad) = spec.sources.iter().find(|s| !SOURCES.contains(&s.as_str())) {
        return Err(format!("not a source a digest reads: {}", redact::text(bad)));
    }
    if !open.more_sources && spec.sources.iter().any(|s| MORE_SOURCES.contains(&s.as_str())) {
        return Err("Drive, Calendar and a CRM as sources need a newer Memo".into());
    }
    let model = spec.model.as_deref().map(str::trim).filter(|_| open.agent);
    if let Some(m) = model.filter(|m| !m.is_empty()) {
        checked_model(m)?;
    }
    check_routes(&spec.routes)?;
    // memo reads a cap of 0 as none: a run's cap below a cent would round to no cap at all.
    let cap = |v: f64, zero: bool| v.is_finite() && v <= MAX_USD && (v >= 0.01 || (zero && v == 0.0));
    if !cap(spec.max_cost_usd, false) || !cap(spec.max_cost_per_day_usd, true) {
        return Err("a cost cap is out of range".into());
    }
    let brief = spec.brief.as_deref().map(str::trim).filter(|b| !b.is_empty());
    if brief.is_some_and(|b| b.chars().count() > MAX_BRIEF) {
        return Err(format!("a brief is at most {MAX_BRIEF} characters"));
    }

    // `--opt=value`: a title or brief that starts with a dash stays a value.
    let mut args = vec![format!("--title={title}")];
    let days: Vec<&str> = WEEKDAYS.iter().copied().filter(|d| spec.weekdays.iter().any(|w| w == d)).collect();
    args.extend(
        times.iter().map(
            |t| {
                if days.is_empty() { format!("--at={t}") } else { format!("--at={} {t}", days.join(",")) }
            },
        ),
    );
    // An edit keeps what an option leaves out, so an empty list is said out loud.
    if spec.sources.is_empty() {
        args.push("--source=all".into());
    }
    args.extend(spec.sources.iter().map(|s| format!("--source={s}")));
    if spec.routes.is_empty() {
        args.push("--deliver-to=none".into());
    }
    args.extend(spec.routes.iter().map(|r| format!("--deliver-to={r}")));
    if let Some(m) = model {
        args.push(format!("--model={m}"));
    }
    if costed {
        args.push(format!("--max-cost={}", usd(spec.max_cost_usd)));
        args.push(format!("--max-cost-per-day={}", usd(spec.max_cost_per_day_usd)));
    }
    Ok(args)
}

/// `agent` is already checked against what this memo starts; `None` leaves memo's own: claude on `add`, the
/// digest's own on `edit`.
fn save_args(spec: &DigestSpec, create: bool, agent: Option<&Pick>, open: Opened) -> Result<Vec<String>, String> {
    let options = spec_options(spec, agent.is_none_or(|a| a.costed), open)?;
    let mut args = words(&["digest", if create { "add" } else { "edit" }, &spec.name]);
    args.extend(options);
    if let Some(agent) = agent {
        args.extend(["--agent".to_string(), agent.id.clone()]);
        // Only a pick the owner consented to on this digest needs it (`agent_for`).
        if agent.ack {
            args.push(background_agent::ACK_FLAG.into());
        }
    }
    // An open digest's brief has its own card and memo verb; an edit that sent it would undo that card's save.
    if create {
        if let Some(b) = spec.brief.as_deref().map(str::trim).filter(|b| !b.is_empty()) {
            args.push(format!("--text={b}"));
        }
        if !spec.scheduled {
            args.push("--paused".into());
        }
    }
    args.extend(words(&["--from-app", "--json"]));
    Ok(args)
}

/// `pause` keeps every setting and takes it off its timer; `resume` puts it back.
fn timer_args(name: &str, on: bool) -> Vec<String> {
    words(&["digest", if on { "resume" } else { "pause" }, name, "--from-app", "--json"])
}

fn run_args(name: &str, delivery: &SendTo) -> Result<Vec<String>, String> {
    check_name(name)?;
    let mut args = words(&["digest", "run", name]);
    match delivery {
        SendTo::All => {}
        SendTo::Here => args.push("--no-notify".into()),
        SendTo::Only { routes } => {
            if routes.is_empty() {
                return Err("name at least one route, or show it here only".into());
            }
            check_routes(routes)?;
            args.extend(routes.iter().map(|r| format!("--deliver-to={r}")));
        }
    }
    args.extend(words(&["--from-app", "--json"]));
    Ok(args)
}

/// What an older memo, with one digest kept as a schedule, can be asked; anything else needs a memo update.
fn fits_old(spec: &DigestSpec) -> Result<(&str, &[String]), String> {
    let update = "this needs a newer Memo";
    if spec.name != MORNING || spec.times.len() != 1 || !spec.weekdays.is_empty() || !spec.sources.is_empty() {
        return Err(update.into());
    }
    Ok((&spec.times[0], &spec.routes))
}

fn message(json: Option<&Value>) -> Option<&str> {
    json.and_then(|v| v["error"]["message"].as_str())
}

/// memo has no `digest <verb>` yet.
fn older(json: Option<&Value>, verb: &str) -> bool {
    message(json).is_some_and(|m| m.starts_with(&format!("unknown command '{verb}'")))
}

fn memo() -> Result<Result<&'static Tool, DigestBook>, String> {
    Ok(digest_schedule::memo()?.map_err(|shown| match shown {
        DigestSchedules::Old { version, need } => DigestBook::Old { version, need },
        _ => DigestBook::NoMemo,
    }))
}

/// The agent to name: one this memo starts and limits (Claude Code for a memo that cannot list its own), the agent for
/// background jobs on a new digest, none on an edit that keeps the digest's own. One memo cannot limit writes a digest
/// only on a memo that takes the owner's consent with it, and only once he ticked it on this digest.
fn agent_for(spec: &DigestSpec, create: bool, open: Opened) -> Result<Option<Pick>, String> {
    if spec.agent.is_none() && !create {
        return Ok(None);
    }
    let consent = open.agent_consent && spec.allow_dangerous;
    let pick = match spec.agent.as_deref() {
        Some(id) if consent => background_agent::check_consented(id)?,
        agent => background_agent::pick(agent)?,
    };
    if pick.ack && !consent {
        return Err(if open.agent_consent {
            format!("Memo cannot limit what {} runs: tick your consent on the digest first.", pick.id)
        } else {
            format!("Memo cannot write digests in {} yet. Choose another agent for them.", pick.id)
        });
    }
    Ok(Some(pick))
}

/// A memo from before `digest --agent` writes every digest with claude: asking it for claude is asking for nothing.
fn without_agent(args: &[String]) -> Option<Vec<String>> {
    let at = args.iter().position(|a| a == "--agent")?;
    if args.get(at + 1)? != "claude" {
        return None;
    }
    Some(args.iter().enumerate().filter(|(i, _)| *i != at && *i != at + 1).map(|(_, a)| a.clone()).collect())
}

fn opened(memo: &Tool) -> Opened {
    let Some(src) = memo.digests.as_ref() else { return Opened::default() };
    let version = tools::installed_version(memo);
    let open = |gate: &Option<Gate>| gate.as_ref().is_some_and(|g| g.open(version.as_deref()));
    Opened { agent: open(&src.agent), more_sources: open(&src.more_sources), agent_consent: open(&src.agent_consent) }
}

fn text(v: &Value) -> Option<String> {
    v.as_str().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array().into_iter().flatten().filter_map(|s| s.as_str().map(str::to_string)).collect()
}

/// 0.131.75's `digest list` leaves out what the day has cost so far; its `schedule list` has it, by the same name.
fn item_of(i: &Value, schedules: &[OtherSchedule]) -> Option<DigestItem> {
    let name = i["name"].as_str().filter(|n| check_name(n).is_ok())?.to_string();
    let last = &i["last"];
    let schedule = schedules.iter().find(|s| s.name == name);
    let spent_today_usd = i["spent_today_usd"].as_f64().or_else(|| schedule.and_then(|s| s.spent_today_usd));
    Some(DigestItem {
        name,
        title: text(&i["title"]),
        times: strings(&i["times"]).into_iter().filter(|t| is_time(t)).collect(),
        weekdays: strings(&i["weekdays"]).into_iter().filter(|d| WEEKDAYS.contains(&d.as_str())).collect(),
        sources: strings(&i["sources"]),
        routes: strings(&i["routes"]).iter().filter_map(|r| route(r)).collect(),
        brief: text(&i["brief"]),
        scheduled: i["scheduled"].as_bool().unwrap_or(false),
        model: text(&i["model"]).filter(|m| checked_model(m).is_ok()),
        max_cost_usd: i["max_cost_usd"].as_f64(),
        max_cost_per_day_usd: i["max_cost_per_day_usd"].as_f64(),
        spent_today_usd,
        last: last["at"].as_str().map(|at| DigestRun {
            at: at.to_string(),
            ok: last["ok"].as_bool().unwrap_or(false),
            cost_usd: last["cost_usd"].as_f64(),
        }),
        next_at: text(&i["next_at"]),
        agent: text(&i["harness"]).or_else(|| schedule.and_then(|s| s.harness.clone())),
        trouble: background_agent::trouble_of_run(last, i["harness"].as_str())
            .or_else(|| schedule.and_then(|s| s.trouble.clone())),
        needs: text(&i["needs"]),
    })
}

fn read_named(
    list: &Value,
    schedules: DigestSchedules,
    harness: bool,
    open: Opened,
    morning_days: impl FnOnce() -> bool,
) -> DigestBook {
    let schedules = match schedules {
        DigestSchedules::Ready { others, .. } => others,
        _ => Vec::new(),
    };
    let digests: Vec<DigestItem> =
        list["items"].as_array().into_iter().flatten().filter_map(|i| item_of(i, &schedules)).collect();
    let others = schedules.into_iter().filter(|o| !digests.iter().any(|d| d.name == o.name)).collect();
    let morning_rests = !digests.iter().any(|d| d.name == MORNING) && morning_days();
    DigestBook::Ready {
        digests,
        others,
        harness,
        named: true,
        agent: open.agent,
        more_sources: open.more_sources,
        agent_consent: open.agent_consent,
        morning_rests,
    }
}

/// The morning digest of an older memo as a row: its schedule, or, once taken off schedule, its past days alone.
fn read_old(schedules: DigestSchedules, has_days: bool) -> DigestBook {
    let DigestSchedules::Ready { digest, others, harness } = schedules else {
        return DigestBook::NoMemo;
    };
    let row = match digest {
        Some(d) => Some(DigestItem {
            name: MORNING.into(),
            title: None,
            times: d.time.into_iter().collect(),
            weekdays: Vec::new(),
            sources: Vec::new(),
            routes: d.routes,
            brief: None,
            scheduled: true,
            model: None,
            max_cost_usd: d.max_cost_usd,
            max_cost_per_day_usd: d.max_cost_per_day_usd,
            spent_today_usd: d.spent_today_usd,
            last: d.last.map(|l| DigestRun { ok: l.exit_code == 0, at: l.at, cost_usd: l.cost_usd }),
            next_at: None,
            agent: None,
            trouble: None,
            needs: None,
        }),
        None if has_days => Some(DigestItem {
            name: MORNING.into(),
            title: None,
            times: Vec::new(),
            weekdays: Vec::new(),
            sources: Vec::new(),
            routes: Vec::new(),
            brief: None,
            scheduled: false,
            model: None,
            max_cost_usd: None,
            max_cost_per_day_usd: None,
            spent_today_usd: None,
            last: None,
            next_at: None,
            agent: None,
            trouble: None,
            needs: None,
        }),
        None => None,
    };
    DigestBook::Ready {
        digests: row.into_iter().collect(),
        others,
        harness,
        named: false,
        agent: false,
        more_sources: false,
        agent_consent: false,
        morning_rests: false,
    }
}

pub fn book() -> Result<DigestBook, String> {
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    // Both lists are needed whatever the first answers, so they are asked together.
    let (listed, schedules) = std::thread::scope(|s| {
        let schedules = s.spawn(digest_schedule::status);
        (call(memo, &words(&["digest", "list", "--json"]), CALL), schedules.join())
    });
    let schedules = schedules.map_err(|_| "reading the schedules failed".to_string())?;
    let (out, json) = listed?;
    if older(json.as_ref(), "list") {
        let has_days = digests::list(None).is_ok_and(|d| !d.is_empty());
        return Ok(read_old(schedules?, has_days));
    }
    match json {
        Some(v) if out.code == Some(0) => {
            let schedules = schedules?;
            // `schedule list`'s read has already asked which agent runs the jobs; once is enough.
            let harness = matches!(schedules, DigestSchedules::Ready { harness: true, .. });
            let open = opened(memo);
            Ok(read_named(&v, schedules, harness, open, || digests::list(None).is_ok_and(|d| !d.is_empty())))
        }
        j => Err(failure(&out, j.as_ref())),
    }
}

/// The reason id of a refusal the window words, else memo's own words.
fn refusal(out: &crate::run::Output, json: Option<&Value>) -> String {
    match crate::skills::reason(json) {
        Some(reason) if WORDED.contains(&reason) => reason.to_string(),
        _ => failure(out, json),
    }
}

/// A write memo answers with JSON: its refusal is the error, in its own words.
fn write(memo: &Tool, args: &[String], timeout: Duration) -> Result<Option<Value>, String> {
    let (out, json) = call(memo, args, timeout)?;
    if out.code != Some(0) && !older(json.as_ref(), args[1].as_str()) {
        return Err(refusal(&out, json.as_ref()));
    }
    Ok(json)
}

/// `create` adds a new digest; otherwise memo replaces the settings of the one named.
pub fn save(spec: &DigestSpec, create: bool) -> Result<DigestBook, String> {
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let open = opened(memo);
    let agent = agent_for(spec, create, open)?;
    let args = save_args(spec, create, agent.as_ref(), open)?;
    let json = match write(memo, &args, CALL) {
        Err(said) if said.contains("unknown option '--agent'") => {
            let plain =
                without_agent(&args).ok_or("Update Memo to write digests in an agent other than Claude Code.")?;
            write(memo, &plain, CALL)?
        }
        answer => answer?,
    };
    if older(json.as_ref(), &args[1]) {
        let (time, routes) = fits_old(spec)?;
        if spec.scheduled {
            digest_schedule::save(time, routes, spec.max_cost_usd, spec.max_cost_per_day_usd)?;
        } else {
            digest_schedule::remove()?;
        }
    }
    book()
}

/// Writes it now: a paid run. Sent as `delivery` says; a run that failed is in the answer's `last`.
pub fn run(name: &str, delivery: &SendTo) -> Result<DigestBook, String> {
    let args = run_args(name, delivery)?;
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let (out, json) = call(memo, &args, RUN_TIMEOUT)?;
    if older(json.as_ref(), "run") {
        if name != MORNING || *delivery != SendTo::All {
            return Err("this needs a newer Memo".into());
        }
        digest_schedule::run_now()?;
        return book();
    }
    if json.as_ref().is_some_and(|v| v.get("error").is_some()) || json.is_none() && out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    book()
}

/// On or off its schedule, every setting kept. An older memo forgets the settings when off, so the page turns it on
/// again with `save` and the settings it remembers.
pub fn set_scheduled(name: &str, on: bool) -> Result<DigestBook, String> {
    check_name(name)?;
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let args = timer_args(name, on);
    let json = match write(memo, &args, CALL) {
        Err(said) if said.contains("unknown option '--agent'") => {
            let plain =
                without_agent(&args).ok_or("Update Memo to write digests in an agent other than Claude Code.")?;
            write(memo, &plain, CALL)?
        }
        answer => answer?,
    };
    if older(json.as_ref(), &args[1]) {
        if name != MORNING || on {
            return Err("this needs a newer Memo".into());
        }
        digest_schedule::remove()?;
    }
    book()
}

/// Removes the digest's settings and schedule; its past days stay in memo's folder.
pub fn remove(name: &str) -> Result<DigestBook, String> {
    check_name(name)?;
    let memo = match memo()? {
        Ok(memo) => memo,
        Err(shown) => return Ok(shown),
    };
    let json = write(memo, &words(&["digest", "remove", name, "--from-app", "--json"]), CALL)?;
    if older(json.as_ref(), "remove") {
        return Err("this needs a newer Memo".into());
    }
    book()
}

/// The words a command that takes an optional digest name gets: none for the morning digest, so an older memo,
/// which knows only that one, is asked exactly as before.
pub fn name_arg(name: Option<&str>) -> Result<Option<String>, String> {
    match name {
        None | Some(MORNING) => Ok(None),
        Some(n) => check_name(n).map(|()| Some(n.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn spec() -> DigestSpec {
        DigestSpec {
            name: "evening".into(),
            title: "Evening digest".into(),
            times: vec!["18:00".into(), "08:30".into(), "08:30".into()],
            weekdays: vec![],
            sources: vec![],
            routes: vec!["telegram-bot:personal/user:1001".into()],
            brief: None,
            model: None,
            max_cost_usd: 0.5,
            max_cost_per_day_usd: 1.0,
            scheduled: true,
            agent: None,
            allow_dangerous: false,
        }
    }

    const OLD: Opened = Opened { agent: false, more_sources: false, agent_consent: false };
    const NEW: Opened = Opened { agent: true, more_sources: true, agent_consent: true };

    #[test]
    fn builds_digest_add_with_every_time_once_and_in_order() {
        assert_eq!(
            save_args(&spec(), true, None, OLD).unwrap().join(" "),
            "digest add evening --title=Evening digest --at=08:30 --at=18:00 --source=all \
             --deliver-to=telegram-bot:personal/user:1001 --max-cost=0.5 --max-cost-per-day=1 --from-app --json"
        );
        let weekly = DigestSpec {
            weekdays: vec!["fri".into(), "mon".into()],
            sources: vec!["mail".into(), "telegram".into()],
            brief: Some("  -- skip newsletters  ".into()),
            scheduled: false,
            ..spec()
        };
        let args = save_args(&weekly, false, None, OLD).unwrap();
        assert_eq!(args[..3], words(&["digest", "edit", "evening"]));
        for want in ["--at=mon,fri 08:30", "--at=mon,fri 18:00", "--source=mail"] {
            assert!(args.contains(&want.to_string()), "{want}");
        }
        assert!(
            !args.iter().any(|a| a == "--source=all" || a == "--paused" || a.starts_with("--text")),
            "an edit leaves the brief and the timer to their own verbs"
        );
        let pick = |id: &str, costed, ack| Pick { id: id.into(), costed, ack };
        let moved = save_args(&weekly, false, Some(&pick("gemini", false, false)), OLD).unwrap();
        assert!(moved.windows(2).any(|w| w == ["--agent", "gemini"]));
        assert!(!moved.iter().any(|a| a.starts_with("--max-cost")), "memo refuses a cap for an agent with no cost");
        assert!(!args.iter().any(|a| a == "--agent"), "an edit without one keeps the digest's own");
        let claude = save_args(&weekly, true, Some(&pick("claude", true, false)), OLD).unwrap();
        assert!(!without_agent(&claude).unwrap().iter().any(|a| a == "--agent" || a == "claude"));
        assert_eq!(without_agent(&moved), None, "an older memo cannot write it in gemini: the owner is told");
        let added = save_args(&weekly, true, None, OLD).unwrap();
        assert!(added.contains(&"--paused".to_string()));
        assert!(added.contains(&"--text=-- skip newsletters".to_string()));
    }

    #[test]
    fn an_edit_that_empties_a_list_says_so() {
        let args = save_args(&DigestSpec { routes: vec![], ..spec() }, false, None, OLD).unwrap();
        assert!(args.contains(&"--deliver-to=none".to_string()));
        assert!(args.contains(&"--source=all".to_string()));
        assert_eq!(timer_args("evening", false).join(" "), "digest pause evening --from-app --json");
        assert_eq!(timer_args("evening", true).join(" "), "digest resume evening --from-app --json");
    }

    #[test]
    fn refuses_a_bad_value_before_memo_runs() {
        let bad = |change: fn(&mut DigestSpec)| {
            let mut s = spec();
            change(&mut s);
            save_args(&s, true, None, NEW).is_err()
        };
        assert!(bad(|s| s.name = "--yes".into()));
        assert!(bad(|s| s.name = "Evening".into()));
        assert!(bad(|s| s.name = "../x".into()));
        assert!(bad(|s| s.name = String::new()));
        assert!(bad(|s| s.title = "  ".into()));
        assert!(bad(|s| s.title = "two\nlines".into()));
        assert!(bad(|s| s.times = vec![]));
        assert!(bad(|s| s.times = vec!["8:30".into()]));
        assert!(bad(|s| s.times = (0..7).map(|h| format!("0{h}:00")).collect()));
        assert!(bad(|s| s.weekdays = vec!["monday".into()]));
        assert!(bad(|s| s.sources = vec!["sms".into()]));
        assert!(bad(|s| s.model = Some("-x".into())));
        assert!(bad(|s| s.routes = vec!["--yes".into()]));
        assert!(bad(|s| s.max_cost_usd = 0.0));
        assert!(bad(|s| s.max_cost_usd = 0.004), "rounds to 0, which memo reads as no cap");
        assert!(bad(|s| s.max_cost_per_day_usd = f64::NAN));
        assert!(bad(|s| s.brief = Some("x".repeat(MAX_BRIEF + 1))));
        assert!(!bad(|s| s.max_cost_per_day_usd = 0.0), "0 a day is no daily cap");
        assert!(!bad(|s| s.routes = vec![]), "no route keeps it in the app");
    }

    #[test]
    fn names_the_model_and_caps_only_an_agent_that_reports_cost() {
        let pick = |id: &str, costed| Pick { id: id.into(), costed, ack: false };
        let claude = DigestSpec { model: Some(" sonnet ".into()), ..spec() };
        let args = save_args(&claude, true, Some(&pick("claude", true)), NEW).unwrap();
        for want in ["--model=sonnet", "--max-cost=0.5", "--max-cost-per-day=1"] {
            assert!(args.contains(&want.to_string()), "{want}");
        }
        assert!(args.windows(2).any(|w| w == ["--agent", "claude"]));
        let codex = save_args(&spec(), false, Some(&pick("codex", false)), NEW).unwrap();
        assert!(!codex.iter().any(|a| a.starts_with("--max-cost") || a.starts_with("--model")), "{codex:?}");
        let cleared = save_args(&DigestSpec { model: Some(String::new()), ..spec() }, false, None, NEW).unwrap();
        assert!(cleared.contains(&"--model=".to_string()), "an emptied model goes back to the agent's own");
    }

    #[test]
    fn an_older_memo_is_asked_no_model_and_no_new_source() {
        let args = save_args(&DigestSpec { model: Some("gpt-5".into()), ..spec() }, true, None, OLD).unwrap();
        assert!(!args.iter().any(|a| a.starts_with("--model")), "{args:?}");
        for source in MORE_SOURCES {
            let reads = DigestSpec { sources: vec![source.into()], ..spec() };
            assert!(save_args(&reads, false, None, OLD).is_err(), "{source}");
            let opened = Opened { more_sources: true, ..OLD };
            assert!(save_args(&reads, false, None, opened).unwrap().contains(&format!("--source={source}")));
        }
    }

    #[test]
    fn words_the_refusals_of_a_save_the_window_knows_and_passes_the_rest_on() {
        let out = crate::run::Output { code: Some(2), stdout: String::new(), stderr: String::new() };
        let refused = |reason: &str| {
            let v = json!({"error": {"code": "validation_error", "reason": reason, "message": "m",
                "details": {"choices": ["claude", "codex"]}}});
            refusal(&out, Some(&v))
        };
        assert_eq!(refused("digest.agent-unchosen"), "digest.agent-unchosen");
        assert_eq!(refused("agent.cost-unknown"), "agent.cost-unknown");
        assert_eq!(refused("agent.unrestricted"), "agent.unrestricted");
        assert_ne!(refused("digest.not-found"), "digest.not-found");
    }

    #[test]
    fn the_catalog_gates_the_agent_and_the_new_sources_on_released_memos() {
        let src = crate::catalog::tool("memo").unwrap().digests.as_ref().unwrap();
        assert_eq!(src.agent.as_ref().unwrap().min_version.as_deref(), Some("0.131.85"));
        assert_eq!(src.more_sources.as_ref().unwrap().min_version.as_deref(), Some("0.131.86"));
        assert_eq!(src.agent_consent.as_ref().unwrap().min_version.as_deref(), Some("0.131.86"));
    }

    #[test]
    fn passes_the_owners_consent_only_for_an_agent_that_needs_it() {
        let codex = Pick { id: "codex".into(), costed: false, ack: true };
        let args = save_args(&spec(), true, Some(&codex), NEW).unwrap();
        assert!(args.windows(3).any(|w| w == ["--agent", "codex", "--allow-dangerous"]), "{args:?}");
        let claude = Pick { id: "claude".into(), costed: true, ack: false };
        assert!(!save_args(&spec(), true, Some(&claude), NEW).unwrap().iter().any(|a| a == "--allow-dangerous"));
    }

    #[test]
    fn a_run_now_goes_where_it_is_told() {
        assert_eq!(run_args("evening", &SendTo::All).unwrap().join(" "), "digest run evening --from-app --json");
        assert_eq!(
            run_args("evening", &SendTo::Here).unwrap().join(" "),
            "digest run evening --no-notify --from-app --json"
        );
        let only = SendTo::Only { routes: vec!["email:work/owner@example.com".into()] };
        assert_eq!(
            run_args("evening", &only).unwrap().join(" "),
            "digest run evening --deliver-to=email:work/owner@example.com --from-app --json"
        );
        assert!(run_args("evening", &SendTo::Only { routes: vec![] }).is_err());
        assert!(run_args("evening", &SendTo::Only { routes: vec!["sms:x/1".into()] }).is_err());
        assert!(run_args("-x", &SendTo::All).is_err());
    }

    #[test]
    fn an_older_memo_takes_only_the_morning_digest_at_one_time() {
        let morning = DigestSpec { name: MORNING.into(), times: vec!["07:45".into()], ..spec() };
        assert_eq!(fits_old(&morning).unwrap().0, "07:45");
        assert!(fits_old(&spec()).is_err(), "a second digest");
        assert!(fits_old(&DigestSpec { times: vec!["07:00".into(), "19:00".into()], ..morning.clone() }).is_err());
        assert!(fits_old(&DigestSpec { weekdays: vec!["mon".into()], ..morning.clone() }).is_err());
        assert!(fits_old(&DigestSpec { sources: vec!["mail".into()], ..morning }).is_err());
        let error = json!({"error": {"code": "validation_error", "message": "unknown command 'list'"}});
        assert!(older(Some(&error), "list"));
        assert!(!older(Some(&error), "add"));
        assert!(!older(None, "list"));
    }

    #[test]
    fn reads_digest_list_and_keeps_the_other_schedules_apart() {
        let list = json!({"items": [
            {"name": "morning-digest", "title": "Morning digest", "times": ["08:30"], "weekdays": [], "sources": [],
             "routes": ["telegram-bot:personal/user:1001", "sms:x/1"], "brief": "HRB first", "scheduled": true,
             "max_cost_usd": 0.5, "max_cost_per_day_usd": 1, "next_at": "2026-11-10T07:30:00Z",
             "last": {"at": "2026-11-09T07:30:00Z", "ok": true, "cost_usd": 0.27, "output": "Anna wrote…"}},
            {"name": "weekly", "title": "", "times": ["09:00", "25:00"], "weekdays": ["mon", "someday"],
             "sources": ["mail"], "routes": [], "scheduled": false, "last": null, "next_at": null,
             "harness": "codex", "model": "gpt-5",
             "needs": "codex runs on a schedule only with your consent: `memo digest edit weekly --agent codex`"},
            {"name": "../bad", "times": ["09:00"]}
        ]});
        let schedules = DigestSchedules::Ready {
            digest: None,
            others: ["morning-digest", "mail-triage"]
                .map(|name| OtherSchedule {
                    name: name.into(),
                    kind: "agent".into(),
                    when: "every 30m".into(),
                    last: None,
                    spent_today_usd: Some(0.4),
                    max_cost_usd: None,
                    max_cost_per_day_usd: None,
                    harness: None,
                    trouble: None,
                })
                .into(),
            harness: true,
        };
        let DigestBook::Ready {
            digests,
            others,
            harness: false,
            named: true,
            agent: true,
            more_sources: false,
            agent_consent: false,
            morning_rests: false,
        } = read_named(&list, schedules, false, Opened { agent: true, ..OLD }, || {
            panic!("the morning digest is listed: its days are not looked at")
        })
        else {
            panic!()
        };
        assert_eq!(digests.len(), 2);
        assert_eq!(digests[0].routes.len(), 1);
        assert_eq!(
            digests[0].last,
            Some(DigestRun { at: "2026-11-09T07:30:00Z".into(), ok: true, cost_usd: Some(0.27) })
        );
        assert_eq!(digests[0].spent_today_usd, Some(0.4), "from the schedule of the same name");
        assert_eq!(digests[1].spent_today_usd, None);
        assert_eq!(digests[1].title, None);
        assert_eq!(digests[1].times, ["09:00"]);
        assert_eq!(digests[1].weekdays, ["mon"]);
        assert_eq!((digests[0].agent.as_deref(), digests[0].model.as_deref()), (None, None));
        assert_eq!((digests[1].agent.as_deref(), digests[1].model.as_deref()), (Some("codex"), Some("gpt-5")));
        assert_eq!(others.iter().map(|o| o.name.as_str()).collect::<Vec<_>>(), ["mail-triage"]);
        assert_eq!(digests[0].needs, None);
        assert!(digests[1].needs.as_deref().is_some_and(|n| n.starts_with("codex runs on a schedule")));
    }

    #[test]
    fn a_morning_digest_off_schedule_with_past_days_is_said_to_rest() {
        let list = json!({"items": [{"name": "weekly-digest", "title": "Weekly", "times": ["09:00"], "weekdays": ["mon"],
            "sources": [], "routes": [], "scheduled": true, "last": null, "next_at": null}]});
        let schedules = || DigestSchedules::Ready { digest: None, others: vec![], harness: true };
        let rests = |days: bool| match read_named(&list, schedules(), true, OLD, || days) {
            DigestBook::Ready { morning_rests, .. } => morning_rests,
            _ => panic!(),
        };
        assert!(rests(true));
        assert!(!rests(false));
    }

    #[test]
    fn reads_the_agent_that_writes_each_digest() {
        let list = json!({"items": [
            {"name": "evening", "times": ["18:00"], "scheduled": true, "harness": "codex", "model": null},
            {"name": "weekly", "times": ["09:00"], "scheduled": true}
        ]});
        let none = || DigestSchedules::Ready { digest: None, others: vec![], harness: true };
        let DigestBook::Ready { digests, .. } = read_named(&list, none(), true, OLD, || false) else { panic!() };
        assert_eq!(digests[0].agent.as_deref(), Some("codex"));
        assert_eq!(digests[1].agent, None, "a memo before `--agent` does not say");
    }

    #[test]
    fn a_digest_takes_its_failure_from_its_own_schedule_run() {
        let runs = std::env::temp_dir().join(format!("wc-digest-runs-{}", std::process::id())).join("runs");
        std::fs::create_dir_all(&runs).unwrap();
        let report = runs.join("1.md");
        std::fs::write(&report, "").unwrap();
        std::fs::write(runs.join("1.log"), "Credit balance is too low").unwrap();
        let listed = json!({"items": [{"name": "evening", "harness": "claude", "kind": "agent", "when": "daily at 18:00",
            "last": {"at": "2026-11-11T18:00:00Z", "exit_code": 1, "output": report.to_string_lossy()}}]});
        let DigestSchedules::Ready { others, .. } = digest_schedule::read(&listed, true) else { panic!() };
        let list = json!({"items": [{"name": "evening", "times": ["18:00"], "scheduled": true,
            "last": {"at": "2026-11-11T18:00:00Z", "ok": false}}]});
        let book = DigestSchedules::Ready { digest: None, others, harness: true };
        let DigestBook::Ready { digests, .. } = read_named(&list, book, true, OLD, || false) else { panic!() };
        let trouble = digests[0].trouble.as_ref().expect("memo's digest list keeps no run files; its schedule does");
        assert_eq!((trouble.agent.as_deref(), trouble.kind), (Some("claude"), background_agent::TroubleKind::NoCredit));
        assert_eq!(digests[0].agent.as_deref(), Some("claude"));
        std::fs::remove_dir_all(runs.parent().unwrap()).unwrap();
    }

    #[test]
    fn an_older_memo_shows_the_morning_digest_as_one_row() {
        let none = || DigestSchedules::Ready { digest: None, others: vec![], harness: true };
        assert!(
            matches!(read_old(none(), false), DigestBook::Ready { ref digests, named: false, .. } if digests.is_empty())
        );
        let DigestBook::Ready { digests, .. } = read_old(none(), true) else { panic!() };
        assert!(!digests[0].scheduled && digests[0].times.is_empty());
    }

    #[test]
    fn the_morning_digest_is_named_to_no_command() {
        assert_eq!(name_arg(None), Ok(None));
        assert_eq!(name_arg(Some(MORNING)), Ok(None));
        assert_eq!(name_arg(Some("weekly")), Ok(Some("weekly".into())));
        assert!(name_arg(Some("--all")).is_err());
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        let d: SendTo = serde_json::from_value(json!({"kind": "only", "routes": ["email:w/a@b.co"]})).unwrap();
        assert_eq!(d, SendTo::Only { routes: vec!["email:w/a@b.co".into()] });
        assert_eq!(serde_json::from_value::<SendTo>(json!({"kind": "here"})).unwrap(), SendTo::Here);
    }
}
