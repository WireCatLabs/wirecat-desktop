use super::blocking;
use crate::install::Running;
use crate::{archive, backup, compat};
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn store_info() -> Result<Option<archive::StoreInfo>, String> {
    blocking(archive::info).await?
}

#[tauri::command]
pub async fn store_compat() -> Result<compat::StoreCompat, String> {
    blocking(compat::compat).await
}

#[tauri::command]
pub async fn store_tables(sizes: bool) -> Result<Option<archive::TableList>, String> {
    blocking(move || archive::tables(sizes)).await?
}

#[tauri::command]
pub async fn store_check() -> Result<Option<archive::Check>, String> {
    blocking(archive::check).await?
}

#[tauri::command]
pub async fn store_backup(
    running: State<'_, Arc<Running>>,
    password: Option<String>,
    on_event: Channel<backup::BackupEvent>,
) -> Result<(), String> {
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
}

#[tauri::command]
pub fn cancel_store_backup(running: State<'_, Arc<Running>>) {
    running.cancel(backup::BACKUP);
}

#[tauri::command]
pub async fn list_backups() -> Result<backup::Backups, String> {
    blocking(backup::list).await?
}

#[tauri::command]
pub async fn open_backups(name: Option<String>) -> Result<(), String> {
    blocking(move || backup::open(name.as_deref())).await?
}

#[tauri::command]
pub async fn store_reset_preview() -> Result<Option<backup::ResetPreview>, String> {
    blocking(backup::reset_preview).await?
}

#[tauri::command]
pub async fn store_reset(running: State<'_, Arc<Running>>) -> Result<Option<u64>, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start_unless(backup::RESET, |k| k == backup::BACKUP) {
            return Err("A backup or a clear is already running.".to_string());
        }
        let done = backup::reset();
        running.finish(backup::RESET);
        done
    })
    .await?
}
