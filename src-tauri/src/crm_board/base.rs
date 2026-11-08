//! The one place that knows memo's base-stage commands and their JSON (cli-core TASK-947, not released yet): the argv
//! of `pipelines list --base`, `stages map list|set|confirm` and `stages base add|rename|move|remove`, and the field
//! names of their answers. The shapes follow the design; when cli-core's are final, only this file changes.

use super::{CrmAmount, CrmBaseRef, CrmBaseStage, CrmKind, CrmStageMap, count, text};
use crate::task_board::{with_query, words};
use serde_json::Value;

const STAGE: &str = "stage:";
const OUTCOMES: [&str; 3] = ["open", "won", "lost"];

/// A stage's ref as memo names it, base or CRM: checked before it reaches memo's argv.
pub fn validate_stage_ref(reference: &str) -> Result<&str, String> {
    let ok = reference
        .strip_prefix(STAGE)
        .is_some_and(|id| !id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()));
    if ok { Ok(reference) } else { Err(format!("not a stage: {reference}")) }
}

pub fn validate_outcome(outcome: &str) -> Result<&str, String> {
    if OUTCOMES.contains(&outcome) { Ok(outcome) } else { Err(format!("not an outcome: {outcome}")) }
}

pub fn columns_args(kind: CrmKind) -> Vec<String> {
    with_query(&["pipelines", "list", "--base"], &format!("kind:{}", kind.noun()))
}

pub fn mapping_args() -> Vec<String> {
    words(&["stages", "map", "list"])
}

pub fn set_args(stage: &str, base: &str) -> Vec<String> {
    words(&["stages", "map", "set", stage, base])
}

pub fn confirm_args(pipeline: &str) -> Vec<String> {
    words(&["stages", "map", "confirm", "--pipeline", pipeline])
}

pub fn add_args(kind: CrmKind, name: &str, outcome: &str) -> Vec<String> {
    words(&["stages", "base", "add", kind.noun(), name, "--outcome", outcome])
}

pub fn rename_args(kind: CrmKind, stage: &str, name: &str) -> Vec<String> {
    words(&["stages", "base", "rename", kind.noun(), stage, name])
}

pub fn move_args(kind: CrmKind, stage: &str, position: &str) -> Vec<String> {
    words(&["stages", "base", "move", kind.noun(), stage, position])
}

pub fn remove_args(kind: CrmKind, stage: &str) -> Vec<String> {
    words(&["stages", "base", "remove", kind.noun(), stage])
}

pub fn base_ref(v: &Value) -> Option<CrmBaseRef> {
    let b = v.get("base_stage")?;
    Some(CrmBaseRef { reference: text(b, "ref")?, name: text(b, "name")? })
}

fn column(v: &Value) -> Option<CrmBaseStage> {
    let amounts = v["amounts"].as_array().map_or_else(Vec::new, |a| {
        a.iter()
            .filter_map(|x| {
                Some(CrmAmount { amount: text(x, "amount")?, currency: text(x, "currency")?, items: count(x, "items") })
            })
            .collect()
    });
    Some(CrmBaseStage {
        reference: text(v, "ref")?,
        name: text(v, "name")?,
        outcome: text(v, "outcome")?,
        items: count(v, "items"),
        amounts,
    })
}

/// The base set in its own order, each with its count and sums across every pipeline and account.
pub fn columns(v: &Value) -> Vec<CrmBaseStage> {
    v["items"].as_array().map(|a| a.iter().filter_map(column).collect()).unwrap_or_default()
}

fn entry(v: &Value) -> Option<CrmStageMap> {
    Some(CrmStageMap {
        reference: text(v, "ref")?,
        name: text(v, "name")?,
        outcome: text(v, "outcome")?,
        pipeline: text(v, "pipeline")?,
        items: count(v, "items"),
        base: base_ref(v),
        confirmed: v["base_confirmed"].as_bool().unwrap_or(false),
    })
}

/// Every CRM stage with the base stage it points to, `None` while it points to none.
pub fn mapping(v: &Value) -> Vec<CrmStageMap> {
    v["items"].as_array().map(|a| a.iter().filter_map(entry).collect()).unwrap_or_default()
}
