use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{drive_folders, mail_rules, zoom_app};

/// zm's own description of the Zoom app to make before signing in.
#[tauri::command]
pub async fn zoom_app_setup(id: String) -> Result<zoom_app::ZoomAppAnswer, AppError> {
    crate::log::command("zoom_app_setup", async move {
        let tool = known_tool(&id)?;
        attempt(move || zoom_app::setup(tool)).await
    })
    .await
}

/// One level of the profile's Google Drive folders; `parent` is a folder id or `shared-with-me`.
#[tauri::command]
pub async fn drive_folders_browse(
    id: String,
    profile: String,
    parent: Option<String>,
) -> Result<drive_folders::FolderLevel, AppError> {
    crate::log::command("drive_folders_browse", async move {
        let tool = known_tool(&id)?;
        attempt(move || drive_folders::browse(tool, &profile, parent.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn drive_folder_add(
    id: String,
    profile: String,
    folder: String,
) -> Result<drive_folders::FolderAdded, AppError> {
    crate::log::command("drive_folder_add", async move {
        let tool = known_tool(&id)?;
        attempt(move || drive_folders::add(tool, &profile, &folder)).await
    })
    .await
}

/// The folders the profile's sync imports, named when a sync has copied them.
#[tauri::command]
pub async fn drive_folders_chosen(id: String, profile: String) -> Result<drive_folders::ChosenFolders, AppError> {
    crate::log::command("drive_folders_chosen", async move {
        let tool = known_tool(&id)?;
        attempt(move || drive_folders::chosen(tool, &profile)).await
    })
    .await
}

#[tauri::command]
pub async fn drive_folder_remove(
    id: String,
    profile: String,
    folder: String,
) -> Result<drive_folders::FolderRemoved, AppError> {
    crate::log::command("drive_folder_remove", async move {
        let tool = known_tool(&id)?;
        attempt(move || drive_folders::remove(tool, &profile, &folder)).await
    })
    .await
}

/// Google Docs named like Meet transcripts or Gemini notes, in the profile's Drive or shared with it: how many, and
/// the newest names.
#[tauri::command]
pub async fn drive_transcripts_find(id: String, profile: String) -> Result<drive_folders::TranscriptsFound, AppError> {
    crate::log::command("drive_transcripts_find", async move {
        let tool = known_tool(&id)?;
        attempt(move || drive_folders::transcripts(tool, &profile)).await
    })
    .await
}

/// One page of a mailbox's rules, read only.
#[tauri::command]
pub async fn mail_rules_list(
    id: String,
    profile: String,
    page: u32,
    limit: u32,
) -> Result<mail_rules::MailRules, AppError> {
    crate::log::command("mail_rules_list", async move {
        let tool = known_tool(&id)?;
        attempt(move || mail_rules::list(tool, &profile, page, limit)).await
    })
    .await
}
