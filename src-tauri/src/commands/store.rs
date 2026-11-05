use super::{attempt, blocking};
use crate::error::AppError;
use crate::install::Running;
use crate::{archive, backup, compat};
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn store_info() -> Result<Option<archive::StoreInfo>, AppError> {
    crate::log::command("store_info", async move { attempt(archive::info).await }).await
}

#[tauri::command]
pub async fn store_compat() -> Result<compat::StoreCompat, AppError> {
    crate::log::command("store_compat", async move { blocking(compat::compat).await }).await
}

#[tauri::command]
pub async fn store_tables(sizes: bool) -> Result<Option<archive::TableList>, AppError> {
    crate::log::command("store_tables", async move { attempt(move || archive::tables(sizes)).await }).await
}

#[tauri::command]
pub async fn store_check() -> Result<Option<archive::Check>, AppError> {
    crate::log::command("store_check", async move { attempt(archive::check).await }).await
}

#[tauri::command]
pub async fn store_backup(
    running: State<'_, Arc<Running>>,
    password: Option<String>,
    on_event: Channel<backup::BackupEvent>,
) -> Result<(), AppError> {
    crate::log::command("store_backup", async move {
        let running = Arc::clone(&running);
        let password = password.map(backup::Password::new);
        blocking(move || {
            let send = |e: backup::BackupEvent| {
                let _ = on_event.send(e);
            };
            if !running.start_unless(backup::BACKUP, |k| k == backup::RESET) {
                return send(backup::BackupEvent::Failed { message: "A backup or a clear is already running.".into() });
            }
            backup::backup(password.as_ref(), &|| !running.is_running(backup::BACKUP), &send);
            running.finish(backup::BACKUP);
        })
        .await
    })
    .await
}

#[tauri::command]
pub fn cancel_store_backup(running: State<'_, Arc<Running>>) {
    crate::log::command_now("cancel_store_backup", || {
        running.cancel(backup::BACKUP);
    });
}

#[tauri::command]
pub async fn list_backups() -> Result<backup::Backups, AppError> {
    crate::log::command("list_backups", async move { attempt(backup::list).await }).await
}

#[tauri::command]
pub async fn open_backups(name: Option<String>) -> Result<(), AppError> {
    crate::log::command("open_backups", async move { attempt(move || backup::open(name.as_deref())).await }).await
}

#[tauri::command]
pub async fn store_reset_preview() -> Result<Option<backup::ResetPreview>, AppError> {
    crate::log::command("store_reset_preview", async move { attempt(backup::reset_preview).await }).await
}

#[tauri::command]
pub async fn store_reset(running: State<'_, Arc<Running>>) -> Result<Option<u64>, AppError> {
    crate::log::command("store_reset", async move {
        let running = Arc::clone(&running);
        attempt(move || {
            if !running.start_unless(backup::RESET, |k| k == backup::BACKUP) {
                return Err(AppError::Busy("A backup or a clear is already running.".into()));
            }
            let done = backup::reset();
            running.finish(backup::RESET);
            Ok(done?)
        })
        .await
    })
    .await
}
