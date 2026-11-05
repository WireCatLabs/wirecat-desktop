use super::{attempt, blocking};
use crate::error::AppError;
use crate::storage;

#[tauri::command]
pub async fn storage_report() -> Result<Vec<storage::Area>, AppError> {
    crate::log::command("storage_report", async move { blocking(storage::report).await }).await
}

#[tauri::command]
pub async fn clear_storage(id: String) -> Result<(), AppError> {
    crate::log::command("clear_storage", async move { attempt(move || storage::clear(&id)).await }).await
}

#[tauri::command]
pub async fn open_folder(id: String, kind: String, entry: Option<String>) -> Result<(), AppError> {
    crate::log::command(
        "open_folder",
        async move { attempt(move || storage::open(&id, &kind, entry.as_deref())).await },
    )
    .await
}
