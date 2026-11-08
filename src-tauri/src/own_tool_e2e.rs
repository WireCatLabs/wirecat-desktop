//! "Add your own tool" end to end, against the real `@leemour/acme-crm-cli` on the public npm registry, through the
//! same functions the interface's commands call. Two processes, because the catalog is read once at start: `phase_add`
//! is the session that adds the tool, `phase_use` the next start that lists it. Locally: `bin/own-tool-e2e`, which
//! makes the temp folder both read through `WIRECAT_OWN_E2E_ROOT` and removes it.

use crate::catalog::{self, Tool};
use crate::community::Source;
use crate::install::{self, InstallEvent, Running};
use crate::own_tools::{self, Discovery, Refusal, Review};
use crate::{mcp_server, paths, run, skills, storage, sync, tools};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, mpsc};
use std::time::{Duration, SystemTime};
use tauri::ipc::{Channel, InvokeResponseBody};

const PACKAGE: &str = "@leemour/acme-crm-cli";
const VERSION: &str = "0.1.0";
const REPO: &str = "https://github.com/leemour/acme-crm-cli";
const ID: &str = "acmecrm";
const BIN: &str = "wcat-acme-crm";
const APP: &str = "leemour-acme-crm-cli";
const PROFILE: &str = "live";
const ROOT_ENV: &str = "WIRECAT_OWN_E2E_ROOT";
/// Variables that would let the package's install scripts or its runs reach the owner's secrets, keyring or agents.
const REMOVED: [&str; 12] = [
    "CLAUDE_CONFIG_DIR",
    "NPM_TOKEN",
    "NPM_GITHUB_TOKEN",
    "NODE_AUTH_TOKEN",
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "DBUS_STARTER_ADDRESS",
    "HERMES_HOME",
    "OPENCLAW_STATE_DIR",
    "WIRECAT_EXTRA_TOOLS",
];

#[test]
#[ignore = "installs a real package from npm and changes this process's environment; bin/own-tool-e2e"]
fn phase_add() {
    let Some(root) = root() else { return };
    let real = Real::record();
    isolate(&root);

    println!("1. Allow tools WireCat has not checked");
    assert!(!own_tools::status().allowed);
    own_tools::set_allowed(true).unwrap();
    assert!(own_tools::status().allowed);

    println!("2. Discover {PACKAGE}");
    let review = reviewed(own_tools::discover(PACKAGE, None));
    println!(
        "   {}",
        serde_json::to_string(&json!({
            "id": review.id, "version": review.version, "repo": review.repo, "built": review.built,
            "publishers": review.publishers, "access": review.access, "syncs": review.syncs, "skill": review.skill,
            "mcp": review.mcp, "described": review.described, "storage": review.entry["storage"],
        }))
        .unwrap()
    );
    assert_eq!((review.id.as_str(), review.version.as_str()), (ID, VERSION));
    assert_eq!(review.repo.as_deref(), Some(REPO));
    let built = review.built.as_ref().expect("npm keeps a provenance record of 0.1.0");
    assert_eq!(built.repo, REPO);
    assert!(built.workflow.contains(".github/workflows/release.yml"), "{}", built.workflow);
    assert!(built.workflow.contains("refs/heads/main"), "{}", built.workflow);
    assert_eq!(review.publishers, ["leemour"]);
    assert!(review.described && !review.access.unknown);
    assert_eq!(review.access.changes, ["mcp serve"], "only mcp serve declares remote writes");
    for read in ["sync", "contacts list", "doctor", "session start"] {
        assert!(review.access.reads.iter().any(|c| c == read), "{read} reads the service");
    }
    for write in ["sync", "session start", "skill install", "config set"] {
        assert!(review.access.writes.iter().any(|c| c == write), "{write} writes on this computer");
    }
    let local_only = |c: &&String| *c == "deals list";
    assert!(
        !review.access.reads.iter().chain(&review.access.changes).chain(&review.access.writes).any(|c| local_only(&c))
    );
    assert_eq!(review.entry["storage"], json!({ "app": APP, "env": "ACME_CRM" }));
    assert!(review.syncs && review.skill && review.mcp && review.sign_in.is_some());
    assert!(review.update.is_none(), "a first add is no update");

    println!("3. Add: both confirmations, install {VERSION}");
    let reviewed = own_tools::take_review(&review.token).unwrap();
    let sha = reviewed.manifest_sha256.clone().expect("a described tool has a manifest hash");
    let events = installing(|r, ch| own_tools::add(&review.token, Arc::clone(&reviewed), r, ch));
    assert_eq!(last(&events)["event"], "done", "{}", events.join("\n"));
    assert_eq!(last(&events)["version"], VERSION);
    assert!(events.iter().any(|e| e.contains("Built by https://github.com/leemour/acme-crm-cli")), "provenance shown");
    let prefix = PathBuf::from(std::env::var_os("npm_config_prefix").unwrap());
    let program = tools::program(BIN).unwrap();
    assert!(program.starts_with(&prefix), "{} is not in the temp npm prefix", program.display());
    let described = run::run(&program, &["--wcat-describe"], Some(&paths::search_path()), Duration::from_secs(30))
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(described["manifest_sha256"].as_str(), Some(sha.as_str()));
    let saved: Value =
        serde_json::from_str(&std::fs::read_to_string(app_data().join("extra-tools.json")).unwrap()).unwrap();
    let entry = &saved["tools"][0];
    assert_eq!((entry["id"].as_str(), entry["own"]["version"].as_str()), (Some(ID), Some(VERSION)));
    let reloaded = crate::community::parse(&saved.to_string(), builtin());
    assert!(reloaded.0.iter().any(|t| t.id == ID && t.source == Source::Own), "{:?}", reloaded.1.rejected);
    assert_eq!(reloaded.1.count(Source::Own), 1);
    real.unchanged();
}

#[test]
#[ignore = "runs the tool phase_add installed; bin/own-tool-e2e"]
#[expect(clippy::too_many_lines, reason = "one journey, step by step")]
fn phase_use() {
    let Some(root) = root() else { return };
    let real = Real::record();
    isolate(&root);

    println!("3. The next start lists it as Not checked");
    let tool = catalog::tool(ID).expect("the saved entry is in the catalog at start");
    assert_eq!(tool.source, Source::Own);
    assert_eq!(own_tools::status().added, 1);

    println!("4. Sign in profile {PROFILE} with a synthetic token, file storage");
    let setup = catalog::with_profile(tool.setup.as_ref().unwrap(), Some(PROFILE)).unwrap();
    let mut words: Vec<&str> = setup.iter().map(String::as_str).collect();
    words.extend(["--credential-storage", "file", "--json"]);
    let mut out = String::new();
    let code = run::stream_with_input(
        run::command(&tools::program(BIN).unwrap(), &words, Some(&paths::search_path())),
        Some(b"acme_test_e2e\n"),
        Duration::from_mins(1),
        || false,
        |line| match line {
            run::Line::Out(l) | run::Line::Err(l) => {
                out.push_str(&l);
                out.push('\n');
            }
        },
    )
    .unwrap();
    assert_eq!(code, Some(0), "{out}");
    let profiles = tools::profiles(tool).unwrap().unwrap_or_default();
    println!("   profiles: {:?}", profiles.iter().map(|p| &p.name).collect::<Vec<_>>());
    assert!(profiles.iter().any(|p| p.name == PROFILE));

    println!("5. Sync with the entry's words");
    let args = sync::args(tool, Some(PROFILE)).unwrap();
    let events = Mutex::new(Vec::new());
    sync::run(tool, &args, &|| false, &|e| events.lock().unwrap().push(e));
    let events = events.into_inner().unwrap();
    println!("   {events:?}");
    let Some(sync::SyncEvent::Done { summary }) = events.last() else { panic!("{events:?}") };
    assert_eq!((summary.new, summary.failed, summary.complete), (58, 0, true), "10 + 25 + 15 + 8 invoices");
    let deals = cli(tool, &[PROFILE, "deals", "list", "--json"]);
    let deals = items(&deals);
    assert_eq!(deals.len(), 15, "{deals:?}");
    assert!(deals.iter().any(|d| d.to_string().contains("deal_01")));
    let store = cli(tool, &[PROFILE, "store", "status", "--json"]);
    let stored = |kind: &str| items(&store).iter().find(|i| i["kind"] == kind).map(|i| i["stored"].clone());
    assert_eq!(
        (stored("organization"), stored("person"), stored("deal")),
        (Some(json!(10)), Some(json!(25)), Some(json!(15))),
        "{store}"
    );
    let again = cli(tool, &args.iter().map(String::as_str).collect::<Vec<_>>());
    println!("   sync again: {}", again["item"]);
    assert_eq!(again["item"]["invoices"]["unchanged"], 8, "the 8 invoice proposals are in the store");

    println!("6. Doctor");
    let doctor = tools::diagnose(tool, Some(PROFILE)).unwrap();
    assert_eq!(doctor.exit_code, Some(0), "{:?} {}", doctor.report, doctor.stderr);
    let report = &doctor.report.as_ref().unwrap()["item"];
    assert_eq!((report["version"].as_str(), report["files"]["ok"].as_bool()), (Some(VERSION), Some(true)), "{report}");
    assert_eq!(report["config"]["issues"], json!([]), "{report}");

    println!("7. Connect Claude Code: skill, MCP server, one tools/call");
    let home = paths::home().unwrap();
    skills::install(tool, "claude").unwrap();
    let skill_dir = home.join(".claude/skills");
    let written: Vec<PathBuf> = std::fs::read_dir(&skill_dir).unwrap().flatten().map(|e| e.path()).collect();
    println!("   skills: {written:?}");
    assert!(written.iter().any(|d| d.join("SKILL.md").is_file()), "no SKILL.md under {}", skill_dir.display());
    let status = skills::status(tool).unwrap();
    println!("   skill status: {:?}", status.targets);

    let port = u16::try_from(tool.mcp_server.as_ref().unwrap().port.unwrap()).unwrap();
    assert!(std::net::TcpListener::bind(("127.0.0.1", port)).is_ok(), "port {port} is taken on this computer");
    let started = mcp_server::start(tool, port, &format!("http://127.0.0.1:{port}")).unwrap();
    println!("   http server: running {} port {:?}", started.running, started.port);
    assert!(started.running && started.port == Some(port));
    mcp_server::stop(tool).unwrap();
    assert!(!mcp_server::status(tool).unwrap().running);
    assert!(std::net::TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_secs(1)).is_err());

    let config: Value = serde_json::from_str(&mcp_server::config(tool).unwrap()).unwrap();
    let (name, server) = config["mcpServers"].as_object().unwrap().iter().next().unwrap();
    println!("   stdio server {name}: {server}");
    let answer = mcp_call(server, "acme-crm_read", &json!({ "command": "deals list", "profile": PROFILE }));
    assert!(answer.to_string().contains("deal_01"), "{answer}");

    println!("8. Discovery again: same version, nothing to accept");
    let update = reviewed(own_tools::discover(PACKAGE, None));
    let change = update.update.as_ref().expect("a saved tool is an update");
    println!("   {change:?}");
    assert_eq!(change.from_version, VERSION);
    assert!(!change.confirm, "{change:?}");

    println!("10. Offline: discovery refuses as offline, the tool still reads its store");
    let offline = std::env::temp_dir().join(format!("wirecat-own-e2e-offline-cache-{}", std::process::id()));
    with_env(&[
        ("npm_config_https_proxy", "http://127.0.0.1:9"),
        ("npm_config_proxy", "http://127.0.0.1:9"),
        ("HTTPS_PROXY", "http://127.0.0.1:9"),
        ("https_proxy", "http://127.0.0.1:9"),
        ("npm_config_fetch_retries", "0"),
        ("npm_config_cache", &offline.to_string_lossy()),
    ]);
    match own_tools::discover(PACKAGE, None) {
        Discovery::Refused { refusal: Refusal::Offline { detail } } => println!("   offline: {detail}"),
        other => panic!("expected offline, got {other:?}"),
    }
    assert_eq!(items(&cli(tool, &[PROFILE, "deals", "list", "--json"])).len(), 15);
    let _ = std::fs::remove_dir_all(&offline);

    println!("9. Remove from WireCat, Uninstall, Delete data");
    let data = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap();
    let unrelated = data.join("unrelated-app");
    std::fs::create_dir_all(&unrelated).unwrap();
    let store = PathBuf::from(std::env::var_os("MESSAGING_STORE").unwrap());
    assert!(store.is_file(), "the sync wrote the shared store at {}", store.display());
    let mine: Vec<PathBuf> =
        storage::defaults(&tool.storage).into_iter().map(|(_, p)| p).filter(|p| p.exists()).collect();
    println!("   the tool's folders: {mine:?}");
    assert!(!mine.is_empty());
    own_tools::remove_saved(ID).unwrap();
    assert!(!std::fs::read_to_string(app_data().join("extra-tools.json")).unwrap().contains(PACKAGE));
    let events = installing(|r, ch| install::uninstall(tool, r, ch));
    assert_eq!(last(&events)["event"], "removed", "{}", events.join("\n"));
    assert!(paths::find(BIN).is_none());
    storage::clear(ID).unwrap();
    for folder in &mine {
        assert!(!folder.exists(), "{} stayed", folder.display());
    }
    assert!(unrelated.is_dir() && store.is_file(), "only the tool's own folders go");
    real.unchanged();
}

/// The folder the runner made, or nothing: a bare `--ignored` run skips this test.
fn root() -> Option<PathBuf> {
    let root = PathBuf::from(std::env::var_os(ROOT_ENV)?);
    let temp = std::fs::canonicalize(std::env::temp_dir()).unwrap();
    let root = std::fs::canonicalize(&root).unwrap();
    assert!(root.starts_with(&temp) && root != temp, "{ROOT_ENV} must be a folder inside {}", temp.display());
    Some(root)
}

/// Before anything reads the catalog or builds the search path: every folder the app, npm, the tool and an agent
/// write goes under `root`.
fn isolate(root: &Path) {
    let home = root.join("home");
    let prefix = root.join("npm-prefix");
    let runtime = root.join("runtime");
    for dir in [&home, &prefix, &runtime] {
        std::fs::create_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    std::fs::set_permissions(&runtime, std::os::unix::fs::PermissionsExt::from_mode(0o700)).unwrap();
    let data = home.join(".local/share");
    let path = std::env::join_paths(
        std::iter::once(crate::npm_prefix::bin_dir(&prefix))
            .chain(std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())),
    )
    .unwrap();
    for name in REMOVED {
        remove_env(name);
    }
    for prefix in ["ACME_CRM", "WIRECAT"] {
        for kind in ["CONFIG", "STATE", "CACHE", "PROFILE", "BASE_URL", "TOKEN"] {
            remove_env(&format!("{prefix}_{kind}_DIR"));
            remove_env(&format!("{prefix}_{kind}"));
        }
    }
    let values: [(&str, PathBuf); 16] = [
        ("HOME", home.clone()),
        ("USERPROFILE", home.clone()),
        ("XDG_CONFIG_HOME", home.join(".config")),
        ("XDG_DATA_HOME", data.clone()),
        ("XDG_CACHE_HOME", home.join(".cache")),
        ("XDG_STATE_HOME", home.join(".local/state")),
        ("XDG_RUNTIME_DIR", runtime),
        ("WIRECAT_NODE_DIR", root.join("no-managed-node")),
        ("npm_config_prefix", prefix),
        ("npm_config_cache", root.join("npm-cache")),
        ("npm_config_userconfig", root.join("npmrc")),
        ("npm_config_globalconfig", root.join("npmrc-global")),
        ("MESSAGING_STORE", data.join("WireCat/wirecat.db")),
        ("DBUS_SESSION_BUS_ADDRESS", "disabled:".into()),
        ("PATH", PathBuf::from(path)),
        ("npm_config_update_notifier", "false".into()),
    ];
    for (name, value) in values {
        set_env(name, value.as_os_str());
    }
}

fn app_data() -> PathBuf {
    crate::node::app_data().unwrap()
}

fn builtin() -> &'static catalog::Catalog {
    static BUILTIN: std::sync::OnceLock<catalog::Catalog> = std::sync::OnceLock::new();
    BUILTIN.get_or_init(|| serde_json::from_str(include_str!("../../catalog/tools.json")).unwrap())
}

/// What on the owner's own computer this test must never change, read before `HOME` moves.
struct Real {
    home: PathBuf,
    skills: Option<Vec<String>>,
    program: Option<PathBuf>,
    store: Option<SystemTime>,
    tools_file: Option<SystemTime>,
}

impl Real {
    fn record() -> Self {
        let home = paths::home().unwrap();
        let modified = |p: PathBuf| std::fs::metadata(p).and_then(|m| m.modified()).ok();
        let program = which::which(BIN).ok();
        assert!(program.is_none(), "{BIN} is already installed on this computer: {program:?}");
        Real {
            home: home.clone(),
            skills: std::fs::read_dir(home.join(".claude/skills"))
                .ok()
                .map(|d| d.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect()),
            program,
            store: modified(home.join(".local/share/WireCat/wirecat.db")),
            tools_file: modified(home.join(".local/share/dev.wirecat.desktop/extra-tools.json")),
        }
        .sorted()
    }

    fn sorted(mut self) -> Self {
        if let Some(s) = self.skills.as_mut() {
            s.sort();
        }
        self
    }

    fn unchanged(&self) {
        let home = &self.home;
        let modified = |p: PathBuf| std::fs::metadata(p).and_then(|m| m.modified()).ok();
        let mut skills: Option<Vec<String>> = std::fs::read_dir(home.join(".claude/skills"))
            .ok()
            .map(|d| d.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect());
        if let Some(s) = skills.as_mut() {
            s.sort();
        }
        assert_eq!(skills, self.skills, "the owner's Claude Code skills changed");
        assert_eq!(self.program, None);
        assert_eq!(modified(home.join(".local/share/WireCat/wirecat.db")), self.store, "the owner's store changed");
        assert_eq!(
            modified(home.join(".local/share/dev.wirecat.desktop/extra-tools.json")),
            self.tools_file,
            "the owner's own tools changed"
        );
        println!("   the owner's skills, store and own tools are as they were");
    }
}

fn reviewed(discovery: Discovery) -> Box<Review> {
    match discovery {
        Discovery::Review { review } => review,
        Discovery::Refused { refusal } => panic!("refused: {refusal:?}"),
    }
}

fn installing(op: impl FnOnce(&Running, &Channel<InstallEvent>)) -> Vec<String> {
    let events = Arc::new(Mutex::new(Vec::<String>::new()));
    let sink = Arc::clone(&events);
    let channel = Channel::new(move |body| {
        if let InvokeResponseBody::Json(json) = body {
            println!("   {json}");
            sink.lock().unwrap().push(json);
        }
        Ok(())
    });
    op(&Running::default(), &channel);
    events.lock().unwrap().clone()
}

fn last(events: &[String]) -> Value {
    events.last().and_then(|e| serde_json::from_str(e).ok()).unwrap_or_default()
}

/// The tool's own command, built as the app builds every run.
fn cli(tool: &Tool, args: &[&str]) -> Value {
    let program = tools::program(&tool.bin).unwrap();
    let out = run::run(&program, args, Some(&paths::search_path()), Duration::from_mins(2)).unwrap();
    assert_eq!(out.code, Some(0), "{args:?}: {} {}", out.stdout, out.stderr);
    out.json().unwrap_or_else(|| panic!("{args:?} printed no JSON: {}", out.stdout))
}

fn items(v: &Value) -> Vec<Value> {
    v["items"].as_array().or_else(|| v["item"]["items"].as_array()).cloned().unwrap_or_default()
}

/// One `tools/call` over the stdio server the tool's `mcp config` names, as a desktop agent starts it; the server is
/// stopped by its own process id.
fn mcp_call(server: &Value, name: &str, arguments: &Value) -> Value {
    let mut cmd = Command::new(server["command"].as_str().unwrap());
    cmd.args(server["args"].as_array().unwrap().iter().map(|a| a.as_str().unwrap()));
    for (k, v) in server["env"].as_object().into_iter().flatten() {
        cmd.env(k, v.as_str().unwrap_or_default());
    }
    let mut child = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let (tx, rx) = mpsc::channel::<Value>();
    let stdout = child.stdout.take().unwrap();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(v) = serde_json::from_str::<Value>(&line)
                && tx.send(v).is_err()
            {
                break;
            }
        }
    });
    let mut send = |v: Value| writeln!(stdin, "{v}").and_then(|()| stdin.flush()).unwrap();
    let wait = |id: u64| loop {
        let v = rx.recv_timeout(Duration::from_secs(30)).expect("the MCP server answered in time");
        if v["id"] == id {
            break v;
        }
    };
    send(json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "own-tool-e2e", "version": "1" } } }));
    wait(1);
    send(json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }));
    send(json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }));
    let listed = wait(2);
    let names: Vec<&str> =
        listed["result"]["tools"].as_array().into_iter().flatten().filter_map(|t| t["name"].as_str()).collect();
    println!("   tools: {names:?}");
    send(
        json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": name, "arguments": arguments } }),
    );
    let answer = wait(3);
    let pid = child.id();
    child.kill().unwrap();
    child.wait().unwrap();
    println!("   stopped the MCP server, pid {pid}");
    answer
}

fn with_env(pairs: &[(&str, &str)]) {
    for (k, v) in pairs {
        set_env(k, std::ffi::OsStr::new(v));
    }
}

#[allow(unsafe_code)]
fn set_env(name: &str, value: &std::ffi::OsStr) {
    // SAFETY: each phase runs alone (`--exact`), and nothing else reads the environment while it changes.
    unsafe { std::env::set_var(name, value) };
}

#[allow(unsafe_code)]
fn remove_env(name: &str) {
    // SAFETY: as in `set_env`.
    unsafe { std::env::remove_var(name) };
}
