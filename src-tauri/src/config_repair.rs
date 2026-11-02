use crate::catalog::{ConfigRepairSource, Tool};
use crate::{redact, settings};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub line: Option<u64>,
    pub column: Option<u64>,
    pub what: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Repair {
    #[serde(rename_all = "camelCase")]
    Repaired { file: Option<String>, backup: Option<String>, changes: Vec<Change> },
    /// The tool would not change the file: it could not prove the fix safe. Its own words, masked.
    #[serde(rename_all = "camelCase")]
    Refused { message: String, file: Option<String>, line: Option<u64> },
}

fn source(tool: &Tool) -> Result<&ConfigRepairSource, String> {
    tool.config_repair.as_ref().ok_or_else(|| "This tool has no repair command.".into())
}

/// Whether the installed version lists `config repair` in `commands --json`; any failure means no.
pub fn supported(tool: &Tool, profile: Option<&str>) -> Result<bool, String> {
    let src = source(tool)?;
    let out = settings::run_tool(tool, &settings::args_for(&src.commands, profile)?)?;
    Ok(out.code == Some(0) && settings::parsed(&out).is_some_and(|v| lists_repair(&v["commands"])))
}

fn lists_repair(nodes: &Value) -> bool {
    nodes.as_array().into_iter().flatten().any(|n| {
        let path: Vec<&str> = n["path"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
        path == ["config", "repair"] || lists_repair(&n["commands"])
    })
}

pub fn repair(tool: &Tool, profile: Option<&str>) -> Result<Repair, String> {
    let src = source(tool)?;
    let out = settings::run_tool(tool, &settings::args_for(&src.run, profile)?)?;
    let json = settings::parsed(&out);
    match json.as_ref().and_then(outcome) {
        Some(r) => Ok(r),
        None => Err(settings::failure(&out, json.as_ref())),
    }
}

/// `{item: {repaired, file, backup, changes}}`, or the error envelope of a refusal (`details.file`, `details.line`).
fn outcome(v: &Value) -> Option<Repair> {
    let text = |x: &Value| x.as_str().map(redact::text);
    if let Some(item) = v.get("item") {
        if item["repaired"] == true {
            let changes = item["changes"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|c| {
                    Some(Change { line: c["line"].as_u64(), column: c["column"].as_u64(), what: text(&c["what"])? })
                })
                .collect();
            return Some(Repair::Repaired {
                file: text(&item["file"]).or_else(|| text(&item["path"])),
                backup: text(&item["backup"]),
                changes,
            });
        }
        if item["repaired"] == false {
            let message = text(&item["reason"]).or_else(|| text(&item["message"]))?;
            return Some(Repair::Refused { message, file: text(&item["file"]), line: item["line"].as_u64() });
        }
        return None;
    }
    let e = v.get("error")?;
    Some(Repair::Refused {
        message: text(&e["message"])?,
        file: text(&e["details"]["file"]),
        line: e["details"]["line"].as_u64(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn finds_config_repair_anywhere_in_the_command_tree() {
        let tree =
            json!([{"path": ["config"], "commands": [{"path": ["config", "show"]}, {"path": ["config", "repair"]}]}]);
        assert!(lists_repair(&tree));
        assert!(!lists_repair(&json!([{"path": ["config"], "commands": [{"path": ["config", "show"]}]}])));
        assert!(!lists_repair(&json!(null)));
    }

    #[test]
    fn reads_a_repair_with_its_changes_and_backup() {
        let v = json!({"item": {"repaired": true, "file": "/home/u/.config/tg-cli/config.json",
            "backup": "/home/u/.config/tg-cli/config.json.bak-20261102T180000Z",
            "changes": [{"line": 9, "column": 3, "what": "added a missing comma"}, {"what": 5}]}});
        let Some(Repair::Repaired { backup, changes, .. }) = outcome(&v) else { panic!("{v}") };
        assert!(backup.unwrap().ends_with("config.json.bak-20261102T180000Z"));
        assert_eq!(changes, vec![Change { line: Some(9), column: Some(3), what: "added a missing comma".into() }]);
    }

    #[test]
    fn reads_a_refusal_from_the_answer_or_the_error_envelope() {
        let answer =
            json!({"item": {"repaired": false, "reason": "cannot repair safely: two values on line 9", "line": 9}});
        assert!(matches!(outcome(&answer), Some(Repair::Refused { line: Some(9), .. })));
        let error = json!({"error": {"code": "invalid_config", "message": "cannot repair safely",
            "details": {"file": "/x/config.json", "line": 12}}});
        assert_eq!(
            outcome(&error),
            Some(Repair::Refused {
                message: "cannot repair safely".into(),
                file: Some("/x/config.json".into()),
                line: Some(12)
            })
        );
        assert_eq!(outcome(&json!({"item": {}})), None);
    }
}
