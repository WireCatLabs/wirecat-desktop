use super::blocking;
use crate::{catalog, permissions, settings};

#[tauri::command]
pub async fn settings_show(id: String, profile: Option<String>) -> Result<settings::Settings, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::show(tool, profile.as_deref())).await?
}

/// `profile: None` with `defaults` changes what every profile gets.
#[tauri::command]
pub async fn settings_set(
    id: String,
    profile: Option<String>,
    defaults: bool,
    setting: String,
    value: String,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::set(tool, profile.as_deref(), defaults, &setting, &value)).await?
}

#[tauri::command]
pub async fn settings_unset(
    id: String,
    profile: Option<String>,
    defaults: bool,
    setting: String,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::unset(tool, profile.as_deref(), defaults, &setting)).await?
}

/// Saving goes through `settings_set` / `settings_unset` with a `permissions.<key>` setting.
#[tauri::command]
pub async fn permissions_show(id: String, profile: Option<String>) -> Result<permissions::Permissions, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || permissions::show(tool, profile.as_deref())).await?
}
