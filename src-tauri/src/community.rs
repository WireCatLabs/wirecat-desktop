//! Community tools: CLIs made outside `WireCatLabs`, added to the compiled catalog at start. Two sources, read in
//! this order: the signed list (`registry.rs`) while "Enable community tools" is on, then the owner's own tools in
//! `<app data>/extra-tools.json` while the own-tools switch is on (`own_tools.rs`), or for development
//! while `WIRECAT_EXTRA_TOOLS=1` is set. An entry passes only when every command word is plain (no shell syntax), its
//! package and repository are outside `@wirecat` and `WireCatLabs`, and it claims no name or folder of ours or of an
//! entry read before it. A listed tool's install still needs npm provenance from its own repository's `release.yml`
//! (`provenance.rs`); an own tool's provenance is shown, not required.

use crate::catalog::{Catalog, Tool};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fmt;

pub const FLAG: &str = "WIRECAT_EXTRA_TOOLS";
pub const FILE: &str = "extra-tools.json";
pub const MAX_BYTES: usize = 512 * 1024;
const MAX_TOOLS: usize = 32;

/// Fields a community tool may not set: parts of our packages, memo's own pages, a bot token on stdin, and emptying
/// the store every tool shares.
pub const FORBIDDEN: [&str; 8] =
    ["partOf", "commandPrefix", "memory", "taskBoard", "bot", "storeReset", "storeResetPreview", "configRepair"];

/// Where a tool came from. The badge follows it, never a key in the entry, so a listed entry can neither claim nor
/// drop "Not checked".
#[derive(specta::Type, Serialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "ToolSource")]
pub enum Source {
    #[default]
    Official,
    Community,
    Own,
}

/// What the sources added: the accepted entries as written (the interface reads their text fields) with their source,
/// and a sentence per entry left out.
#[derive(specta::Type, Debug, Default, Serialize, Clone)]
#[serde(rename = "ExtraTools")]
pub struct Extra {
    pub tools: Vec<ExtraTool>,
    pub rejected: Vec<Rejected>,
}

#[derive(specta::Type, Debug, Serialize, Clone)]
pub struct ExtraTool {
    pub source: Source,
    #[specta(type = specta_typescript::Unknown)]
    pub entry: Value,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
pub struct Rejected {
    pub source: Source,
    pub text: String,
}

impl Extra {
    fn reject(&mut self, source: Source, text: String) {
        self.rejected.push(Rejected { source, text });
    }

    pub fn count(&self, source: Source) -> usize {
        self.tools.iter().filter(|t| t.source == source).count()
    }
}

/// Why an entry was left out. `Display` is the sentence the log and Settings show; own tools map each kind to a
/// refusal the dialog explains (`own_tools.rs`).
#[derive(Debug, PartialEq)]
pub enum Problem {
    Rule {
        key: String,
        rule: String,
    },
    /// The `@wirecat` scope or a `WireCatLabs` repository.
    Ours {
        key: String,
    },
    /// An id, program, package or data folder of a tool read before it; `listed` when that tool is from the signed list.
    Taken {
        key: String,
        value: String,
        with: String,
        listed: bool,
    },
}

impl fmt::Display for Problem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Problem::Rule { rule, .. } => f.write_str(rule),
            Problem::Ours { key } if key == "package" => f.write_str("the @wirecat npm scope is WireCat's own."),
            Problem::Ours { .. } => f.write_str("a WireCatLabs repository is one of WireCat's own tools."),
            Problem::Taken { key, value, with, listed } => {
                write!(f, "the {key} {value} is taken by {with}.")?;
                if *listed {
                    f.write_str(" This tool is now listed. Remove your own entry to use the listed one.")
                } else {
                    Ok(())
                }
            }
        }
    }
}

fn rule(key: &str, rule: String) -> Problem {
    Problem::Rule { key: key.into(), rule }
}

/// The community tools to add at start, `None` when neither source is on.
pub fn load(builtin: &Catalog) -> Option<(Vec<Tool>, Extra)> {
    let listed = crate::registry::shown().then(crate::registry::at_start);
    let own = (std::env::var(FLAG).ok().as_deref() == Some("1") || crate::own_tools::allowed())
        .then(|| crate::node::app_data().and_then(|d| std::fs::read_to_string(d.join(FILE)).ok()))
        .flatten();
    if listed.is_none() && own.is_none() {
        return None;
    }
    let mut out = Accepted::new(builtin);
    match listed {
        Some(Ok(entries)) => out.entries(Source::Community, "The community list", entries),
        Some(Err(why)) => out.extra.reject(Source::Community, why),
        None => {}
    }
    if let Some(text) = own {
        out.file(&text);
    }
    Some((out.tools, out.extra))
}

/// The entries of an own-tools file that may join `builtin`, each parsed as a catalog tool.
#[cfg(test)]
pub fn parse(text: &str, builtin: &Catalog) -> (Vec<Tool>, Extra) {
    let mut out = Accepted::new(builtin);
    out.file(text);
    (out.tools, out.extra)
}

/// The entries of an own-tools file as written, or why the file cannot be read.
pub fn file_entries(text: &str) -> Result<Vec<Value>, String> {
    if text.len() > MAX_BYTES {
        return Err(format!("{FILE} is larger than {} KB.", MAX_BYTES / 1024));
    }
    match serde_json::from_str::<Value>(text) {
        Ok(v) if v["version"] == 1 => Ok(v["tools"].as_array().cloned().unwrap_or_default()),
        Ok(_) => Err(format!("{FILE} needs \"version\": 1 and a \"tools\" list.")),
        Err(e) => Err(format!("{FILE} is not valid JSON: {e}")),
    }
}

/// One pass over every source: each entry is checked against ours and every entry accepted before it.
struct Accepted {
    taken: Taken,
    tools: Vec<Tool>,
    extra: Extra,
}

impl Accepted {
    fn new(builtin: &Catalog) -> Self {
        Accepted { taken: Taken::of(builtin, None), tools: Vec::new(), extra: Extra::default() }
    }

    fn file(&mut self, text: &str) {
        match file_entries(text) {
            Ok(entries) => self.entries(Source::Own, FILE, entries),
            Err(why) => self.extra.reject(Source::Own, why),
        }
    }

    fn entries(&mut self, source: Source, label: &str, entries: Vec<Value>) {
        for (i, entry) in entries.into_iter().enumerate() {
            if self.extra.count(source) == MAX_TOOLS {
                self.extra.reject(source, format!("{label}: only the first {MAX_TOOLS} tools are read."));
                break;
            }
            let name = entry["id"].as_str().map_or_else(|| format!("entry {}", i + 1), str::to_string);
            match check(&entry, &self.taken, source) {
                Ok(tool) => {
                    self.taken.add(&tool);
                    self.tools.push(tool);
                    self.extra.tools.push(ExtraTool { source, entry });
                }
                Err(why) => self.extra.reject(source, format!("{name}: {why}")),
            }
        }
    }
}

struct Owner {
    name: String,
    listed: bool,
}

/// Names, programs, packages and data folders already used, each with the tool that uses it: ours, the shared store,
/// or an earlier entry.
pub struct Taken {
    ids: HashMap<String, Owner>,
    bins: HashMap<String, Owner>,
    packages: HashMap<String, Owner>,
    folders: HashMap<String, Owner>,
    ports: HashMap<String, Owner>,
}

impl Taken {
    /// Every tool of `c` except the own tool with package `except`, which its update replaces. A listed or official
    /// tool with that package stays: adding it as an own tool is a collision.
    pub fn of(c: &Catalog, except: Option<&str>) -> Self {
        let mut t = Taken {
            ids: HashMap::new(),
            bins: HashMap::new(),
            packages: HashMap::new(),
            folders: HashMap::new(),
            ports: HashMap::new(),
        };
        for key in [&c.shared_storage.app, &c.shared_storage.env] {
            t.folders.insert(key.to_lowercase(), Owner { name: "the shared WireCat store".into(), listed: false });
        }
        for tool in c.tools.iter().filter(|tool| tool.source != Source::Own || Some(tool.package.as_str()) != except) {
            t.add(tool);
        }
        t
    }

    pub fn add(&mut self, tool: &Tool) {
        let owner = || Owner { name: tool.name.clone(), listed: tool.source == Source::Community };
        self.ids.insert(tool.id.clone(), owner());
        self.bins.insert(tool.bin.clone(), owner());
        self.packages.insert(tool.package.clone(), owner());
        self.folders.insert(tool.storage.app.to_lowercase(), owner());
        self.folders.insert(tool.storage.env.to_lowercase(), owner());
        if let Some(port) = tool.mcp_server.as_ref().and_then(|m| m.port) {
            self.ports.insert(port.to_string(), owner());
        }
    }

    pub fn port_free(&self, port: u64) -> bool {
        !self.ports.contains_key(&port.to_string())
    }

    fn free(map: &HashMap<String, Owner>, key: &str, value: &str, lookup: &str) -> Result<(), Problem> {
        map.get(lookup).map_or(Ok(()), |o| {
            Err(Problem::Taken { key: key.into(), value: value.into(), with: o.name.clone(), listed: o.listed })
        })
    }
}

/// Every rule an entry of `source` must pass. An own tool's repository may be missing, since a private or non-GitHub
/// repository can still be added on the owner's own computer; then no provenance can be checked.
pub fn check(entry: &Value, taken: &Taken, source: Source) -> Result<Tool, Problem> {
    if entry["community"] != true {
        return Err(rule("community", "\"community\": true is missing.".into()));
    }
    if let Some(field) = FORBIDDEN.iter().find(|f| !entry[**f].is_null()) {
        return Err(rule(field, format!("a community tool cannot set \"{field}\".")));
    }
    if !entry["signIn"]["command"].is_null() {
        return Err(rule("signIn", "a community tool cannot show a command to copy (\"signIn.command\").".into()));
    }
    words(entry)?;
    https_links(entry)?;
    let mut tool: Tool =
        serde_json::from_value(entry.clone()).map_err(|e| rule("entry", format!("not a catalog entry: {e}")))?;
    tool.source = source;
    if !(2..=16).contains(&tool.id.len()) || !tool.id.chars().all(|c| c.is_ascii_lowercase()) {
        return Err(rule("id", format!("the id {:?} is not 2 to 16 lowercase letters.", tool.id)));
    }
    Taken::free(&taken.ids, "id", &tool.id, &tool.id)?;
    if !plain_name(&tool.bin, 32) {
        return Err(rule("bin", format!("the program name {:?} is not allowed.", tool.bin)));
    }
    Taken::free(&taken.bins, "program", &tool.bin, &tool.bin)?;
    package(&tool.package)?;
    Taken::free(&taken.packages, "package", &tool.package, &tool.package)?;
    if !(source == Source::Own && entry["repo"].is_null()) {
        repo(&tool.repo)?;
    }
    // `<scope>-<name>` of an own tool's package is often longer than a listed tool's folder.
    storage(&tool, taken, if source == Source::Own { 64 } else { 32 })?;
    if source == Source::Own {
        own_storage(&tool)?;
    }
    if let Some(port) = tool.mcp_server.as_ref().and_then(|m| m.port) {
        Taken::free(&taken.ports, "port", &port.to_string(), &port.to_string())?;
    }
    Ok(tool)
}

/// `storage.rs` deletes an own tool's folders by `storage.app`, so it must be the tool's own: `<scope>-<name>` of its
/// npm package `@<scope>/<name>`, or that and `-` and more. Only the scope's owner can publish under a scope; the
/// unscoped name alone proves nothing (`@evil/gh`), nor does the manifest's own name.
fn own_storage(tool: &Tool) -> Result<(), Problem> {
    let folder = tool.package.trim_start_matches('@').replacen('/', "-", 1).to_lowercase();
    let app = tool.storage.app.to_lowercase();
    if app == folder || app.strip_prefix(&folder).is_some_and(|rest| rest.starts_with('-')) {
        return Ok(());
    }
    Err(rule(
        "storage",
        format!("the data folder {} must be {folder}, or start with {folder}-, after the package.", tool.storage.app),
    ))
}

/// Every string listed in an array is a command word (or a key or value the tool reads), run without a shell except
/// `setup`, which `terminal.rs` joins into one shell line. So none may hold shell syntax: no spaces, quotes, `$`, `;`,
/// `|`, `&`, backticks, globs, `~` or newlines. Text the interface shows is never in an array.
fn words(v: &Value) -> Result<(), Problem> {
    words_in("entry", v)
}

fn words_in(key: &str, v: &Value) -> Result<(), Problem> {
    match v {
        Value::Array(items) => items.iter().try_for_each(|item| match item {
            Value::String(w) if plain_word(w) => Ok(()),
            Value::String(w) => Err(rule(key, format!("the command word {w:?} is not allowed."))),
            other => words_in(key, other),
        }),
        Value::Object(map) => map.iter().try_for_each(|(k, v)| words_in(if key == "entry" { k } else { key }, v)),
        _ => Ok(()),
    }
}

/// A flag or word of letters, digits and `._:=,/+@-`, with `{name}` slots the app fills from validated values.
pub fn plain_word(w: &str) -> bool {
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
fn https_links(entry: &Value) -> Result<(), Problem> {
    for (key, link) in [("docs", &entry["docs"]), ("repo", &entry["repo"]), ("signIn", &entry["signIn"]["guide"])] {
        if let Some(url) = link.as_str()
            && (!url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || c.is_control()))
        {
            return Err(rule(key, format!("the link {url:?} is not an https address.")));
        }
    }
    Ok(())
}

/// A scoped npm package under its own scope: `@wirecat` is ours (cli-docs' rule for community tools too). Checked
/// before the shape, so a `@wirecat/` name is told as ours, not as a bad name.
pub fn package(name: &str) -> Result<(), Problem> {
    if name.starts_with("@wirecat/") {
        return Err(Problem::Ours { key: "package".into() });
    }
    let ok = name.strip_prefix('@').and_then(|s| s.split_once('/')).is_some_and(|(scope, pkg)| {
        [scope, pkg].iter().all(|p| {
            (1..=64).contains(&p.len())
                && p.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit())
                && p.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "._-".contains(c))
        })
    });
    if !ok {
        return Err(rule("package", format!("the package {name:?} is not a scoped npm name (@scope/name).")));
    }
    Ok(())
}

/// `provenance.rs` asks for a release built by this repository's `release.yml`, so it is the identity checked.
pub fn repo(url: &str) -> Result<(), Problem> {
    let parts: Vec<&str> = url.strip_prefix("https://github.com/").map(|r| r.split('/').collect()).unwrap_or_default();
    let ok = parts.len() == 2
        && parts.iter().all(|p| {
            !p.is_empty()
                && p.len() <= 100
                && !p.starts_with('.')
                && p.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        });
    if !ok {
        return Err(rule("repo", format!("the repository {url:?} is not https://github.com/<owner>/<name>.")));
    }
    if parts[0].eq_ignore_ascii_case("WireCatLabs") {
        return Err(Problem::Ours { key: "repo".into() });
    }
    Ok(())
}

/// `storage.rs` deletes a tool's folders by these names, so they must be its own: never ours or another tool's.
fn storage(tool: &Tool, taken: &Taken, max_folder: usize) -> Result<(), Problem> {
    let s = &tool.storage;
    let env_ok = (2..=32).contains(&s.env.len())
        && s.env.starts_with(|c: char| c.is_ascii_uppercase())
        && s.env.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
    if !plain_name(&s.app, max_folder) || s.app.len() < 2 || !env_ok {
        return Err(rule("storage", "storage needs a lowercase folder name and an uppercase variable prefix.".into()));
    }
    Taken::free(&taken.folders, "data folder", &s.app, &s.app.to_lowercase())?;
    Taken::free(&taken.folders, "data prefix", &s.env, &s.env.to_lowercase())
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
            "storage": { "app": "example-acme-cli", "env": "ACME" },
            "settings": null
        })
    }

    fn file(tools: &[Value]) -> String {
        json!({ "version": 1, "tools": tools }).to_string()
    }

    fn rejected(entry: &Value) -> String {
        let (tools, extra) = parse(&file(std::slice::from_ref(entry)), catalog());
        assert!(tools.is_empty(), "accepted {entry}");
        texts(&extra)
    }

    fn texts(extra: &Extra) -> String {
        extra.rejected.iter().map(|r| r.text.as_str()).collect::<Vec<_>>().join(" ")
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
        assert_eq!(extra.tools[0].entry["tagline"], "Acme notes in your archive");
        assert!(extra.rejected.is_empty(), "{:?}", extra.rejected);
        assert_eq!((extra.tools[0].source, tools[0].source), (Source::Own, Source::Own));
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
    fn an_own_tools_data_folder_is_named_after_its_scope_and_name() {
        for app in ["gh", "keyrings", "nvim", "google-chrome"] {
            let mut evil = with("storage", json!({ "app": app, "env": "ACME" }));
            evil["package"] = json!(format!("@evil/{app}"));
            evil["own"] = json!({ "name": app });
            assert!(rejected(&evil).contains("must be evil-"), "{app}");
        }
        let mut mine = with("package", json!("@leemour/acme-crm-cli"));
        for (app, ok) in [("leemour-acme-crm-cli", true), ("leemour-acme-crm-cli-data", true), ("acme-crm-cli", false)]
        {
            mine["storage"] = json!({ "app": app, "env": "ACME_CRM" });
            assert_eq!(parse(&file(std::slice::from_ref(&mine)), catalog()).0.len(), usize::from(ok), "{app}");
        }
    }

    #[test]
    fn a_port_of_another_tool_is_refused_at_start() {
        let tg = catalog().tools.iter().find(|t| t.id == "tg").unwrap();
        let port = tg.mcp_server.as_ref().and_then(|m| m.port).expect("tg's port");
        let server = json!({ "port": port, "start": ["mcp", "server", "start"], "stop": ["mcp", "server", "stop"],
            "status": ["mcp", "server", "status"], "revoke": ["mcp", "revoke"], "config": null });
        assert!(rejected(&with("mcpServer", server)).contains("port"));
    }

    #[test]
    fn official_ports_are_distinct_and_a_listed_port_clash_is_left_out_with_a_sentence() {
        let mut ports: Vec<u64> = catalog()
            .tools
            .iter()
            .filter(|t| t.part_of.is_none())
            .filter_map(|t| t.mcp_server.as_ref().and_then(|m| m.port))
            .collect();
        let count = ports.len();
        ports.sort_unstable();
        ports.dedup();
        assert_eq!(ports.len(), count, "two official tools share a port");

        let tg = catalog().tools.iter().find(|t| t.id == "tg").unwrap();
        let port = tg.mcp_server.as_ref().and_then(|m| m.port).unwrap();
        let mut listed = sample();
        listed["mcpServer"] = json!({ "port": port, "start": ["mcp", "server", "start"], "stop": ["mcp", "server", "stop"],
            "status": ["mcp", "server", "status"], "revoke": ["mcp", "revoke"], "config": null });
        let mut out = Accepted::new(catalog());
        out.entries(Source::Community, "The community list", vec![listed]);
        assert_eq!(out.tools.len(), 0, "left out");
        let left = &out.extra.rejected[0];
        assert_eq!(left.source, Source::Community, "Settings lists it under Enable community tools");
        assert_eq!(left.text, format!("acme: the port {port} is taken by Telegram."));
    }

    #[test]
    fn a_broken_file_adds_nothing_and_says_why() {
        let (tools, extra) = parse("{", catalog());
        assert!(tools.is_empty() && extra.rejected[0].text.contains("not valid JSON"));
        let (tools, extra) = parse(&json!({ "tools": [sample()] }).to_string(), catalog());
        assert!(tools.is_empty() && extra.rejected[0].text.contains("version"));
        let (tools, extra) = parse(&"x".repeat(MAX_BYTES + 1), catalog());
        assert!(tools.is_empty() && extra.rejected[0].text.contains("larger"));
    }

    #[test]
    fn a_second_entry_with_the_same_id_is_left_out() {
        let mut other = sample();
        other["bin"] = json!("acme2");
        other["package"] = json!("@example/acme2");
        other["storage"] = json!({ "app": "acme2", "env": "ACMETWO" });
        let (tools, extra) = parse(&file(&[sample(), other]), catalog());
        assert_eq!(tools.len(), 1);
        assert!(extra.rejected[0].text.contains("taken"));
    }

    #[test]
    fn the_built_in_catalog_is_the_fallback_without_the_flag_or_the_setting() {
        assert!(std::env::var(FLAG).is_err());
        assert!(catalog().extra.tools.is_empty(), "community tools read while off");
    }
}
