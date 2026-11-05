use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{permissions, settings};

#[tauri::command]
pub async fn settings_show(id: String, profile: Option<String>) -> Result<settings::Settings, AppError> {
    crate::log::command("settings_show", async move {
        let tool = known_tool(&id)?;
        attempt(move || settings::show(tool, profile.as_deref())).await
    })
    .await
}

/// `profile: None` with `defaults` changes what every profile gets.
#[tauri::command]
pub async fn settings_set(
    id: String,
    profile: Option<String>,
    defaults: bool,
    setting: String,
    value: String,
) -> Result<(), AppError> {
    crate::log::command("settings_set", async move {
        let tool = known_tool(&id)?;
        attempt(move || settings::set(tool, profile.as_deref(), defaults, &setting, &value)).await
    })
    .await
}

#[tauri::command]
pub async fn settings_unset(
    id: String,
    profile: Option<String>,
    defaults: bool,
    setting: String,
) -> Result<(), AppError> {
    crate::log::command("settings_unset", async move {
        let tool = known_tool(&id)?;
        attempt(move || settings::unset(tool, profile.as_deref(), defaults, &setting)).await
    })
    .await
}

/// Saving goes through `settings_set` / `settings_unset` with a `permissions.<key>` setting.
#[tauri::command]
pub async fn permissions_show(id: String, profile: Option<String>) -> Result<permissions::Permissions, AppError> {
    crate::log::command("permissions_show", async move {
        let tool = known_tool(&id)?;
        attempt(move || permissions::show(tool, profile.as_deref())).await
    })
    .await
}
