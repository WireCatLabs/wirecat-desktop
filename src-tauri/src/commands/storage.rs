use super::blocking;
use crate::storage;

#[tauri::command]
pub async fn storage_report() -> Result<Vec<storage::Area>, String> {
    blocking(storage::report).await
}

#[tauri::command]
pub async fn clear_storage(id: String) -> Result<(), String> {
    blocking(move || storage::clear(&id)).await?
}

#[tauri::command]
pub async fn open_folder(id: String, kind: String, entry: Option<String>) -> Result<(), String> {
    blocking(move || storage::open(&id, &kind, entry.as_deref())).await?
}
