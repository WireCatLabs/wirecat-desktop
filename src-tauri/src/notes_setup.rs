//! memo's first run: which folders hold the owner's notes, the first read of them, and the search model. Every step is
//! memo's own command from the catalog's `notesSetup`; the interface sends only a folder the owner picked in the system
//! window (`commands/notes_setup.rs`), which is checked here before memo sees it.

use crate::catalog::Tool;
use crate::run::{self, Line, RunError};
use crate::skills::too_old;
use crate::sync::{CountUnit, counted_of, is_label};
use crate::{paths, tools};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);
/// 218 MB on a slow line still fits; memo's own timeout ends a stuck download first.
const DOWNLOAD_LIMIT: Duration = Duration::from_hours(1);
const GRACE: Duration = Duration::from_secs(5);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesSetupSource {
    pub min_version: String,
    pub folders: Vec<String>,
    /// `{path}` is filled only with a folder `checked_folder` accepted.
    pub add: Vec<String>,
    /// `{id}` is filled only with an id `checked_folder_id` accepted. Keeps the folder's notes searchable.
    pub remove: Vec<String>,
    /// Like `remove`, and deletes that folder's notes from memo's store (never files on disk).
    pub remove_delete: Vec<String>,
    pub sync: Vec<String>,
    pub models: Vec<String>,
    /// The search model's id in `models list`.
    pub model: String,
    pub download: Vec<String>,
}

/// What went wrong, in a closed list: the interface has words and an action for each, and memo's own message (which can
/// name a folder) never leaves Rust.
#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NotesProblem {
    /// The folder is gone, is a file, or this app may not read it.
    FolderUnreadable,
    DiskFull,
    Offline,
    /// The installed memo does not know the command.
    TooOld,
    /// Another memo run (a sync, an import) holds the store.
    Busy,
    Other,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NotesFolder {
    pub id: String,
    /// Its last path part; the owner's own words for it.
    pub name: String,
    /// On this computer, with the home folder as `~`. `None` for a folder another computer or Drive keeps.
    pub path: Option<String>,
    pub format: String,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NotesModel {
    pub id: String,
    pub title: String,
    pub size_bytes: u64,
    pub downloaded: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum NotesSetup {
    NoMemo,
    Old {
        version: Option<String>,
        need: String,
    },
    /// `model` is `None` when memo's list does not name the search model.
    Ready {
        folders: Vec<NotesFolder>,
        model: Option<NotesModel>,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum NotesFolderAdded {
    Added { folder: NotesFolder },
    Failed { problem: NotesProblem },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum NotesFolderRemoved {
    #[serde(rename_all = "camelCase")]
    Removed {
        notes_deleted: Option<u64>,
    },
    Failed {
        problem: NotesProblem,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum NotesModelEvent {
    /// How far the download is, in bytes. `label` is the model's id.
    Counted {
        done: u64,
        total: u64,
        unit: CountUnit,
        label: Option<String>,
    },
    Done,
    Stopped,
    Failed {
        problem: NotesProblem,
    },
}

fn source(tool: &Tool) -> Result<&NotesSetupSource, String> {
    tool.notes_setup.as_ref().ok_or_else(|| format!("{} has no first-run setup", tool.name))
}

/// A folder the system window returned, or any path a caller sends: absolute, a real folder, readable. Absolute also
/// means it never starts with `-`, so memo cannot read it as an option.
pub fn checked_folder(path: &str) -> Result<String, NotesProblem> {
    let p = Path::new(path);
    if path.contains('\0') || !p.is_absolute() {
        return Err(NotesProblem::FolderUnreadable);
    }
    let real = p.canonicalize().map_err(|_| NotesProblem::FolderUnreadable)?;
    if !real.is_dir() || std::fs::read_dir(&real).is_err() {
        return Err(NotesProblem::FolderUnreadable);
    }
    real.to_str().map(str::to_string).ok_or(NotesProblem::FolderUnreadable)
}

/// A folder id memo printed: letters, digits and `_.-`, never starting with `-`, so memo cannot read it as an option.
pub fn checked_folder_id(id: &str) -> Result<&str, NotesProblem> {
    if is_label(id) && !id.contains(':') { Ok(id) } else { Err(NotesProblem::Other) }
}

fn with(words: &[String], key: &str, value: &str) -> Vec<String> {
    words.iter().map(|w| if w == key { value.to_string() } else { w.clone() }).collect()
}

/// The problem a memo failure means, from its error envelope. Text is read here and dropped.
pub fn problem_of(out: &run::Output, json: Option<&Value>) -> NotesProblem {
    let code = json.and_then(|v| v["error"]["code"].as_str()).unwrap_or_default();
    let reason = json.and_then(|v| v["error"]["reason"].as_str()).unwrap_or_default();
    let text = json
        .and_then(|v| v["error"]["message"].as_str())
        .map_or_else(|| format!("{}\n{}", out.stderr, out.stdout), str::to_string)
        .to_lowercase();
    classify(code, reason, &text)
}

fn classify(code: &str, reason: &str, text: &str) -> NotesProblem {
    let has = |words: &[&str]| words.iter().any(|w| text.contains(w));
    if has(&["unknown command", "unknown option"]) {
        NotesProblem::TooOld
    } else if has(&["enospc", "no space left", "disk full", "not enough space"]) {
        NotesProblem::DiskFull
    } else if reason == "profile.locked" || code == "conflict" || has(&["holds this", "is locked"]) {
        NotesProblem::Busy
    } else if code == "permission_error"
        || reason.starts_with("folder.")
        || has(&["is not a folder", "eacces", "eperm", "enoent", "permission denied", "no such file"])
    {
        NotesProblem::FolderUnreadable
    } else if matches!(code, "network_error" | "provider_unavailable" | "timeout")
        || has(&["enotfound", "eai_again", "econnrefused", "econnreset", "etimedout", "fetch failed", "offline"])
    {
        NotesProblem::Offline
    } else {
        NotesProblem::Other
    }
}

fn folder_of(v: &Value) -> Option<NotesFolder> {
    let id = v["id"].as_str()?.to_string();
    let path = v["path"].as_str().map(paths::tilde);
    let name = v["name"].as_str().map(str::to_string).or_else(|| {
        let last = Path::new(v["path"].as_str()?).file_name()?;
        Some(last.to_string_lossy().into_owned())
    })?;
    Some(NotesFolder { id, name, path, format: v["format"].as_str().unwrap_or("markdown").to_string() })
}

/// The folders on this computer. Those memo knows from another computer, or keeps for Drive, have no path here and
/// are left out: the card is about this computer's notes.
fn folders_of(v: &Value) -> Vec<NotesFolder> {
    v["items"].as_array().into_iter().flatten().filter(|i| i["path"].is_string()).filter_map(folder_of).collect()
}

fn model_of(v: &Value, id: &str) -> Option<NotesModel> {
    let m = v["items"].as_array()?.iter().find(|m| m["id"].as_str() == Some(id))?;
    Some(NotesModel {
        id: id.to_string(),
        title: m["title"].as_str()?.to_string(),
        size_bytes: m["size_bytes"].as_u64()?,
        downloaded: m["downloaded"].as_bool()?,
    })
}

pub fn status(tool: &Tool) -> Result<NotesSetup, String> {
    let src = source(tool)?;
    let state = tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(NotesSetup::NoMemo) };
    if too_old(first.version.as_deref(), &src.min_version) {
        return Ok(NotesSetup::Old { version: first.version.clone(), need: src.min_version.clone() });
    }
    let (out, json) = crate::skills::call(tool, &src.folders, CALL)?;
    let Some(list) = json.filter(|_| out.code == Some(0)) else {
        return Err(crate::skills::failure(&out, out.json().as_ref()));
    };
    // Without the model list the card still works for folders; the search step then stays hidden.
    let model = crate::skills::call(tool, &src.models, CALL)
        .ok()
        .and_then(|(o, j)| j.filter(|_| o.code == Some(0)))
        .and_then(|v| model_of(&v, &src.model));
    Ok(NotesSetup::Ready { folders: folders_of(&list), model })
}

pub fn add_folder(tool: &Tool, path: &str) -> Result<NotesFolderAdded, String> {
    let src = source(tool)?;
    let path = match checked_folder(path) {
        Ok(p) => p,
        Err(problem) => return Ok(NotesFolderAdded::Failed { problem }),
    };
    let (out, json) = crate::skills::call(tool, &with(&src.add, "{path}", &path), CALL)?;
    if out.code == Some(0)
        && let Some(folder) = json.as_ref().map(crate::skills::body).and_then(folder_of)
    {
        return Ok(NotesFolderAdded::Added { folder });
    }
    Ok(NotesFolderAdded::Failed { problem: problem_of(&out, json.as_ref()) })
}

pub fn remove_folder(tool: &Tool, id: &str, delete_notes: bool) -> Result<NotesFolderRemoved, String> {
    let src = source(tool)?;
    let id = match checked_folder_id(id) {
        Ok(id) => id,
        Err(problem) => return Ok(NotesFolderRemoved::Failed { problem }),
    };
    let words = if delete_notes { &src.remove_delete } else { &src.remove };
    let (out, json) = crate::skills::call(tool, &with(words, "{id}", id), CALL)?;
    if out.code == Some(0)
        && let Some(item) = json.as_ref().map(crate::skills::body).filter(|i| i["removed"].as_bool() == Some(true))
    {
        return Ok(NotesFolderRemoved::Removed { notes_deleted: item["notes_deleted"].as_u64() });
    }
    Ok(NotesFolderRemoved::Failed { problem: problem_of(&out, json.as_ref()) })
}

pub fn download_args(tool: &Tool) -> Result<Vec<String>, String> {
    let src = source(tool)?;
    Ok(with(&src.download, "{model}", &src.model))
}

pub fn sync_args(tool: &Tool) -> Result<Vec<String>, String> {
    Ok(source(tool)?.sync.clone())
}

/// Downloads the one catalog model. A memo that prints no progress lines leaves the bar without an end; a stop kills it.
pub fn download(tool: &Tool, args: &[String], stopped: &dyn Fn() -> bool, send: &dyn Fn(NotesModelEvent)) {
    let Some(bin) = tools::program(&tool.bin) else {
        return send(NotesModelEvent::Failed { problem: NotesProblem::Other });
    };
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    let (mut out, mut err) = (String::new(), String::new());
    let result = run::stream_stoppable(cmd, DOWNLOAD_LIMIT, stopped, GRACE, drop, |line| match line {
        Line::Out(l) => out = format!("{out}{l}\n"),
        Line::Err(l) => match counted_of(&l, "download") {
            Some(c) => send(NotesModelEvent::Counted { done: c.done, total: c.total, unit: c.unit, label: c.label }),
            None => err = format!("{err}{l}\n"),
        },
    });
    let output = run::Output { code: None, stdout: out, stderr: err };
    let json = output.json().or_else(|| serde_json::from_str(output.stderr.lines().last().unwrap_or_default()).ok());
    send(match result {
        _ if stopped() => NotesModelEvent::Stopped,
        Err(RunError::Cancelled) => NotesModelEvent::Stopped,
        Err(RunError::TimedOut) => NotesModelEvent::Failed { problem: NotesProblem::Offline },
        Err(_) => NotesModelEvent::Failed { problem: NotesProblem::Other },
        Ok(Some(0)) => NotesModelEvent::Done,
        Ok(_) => NotesModelEvent::Failed { problem: problem_of(&output, json.as_ref()) },
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_folder_must_be_an_absolute_existing_directory() {
        let dir = std::env::temp_dir();
        assert!(checked_folder(dir.to_str().unwrap()).is_ok());
        for bad in ["", "notes", "-rf", "--json", "~/notes", "../x", "/no/such/folder/here", "/etc/pass\0wd"] {
            assert_eq!(checked_folder(bad), Err(NotesProblem::FolderUnreadable), "{bad}");
        }
    }

    #[test]
    fn a_file_is_not_a_folder() {
        let file = std::env::temp_dir().join(format!("wirecat-notes-setup-{}", std::process::id()));
        std::fs::write(&file, "x").unwrap();
        assert_eq!(checked_folder(file.to_str().unwrap()), Err(NotesProblem::FolderUnreadable));
        std::fs::remove_file(file).unwrap();
    }

    #[test]
    fn a_folder_id_is_a_plain_word_that_is_never_an_option() {
        for good in ["3", "26", "a_b-c.d"] {
            assert_eq!(checked_folder_id(good), Ok(good));
        }
        let long = "1".repeat(65);
        for bad in ["", "-1", "--yes", "../x", "/a", "a b", "a;b", "google-drive:1", "1\n2", long.as_str()] {
            assert_eq!(checked_folder_id(bad), Err(NotesProblem::Other), "{bad}");
        }
    }

    #[test]
    fn the_path_is_the_only_word_filled_in() {
        let words = vec!["folders".into(), "add".into(), "{path}".into(), "--json".into()];
        assert_eq!(with(&words, "{path}", "/a b/c"), ["folders", "add", "/a b/c", "--json"]);
    }

    #[test]
    fn memo_failures_become_one_problem() {
        assert_eq!(classify("not_found", "", "/x is not a folder"), NotesProblem::FolderUnreadable);
        assert_eq!(classify("internal_error", "", "enospc: no space left on device"), NotesProblem::DiskFull);
        assert_eq!(classify("network_error", "", "fetch failed"), NotesProblem::Offline);
        assert_eq!(classify("validation_error", "", "unknown command 'download'"), NotesProblem::TooOld);
        assert_eq!(classify("provider_unavailable", "profile.locked", "another sync holds this"), NotesProblem::Busy);
        assert_eq!(classify("internal_error", "", "boom"), NotesProblem::Other);
    }

    #[test]
    fn only_folders_with_a_path_here_are_listed() {
        let v: Value = serde_json::json!({"items": [
            {"id": "26", "path": "/home/a/notes", "format": "obsidian"},
            {"id": "7", "name": "Vault", "format": "obsidian", "path": null},
            {"id": "22", "name": "google-drive:1", "format": "markdown", "path": null, "kept_by": "drive"}
        ]});
        let found = folders_of(&v);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "notes");
    }
}
