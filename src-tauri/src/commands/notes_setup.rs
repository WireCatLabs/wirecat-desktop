use super::{attempt, blocking, known_tool};
use crate::error::AppError;
use crate::install::Running;
use crate::{catalog, notes_setup, sync};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn notes_setup_status(id: String) -> Result<notes_setup::NotesSetup, AppError> {
    crate::log::command("notes_setup_status", async move {
        let tool = known_tool(&id)?;
        attempt(move || notes_setup::status(tool)).await
    })
    .await
}

/// Opens the system's own folder window. The path it returns is the only one the interface later sends back to
/// `notes_folder_add`, which checks it again. `None` when the owner closes the window.
#[tauri::command]
pub async fn notes_pick_folder(app: AppHandle) -> Result<Option<String>, AppError> {
    crate::log::command("notes_pick_folder", async move {
        let picked = blocking(move || app.dialog().file().blocking_pick_folder()).await?;
        Ok(picked.and_then(|p| p.into_path().ok()).and_then(|p| p.to_str().map(str::to_string)))
    })
    .await
}

#[tauri::command]
pub async fn notes_folder_add(id: String, path: String) -> Result<notes_setup::NotesFolderAdded, AppError> {
    crate::log::command("notes_folder_add", async move {
        let tool = known_tool(&id)?;
        attempt(move || notes_setup::add_folder(tool, &path)).await
    })
    .await
}

/// memo's `folders remove <id>`; with `delete_notes` it also deletes that folder's notes from memo's store, which the
/// interface asks only behind a dialog that says so. The id is checked in `notes_setup` before memo sees it.
#[tauri::command]
pub async fn notes_folder_remove(
    id: String,
    folder: String,
    delete_notes: bool,
) -> Result<notes_setup::NotesFolderRemoved, AppError> {
    crate::log::command("notes_folder_remove", async move {
        let tool = known_tool(&id)?;
        attempt(move || notes_setup::remove_folder(tool, &folder, delete_notes)).await
    })
    .await
}

/// memo's `sync --only notes`. It shares memo's one sync key, so the Tools page's Sync and `sync_stop` see it too.
#[tauri::command]
pub async fn notes_sync(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<sync::SyncEvent>,
) -> Result<(), AppError> {
    crate::log::command("notes_sync", async move {
        let tool = known_tool(&id)?;
        let args = notes_setup::sync_args(tool).map_err(AppError::Failed)?;
        let running = Arc::clone(&running);
        blocking(move || sync::run_guarded(tool, None, &args, &running, &on_event)).await
    })
    .await
}

#[tauri::command]
pub async fn notes_model_download(
    id: String,
    model: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<notes_setup::NotesModelEvent>,
) -> Result<(), AppError> {
    crate::log::command("notes_model_download", async move {
        let tool = known_tool(&id)?;
        let args = notes_setup::download_args(tool, &model).map_err(AppError::Failed)?;
        let running = Arc::clone(&running);
        blocking(move || {
            let key = model_key(tool);
            if running.busy(&catalog::owner(tool).id) || !running.start(&key) {
                let _ =
                    on_event.send(notes_setup::NotesModelEvent::Failed { problem: notes_setup::NotesProblem::Busy });
                return;
            }
            notes_setup::download(tool, &args, &|| !running.is_running(&key), &|e| {
                let _ = on_event.send(e);
            });
            running.finish(&key);
        })
        .await
    })
    .await
}

/// memo's `models set` for a model the card shows; Rust checks the id against memo's own list first.
#[tauri::command]
pub async fn notes_model_use(id: String, model: String) -> Result<notes_setup::NotesModelUsed, AppError> {
    crate::log::command("notes_model_use", async move {
        let tool = known_tool(&id)?;
        attempt(move || notes_setup::use_model(tool, &model)).await
    })
    .await
}

#[tauri::command]
pub fn notes_model_stop(id: String, running: State<'_, Arc<Running>>) -> Result<(), AppError> {
    crate::log::command_now("notes_model_stop", || {
        running.cancel(&model_key(known_tool(&id)?));
        Ok(())
    })
}

/// One download per package at a time.
fn model_key(tool: &'static catalog::Tool) -> String {
    format!("model:{}", catalog::owner(tool).id)
}
