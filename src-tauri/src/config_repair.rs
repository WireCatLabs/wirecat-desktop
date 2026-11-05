use crate::catalog::Tool;
use crate::{redact, settings};
use serde::Serialize;
use serde_json::Value;

/// One mend, by line and kind (`trailing_comma`, `missing_comma`…); cli-core never prints a value.
#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename = "RepairChange")]
pub struct Change {
    pub line: Option<u64>,
    pub kind: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Repair {
    #[serde(rename_all = "camelCase")]
    Repaired { file: Option<String>, backup: Option<String>, changes: Vec<Change> },
    /// `nothing to repair` or `no settings file`: the file was already valid, or is gone.
    #[serde(rename_all = "camelCase")]
    Unchanged { reason: String },
    /// `config.unrepairable`: no fix was certain, so nothing changed. Where the tool gave up.
    #[serde(rename_all = "camelCase")]
    Refused { message: Option<String>, file: Option<String>, line: Option<u64>, column: Option<u64> },
}

pub fn repair(tool: &Tool, profile: Option<&str>) -> Result<Repair, String> {
    let words = tool.config_repair.as_ref().ok_or("This tool has no repair command.")?;
    let out = settings::run_tool(tool, &settings::args_for(words, profile)?)?;
    let json = settings::parsed(&out);
    match json.as_ref().and_then(outcome) {
        Some(r) => Ok(r),
        None => Err(settings::failure(&out, json.as_ref())),
    }
}

/// `{item: {repaired, file, backup, changes, reason}}` on stdout, or on stderr (exit 3)
/// `{error: {code: "configuration_error", reason: "config.unrepairable", details: {file, line, column}}}`.
fn outcome(v: &Value) -> Option<Repair> {
    let text = |x: &Value| x.as_str().map(redact::text);
    if let Some(item) = v.get("item") {
        if item["repaired"] == true {
            let changes = item["changes"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|c| Some(Change { line: c["line"].as_u64(), kind: kind(&c["kind"])? }))
                .collect();
            return Some(Repair::Repaired { file: text(&item["file"]), backup: text(&item["backup"]), changes });
        }
        return Some(Repair::Unchanged { reason: text(&item["reason"])? });
    }
    let e = v.get("error")?;
    if e["reason"] != "config.unrepairable" {
        return None;
    }
    let d = &e["details"];
    Some(Repair::Refused {
        message: text(&e["message"]),
        file: text(&d["file"]),
        line: d["line"].as_u64(),
        column: d["column"].as_u64(),
    })
}

/// A kind is an identifier; anything else is dropped rather than shown.
fn kind(v: &Value) -> Option<String> {
    v.as_str()
        .filter(|k| !k.is_empty() && k.len() <= 40 && k.chars().all(|c| c.is_ascii_lowercase() || c == '_'))
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_a_repair_with_its_kinds_and_backup() {
        let v = json!({"item": {"file": "/home/u/.config/tg-cli/config.json", "found": true, "repaired": true,
            "dry_run": false, "backup": "/home/u/.config/tg-cli/config.json.bak-20261102T180000Z",
            "changes": [{"line": 9, "kind": "missing_comma"}, {"line": 1, "kind": "byte_order_mark"},
                        {"line": 2, "kind": "Not A Kind"}]}});
        let Some(Repair::Repaired { backup, changes, .. }) = outcome(&v) else { panic!("{v}") };
        assert!(backup.unwrap().ends_with("config.json.bak-20261102T180000Z"));
        assert_eq!(
            changes,
            vec![
                Change { line: Some(9), kind: "missing_comma".into() },
                Change { line: Some(1), kind: "byte_order_mark".into() },
            ]
        );
    }

    #[test]
    fn reads_nothing_to_repair() {
        let v = json!({"item": {"file": "/x/config.json", "found": true, "repaired": false, "reason": "nothing to repair"}});
        assert_eq!(outcome(&v), Some(Repair::Unchanged { reason: "nothing to repair".into() }));
    }

    #[test]
    fn reads_the_refusal_cli_core_prints_on_stderr() {
        let e = json!({"error": {"code": "configuration_error", "reason": "config.unrepairable",
            "message": "two entries on one line", "details": {"file": "/x/config.json", "line": 12, "column": 7}}});
        assert_eq!(
            outcome(&e),
            Some(Repair::Refused {
                message: Some("two entries on one line".into()),
                file: Some("/x/config.json".into()),
                line: Some(12),
                column: Some(7),
            })
        );
        let other = json!({"error": {"code": "validation_error", "message": "unknown command 'repair'"}});
        assert_eq!(outcome(&other), None, "any other error is a failure, in the tool's words");
    }
}
