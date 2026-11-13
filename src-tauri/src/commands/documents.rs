use super::attempt;
use crate::documents;
use crate::error::AppError;

/// The page's first read: memo's accounts and folders holding documents, or why memo cannot list them.
#[tauri::command]
pub async fn documents_read() -> Result<documents::DocumentsRead, AppError> {
    crate::log::command("documents_read", async move { attempt(documents::read).await }).await
}

/// One page of documents; `query` is memo's own search words (`kind:pdf folder:"Projects"`).
#[tauri::command]
pub async fn documents_list(query: String, page: u32, limit: u32) -> Result<documents::DocumentPage, AppError> {
    crate::log::command("documents_list", async move { attempt(move || documents::list(&query, page, limit)).await })
        .await
}

/// One document with a part of its text from `cursor` (a character offset).
#[tauri::command]
pub async fn documents_show(reference: String, cursor: u64) -> Result<documents::DocumentDetails, AppError> {
    crate::log::command("documents_show", async move { attempt(move || documents::show(&reference, cursor)).await })
        .await
}

/// The document's file on this computer, shown in its folder.
#[tauri::command]
pub async fn documents_reveal(reference: String) -> Result<(), AppError> {
    crate::log::command("documents_reveal", async move { attempt(move || documents::reveal(&reference)).await }).await
}
