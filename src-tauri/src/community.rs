//! Community tools: CLIs made outside `WireCatLabs`, added to the compiled catalog at start. Three sources, read in
//! this order: `WireCat`'s own tools from the signed list's `official` key (`official.rs`) whenever this build has the
//! list's key, its community tools (`registry.rs`) while "Enable community tools" is on, then the owner's own tools in
//! `<app data>/extra-tools.json` while the own-tools switch is on (`own_tools.rs`), or for development
//! while `WIRECAT_EXTRA_TOOLS=1` is set. An entry passes only when every command word is plain (no shell syntax), its
//! package and repository are outside `@wirecat` and `WireCatLabs` (an own tool may be an uncatalogued `@wirecat`
//! package), and it claims no name or folder of ours or of an entry read before it. A listed tool's install still needs npm provenance from its own repository's `release.yml`
//! (`provenance.rs`); an own tool's provenance is shown, not required.

use crate::catalog::{Catalog, Tool};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fmt;

pub const FLAG: &str = "WIRECAT_EXTRA_TOOLS";
pub const FILE: &str = "extra-tools.json";
/// Set by `own_tool_e2e` once it has moved `HOME` and the data folders, so the tests read that copy's own tools.
#[cfg(test)]
pub const TEST_APP_DATA: &str = "WIRECAT_TEST_APP_DATA";
pub const MAX_BYTES: usize = 512 * 1024;
const MAX_TOOLS: usize = 32;

/// Fields a community tool may not set: parts of our packages, memo's own pages, a bot token on stdin, emptying the
/// store every tool shares, and writing a CRM's cards from the Clients board.
pub const FORBIDDEN: [&str; 13] = [
    "partOf",
    "replaces",
    "mcpName",
    "commandPrefix",
    "memory",
    "taskBoard",
    "crmBoard",
    "crm",
    "bot",
    "storeReset",
    "storeResetPreview",
    "configRepair",
    "storeRecover",
];

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

pub(crate) fn rule(key: &str, rule: String) -> Problem {
    Problem::Rule { key: key.into(), rule }
}

/// The community tools to add at start, `None` when neither source is on.
pub fn load(builtin: &Catalog) -> Option<(Vec<Tool>, Extra)> {
    // The signed list read at start stays until the next start, so a reload for an own tool never changes it.
    static LISTED: std::sync::OnceLock<Option<Result<crate::registry::List, String>>> = std::sync::OnceLock::new();
    // A unit test must not read the owner's own tools from the real app data; own_tool_e2e moves it first and says so.
    #[cfg(test)]
    std::env::var_os(TEST_APP_DATA)?;
    // Fetched whatever the switch says, for the official tools; a build without the list's key reads none.
    let listed = LISTED.get_or_init(|| crate::registry::key().is_ok().then(crate::registry::at_start)).clone();
    let shown = crate::registry::shown();
    // Off, the switch still lets `@wirecat` tools through: only WireCat publishes under that scope.
    let all_own = std::env::var(FLAG).ok().as_deref() == Some("1") || crate::own_tools::allowed();
    let own = crate::node::app_data().and_then(|d| std::fs::read_to_string(d.join(FILE)).ok());
    if listed.is_none() && own.is_none() {
        return None;
    }
    let mut out = Accepted::new(builtin);
    match listed {
        Some(Ok(list)) => {
            out.official(builtin, list.official);
            if shown {
                out.entries(Source::Community, "The community list", list.tools);
            }
        }
        Some(Err(why)) if shown => out.extra.reject(Source::Community, why),
        _ => {}
    }
    if let Some(text) = own {
        out.file(&text, all_own);
    }
    Some((out.tools, out.extra))
}

/// The entries of an own-tools file that may join `builtin`, each parsed as a catalog tool.
#[cfg(test)]
pub fn parse(text: &str, builtin: &Catalog) -> (Vec<Tool>, Extra) {
    let mut out = Accepted::new(builtin);
    out.file(text, true);
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

    /// `all` is the switch for unchecked tools; without it only `@wirecat` entries are read.
    fn file(&mut self, text: &str, all: bool) {
        match file_entries(text) {
            Ok(entries) => {
                let entries = entries
                    .into_iter()
                    .filter(|e| all || e["package"].as_str().is_some_and(crate::own_tools::trusted))
                    .collect();
                self.entries(Source::Own, FILE, entries);
            }
            Err(why) => self.extra.reject(Source::Own, why),
        }
    }

    /// `WireCat`'s own tools from the list: a compiled-in one hands the interface its presentation, a new one is added.
    fn official(&mut self, builtin: &Catalog, entries: Vec<Value>) {
        for (i, entry) in entries.into_iter().enumerate() {
            if i == crate::official::MAX_TOOLS {
                let max = crate::official::MAX_TOOLS;
                self.extra.reject(Source::Official, format!("The official list: only the first {max} tools are read."));
                break;
            }
            let name = entry["id"].as_str().map_or_else(|| format!("entry {}", i + 1), str::to_string);
            let read = crate::official::read(&entry, builtin);
            let added = read.and_then(|r| match r {
                crate::official::Read::BuiltIn(shown) => Ok((None, shown)),
                crate::official::Read::New(e) => {
                    let e = crate::described::apply_listed(e);
                    check(&e, &self.taken, Source::Official).map(|t| (Some(t), e))
                }
            });
            match added {
                Ok((tool, entry)) => {
                    if let Some(mut tool) = tool {
                        tool.listed = true;
                        self.taken.add(&tool);
                        self.tools.push(tool);
                    }
                    self.extra.tools.push(ExtraTool { source: Source::Official, entry });
                }
                Err(why) => self.extra.reject(Source::Official, format!("{name}: {why}")),
            }
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
                Ok(mut tool) => {
                    tool.listed = source == Source::Community;
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
    /// A client's call opens in the one tool that names its provider (`calls.rs`), so two tools cannot share one.
    providers: HashMap<String, Owner>,
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
            providers: HashMap::new(),
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
        let owner = || Owner { name: tool.name.clone(), listed: tool.listed };
        self.ids.insert(tool.id.clone(), owner());
        self.bins.insert(tool.bin.clone(), owner());
        self.packages.insert(tool.package.clone(), owner());
        if let Some(old) = &tool.replaces {
            self.bins.insert(old.bin.clone(), owner());
            self.packages.insert(old.package.clone(), owner());
        }
        self.folders.insert(tool.storage.app.to_lowercase(), owner());
        self.folders.insert(tool.storage.env.to_lowercase(), owner());
        if let Some(port) = tool.mcp_server.as_ref().and_then(|m| m.port) {
            self.ports.insert(port.to_string(), owner());
        }
        if let Some(m) = &tool.meetings {
            self.providers.insert(m.provider.clone(), owner());
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
    let official = source == Source::Official;
    if official && !entry["community"].is_null() {
        return Err(rule("community", "an official tool is not a community tool.".into()));
    }
    if !official && entry["community"] != true {
        return Err(rule("community", "\"community\": true is missing.".into()));
    }
    if let Some(field) = FORBIDDEN.iter().find(|f| !entry[**f].is_null()) {
        return Err(rule(field, format!("a community tool cannot set \"{field}\".")));
    }
    if !entry["signIn"]["command"].is_null() {
        return Err(rule("signIn", "a community tool cannot show a command to copy (\"signIn.command\").".into()));
    }
    sign_in_methods(&entry["signIn"]["methods"])?;
    account_remove(&entry["accountRemove"])?;
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
    // Only WireCat publishes under `@wirecat`, so the owner may add one we have not built in; the signed list's
    // community tools may not, and its official tools must.
    let wirecat = (source == Source::Own || official) && tool.package.starts_with("@wirecat/");
    if official && !wirecat {
        return Err(rule("package", "an official tool is a @wirecat package.".into()));
    }
    if wirecat { scoped(&tool.package) } else { package(&tool.package) }?;
    Taken::free(&taken.packages, "package", &tool.package, &tool.package)?;
    if !(source == Source::Own && entry["repo"].is_null()) {
        match repo(&tool.repo) {
            Err(Problem::Ours { .. }) if wirecat => {}
            Ok(()) if official => {
                return Err(rule("repo", "an official tool is built in a `WireCatLabs` repository.".into()));
            }
            other => other?,
        }
    }
    // `<scope>-<name>` of an own tool's package is often longer than a listed tool's folder.
    storage(&tool, taken, if source == Source::Own { 64 } else { 32 })?;
    if source == Source::Own || official {
        own_storage(&tool)?;
    }
    if let Some(port) = tool.mcp_server.as_ref().and_then(|m| m.port) {
        Taken::free(&taken.ports, "port", &port.to_string(), &port.to_string())?;
    }
    if let Some(m) = &tool.meetings {
        meetings(m)?;
        Taken::free(&taken.providers, "provider", &m.provider, &m.provider)?;
    }
    Ok(tool)
}

/// `storage.rs` deletes an own tool's folders by `storage.app`, so it must be the tool's own: `<scope>-<name>` of its
/// npm package `@<scope>/<name>`, or that and `-` and more. Only the scope's owner can publish under a scope; the
/// unscoped name alone proves nothing (`@evil/gh`), nor does the manifest's own name. `@wirecat` is ours, so its
/// tools keep the folder our CLIs use, `<name>` (`@wirecat/beeline-cli` → `beeline-cli`); `Taken` still refuses a
/// built-in tool's folder.
fn own_storage(tool: &Tool) -> Result<(), Problem> {
    let name = tool.package.strip_prefix("@wirecat/").unwrap_or_else(|| tool.package.trim_start_matches('@'));
    // A folder name holds no `.` or `_` (`plain_name`), so those of the package name become `-` too.
    let folder = name.replace(['/', '.', '_'], "-").to_lowercase();
    let app = tool.storage.app.to_lowercase();
    if app == folder || app.strip_prefix(&folder).is_some_and(|rest| rest.starts_with('-')) {
        return Ok(());
    }
    Err(rule(
        "storage",
        format!("the data folder {} must be {folder}, or start with {folder}-, after the package.", tool.storage.app),
    ))
}

/// What a sign-in in the window may take from a tool we did not build: its words, which sign the chosen profile in and
/// name nothing else the app fills, and whether what the owner types is its whole stdin. `site` and `login` are the
/// flags of cli-core's application password sign-in, `--site` and `--login` only; `signin.rs` checks what the owner
/// typed for them. `password` names a variable, `clientId` a setting written before the run, and the other
/// keys flags for what the owner typed: none is reviewed.
fn sign_in_methods(methods: &Value) -> Result<(), Problem> {
    const KEYS: [&str; 6] = ["id", "label", "words", "stdin", "site", "login"];
    let bad = |why: String| Err(rule("signIn", why));
    if methods.is_null() {
        return Ok(());
    }
    let Some(list) = methods.as_array().filter(|l| !l.is_empty()) else {
        return bad("signIn.methods is a list of the sign-ins the window runs.".into());
    };
    for method in list {
        let Some(map) = method.as_object() else { return bad("each of signIn.methods is an object.".into()) };
        if let Some(key) = map.keys().find(|k| !KEYS.contains(&k.as_str())) {
            return bad(format!("a community tool's sign-in cannot set \"{key}\"."));
        }
        let id = method["id"].as_str().unwrap_or_default();
        if !plain_name(id, 32) {
            return bad(format!("the sign-in id {id:?} is not a plain lower-case name."));
        }
        let label = method["label"].as_str().unwrap_or_default();
        if label.trim().is_empty() || label.chars().count() > 40 || label.chars().any(char::is_control) {
            return bad(format!("the sign-in {id} needs a label of one line, at most 40 characters."));
        }
        let words: Vec<&str> = method["words"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
        if words.first() != Some(&"{profile}") || words.len() < 2 || words[1..].iter().any(|w| w.contains('{')) {
            return bad(format!("the sign-in {id} must start with {{profile}} and fill no other slot."));
        }
        if !method["stdin"].is_null() && !method["stdin"].is_boolean() {
            return bad(format!("the sign-in {id}'s stdin is true or false."));
        }
        // cli-core's flags only: another flag would hand what the owner typed to a setting it was not typed for.
        for key in ["site", "login"] {
            let flag = &method[key];
            if !flag.is_null() && flag.as_str() != Some(&format!("--{key}")) {
                return bad(format!("the sign-in {id}'s {key} is the flag --{key}."));
            }
        }
        // The password of a sign-in with a site and a user name is read until stdin closes.
        if (!method["site"].is_null() || !method["login"].is_null()) && method["stdin"] != true {
            return bad(format!("the sign-in {id} reads its password on stdin: set stdin to true."));
        }
    }
    Ok(())
}

/// `account.rs` appends `dryRun` to the plan and `confirm` to the real run, so a tool that swapped them would delete on
/// the preview: both are cli-core's own flags, nothing else. The word lists sign out or remove the chosen profile only.
pub(crate) fn account_remove(src: &Value) -> Result<(), Problem> {
    let bad = |why: String| Err(rule("accountRemove", why));
    if src.is_null() {
        return Ok(());
    }
    let remove = &src["remove"];
    let lists = [&src["signOut"], &remove["keepData"], &remove["deleteData"]];
    for list in lists.into_iter().filter(|l| !l.is_null()) {
        let words: Vec<&str> = list.as_array().into_iter().flatten().filter_map(Value::as_str).collect();
        if words.first() != Some(&"{profile}") || words.len() < 2 || words[1..].iter().any(|w| w.contains('{')) {
            return bad("its commands must start with {profile} and fill no other slot.".into());
        }
    }
    if !remove.is_null() && (remove["dryRun"] != "--dry-run" || remove["confirm"] != "--yes") {
        return bad("remove.dryRun must be \"--dry-run\" and remove.confirm \"--yes\".".into());
    }
    Ok(())
}

/// The provider is cli-core's name on the stored calls (`beeline`); each command opens one call, so it names `{id}`.
fn meetings(m: &crate::catalog::MeetingsSource) -> Result<(), Problem> {
    let name = (2..=32).contains(&m.provider.len())
        && m.provider.starts_with(|c: char| c.is_ascii_lowercase())
        && m.provider.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !name {
        return Err(rule("meetings", format!("the provider {:?} is not a plain lower-case name.", m.provider)));
    }
    if ![&m.show, &m.transcript].iter().all(|words| words.iter().any(|w| w == "{id}")) {
        return Err(rule("meetings", "show and transcript must each take the call as {id}.".into()));
    }
    Ok(())
}

/// Every string listed in an array is a command word (or a key or value the tool reads), run without a shell except
/// `setup`, which `terminal.rs` joins into one shell line. So none may hold shell syntax: no spaces, quotes, `$`, `;`,
/// `|`, `&`, backticks, globs, `~` or newlines. Text the interface shows is never in an array.
///
/// One exception: `sync.last` may hold cli-core's `runs list` filter for the sync's own command path, quoted because the
/// path has more than one word (`command:"meetings sync" status:success`). It is one argument, never a shell line.
pub(crate) fn words(v: &Value) -> Result<(), Problem> {
    let Some(query) = last_sync_query(v) else { return words_in("entry", v) };
    let mut checked = v.clone();
    for word in checked["sync"]["last"].as_array_mut().into_iter().flatten() {
        if *word == query {
            *word = Value::String("query".into());
        }
    }
    words_in("entry", &checked)
}

/// The filter for `sync.run`'s command path: its words after `{profile}`, up to the first flag.
fn last_sync_query(entry: &Value) -> Option<String> {
    let run = entry["sync"]["run"].as_array()?;
    let path: Vec<&str> = run
        .iter()
        .map(Value::as_str)
        .collect::<Option<Vec<_>>>()?
        .into_iter()
        .skip_while(|w| *w == "{profile}")
        .take_while(|w| !w.starts_with('-'))
        .collect();
    // cli-base's own rule for this word: `^command:"[a-z0-9][a-z0-9-]*(?: [a-z0-9][a-z0-9-]*)+" status:success$`.
    let plain = |w: &&str| {
        w.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit())
            && w.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    };
    (path.len() >= 2 && path.iter().all(plain)).then(|| format!("command:\"{}\" status:success", path.join(" ")))
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
    scoped(name)
}

/// `@scope/name` in npm's lowercase form, any scope.
pub fn scoped(name: &str) -> Result<(), Problem> {
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
    let parts: Vec<&str> =
        url.strip_prefix("https://github.com/").map_or_else(Default::default, |r| r.split('/').collect());
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

    fn listed_rejected(entry: &Value) -> String {
        let mut out = Accepted::new(catalog());
        out.entries(Source::Community, "The community list", vec![entry.clone()]);
        assert!(out.tools.is_empty(), "accepted {entry}");
        texts(&out.extra)
    }

    #[test]
    fn rejects_our_scope_our_repositories_and_taken_names() {
        assert!(listed_rejected(&with("package", json!("@wirecat/acme"))).contains("WireCat's own"));
        assert!(rejected(&with("package", json!("acme-cli"))).contains("scoped"));
        assert!(listed_rejected(&with("repo", json!("https://github.com/WireCatLabs/acme"))).contains("WireCat's own"));
        assert!(rejected(&with("repo", json!("https://github.com/WireCatLabs/acme"))).contains("WireCat's own"));
        assert!(rejected(&with("repo", json!("https://gitlab.com/example/acme"))).contains("github.com"));
        assert!(rejected(&with("id", json!("tg"))).contains("taken"));
        assert!(rejected(&with("bin", json!("wcat-wirecat"))).contains("taken"));
        assert!(rejected(&with("bin", json!("memo"))).contains("taken"), "the program wcat replaced");
        assert!(rejected(&with("docs", json!("http://example.com"))).contains("https"));
    }

    #[test]
    fn an_own_tool_may_be_a_wirecat_package_we_have_not_built_in_but_never_take_a_built_in_name() {
        let mut own = sample();
        own["package"] = json!("@wirecat/acme-cli");
        own["repo"] = json!("https://github.com/WireCatLabs/acme-cli");
        own["storage"] = json!({ "app": "acme-cli", "env": "ACME" });
        let (tools, extra) = parse(&file(std::slice::from_ref(&own)), catalog());
        assert!(extra.rejected.is_empty(), "{:?}", extra.rejected);
        assert_eq!((tools[0].package.as_str(), tools[0].storage.app.as_str()), ("@wirecat/acme-cli", "acme-cli"));
        assert!(listed_rejected(&own).contains("WireCat's own"), "the signed list stays outside @wirecat");

        for app in ["wirecat-acme-cli", "acme", "acme-clix"] {
            own["storage"] = json!({ "app": app, "env": "ACME" });
            assert!(rejected(&own).contains("must be acme-cli, or start with acme-cli-"), "{app}");
        }
        own["package"] = json!("@wirecat/tg");
        own["storage"] = json!({ "app": "tg-cli", "env": "ACME" });
        assert!(rejected(&own).contains("data folder tg-cli is taken by Telegram"));
        own["package"] = json!("@wirecat/tg-cli");
        own["storage"] = json!({ "app": "tg-cli-own", "env": "ACME" });
        assert!(rejected(&own).contains("package @wirecat/tg-cli is taken by Telegram"));
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
    fn a_sign_in_in_the_window_takes_only_its_words_and_stdin() {
        let token = json!({ "id": "token", "label": "API token", "words": ["{profile}", "session", "start", "--json"], "stdin": true });
        let mut ok = sample();
        ok["signIn"]["methods"] = json!([token]);
        let (tools, _) = parse(&file(&[ok]), catalog());
        let method = &tools[0].sign_in.as_ref().unwrap().methods[0];
        assert!(method.stdin && method.words[0] == "{profile}");
        let bad = |change: Value| {
            let mut method = token.clone();
            method.as_object_mut().unwrap().extend(change.as_object().unwrap().clone());
            let mut entry = sample();
            entry["signIn"]["methods"] = json!([method]);
            rejected(&entry)
        };
        assert!(bad(json!({ "password": "NODE_OPTIONS" })).contains("cannot set \"password\""));
        assert!(bad(json!({ "clientId": "microsoft_client_id" })).contains("cannot set \"clientId\""));
        assert!(bad(json!({ "words": ["session", "start"] })).contains("must start with {profile}"));
        assert!(bad(json!({ "words": ["{profile}", "session", "{port}"] })).contains("no other slot"));
        assert!(bad(json!({ "words": ["{profile}", "sh", "-c", "rm -rf ~"] })).contains("is not allowed"));
        assert!(bad(json!({ "id": "Token!" })).contains("plain lower-case"));
        assert!(bad(json!({ "label": "" })).contains("label"));
        assert!(bad(json!({ "site": "-c" })).contains("the flag --site"));
        assert!(bad(json!({ "site": "--config" })).contains("the flag --site"));
        assert!(bad(json!({ "login": "--user name" })).contains("the flag --login"));
        assert!(bad(json!({ "site": "--site", "stdin": false })).contains("set stdin to true"));
        let mut site = sample();
        site["signIn"]["methods"] = json!([{ "id": "app-password", "label": "Application password",
            "words": ["{profile}", "session", "start", "--json"], "stdin": true, "site": "--site", "login": "--login" }]);
        let (tools, _) = parse(&file(&[site]), catalog());
        let method = &tools[0].sign_in.as_ref().unwrap().methods[0];
        assert_eq!((method.site.as_deref(), method.login.as_deref()), (Some("--site"), Some("--login")));
        let mut empty = sample();
        empty["signIn"]["methods"] = json!([]);
        assert!(rejected(&empty).contains("signIn.methods"));
    }

    #[test]
    fn an_account_removal_runs_only_its_own_words_and_cli_cores_flags() {
        let src = json!({
            "signOut": ["{profile}", "session", "end", "--record", "--json"],
            "remove": {
                "minVersion": "0.5.0",
                "keepData": ["{profile}", "account", "remove", "--keep-data", "--record", "--json"],
                "deleteData": ["{profile}", "account", "remove", "--delete-data", "--record", "--json"],
                "dryRun": "--dry-run",
                "confirm": "--yes"
            },
            "removes": ["signIn"],
            "keeps": ["settings", "data", "listed"]
        });
        let (tools, _) = parse(&file(&[with("accountRemove", src.clone())]), catalog());
        let remove = tools[0].account_remove.as_ref().unwrap();
        assert_eq!(remove.sign_out.as_ref().unwrap()[1], "session");
        let bad = |path: &str, value: Value| {
            let mut changed = src.clone();
            *changed.pointer_mut(path).unwrap() = value;
            rejected(&with("accountRemove", changed))
        };
        assert!(bad("/remove/dryRun", json!("--yes")).contains("--dry-run"), "a preview that removes");
        assert!(bad("/remove/confirm", json!("--force")).contains("--yes"));
        assert!(bad("/signOut", json!(["session", "end"])).contains("start with {profile}"));
        assert!(
            bad("/remove/deleteData", json!(["{profile}", "account", "remove", "{port}"])).contains("no other slot")
        );
        assert!(bad("/remove/keepData", json!(["{profile}", "rm -rf ~"])).contains("is not allowed"));
    }

    #[test]
    fn a_last_sync_filter_may_quote_only_the_syncs_own_command_path() {
        let sync = |last: &str| {
            with(
                "sync",
                json!({ "run": ["{profile}", "meetings", "sync", "--record", "--json"],
                    "last": ["runs", "list", last, "--limit", "50", "--no-record", "--json"],
                    "lastShape": "runs", "what": "calls", "note": null }),
            )
        };
        let (tools, extra) = parse(&file(&[sync("command:\"meetings sync\" status:success")]), catalog());
        assert_eq!(texts(&extra), "");
        assert_eq!(
            tools[0].sync.as_ref().unwrap().last.as_ref().unwrap()[2],
            "command:\"meetings sync\" status:success"
        );
        for last in [
            "command:\"meetings delete\" status:success",
            "command:\"meetings sync\" status:failed",
            "command:\"meetings sync\" status:success\"",
            "command:meetings\" status:success",
            "command:\"meetings sync\";rm status:success",
            "command:\"meetings sync;rm\" status:success",
            "command:\"meetings sync\"  status:success",
        ] {
            assert!(rejected(&sync(last)).contains("is not allowed"), "{last}");
        }
        let mut upper = sync("command:\"Meetings sync\" status:success");
        upper["sync"]["run"] = json!(["{profile}", "Meetings", "sync", "--json"]);
        assert!(rejected(&upper).contains("is not allowed"), "lower case only, as cli-base writes it");
        let mut one = sync("command:\"sync\" status:success");
        one["sync"]["run"] = json!(["{profile}", "sync", "--json"]);
        assert!(rejected(&one).contains("is not allowed"), "one word needs no quotes");
        let mut elsewhere = sync("status:success");
        elsewhere["doctor"] = json!(["{profile}", "command:\"meetings sync\" status:success"]);
        assert!(rejected(&elsewhere).contains("is not allowed"), "only in sync.last");
    }

    #[test]
    fn an_own_tools_data_folder_is_named_after_its_scope_and_name() {
        for app in ["gh", "keyrings", "nvim", "google-chrome"] {
            let mut evil = with("storage", json!({ "app": app, "env": "ACME" }));
            evil["package"] = json!(format!("@evil/{app}"));
            evil["own"] = json!({ "name": app });
            assert!(rejected(&evil).contains("must be evil-"), "{app}");
        }
        let mut dotted = with("package", json!("@x/a_b.c"));
        dotted["storage"] = json!({ "app": "x-a-b-c", "env": "ABC" });
        assert_eq!(parse(&file(&[dotted]), catalog()).0.len(), 1, "@x/a_b.c keeps its data in x-a-b-c");
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
    fn with_the_switch_off_only_wirecat_own_tools_are_read() {
        let mut ours = sample();
        ours["id"] = json!("beeline");
        ours["bin"] = json!("wcat-beeline");
        ours["package"] = json!("@wirecat/beeline-cli");
        ours["repo"] = json!("https://github.com/WireCatLabs/beeline-cli");
        ours["storage"] = json!({ "app": "beeline-cli", "env": "BEELINE" });
        let mut lookalike = sample();
        lookalike["id"] = json!("evil");
        lookalike["bin"] = json!("evil");
        lookalike["package"] = json!("@wirecat-evil/evil");
        lookalike["storage"] = json!({ "app": "wirecat-evil-evil", "env": "EVIL" });
        let text = file(&[ours, sample(), lookalike]);
        let read = |all| {
            let mut out = Accepted::new(catalog());
            out.file(&text, all);
            out.tools.into_iter().map(|t| t.package).collect::<Vec<_>>()
        };
        assert_eq!(read(false), ["@wirecat/beeline-cli"]);
        assert_eq!(read(true), ["@wirecat/beeline-cli", "@example/acme-cli", "@wirecat-evil/evil"]);
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
    fn takes_an_entry_exactly_as_cli_docs_desktop_registry_builds_it() {
        // Output of cli-docs `buildRegistry` for a sample `@leemour/acme-crm-cli` entry (2026-11-08): no "mcp" key.
        let built = json!({
            "id": "acmecrm", "community": true, "name": "Acme CRM", "package": "@leemour/acme-crm-cli",
            "repo": "https://github.com/leemour/acme-crm-cli", "summary": "Acme CRM contacts and deals, searchable offline.",
            "docs": "https://wirecat.dev/docs/acmecrm", "tagline": "Acme CRM contacts in your archive", "bin": "acmecrm",
            "profiles": { "args": ["profile", "list", "--json", "--no-record"], "shape": "items" },
            "doctor": ["{profile}", "doctor", "--json", "--record"], "runs": null, "search": null,
            "setup": ["{profile}", "setup"],
            "signIn": { "gives": "your contacts", "asks": "an API token", "guide": "https://example.com/acme/token" },
            "skill": null, "mcpServer": null, "tasks": null, "sync": null, "storeInfo": null, "storeTables": null,
            "storeTableSizes": null, "storeCheck": null, "storeBackup": null, "storeBackupEncrypted": null,
            "storage": { "app": "leemour-acme-crm-cli", "env": "ACMECRM" }, "settings": null,
            "storeResetPreview": null, "storeReset": null
        });
        let mut out = Accepted::new(catalog());
        out.entries(Source::Community, "The community list", vec![built]);
        assert_eq!(texts(&out.extra), "");
        assert_eq!(out.tools[0].package, "@leemour/acme-crm-cli");
    }

    #[test]
    fn the_built_in_catalog_is_the_fallback_without_the_flag_or_the_setting() {
        assert!(std::env::var(FLAG).is_err());
        assert!(catalog().extra.tools.is_empty(), "community tools read while off");
    }

    fn official(entries: Vec<Value>) -> Accepted {
        let mut out = Accepted::new(catalog());
        out.official(catalog(), entries);
        out
    }

    #[test]
    fn an_official_tool_new_to_the_app_is_added_and_a_built_in_one_only_shows_the_lists_texts() {
        let mut bitrix = crate::official::tests::beeline();
        bitrix["id"] = json!("bitrix");
        bitrix["package"] = json!("@wirecat/bitrix24-cli");
        let out = official(vec![crate::official::tests::beeline(), bitrix]);
        assert!(out.extra.rejected.is_empty(), "{:?}", out.extra.rejected);
        assert_eq!(out.tools.len(), 1, "the built-in bitrix is not added again");
        let tool = &out.tools[0];
        assert_eq!((tool.id.as_str(), tool.source, tool.listed), ("beeline", Source::Official, true));
        assert_eq!(tool.mcp_server.as_ref().and_then(|m| m.port), Some(8740));
        assert_eq!(out.extra.count(Source::Official), 2);
        assert_eq!(out.extra.tools[1].entry["id"], "bitrix");
        assert!(out.extra.tools[1].entry.get("doctor").is_none(), "a built-in tool's commands stay compiled");
    }

    #[test]
    fn an_official_tool_is_ours_and_keeps_to_its_own_names() {
        let refused = |key: &str, value: Value| {
            let mut e = crate::official::tests::beeline();
            if key == "storage" {
                e["desktop"]["storage"] = value;
            } else {
                e[key] = value;
            }
            texts(&official(vec![e]).extra)
        };
        assert!(refused("package", json!("@example/beeline-cli")).contains("@wirecat package"));
        assert!(refused("repo", json!("https://github.com/example/beeline-cli")).contains("WireCatLabs"));
        assert!(refused("storage", json!({ "app": "other-cli", "env": "WCBEELINE" })).contains("must be beeline-cli"));
        assert!(refused("bin", json!("tg")).contains("taken"));
        assert!(refused("mcpPort", json!(8765)).contains("taken"), "tg's port");
    }

    #[test]
    fn an_own_entry_of_a_tool_now_listed_as_official_is_told_so() {
        let mut out = official(vec![crate::official::tests::beeline()]);
        let mut own = sample();
        own["package"] = json!("@wirecat/beeline-cli");
        own["repo"] = json!("https://github.com/WireCatLabs/beeline-cli");
        out.file(&file(&[own]), true);
        assert!(texts(&out.extra).contains("This tool is now listed"), "{}", texts(&out.extra));
    }
}
