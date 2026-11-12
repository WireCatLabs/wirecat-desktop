use crate::tailscale::{self, FunnelState, PageEvent};
use crate::{catalog, mcp_server, node, paths, run, tools};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

// WireCat's own Tailscale connection: `wirecat-funnel` (WireCatLabs/funnel-cli), a tsnet helper that joins the
// owner's tailnet as its own device and serves Funnel with no Tailscale app and no administrator rights. Desktop only
// runs its fixed commands (rule 2) and adds or removes the tool's three paths, the same ones `tailscale.rs` mounts.
// Plan: `docs/dev/plans/2026-11-03-funnel-helper.md`.

pub const ID: &str = "funnel";
pub const START: &str = "funnel-helper-start";
/// The owner signs in, approves the device or allows Funnel in the browser.
const WAIT: Duration = Duration::from_mins(10);
/// `start` itself waits up to 20 s for the helper to come up.
const CALL: Duration = Duration::from_secs(40);

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
pub struct Route {
    pub path: String,
    pub port: u16,
}

/// The helper's own `--json` answer; every key is always there.
#[derive(Deserialize, Debug, Default)]
struct Answer {
    #[serde(default)]
    state: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    action_url: Option<String>,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    routes: Vec<Route>,
}

#[derive(Serialize, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub installed: bool,
    /// The helper's state: `stopped`, `starting`, `needs-login`, `needs-approval`, `needs-funnel`, `running`, `error`.
    pub state: String,
    pub url: Option<String>,
    /// Only a Tailscale page (`tailscale::page_url`); anything else the helper printed is dropped.
    pub action_url: Option<String>,
    pub error: Option<String>,
}

fn program() -> Option<PathBuf> {
    tools::program(&catalog::tool(ID).ok()?.bin)
}

fn call(args: &[&str]) -> Result<Answer, String> {
    let bin = program().ok_or("WireCat's Tailscale connection is not installed.")?;
    let mut out = String::new();
    run::stream(
        run::command(&bin, args, Some(&paths::search_path())),
        CALL,
        || false,
        |line| {
            if let run::Line::Out(s) = line {
                out.push_str(&s);
                out.push('\n');
            }
        },
    )
    .map_err(|e| format!("Could not run wirecat-funnel: {e}"))?;
    parse(&out)
}

fn parse(out: &str) -> Result<Answer, String> {
    let v: serde_json::Value = serde_json::from_str(out.trim())
        .map_err(|_| "wirecat-funnel gave an answer the app cannot read.".to_string())?;
    if let Some(e) = v.get("error").and_then(|e| e.as_str())
        && v.get("state").is_none()
    {
        return Err(e.to_string());
    }
    serde_json::from_value(v).map_err(|e| format!("wirecat-funnel gave an answer the app cannot read: {e}"))
}

fn status_of(a: &Answer) -> Status {
    Status {
        installed: true,
        state: a.state.clone(),
        url: a.url.clone().filter(|u| u.starts_with("https://")),
        action_url: a.action_url.as_deref().and_then(tailscale::page_url),
        error: a.error.clone(),
    }
}

pub fn status() -> Status {
    if program().is_none() {
        return Status { state: "stopped".into(), ..Status::default() };
    }
    match call(&["status", "--json"]) {
        Ok(a) => status_of(&a),
        Err(e) => Status { installed: true, state: "error".into(), error: Some(e), ..Status::default() },
    }
}

/// Starts the helper and waits until it runs, opening each Tailscale page it asks for once: the login, the device's
/// approval, or allowing Funnel. Its login is kept on disk, so a second start needs no browser.
pub fn start(stopped: &dyn Fn() -> bool, send: &dyn Fn(PageEvent)) -> Result<Status, String> {
    let began = Instant::now();
    let mut answer = call(&["start", "--json"])?;
    let mut opened: Option<String> = None;
    loop {
        let s = status_of(&answer);
        match s.state.as_str() {
            "running" => return Ok(s),
            "error" => return Err(s.error.unwrap_or_else(|| "WireCat's Tailscale connection stopped.".into())),
            "stopped" => return Err("WireCat's Tailscale connection stopped. Try again.".into()),
            _ => {}
        }
        if let Some(url) = s.action_url
            && opened.as_ref() != Some(&url)
        {
            tailscale::open_page(&url, send);
            opened = Some(url);
        }
        for _ in 0..10 {
            if stopped() {
                return Err("Stopped.".into());
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        if began.elapsed() > WAIT {
            return Err(format!("Nothing happened in the browser for {} minutes.", WAIT.as_secs() / 60));
        }
        answer = call(&["status", "--json"])?;
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct Owned {
    tool: String,
    /// The helper's address when the paths were added; the helper reports none while it is stopped.
    url: String,
    port: u16,
}

const RECORDS: &str = "wirecat-funnel-routes.json";

fn load() -> Vec<Owned> {
    node::load_record(RECORDS)
}

fn save(records: &[Owned]) -> Result<(), String> {
    node::save_record(RECORDS, records)
}

static ROUTES: Mutex<()> = Mutex::new(());

fn serves(routes: &[Route], tool: &str, port: u16) -> bool {
    tailscale::mounts(tool).iter().all(|p| routes.iter().any(|r| &r.path == p && r.port == port))
}

/// Adds the tool's three paths to the running helper, to the tool's local port, and returns the public address for
/// `mcp server start`: `https://<helper's name>/<tool>`.
pub fn open(tool: &str, port: u16) -> Result<String, String> {
    mcp_server::validate_port(port)?;
    mcp_server::ensure_port_is_ours(catalog::tool(tool)?, port)?;
    let _one = ROUTES.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let now = call(&["status", "--json"])?;
    let ("running", Some(base)) = (now.state.as_str(), status_of(&now).url) else {
        return Err("WireCat's Tailscale connection is not on. Finish the steps above first.".into());
    };
    let port_word = port.to_string();
    for path in tailscale::mounts(tool) {
        if let Err(e) = call(&["route", "add", &path, &port_word, "--json"]) {
            for p in tailscale::mounts(tool) {
                let _ = call(&["route", "remove", &p, "--json"]);
            }
            return Err(format!("WireCat's Tailscale connection did not take the address: {e}"));
        }
    }
    let url = format!("{base}/{tool}");
    let mut records = load();
    records.retain(|r| r.tool != tool);
    records.push(Owned { tool: tool.into(), url: url.clone(), port });
    save(&records)?;
    Ok(url)
}

/// Removes only this tool's paths; the helper stops once no tool is left on it. The record stays, so the next start
/// shows the same address.
pub fn close(tool: &str) -> Result<(), String> {
    let _one = ROUTES.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if program().is_none() || !load().iter().any(|r| r.tool == tool) {
        return Ok(());
    }
    let mut left = Vec::new();
    for path in tailscale::mounts(tool) {
        left = call(&["route", "remove", &path, "--json"])?.routes;
    }
    if left.is_empty() {
        call(&["stop", "--json"])?;
    }
    Ok(())
}

/// The tools the app put on the helper, each live while the helper runs and still sends all three paths to its port.
pub fn funnels() -> Vec<FunnelState> {
    let records = load();
    if records.is_empty() {
        return Vec::new();
    }
    let now = program().and_then(|_| call(&["status", "--json"]).ok()).unwrap_or_default();
    states(&records, &now)
}

fn states(records: &[Owned], now: &Answer) -> Vec<FunnelState> {
    records
        .iter()
        .map(|r| FunnelState {
            tool: r.tool.clone(),
            profile: None,
            url: r.url.clone(),
            port: r.port,
            live: now.state == "running" && serves(&now.routes, &r.tool, r.port),
            shared: true,
            via: "wirecat",
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const RUNNING: &str = r#"{"state":"running","pid":4,"url":"https://wirecat.tail1.ts.net","action_url":null,
        "error":null,"routes":[{"path":"/tg","port":8765},
        {"path":"/.well-known/oauth-authorization-server/tg","port":8765},
        {"path":"/.well-known/oauth-protected-resource/tg","port":8765}],"dir":"/d","version":"0.1.1"}"#;

    #[test]
    fn reads_a_running_helper() {
        let a = parse(RUNNING).unwrap();
        let s = status_of(&a);
        assert_eq!(s.state, "running");
        assert_eq!(s.url.as_deref(), Some("https://wirecat.tail1.ts.net"));
        assert!(serves(&a.routes, "tg", 8765));
        assert!(!serves(&a.routes, "tg", 8766));
        assert!(!serves(&a.routes, "max", 8765));
    }

    #[test]
    fn a_failed_command_is_its_error() {
        assert_eq!(
            parse(r#"{"error":"port 70000 is not between 1 and 65535"}"#).unwrap_err(),
            "port 70000 is not between 1 and 65535"
        );
        assert!(parse("not json").is_err());
    }

    #[test]
    fn passes_only_tailscale_pages() {
        let a = parse(r#"{"state":"needs-login","action_url":"https://login.tailscale.com/a/abc"}"#).unwrap();
        assert_eq!(status_of(&a).action_url.as_deref(), Some("https://login.tailscale.com/a/abc"));
        let b = parse(r#"{"state":"needs-login","action_url":"https://evil.example/a"}"#).unwrap();
        assert_eq!(status_of(&b).action_url, None);
    }

    #[test]
    fn a_stopped_helper_keeps_the_address_but_is_not_live() {
        let records = vec![Owned { tool: "tg".into(), url: "https://wirecat.tail1.ts.net/tg".into(), port: 8765 }];
        let stopped = parse(r#"{"state":"stopped","routes":[]}"#).unwrap();
        let s = states(&records, &stopped);
        assert_eq!(s[0].url, "https://wirecat.tail1.ts.net/tg");
        assert!(!s[0].live);
        assert!(states(&records, &parse(RUNNING).unwrap())[0].live);
    }
}
