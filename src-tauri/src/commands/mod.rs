pub mod agents;
pub mod app;
pub mod cloudflare;
pub mod community;
pub mod mcp_server;
pub mod memory;
pub mod node;
pub mod search;
pub mod settings;
pub mod signin;
pub mod storage;
pub mod store;
pub mod sync;
pub mod tailscale;
pub mod tasks;
pub mod tools;

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}
