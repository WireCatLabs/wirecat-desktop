//! The Clients page: deals and leads by stage through Memo's own `pipelines`, `deals` and `leads` commands, every CRM
//! account's copies and the owner's own. Titles, companies and names are the owner's own data on his own page, so
//! they are not masked (as on the Tasks page); they never go into a log or a report. Counts and sums per stage are
//! Memo's (`pipelines show`), never counted from the cards the page holds.
//!
//! A move writes through `memo <kind>s move`, which changes only what Memo itself keeps: a CRM's copy is changed in
//! the CRM by that CRM's own CLI, which the app cannot run yet, so such a pipeline answers `movable: no`.

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

#[derive(Serialize, Type, Debug, Clone, PartialEq)]
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
pub struct CrmStage {
    pub name: String,
    /// `open`, `won` or `lost`.
    pub outcome: String,
    /// Every deal or lead standing in it now, as Memo counts them.
    pub items: u32,
    pub amounts: Vec<CrmAmount>,
}

#[derive(Serialize, Type, Debug, PartialEq)]
pub struct CrmPipeline {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: String,
    /// The CRM account it was copied from; `None` for the owner's own.
    pub account: Option<CrmAccount>,
    /// Open deals or leads in all its stages, as memo counts them.
    pub open: u32,
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
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrmMovable {
    Yes,
    /// `crmCli`: a CRM's copy, which only that CRM's own CLI may change.
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

fn pipeline(v: &Value) -> Option<CrmPipeline> {
    let open = v["stages"].as_array().map_or(0, |a| a.iter().map(|st| count(st, "open")).sum());
    Some(CrmPipeline { reference: text(v, "ref")?, name: text(v, "name")?, account: account(v), open })
}

fn stage(v: &Value) -> Option<CrmStage> {
    let amounts = v["amounts"].as_array().map_or_else(Vec::new, |a| {
        a.iter()
            .filter_map(|x| {
                Some(CrmAmount { amount: text(x, "amount")?, currency: text(x, "currency")?, items: count(x, "items") })
            })
            .collect()
    });
    Some(CrmStage { name: text(v, "name")?, outcome: text(v, "outcome")?, items: count(v, "items"), amounts })
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
        created_at: text(v, "created_at").unwrap_or_default(),
        updated_at: text(v, "updated_at").unwrap_or_default(),
    })
}

fn movable(chosen: Option<&CrmPipeline>) -> CrmMovable {
    match chosen {
        Some(p) if p.account.is_some() => CrmMovable::No { why: "crmCli".into() },
        _ => CrmMovable::Yes,
    }
}

/// The pipeline with the most open cards, the first in memo's order on a tie: memo lists an empty one first as often
/// as not, and an empty board reads as "nothing synced".
fn busiest(pipelines: &[CrmPipeline]) -> Option<&CrmPipeline> {
    pipelines.iter().rev().max_by_key(|p| p.open)
}

fn read_with(call: &Call, kind: CrmKind, asked: Option<&str>) -> Result<CrmRead, Failure> {
    let listed = call(&with_query(&["pipelines", "list"], &format!("kind:{}", kind.noun())))?;
    let pipelines: Vec<CrmPipeline> =
        listed["items"].as_array().map(|a| a.iter().filter_map(pipeline).collect()).unwrap_or_default();
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
    // memo answers the newest of any status first, so a portal's years of closed deals would push the open ones out.
    let mut more = false;
    let mut cards = Vec::new();
    for (status, limit) in [("open", LIMIT), ("won", CLOSED), ("lost", CLOSED)] {
        let list = call(&with_query(
            &[kind.plural(), "list", "--limit", limit],
            &format!("pipeline:\"{}\" status:{status}", chosen.reference),
        ))?;
        more |= status == "open" && list["page"]["has_more"].as_bool().unwrap_or(false);
        cards.extend(list["items"].as_array().into_iter().flatten().filter_map(card));
    }
    Ok(CrmRead::Ready {
        pipeline: Some(chosen.reference.clone()),
        movable: movable(Some(chosen)),
        more,
        stages,
        cards,
        pipelines,
    })
}

fn gate() -> Result<Option<CrmRead>, String> {
    let need = crate::catalog::tool("memo")?
        .crm_board
        .as_ref()
        .ok_or("Memo has no Clients page in the catalog")?
        .min_version
        .clone();
    Ok(task_board::memo_unusable(&need)?.map(|u| match u {
        Unusable::Missing => CrmRead::Missing,
        Unusable::Old { version, need } => CrmRead::Old { version, need },
    }))
}

pub fn read(kind: CrmKind, pipeline: Option<&str>) -> Result<CrmRead, String> {
    if let Some(p) = pipeline {
        validate_pipeline(p)?;
    }
    if let Some(r) = gate()? {
        return Ok(r);
    }
    with_memo(READ, |call| read_with(call, kind, pipeline))
}

fn move_with(call: &Call, kind: CrmKind, reference: &str, stage: &str) -> Result<CrmCard, Failure> {
    validate_card(kind, reference).map_err(invalid)?;
    validate_stage(stage).map_err(invalid)?;
    let moved = call(&words(&[kind.plural(), "move", reference, stage]))?;
    card(body(&moved)).ok_or_else(|| invalid(format!("memo did not answer the moved {}", kind.noun())))
}

/// Moves the owner's own deal or lead; Memo refuses a CRM's copy itself ("change it there").
pub fn move_card(kind: CrmKind, reference: &str, stage: &str) -> Result<CrmCard, String> {
    with_memo(WRITE, |call| move_with(call, kind, reference, stage))
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
            {"name":"Quote","position":2,"outcome":"open","external_id":null,"open":1,"reached":2,"conversion":0.5,
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
        let read = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, None).unwrap();
        let CrmRead::Ready { pipelines, pipeline, stages, cards, more, movable } = read else { panic!("not ready") };
        assert_eq!(pipelines.len(), 2);
        assert_eq!(pipeline.as_deref(), Some("pipeline:2"));
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
        let gone = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, Some("pipeline:99")).unwrap();
        let CrmRead::Ready { pipeline, .. } = gone else { panic!("not ready") };
        assert_eq!(pipeline.as_deref(), Some("pipeline:2"));
    }

    #[test]
    fn a_crm_pipeline_is_read_but_not_moved_from_the_app() {
        let seen = Mutex::new(vec![]);
        let read = read_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, Some("pipeline:7")).unwrap();
        let CrmRead::Ready { pipeline, movable, .. } = read else { panic!("not ready") };
        assert_eq!(pipeline.as_deref(), Some("pipeline:7"));
        assert_eq!(movable, CrmMovable::No { why: "crmCli".into() });
    }

    #[test]
    fn a_move_names_the_card_and_the_stage_and_answers_the_card() {
        let seen = Mutex::new(vec![]);
        let moved = move_with(&|a: &[String]| fake(&seen, a), CrmKind::Deal, "deal:2", "Quote").unwrap();
        assert_eq!(moved.stage, "Quote");
        assert_eq!(seen.lock().unwrap()[0], ["deals", "move", "deal:2", "Quote", "--json", "--no-record"]);
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
