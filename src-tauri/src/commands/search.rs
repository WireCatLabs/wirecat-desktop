use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{analytics, query_writer, runs, search};

#[tauri::command]
pub async fn list_runs(
    id: String,
    query: Option<String>,
    limit: u32,
    page: u32,
) -> Result<serde_json::Value, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || runs::list(tool, query.as_deref(), limit, page)).await
}

#[tauri::command]
pub async fn search_store(
    id: String,
    profile: Option<String>,
    query: String,
    limit: u32,
    page: u32,
) -> Result<search::Answer, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || search::search(tool, profile.as_deref(), &query, limit, page)).await
}

#[tauri::command]
pub async fn message_stats(
    id: String,
    profile: String,
    ask: analytics::Ask,
    timezone: String,
) -> Result<analytics::Counts, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || analytics::messages(tool, &profile, ask, &timezone)).await
}

#[tauri::command]
pub async fn analytics_aggregate(
    id: String,
    which: String,
    profile: Option<String>,
    period: analytics::Period,
    timezone: String,
) -> Result<analytics::Aggregate, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || analytics::aggregate(tool, &which, profile.as_deref(), period, &timezone)).await
}

#[tauri::command]
pub async fn search_context(
    id: String,
    profile: Option<String>,
    reference: String,
) -> Result<search::Context, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || search::context(tool, profile.as_deref(), &reference)).await
}

#[tauri::command]
pub async fn search_draft(id: String, request: String) -> Result<query_writer::Draft, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || query_writer::write(tool, &request)).await
}

#[tauri::command]
pub async fn search_values(
    id: String,
    profile: Option<String>,
    source: String,
) -> Result<Vec<search::ValueItem>, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || search::values(tool, profile.as_deref(), &source)).await
}

#[tauri::command]
pub async fn show_run(id: String, run: String) -> Result<serde_json::Value, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || runs::show(tool, &run)).await
}
