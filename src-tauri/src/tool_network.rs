//! Where an installed tool says its data goes: `network` in its own `contracts/wirecat.json`, read from the installed
//! package and never run. A tool that ships no such file declares nothing, and the page says so instead of guessing.

use crate::catalog::Tool;
use serde::Serialize;
use serde_json::Value;
use specta::Type;
use std::path::{Path, PathBuf};

const MANIFEST: &str = "contracts/wirecat.json";
const MAX_HOSTS: usize = 64;
const MAX_TEXT: usize = 200;

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ToolNetwork {
    /// `hosts: []` is a tool that contacts no server of its own; `userHosts` names one the owner chooses.
    #[serde(rename_all = "camelCase")]
    Declared {
        hosts: Vec<String>,
        user_hosts: Option<String>,
    },
    /// The package ships no manifest, or one without `network`, or one Desktop cannot read.
    Undeclared,
    NotInstalled,
}

fn named(dir: &Path, package: &str) -> bool {
    std::fs::read_to_string(dir.join("package.json"))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .is_some_and(|v| v["name"] == package)
}

/// npm links the program to a file inside the package on Unix; on Windows it writes a shim beside `node_modules`.
fn package_dir(bin: &Path, package: &str) -> Option<PathBuf> {
    let real = std::fs::canonicalize(bin).ok()?;
    if let Some(dir) = real.ancestors().find(|d| named(d, package)) {
        return Some(dir.to_path_buf());
    }
    let prefix = crate::npm_prefix::of_copy(bin)?;
    [prefix.join("node_modules").join(package), prefix.join("lib").join("node_modules").join(package)]
        .into_iter()
        .find(|d| named(d, package))
}

pub(crate) fn network_of(manifest: &Value) -> ToolNetwork {
    let Some(network) = manifest.get("network").filter(|n| n.is_object()) else { return ToolNetwork::Undeclared };
    let Some(list) = network["hosts"].as_array().filter(|l| l.len() <= MAX_HOSTS) else {
        return ToolNetwork::Undeclared;
    };
    let hosts: Option<Vec<String>> =
        list.iter().map(|h| h.as_str().filter(|h| crate::own_tools::plain_host(h)).map(str::to_string)).collect();
    let Some(hosts) = hosts else { return ToolNetwork::Undeclared };
    let user_hosts = network["user_hosts"]
        .as_str()
        .map(|t| t.chars().filter(|c| !c.is_control()).take(MAX_TEXT).collect::<String>())
        .filter(|t| !t.trim().is_empty());
    ToolNetwork::Declared { hosts, user_hosts }
}

pub fn read(tool: &Tool) -> ToolNetwork {
    let Some(bin) = crate::tools::program(&tool.bin) else { return ToolNetwork::NotInstalled };
    let manifest = package_dir(&bin, &tool.package)
        .and_then(|dir| std::fs::read_to_string(dir.join(MANIFEST)).ok())
        .and_then(|t| serde_json::from_str::<Value>(&t).ok());
    manifest.as_ref().map_or(ToolNetwork::Undeclared, network_of)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn declared_hosts_and_the_owners_own_server_are_read() {
        let m = json!({ "wcat_manifest": 2, "network": {
            "hosts": ["oauth.bitrix.info", "*.zoom.us"],
            "user_hosts": "the Bitrix24 portal in your webhook address"
        } });
        assert_eq!(
            network_of(&m),
            ToolNetwork::Declared {
                hosts: vec!["oauth.bitrix.info".into(), "*.zoom.us".into()],
                user_hosts: Some("the Bitrix24 portal in your webhook address".into())
            }
        );
        let none = json!({ "network": { "hosts": [] } });
        assert_eq!(network_of(&none), ToolNetwork::Declared { hosts: vec![], user_hosts: None });
    }

    #[test]
    fn a_manifest_without_network_or_with_a_host_that_is_not_one_declares_nothing() {
        assert_eq!(network_of(&json!({ "wcat_manifest": 2 })), ToolNetwork::Undeclared);
        assert_eq!(network_of(&json!({ "network": { "hosts": ["https://x.io/a"] } })), ToolNetwork::Undeclared);
        assert_eq!(network_of(&json!({ "network": { "hosts": "x.io" } })), ToolNetwork::Undeclared);
    }

    #[cfg(unix)]
    #[test]
    fn the_package_is_found_from_its_linked_program() {
        let root = std::env::temp_dir().join(format!("wirecat-network-{}", std::process::id()));
        let pkg = root.join("lib/node_modules/@wirecat/cli-x");
        std::fs::create_dir_all(pkg.join("dist")).unwrap();
        std::fs::create_dir_all(root.join("bin")).unwrap();
        std::fs::write(pkg.join("package.json"), r#"{"name":"@wirecat/cli-x"}"#).unwrap();
        std::fs::write(pkg.join("dist/cli.js"), "").unwrap();
        let bin = root.join("bin/x");
        std::os::unix::fs::symlink(pkg.join("dist/cli.js"), &bin).unwrap();
        assert_eq!(
            package_dir(&bin, "@wirecat/cli-x").map(|d| std::fs::canonicalize(d).unwrap()),
            Some(std::fs::canonicalize(&pkg).unwrap())
        );
        assert_eq!(package_dir(&bin, "@wirecat/other"), None);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
