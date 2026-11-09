use super::attempt;
use crate::error::AppError;
use crate::people;

/// `kind` is one of memo's kinds of people (`person` when absent); an older memo lists everyone.
#[tauri::command]
pub async fn people_read(kind: Option<String>) -> Result<people::Read, AppError> {
    crate::log::command("people_read", async move {
        attempt(move || people::read(kind.as_deref().unwrap_or("person"))).await
    })
    .await
}

#[tauri::command]
pub async fn people_kinds() -> Result<std::collections::BTreeMap<String, people::KindCount>, AppError> {
    crate::log::command("people_kinds", async move { attempt(people::kinds).await }).await
}

#[tauri::command]
pub async fn people_show(reference: String) -> Result<people::Person, AppError> {
    crate::log::command("people_show", async move { attempt(move || people::show(&reference)).await }).await
}

#[tauri::command]
pub async fn people_decide(
    reference: String,
    id: String,
    answer: people::Answer,
    reason: Option<String>,
) -> Result<people::Person, AppError> {
    crate::log::command("people_decide", async move {
        attempt(move || people::decide(&reference, &id, answer, reason.as_deref())).await
    })
    .await
}

/// Joins the people the owner chose from one group of matches into one person.
#[tauri::command]
pub async fn people_merge(references: Vec<String>) -> Result<people::Merged, AppError> {
    crate::log::command("people_merge", async move { attempt(move || people::join_group(&references)).await }).await
}

#[tauri::command]
pub async fn people_unlink(reference: String, identities: Vec<String>) -> Result<people::Unlinked, AppError> {
    crate::log::command("people_unlink", async move { attempt(move || people::unlink(&reference, &identities)).await })
        .await
}

#[tauri::command]
pub async fn people_unmerge(reference: String, merge: String) -> Result<people::Person, AppError> {
    crate::log::command("people_unmerge", async move { attempt(move || people::unmerge(&reference, &merge)).await })
        .await
}

/// The person who has exactly this account, for the page's search; `None` when no one does.
#[tauri::command]
pub async fn people_find(account: String) -> Result<Option<people::Person>, AppError> {
    crate::log::command("people_find", async move { attempt(move || people::find(&account)).await }).await
}
