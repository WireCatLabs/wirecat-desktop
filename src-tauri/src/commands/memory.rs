use super::attempt;
use crate::error::AppError;
use crate::memory;

#[tauri::command]
pub async fn memory_read() -> Result<memory::Read, AppError> {
    crate::log::command("memory_read", async move { attempt(memory::read).await }).await
}

#[tauri::command]
pub async fn memory_sources(reference: String) -> Result<Vec<memory::Source>, AppError> {
    crate::log::command("memory_sources", async move { attempt(move || memory::sources(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_confirm(reference: String, accept: Option<Vec<String>>) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_confirm", async move {
        attempt(move || memory::confirm(&reference, accept.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn memory_discard(reference: String) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_discard", async move { attempt(move || memory::discard(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_correct(reference: String, text: String) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_correct", async move { attempt(move || memory::correct(&reference, &text)).await })
        .await
}

#[tauri::command]
pub async fn memory_forget(reference: String) -> Result<memory::Forgot, AppError> {
    crate::log::command("memory_forget", async move { attempt(move || memory::forget(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_source_context(reference: String) -> Result<memory::Context, AppError> {
    crate::log::command("memory_source_context", async move { attempt(move || memory::context(&reference)).await })
        .await
}

#[tauri::command]
pub async fn memory_open_source(reference: String) -> Result<(), AppError> {
    crate::log::command("memory_open_source", async move { attempt(move || memory::open_source(&reference)).await })
        .await
}
