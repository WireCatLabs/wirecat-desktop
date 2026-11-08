use super::{attempt, blocking};
use crate::error::AppError;
use crate::install::{InstallEvent, Running};
use crate::own_tools;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

/// The switch may have been turned off since the dialog opened.
fn allowed() -> Result<(), AppError> {
    let status = own_tools::status();
    if status.allowed || status.flag {
        Ok(())
    } else {
        Err(AppError::Failed("Allow tools WireCat has not checked in Settings first.".into()))
    }
}

#[tauri::command]
pub fn own_tools_status() -> own_tools::Status {
    own_tools::status()
}

/// Takes effect at once; the interface reads its tools again after it.
#[tauri::command]
pub async fn set_own_tools_allowed(allow: bool) -> Result<(), AppError> {
    crate::log::command("set_own_tools_allowed", async move { attempt(move || own_tools::set_allowed(allow)).await })
        .await
}

/// Reads npm only; nothing of the package runs. `desktop` is the object the owner pasted for a tool without a manifest.
#[tauri::command]
pub async fn own_tool_discover(package: String, desktop: Option<String>) -> Result<own_tools::Discovery, AppError> {
    crate::log::command("own_tool_discover", async move {
        allowed()?;
        blocking(move || own_tools::discover(package.trim(), desktop.as_deref())).await
    })
    .await
}

/// The second confirmation's Install: the reviewed version, verified, then saved for the next start.
#[tauri::command]
pub async fn own_tool_add(
    token: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), AppError> {
    crate::log::command("own_tool_add", async move {
        allowed()?;
        let reviewed = own_tools::take_review(&token).map_err(AppError::Failed)?;
        let running = Arc::clone(&running);
        blocking(move || own_tools::add(&token, reviewed, &running, &on_event)).await
    })
    .await
}

/// Offered when Add installed the package but refused the tool: it is in no catalog, so only its review names it.
#[tauri::command]
pub async fn own_tool_uninstall(
    token: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), AppError> {
    crate::log::command("own_tool_uninstall", async move {
        let reviewed = own_tools::take_added(&token).map_err(AppError::Failed)?;
        let running = Arc::clone(&running);
        blocking(move || own_tools::uninstall(&reviewed, &running, &on_event)).await
    })
    .await
}

/// Removes the entry only; the interface offers Uninstall and the tool's own data folders after it.
#[tauri::command]
pub async fn own_tool_remove(id: String) -> Result<(), AppError> {
    crate::log::command("own_tool_remove", async move { attempt(move || own_tools::remove_saved(&id)).await }).await
}

/// GitHub's facts about the reviewed repository, asked after the review shows; a failure is a signal, never an error.
#[tauri::command]
pub async fn own_tool_risks(token: String) -> Result<Vec<crate::own_risks::Signal>, AppError> {
    crate::log::command("own_tool_risks", async move { attempt(move || own_tools::risks(&token)).await }).await
}
