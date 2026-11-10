//! The Clients page: deals and leads by stage through Memo's own `pipelines`, `deals` and `leads` commands, every CRM
//! account's copies and the owner's own. Titles, companies and names are the owner's own data on his own page, so
//! they are not masked (as on the Tasks page); they never go into a log or a report. Counts and sums per stage are
//! Memo's (`pipelines show`), never counted from the cards the page holds.
//!
//! A move of the owner's own card writes through `memo <kind>s move`. A CRM's copy is changed in the CRM by that CRM's
//! own CLI (`writer`, catalog `crm`), as the profile memo's `writes_with` names or the owner chose; its pipeline
//! answers `movable: no` while memo names no CLI for it or that CLI is missing or too old.
//!
//! The board's columns are the owner's base set and the cards come from every pipeline; the catalog's
//! `crmBoard.minVersion` is the first memo with base stages, and an older memo is refused. `base` holds every argv and
//! field name of the base-stage commands.

mod base;
mod writer;

pub use writer::{CrmScope, CrmVia};

use crate::memo_cli::{Call, Failure, with_memo};
use crate::skills::body;
use crate::task_board::{self, Unusable, with_query, words};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use std::time::Duration;

const LIMIT: &str = "500";
/// The newest won and the newest lost: the board is for work in play, not the archive.
const CLOSED: &str = "20";
const READ: Duration = Duration::from_mins(1);
const WRITE: Duration = Duration::from_secs(30);
const MAX_STAGE: usize = 200;

#[derive(Deserialize, Serialize, Type, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum CrmKind {
    Deal,
    Lead,
}

impl CrmKind {
    fn noun(self) -> &'static str {
        match self {
            CrmKind::Deal => "deal",
            CrmKind::Lead => "lead",
        }
    }
    fn plural(self) -> &'static str {
        match self {
            CrmKind::Deal => "deals",
            CrmKind::Lead => "leads",
        }
    }
}

#[derive(Serialize, Deserialize, Type, Debug, Clone, PartialEq)]
pub struct CrmAccount {
    pub provider: String,
    pub account: String,
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPipeline {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: String,
    /// The CRM account it was copied from; `None` for the owner's own.
    pub account: Option<CrmAccount>,
    /// Open deals or leads in all its stages, as memo counts them.
    pub open: u32,
    /// Whether the app may move its cards: on a board of several pipelines each card asks its own.
    pub movable: CrmMovable,
    /// The CLI and profile that change a CRM's copy there, as memo names them; `None` for the owner's own.
    pub writes_with: Option<CrmWritesWith>,
}

/// memo's `writes_with`: `profile` only when exactly one profile of `tool` is on the account; otherwise the owner
/// chooses among `profiles`, and `why` says so. Never filled in by the app.
#[derive(Serialize, Type, Debug, Clone, PartialEq)]
pub struct CrmWritesWith {
    pub tool: String,
    pub account: CrmAccount,
    pub profile: Option<String>,
    pub profiles: Vec<String>,
    pub why: Option<String>,
}

/// A base stage as a card or a mapping names it.
#[derive(Serialize, Type, Debug, Clone, PartialEq)]
pub struct CrmBaseRef {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: String,
}

/// One column of the base set; memo counts across every pipeline and account, confirmed mappings only.
#[derive(Serialize, Type, Debug, PartialEq)]
pub struct CrmBaseStage {
    /// `stage:<id>`, or the stage's name while the set does not exist yet (memo takes either in a write).
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: String,
    /// `open`, `won` or `lost`.
    pub outcome: String,
    /// Open deals or leads standing in it.
    pub open: u32,
    /// CRM stages confirmed onto it.
    pub mapped: u32,
}

/// What no column holds yet: open rows whose stage is unmapped or only suggested, and those stages.
#[derive(Serialize, Type, Debug, PartialEq)]
pub struct CrmUnsorted {
    pub open: u32,
    pub stages: u32,
}

/// A CRM pipeline's stage and the base stage it points to; `confirmed` is false while it is memo's suggestion.
#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStageMap {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: String,
    /// The CRM's own id of the stage, when memo lists it: a move names it, since names may repeat in a pipeline.
    pub external_id: Option<String>,
    pub outcome: String,
    pub pipeline: String,
    /// Open deals or leads standing in it now.
    pub open: u32,
    pub base: Option<CrmBaseRef>,
    pub confirmed: bool,
}

/// A change to the base set; memo keeps at least one stage per outcome and refuses what would break it.
#[derive(Deserialize, Type, Debug)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum CrmBaseEdit {
    Add {
        name: String,
        outcome: String,
    },
    Rename {
        #[serde(rename = "ref")]
        reference: String,
        name: String,
    },
    /// `position` counts from 1, in the set's order.
    Move {
        #[serde(rename = "ref")]
        reference: String,
        position: u32,
    },
    Remove {
        #[serde(rename = "ref")]
        reference: String,
    },
}

#[derive(Serialize, Type, Debug, PartialEq)]
pub struct CrmPerson {
    pub name: Option<String>,
    /// `owner` (who is responsible), `contact`, `decision-maker` or `influencer`.
    pub role: String,
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmCard {
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: String,
    pub pipeline: String,
    pub stage: String,
    /// `open`, `won` or `lost`.
    pub status: String,
    pub amount: Option<String>,
    pub currency: Option<String>,
    pub organization: Option<String>,
    pub people: Vec<CrmPerson>,
    pub close_date: Option<String>,
    pub closed_date: Option<String>,
    pub closed_reason: Option<String>,
    pub project_name: Option<String>,
    pub account: Option<CrmAccount>,
    /// The base stage its stage points to once confirmed; `None` while unsorted.
    pub base_stage: Option<CrmBaseRef>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Type, Debug, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrmMovable {
    Yes,
    /// A CRM's copy, which only that CRM's own CLI may change: `crmCli` while memo names no CLI the catalog has for
    /// it, `crmCliMissing` or `crmCliOld` while that CLI is not installed or older than the catalog's `crm.minVersion`.
    No {
        why: String,
    },
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrmRead {
    Missing,
    #[serde(rename_all = "camelCase")]
    Old {
        version: Option<String>,
        need: String,
    },
    /// Base stages as columns, cards of every pipeline of the kind; `mapping` is every CRM pipeline's stages.
    #[serde(rename_all = "camelCase")]
    Base {
        pipelines: Vec<CrmPipeline>,
        base: Vec<CrmBaseStage>,
        unsorted: CrmUnsorted,
        mapping: Vec<CrmStageMap>,
        cards: Vec<CrmCard>,
        more: bool,
    },
}

fn invalid(message: String) -> Failure {
    Failure { reason: None, details: Value::Null, message }
}

pub fn validate_pipeline(reference: &str) -> Result<&str, String> {
    let ok = reference
        .strip_prefix("pipeline:")
        .is_some_and(|id| !id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()));
    if ok { Ok(reference) } else { Err(format!("not a pipeline: {reference}")) }
}

pub fn validate_card(kind: CrmKind, reference: &str) -> Result<&str, String> {
    let ok = reference
        .strip_prefix(kind.noun())
        .and_then(|r| r.strip_prefix(':'))
        .is_some_and(|id| !id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()));
    if ok { Ok(reference) } else { Err(format!("not a {}: {reference}", kind.noun())) }
}

/// A stage's name as a pipeline lists it: one line, and never read as an option.
pub fn validate_stage(stage: &str) -> Result<&str, String> {
    let ok = !stage.trim().is_empty()
        && stage.chars().count() <= MAX_STAGE
        && !stage.starts_with('-')
        && !stage.chars().any(char::is_control);
    if ok { Ok(stage) } else { Err(format!("not a stage name: {stage}")) }
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

fn count(v: &Value, key: &str) -> u32 {
    v.get(key).and_then(Value::as_u64).and_then(|n| u32::try_from(n).ok()).unwrap_or(0)
}

fn account(v: &Value) -> Option<CrmAccount> {
    let a = v.get("account")?;
    Some(CrmAccount { provider: text(a, "provider")?, account: text(a, "account")? })
}

/// `movable` is the owner's own pipeline's until `pipelines_from` asks the CRM's CLI.
fn pipeline(v: &Value) -> Option<CrmPipeline> {
    let open = v["stages"].as_array().map_or(0, |a| a.iter().map(|st| count(st, "open")).sum());
    let account = account(v);
    let movable = if account.is_some() { CrmMovable::No { why: "crmCli".into() } } else { CrmMovable::Yes };
    let writes_with = writer::writes_with(v);
    Some(CrmPipeline { reference: text(v, "ref")?, name: text(v, "name")?, account, open, movable, writes_with })
}

fn card(v: &Value) -> Option<CrmCard> {
    let people = v["people"].as_array().map_or_else(Vec::new, |a| {
        a.iter().filter_map(|p| Some(CrmPerson { name: text(p, "name"), role: text(p, "role")? })).collect()
    });
    Some(CrmCard {
        reference: text(v, "ref")?,
        title: text(v, "title")?,
        pipeline: text(v, "pipeline")?,
        stage: text(v, "stage")?,
        status: text(v, "status")?,
        amount: text(v, "amount"),
        currency: text(v, "currency"),
        organization: v.get("organization").and_then(|o| text(o, "name")),
        people,
        close_date: text(v, "close_date"),
        closed_date: text(v, "closed_date"),
        closed_reason: text(v, "closed_reason"),
        project_name: text(v, "project_name"),
        account: account(v),
        base_stage: base::base_ref(v),
        created_at: text(v, "created_at").unwrap_or_default(),
        updated_at: text(v, "updated_at").unwrap_or_default(),
    })
}

/// Whether a CRM's CLI can write, by provider; the real one asks once per provider and read.
type Writers<'a> = dyn Fn(&str) -> writer::Writer + 'a;

fn pipelines_args(kind: CrmKind) -> Vec<String> {
    with_query(&["pipelines", "list"], &format!("kind:{}", kind.noun()))
}

fn pipelines_from(listed: &Value, writers: &Writers) -> Vec<CrmPipeline> {
    let mut pipelines: Vec<CrmPipeline> =
        listed["items"].as_array().map(|a| a.iter().filter_map(pipeline).collect()).unwrap_or_default();
    for p in &mut pipelines {
        p.movable = writer::movable(p, writers);
    }
    pipelines
}

/// The open ones in full up to the limit, the newest closed ones capped; `scope` narrows memo's query, if any.
fn cards_args(kind: CrmKind, scope: &str) -> [Vec<String>; 3] {
    // memo answers the newest of any status first, so a portal's years of closed deals would push the open ones out.
    [("open", LIMIT), ("won", CLOSED), ("lost", CLOSED)].map(|(status, limit)| {
        with_query(&[kind.plural(), "list", "--limit", limit], &format!("{scope}status:{status}"))
    })
}

/// The answers of `cards_args`, in its order.
fn cards_from(lists: [Result<Value, Failure>; 3]) -> Result<(Vec<CrmCard>, bool), Failure> {
    let [open, won, lost] = lists;
    let (open, won, lost) = (open?, won?, lost?);
    let more = open["page"]["has_more"].as_bool().unwrap_or(false);
    let cards = [open, won, lost]
        .iter()
        .flat_map(|list| list["items"].as_array().into_iter().flatten().filter_map(card))
        .collect();
    Ok((cards, more))
}

fn read_base_with(call: &Call, kind: CrmKind, writers: &Writers) -> Result<CrmRead, Failure> {
    let [a, b, c] = cards_args(kind, "");
    let stopped = || Err(Failure::plain("a read stopped"));
    // memo makes the base set on a store's first `stages show`: cards and mapping read beside it came back with no
    // base stage, every card unsorted (BUG-699). memo up to 0.131.76 answers concurrent calls of one command with the
    // last one's words (cli-memo#792): the three lists go one after another.
    let (listed, shown, mapped, [open, won, lost]) = std::thread::scope(|s| {
        let pipes = s.spawn(|| call(&pipelines_args(kind)));
        let shown = call(&base::show_args(kind));
        let mapped = s.spawn(|| call(&base::mapping_args(kind)));
        let lists = [a, b, c].map(|args| call(&args));
        (pipes.join().unwrap_or_else(|_| stopped()), shown, mapped.join().unwrap_or_else(|_| stopped()), lists)
    });
    let pipelines = pipelines_from(&listed?, writers);
    let (base, unsorted) = base::columns(&shown?);
    let mapping = base::mapping(&mapped?);
    let (cards, more) = cards_from([open, won, lost])?;
    Ok(CrmRead::Base { pipelines, base, unsorted, mapping, cards, more })
}

/// An answer instead of a board while memo is missing or older than the catalog's `crmBoard.minVersion`.
fn unusable() -> Result<Option<CrmRead>, String> {
    let source = crate::catalog::tool("memo")?.crm_board.as_ref().ok_or("Memo has no Clients page in the catalog")?;
    Ok(task_board::memo_unusable(&source.min_version)?.map(|u| match u {
        Unusable::Missing => CrmRead::Missing,
        Unusable::Old { version, need } => CrmRead::Old { version, need },
    }))
}

pub fn read(kind: CrmKind) -> Result<CrmRead, String> {
    if let Some(answer) = unusable()? {
        return Ok(answer);
    }
    let known = std::cell::RefCell::new(std::collections::HashMap::new());
    let writers =
        |provider: &str| *known.borrow_mut().entry(provider.to_string()).or_insert_with(|| writer::writer(provider));
    with_memo(READ, |call| read_base_with(call, kind, &writers))
}

fn move_with(call: &Call, kind: CrmKind, reference: &str, stage: &str) -> Result<CrmCard, Failure> {
    validate_card(kind, reference).map_err(invalid)?;
    validate_stage(stage).map_err(invalid)?;
    // memo reads `stage:<id>` as a base stage and may answer `stage.choice-required`; the page names the stage itself.
    if base::validate_stage_ref(stage).is_ok() {
        return Err(invalid(format!("a move names the card's own stage, not {stage}")));
    }
    let moved = call(&words(&[kind.plural(), "move", reference, stage]))?;
    card(body(&moved)).ok_or_else(|| invalid(format!("memo did not answer the moved {}", kind.noun())))
}

/// Moves the owner's own deal or lead through memo, which answers the card; memo refuses a CRM's copy itself ("change
/// it there"). With `via`, the CRM's own CLI moves a CRM's copy and answers no card: the page reads it again. The
/// stage is always the card's own pipeline's: the page resolves a base column to it from the mapping it read.
pub fn move_card(kind: CrmKind, reference: &str, stage: &str, via: Option<&CrmVia>) -> Result<Option<CrmCard>, String> {
    match via {
        None => with_memo(WRITE, |call| move_with(call, kind, reference, stage)).map(Some),
        Some(via) => writer::move_card(kind, reference, stage, via).map(|()| None),
    }
}

pub fn scope(account: &CrmAccount, profile: Option<&str>) -> Result<CrmScope, String> {
    writer::scope(account, profile)
}

pub fn scope_set(account: &CrmAccount, profile: &str, scope: &str) -> Result<(), String> {
    writer::scope_set(account, profile, scope)
}

fn map_with(call: &Call, stage: &str, to: &str) -> Result<(), Failure> {
    base::validate_stage_ref(stage).map_err(invalid)?;
    base::validate_base(to).map_err(invalid)?;
    call(&base::set_args(stage, to)).map(drop)
}

/// Points a pipeline's stage at a base stage, which also confirms it.
pub fn map_stage(stage: &str, to: &str) -> Result<(), String> {
    with_memo(WRITE, |call| map_with(call, stage, to))
}

/// Confirms one pipeline's suggestions, or, with none named, every suggestion of the kind.
fn confirm_with(call: &Call, kind: CrmKind, pipeline: Option<&str>) -> Result<(), Failure> {
    if let Some(p) = pipeline {
        validate_pipeline(p).map_err(invalid)?;
    }
    call(&base::confirm_args(kind, pipeline)).map(drop)
}

pub fn confirm(kind: CrmKind, pipeline: Option<&str>) -> Result<(), String> {
    with_memo(WRITE, |call| confirm_with(call, kind, pipeline))
}

fn edit_with(call: &Call, kind: CrmKind, edit: &CrmBaseEdit) -> Result<(), Failure> {
    let args = match edit {
        CrmBaseEdit::Add { name, outcome } => base::add_args(
            kind,
            validate_stage(name).map_err(invalid)?,
            base::validate_outcome(outcome).map_err(invalid)?,
        ),
        CrmBaseEdit::Rename { reference, name } => base::rename_args(
            kind,
            base::validate_base(reference).map_err(invalid)?,
            validate_stage(name).map_err(invalid)?,
        ),
        CrmBaseEdit::Move { reference, position } => {
            if *position == 0 {
                return Err(invalid("a position counts from 1".into()));
            }
            base::move_args(kind, base::validate_base(reference).map_err(invalid)?, &position.to_string())
        }
        CrmBaseEdit::Remove { reference } => base::remove_args(kind, base::validate_base(reference).map_err(invalid)?),
    };
    call(&args).map(drop)
}

pub fn edit_base(kind: CrmKind, edit: &CrmBaseEdit) -> Result<(), String> {
    with_memo(WRITE, |call| edit_with(call, kind, edit))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    // Captured from memo 0.131.57 against a throwaway store.
    fn pipelines() -> Value {
        json!({"items":[
            {"id":"2","ref":"pipeline:2","name":"Sales","kind":"deal","account":null,"external_id":null,"stages":[]},
            {"id":"7","ref":"pipeline:7","name":"Northstar sales","kind":"deal",
             "account":{"provider":"bitrix24","account":"northstar.example"},"external_id":"0","stages":[]}],
            "page":{"mode":"page","limit":2,"has_more":false}})
    }

    fn deal() -> Value {
        json!({"id":"2","ref":"deal:2","kind":"deal","title":"Site for Northstar",
            "summary":"Site for Northstar · Quote, 500 000.00 RUB","pipeline":"pipeline:2","pipeline_name":"Sales",
            "stage":"Quote","status":"open","organization":{"ref":"organization:1","name":"Northstar Labs","owner":false},
            "currency":"RUB","amount":"500000.00","close_date":"2026-12-01","closed_date":null,"closed_reason":null,
            "rank":null,"deal":null,"account":null,"external_id":null,"assignee":null,"provider_metadata":{},
            "people":[{"ref":"person:2","name":"Alice Moreno","owner":false,"role":"decision-maker"}],
            "source":"owner","project":null,"project_name":null,
            "created_at":"2026-11-08T12:30:04.960Z","updated_at":"2026-11-08T12:30:04.960Z"})
    }

    fn none(_: &str) -> writer::Writer {
        writer::Writer::None
    }

    fn fake(seen: &Mutex<Vec<Vec<String>>>, args: &[String]) -> Result<Value, Failure> {
        seen.lock().unwrap().push(args.to_vec());
        match (args[0].as_str(), args[1].as_str()) {
            ("pipelines", "list") => Ok(pipelines()),
            ("deals", "list") if args.last().is_some_and(|q| q.ends_with("status:open")) => {
                Ok(json!({"items":[deal()],"page":{"limit":500,"has_more":true}}))
            }
            ("deals", "list") => Ok(json!({"items":[],"page":{"limit":20,"has_more":true}})),
            ("deals", "move") => Ok(json!({"item": deal()})),
            _ => Err(invalid("unexpected".into())),
        }
    }

    #[test]
    fn a_move_names_the_card_and_the_stage_and_answers_the_card() {
        let seen = Mutex::new(vec![]);
        let moved = move_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, "deal:2", "Quote").unwrap();
        assert_eq!(moved.stage, "Quote");
        assert_eq!(seen.lock().unwrap()[0], ["deals", "move", "deal:2", "Quote", "--json", "--no-record"]);
    }

    // The shapes of cli-core #2720 (store version 60), as its `stages` commands and `deals list` answer them.
    fn based(args: &[String]) -> Value {
        match (args[0].as_str(), args[1].as_str()) {
            ("stages", "show") => json!({"item":{"kind":"deal","pipeline":"pipeline:2","stages":[
                {"ref":"stage:1","name":"Call","position":1,"outcome":"open","open":2,"mapped":1},
                {"ref":"stage:3","name":"Quote","position":2,"outcome":"open","open":1,"mapped":2}],
                "unsorted":{"open":1,"stages":1}}}),
            ("stages", "list") => json!({"items":[
                {"ref":"stage:41","name":"Invoice sent","external_id":"C7:INVOICE","position":3,"outcome":"open","kind":"deal",
                 "pipeline":"pipeline:7","pipeline_name":"Northstar sales",
                 "account":{"provider":"bitrix24","account":"northstar.example"},
                 "base_stage":{"ref":"stage:3","name":"Quote"},"confirmed":true,"open":3,
                 "untrusted":["name","pipeline_name"]},
                {"ref":"stage:42","name":"Waiting for payment","position":4,"outcome":"open","kind":"deal",
                 "pipeline":"pipeline:7","pipeline_name":"Northstar sales",
                 "account":{"provider":"bitrix24","account":"northstar.example"},"base_stage":null,
                 "confirmed":false,"open":1,"untrusted":["name","pipeline_name"]}],
                "page":{"limit":2,"page":1,"has_more":false}}),
            ("deals", "list") => {
                let mut d = deal();
                d["base_stage"] = json!({"ref":"stage:3","name":"Quote"});
                json!({"items":[d],"page":{"has_more":false}})
            }
            ("pipelines", "list") => pipelines(),
            ("stages", "confirm") => json!({"item":{"confirmed":2}}),
            _ => json!({"item":{}}),
        }
    }

    #[test]
    fn a_base_read_holds_the_base_columns_every_pipelines_cards_and_this_kinds_mapping() {
        let seen = Mutex::new(vec![]);
        let read = read_base_with(
            &|a: &[String]| {
                seen.lock().unwrap().push(a.to_vec());
                Ok(based(a))
            },
            CrmKind::Deal,
            &none,
        )
        .unwrap();
        let CrmRead::Base { pipelines, base, unsorted, mapping, cards, more } = read else { panic!("not a base read") };
        assert_eq!(pipelines[1].movable, CrmMovable::No { why: "crmCli".into() });
        assert_eq!((base[1].open, base[1].mapped), (1, 2));
        assert_eq!(unsorted, CrmUnsorted { open: 1, stages: 1 });
        assert_eq!(mapping.iter().map(|m| m.reference.as_str()).collect::<Vec<_>>(), ["stage:41", "stage:42"]);
        assert!(mapping[0].confirmed && mapping[0].open == 3 && mapping[1].base.is_none());
        assert_eq!((mapping[0].external_id.as_deref(), mapping[1].external_id.as_deref()), (Some("C7:INVOICE"), None));
        assert_eq!(cards[0].base_stage, Some(CrmBaseRef { reference: "stage:3".into(), name: "Quote".into() }));
        assert!(!more);
        let mut seen: Vec<String> = seen.lock().unwrap().iter().map(|a| a.join(" ")).collect();
        seen.sort();
        assert_eq!(
            seen,
            [
                "deals list --limit 20 --json --no-record -- status:lost",
                "deals list --limit 20 --json --no-record -- status:won",
                "deals list --limit 500 --json --no-record -- status:open",
                "pipelines list --json --no-record -- kind:deal",
                "stages list --json --no-record -- kind:deal",
                "stages show deal --json --no-record",
            ]
        );
    }

    #[test]
    fn a_crm_pipeline_moves_once_memo_names_its_cli_and_that_cli_can_write() {
        let portal = json!({"provider":"bitrix24","account":"northstar.example"});
        let listed = json!({"items":[{"ref":"pipeline:7","name":"Northstar sales","kind":"deal","account":portal,
            "stages":[],"writes_with":{"tool":"b24","account":portal,"profile":null,"profiles":["sales","work"],
            "why":"two b24 profiles are on this account; the owner chooses one"}}]});
        let call = |a: &[String]| if a[..2] == ["pipelines", "list"] { Ok(listed.clone()) } else { Ok(based(a)) };
        let b24 = crate::catalog::tool("bitrix").unwrap();
        let read = read_base_with(&call, CrmKind::Deal, &|_| writer::Writer::Ready(b24)).unwrap();
        let CrmRead::Base { pipelines, .. } = read else { panic!("not a base read") };
        assert_eq!(pipelines[0].movable, CrmMovable::Yes);
        let w = pipelines[0].writes_with.as_ref().unwrap();
        assert_eq!((w.profile.as_deref(), w.profiles.len()), (None, 2));
    }

    #[test]
    fn a_base_read_asks_the_base_set_first_then_the_lists_one_at_a_time() {
        let (log, lists, most) = (Mutex::new(Vec::<String>::new()), Mutex::new(0), Mutex::new(0));
        let call = |a: &[String]| {
            let what = a[..2].join(" ");
            log.lock().unwrap().push(format!("start {what}"));
            let list = what == "deals list";
            if list {
                let mut l = lists.lock().unwrap();
                *l += 1;
                let mut m = most.lock().unwrap();
                *m = (*m).max(*l);
            }
            // The pipelines read runs beside the base set's: in turn, `stages show` would wait for the deadline.
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            while what == "stages show" && !log.lock().unwrap().iter().any(|e| e == "start pipelines list") {
                if std::time::Instant::now() > deadline {
                    return Err(invalid("the pipelines waited for the base set".into()));
                }
                std::thread::yield_now();
            }
            std::thread::sleep(Duration::from_millis(5));
            if list {
                *lists.lock().unwrap() -= 1;
            }
            log.lock().unwrap().push(format!("end {what}"));
            Ok(based(a))
        };
        let read = read_base_with(&call, CrmKind::Deal, &none).unwrap();
        assert!(matches!(read, CrmRead::Base { .. }));
        let log = log.lock().unwrap();
        let at = |e: &str| log.iter().position(|x| x == e).unwrap();
        assert!(at("end stages show") < at("start deals list"));
        assert!(at("end stages show") < at("start stages list"));
        assert_eq!((log.len(), *most.lock().unwrap()), (12, 1));
    }

    #[test]
    fn a_base_read_fails_with_the_failing_calls_own_words_and_the_earliest_asked_wins() {
        let failing = |words: &'static [&'static str]| {
            move |a: &[String]| {
                if words.iter().any(|w| a.join(" ").contains(w)) {
                    Err(Failure::plain(format!("memo refused {}", a[..2].join(" "))))
                } else {
                    Ok(based(a))
                }
            }
        };
        let err = |r: Result<CrmRead, Failure>| r.err().map(|f| f.message);
        let one = read_base_with(&failing(&["status:won"]), CrmKind::Deal, &none);
        assert_eq!(err(one).as_deref(), Some("memo refused deals list"));
        let two = read_base_with(&failing(&["status:won", "stages show"]), CrmKind::Deal, &none);
        assert_eq!(err(two).as_deref(), Some("memo refused stages show"));
    }

    #[test]
    fn before_the_base_set_exists_its_columns_are_named_and_an_edit_names_the_stage() {
        let shown = json!({"item":{"kind":"deal","pipeline":null,"stages":[
            {"ref":null,"name":"New","position":1,"outcome":"open","open":0,"mapped":0},
            {"ref":null,"name":"Won","position":5,"outcome":"won","open":0,"mapped":0}],
            "unsorted":{"open":4,"stages":6}}});
        let (base, unsorted) = base::columns(&shown);
        assert_eq!(base.iter().map(|b| b.reference.as_str()).collect::<Vec<_>>(), ["New", "Won"]);
        assert_eq!(unsorted.open, 4);
        let seen = Mutex::new(vec![]);
        let call = |a: &[String]| {
            seen.lock().unwrap().push(a.join(" "));
            Ok(based(a))
        };
        edit_with(&call, CrmKind::Deal, &CrmBaseEdit::Rename { reference: "New".into(), name: "Fresh".into() })
            .unwrap();
        map_with(&call, "stage:6", "Won").unwrap();
        assert_eq!(
            *seen.lock().unwrap(),
            ["stages rename deal New Fresh --json --no-record", "stages set stage:6 Won --json --no-record"]
        );
    }

    #[test]
    fn base_writes_name_stages_by_ref_and_confirm_a_pipeline_or_the_whole_kind() {
        let seen = Mutex::new(vec![]);
        let call = |a: &[String]| {
            seen.lock().unwrap().push(a.to_vec());
            Ok(based(a))
        };
        map_with(&call, "stage:42", "stage:3").unwrap();
        confirm_with(&call, CrmKind::Deal, Some("pipeline:7")).unwrap();
        confirm_with(&call, CrmKind::Lead, None).unwrap();
        let edits = [
            CrmBaseEdit::Add { name: "Demo".into(), outcome: "open".into() },
            CrmBaseEdit::Rename { reference: "stage:3".into(), name: "Offer".into() },
            CrmBaseEdit::Move { reference: "stage:3".into(), position: 2 },
            CrmBaseEdit::Remove { reference: "stage:3".into() },
        ];
        for e in &edits {
            edit_with(&call, CrmKind::Lead, e).unwrap();
        }
        let seen: Vec<String> = seen.lock().unwrap().iter().map(|a| a.join(" ")).collect();
        assert_eq!(
            seen,
            [
                "stages set stage:42 stage:3 --json --no-record",
                "stages confirm --pipeline pipeline:7 --json --no-record",
                "stages confirm --all --kind lead --json --no-record",
                "stages create lead Demo open --json --no-record",
                "stages rename lead stage:3 Offer --json --no-record",
                "stages move lead stage:3 2 --json --no-record",
                "stages remove lead stage:3 --json --no-record",
            ]
        );
    }

    #[test]
    fn base_writes_refuse_a_bad_ref_name_outcome_or_position_before_memo_runs() {
        let seen = Mutex::new(0);
        let call = |a: &[String]| {
            *seen.lock().unwrap() += 1;
            Ok(based(a))
        };
        assert!(map_with(&call, "pipeline:7", "stage:3").is_err());
        assert!(map_with(&call, "stage:6", "--all").is_err());
        assert!(confirm_with(&call, CrmKind::Deal, Some("stage:1")).is_err());
        assert!(
            edit_with(&call, CrmKind::Deal, &CrmBaseEdit::Add { name: "--all".into(), outcome: "open".into() })
                .is_err()
        );
        assert!(
            edit_with(&call, CrmKind::Deal, &CrmBaseEdit::Add { name: "X".into(), outcome: "maybe".into() }).is_err()
        );
        assert!(
            edit_with(&call, CrmKind::Deal, &CrmBaseEdit::Move { reference: "stage:3".into(), position: 0 }).is_err()
        );
        assert!(move_with(&call, CrmKind::Deal, "deal:2", "stage:3").is_err());
        assert_eq!(*seen.lock().unwrap(), 0);
    }

    #[test]
    fn refs_and_stages_are_checked_before_memo_runs() {
        assert!(validate_pipeline("pipeline:12").is_ok());
        assert!(validate_pipeline("pipeline:1;rm").is_err());
        assert!(validate_card(CrmKind::Lead, "lead:3").is_ok());
        assert!(validate_card(CrmKind::Lead, "deal:3").is_err());
        assert!(validate_stage("Quote sent").is_ok());
        assert!(validate_stage("--json").is_err());
        assert!(validate_stage("a\nb").is_err());
    }
}
