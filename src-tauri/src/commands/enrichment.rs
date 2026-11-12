use super::{attempt, known_tool};
use crate::enrichment;
use crate::error::AppError;

#[tauri::command]
pub async fn enrichment_status(id: String) -> Result<enrichment::Enrichment, AppError> {
    crate::log::command("enrichment_status", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::status(tool)).await
    })
    .await
}

/// memo's `consents set` without `--yes`: what turning it on sends and costs, changing nothing. Without an address
/// the pair must be one memo's `show` offers.
#[tauri::command]
pub async fn enrichment_preview(
    id: String,
    choice: enrichment::EnrichmentChoice,
) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_preview", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::preview(tool, &choice)).await
    })
    .await
}

/// Sent only from the consent step, after the owner pressed its button.
#[tauri::command]
pub async fn enrichment_on(
    id: String,
    choice: enrichment::EnrichmentChoice,
) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_on", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::turn_on(tool, &choice)).await
    })
    .await
}

#[tauri::command]
pub async fn enrichment_off(id: String) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_off", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::turn_off(tool)).await
    })
    .await
}

/// The key travels from the window to memo's stdin and nowhere else: not an argument, not a log line (the command
/// log names only the command), not an error message.
#[tauri::command]
pub async fn enrichment_key_set(
    id: String,
    provider: String,
    key: String,
) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_key_set", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::set_key(tool, &provider, &key)).await
    })
    .await
}

#[tauri::command]
pub async fn enrichment_key_remove(id: String, provider: String) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_key_remove", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::remove_key(tool, &provider)).await
    })
    .await
}
