use super::blocking;
use crate::{catalog, mcp_server, public_address};

#[tauri::command]
pub async fn mcp_server_status(id: String) -> Result<mcp_server::ServerStatus, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::status(tool)).await?
}

#[tauri::command]
pub async fn mcp_server_start(id: String, port: u16, url: String) -> Result<mcp_server::ServerStatus, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::start(tool, port, &url)).await?
}

#[tauri::command]
pub async fn mcp_server_stop(id: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::stop(tool)).await?
}

#[tauri::command]
pub async fn mcp_server_revoke(id: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::revoke(tool)).await?
}

#[tauri::command]
pub async fn mcp_server_oauth(id: String) -> Result<mcp_server::OAuthSettings, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::oauth(tool)).await?
}

#[tauri::command]
pub async fn mcp_server_public(id: String) -> Result<public_address::PublicCheck, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::public(tool)).await?
}

#[tauri::command]
pub async fn mcp_server_config(id: String) -> Result<String, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::config(tool)).await?
}
