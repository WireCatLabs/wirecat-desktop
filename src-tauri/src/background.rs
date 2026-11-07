//! A messenger's own `serve` in the background, per profile: whether it runs, and starting, stopping, installing and
//! removing it through the tool's own `server` commands. Nothing here writes a unit file or calls systemctl.

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
    pub stop: Vec<String>,
    pub uninstall: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum Background {
    /// `connected`: whether serve has reached the messenger yet, `None` where the tool does not say.
    #[serde(rename_all = "camelCase")]
    Running { connected: Option<bool>, starts_at_login: Option<bool> },
    /// `unit`: whether a systemd unit or launchd agent is written; `stopped_for`: the tool's reason id when it gave up
    /// and will not restart by itself (`authentication_error`).
    #[serde(rename_all = "camelCase")]
    Stopped { unit: Option<bool>, starts_at_login: Option<bool>, stopped_for: Option<String> },
    /// A tool too old to have `server`, or an answer in another shape: the page says nothing.
    Unknown,
}

/// What the interface may ask. Each maps to words in the catalog; nothing else reaches a shell.
#[derive(specta::Type, Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundAction {
    /// Writes the unit when there is none (or it does not start at login), then starts.
    Keep,
    Start,
    Stop,
    /// Stops first when it runs, then removes the unit.
    Uninstall,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundFaultKind {
    /// `systemctl --user` or `launchctl` did not answer.
    ManagerMissing,
    /// Another process holds the account's one connection.
    LoginInUse,
    /// The login is gone or was never made.
    NotSignedIn,
    /// The tool has no `server` command yet.
    TooOld,
    Permission,
    Other,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
pub struct BackgroundFault {
    pub kind: BackgroundFaultKind,
    /// The tool's own words, masked.
    pub message: String,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
pub struct BackgroundOutcome {
    pub state: Background,
    pub fault: Option<BackgroundFault>,
}

fn source(tool: &Tool) -> Result<&BackgroundSource, String> {
    tool.background.as_ref().ok_or_else(|| format!("{} has no background server", tool.name))
}

fn words(src: &BackgroundSource, action: BackgroundAction) -> &[String] {
    match action {
        BackgroundAction::Keep => &src.install,
        BackgroundAction::Start => &src.start,
        BackgroundAction::Stop => &src.stop,
        BackgroundAction::Uninstall => &src.uninstall,
    }
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
    let starts_at_login = item.get("starts_at_login").and_then(Value::as_bool);
    match item.get("running").and_then(Value::as_bool) {
        Some(true) => {
            Background::Running { connected: item.get("connected").and_then(Value::as_bool), starts_at_login }
        }
        Some(false) => Background::Stopped {
            unit: item.get("unit").and_then(|u| u.get("installed")).and_then(Value::as_bool),
            starts_at_login,
            stopped_for: item.get("stopped").and_then(|s| s.get("reason")).and_then(Value::as_str).map(str::to_string),
        },
        None => Background::Unknown,
    }
}

/// Sorts a failed `server` command by what the owner can do about it. The tool's words are matched, not its exit
/// code, because every failure of the service manager comes back as the same `configuration_error`.
fn classify(out: &run::Output, json: Option<&Value>) -> BackgroundFault {
    let message = failure(out, json);
    let said = message.to_lowercase();
    let code = json.and_then(|v| v["error"]["code"].as_str()).unwrap_or("");
    let has = |needles: &[&str]| needles.iter().any(|n| said.contains(n));
    let kind = if has(&["unknown command", "unknown option", "too many arguments"]) {
        BackgroundFaultKind::TooOld
    } else if has(&["permission denied", "eacces", "eperm", "read-only file system", "access is denied"]) {
        BackgroundFaultKind::Permission
    } else if code == "authentication_error" || has(&["not logged in", "login is no longer valid", "not signed in"]) {
        BackgroundFaultKind::NotSignedIn
    } else if has(&["in use", "already connected", "another connection", "held by"]) {
        BackgroundFaultKind::LoginInUse
    } else if has(&["systemctl", "launchctl", "failed to connect to bus", "no medium found", "schtasks", "dbus"]) {
        BackgroundFaultKind::ManagerMissing
    } else {
        BackgroundFaultKind::Other
    };
    BackgroundFault { kind, message }
}

fn exec(tool: &Tool, args: &[String], timeout: Duration) -> Result<(), BackgroundFault> {
    let other = |message: String| BackgroundFault { kind: BackgroundFaultKind::Other, message };
    let bin = crate::tools::program(&tool.bin).ok_or_else(|| other("the tool is not installed".into()))?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let mut cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    // Without a unit the server outlives this call as the tool's own process; it must not file its runs as Desktop's.
    cmd.env_remove(run::CALLER_ENV);
    let out = run::run_command(cmd, timeout).map_err(|e| other(e.to_string()))?;
    if out.code == Some(0) {
        return Ok(());
    }
    Err(classify(&out, out.json().as_ref()))
}

fn step(
    tool: &Tool,
    src: &BackgroundSource,
    action: BackgroundAction,
    profile: &str,
    timeout: Duration,
) -> Result<(), BackgroundFault> {
    let args = catalog::with_profile(words(src, action), Some(profile))
        .map_err(|message| BackgroundFault { kind: BackgroundFaultKind::Other, message })?;
    exec(tool, &args, timeout)
}

/// The tool waits for the connection on `start`, which a signed-out profile never makes; its own words come back.
fn act(
    tool: &Tool,
    src: &BackgroundSource,
    profile: &str,
    action: BackgroundAction,
    before: &Background,
) -> Result<(), BackgroundFault> {
    let run = Duration::from_mins(2);
    let quick = Duration::from_secs(30);
    match action {
        BackgroundAction::Keep => {
            let needs_unit = matches!(
                before,
                Background::Stopped { unit: Some(false), .. }
                    | Background::Stopped { starts_at_login: Some(false), .. }
            ) || matches!(before, Background::Running { starts_at_login: Some(false), .. });
            if needs_unit {
                step(tool, src, BackgroundAction::Keep, profile, quick)?;
            }
            if matches!(before, Background::Running { .. }) {
                return Ok(());
            }
            step(tool, src, BackgroundAction::Start, profile, run)
        }
        BackgroundAction::Start => step(tool, src, BackgroundAction::Start, profile, run),
        BackgroundAction::Stop => step(tool, src, BackgroundAction::Stop, profile, quick),
        BackgroundAction::Uninstall => {
            if matches!(before, Background::Running { .. }) {
                step(tool, src, BackgroundAction::Stop, profile, quick)?;
            }
            step(tool, src, BackgroundAction::Uninstall, profile, quick)
        }
    }
}

/// Runs one action for one profile and reads the state again; a failure comes back as data with the state after it.
pub fn run_action(tool: &Tool, profile: &str, action: BackgroundAction) -> Result<BackgroundOutcome, String> {
    let src = source(tool)?;
    let before = status(tool, profile)?;
    let fault = act(tool, src, profile, action, &before).err();
    Ok(BackgroundOutcome { state: status(tool, profile)?, fault })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn failed(message: &str, code: &str) -> BackgroundFault {
        let v = json!({"error": {"code": code, "message": message}});
        let out = run::Output { code: Some(1), stdout: String::new(), stderr: v.to_string() };
        classify(&out, Some(&v))
    }

    #[test]
    fn reads_a_stopped_unit_and_a_running_server() {
        let tg = json!({"item": {"profile": "personal", "running": false, "starts_at_login": true, "unit": {
            "name": "tg-serve-personal.service", "installed": true, "loaded": true, "active": false,
            "detail": "inactive (dead)"}}});
        let stopped = |unit, login| Background::Stopped { unit, starts_at_login: login, stopped_for: None };
        assert_eq!(read(&tg), stopped(Some(true), Some(true)));
        let none = json!({"item": {"running": false, "unit": {"installed": false}}});
        assert_eq!(read(&none), stopped(Some(false), None));
        let wa = json!({"item": {"profile": "personal", "running": true, "connected": false, "pid": 20198,
            "by": "unit", "starts_at_login": false, "unit": {"installed": true, "active": true}}});
        assert_eq!(read(&wa), Background::Running { connected: Some(false), starts_at_login: Some(false) });
        assert_eq!(read(&json!({"item": {"running": false}})), stopped(None, None));
        assert_eq!(read(&json!({"items": []})), Background::Unknown);
    }

    #[test]
    fn a_server_that_gave_up_says_why() {
        let v = json!({"item": {"running": false, "stopped": {"exit_code": 4, "reason": "authentication_error",
            "restarts": false}, "unit": {"installed": true}}});
        assert_eq!(
            read(&v),
            Background::Stopped {
                unit: Some(true),
                starts_at_login: None,
                stopped_for: Some("authentication_error".into())
            }
        );
    }

    #[test]
    fn runs_the_messengers_own_commands_for_the_chosen_profile() {
        for id in ["tg", "max", "wa"] {
            let src = source(catalog::tool(id).unwrap()).unwrap();
            let line = |a: BackgroundAction| catalog::with_profile(words(src, a), Some("personal")).unwrap().join(" ");
            assert_eq!(
                catalog::with_profile(&src.status, Some("personal")).unwrap().join(" "),
                "personal server status --no-record --json"
            );
            assert_eq!(line(BackgroundAction::Keep), "personal server install --json");
            assert_eq!(line(BackgroundAction::Start), "personal server start --json");
            assert_eq!(line(BackgroundAction::Stop), "personal server stop --json");
            assert_eq!(line(BackgroundAction::Uninstall), "personal server uninstall --json");
            assert!(catalog::with_profile(&src.start, Some("--all")).is_err());
        }
        assert!(source(catalog::tool("zm").unwrap()).is_err());
    }

    #[test]
    fn sorts_failures_by_what_the_owner_can_do() {
        let kind = |m: &str, c: &str| failed(m, c).kind;
        assert_eq!(
            kind("systemctl --user enable x failed: Failed to connect to bus", "configuration_error"),
            BackgroundFaultKind::ManagerMissing
        );
        assert_eq!(kind("login in use by wa serve", "conflict"), BackgroundFaultKind::LoginInUse);
        assert_eq!(kind("profile \"work\" is not logged in", "authentication_error"), BackgroundFaultKind::NotSignedIn);
        assert_eq!(kind("unknown command 'server'", "usage_error"), BackgroundFaultKind::TooOld);
        assert_eq!(kind("EACCES: permission denied, open '/etc/x'", "internal_error"), BackgroundFaultKind::Permission);
        assert_eq!(kind("serve is running but not connected yet", "timeout"), BackgroundFaultKind::Other);
    }
}
