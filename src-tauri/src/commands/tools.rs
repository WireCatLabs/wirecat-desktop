use super::blocking;
use crate::install::InstallEvent;
use crate::install::Running;
use crate::{background, catalog, compat, config_repair, install, terminal, tools};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn detect_tools(fresh: bool) -> Result<Vec<tools::ToolState>, String> {
    blocking(move || tools::detect_all(fresh)).await
}

#[tauri::command]
pub async fn latest_versions(fresh: bool) -> Result<HashMap<String, Option<String>>, String> {
    blocking(move || tools::latest_versions(fresh).into_iter().collect()).await
}

#[tauri::command]
pub async fn list_profiles(id: String) -> Result<Option<Vec<tools::Profile>>, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tools::profiles(tool)).await?
}

#[tauri::command]
pub async fn diagnose(id: String, profile: Option<String>) -> Result<tools::Diagnosis, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tools::diagnose(tool, profile.as_deref())).await?
}

#[tauri::command]
pub async fn install_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), String> {
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    let done = blocking(move || install::install(tool, &running, &on_event)).await;
    compat::forget();
    done
}

#[tauri::command]
pub async fn uninstall_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), String> {
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    let done = blocking(move || install::uninstall(tool, &running, &on_event)).await;
    compat::forget();
    done
}

/// One unused copy of a tool, named by the path the interface was given; see `install::remove_copy`.
#[tauri::command]
pub async fn remove_copy(
    id: String,
    path: String,
    running: State<'_, Arc<Running>>,
) -> Result<install::CopyRemoval, String> {
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    let done = blocking(move || install::remove_copy(tool, &path, &running)).await;
    compat::forget();
    done
}

#[tauri::command]
pub async fn background_status(id: String, profile: String) -> Result<background::Background, String> {
    let tool = catalog::tool(&id)?;
    catalog::validate_profile(&profile)?;
    blocking(move || background::status(tool, &profile)).await?
}

#[tauri::command]
pub async fn background_keep(id: String, profile: String) -> Result<background::Background, String> {
    let tool = catalog::tool(&id)?;
    catalog::validate_profile(&profile)?;
    blocking(move || background::keep(tool, &profile)).await?
}

#[tauri::command]
pub fn cancel_install(id: String, running: State<'_, Arc<Running>>) {
    // Only an install's own key: any other string would stop whatever runs under it, a sync or a backup.
    if let Ok(tool) = catalog::tool(&id) {
        running.cancel(&catalog::owner(tool).id);
    }
}

#[tauri::command]
pub async fn config_repair(id: String, profile: Option<String>) -> Result<config_repair::Repair, String> {
    blocking(move || config_repair::repair(catalog::tool(&id)?, profile.as_deref())).await?
}

// Async: finding a terminal waits a moment for each one tried, and macOS waits for its Automation answer.
#[tauri::command]
pub async fn open_setup(id: String, profile: Option<String>) -> Result<(), String> {
    blocking(move || {
        let tool = catalog::tool(&id)?;
        let args = tool.setup.as_ref().ok_or("this tool has no setup flow")?;
        let args = catalog::with_profile(args, profile.as_deref())?;
        let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
        terminal::open(&bin, &args)
    })
    .await?
}
