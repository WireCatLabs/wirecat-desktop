//! A check of an installed app with no window, for `.github/workflows/install-check.yml`: it installs a catalog tool
//! through the same `install::install` the Tools page calls, setting up the app's own Node.js first when asked, then
//! runs the installed program. It prints one JSON line and exits 0 when everything worked, 1 when a step failed and 2
//! when it was refused or misused.
//!
//! `WIRECAT_SELF_TEST=1 wirecat-desktop --self-test install-tool <id or name> [--own-node]`
//! `WIRECAT_SELF_TEST=1 wirecat-desktop --self-test version`

use crate::community::Source;
use crate::install::{self, Running};
use crate::{catalog, node, paths, run, system};
use serde::Serialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{Channel, InvokeResponseBody};

pub const ENV: &str = "WIRECAT_SELF_TEST";
const FLAG: &str = "--self-test";
const RUN_TIMEOUT: Duration = Duration::from_mins(1);

#[derive(Debug, PartialEq)]
enum Asked {
    Nothing,
    Refused(String),
    Usage(String),
    Version,
    InstallTool { tool: String, own_node: bool },
}

/// Only the first argument counts, so a `wirecat://` link or a file the system passes can never start it, and only
/// with the variable set as well.
fn parse(args: &[String], env: Option<&str>) -> Asked {
    if args.first().map(String::as_str) != Some(FLAG) {
        return Asked::Nothing;
    }
    if env != Some("1") {
        return Asked::Refused(format!("{FLAG} runs only with {ENV}=1 set."));
    }
    match &args[1..] {
        [what] if what == "version" => Asked::Version,
        [what, tool, rest @ ..] if what == "install-tool" && !tool.starts_with('-') => match rest {
            [] => Asked::InstallTool { tool: tool.clone(), own_node: false },
            [flag] if flag == "--own-node" => Asked::InstallTool { tool: tool.clone(), own_node: true },
            _ => Asked::Usage(format!("Unknown options: {}.", rest.join(" "))),
        },
        _ => Asked::Usage(format!("Usage: {FLAG} install-tool <tool> [--own-node] | {FLAG} version")),
    }
}

/// The exit code when the app was started as a self-test, `None` for a normal start.
pub fn from_command_line() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match parse(&args, std::env::var(ENV).ok().as_deref()) {
        Asked::Nothing => return None,
        Asked::Refused(why) => {
            eprintln!("[wirecat] {why}");
            2
        }
        Asked::Usage(why) => {
            print_line(&Report::new().fail("arguments", None, why, None));
            2
        }
        Asked::Version => {
            print_line(&Report { ok: true, ..Report::new() });
            0
        }
        Asked::InstallTool { tool, own_node } => {
            let report = install_tool(&tool, own_node);
            print_line(&report);
            i32::from(!report.ok)
        }
    };
    Some(code)
}

fn print_line(report: &Report) {
    println!("{}", serde_json::to_string(report).unwrap_or_default());
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Report {
    ok: bool,
    app: &'static str,
    os: &'static str,
    arch: &'static str,
    node: Option<NodeReport>,
    tool: Option<ToolReport>,
    steps: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure: Option<FailureReport>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct NodeReport {
    /// `own` for the Node.js the app set up, `system` for any other.
    source: &'static str,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ToolReport {
    id: String,
    package: String,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct FailureReport {
    step: String,
    reason: Option<Value>,
    message: String,
    hint: Option<String>,
}

impl Report {
    fn new() -> Self {
        Report {
            ok: false,
            app: env!("CARGO_PKG_VERSION"),
            os: std::env::consts::OS,
            arch: std::env::consts::ARCH,
            node: None,
            tool: None,
            steps: Vec::new(),
            failure: None,
        }
    }

    fn fail(mut self, step: &str, reason: Option<Value>, message: String, hint: Option<String>) -> Self {
        self.ok = false;
        self.failure = Some(FailureReport { step: step.into(), reason, message, hint });
        self
    }
}

fn install_tool(name: &str, own_node: bool) -> Report {
    let mut report = Report::new();
    let tool = match resolve(name) {
        Ok(tool) => tool,
        Err(why) => return report.fail("arguments", None, why, None),
    };
    report.tool = Some(ToolReport { id: tool.id.clone(), package: tool.package.clone(), version: None, path: None });
    let running = Running::default();

    report.steps.push("node:ready".into());
    let mut ready = system::readiness();
    if !ready.node.ok {
        let problem = ready.node.problem.clone().unwrap_or_else(|| "is missing".into());
        if !own_node {
            return report.fail(
                "node:ready",
                Some("requirements".into()),
                format!("Node.js {problem}."),
                Some("Pass --own-node to let WireCat set up its own Node.js, as the Tools page offers.".into()),
            );
        }
        let events = Mutex::new(Vec::new());
        node::set_up(&running, &|e| events.lock().unwrap().push(serde_json::to_value(e).unwrap_or_default()));
        let events = events.into_inner().unwrap();
        report.steps.extend(steps("node", &events));
        if let Some(failed) = events.iter().find(|e| e["event"] == "failed") {
            return report.fail_with("node:setup", failed);
        }
        ready = system::readiness();
        if !ready.node.ok {
            let problem = ready.node.problem.clone().unwrap_or_default();
            return report.fail("node:setup", None, format!("Node.js {problem} after its setup."), None);
        }
    }
    report.node = Some(NodeReport {
        source: if node::in_use().is_some() { "own" } else { "system" },
        version: ready.node.version.clone(),
        path: ready.node.path.clone(),
    });

    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&events);
    let channel = Channel::new(move |body| {
        if let InvokeResponseBody::Json(json) = body {
            sink.lock().unwrap().push(serde_json::from_str(&json).unwrap_or(Value::Null));
        }
        Ok(())
    });
    install::install(tool, &running, &channel);
    let events = std::mem::take(&mut *events.lock().unwrap());
    report.steps.extend(steps("install", &events));
    let Some(done) = events.iter().find(|e| e["event"] == "done") else {
        let failed = events.iter().find(|e| e["event"] == "failed").cloned().unwrap_or_default();
        return report.fail_with("install", &failed);
    };
    let version = done["version"].as_str().unwrap_or_default().to_string();
    let shown = done["path"].as_str().unwrap_or_default().to_string();
    report.tool = Some(ToolReport {
        id: tool.id.clone(),
        package: tool.package.clone(),
        version: Some(version.clone()),
        path: Some(shown.clone()),
    });

    let program = paths::untilde(&shown);
    report.steps.push("run:version".into());
    if let Err(why) = check_version(&program, &version) {
        return report.fail("run:version", None, format!("`{} --version`: {why}", tool.bin), None);
    }
    report.steps.push("run:describe".into());
    if let Err(why) = check_describe(&program, &tool.bin, &version) {
        return report.fail("run:describe", None, format!("`{} --wcat-describe`: {why}", tool.bin), None);
    }
    report.ok = true;
    report
}

impl Report {
    fn fail_with(self, step: &str, failed: &Value) -> Self {
        let message = failed["message"].as_str().unwrap_or("ended with no result").to_string();
        let hint = failed["hint"].as_str().map(str::to_string);
        self.fail(step, Some(failed["reason"].clone()).filter(|r| !r.is_null()), message, hint)
    }
}

/// A catalog id or a tool's name; a part resolves to the tool that owns its package, as Install does.
fn resolve(name: &str) -> Result<&'static catalog::Tool, String> {
    let found = catalog::catalog()
        .tools
        .iter()
        .find(|t| t.id == name || t.name.eq_ignore_ascii_case(name))
        .ok_or_else(|| format!("No tool named {name} in the catalog."))?;
    let tool = catalog::owner(found);
    if tool.source == Source::Own {
        return Err(format!("{} is an own tool, which installs only through its review.", tool.name));
    }
    Ok(tool)
}

fn steps(prefix: &str, events: &[Value]) -> Vec<String> {
    events.iter().filter_map(|e| e["step"].as_str()).map(|step| format!("{prefix}:{step}")).collect()
}

fn check_version(program: &std::path::Path, version: &str) -> Result<(), String> {
    let out = run_tool(program, "--version")?;
    let printed = out.stdout.trim().trim_start_matches('v');
    if printed == version { Ok(()) } else { Err(format!("printed {printed:?}, the install reported {version}")) }
}

fn check_describe(program: &std::path::Path, bin: &str, version: &str) -> Result<(), String> {
    let out = run_tool(program, "--wcat-describe")?;
    let described = out.json().ok_or("printed no JSON")?;
    if described["name"] != bin {
        return Err(format!("names {}, not {bin}", described["name"]));
    }
    if described["version"] != version {
        return Err(format!("reports version {}, not {version}", described["version"]));
    }
    Ok(())
}

fn run_tool(program: &std::path::Path, arg: &str) -> Result<run::Output, String> {
    let out = run::run(program, &[arg], Some(&paths::search_path()), RUN_TIMEOUT).map_err(|e| e.to_string())?;
    if out.code == Some(0) {
        Ok(out)
    } else {
        let said = out.stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or_default().to_string();
        Err(format!("exit {:?}: {}", out.code, crate::redact::text(&said)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(words: &[&str]) -> Vec<String> {
        words.iter().map(|w| (*w).to_string()).collect()
    }

    #[test]
    fn a_normal_start_is_not_a_self_test() {
        assert_eq!(parse(&[], Some("1")), Asked::Nothing);
        assert_eq!(parse(&args(&["wirecat://open/v1/task/HRB-14"]), Some("1")), Asked::Nothing);
        assert_eq!(parse(&args(&["install-tool", "wa"]), Some("1")), Asked::Nothing);
    }

    #[test]
    fn the_flag_later_in_the_line_does_not_count() {
        assert_eq!(parse(&args(&["wirecat://x", "--self-test", "version"]), Some("1")), Asked::Nothing);
    }

    #[test]
    fn it_refuses_without_the_variable() {
        for env in [None, Some(""), Some("0"), Some("true")] {
            assert!(matches!(parse(&args(&["--self-test", "version"]), env), Asked::Refused(_)), "{env:?}");
        }
    }

    #[test]
    fn it_reads_install_tool_and_its_option() {
        let on = Some("1");
        assert_eq!(
            parse(&args(&["--self-test", "install-tool", "whatsapp"]), on),
            Asked::InstallTool { tool: "whatsapp".into(), own_node: false }
        );
        assert_eq!(
            parse(&args(&["--self-test", "install-tool", "wa", "--own-node"]), on),
            Asked::InstallTool { tool: "wa".into(), own_node: true }
        );
        assert_eq!(parse(&args(&["--self-test", "version"]), on), Asked::Version);
    }

    #[test]
    fn anything_else_is_a_usage_error() {
        let on = Some("1");
        for words in [
            &["--self-test"][..],
            &["--self-test", "uninstall-tool", "wa"],
            &["--self-test", "install-tool"],
            &["--self-test", "install-tool", "--own-node"],
            &["--self-test", "install-tool", "wa", "--own-node", "--own-node"],
            &["--self-test", "install-tool", "wa", "--global"],
            &["--self-test", "version", "extra"],
        ] {
            assert!(matches!(parse(&args(words), on), Asked::Usage(_)), "{words:?}");
        }
    }

    #[test]
    fn whatsapp_resolves_from_the_catalog_by_name_or_id() {
        let by_name = resolve("WhatsApp").unwrap();
        assert_eq!(by_name.id, "wa");
        assert_eq!(resolve("wa").unwrap().package, by_name.package);
        assert!(resolve("no-such-tool").is_err());
    }

    #[test]
    fn a_failed_report_carries_its_step_and_reason() {
        let failed =
            serde_json::json!({ "event": "failed", "reason": "network", "message": "No registry.", "hint": null });
        let report = Report::new().fail_with("install", &failed);
        let line: Value = serde_json::to_value(&report).unwrap();
        assert_eq!(line["ok"], false);
        assert_eq!(line["failure"]["step"], "install");
        assert_eq!(line["failure"]["reason"], "network");
        assert_eq!(line["failure"]["message"], "No registry.");
        assert!(Report { ok: true, ..Report::new() }.failure.is_none());
    }

    #[test]
    fn steps_are_named_after_their_events() {
        let events = [
            serde_json::json!({ "event": "step", "step": "check" }),
            serde_json::json!({ "event": "log", "line": "x" }),
            serde_json::json!({ "event": "step", "step": "install" }),
        ];
        assert_eq!(steps("install", &events), ["install:check", "install:install"]);
    }
}
