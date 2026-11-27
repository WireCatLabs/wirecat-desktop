//! The commands of `WireCat`'s own tools, from the installed CLI itself (docs/dev/cli-registry.md, "Official tools").
//! An official tool answers `--wcat-describe` with the `desktop` object of its own manifest. Where that object states
//! a command, the command wins over the compiled catalog's: the answer comes from the package whose code the app runs
//! anyway, so trusting it adds no trust (NEED-2912). Texts, the data folder, ports and what only Desktop knows (bots,
//! sign-in screens, search fields) stay the catalog's. An answer that is missing, slow, too large, for another version
//! or of the wrong shape leaves the catalog as it is, with a line in the log.
//!
//! Answers are kept in `<app data>/described.json` by tool, with the program they came from and its stamp, so the
//! catalog reads them at start without starting a process. After start, `refresh_all` asks each installed tool whose
//! program changed, a few at a time; an install, update or removal asks that one tool again (`refresh`).

use crate::cache::Stamp;
use crate::catalog::Tool;
use crate::community::{self, Source};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex};
use std::time::Duration;

const FILE: &str = "described.json";
const MAX_DESCRIBE: usize = 64 * 1024;
/// A cold first start of a Node.js CLI on a busy computer can take this long.
const TIMEOUT: Duration = Duration::from_secs(15);
/// Each answer is a Node.js process; all at once would slow the app's own start.
const AT_ONCE: usize = 4;
/// What the interface waits for the pass after start before it keeps the compiled commands.
const START_WAIT: Duration = Duration::from_mins(3);

/// The catalog keys that hold commands, as cli-docs' drift check compares them (`FACTS` in its
/// `scripts/official-tools.ts`). Within `sync` and `signIn` only the listed keys are commands.
const COMMANDS: [&str; 8] = ["profiles", "doctor", "runs", "setup", "skill", "mcpServer", "accountRemove", "meetings"];
const SYNC: [&str; 3] = ["run", "last", "lastShape"];
const SIGN_IN: [&str; 2] = ["methods", "setupFrom"];
/// Desktop's own words for what a sign-out removes and keeps: the catalog's stay when it has them.
const CATALOG_FIRST: [&str; 2] = ["accountRemove.keeps", "accountRemove.removes"];
/// The version a command needs says nothing about the installed program that describes itself; cli-base writes `0.0.0`.
const NEVER: [&str; 1] = ["accountRemove.remove.minVersion"];
/// The keys the interface replaces on a built-in tool whose commands changed.
pub const SHOWN: [&str; 10] =
    ["profiles", "doctor", "runs", "setup", "skill", "mcpServer", "accountRemove", "meetings", "sync", "signIn"];

/// One tool's last answer and the program that gave it; `desktop` is `None` when it gave none that could be read, so
/// the same program is not asked again.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct Kept {
    program: PathBuf,
    stamp: Stamp,
    version: Option<String>,
    desktop: Option<Value>,
}

type Answers = BTreeMap<String, Kept>;

/// One read-change-write of the file at a time.
static FILE_LOCK: Mutex<()> = Mutex::new(());

/// The start pass: `Some(changed)` once it ended.
static START: (Mutex<Option<bool>>, Condvar) = (Mutex::new(None), Condvar::new());

/// Official tools that install their own program: not a part of another package, not a helper.
pub fn describable(tool: &Tool) -> bool {
    tool.source == Source::Official && tool.part_of.is_none() && !tool.helper && tool.package.starts_with("@wirecat/")
}

fn describable_entry(entry: &Value) -> bool {
    entry["partOf"].is_null()
        && entry["helper"] != true
        && entry["package"].as_str().is_some_and(|p| p.starts_with("@wirecat/"))
}

/// `entry` with the commands `desktop` states, and the paths that changed. Like the drift check, a `null` or missing
/// key says nothing, an object is merged key by key and a word list replaces the catalog's whole.
pub fn overlay(entry: &Value, desktop: &Value) -> Result<(Value, Vec<String>), String> {
    crate::own_tools::desktop_entry(desktop).map_err(|(key, why)| format!("{key}: {why}"))?;
    if let Some(key) = community::FORBIDDEN.iter().find(|k| !desktop[**k].is_null()) {
        return Err(format!("{key}: only the compiled catalog sets it."));
    }
    if desktop["storage"] != entry["storage"] {
        return Err("storage: it names another data folder than the catalog.".into());
    }
    let mut out = entry.clone();
    let mut changed = Vec::new();
    for key in COMMANDS {
        // A server needs the port Desktop gives it, and the catalog has none for a tool it lists without one.
        if key == "mcpServer" && entry["mcpServer"].is_null() {
            continue;
        }
        merge(&mut out[key], &desktop[key], key, &mut changed);
    }
    if !desktop["sync"].is_null() && !entry["sync"].is_null() {
        let mut said = pick(&desktop["sync"], &SYNC);
        // A shape belongs to the command it reads.
        if said["last"].is_null() {
            said.as_object_mut().map(|m| m.remove("lastShape"));
        }
        merge(&mut out["sync"], &said, "sync", &mut changed);
    }
    if !desktop["signIn"].is_null() && !entry["signIn"].is_null() {
        merge(&mut out["signIn"], &pick(&desktop["signIn"], &SIGN_IN), "signIn", &mut changed);
    }
    if changed.is_empty() {
        return Ok((out, changed));
    }
    community::words(&shown(&out)).map_err(|p| p.to_string())?;
    community::account_remove(&out["accountRemove"]).map_err(|p| p.to_string())?;
    serde_json::from_value::<Tool>(out.clone()).map_err(|e| format!("not a catalog entry: {e}"))?;
    Ok((out, changed))
}

fn pick(v: &Value, keys: &[&str]) -> Value {
    Value::Object(keys.iter().filter_map(|k| v.get(*k).map(|x| ((*k).to_string(), x.clone()))).collect())
}

fn merge(into: &mut Value, said: &Value, path: &str, changed: &mut Vec<String>) {
    if said.is_null() || NEVER.contains(&path) || (CATALOG_FIRST.contains(&path) && !into.is_null()) {
        return;
    }
    if let Some(map) = said.as_object()
        && into.is_object()
    {
        for (key, value) in map {
            merge(&mut into[key], value, &format!("{path}.{key}"), changed);
        }
        return;
    }
    if into != said {
        changed.push(path.to_string());
        *into = said.clone();
    }
}

/// The interface's copy of a changed tool: its id and the whole of each key that holds commands.
fn shown(entry: &Value) -> Value {
    pick(entry, &SHOWN)
}

fn file() -> Option<PathBuf> {
    // A unit test must not read the owner's answers; own_tool_e2e moves the app data first and says so.
    #[cfg(test)]
    std::env::var_os(community::TEST_APP_DATA)?;
    crate::node::app_data().map(|d| d.join(FILE))
}

fn read(file: &Path) -> Answers {
    std::fs::read(file).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

/// Written beside the file and renamed, so a crash never leaves half a file.
fn write(file: &Path, answers: &Answers) {
    let text = serde_json::to_vec_pretty(answers).unwrap_or_default();
    let next = file.with_extension("json.next");
    let saved = file.parent().map_or(Ok(()), std::fs::create_dir_all).and_then(|()| std::fs::write(&next, text));
    if let Err(e) = saved.and_then(|()| std::fs::rename(&next, file)) {
        tracing::warn!(file = FILE, error = %e, "could not keep the tools' own descriptions");
    }
}

/// The compiled entries with each kept answer whose program is unchanged; returns the interface's copy of each
/// changed tool. Reads one file and stats each program: no process starts.
pub fn apply_kept(tools: &mut [Value]) -> Vec<Value> {
    let Some(file) = file() else { return Vec::new() };
    apply(tools, &read(&file))
}

fn apply(tools: &mut [Value], answers: &Answers) -> Vec<Value> {
    let mut shown_tools = Vec::new();
    for entry in tools.iter_mut().filter(|e| describable_entry(e)) {
        let id = entry["id"].as_str().unwrap_or_default().to_string();
        if let Some(out) = current(answers, &id).and_then(|desktop| applied(&id, entry, desktop)) {
            shown_tools.push(json!({ "id": id, "described": shown(&out) }));
            *entry = out;
        }
    }
    shown_tools
}

/// A tool new to this app from the signed list: its entry with its own answer, when it gave one.
pub fn apply_listed(entry: Value) -> Value {
    let Some(file) = file() else { return entry };
    let id = entry["id"].as_str().unwrap_or_default().to_string();
    let answers = read(&file);
    current(&answers, &id).and_then(|desktop| applied(&id, &entry, desktop)).unwrap_or(entry)
}

fn current<'a>(answers: &'a Answers, id: &str) -> Option<&'a Value> {
    let kept = answers.get(id)?;
    let unchanged = Stamp::of(&kept.program).is_some_and(|now| now == kept.stamp);
    kept.desktop.as_ref().filter(|_| unchanged)
}

fn applied(id: &str, entry: &Value, desktop: &Value) -> Option<Value> {
    match overlay(entry, desktop) {
        Ok((out, changed)) if !changed.is_empty() => {
            tracing::info!(tool = id, changed = %changed.join(", "), "commands from the tool's own description");
            Some(out)
        }
        Ok(_) => None,
        Err(why) => {
            tracing::warn!(tool = id, why = %why, "the tool's own description was refused; the catalog's commands stay");
            None
        }
    }
}

/// The `desktop` object of a `--wcat-describe` answer, when it is one the app reads and for the installed version.
fn answer(stdout: &str, code: Option<i32>, installed: Option<&str>) -> Result<Value, String> {
    if code != Some(0) {
        return Err(format!("it exited with {code:?}"));
    }
    if stdout.len() > MAX_DESCRIBE {
        return Err(format!("the answer is larger than {} KB", MAX_DESCRIBE / 1024));
    }
    let v: Value = serde_json::from_str(stdout).map_err(|_| "the answer is not JSON".to_string())?;
    if v["wcat_describe"] != 2 {
        return Err("the answer is not format 2".into());
    }
    let said = v["version"].as_str();
    if let Some(installed) = installed
        && said != Some(installed)
    {
        return Err(format!("the answer is for version {said:?}, the program is {installed}"));
    }
    match &v["desktop"] {
        d @ Value::Object(_) => Ok(d.clone()),
        _ => Err("the answer has no desktop object".into()),
    }
}

fn ask(program: &Path, installed: Option<&str>) -> Result<Value, String> {
    let path = crate::paths::search_path();
    let out = crate::run::run_capped(program, &["--wcat-describe"], Some(&path), TIMEOUT, MAX_DESCRIBE)
        .map_err(|e| e.to_string())?;
    answer(&out.stdout, out.code, installed)
}

/// Asks the tool again when its program changed since the kept answer; whether what the catalog reads changed.
pub fn refresh(tool: &Tool) -> bool {
    let Some(file) = file().filter(|_| describable(tool)) else { return false };
    let Some(program) = crate::tools::program(&tool.bin) else {
        let _lock = FILE_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut answers = read(&file);
        let Some(kept) = answers.remove(&tool.id) else { return false };
        write(&file, &answers);
        return kept.desktop.is_some();
    };
    let Some(stamp) = Stamp::of(&program) else { return false };
    let known = read(&file).remove(&tool.id);
    if known.as_ref().is_some_and(|k| k.program == program && k.stamp == stamp) {
        return false;
    }
    let version = crate::tools::version_of(&program);
    let desktop = ask(&program, version.as_deref())
        .inspect_err(|why| {
            tracing::warn!(tool = %tool.id, why = %why, "no description from the tool; the catalog's commands stay");
        })
        .ok();
    let changed = known.and_then(|k| k.desktop) != desktop;
    let _lock = FILE_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut answers = read(&file);
    answers.insert(tool.id.clone(), Kept { program, stamp, version, desktop });
    write(&file, &answers);
    changed
}

/// The pass after start: every installed official tool, a few at a time, then one reload when anything changed.
pub fn refresh_all() {
    let tools: Vec<&'static Tool> = crate::catalog::catalog().tools.iter().filter(|t| describable(t)).collect();
    let queue = Mutex::new(tools.into_iter());
    let changed = std::sync::atomic::AtomicBool::new(false);
    std::thread::scope(|s| {
        for _ in 0..AT_ONCE {
            s.spawn(|| {
                loop {
                    let next = queue.lock().unwrap_or_else(std::sync::PoisonError::into_inner).next();
                    let Some(tool) = next else { break };
                    if refresh(tool) {
                        changed.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            });
        }
    });
    let changed = changed.into_inner();
    if changed {
        crate::catalog::reload();
    }
    let (done, ended) = &START;
    *done.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(changed);
    ended.notify_all();
}

/// Whether the pass after start changed the catalog; `false` when it has not ended within a few minutes.
pub fn wait_start() -> bool {
    let (done, ended) = &START;
    let guard = done.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let (guard, _) =
        ended.wait_timeout_while(guard, START_WAIT, |d| d.is_none()).unwrap_or_else(std::sync::PoisonError::into_inner);
    guard.unwrap_or(false)
}

/// After an install, update or removal: the tool's answer for the program now there, and the catalog read again.
pub fn after_change(tool: &Tool) {
    if refresh(tool) {
        crate::catalog::reload();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/official-describe.json");

    fn described() -> BTreeMap<String, Value> {
        serde_json::from_str(FIXTURE).unwrap()
    }

    fn compiled() -> Value {
        serde_json::from_str(include_str!("../../catalog/tools.json")).unwrap()
    }

    fn entry(id: &str) -> Value {
        compiled()["tools"].as_array().unwrap().iter().find(|t| t["id"] == id).unwrap().clone()
    }

    fn desktop(id: &str) -> Value {
        described()[id]["desktop"].clone()
    }

    /// Every official CLI's manifest as cli-docs read it from npm on 2026-11-24 (cli-docs b0d04c2e), slack-cli
    /// 0.3.0's, read on 2026-11-25 (its `signIn.setupFrom` replaces the catalog's, and its `account list` the
    /// catalog's `session list`), tg 0.137.0's and wa 0.48.0's, read on 2026-11-26, and max 0.123.0's, read on
    /// 2026-11-27. The changes are the command differences cli-docs `registry/drift-allow.json` lists (drive's
    /// `sync.lastShape` goes with its `sync.last`), except the MCP servers the catalog gives no port and what a sign-out
    /// keeps or removes, which stay Desktop's words.
    #[test]
    fn each_official_cli_overlays_cleanly_and_changes_only_its_commands() {
        let mut all = BTreeMap::new();
        for id in described().keys() {
            let (_, changed) = overlay(&entry(id), &desktop(id)).unwrap_or_else(|e| panic!("{id}: {e}"));
            if !changed.is_empty() {
                all.insert(id.clone(), changed.join(" "));
            }
        }
        let expected: BTreeMap<String, String> = [
            ("attio", "accountRemove.remove"),
            ("drive", "doctor mcpServer.config sync.last sync.lastShape"),
            ("email", "doctor sync.last"),
            ("gcal", "doctor"),
            ("memo", "skill.install skill.show sync.last"),
            ("notion", "sync.last"),
            ("slk", "profiles.args signIn.setupFrom"),
            ("zm", "doctor setup sync.run"),
        ]
        .into_iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
        assert_eq!(all, expected);
    }

    #[test]
    fn texts_ports_storage_and_desktops_own_keys_stay_the_catalogs() {
        let (out, _) = overlay(&entry("drive"), &desktop("drive")).unwrap();
        let before = entry("drive");
        for key in ["tagline", "name", "summary", "storage", "search", "folderPicker"] {
            assert_eq!(out[key], before[key], "{key}");
        }
        assert_eq!(out["mcpServer"]["port"], before["mcpServer"]["port"]);
        assert_eq!(out["signIn"]["gives"], before["signIn"]["gives"]);
        assert_eq!(out["signIn"]["methods"], before["signIn"]["methods"]);
        assert_eq!(out["sync"]["what"], before["sync"]["what"]);
        assert_eq!(out["accountRemove"]["keeps"], before["accountRemove"]["keeps"]);
        assert_eq!(out["sync"]["lastShape"], "runs");
        assert_eq!(out["doctor"], json!(["{profile}", "doctor", "--record", "--json"]));
    }

    #[test]
    fn a_null_key_says_nothing_and_the_messengers_keep_their_sync() {
        for id in ["tg", "max", "wa"] {
            assert!(desktop(id)["sync"].is_null());
            let (out, _) = overlay(&entry(id), &desktop(id)).unwrap();
            assert_eq!(out["sync"], entry(id)["sync"], "{id}");
            assert_eq!(out["bot"], entry(id)["bot"], "{id}");
        }
        let mut d = desktop("drive");
        d["doctor"] = json!(["{profile}", "status", "--record", "--json"]);
        d["setup"] = Value::Null;
        let (out, _) = overlay(&entry("drive"), &d).unwrap();
        assert_eq!(out["setup"], entry("drive")["setup"]);
    }

    #[test]
    fn a_server_the_catalog_has_no_port_for_stays_off() {
        for id in ["gcal", "email", "zm"] {
            assert!(desktop(id)["mcpServer"].is_object());
            let (out, _) = overlay(&entry(id), &desktop(id)).unwrap();
            assert!(out["mcpServer"].is_null(), "{id}");
        }
    }

    #[test]
    fn refuses_another_folder_a_shell_word_a_forbidden_key_and_a_bad_shape() {
        let refused = |change: &dyn Fn(&mut Value)| {
            let mut d = desktop("notion");
            change(&mut d);
            overlay(&entry("notion"), &d).unwrap_err()
        };
        assert!(refused(&|d| d["storage"]["app"] = json!("cli-memo")).starts_with("storage"));
        assert!(refused(&|d| d["doctor"] = json!(["doctor", "; rm -rf ~"])).contains("not allowed"));
        assert!(refused(&|d| d["bot"] = json!({ "set": ["bot"] })).starts_with("bot"));
        assert!(refused(&|d| d["unknown"] = json!(1)).starts_with("unknown"));
        refused(&|d| d["doctor"] = json!({ "args": ["doctor"] }));
        assert!(refused(&|d| d["accountRemove"]["remove"]["confirm"] = json!("--dry-run")).contains("remove.confirm"));
    }

    #[test]
    fn an_answer_is_read_only_for_the_installed_version_and_in_its_limits() {
        let said = |version: &str| json!({ "wcat_describe": 2, "version": version, "desktop": desktop("tg") });
        let ok = said("0.133.0").to_string();
        assert!(answer(&ok, Some(0), Some("0.133.0")).is_ok());
        assert!(answer(&ok, Some(0), None).is_ok());
        assert!(answer(&ok, Some(0), Some("0.134.0")).unwrap_err().contains("0.134.0"));
        assert!(answer(&ok, Some(1), Some("0.133.0")).is_err());
        assert!(answer("unknown option '--wcat-describe'", Some(0), None).is_err());
        assert!(answer(&json!({ "wcat_describe": 3, "desktop": {} }).to_string(), Some(0), None).is_err());
        assert!(answer(&" ".repeat(MAX_DESCRIBE + 1), Some(0), None).unwrap_err().contains("KB"));
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-described-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_kept_answer_applies_only_while_its_program_is_unchanged_and_the_catalog_parses() {
        let dir = temp_dir("kept");
        let program = dir.join("wcat-zm");
        std::fs::write(&program, "one").unwrap();
        let kept = |desktop: Value| Kept {
            program: program.clone(),
            stamp: Stamp::of(&program).unwrap(),
            version: Some("0.80.0".into()),
            desktop: Some(desktop),
        };
        let answers: Answers = [("zm".to_string(), kept(desktop("zm")))].into();
        let mut catalog = compiled();
        let tools = catalog["tools"].as_array_mut().unwrap();
        let shown = apply(tools, &answers);
        assert_eq!(shown.len(), 1);
        assert_eq!(shown[0]["described"]["doctor"], json!(["doctor", "--record", "--json"]));
        let parsed: crate::catalog::Catalog = serde_json::from_value(catalog).unwrap();
        let zm = parsed.tools.iter().find(|t| t.id == "zm").unwrap();
        assert_eq!(zm.doctor, ["doctor", "--record", "--json"]);

        std::fs::write(&program, "a newer version").unwrap();
        let mut catalog = compiled();
        assert_eq!(apply(catalog["tools"].as_array_mut().unwrap(), &answers), Vec::<Value>::new());

        std::fs::write(&program, "one").unwrap();
        let mut bad = desktop("zm");
        bad["storage"]["app"] = json!("cli-memo");
        let answers: Answers = [("zm".to_string(), kept(bad))].into();
        let mut catalog = compiled();
        assert_eq!(apply(catalog["tools"].as_array_mut().unwrap(), &answers), Vec::<Value>::new());
        assert_eq!(catalog, compiled());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_helper_and_parts_are_never_asked() {
        let c = compiled();
        let asked: Vec<&str> = c["tools"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| describable_entry(e))
            .filter_map(|e| e["id"].as_str())
            .collect();
        assert!(!asked.contains(&"funnel"));
        let described = described();
        let ids: Vec<&str> = described.keys().map(String::as_str).collect();
        let mut asked = asked;
        asked.sort_unstable();
        assert_eq!(asked, ids);
    }

    #[test]
    fn the_file_round_trips() {
        let dir = temp_dir("file");
        let file = dir.join(FILE);
        let program = dir.join("tg");
        std::fs::write(&program, "x").unwrap();
        let answers: Answers = [(
            "tg".to_string(),
            Kept { program: program.clone(), stamp: Stamp::of(&program).unwrap(), version: None, desktop: None },
        )]
        .into();
        write(&file, &answers);
        assert_eq!(read(&file), answers);
        assert!(read(&dir.join("missing.json")).is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
