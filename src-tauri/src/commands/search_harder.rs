use super::{attempt, known_tool};
use crate::error::AppError;
use crate::search_harder::{self, HarderChoice, HarderStatus};

#[tauri::command]
pub async fn search_harder_status(id: String) -> Result<search_harder::SearchHarder, AppError> {
    crate::log::command("search_harder_status", async move {
        let tool = known_tool(&id)?;
        attempt(move || search_harder::status(tool)).await
    })
    .await
}

/// memo's `search-consents set` without `--yes`: where a search would go and what it sends, changing nothing.
#[tauri::command]
pub async fn search_harder_preview(id: String, choice: HarderChoice) -> Result<HarderStatus, AppError> {
    crate::log::command("search_harder_preview", async move {
        let tool = known_tool(&id)?;
        attempt(move || search_harder::preview(tool, &choice)).await
    })
    .await
}

/// Sent only from the consent step, after the owner pressed its button.
#[tauri::command]
pub async fn search_harder_on(id: String, choice: HarderChoice) -> Result<HarderStatus, AppError> {
    crate::log::command("search_harder_on", async move {
        let tool = known_tool(&id)?;
        attempt(move || search_harder::turn_on(tool, &choice)).await
    })
    .await
}

#[tauri::command]
pub async fn search_harder_off(id: String) -> Result<HarderStatus, AppError> {
    crate::log::command("search_harder_off", async move {
        let tool = known_tool(&id)?;
        attempt(move || search_harder::turn_off(tool)).await
    })
    .await
}

/// One search the owner asked to search harder; the query is never logged.
#[tauri::command]
pub async fn search_harder_run(id: String, query: String, limit: u32) -> Result<search_harder::HarderAnswer, AppError> {
    crate::log::command("search_harder_run", async move {
        let tool = known_tool(&id)?;
        attempt(move || search_harder::run(tool, &query, limit)).await
    })
    .await
}
