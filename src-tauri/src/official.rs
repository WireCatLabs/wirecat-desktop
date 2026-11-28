//! `WireCat`'s own tools from the signed list's `official` key (docs/dev/cli-registry.md, "Official tools"). cli-docs
//! builds each entry from the CLI's manifest on npm and its `registry/official.json`.
//!
//! A tool this app has compiled in takes only its presentation from the list: texts in English, Russian and Spanish,
//! an icon and the sign-in screen it uses. Its commands never come from the list: once installed, they come from the
//! CLI's own `--wcat-describe` (`described.rs`), else from the compiled catalog. A tool the app does not have
//! yet becomes a catalog entry the way an own tool does (`own_tools::desktop_entry`), and passes every rule a listed
//! tool passes, except that it must be a `@wirecat` package built in a `WireCatLabs` repository.

use crate::catalog::Catalog;
use crate::community::{Problem, rule};
use serde_json::{Map, Value, json};

pub const MAX_TOOLS: usize = 64;
const MAX_ICON: usize = 2048;
const MAX_TEXT: usize = 600;
const LANGS: [&str; 3] = ["en", "ru", "es"];
const TEXTS: [&str; 6] = ["name", "tagline", "summary", "gives", "asks", "syncNote"];
/// Their sign-in screens need the catalog's `bot` block, which only a compiled-in tool may have.
const BOT_SCREENS: [&str; 3] = ["tg", "max", "wa"];

/// What one official entry adds to this app.
#[derive(Debug)]
pub enum Read {
    /// A compiled-in tool: `{ id, i18n?, icon?, screen? }` for the interface; Rust has nothing to change.
    BuiltIn(Value),
    /// A tool new to this app: its catalog entry, checked by `community::check` next.
    New(Value),
}

/// One SVG path drawn in the app's own colour on a 24 x 24 box: path commands and numbers, nothing that loads.
pub fn icon_path(d: &str) -> bool {
    !d.is_empty() && d.len() <= MAX_ICON && d.chars().all(|c| "MmLlHhVvCcSsQqTtAaZz0123456789 ,.eE-".contains(c))
}

fn id_like(s: &str) -> bool {
    (2..=16).contains(&s.len()) && s.chars().all(|c| c.is_ascii_lowercase())
}

/// The id, icon, screen and texts, each checked; anything else in the entry is not presentation.
fn presentation(entry: &Value, builtin: &Catalog) -> Result<Value, Problem> {
    let id = entry["id"].as_str().filter(|id| id_like(id));
    let Some(id) = id else { return Err(rule("id", "the id is not 2 to 16 lowercase letters.".into())) };
    let mut out = json!({ "id": id });
    if let Some(icon) = entry.get("icon").filter(|v| !v.is_null()) {
        if !icon.as_str().is_some_and(icon_path) {
            return Err(rule("icon", "the icon is not one SVG path of commands and numbers.".into()));
        }
        out["icon"] = icon.clone();
    }
    if let Some(screen) = entry.get("screen").filter(|v| !v.is_null()) {
        let ours = screen.as_str().filter(|s| builtin.tools.iter().any(|t| t.id == *s));
        match ours {
            Some(s) if BOT_SCREENS.contains(&s) => {
                return Err(rule("screen", format!("the {s} sign-in screens need a bot of a built-in tool.")));
            }
            Some(_) => out["screen"] = screen.clone(),
            None => return Err(rule("screen", "the screen is not one of this app's tools.".into())),
        }
    }
    if let Some(i18n) = entry.get("i18n").filter(|v| !v.is_null()) {
        out["i18n"] = texts(i18n)?;
    }
    Ok(out)
}

fn texts(i18n: &Value) -> Result<Value, Problem> {
    let bad = |why: String| Err(rule("i18n", why));
    let Some(langs) = i18n.as_object() else { return bad("i18n is an object by language.".into()) };
    for (lang, texts) in langs {
        if !LANGS.contains(&lang.as_str()) {
            return bad(format!("the app reads en, ru and es, not {lang:?}."));
        }
        let Some(texts) = texts.as_object() else { return bad(format!("i18n.{lang} is an object of texts.")) };
        for (key, text) in texts {
            if !TEXTS.contains(&key.as_str()) {
                return bad(format!("i18n.{lang} has no {key:?}."));
            }
            let text = text.as_str().unwrap_or_default();
            let max = if key == "tagline" { 55 } else { MAX_TEXT };
            if text.trim().is_empty() || text.chars().count() > max || text.chars().any(char::is_control) {
                return bad(format!("i18n.{lang}.{key} is one line of 1 to {max} characters."));
            }
        }
    }
    Ok(i18n.clone())
}

/// What `entry` adds: a compiled-in tool's presentation, or a new tool's catalog entry.
pub fn read(entry: &Value, builtin: &Catalog) -> Result<Read, Problem> {
    let shown = presentation(entry, builtin)?;
    let id = shown["id"].as_str().unwrap_or_default();
    if let Some(ours) = builtin.tools.iter().find(|t| t.id == id) {
        // The list names a compiled-in tool by its id; the package makes sure it means the same tool.
        if entry["package"].as_str() != Some(ours.package.as_str()) {
            return Err(rule("package", format!("{id} is built in with the package {}.", ours.package)));
        }
        return Ok(Read::BuiltIn(shown));
    }
    new_entry(entry, &shown).map(Read::New)
}

fn new_entry(entry: &Value, shown: &Value) -> Result<Value, Problem> {
    let mut e: Map<String, Value> =
        crate::own_tools::desktop_entry(&entry["desktop"]).map_err(|(key, why)| rule(&key, why))?;
    let en = &shown["i18n"]["en"];
    let text = |key: &str, fallback: &Value| en.get(key).filter(|v| v.is_string()).unwrap_or(fallback).clone();
    let name = text("name", &entry["name"]);
    if name.as_str().is_none_or(|n| n.trim().is_empty()) {
        return Err(rule("name", "a tool new to this app needs a name.".into()));
    }
    let tagline = text("tagline", &e["tagline"]);
    let summary = text("summary", &entry["summary"]);
    if let Some(sign_in) = e.get_mut("signIn").and_then(Value::as_object_mut) {
        for key in ["gives", "asks"] {
            if let Some(t) = en.get(key).filter(|v| v.is_string()) {
                sign_in.insert(key.into(), t.clone());
            }
        }
    }
    // The tool's own manifest names its port (NEED-2918); the list's is for a release that does not name one yet.
    if e["mcpServer"].is_object() {
        match e["mcpServer"]["port"].as_u64().or_else(|| entry["mcpPort"].as_u64()) {
            Some(port) => e["mcpServer"]["port"] = json!(port),
            None => return Err(rule("mcpServer", "its MCP server has no port in its manifest or the list.".into())),
        }
    }
    for (key, value) in [
        ("id", shown["id"].clone()),
        ("name", name),
        ("tagline", tagline),
        ("summary", summary),
        ("bin", entry["bin"].clone()),
        ("package", entry["package"].clone()),
        ("repo", entry["repo"].clone()),
        ("docs", entry["docs"].clone()),
        ("summaries", entry["summaries"].clone()),
    ] {
        e.insert(key.into(), value);
    }
    for key in ["i18n", "icon", "screen"] {
        if let Some(v) = shown.get(key) {
            e.insert(key.into(), v.clone());
        }
    }
    Ok(Value::Object(e))
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::catalog::catalog;

    /// An official entry as cli-docs writes it, for a tool this app does not have.
    pub fn beeline() -> Value {
        let mut e = json!({
            "id": "beeline",
            "name": "Beeline",
            "package": "@wirecat/beeline-cli",
            "repo": "https://github.com/WireCatLabs/beeline-cli",
            "docs": "https://wirecat.dev/en/docs/beeline",
            "summary": "Beeline calls for your agent.",
            "summaries": { "en": "Beeline calls for your agent.", "ru": "Звонки Билайна для агента." },
            "bin": "wcat-beeline",
            "version": "0.5.0",
            "manifestSha256": "a".repeat(64),
            "mcpPort": 8740,
            "icon": "M2 2h20v20H2z",
            "i18n": { "ru": { "tagline": "Звонки и записи" } }
        });
        e["desktop"] = desktop();
        e
    }

    fn desktop() -> Value {
        json!({
            "tagline": "Beeline calls, searchable",
            "profiles": { "args": ["session", "list", "--no-record", "--json"], "shape": "items" },
            "doctor": ["{profile}", "doctor", "--record", "--json"],
            "runs": null,
            "search": null,
            "setup": ["{profile}", "session", "start"],
            "signIn": { "gives": "Your calls.", "asks": "A token." },
            "skill": null,
            "mcpServer": { "start": ["mcp", "server", "start", "--port", "{port}"], "stop": ["mcp", "server", "stop"],
                "status": ["mcp", "server", "status"], "revoke": ["mcp", "revoke"], "config": null },
            "tasks": null,
            "sync": { "run": ["{profile}", "sync", "--record", "--json"], "last": null, "lastShape": "runs",
                "what": "your calls", "note": null },
            "storeInfo": null, "storeTables": null, "storeTableSizes": null, "storeCheck": null,
            "storeBackup": null, "storeBackupEncrypted": null, "storeResetPreview": null, "storeReset": null,
            "storage": { "app": "beeline-cli", "env": "WCBEELINE" },
            "settings": null,
            "meetings": { "provider": "beeline", "show": ["{profile}", "meetings", "show", "{id}"],
                "transcript": ["{profile}", "meetings", "transcript", "{id}"] }
        })
    }

    fn new(entry: &Value) -> Value {
        match read(entry, catalog()).unwrap() {
            Read::New(v) => v,
            other @ Read::BuiltIn(_) => panic!("not new: {other:?}"),
        }
    }

    #[test]
    fn a_new_tool_is_its_manifest_with_the_lists_name_port_and_texts() {
        let e = new(&beeline());
        assert_eq!(
            (e["id"].as_str(), e["name"].as_str(), e["bin"].as_str()),
            (Some("beeline"), Some("Beeline"), Some("wcat-beeline"))
        );
        assert_eq!(e["mcpServer"]["port"], 8740);
        assert_eq!(e["sync"]["what"], "records", "free text becomes the closed list's records");
        let mut named = beeline();
        named["desktop"]["mcpServer"]["port"] = json!(8741);
        assert_eq!(new(&named)["mcpServer"]["port"], 8741, "the manifest's port wins over the list's");
        assert_eq!(e["i18n"]["ru"]["tagline"], "Звонки и записи");
        assert_eq!(e["summaries"]["ru"], "Звонки Билайна для агента.");
        assert!(e["community"].is_null());
        let mut english = beeline();
        english["i18n"] = json!({ "en": { "tagline": "Calls", "gives": "Calls and records." } });
        let e = new(&english);
        assert_eq!((e["tagline"].as_str(), e["signIn"]["gives"].as_str()), (Some("Calls"), Some("Calls and records.")));
    }

    #[test]
    fn a_built_in_tool_takes_only_its_presentation() {
        let mut tg = beeline();
        tg["id"] = json!("bitrix");
        tg["package"] = json!("@wirecat/bitrix24-cli");
        tg["screen"] = json!("pbx");
        let Read::BuiltIn(shown) = read(&tg, catalog()).unwrap() else { panic!("not built in") };
        assert_eq!(
            shown,
            json!({ "id": "bitrix", "icon": "M2 2h20v20H2z", "screen": "pbx",
            "i18n": { "ru": { "tagline": "Звонки и записи" } } })
        );
        tg["package"] = json!("@wirecat/other-cli");
        assert!(read(&tg, catalog()).unwrap_err().to_string().contains("built in with the package"));
    }

    #[test]
    fn refuses_an_icon_that_could_load_something_and_a_bots_screen() {
        for icon in ["<path d=\"M0 0\"/>", "M0 0 url(x)", "", &"M1 1".repeat(600)] {
            let mut e = beeline();
            e["icon"] = json!(icon);
            assert!(read(&e, catalog()).unwrap_err().to_string().contains("SVG path"), "{icon}");
        }
        for (screen, why) in [("tg", "need a bot"), ("nobody", "not one of")] {
            let mut e = beeline();
            e["screen"] = json!(screen);
            assert!(read(&e, catalog()).unwrap_err().to_string().contains(why), "{screen}");
        }
    }

    #[test]
    fn refuses_texts_it_cannot_show_and_a_server_without_a_port() {
        for i18n in [
            json!({ "de": {} }),
            json!({ "ru": { "motto": "x" } }),
            json!({ "ru": { "tagline": "x".repeat(56) } }),
            json!({ "es": { "summary": "a\nb" } }),
        ] {
            let mut e = beeline();
            e["i18n"] = i18n.clone();
            assert!(read(&e, catalog()).is_err(), "{i18n}");
        }
        let mut e = beeline();
        e["mcpPort"] = Value::Null;
        assert!(read(&e, catalog()).unwrap_err().to_string().contains("no port"));
        let mut e = beeline();
        e["name"] = Value::Null;
        assert!(read(&e, catalog()).unwrap_err().to_string().contains("needs a name"));
    }
}
