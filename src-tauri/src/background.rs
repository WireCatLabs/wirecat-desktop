//! Whether a messenger's own `serve` keeps its archive current in the background, and starting it through the tool's
//! own `server install` and `server start` for one profile. Nothing here writes a unit file or calls systemctl.

use crate::catalog::{self, Tool};
use crate::skills::{body, call, failure};
use crate::{paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundSource {
    pub status: Vec<String>,
    pub install: Vec<String>,
    pub start: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum Background {
    Running,
    /// `unit`: whether a systemd unit or launchd agent is written; `None` where the tool reports none.
    Stopped {
        unit: Option<bool>,
    },
    /// A tool too old to have `server`, or an answer in another shape: the page says nothing.
    Unknown,
}

fn source(tool: &Tool) -> Result<&BackgroundSource, String> {
    tool.background.as_ref().ok_or_else(|| format!("{} has no background server", tool.name))
}

pub fn status(tool: &Tool, profile: &str) -> Result<Background, String> {
    let args = catalog::with_profile(&source(tool)?.status, Some(profile))?;
    let (out, json) = call(tool, &args, Duration::from_secs(30))?;
    Ok(match json {
        Some(v) if out.code == Some(0) => read(&v),
        _ => Background::Unknown,
    })
}

fn read(v: &Value) -> Background {
    let item = body(v);
    match item.get("running").and_then(Value::as_bool) {
        Some(true) => Background::Running,
        Some(false) => {
            Background::Stopped { unit: item.get("unit").and_then(|u| u.get("installed")).and_then(Value::as_bool) }
        }
        None => Background::Unknown,
    }
}

/// Writes the unit first when the tool says it has none, so the server runs under it, then starts it. The tool waits
/// for the connection, which a signed-out profile never makes; its own words come back, masked.
pub fn keep(tool: &Tool, profile: &str) -> Result<Background, String> {
    let src = source(tool)?;
    if status(tool, profile)? == (Background::Stopped { unit: Some(false) }) {
        let args = catalog::with_profile(&src.install, Some(profile))?;
        let (out, json) = call(tool, &args, Duration::from_secs(30))?;
        if out.code != Some(0) {
            return Err(failure(&out, json.as_ref()));
        }
    }
    let args = catalog::with_profile(&src.start, Some(profile))?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let mut cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    // Without a unit the server outlives this call as the tool's own process; it must not file its runs as Desktop's.
    cmd.env_remove(run::CALLER_ENV);
    let out = run::run_command(cmd, Duration::from_mins(2)).map_err(|e| e.to_string())?;
    if out.code != Some(0) {
        return Err(failure(&out, out.json().as_ref()));
    }
    status(tool, profile)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_a_stopped_unit_and_a_running_server() {
        let tg = json!({"item": {"profile": "personal", "running": false, "unit": {
            "name": "tg-serve-personal.service", "installed": true, "loaded": true, "active": false,
            "detail": "inactive (dead)"}}});
        assert_eq!(read(&tg), Background::Stopped { unit: Some(true) });
        let none = json!({"item": {"running": false, "unit": {"installed": false}}});
        assert_eq!(read(&none), Background::Stopped { unit: Some(false) });
        let wa = json!({"item": {"profile": "personal", "running": true, "pid": 20198, "by": "unit",
            "unit": {"installed": true, "active": true}}});
        assert_eq!(read(&wa), Background::Running);
        assert_eq!(read(&json!({"item": {"running": false}})), Background::Stopped { unit: None });
        assert_eq!(read(&json!({"items": []})), Background::Unknown);
    }

    #[test]
    fn runs_the_messengers_own_commands_for_the_chosen_profile() {
        for id in ["tg", "max", "wa"] {
            let src = source(catalog::tool(id).unwrap()).unwrap();
            let words = |a: &[String]| catalog::with_profile(a, Some("personal")).unwrap().join(" ");
            assert_eq!(words(&src.status), "personal server status --no-record --json");
            assert_eq!(words(&src.install), "personal server install --json");
            assert_eq!(words(&src.start), "personal server start --json");
            assert!(catalog::with_profile(&src.start, Some("--all")).is_err());
        }
        assert!(source(catalog::tool("zm").unwrap()).is_err());
    }
}
