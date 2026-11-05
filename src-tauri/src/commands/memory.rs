use super::attempt;
use crate::error::AppError;
use crate::memory;

#[tauri::command]
pub async fn memory_read() -> Result<memory::Read, AppError> {
    attempt(memory::read).await
}

#[tauri::command]
pub async fn memory_sources(reference: String) -> Result<Vec<memory::Source>, AppError> {
    attempt(move || memory::sources(&reference)).await
}

#[tauri::command]
pub async fn memory_confirm(reference: String, accept: Option<Vec<String>>) -> Result<memory::Entry, AppError> {
    attempt(move || memory::confirm(&reference, accept.as_deref())).await
}

#[tauri::command]
pub async fn memory_discard(reference: String) -> Result<memory::Entry, AppError> {
    attempt(move || memory::discard(&reference)).await
}

#[tauri::command]
pub async fn memory_correct(reference: String, text: String) -> Result<memory::Entry, AppError> {
    attempt(move || memory::correct(&reference, &text)).await
}

#[tauri::command]
pub async fn memory_forget(reference: String) -> Result<memory::Forgot, AppError> {
    attempt(move || memory::forget(&reference)).await
}

#[tauri::command]
pub async fn memory_source_context(reference: String) -> Result<memory::Context, AppError> {
    attempt(move || memory::context(&reference)).await
}

#[tauri::command]
pub async fn memory_open_source(reference: String) -> Result<(), AppError> {
    attempt(move || memory::open_source(&reference)).await
}
