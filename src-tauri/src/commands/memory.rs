use super::{attempt, blocking};
use crate::error::AppError;
use crate::{memory, memory_add, memory_edit, memory_preview, memory_review};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

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
pub async fn memory_correct(
    reference: String,
    text: String,
    change: Option<memory::Change>,
) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_correct", async move {
        attempt(move || memory::correct(&reference, &text, &change.unwrap_or_default())).await
    })
    .await
}

#[tauri::command]
pub async fn memory_relation_edit(
    reference: String,
    role: Option<String>,
) -> Result<memory_edit::RelationEdited, AppError> {
    crate::log::command("memory_relation_edit", async move {
        attempt(move || memory_edit::edit(&reference, role.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn memory_relation_remove(reference: String) -> Result<(), AppError> {
    crate::log::command("memory_relation_remove", async move { attempt(move || memory_edit::remove(&reference)).await })
        .await
}

#[tauri::command]
pub async fn memory_relations_decide(
    references: Vec<String>,
    approve: bool,
) -> Result<Vec<memory_edit::Decided>, AppError> {
    crate::log::command("memory_relations_decide", async move {
        attempt(move || memory_edit::decide(&references, approve)).await
    })
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

#[tauri::command]
pub async fn conversation_read(
    place: crate::conversation::ChatPlace,
    ask: crate::conversation::ChatPage,
) -> Result<crate::conversation::Conversation, AppError> {
    crate::log::command(
        "conversation_read",
        async move { attempt(move || crate::conversation::read(&place, &ask)).await },
    )
    .await
}

#[tauri::command]
pub async fn memory_review_show(reference: String, id: String) -> Result<memory_review::Review, AppError> {
    crate::log::command(
        "memory_review_show",
        async move { attempt(move || memory_review::show(&reference, &id)).await },
    )
    .await
}

#[tauri::command]
pub async fn memory_review_decide(
    reference: String,
    id: String,
    answer: memory_review::Answer,
    reason: Option<String>,
) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_review_decide", async move {
        attempt(move || memory_review::decide(&reference, &id, answer, reason.as_deref())).await
    })
    .await
}

/// Opens the system's own file window. The path is kept here, and `memory_source_add` takes no other file.
#[tauri::command]
pub async fn memory_pick_file(
    app: AppHandle,
    kept: State<'_, memory_add::PickedFile>,
) -> Result<Option<String>, AppError> {
    crate::log::command("memory_pick_file", async move {
        let picked = blocking(move || app.dialog().file().blocking_pick_file()).await?;
        let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(None) };
        let shown = memory_add::picked_path(path.clone())?;
        *kept.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(path);
        Ok(Some(shown))
    })
    .await
}

#[tauri::command]
pub async fn memory_source_add(
    source: memory_add::AddSource,
    kept: State<'_, memory_add::PickedFile>,
) -> Result<memory_add::Added, AppError> {
    let picked = kept.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    crate::log::command("memory_source_add", async move {
        attempt(move || memory_add::add(&source, picked.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn memory_show(reference: String) -> Result<memory::Entry, AppError> {
    crate::log::command("memory_show", async move { attempt(move || memory::show(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_source_show(reference: String) -> Result<memory_add::Shown, AppError> {
    crate::log::command("memory_source_show", async move { attempt(move || memory_add::show(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_mentions(reference: String) -> Result<memory_add::Mentions, AppError> {
    crate::log::command("memory_mentions", async move { attempt(move || memory_add::mentions(&reference)).await }).await
}

#[tauri::command]
pub async fn memory_source_suggest(
    reference: String,
    reader: String,
    subjects: Vec<String>,
    again: bool,
) -> Result<memory_add::Suggested, AppError> {
    crate::log::command("memory_source_suggest", async move {
        attempt(move || memory_add::suggest(&reference, &reader, &subjects, again)).await
    })
    .await
}

#[tauri::command]
pub async fn memory_readers() -> Result<Vec<memory_add::Reader>, AppError> {
    crate::log::command("memory_readers", async move { attempt(memory_add::readers).await }).await
}

#[tauri::command]
pub async fn memory_reader_choose(id: String) -> Result<Vec<memory_add::Reader>, AppError> {
    crate::log::command("memory_reader_choose", async move { attempt(move || memory_add::choose(&id)).await }).await
}

/// The key arrives from the Settings field and leaves only on memo's stdin; it is never answered back or logged.
#[tauri::command]
pub async fn memory_reader_key(provider: String, key: String) -> Result<memory_add::KeySaved, AppError> {
    crate::log::command("memory_reader_key", async move { attempt(move || memory_add::set_key(&provider, &key)).await })
        .await
}

/// Only the file chosen in the system's file window is read, as `memory_source_add` does.
#[tauri::command]
pub async fn memory_file_preview(
    kept: State<'_, memory_add::PickedFile>,
) -> Result<Option<memory_preview::FilePreview>, AppError> {
    let picked = kept.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    crate::log::command("memory_file_preview", async move {
        let Some(path) = picked else { return Ok(None) };
        attempt(move || memory_preview::file(&path).map(Some)).await
    })
    .await
}

#[tauri::command]
pub async fn memory_link_preview(url: String) -> Result<Option<memory_preview::LinkPreview>, AppError> {
    crate::log::command("memory_link_preview", async move { attempt(move || memory_preview::link(&url)).await }).await
}
