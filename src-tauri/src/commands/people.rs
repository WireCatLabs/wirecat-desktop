use super::attempt;
use crate::error::AppError;
use crate::people;

#[tauri::command]
pub async fn people_read() -> Result<people::Read, AppError> {
    crate::log::command("people_read", async move { attempt(people::read).await }).await
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
