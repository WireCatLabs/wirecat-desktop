//! Puts the folders of installed tools on the user's PATH, so a terminal and the AI apps started from it find them.
//! Nothing here fails an install: a problem comes back in `PathFix`, with the line the user can add themselves.

use crate::{catalog, paths, profile};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathFix {
    /// Folders now on the PATH, `~`-shortened.
    pub added: Vec<String>,
    /// Tool ids a terminal still does not find.
    pub unreachable: Vec<String>,
    /// The profile file, or the registry value on Windows, that was edited.
    pub file: Option<String>,
    /// The line to add by hand when the shell is unknown or the file could not be written.
    pub manual: Option<String>,
    /// Open terminals and AI apps keep the old PATH until they restart.
    pub restart: bool,
}

/// Fixes every listed tool that is installed but not found by a fresh terminal.
pub fn fix(ids: &[String]) -> Result<PathFix, String> {
    let mut missing = Vec::new();
    for id in ids {
        let tool = catalog::tool(id)?;
        let Some(dir) = paths::find(&tool.bin).and_then(|p| p.parent().map(Path::to_path_buf)) else { continue };
        if !paths::in_terminal(&tool.bin) {
            missing.push((id.clone(), dir));
        }
    }
    Ok(apply(&missing, profile::plan_folder, profile::add_folder))
}

/// `missing` is tool id and the folder holding its program. A folder is written once however many tools share it.
pub fn apply(
    missing: &[(String, PathBuf)],
    plan: impl Fn(&Path) -> profile::PathPlan,
    add: impl Fn(&Path) -> Result<profile::PathPlan, String>,
) -> PathFix {
    let mut fix = PathFix::default();
    let mut manual: Vec<String> = Vec::new();
    let mut seen: Vec<&Path> = Vec::new();
    for (id, dir) in missing {
        let shown = paths::tilde(&dir.to_string_lossy());
        let first = !seen.contains(&dir.as_path());
        if first {
            seen.push(dir);
        }
        let current = plan(dir);
        let done = if current.added {
            true
        } else if current.automatic {
            if first { add(dir).is_ok() } else { fix.added.contains(&shown) }
        } else {
            false
        };
        if done {
            if first {
                fix.added.push(shown);
                fix.file = current.file;
                fix.restart = true;
            }
        } else {
            fix.unreachable.push(id.clone());
            if first && !manual.contains(&current.line) {
                manual.push(current.line);
            }
        }
    }
    fix.manual = (!manual.is_empty()).then(|| manual.join("\n"));
    fix
}

/// After Node.js setup: its folder goes on the PATH when that can be done automatically and is not done yet.
pub fn after_node_setup(bin: &Path) -> Option<PathFix> {
    let plan = profile::plan(bin);
    if plan.added {
        return None;
    }
    let shown = paths::tilde(&bin.to_string_lossy());
    if plan.automatic && profile::add(bin).is_ok() {
        return Some(PathFix { added: vec![shown], file: plan.file, restart: true, ..PathFix::default() });
    }
    Some(PathFix { manual: Some(plan.line), ..PathFix::default() })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan(added: bool, automatic: bool) -> profile::PathPlan {
        profile::PathPlan {
            shell: "bash".into(),
            file: Some("~/.bashrc".into()),
            line: "export PATH=\"$HOME/.local/bin:$PATH\"".into(),
            added,
            automatic,
        }
    }

    fn one(id: &str, dir: &str) -> (String, PathBuf) {
        (id.into(), PathBuf::from(dir))
    }

    #[test]
    fn a_folder_shared_by_two_tools_is_written_once() {
        let calls = std::cell::Cell::new(0);
        let missing = [one("tg", "/opt/x/bin"), one("max", "/opt/x/bin")];
        let fix = apply(
            &missing,
            |_| plan(false, true),
            |_| {
                calls.set(calls.get() + 1);
                Ok(plan(true, true))
            },
        );
        assert_eq!(calls.get(), 1);
        assert_eq!(fix.added, vec!["/opt/x/bin".to_string()]);
        assert!(fix.unreachable.is_empty() && fix.restart && fix.manual.is_none());
        assert_eq!(fix.file.as_deref(), Some("~/.bashrc"));
    }

    #[test]
    fn an_unknown_shell_gets_the_line_to_add_by_hand() {
        let fix = apply(&[one("tg", "/opt/x/bin")], |_| plan(false, false), |_| unreachable!());
        assert_eq!(fix.unreachable, vec!["tg".to_string()]);
        assert!(fix.added.is_empty() && !fix.restart);
        assert!(fix.manual.unwrap().starts_with("export PATH="));
    }

    #[test]
    fn a_failed_write_is_reported_not_raised() {
        let fix = apply(&[one("tg", "/opt/x/bin")], |_| plan(false, true), |_| Err("read-only".into()));
        assert_eq!(fix.unreachable, vec!["tg".to_string()]);
        assert!(fix.manual.is_some() && !fix.restart);
    }

    #[test]
    fn nothing_missing_changes_nothing_and_the_shape_is_camel_case() {
        let fix = apply(&[], |_| unreachable!(), |_| unreachable!());
        assert_eq!(fix, PathFix::default());
        let json = serde_json::to_value(&fix).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"added": [], "unreachable": [], "file": null, "manual": null, "restart": false})
        );
    }
}
