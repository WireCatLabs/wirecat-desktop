//! The one place that knows memo's base-stage commands and their JSON (cli-core #2720, store version 60): the argv of
//! `stages show|list|set|confirm|create|rename|move|remove` and the field names of their answers.

use super::{CrmBaseRef, CrmBaseStage, CrmKind, CrmStageMap, CrmUnsorted, count, text};
use crate::skills::body;
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

/// A base stage as memo takes it in a write: its `stage:<id>`, or its name while the set does not exist yet.
pub fn validate_base(stage: &str) -> Result<&str, String> {
    validate_stage_ref(stage).or_else(|_| super::validate_stage(stage))
}

pub fn validate_outcome(outcome: &str) -> Result<&str, String> {
    if OUTCOMES.contains(&outcome) { Ok(outcome) } else { Err(format!("not an outcome: {outcome}")) }
}

pub fn show_args(kind: CrmKind) -> Vec<String> {
    words(&["stages", "show", kind.noun()])
}

pub fn mapping_args(kind: CrmKind) -> Vec<String> {
    with_query(&["stages", "list"], &format!("kind:{}", kind.noun()))
}

pub fn set_args(stage: &str, base: &str) -> Vec<String> {
    words(&["stages", "set", stage, base])
}

/// One pipeline's suggestions, or every one of the kind (`--all` alone would confirm both kinds).
pub fn confirm_args(kind: CrmKind, pipeline: Option<&str>) -> Vec<String> {
    match pipeline {
        Some(p) => words(&["stages", "confirm", "--pipeline", p]),
        None => words(&["stages", "confirm", "--all", "--kind", kind.noun()]),
    }
}

pub fn add_args(kind: CrmKind, name: &str, outcome: &str) -> Vec<String> {
    words(&["stages", "create", kind.noun(), name, outcome])
}

pub fn rename_args(kind: CrmKind, stage: &str, name: &str) -> Vec<String> {
    words(&["stages", "rename", kind.noun(), stage, name])
}

pub fn move_args(kind: CrmKind, stage: &str, position: &str) -> Vec<String> {
    words(&["stages", "move", kind.noun(), stage, position])
}

pub fn remove_args(kind: CrmKind, stage: &str) -> Vec<String> {
    words(&["stages", "remove", kind.noun(), stage])
}

pub fn base_ref(v: &Value) -> Option<CrmBaseRef> {
    let b = v.get("base_stage")?;
    Some(CrmBaseRef { reference: text(b, "ref")?, name: text(b, "name")? })
}

fn column(v: &Value) -> Option<CrmBaseStage> {
    let name = text(v, "name")?;
    Some(CrmBaseStage {
        // Before the set exists memo answers it from memory with no refs; it takes a base stage by name as well, and
        // the first edit creates the set.
        reference: text(v, "ref").unwrap_or_else(|| name.clone()),
        name,
        outcome: text(v, "outcome")?,
        open: count(v, "open"),
        mapped: count(v, "mapped"),
    })
}

/// `stages show`: the base set in its own order, each with its open rows across every pipeline and account in scope
/// (confirmed mappings only), and what no column holds yet.
pub fn columns(v: &Value) -> (Vec<CrmBaseStage>, CrmUnsorted) {
    let item = body(v);
    let stages = item["stages"].as_array().map(|a| a.iter().filter_map(column).collect()).unwrap_or_default();
    let unsorted = &item["unsorted"];
    (stages, CrmUnsorted { open: count(unsorted, "open"), stages: count(unsorted, "stages") })
}

fn entry(v: &Value) -> Option<CrmStageMap> {
    Some(CrmStageMap {
        reference: text(v, "ref")?,
        name: text(v, "name")?,
        external_id: text(v, "external_id"),
        outcome: text(v, "outcome")?,
        pipeline: text(v, "pipeline")?,
        open: count(v, "open"),
        base: base_ref(v),
        confirmed: v["confirmed"].as_bool().unwrap_or(false),
    })
}

/// `stages list`: every CRM pipeline's stage with the base stage it points to, `None` while it points to none.
pub fn mapping(v: &Value) -> Vec<CrmStageMap> {
    v["items"].as_array().map(|a| a.iter().filter_map(entry).collect()).unwrap_or_default()
}
