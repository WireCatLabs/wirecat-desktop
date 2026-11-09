//! The Clients page: deals and leads by stage through Memo's own `pipelines`, `deals` and `leads` commands, every CRM
//! account's copies and the owner's own. Titles, companies and names are the owner's own data on his own page, so
//! they are not masked (as on the Tasks page); they never go into a log or a report. Counts and sums per stage are
//! Memo's (`pipelines show`), never counted from the cards the page holds.
//!
//! A move of the owner's own card writes through `memo <kind>s move`. A CRM's copy is changed in the CRM by that CRM's
//! own CLI (`writer`, catalog `crm`), as the profile memo's `writes_with` names or the owner chose; its pipeline
//! answers `movable: no` while memo names no CLI for it or that CLI is missing or too old.
//!
//! With a memo that has base stages (catalog `crmBoard.baseStagesMinVersion`), the board's columns are the owner's
//! base set and the cards come from every pipeline; below it, one pipeline's own stages as before. `base` holds every
//! argv and field name of the base-stage commands.

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
pub struct CrmAmount {
    /// A decimal string, as Memo keeps it; never added across currencies.
    pub amount: String,
    pub currency: String,
    pub items: u32,
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStage {
    pub name: String,
    /// The CRM's own id of the stage (`C2:NEW`); `None` for an own pipeline's.
    pub external_id: Option<String>,
    /// `open`, `won` or `lost`.
    pub outcome: String,
    /// Every deal or lead standing in it now, as Memo counts them.
    pub items: u32,
    pub amounts: Vec<CrmAmount>,
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
    /// The base stage its stage points to once confirmed; `None` on a board of one pipeline's stages, or unsorted.
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
    /// `pipeline` is the one asked for, or the first Memo lists; `None` when there is none of this kind.
    #[serde(rename_all = "camelCase")]
    Ready {
        pipelines: Vec<CrmPipeline>,
        pipeline: Option<String>,
        stages: Vec<CrmStage>,
        cards: Vec<CrmCard>,
        /// More open ones match than one read holds; the counts above the columns still hold them all.
        more: bool,
        movable: CrmMovable,
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

/// `movable` is the owner's own pipeline's until `pipelines_with` asks the CRM's CLI.
fn pipeline(v: &Value) -> Option<CrmPipeline> {
    let open = v["stages"].as_array().map_or(0, |a| a.iter().map(|st| count(st, "open")).sum());
    let account = account(v);
    let movable = if account.is_some() { CrmMovable::No { why: "crmCli".into() } } else { CrmMovable::Yes };
    let writes_with = writer::writes_with(v);
    Some(CrmPipeline { reference: text(v, "ref")?, name: text(v, "name")?, account, open, movable, writes_with })
}

fn stage(v: &Value) -> Option<CrmStage> {
    let amounts = v["amounts"].as_array().map_or_else(Vec::new, |a| {
        a.iter()
            .filter_map(|x| {
                Some(CrmAmount { amount: text(x, "amount")?, currency: text(x, "currency")?, items: count(x, "items") })
            })
            .collect()
    });
    Some(CrmStage {
        name: text(v, "name")?,
        external_id: text(v, "external_id"),
        outcome: text(v, "outcome")?,
        items: count(v, "items"),
        amounts,
    })
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

/// The pipeline with the most open cards, the first in memo's order on a tie: memo lists an empty one first as often
/// as not, and an empty board reads as "nothing synced".
fn busiest(pipelines: &[CrmPipeline]) -> Option<&CrmPipeline> {
    pipelines.iter().rev().max_by_key(|p| p.open)
}

/// Whether a CRM's CLI can write, by provider; the real one asks once per provider and read.
type Writers<'a> = dyn Fn(&str) -> writer::Writer + 'a;

fn pipelines_with(call: &Call, kind: CrmKind, writers: &Writers) -> Result<Vec<CrmPipeline>, Failure> {
    let listed = call(&with_query(&["pipelines", "list"], &format!("kind:{}", kind.noun())))?;
    let mut pipelines: Vec<CrmPipeline> =
        listed["items"].as_array().map(|a| a.iter().filter_map(pipeline).collect()).unwrap_or_default();
    for p in &mut pipelines {
        p.movable = writer::movable(p, writers);
    }
    Ok(pipelines)
}

/// The open ones in full up to the limit, the newest closed ones capped; `scope` narrows memo's query, if any.
fn cards_with(call: &Call, kind: CrmKind, scope: &str) -> Result<(Vec<CrmCard>, bool), Failure> {
    // memo answers the newest of any status first, so a portal's years of closed deals would push the open ones out.
    let mut more = false;
    let mut cards = Vec::new();
    for (status, limit) in [("open", LIMIT), ("won", CLOSED), ("lost", CLOSED)] {
        let list = call(&with_query(&[kind.plural(), "list", "--limit", limit], &format!("{scope}status:{status}")))?;
        more |= status == "open" && list["page"]["has_more"].as_bool().unwrap_or(false);
        cards.extend(list["items"].as_array().into_iter().flatten().filter_map(card));
    }
    Ok((cards, more))
}

fn read_with(call: &Call, kind: CrmKind, asked: Option<&str>, writers: &Writers) -> Result<CrmRead, Failure> {
    let pipelines = pipelines_with(call, kind, writers)?;
    let chosen = asked.and_then(|r| pipelines.iter().find(|p| p.reference == r)).or_else(|| busiest(&pipelines));
    let Some(chosen) = chosen else {
        return Ok(CrmRead::Ready {
            pipelines,
            pipeline: None,
            stages: vec![],
            cards: vec![],
            more: false,
            movable: CrmMovable::Yes,
        });
    };
    let shown = call(&words(&["pipelines", "show", &chosen.reference]))?;
    let stages = body(&shown)["stages"].as_array().map(|a| a.iter().filter_map(stage).collect()).unwrap_or_default();
    let (cards, more) = cards_with(call, kind, &format!("pipeline:\"{}\" ", chosen.reference))?;
    Ok(CrmRead::Ready {
        pipeline: Some(chosen.reference.clone()),
        movable: chosen.movable.clone(),
        more,
        stages,
        cards,
        pipelines,
    })
}

fn read_base_with(call: &Call, kind: CrmKind, writers: &Writers) -> Result<CrmRead, Failure> {
    let pipelines = pipelines_with(call, kind, writers)?;
    let (base, unsorted) = base::columns(&call(&base::show_args(kind))?);
    let mapping = base::mapping(&call(&base::mapping_args(kind))?);
    let (cards, more) = cards_with(call, kind, "")?;
    Ok(CrmRead::Base { pipelines, base, unsorted, mapping, cards, more })
}

enum Mode {
    Unusable(CrmRead),
    Pipeline,
    Base,
}

fn gate() -> Result<Mode, String> {
    let source = crate::catalog::tool("memo")?.crm_board.as_ref().ok_or("Memo has no Clients page in the catalog")?;
    if let Some(u) = task_board::memo_unusable(&source.min_version)? {
        return Ok(Mode::Unusable(match u {
            Unusable::Missing => CrmRead::Missing,
            Unusable::Old { version, need } => CrmRead::Old { version, need },
        }));
    }
    Ok(match source.base_stages_min_version.as_deref() {
        Some(need) if task_board::memo_unusable(need)?.is_none() => Mode::Base,
        _ => Mode::Pipeline,
    })
}

/// `pipeline` chooses the board of one pipeline's stages; the base board holds every pipeline and ignores it.
pub fn read(kind: CrmKind, pipeline: Option<&str>) -> Result<CrmRead, String> {
    if let Some(p) = pipeline {
        validate_pipeline(p)?;
    }
    let known = std::cell::RefCell::new(std::collections::HashMap::new());
    let writers =
        |provider: &str| *known.borrow_mut().entry(provider.to_string()).or_insert_with(|| writer::writer(provider));
    match gate()? {
        Mode::Unusable(r) => Ok(r),
        Mode::Pipeline => with_memo(READ, |call| read_with(call, kind, pipeline, &writers)),
        Mode::Base => with_memo(READ, |call| read_base_with(call, kind, &writers)),
    }
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

    fn shown() -> Value {
        json!({"item":{"id":"2","ref":"pipeline:2","name":"Sales","kind":"deal","account":null,"stages":[
            {"name":"Call","position":1,"outcome":"open","external_id":null,"open":0,"reached":2,"conversion":1,
             "items":0,"amounts":[]},
            {"name":"Quote","position":2,"outcome":"open","external_id":"C2:QUOTE","open":1,"reached":2,"conversion":0.5,
             "items":1,"amounts":[{"amount":"500000.00","currency":"RUB","items":1}]},
            {"name":"won","position":4,"outcome":"won","external_id":null,"open":0,"reached":1,"conversion":null,
             "items":1,"amounts":[{"amount":"1200.00","currency":"EUR","items":1}]}],
            "totals":{"items":2,"open":1,"won":1,"lost":0,"win_rate":1},"since":null}})
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
            ("pipelines", "show") => Ok(shown()),
            ("deals", "list") if args.last().is_some_and(|q| q.ends_with("status:open")) => {
                Ok(json!({"items":[deal()],"page":{"limit":500,"has_more":true}}))
            }
            ("deals", "list") => Ok(json!({"items":[],"page":{"limit":20,"has_more":true}})),
            ("deals", "move") => Ok(json!({"item": deal()})),
            _ => Err(invalid("unexpected".into())),
        }
    }

    #[test]
    fn reads_the_first_pipeline_its_stage_sums_and_its_cards() {
        let seen = Mutex::new(vec![]);
        let read = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, None, &none).unwrap();
        let CrmRead::Ready { pipelines, pipeline, stages, cards, more, movable } = read else { panic!("not ready") };
        assert_eq!(pipelines.len(), 2);
        assert_eq!(pipeline.as_deref(), Some("pipeline:2"));
        assert_eq!((stages[0].external_id.as_deref(), stages[1].external_id.as_deref()), (None, Some("C2:QUOTE")));
        assert_eq!(stages[1].amounts, vec![CrmAmount { amount: "500000.00".into(), currency: "RUB".into(), items: 1 }]);
        assert_eq!(cards[0].organization.as_deref(), Some("Northstar Labs"));
        assert_eq!(cards[0].people[0].role, "decision-maker");
        assert!(more);
        assert_eq!(movable, CrmMovable::Yes);
        let seen = seen.lock().unwrap();
        assert_eq!(seen[0], ["pipelines", "list", "--json", "--no-record", "--", "kind:deal"]);
        assert_eq!(seen[1], ["pipelines", "show", "pipeline:2", "--json", "--no-record"]);
        assert_eq!(
            seen[2],
            ["deals", "list", "--limit", "500", "--json", "--no-record", "--", "pipeline:\"pipeline:2\" status:open"]
        );
        assert_eq!(seen[3][3], "20");
        assert_eq!(seen[4].last().map(String::as_str), Some("pipeline:\"pipeline:2\" status:lost"));
    }

    #[test]
    fn opens_the_pipeline_with_the_most_open_cards_unless_one_still_listed_was_chosen() {
        let listed = |stages: [u32; 3]| -> Vec<CrmPipeline> {
            stages
                .iter()
                .enumerate()
                .filter_map(|(i, open)| {
                    pipeline(&json!({"ref": format!("pipeline:{i}"), "name": "P", "account": null,
                        "stages": [{"name": "A", "open": open}, {"name": "B", "open": 1}]}))
                })
                .collect()
        };
        let three = listed([0, 5, 5]);
        assert_eq!(three[1].open, 6);
        assert_eq!(busiest(&three).map(|p| p.reference.as_str()), Some("pipeline:1"));
        assert_eq!(busiest(&listed([0, 0, 0])).map(|p| p.reference.as_str()), Some("pipeline:0"));

        let seen = Mutex::new(vec![]);
        let gone = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, Some("pipeline:99"), &none).unwrap();
        let CrmRead::Ready { pipeline, .. } = gone else { panic!("not ready") };
        assert_eq!(pipeline.as_deref(), Some("pipeline:2"));
    }

    #[test]
    fn a_crm_pipeline_is_read_but_not_moved_from_the_app() {
        let seen = Mutex::new(vec![]);
        let read = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, Some("pipeline:7"), &none).unwrap();
        let CrmRead::Ready { pipeline, movable, .. } = read else { panic!("not ready") };
        assert_eq!(pipeline.as_deref(), Some("pipeline:7"));
        assert_eq!(movable, CrmMovable::No { why: "crmCli".into() });
    }

    #[test]
    fn a_crm_pipeline_moves_once_memo_names_its_cli_and_that_cli_can_write() {
        let portal = json!({"provider":"bitrix24","account":"northstar.example"});
        let listed = json!({"items":[{"ref":"pipeline:7","name":"Northstar sales","kind":"deal","account":portal,
            "stages":[],"writes_with":{"tool":"b24","account":portal,"profile":null,"profiles":["sales","work"],
            "why":"two b24 profiles are on this account; the owner chooses one"}}]});
        let seen = Mutex::new(vec![]);
        let call = |a: &[String]| if a[..2] == ["pipelines", "list"] { Ok(listed.clone()) } else { fake(&seen, a) };
        let b24 = crate::catalog::tool("bitrix").unwrap();
        let read = read_with(&call, CrmKind::Deal, None, &|_| writer::Writer::Ready(b24)).unwrap();
        let CrmRead::Ready { pipelines, movable, .. } = read else { panic!("not ready") };
        assert_eq!(movable, CrmMovable::Yes);
        let w = pipelines[0].writes_with.as_ref().unwrap();
        assert_eq!((w.profile.as_deref(), w.profiles.len()), (None, 2));
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
        let seen = seen.lock().unwrap();
        assert_eq!(seen[1], ["stages", "show", "deal", "--json", "--no-record"]);
        assert_eq!(seen[2], ["stages", "list", "--json", "--no-record", "--", "kind:deal"]);
        assert_eq!(seen[3], ["deals", "list", "--limit", "500", "--json", "--no-record", "--", "status:open"]);
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
