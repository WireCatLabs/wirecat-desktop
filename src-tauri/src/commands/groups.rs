use super::attempt;
use crate::error::AppError;
use crate::groups;

#[tauri::command]
pub async fn groups_read() -> Result<groups::Read, AppError> {
    crate::log::command("groups_read", async move { attempt(groups::read).await }).await
}

#[tauri::command]
pub async fn groups_add(group: String, source: String) -> Result<groups::Read, AppError> {
    crate::log::command("groups_add", async move { attempt(move || groups::add(&group, &source)).await }).await
}

#[tauri::command]
pub async fn groups_remove(group: String, source: String) -> Result<groups::Read, AppError> {
    crate::log::command("groups_remove", async move { attempt(move || groups::remove(&group, &source)).await }).await
}

#[tauri::command]
pub async fn groups_move(source: String, from: String, to: String) -> Result<groups::Read, AppError> {
    crate::log::command("groups_move", async move { attempt(move || groups::move_member(&source, &from, &to)).await })
        .await
}

#[tauri::command]
pub async fn groups_scope(source: String, scope: String) -> Result<groups::Read, AppError> {
    crate::log::command("groups_scope", async move { attempt(move || groups::set_scope(&source, &scope)).await }).await
}
