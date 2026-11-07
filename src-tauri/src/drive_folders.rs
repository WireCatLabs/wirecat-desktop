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

fn failure(out: &crate::run::Output, json: Option<&Value>) -> (String, Option<String>, Option<String>) {
    let message = skills::failure(out, json);
    let text = format!("{message}\n{}", out.stderr).to_lowercase();
    if text.contains("unknown command") || text.contains("unknown option") {
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
    }
}
