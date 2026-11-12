//! Running Memo for a page: one command, its JSON on success or the error object Memo printed. Shared by the pages
//! that read and write through Memo's own commands (Tasks, account groups, relationships).

use crate::catalog::{self, Tool};
use crate::skills::failure;
use crate::{memo_server, paths, run};
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
        unknown_to_cli(&self.message)
    }
}

/// What commander, which every WireCat CLI parses its words with, says when the installed version lacks a command or
/// an option the app passes: the tool is older than the app expects, not broken.
pub fn unknown_to_cli(text: &str) -> bool {
    ["unknown command", "unknown option", "too many arguments"].iter().any(|w| text.contains(w))
}

impl From<Failure> for String {
    fn from(f: Failure) -> String {
        f.message
    }
}

/// One memo command, through memo's command server when one is free.
pub fn call_at(bin: &Path, args: &[String], timeout: Duration) -> Result<Value, Failure> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    answer(memo_server::run(bin, &refs, timeout))
}

/// One command of a CLI that is not memo, in a process of its own.
pub fn spawn_at(bin: &Path, args: &[String], timeout: Duration) -> Result<Value, Failure> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    answer(run::run(bin, &refs, Some(&paths::search_path()), timeout))
}

fn answer(out: Result<run::Output, run::RunError>) -> Result<Value, Failure> {
    let out = out.map_err(|e| Failure::plain(e.to_string()))?;
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

pub fn with_memo<T>(timeout: Duration, f: impl FnOnce(&Call) -> Result<T, Failure>) -> Result<T, String> {
    let tool = memo()?;
    let bin = crate::tools::program(&tool.bin).ok_or("Memo is not installed")?;
    f(&|args: &[String]| call_at(&bin, args, timeout)).map_err(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commander_s_refusals_of_a_missing_command_or_option_mean_too_old() {
        for old in [
            "unknown command 'runs'",
            "error: unknown option '--type'",
            "too many arguments for 'mcp'. Expected 0 arguments but got 2: server, status.",
        ] {
            assert!(unknown_to_cli(old), "{old}");
            assert!(Failure::plain(old).unknown_command(), "{old}");
        }
        assert!(!unknown_to_cli("database is locked"));
    }
}
