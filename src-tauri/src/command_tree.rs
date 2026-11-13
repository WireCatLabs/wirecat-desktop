//! What an installed tool can run, from its own `commands --json`: a feature turns on when the tool lists its
//! command, not when a version written by hand in the catalog says so (DEBT-340). The list is read once per installed
//! version and only when a caller asks, never at start.

use crate::catalog::Tool;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

const READ: Duration = Duration::from_secs(30);

type Paths = Arc<HashSet<String>>;
type Lists = Mutex<HashMap<(PathBuf, String), Option<Paths>>>;

/// By program and version, so an update reads the new list; `None` when the tool gave no list.
fn read() -> &'static Lists {
    static READ_ONCE: OnceLock<Lists> = OnceLock::new();
    READ_ONCE.get_or_init(Mutex::default)
}

fn walk(nodes: &[Value], out: &mut HashSet<String>) {
    for node in nodes {
        let path: Vec<&str> = node["path"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
        if !path.is_empty() {
            out.insert(path.join(" "));
        }
        walk(node["commands"].as_array().map_or(&[], Vec::as_slice), out);
    }
}

/// Every command path the tool lists, nested ones included, as words joined by one space.
pub(crate) fn paths_of(doc: &Value) -> Option<HashSet<String>> {
    let mut found = HashSet::new();
    walk(doc["commands"].as_array()?, &mut found);
    Some(found)
}

fn listed(tool: &Tool) -> Option<Paths> {
    let bin = crate::tools::program(&tool.bin)?;
    let version = crate::tools::version_of(&bin)?;
    let key = (bin, version);
    if let Some(known) = read().lock().ok()?.get(&key) {
        return known.clone();
    }
    let out = crate::run::run(&key.0, &["commands", "--json"], Some(&crate::paths::search_path()), READ).ok()?;
    let paths = out.json().filter(|_| out.code == Some(0)).as_ref().and_then(paths_of).map(Arc::new);
    read().lock().ok()?.insert(key, paths.clone());
    paths
}

/// `Some(true)` when the installed tool lists the command; `None` when it is not installed or lists nothing.
pub fn has(tool: &Tool, path: &[&str]) -> Option<bool> {
    listed(tool).map(|paths| paths.contains(&path.join(" ")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn every_listed_path_counts_nested_ones_too() {
        let doc = json!({ "version": "0.3.0", "commands": [
            { "path": ["meetings"], "commands": [
                { "path": ["meetings", "show"], "commands": [] },
                { "path": ["meetings", "transcript"] }
            ] },
            { "path": ["account"], "commands": [{ "path": ["account", "remove"], "commands": [] }] }
        ] });
        let paths = paths_of(&doc).unwrap();
        for p in ["meetings", "meetings show", "meetings transcript", "account remove"] {
            assert!(paths.contains(p), "{p}");
        }
        assert!(!paths.contains("meetings list"));
    }

    #[test]
    fn an_answer_without_a_command_list_says_nothing() {
        assert!(paths_of(&json!({ "error": { "code": "validation_error" } })).is_none());
    }
}
