use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{mcp_server, public_address};

#[tauri::command]
pub async fn mcp_server_status(id: String) -> Result<mcp_server::ServerStatus, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::status(tool)).await
}

#[tauri::command]
pub async fn mcp_server_start(id: String, port: u16, url: String) -> Result<mcp_server::ServerStatus, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::start(tool, port, &url)).await
}

#[tauri::command]
pub async fn mcp_server_stop(id: String) -> Result<(), AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::stop(tool)).await
}

#[tauri::command]
pub async fn mcp_server_revoke(id: String) -> Result<(), AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::revoke(tool)).await
}

#[tauri::command]
pub async fn mcp_server_oauth(id: String) -> Result<mcp_server::OAuthSettings, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::oauth(tool)).await
}

#[tauri::command]
pub async fn mcp_server_public(id: String) -> Result<public_address::PublicCheck, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::public(tool)).await
}

#[tauri::command]
pub async fn mcp_server_config(id: String) -> Result<String, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || mcp_server::config(tool)).await
}
