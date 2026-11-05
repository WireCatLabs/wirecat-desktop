use super::{attempt, blocking, known_tool, valid_profile};
use crate::error::AppError;
use crate::install::InstallEvent;
use crate::install::Running;
use crate::{background, catalog, compat, config_repair, install, terminal, tools};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn detect_tools(fresh: bool) -> Result<Vec<tools::ToolState>, AppError> {
    crate::log::command("detect_tools", async move { blocking(move || tools::detect_all(fresh)).await }).await
}

#[tauri::command]
pub async fn latest_versions(fresh: bool) -> Result<HashMap<String, Option<String>>, AppError> {
    crate::log::command("latest_versions", async move {
        blocking(move || tools::latest_versions(fresh).into_iter().collect()).await
    })
    .await
}

#[tauri::command]
pub async fn list_profiles(id: String) -> Result<Option<Vec<tools::Profile>>, AppError> {
    crate::log::command("list_profiles", async move {
        let tool = known_tool(&id)?;
        attempt(move || tools::profiles(tool)).await
    })
    .await
}

#[tauri::command]
pub async fn diagnose(id: String, profile: Option<String>) -> Result<tools::Diagnosis, AppError> {
    crate::log::command("diagnose", async move {
        let tool = known_tool(&id)?;
        attempt(move || tools::diagnose(tool, profile.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn install_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), AppError> {
    crate::log::command("install_tool", async move {
        let tool = catalog::owner(known_tool(&id)?);
        let running = Arc::clone(&running);
        let done = blocking(move || install::install(tool, &running, &on_event)).await;
        compat::forget();
        done
    })
    .await
}

#[tauri::command]
pub async fn uninstall_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), AppError> {
    crate::log::command("uninstall_tool", async move {
        let tool = catalog::owner(known_tool(&id)?);
        let running = Arc::clone(&running);
        let done = blocking(move || install::uninstall(tool, &running, &on_event)).await;
        compat::forget();
        done
    })
    .await
}

/// One unused copy of a tool, named by the path the interface was given; see `install::remove_copy`.
#[tauri::command]
pub async fn remove_copy(
    id: String,
    path: String,
    running: State<'_, Arc<Running>>,
) -> Result<install::CopyRemoval, AppError> {
    crate::log::command("remove_copy", async move {
        let tool = catalog::owner(known_tool(&id)?);
        let running = Arc::clone(&running);
        let done = blocking(move || install::remove_copy(tool, &path, &running)).await;
        compat::forget();
        done
    })
    .await
}

#[tauri::command]
pub async fn background_status(id: String, profile: String) -> Result<background::Background, AppError> {
    crate::log::command("background_status", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || background::status(tool, &profile)).await
    })
    .await
}

#[tauri::command]
pub async fn background_keep(id: String, profile: String) -> Result<background::Background, AppError> {
    crate::log::command("background_keep", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || background::keep(tool, &profile)).await
    })
    .await
}

#[tauri::command]
pub fn cancel_install(id: String, running: State<'_, Arc<Running>>) {
    crate::log::command_now("cancel_install", || {
        // Only an install's own key: any other string would stop whatever runs under it, a sync or a backup.
        if let Ok(tool) = catalog::tool(&id) {
            running.cancel(&catalog::owner(tool).id);
        }
    });
}

#[tauri::command]
pub async fn config_repair(id: String, profile: Option<String>) -> Result<config_repair::Repair, AppError> {
    crate::log::command("config_repair", async move {
        let tool = known_tool(&id)?;
        attempt(move || config_repair::repair(tool, profile.as_deref())).await
    })
    .await
}

// Async: finding a terminal waits a moment for each one tried, and macOS waits for its Automation answer.
#[tauri::command]
pub async fn open_setup(id: String, profile: Option<String>) -> Result<(), AppError> {
    crate::log::command("open_setup", async move {
        let tool = known_tool(&id)?;
        attempt(move || {
            let args = tool.setup.as_ref().ok_or("this tool has no setup flow")?;
            let args = catalog::with_profile(args, profile.as_deref())?;
            let bin = crate::tools::program(&tool.bin)
                .ok_or_else(|| AppError::NotInstalled("the tool is not installed".into()))?;
            Ok::<_, AppError>(terminal::open(&bin, &args)?)
        })
        .await
    })
    .await
}
