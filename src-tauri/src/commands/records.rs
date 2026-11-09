use super::{attempt, blocking};
use crate::error::AppError;
use crate::{memory_add, records_import};
use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn records_types() -> Result<Value, AppError> {
    crate::log::command("records_types", async move { attempt(records_import::types).await }).await
}

/// Writes the template where the owner chose in the system's own window; None when they closed it.
#[tauri::command]
pub async fn records_template_save(
    app: AppHandle,
    kind: String,
    format: String,
    separator: String,
    account: Option<String>,
) -> Result<Option<String>, AppError> {
    crate::log::command("records_template_save", async move {
        let text = attempt({
            let (kind, format) = (kind.clone(), format.clone());
            move || records_import::template(&kind, &format, &separator, account.as_deref())
        })
        .await?;
        let name = format!("{kind}-template.{format}");
        let chosen = blocking(move || {
            app.dialog().file().set_file_name(&name).add_filter(format.to_uppercase(), &[&format]).blocking_save_file()
        })
        .await?;
        let Some(path) = chosen.and_then(|p| p.into_path().ok()) else { return Ok(None) };
        let shown = memory_add::picked_path(path.clone())?;
        attempt(move || std::fs::write(&path, text).map_err(|e| e.to_string())).await?;
        Ok(Some(shown))
    })
    .await
}

/// Opens the system's own file window. The path is kept here, and `records_run` takes no other file.
#[tauri::command]
pub async fn records_pick_file(
    app: AppHandle,
    kept: State<'_, records_import::PickedSheet>,
) -> Result<Option<String>, AppError> {
    crate::log::command("records_pick_file", async move {
        let picked = blocking(move || {
            app.dialog().file().add_filter("CSV, JSON", &["csv", "json", "jsonl", "ndjson"]).blocking_pick_file()
        })
        .await?;
        let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(None) };
        let shown = memory_add::picked_path(path.clone())?;
        *kept.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(path);
        Ok(Some(shown))
    })
    .await
}

#[tauri::command]
pub async fn records_run(
    kind: Option<String>,
    account: String,
    dry_run: bool,
    kept: State<'_, records_import::PickedSheet>,
) -> Result<records_import::Outcome, AppError> {
    let picked = kept.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    crate::log::command("records_run", async move {
        let file = picked.ok_or("Choose a file first")?;
        attempt(move || records_import::run(&file, kind.as_deref(), &account, dry_run)).await
    })
    .await
}
