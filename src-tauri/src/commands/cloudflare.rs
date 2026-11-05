use super::blocking;
use crate::cloudflare;
use crate::install::Running;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn cloudflare_status() -> Result<cloudflare::Status, String> {
    blocking(cloudflare::status).await
}

/// Downloads cloudflared's own release into the app's folder; its version comes back.
#[tauri::command]
pub async fn cloudflare_install(running: State<'_, Arc<Running>>) -> Result<String, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(cloudflare::INSTALL) {
            return Err("The download is already running.".to_string());
        }
        let result = cloudflare::install(&|| !running.is_running(cloudflare::INSTALL));
        running.finish(cloudflare::INSTALL);
        result
    })
    .await?
}

#[tauri::command]
pub async fn cloudflare_login(
    running: State<'_, Arc<Running>>,
    on_event: Channel<cloudflare::PageEvent>,
) -> Result<(), String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(cloudflare::LOGIN) {
            return Err("The Cloudflare login is already running.".to_string());
        }
        let result = cloudflare::login(&|| !running.is_running(cloudflare::LOGIN), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(cloudflare::LOGIN);
        result
    })
    .await?
}

/// Stops a waiting login or download; whatever the person already did in the browser stays done.
#[tauri::command]
pub fn cloudflare_stop(running: State<'_, Arc<Running>>) {
    running.cancel(cloudflare::LOGIN);
    running.cancel(cloudflare::INSTALL);
}

#[tauri::command]
pub async fn cloudflare_create(hostname: String) -> Result<String, String> {
    blocking(move || cloudflare::create(&hostname)).await?
}

#[tauri::command]
pub async fn cloudflare_tunnel_open(id: String, port: u16) -> Result<String, String> {
    blocking(move || cloudflare::open(&id, port)).await?
}

#[tauri::command]
pub async fn cloudflare_tunnel_close(id: String) -> Result<(), String> {
    blocking(move || cloudflare::close(&id)).await?
}

#[tauri::command]
pub async fn cloudflare_routes() -> Result<Vec<cloudflare::RouteState>, String> {
    blocking(cloudflare::routes).await
}
