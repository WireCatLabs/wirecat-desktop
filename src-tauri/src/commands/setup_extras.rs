use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{drive_folders, zoom_app};

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
