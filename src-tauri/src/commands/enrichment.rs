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

/// memo's `consents set` without `--yes`: what turning it on sends and costs, changing nothing.
#[tauri::command]
pub async fn enrichment_preview(id: String) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_preview", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::preview(tool)).await
    })
    .await
}

/// Sent only from the consent step, after the owner pressed its button.
#[tauri::command]
pub async fn enrichment_on(id: String) -> Result<enrichment::EnrichmentStatus, AppError> {
    crate::log::command("enrichment_on", async move {
        let tool = known_tool(&id)?;
        attempt(move || enrichment::turn_on(tool)).await
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
