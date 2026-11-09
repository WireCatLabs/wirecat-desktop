//! Running Memo for a page: one command, its JSON on success or the error object Memo printed. Shared by the pages
//! that read and write through Memo's own commands (Tasks, account groups, relationships).

use crate::catalog::{self, Tool};
use crate::skills::failure;
use crate::{paths, run};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

/// One Memo command: its JSON on success, or the error object Memo printed.
pub type Call<'a> = dyn Fn(&[String]) -> Result<Value, Failure> + Sync + 'a;

#[derive(Debug, PartialEq)]
pub struct Failure {
    pub reason: Option<String>,
    pub message: String,
    /// What memo adds to some refusals: the subtasks a move leaves behind, the parent a subtask has.
    pub details: Value,
}

impl Failure {
    pub fn plain(message: impl Into<String>) -> Failure {
        Failure { reason: None, details: Value::Null, message: message.into() }
    }

    /// A Memo from before the command: commander's own words, before any of Memo's.
    pub fn unknown_command(&self) -> bool {
        self.message.starts_with("unknown command")
    }
}

impl From<Failure> for String {
    fn from(f: Failure) -> String {
        f.message
    }
}

pub fn call_at(bin: &Path, args: &[String], timeout: Duration) -> Result<Value, Failure> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(bin, &refs, Some(&paths::search_path()), timeout).map_err(|e| Failure::plain(e.to_string()))?;
    let json = out.json();
    match json {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v),
        j => Err(Failure {
            // memo puts the reason on the error itself; its notes name `details.reason` as well.
            reason: j
                .as_ref()
                .and_then(|v| v["error"]["reason"].as_str().or_else(|| v["error"]["details"]["reason"].as_str()))
                .map(str::to_string),
            details: j.as_ref().map_or(Value::Null, |v| v["error"]["details"].clone()),
            message: failure(&out, j.as_ref()),
        }),
    }
}

pub fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

pub fn too_old(version: Option<&str>, need: &str) -> bool {
    let Ok(need) = semver::Version::parse(need) else { return false };
    version.and_then(|v| semver::Version::parse(v).ok()).is_none_or(|v| v < need)
}

pub fn with_memo<T>(timeout: Duration, f: impl FnOnce(&Call) -> Result<T, Failure>) -> Result<T, String> {
    let tool = memo()?;
    let bin = crate::tools::program(&tool.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args, timeout)).map_err(String::from)
}
