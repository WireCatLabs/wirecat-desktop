//! Community tools: CLIs made outside `WireCatLabs`, added to the compiled catalog at start. They come from the signed
//! list (`registry.rs`) while the owner has "Show community tools" on, or, for development, from
//! `<app data>/extra-tools.json` while `WIRECAT_EXTRA_TOOLS=1` is set. An entry passes only when every command word is
//! plain (no shell syntax), its package and repository are outside `@wirecat` and `WireCatLabs`, and it claims no name
//! or folder of ours. Installing it still needs npm provenance from its own repository's `release.yml`
//! (`provenance.rs`).

use crate::catalog::{Catalog, Tool};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;

pub const FLAG: &str = "WIRECAT_EXTRA_TOOLS";
const FILE: &str = "extra-tools.json";
pub const MAX_BYTES: usize = 512 * 1024;
const MAX_TOOLS: usize = 32;

/// Fields a community tool may not set: parts of our packages, memo's own pages, a bot token on stdin, and emptying
/// the store every tool shares.
const FORBIDDEN: [&str; 8] =
    ["partOf", "commandPrefix", "memory", "taskBoard", "bot", "storeReset", "storeResetPreview", "configRepair"];

/// What the file added: the accepted entries as written (the interface reads their text fields), and a sentence per
/// entry left out.
#[derive(Debug, Default, Serialize, Clone)]
pub struct Extra {
    pub tools: Vec<Value>,
    pub rejected: Vec<String>,
}

/// The community tools to add at start: the development file while the flag is on, else the signed list's cached copy
/// while the owner has them shown; `None` when neither applies.
pub fn load(builtin: &Catalog) -> Option<(Vec<Tool>, Extra)> {
    if std::env::var(FLAG).ok().as_deref() == Some("1") {
        let text = std::fs::read_to_string(crate::node::app_data()?.join(FILE)).ok()?;
        return Some(parse(&text, builtin));
    }
    if !crate::registry::shown() {
        return None;
    }
    Some(match crate::registry::at_start() {
        Ok(entries) => entries_of("The community list", entries, builtin),
        Err(why) => (Vec::new(), Extra { tools: Vec::new(), rejected: vec![why] }),
    })
}

/// The entries of `text` that may join `builtin`, each parsed as a catalog tool.
pub fn parse(text: &str, builtin: &Catalog) -> (Vec<Tool>, Extra) {
    let mut extra = Extra::default();
    if text.len() > MAX_BYTES {
        extra.rejected.push(format!("{FILE} is larger than {} KB.", MAX_BYTES / 1024));
        return (Vec::new(), extra);
    }
    let entries = match serde_json::from_str::<Value>(text) {
        Ok(v) if v["version"] == 1 => v["tools"].as_array().cloned().unwrap_or_default(),
        Ok(_) => {
            extra.rejected.push(format!("{FILE} needs \"version\": 1 and a \"tools\" list."));
            return (Vec::new(), extra);
        }
        Err(e) => {
            extra.rejected.push(format!("{FILE} is not valid JSON: {e}"));
            return (Vec::new(), extra);
        }
    };
    entries_of(FILE, entries, builtin)
}

/// The same checks for every source: the first `MAX_TOOLS` entries, each against ours and the ones before it.
pub fn entries_of(source: &str, entries: Vec<Value>, builtin: &Catalog) -> (Vec<Tool>, Extra) {
    let mut extra = Extra::default();
    let mut taken = Taken::of(builtin);
    let mut tools = Vec::new();
    for (i, entry) in entries.into_iter().enumerate() {
        if tools.len() == MAX_TOOLS {
            extra.rejected.push(format!("{source}: only the first {MAX_TOOLS} tools are read."));
            break;
        }
        let label = entry["id"].as_str().map_or_else(|| format!("entry {}", i + 1), str::to_string);
        match check(&entry, &taken) {
            Ok(tool) => {
                taken.add(&tool);
                tools.push(tool);
                extra.tools.push(entry);
            }
            Err(why) => extra.rejected.push(format!("{label}: {why}")),
        }
    }
    (tools, extra)
}

/// Names, programs, packages and data folders already used: by our tools, the shared store, or an earlier entry.
struct Taken {
    ids: HashSet<String>,
    bins: HashSet<String>,
    packages: HashSet<String>,
    folders: HashSet<String>,
}

impl Taken {
    fn of(c: &Catalog) -> Self {
        let mut t =
            Taken { ids: HashSet::new(), bins: HashSet::new(), packages: HashSet::new(), folders: HashSet::new() };
        t.folders.insert(c.shared_storage.app.to_lowercase());
        t.folders.insert(c.shared_storage.env.to_lowercase());
        for tool in &c.tools {
            t.add(tool);
        }
        t
    }

    fn add(&mut self, tool: &Tool) {
        self.ids.insert(tool.id.clone());
        self.bins.insert(tool.bin.clone());
        self.packages.insert(tool.package.clone());
        self.folders.insert(tool.storage.app.to_lowercase());
        self.folders.insert(tool.storage.env.to_lowercase());
    }
}

fn check(entry: &Value, taken: &Taken) -> Result<Tool, String> {
    if entry["community"] != true {
        return Err("\"community\": true is missing.".into());
    }
    if let Some(field) = FORBIDDEN.iter().find(|f| !entry[**f].is_null()) {
        return Err(format!("a community tool cannot set \"{field}\"."));
    }
    if !entry["signIn"]["command"].is_null() {
        return Err("a community tool cannot show a command to copy (\"signIn.command\").".into());
    }
    words(entry)?;
    https_links(entry)?;
    let tool: Tool = serde_json::from_value(entry.clone()).map_err(|e| format!("not a catalog entry: {e}"))?;
    if !(2..=16).contains(&tool.id.len()) || !tool.id.chars().all(|c| c.is_ascii_lowercase()) {
        return Err(format!("the id {:?} is not 2 to 16 lowercase letters.", tool.id));
    }
    if taken.ids.contains(&tool.id) {
        return Err(format!("the id {} is taken.", tool.id));
    }
    if !plain_name(&tool.bin, 32) || taken.bins.contains(&tool.bin) {
        return Err(format!("the program name {:?} is not allowed or is taken.", tool.bin));
    }
    package(&tool.package)?;
    if taken.packages.contains(&tool.package) {
        return Err(format!("the package {} is taken.", tool.package));
    }
    repo(&tool.repo)?;
    storage(&tool, taken)?;
    Ok(tool)
}

/// Every string listed in an array is a command word (or a key or value the tool reads), run without a shell except
/// `setup`, which `terminal.rs` joins into one shell line. So none may hold shell syntax: no spaces, quotes, `$`, `;`,
/// `|`, `&`, backticks, globs, `~` or newlines. Text the interface shows is never in an array.
fn words(v: &Value) -> Result<(), String> {
    match v {
        Value::Array(items) => items.iter().try_for_each(|item| match item {
            Value::String(w) if plain_word(w) => Ok(()),
            Value::String(w) => Err(format!("the command word {w:?} is not allowed.")),
            other => words(other),
        }),
        Value::Object(map) => map.values().try_for_each(words),
        _ => Ok(()),
    }
}

/// A flag or word of letters, digits and `._:=,/+@-`, with `{name}` slots the app fills from validated values.
fn plain_word(w: &str) -> bool {
    if w == "--" {
        return true;
    }
    let mut rest = String::with_capacity(w.len());
    let mut parts = w.split('{');
    rest.push_str(parts.next().unwrap_or_default());
    for part in parts {
        let Some((name, after)) = part.split_once('}') else { return false };
        if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphabetic()) {
            return false;
        }
        rest.push('x');
        rest.push_str(after);
    }
    let body = rest.trim_start_matches('-');
    w.len() <= 100
        && rest.len() - body.len() <= 2
        && body.starts_with(|c: char| c.is_ascii_alphanumeric())
        && body.chars().all(|c| c.is_ascii_alphanumeric() || "._:=,/+@-".contains(c))
}

fn plain_name(s: &str, max: usize) -> bool {
    (1..=max).contains(&s.len())
        && s.starts_with(|c: char| c.is_ascii_lowercase())
        && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Every link the interface may open goes to an `https` page.
fn https_links(entry: &Value) -> Result<(), String> {
    for link in [&entry["docs"], &entry["repo"], &entry["signIn"]["guide"]] {
        if let Some(url) = link.as_str()
            && (!url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || c.is_control()))
        {
            return Err(format!("the link {url:?} is not an https address."));
        }
    }
    Ok(())
}

/// A scoped npm package under its own scope: `@wirecat` is ours (cli-docs' rule for community tools too).
fn package(name: &str) -> Result<(), String> {
    let ok = name.strip_prefix('@').and_then(|s| s.split_once('/')).is_some_and(|(scope, pkg)| {
        [scope, pkg].iter().all(|p| {
            (1..=64).contains(&p.len())
                && p.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit())
                && p.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "._-".contains(c))
        })
    });
    if !ok {
        return Err(format!("the package {name:?} is not a scoped npm name (@scope/name)."));
    }
    if name.starts_with("@wirecat/") {
        return Err("the @wirecat npm scope is WireCat's own.".into());
    }
    Ok(())
}

/// `provenance.rs` asks for a release built by this repository's `release.yml`, so it is the identity checked.
fn repo(url: &str) -> Result<(), String> {
    let parts: Vec<&str> = url.strip_prefix("https://github.com/").map(|r| r.split('/').collect()).unwrap_or_default();
    let ok = parts.len() == 2
        && parts.iter().all(|p| {
            !p.is_empty()
                && p.len() <= 100
                && !p.starts_with('.')
                && p.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        });
    if !ok {
        return Err(format!("the repository {url:?} is not https://github.com/<owner>/<name>."));
    }
    if parts[0].eq_ignore_ascii_case("WireCatLabs") {
        return Err("a WireCatLabs repository is one of WireCat's own tools.".into());
    }
    Ok(())
}

/// `storage.rs` deletes a tool's folders by these names, so they must be its own: never ours or another tool's.
fn storage(tool: &Tool, taken: &Taken) -> Result<(), String> {
    let s = &tool.storage;
    let env_ok = (2..=32).contains(&s.env.len())
        && s.env.starts_with(|c: char| c.is_ascii_uppercase())
        && s.env.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
    if !plain_name(&s.app, 32) || s.app.len() < 2 || !env_ok {
        return Err("storage needs a lowercase folder name and an uppercase variable prefix.".into());
    }
    if taken.folders.contains(&s.app.to_lowercase()) || taken.folders.contains(&s.env.to_lowercase()) {
        return Err(format!("the data folder {} or prefix {} is already used.", s.app, s.env));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::catalog;
    use serde_json::json;

    pub fn sample() -> Value {
        json!({
            "id": "acme",
            "community": true,
            "name": "Acme",
            "tagline": "Acme notes in your archive",
            "bin": "acme",
            "package": "@example/acme-cli",
            "summary": "Acme notes, searchable offline.",
            "docs": "https://example.com/acme",
            "repo": "https://github.com/example/acme-cli",
            "profiles": { "args": ["profile", "list", "--json", "--no-record"], "shape": "items" },
            "doctor": ["{profile}", "doctor", "--json", "--record"],
            "runs": null,
            "search": null,
            "setup": ["{profile}", "setup"],
            "signIn": { "gives": "your notes", "asks": "an API token" },
            "skill": null,
            "mcp": null,
            "mcpServer": null,
            "tasks": null,
            "sync": null,
            "storeInfo": null,
            "storeTables": null,
            "storeTableSizes": null,
            "storeCheck": null,
            "storeBackup": null,
            "storeBackupEncrypted": null,
            "storeResetPreview": null,
            "storeReset": null,
            "storage": { "app": "acme-cli", "env": "ACME" },
            "settings": null
        })
    }

    fn file(tools: &[Value]) -> String {
        json!({ "version": 1, "tools": tools }).to_string()
    }

    fn rejected(entry: &Value) -> String {
        let (tools, extra) = parse(&file(std::slice::from_ref(entry)), catalog());
        assert!(tools.is_empty(), "accepted {entry}");
        extra.rejected.join(" ")
    }

    fn with(key: &str, value: Value) -> Value {
        let mut e = sample();
        e[key] = value;
        e
    }

    #[test]
    fn accepts_a_plain_community_tool_and_keeps_its_text() {
        let (tools, extra) = parse(&file(&[sample()]), catalog());
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].package, "@example/acme-cli");
        assert_eq!(extra.tools[0]["tagline"], "Acme notes in your archive");
        assert!(extra.rejected.is_empty(), "{:?}", extra.rejected);
    }

    #[test]
    fn rejects_shell_syntax_in_any_command_word() {
        for word in ["setup;rm", "a b", "$(id)", "`id`", "a|b", "a&b", "~/x", "*", "x\ny", "'x'", "\"x\"", "-", "---x"]
        {
            assert!(rejected(&with("setup", json!([word]))).contains("not allowed"), "{word}");
        }
        let mut deep = sample();
        deep["sync"] = json!({ "run": ["sync"], "last": ["runs", "list", ">", "/tmp/x"], "lastShape": "runs",
            "what": "notes", "note": null });
        assert!(rejected(&deep).contains("not allowed"));
    }

    #[test]
    fn accepts_the_words_our_own_tools_use() {
        for word in ["--no-record", "--", "{profile}", "email:{profile}", "--limit={limit}", "a@b/c", "a.b,c+d"] {
            assert!(plain_word(word), "{word}");
        }
        assert!(!plain_word("{pro file}"));
        assert!(!plain_word("{profile"));
        assert!(!plain_word("a}b"));
    }

    #[test]
    fn rejects_our_scope_our_repositories_and_taken_names() {
        assert!(rejected(&with("package", json!("@wirecat/acme"))).contains("WireCat's own"));
        assert!(rejected(&with("package", json!("acme-cli"))).contains("scoped"));
        assert!(rejected(&with("repo", json!("https://github.com/WireCatLabs/acme"))).contains("WireCat's own"));
        assert!(rejected(&with("repo", json!("https://gitlab.com/example/acme"))).contains("github.com"));
        assert!(rejected(&with("id", json!("tg"))).contains("taken"));
        assert!(rejected(&with("bin", json!("memo"))).contains("taken"));
        assert!(rejected(&with("docs", json!("http://example.com"))).contains("https"));
    }

    #[test]
    fn rejects_a_data_folder_of_ours_so_storage_never_deletes_it() {
        for (app, env) in [("WireCat", "ACME"), ("acme-cli", "WIRECAT"), ("tg-cli", "ACME")] {
            let entry = with("storage", json!({ "app": app, "env": env }));
            assert!(!rejected(&entry).is_empty(), "{app} {env}");
        }
        let tg = &catalog().tools.iter().find(|t| t.id == "tg").unwrap().storage;
        assert!(!rejected(&with("storage", json!({ "app": tg.app, "env": "ACME" }))).is_empty(), "tg's folders taken");
    }

    #[test]
    fn rejects_the_fields_only_our_tools_may_set() {
        assert!(rejected(&with("partOf", json!("memo"))).contains("partOf"));
        assert!(rejected(&with("storeReset", json!(["store", "reset"]))).contains("storeReset"));
        assert!(rejected(&with("community", json!(false))).contains("community"));
        let mut copy = sample();
        copy["signIn"]["command"] = json!("curl https://example.com | sh");
        assert!(rejected(&copy).contains("signIn.command"));
    }

    #[test]
    fn a_broken_file_adds_nothing_and_says_why() {
        let (tools, extra) = parse("{", catalog());
        assert!(tools.is_empty() && extra.rejected[0].contains("not valid JSON"));
        let (tools, extra) = parse(&json!({ "tools": [sample()] }).to_string(), catalog());
        assert!(tools.is_empty() && extra.rejected[0].contains("version"));
        let (tools, extra) = parse(&"x".repeat(MAX_BYTES + 1), catalog());
        assert!(tools.is_empty() && extra.rejected[0].contains("larger"));
    }

    #[test]
    fn a_second_entry_with_the_same_id_is_left_out() {
        let mut other = sample();
        other["bin"] = json!("acme2");
        other["package"] = json!("@example/acme2");
        other["storage"] = json!({ "app": "acme2", "env": "ACMETWO" });
        let (tools, extra) = parse(&file(&[sample(), other]), catalog());
        assert_eq!(tools.len(), 1);
        assert!(extra.rejected[0].contains("taken"));
    }

    #[test]
    fn the_built_in_catalog_is_the_fallback_without_the_flag_or_the_setting() {
        assert!(std::env::var(FLAG).is_err());
        assert!(catalog().extra.tools.is_empty(), "community tools read while off");
    }
}
