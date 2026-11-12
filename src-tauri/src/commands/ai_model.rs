use super::attempt;
use crate::ai_model;
use crate::error::AppError;

#[tauri::command]
pub async fn ai_model_show() -> Result<ai_model::AiModel, AppError> {
    crate::log::command("ai_model_show", async move { attempt(ai_model::show).await }).await
}

/// The key arrives from the Settings field and leaves only on memo's stdin; it is never answered back or logged.
#[tauri::command]
pub async fn ai_model_set(choice: ai_model::SetModel) -> Result<ai_model::AiModel, AppError> {
    crate::log::command("ai_model_set", async move { attempt(move || ai_model::set(&choice)).await }).await
}

#[tauri::command]
pub async fn ai_model_off() -> Result<ai_model::AiOff, AppError> {
    crate::log::command("ai_model_off", async move { attempt(ai_model::off).await }).await
}

#[tauri::command]
pub async fn ai_model_check() -> Result<ai_model::AiChecked, AppError> {
    crate::log::command("ai_model_check", async move { attempt(ai_model::check).await }).await
}

#[tauri::command]
pub async fn ai_model_list(source: String) -> Result<Vec<String>, AppError> {
    crate::log::command("ai_model_list", async move { attempt(move || ai_model::list(&source)).await }).await
}

#[tauri::command]
pub async fn local_only_status() -> Result<crate::local_only::LocalOnly, AppError> {
    crate::log::command("local_only_status", async move { attempt(crate::local_only::status).await }).await
}

/// Sent only from the Settings switch the owner moved; memo answers with the whole new state.
#[tauri::command]
pub async fn local_only_set(on: bool) -> Result<crate::local_only::LocalOnlyStatus, AppError> {
    crate::log::command("local_only_set", async move { attempt(move || crate::local_only::set(on)).await }).await
}

#[tauri::command]
pub async fn picture_reading_status() -> Result<crate::picture_reading::PictureReading, AppError> {
    crate::log::command("picture_reading_status", async move { attempt(crate::picture_reading::status).await }).await
}

/// Sent only from Settings, where the owner chose; memo answers with the whole new setting.
#[tauri::command]
pub async fn picture_reading_set(
    mode: String,
    agent: Option<String>,
    model: Option<String>,
) -> Result<crate::picture_reading::PictureReadingSetting, AppError> {
    crate::log::command("picture_reading_set", async move {
        attempt(move || crate::picture_reading::set(&mode, agent.as_deref(), model.as_deref())).await
    })
    .await
}
