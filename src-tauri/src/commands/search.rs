use super::blocking;
use crate::{analytics, catalog, query_writer, runs, search};

#[tauri::command]
pub async fn list_runs(id: String, query: Option<String>, limit: u32, page: u32) -> Result<serde_json::Value, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || runs::list(tool, query.as_deref(), limit, page)).await?
}

#[tauri::command]
pub async fn search_store(
    id: String,
    profile: Option<String>,
    query: String,
    limit: u32,
    page: u32,
) -> Result<search::Answer, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || search::search(tool, profile.as_deref(), &query, limit, page)).await?
}

#[tauri::command]
pub async fn message_stats(
    id: String,
    profile: String,
    ask: analytics::Ask,
    timezone: String,
) -> Result<analytics::Counts, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || analytics::messages(tool, &profile, ask, &timezone)).await?
}

#[tauri::command]
pub async fn analytics_aggregate(
    id: String,
    which: String,
    profile: Option<String>,
    period: analytics::Period,
    timezone: String,
) -> Result<analytics::Aggregate, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || analytics::aggregate(tool, &which, profile.as_deref(), period, &timezone)).await?
}

#[tauri::command]
pub async fn search_context(id: String, profile: Option<String>, reference: String) -> Result<search::Context, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || search::context(tool, profile.as_deref(), &reference)).await?
}

#[tauri::command]
pub async fn search_draft(id: String, request: String) -> Result<query_writer::Draft, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || query_writer::write(tool, &request)).await?
}

#[tauri::command]
pub async fn search_values(
    id: String,
    profile: Option<String>,
    source: String,
) -> Result<Vec<search::ValueItem>, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || search::values(tool, profile.as_deref(), &source)).await?
}

#[tauri::command]
pub async fn show_run(id: String, run: String) -> Result<serde_json::Value, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || runs::show(tool, &run)).await?
}
