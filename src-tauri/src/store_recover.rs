use crate::catalog::{self, Tool};
use crate::{paths, redact, run, settings};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// The commands of the last report, unmasked, so a step runs as the tool wrote it while the interface names it only
/// by its place in the list (rule 2).
fn last() -> &'static Mutex<HashMap<String, Vec<Option<Command>>>> {
    static S: OnceLock<Mutex<HashMap<String, Vec<Option<Command>>>>> = OnceLock::new();
    S.get_or_init(Mutex::default)
}

#[derive(Clone, Debug, PartialEq)]
enum Command {
    /// The tool's own command, without its name.
    Own(Vec<String>),
    /// `systemctl --user stop` of the tools' own timers and servers, so nothing writes during the recovery.
    StopUnits(Vec<String>),
    /// The report's own last step, `<tool> store recover`: the interface checks again instead.
    CheckAgain,
}

/// `store recover` reads every page of the store: about 30 s for 6 GB.
const CHECK_TIMEOUT: Duration = Duration::from_mins(5);
/// A step can rebuild an index or re-embed text, which takes long on a large store.
const STEP_TIMEOUT: Duration = Duration::from_mins(30);

/// The damage report, masked, each step marked `runnable`; `None` when the store is healthy or the tool is older than
/// the report, and the interface then shows what doctor said.
pub fn report(tool: &Tool) -> Result<Option<Value>, String> {
    let Some(args) = tool.store_recover.as_ref() else { return Ok(None) };
    // Exit 1 means damaged, so the answer is read whatever the code.
    let out = settings::run_tool_for(tool, args, CHECK_TIMEOUT)?;
    let json = out.json();
    let Some(found) = json.as_ref().and_then(damage_of) else {
        if json.as_ref().is_some_and(|v| v["item"].is_object() || unknown_command(v)) {
            return Ok(None);
        }
        return Err(settings::failure(&out, json.as_ref()));
    };
    let (shown, commands) = marked(tool, found);
    last().lock().unwrap_or_else(std::sync::PoisonError::into_inner).insert(tool.id.clone(), commands);
    Ok(Some(shown))
}

/// Runs one step of the last report; only a step it marked `runnable`.
pub fn run_step(tool: &Tool, index: usize) -> Result<(), String> {
    let command = last()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .get(&tool.id)
        .and_then(|c| c.get(index).cloned())
        .ok_or("Check the store again: this step is no longer in its report.")?
        .ok_or("This step is not one the app runs; copy it and run it in a terminal.")?;
    let _paused = crate::memo_server::pause();
    let out = match command {
        Command::CheckAgain => return Ok(()),
        Command::Own(args) => settings::run_tool_for(tool, &args, STEP_TIMEOUT)?,
        Command::StopUnits(units) => {
            let bin = paths::find_all("systemctl").into_iter().next().ok_or("systemctl is not on this computer")?;
            let mut args = vec!["--user", "stop"];
            args.extend(units.iter().map(String::as_str));
            run::run(&bin, &args, Some(&paths::search_path()), STEP_TIMEOUT).map_err(|e| e.to_string())?
        }
    };
    if out.code == Some(0) { Ok(()) } else { Err(settings::failure(&out, out.json().as_ref())) }
}

fn unknown_command(v: &Value) -> bool {
    v["error"]["message"].as_str().is_some_and(|m| m.starts_with("unknown command"))
}

fn damage_of(v: &Value) -> Option<&Value> {
    let report = &v["item"]["report"];
    report["steps"].is_array().then_some(report)
}

fn marked(tool: &Tool, report: &Value) -> (Value, Vec<Option<Command>>) {
    let mut shown = report.clone();
    let mut commands = Vec::new();
    for step in shown["steps"].as_array_mut().into_iter().flatten() {
        // A step not marked safe is treated as destructive.
        let safe = step["destructive"] == false;
        let command = step["command"].as_str().filter(|_| safe).and_then(|line| runnable(tool, line));
        step["runnable"] = Value::Bool(command.is_some());
        commands.push(command);
    }
    redact::json(&mut shown);
    (shown, commands)
}

fn plain(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':' | '=' | '/')
}

/// Plain words only, so no line reaches a shell: a pipe, a quote or a `<profile>` placeholder is copied instead.
fn runnable(tool: &Tool, line: &str) -> Option<Command> {
    let words: Vec<&str> = line.split_whitespace().collect();
    if !words.iter().all(|w| w.chars().all(plain)) {
        return None;
    }
    match words.as_slice() {
        [bin, "store", "recover"] if *bin == tool.bin => Some(Command::CheckAgain),
        [bin, rest @ ..] if *bin == tool.bin && !rest.is_empty() && !rest[0].starts_with('-') => {
            Some(Command::Own(rest.iter().map(ToString::to_string).collect()))
        }
        ["systemctl", "--user", "stop", units @ ..] if !units.is_empty() && units.iter().all(|u| own_unit(u)) => {
            Some(Command::StopUnits(units.iter().map(ToString::to_string).collect()))
        }
        _ => None,
    }
}

/// A timer or server one of the tools installed: named after a catalog tool's command, `mail-sync.timer`.
fn own_unit(unit: &str) -> bool {
    let Some(name) = unit.strip_suffix(".timer").or_else(|| unit.strip_suffix(".service")) else { return false };
    catalog::catalog()
        .tools
        .iter()
        .any(|t| name.strip_prefix(t.bin.as_str()).is_some_and(|rest| rest.starts_with('-') && rest.len() > 1))
        || name.starts_with("wirecat-")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tg() -> &'static Tool {
        catalog::tool("tg").unwrap()
    }

    fn answer() -> Value {
        json!({"item": {"exists": true, "ok": false, "next": [], "report": {
            "what_happened": "the store file is damaged: 3 problems in the search data of email_words",
            "likely_causes": [{"cause": "a fault of the disk itself", "check": "df -h /home/slava/.local/share/WireCat"}],
            "impact": ["searches may miss results or fail"],
            "external_data_safe": "only this computer's copy is damaged",
            "last_ok_at": null,
            "loss": "how many rows were lost is unknown",
            "steps": [
                {"command": "systemctl --user stop mail-sync.timer tg-serve-personal.service", "why": "w", "destructive": false},
                {"command": "kill 4242", "why": "wa has the store open", "destructive": true},
                {"command": "tg store recover run", "why": "r", "destructive": true},
                {"command": "tg <profile> sync", "why": "s", "destructive": false},
                {"command": "tg store rebuild search", "why": "s", "destructive": false},
                {"command": "tg store recover", "why": "c", "destructive": false},
            ],
        }}})
    }

    #[test]
    fn marks_only_safe_plain_steps_runnable_and_masks_the_rest() {
        let v = answer();
        let (shown, commands) = marked(tg(), damage_of(&v).unwrap());
        let runnable: Vec<bool> = shown["steps"].as_array().unwrap().iter().map(|s| s["runnable"] == true).collect();
        assert_eq!(runnable, [true, false, false, false, true, true]);
        assert_eq!(commands[4], Some(Command::Own(vec!["store".into(), "rebuild".into(), "search".into()])));
        assert_eq!(commands[5], Some(Command::CheckAgain));
        assert!(!shown["likely_causes"][0]["check"].as_str().unwrap().contains("slava"));
    }

    #[test]
    fn a_healthy_store_or_an_older_tool_has_no_report() {
        assert!(damage_of(&json!({"item": {"exists": true, "ok": true, "report": null}})).is_none());
        assert!(damage_of(&json!({"item": {"exists": true, "ok": false, "explanation": {"what": "x"}}})).is_none());
    }

    #[test]
    fn stops_only_the_tools_own_units() {
        assert!(own_unit("memo-import.timer"));
        assert!(own_unit("wirecat-live.service"));
        assert!(!own_unit("memo.timer"));
        assert!(!own_unit("ssh.service"));
        assert!(!own_unit("mail-sync"));
        assert_eq!(runnable(tg(), "systemctl --user stop ssh.service"), None);
        assert_eq!(runnable(tg(), "systemctl stop tg-sync.timer"), None);
        assert_eq!(runnable(tg(), "max store rebuild"), None);
        assert_eq!(runnable(tg(), "tg --help"), None);
        assert_eq!(runnable(tg(), "tg store rebuild; rm -rf ~"), None);
    }
}
