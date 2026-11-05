//! Puts the folders of installed tools on the user's PATH, so a terminal and the AI apps started from it find them.
//! Nothing here fails an install: a problem comes back in `PathFix`, with the line the user can add themselves.

use crate::{catalog, paths, profile};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(specta::Type, Serialize, Clone, Default, Debug, PartialEq)]
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
    /// Each shell whose files the app keeps, after the change: the terminal's own first.
    pub shells: Vec<ShellReach>,
}

#[derive(specta::Type, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShellReach {
    pub name: String,
    /// The program, as `/etc/shells` or the account lists it.
    pub program: Option<String>,
    /// Startup files that hold the app's blocks, `~`-shortened.
    pub files: Vec<String>,
    /// A new terminal running this shell finds every tool that was missing. `None`: the shell did not answer.
    pub finds: Option<bool>,
    /// The shell the user's terminal runs.
    pub primary: bool,
}

/// The shells the user may say their terminal runs, for the picker shown when the check still fails.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellChoices {
    pub shells: Vec<String>,
    /// The shell the checks use now.
    pub current: Option<String>,
    /// Set when the user picked it, rather than the account listing it.
    pub chosen: Option<String>,
}

pub fn choices() -> ShellChoices {
    let shells = paths::installed_shells().iter().map(|p| p.to_string_lossy().to_string()).collect();
    let show = |p: Option<PathBuf>| p.map(|p| p.to_string_lossy().to_string());
    ShellChoices { shells, current: show(paths::user_shell()), chosen: show(paths::chosen_shell()) }
}

/// The user says which shell their terminal runs: saved, so every later check uses it, then the fix runs again.
pub fn use_shell(shell: &str, ids: &[String]) -> Result<PathFix, String> {
    if cfg!(windows) {
        return Err("Windows terminals read the PATH from your user settings, not from a shell.".into());
    }
    let program = paths::validate_shell(shell, &paths::installed_shells())?;
    paths::choose_shell(&program)?;
    fix(ids)
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
    let mut result = apply(&missing, profile::plan_folder, profile::add_folder);
    if !missing.is_empty() && !cfg!(windows) {
        paths::forget_login_shell();
        let bins: Vec<String> =
            missing.iter().filter_map(|(id, _)| catalog::tool(id).ok().map(|t| t.bin.clone())).collect();
        let shells = profile::shell_files();
        let reach = |program: &Path| paths::shell_path(program).map(|p| bins.iter().all(|b| paths::finds(b, &p)));
        check(&mut result, &missing, &shells, reach, |dir| profile::plan_folder(dir).line);
    }
    Ok(result)
}

/// Asks each shell whether it now finds the tools. A written file is not enough: a profile may reset PATH after the
/// block, or the terminal may run another shell. When the terminal's own shell still misses them, the tools stay
/// unreachable and the line to add by hand is given.
pub fn check(
    fix: &mut PathFix,
    missing: &[(String, PathBuf)],
    shells: &[profile::ShellFiles],
    reach: impl Fn(&Path) -> Option<bool>,
    line: impl Fn(&Path) -> String,
) {
    fix.shells = shells
        .iter()
        .map(|s| ShellReach {
            name: s.name.clone(),
            program: s.program.as_ref().map(|p| p.to_string_lossy().to_string()),
            files: s.files.iter().map(|f| paths::tilde(&f.to_string_lossy())).collect(),
            finds: s.program.as_deref().and_then(&reach),
            primary: s.primary,
        })
        .collect();
    fix.shells.sort_by_key(|s| !s.primary);
    let primary = fix.shells.iter().find(|s| s.primary);
    if primary.is_none_or(|s| s.finds != Some(false)) {
        return;
    }
    for (id, _) in missing {
        if !fix.unreachable.contains(id) {
            fix.unreachable.push(id.clone());
        }
    }
    if fix.manual.is_none() {
        let mut lines: Vec<String> = Vec::new();
        for (_, dir) in missing {
            let l = line(dir);
            if !lines.contains(&l) {
                lines.push(l);
            }
        }
        fix.manual = Some(lines.join("\n"));
    }
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
            serde_json::json!({"added": [], "unreachable": [], "file": null, "manual": null, "restart": false, "shells": []})
        );
    }

    fn shells() -> Vec<profile::ShellFiles> {
        vec![
            profile::ShellFiles {
                name: "bash".into(),
                program: Some("/bin/bash".into()),
                files: vec!["/home/u/.bashrc".into()],
                primary: false,
            },
            profile::ShellFiles {
                name: "zsh".into(),
                program: Some("/usr/bin/zsh".into()),
                files: vec!["/home/u/.zshrc".into()],
                primary: true,
            },
        ]
    }

    #[test]
    fn a_written_file_the_terminal_shell_still_misses_leaves_the_tools_unreachable_with_the_line() {
        let missing = [one("tg", "/opt/x/bin"), one("max", "/opt/x/bin")];
        let mut fix = apply(&missing, |_| plan(false, true), |_| Ok(plan(true, true)));
        check(
            &mut fix,
            &missing,
            &shells(),
            |p| Some(p.ends_with("bash")),
            |_| "export PATH=\"/opt/x/bin:$PATH\"".into(),
        );
        assert_eq!(fix.shells[0].name, "zsh", "the terminal's shell first");
        assert_eq!(fix.shells[0].finds, Some(false));
        assert_eq!(fix.shells[1].finds, Some(true));
        assert_eq!(fix.unreachable, vec!["tg".to_string(), "max".to_string()]);
        assert_eq!(fix.manual.as_deref(), Some("export PATH=\"/opt/x/bin:$PATH\""));
        assert_eq!(fix.added, vec!["/opt/x/bin".to_string()], "what was written is still reported");
    }

    #[test]
    fn a_shell_that_finds_the_tools_or_does_not_answer_changes_nothing() {
        let missing = [one("tg", "/opt/x/bin")];
        for answer in [Some(true), None] {
            let mut fix = apply(&missing, |_| plan(false, true), |_| Ok(plan(true, true)));
            check(&mut fix, &missing, &shells(), |_| answer, |_| unreachable!());
            assert!(fix.unreachable.is_empty() && fix.manual.is_none());
            assert_eq!(fix.shells.len(), 2);
        }
    }
}
