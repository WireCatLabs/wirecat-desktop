//! Choosing Drive folders in the window: drive's own `folders browse` lists one level of the owner's Google Drive and
//! `folders add` imports one. Folder names are the owner's data: they reach the window and nothing else, never a log.

use crate::catalog::{self, Tool};
use crate::signin_steps::NEEDS_UPDATE;
use crate::skills;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const BROWSE: Duration = Duration::from_mins(1);
/// The top level of the tree for files others shared: drive's own word, not a Google id.
const SHARED_WITH_ME: &str = "shared-with-me";

#[derive(Debug, Deserialize)]
pub struct FolderPickerSource {
    /// `{profile}` is the profile the owner chose.
    pub browse: Vec<String>,
    /// The flag that takes the folder to list inside.
    pub parent: String,
    /// `{profile}` and `{folder}`, a validated Google id.
    pub add: Vec<String>,
    /// The folder ids the profile's sync imports, without names.
    pub list: Vec<String>,
    /// `{folder}`: stop importing it; drive's next sync drops what it copied from there.
    pub remove: Vec<String>,
    /// `{folder}`: the copied folder's name, offline; a folder not synced yet has none.
    pub name: Vec<String>,
    /// Google Docs named like Meet transcripts or Gemini notes, wherever they sit; imports nothing.
    #[serde(default)]
    pub transcripts: Option<TranscriptsSource>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptsSource {
    /// The first drive with `transcripts list`; absent until one is released, and the window asks for an update.
    #[serde(default)]
    pub min_version: Option<String>,
    pub list: Vec<String>,
}

/// How many Docs look like Meet transcripts or Gemini notes, with the newest few names to show before the owner chooses.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum TranscriptsFound {
    Found { count: u32, titles: Vec<String> },
    Failed { message: String, code: Option<String>, reason: Option<String> },
}

const SHOWN_TITLES: usize = 3;

/// A folder the profile imports; `name` is `None` until a sync has copied it.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChosenFolder {
    pub id: String,
    pub name: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum ChosenFolders {
    Listed { folders: Vec<ChosenFolder> },
    Failed { message: String, code: Option<String>, reason: Option<String> },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DriveFolder {
    pub id: String,
    pub name: String,
    /// `my_drive`, `shared_with_me`, `shared_drive` or `folder`.
    pub kind: String,
    pub parent: Option<String>,
    pub location: Option<String>,
    pub drive_id: Option<String>,
    /// `None` when drive did not count them.
    pub child_folders: Option<u64>,
    pub added: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum FolderLevel {
    /// `partial` is true when Google searched only some drives, so folders may be missing.
    Listed {
        folders: Vec<DriveFolder>,
        partial: bool,
    },
    Failed {
        message: String,
        code: Option<String>,
        reason: Option<String>,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum FolderAdded {
    Added,
    Failed { message: String, code: Option<String>, reason: Option<String> },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum FolderRemoved {
    Removed,
    Failed { message: String, code: Option<String>, reason: Option<String> },
}

fn source(tool: &Tool) -> Result<&FolderPickerSource, String> {
    tool.folder_picker.as_ref().ok_or_else(|| format!("{} has no folder picker", tool.name))
}

/// A Google id or the folder id drive printed: letters, digits, `-` and `_`. Never starts with `-`, so the tool
/// cannot read it as an option.
fn valid_id(id: &str) -> bool {
    (1..=200).contains(&id.len())
        && !id.starts_with('-')
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

fn checked(id: &str) -> Result<(), String> {
    if valid_id(id) { Ok(()) } else { Err("That is not a Drive folder id.".into()) }
}

pub fn browse(tool: &Tool, profile: &str, parent: Option<&str>) -> Result<FolderLevel, String> {
    let src = source(tool)?;
    let mut args = catalog::with_profile(&src.browse, Some(profile))?;
    if let Some(parent) = parent {
        checked(parent)?;
        args.extend([src.parent.clone(), parent.to_string()]);
    }
    let (out, json) = skills::call(tool, &args, BROWSE)?;
    if let Some(json) = json.as_ref().filter(|_| out.code == Some(0)) {
        return Ok(read_level(json));
    }
    let (message, code, reason) = failure(&out, json.as_ref());
    Ok(FolderLevel::Failed { message, code, reason })
}

pub fn add(tool: &Tool, profile: &str, folder: &str) -> Result<FolderAdded, String> {
    let src = source(tool)?;
    checked(folder)?;
    if folder == SHARED_WITH_ME {
        return Err("Files others shared are not a folder. Open it and choose a folder inside.".into());
    }
    let args: Vec<String> = catalog::with_profile(&src.add, Some(profile))?
        .into_iter()
        .map(|a| if a == "{folder}" { folder.to_string() } else { a })
        .collect();
    let (out, json) = skills::call(tool, &args, BROWSE)?;
    if out.code == Some(0) {
        return Ok(FolderAdded::Added);
    }
    let (message, code, reason) = failure(&out, json.as_ref());
    Ok(FolderAdded::Failed { message, code, reason })
}

/// The folders the profile imports, each with its name when a sync has copied it.
pub fn chosen(tool: &Tool, profile: &str) -> Result<ChosenFolders, String> {
    let src = source(tool)?;
    let (out, json) = skills::call(tool, &catalog::with_profile(&src.list, Some(profile))?, BROWSE)?;
    let Some(json) = json.as_ref().filter(|_| out.code == Some(0)) else {
        let (message, code, reason) = failure(&out, json.as_ref());
        return Ok(ChosenFolders::Failed { message, code, reason });
    };
    let folders = chosen_ids(json)
        .into_iter()
        .map(|id| {
            let name = name_of(tool, src, profile, &id);
            ChosenFolder { id, name }
        })
        .collect();
    Ok(ChosenFolders::Listed { folders })
}

fn chosen_ids(json: &Value) -> Vec<String> {
    let body = skills::body(json);
    let items = json["items"].as_array().or_else(|| body["items"].as_array());
    items.into_iter().flatten().filter_map(|v| v["id"].as_str().filter(|id| valid_id(id)).map(str::to_string)).collect()
}

fn name_of(tool: &Tool, src: &FolderPickerSource, profile: &str, folder: &str) -> Option<String> {
    let args = with_folder(catalog::with_profile(&src.name, Some(profile)).ok()?, folder);
    let (out, json) = skills::call(tool, &args, BROWSE).ok()?;
    if out.code != Some(0) {
        return None;
    }
    skills::body(json.as_ref()?)["name"].as_str().map(str::to_string)
}

fn with_folder(args: Vec<String>, folder: &str) -> Vec<String> {
    args.into_iter().map(|a| if a == "{folder}" { folder.to_string() } else { a }).collect()
}

/// Stops importing one folder; its files in Drive are not touched.
pub fn remove(tool: &Tool, profile: &str, folder: &str) -> Result<FolderRemoved, String> {
    let src = source(tool)?;
    checked(folder)?;
    let args = with_folder(catalog::with_profile(&src.remove, Some(profile))?, folder);
    let (out, json) = skills::call(tool, &args, BROWSE)?;
    if out.code == Some(0) {
        return Ok(FolderRemoved::Removed);
    }
    let (message, code, reason) = failure(&out, json.as_ref());
    Ok(FolderRemoved::Failed { message, code, reason })
}

/// drive's `transcripts list`: the count and the newest names. The names are the owner's data and reach only the window.
pub fn transcripts(tool: &Tool, profile: &str) -> Result<TranscriptsFound, String> {
    let src = source(tool)?;
    let found = src.transcripts.as_ref().ok_or_else(|| format!("{} cannot list meeting transcripts", tool.name))?;
    let argv = catalog::with_profile(&found.list, Some(profile))?;
    let released = found.min_version.as_deref().is_some_and(|need| crate::task_board::unusable(tool, need).is_none());
    if !released {
        return Ok(too_old("This version cannot find meeting transcripts yet. Update it on the Tools page."));
    }
    let (out, json) = skills::call(tool, &argv, BROWSE)?;
    if let Some(json) = json.as_ref().filter(|_| out.code == Some(0)) {
        return Ok(read_transcripts(json));
    }
    let (message, code, reason) = failure(&out, json.as_ref());
    Ok(TranscriptsFound::Failed { message, code, reason })
}

fn too_old(message: &str) -> TranscriptsFound {
    TranscriptsFound::Failed { message: message.into(), code: Some(NEEDS_UPDATE.into()), reason: None }
}

fn read_transcripts(json: &Value) -> TranscriptsFound {
    let body = skills::body(json);
    let items: Vec<&Value> =
        json["items"].as_array().or_else(|| body["items"].as_array()).into_iter().flatten().collect();
    let mut named: Vec<(&str, &str)> =
        items.iter().filter_map(|v| Some((v["modified_at"].as_str().unwrap_or(""), v["name"].as_str()?))).collect();
    // ISO 8601 times in one zone sort as text.
    named.sort_by(|a, b| b.0.cmp(a.0));
    TranscriptsFound::Found {
        count: u32::try_from(items.len()).unwrap_or(u32::MAX),
        titles: named.into_iter().take(SHOWN_TITLES).map(|(_, name)| name.to_string()).collect(),
    }
}

fn failure(out: &crate::run::Output, json: Option<&Value>) -> (String, Option<String>, Option<String>) {
    let message = skills::failure(out, json);
    let text = format!("{message}\n{}", out.stderr).to_lowercase();
    if crate::memo_cli::unknown_to_cli(&text) {
        return (
            "This version cannot list Drive folders yet. Update it on the Tools page.".into(),
            Some(NEEDS_UPDATE.into()),
            None,
        );
    }
    let word = |k: &str| json.and_then(|v| v["error"][k].as_str()).map(str::to_string);
    (message, word("code"), word("reason"))
}

fn read_level(json: &Value) -> FolderLevel {
    let body = skills::body(json);
    let items = json["items"].as_array().or_else(|| body["items"].as_array());
    let missing = !json["missing"].is_null() || !body["missing"].is_null();
    FolderLevel::Listed { folders: items.into_iter().flatten().filter_map(folder_of).collect(), partial: missing }
}

fn folder_of(v: &Value) -> Option<DriveFolder> {
    let id = v["id"].as_str().filter(|id| id.len() <= 200).map(str::to_string)?;
    let text = |k: &str| v[k].as_str().map(str::to_string);
    Some(DriveFolder {
        id,
        name: v["name"].as_str()?.to_string(),
        kind: text("kind")?,
        parent: text("parent"),
        location: text("location"),
        drive_id: text("drive_id"),
        child_folders: v["child_folders"].as_u64(),
        added: v["added"].as_bool().unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_level_with_uncounted_folders_and_a_partial_search() {
        let json = serde_json::json!({
            "items": [
                { "id": "my-drive-id", "name": "My Drive", "kind": "my_drive", "parent": null, "location": "my_drive",
                  "drive_id": null, "child_folders": 3, "added": true },
                { "id": "shared-with-me", "name": "Shared with me", "kind": "shared_with_me", "parent": null,
                  "location": "shared_with_me", "drive_id": null, "child_folders": null, "added": false },
            ],
            "missing": [{ "field": "items", "why": "Google searched only some of the drives" }]
        });
        let FolderLevel::Listed { folders, partial } = read_level(&json) else { panic!("not listed") };
        assert!(partial);
        assert_eq!(folders.len(), 2);
        assert_eq!((folders[0].child_folders, folders[0].added), (Some(3), true));
        assert_eq!(folders[1].child_folders, None);
        let nested = serde_json::json!({ "item": { "items": [{ "id": "a", "name": "A", "kind": "folder" }] } });
        assert!(matches!(read_level(&nested), FolderLevel::Listed { folders, partial: false } if folders.len() == 1));
    }

    #[test]
    fn an_id_is_a_google_id_and_never_an_option() {
        for ok in ["1AbC_d-9", "shared-with-me", "root"] {
            assert!(valid_id(ok), "{ok}");
        }
        for bad in ["", "-x", "--parent", "a b", "a'or'x", "a/b", &"x".repeat(201)] {
            assert!(!valid_id(bad), "{bad}");
        }
        let drive = catalog::tool("drive").unwrap();
        assert!(add(drive, "personal", "shared-with-me").is_err());
        assert!(add(drive, "--help", "abc").is_err());
        assert!(browse(drive, "personal", Some("-x")).is_err());
        assert!(browse(catalog::tool("tg").unwrap(), "personal", None).is_err());
        assert!(remove(drive, "personal", "--all").is_err());
        assert!(remove(drive, "a;b", "abc").is_err());
    }

    #[test]
    fn counts_every_transcript_and_names_the_newest_three() {
        let json = serde_json::json!({ "items": [
            { "id": "a", "name": "Old sync - Transcript", "modified_at": "2026-11-01T10:00:00.000Z" },
            { "id": "b", "name": "Planning - Notes by Gemini", "modified_at": "2026-11-12T10:00:00.000Z" },
            { "id": "c", "name": "Retro - Transcript", "modified_at": "2026-11-10T10:00:00.000Z" },
            { "id": "d", "name": "Standup - Transcript", "modified_at": "2026-11-11T10:00:00.000Z" },
        ], "has_more": false });
        assert_eq!(
            read_transcripts(&json),
            TranscriptsFound::Found {
                count: 4,
                titles: vec![
                    "Planning - Notes by Gemini".into(),
                    "Standup - Transcript".into(),
                    "Retro - Transcript".into()
                ],
            }
        );
        assert_eq!(
            read_transcripts(&serde_json::json!({ "item": { "items": [] } })),
            TranscriptsFound::Found { count: 0, titles: vec![] }
        );
        assert!(transcripts(catalog::tool("tg").unwrap(), "personal").is_err());
        assert!(transcripts(catalog::tool("drive").unwrap(), "--help").is_err());
    }

    #[test]
    fn asks_for_an_update_until_a_drive_with_transcripts_is_released() {
        let drive = catalog::tool("drive").unwrap();
        if drive.folder_picker.as_ref().and_then(|p| p.transcripts.as_ref()).is_some_and(|t| t.min_version.is_none()) {
            let found = transcripts(drive, "personal").unwrap();
            assert!(matches!(found, TranscriptsFound::Failed { code: Some(ref c), .. } if c == NEEDS_UPDATE));
        }
    }

    #[test]
    fn reads_the_chosen_ids_and_drops_anything_that_is_not_one() {
        let json =
            serde_json::json!({ "items": [{ "id": "1AbC" }, { "id": "-x" }, { "name": "no id" }], "has_more": false });
        assert_eq!(chosen_ids(&json), vec!["1AbC".to_string()]);
        assert_eq!(chosen_ids(&serde_json::json!({ "items": [] })), Vec::<String>::new());
    }
}
