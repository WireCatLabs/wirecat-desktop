use super::{attempt, blocking};
use crate::cloudflare;
use crate::error::AppError;
use crate::install::Running;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn cloudflare_status() -> Result<cloudflare::Status, AppError> {
    crate::log::command("cloudflare_status", async move { blocking(cloudflare::status).await }).await
}

/// Downloads cloudflared's own release into the app's folder; its version comes back.
#[tauri::command]
pub async fn cloudflare_install(running: State<'_, Arc<Running>>) -> Result<String, AppError> {
    crate::log::command("cloudflare_install", async move {
        let running = Arc::clone(&running);
        attempt(move || {
            if !running.start(cloudflare::INSTALL) {
                return Err(AppError::Busy("The download is already running.".into()));
            }
            let result = cloudflare::install(&|| !running.is_running(cloudflare::INSTALL));
            running.finish(cloudflare::INSTALL);
            Ok(result?)
        })
        .await
    })
    .await
}

#[tauri::command]
pub async fn cloudflare_login(
    running: State<'_, Arc<Running>>,
    on_event: Channel<cloudflare::PageEvent>,
) -> Result<(), AppError> {
    crate::log::command("cloudflare_login", async move {
        let running = Arc::clone(&running);
        attempt(move || {
            if !running.start(cloudflare::LOGIN) {
                return Err(AppError::Busy("The Cloudflare login is already running.".into()));
            }
            let result = cloudflare::login(&|| !running.is_running(cloudflare::LOGIN), &|e| {
                let _ = on_event.send(e);
            });
            running.finish(cloudflare::LOGIN);
            Ok(result?)
        })
        .await
    })
    .await
}

/// Stops a waiting login or download; whatever the person already did in the browser stays done.
#[tauri::command]
pub fn cloudflare_stop(running: State<'_, Arc<Running>>) {
    crate::log::command_now("cloudflare_stop", || {
        running.cancel(cloudflare::LOGIN);
        running.cancel(cloudflare::INSTALL);
    });
}

#[tauri::command]
pub async fn cloudflare_create(hostname: String) -> Result<String, AppError> {
    crate::log::command("cloudflare_create", async move { attempt(move || cloudflare::create(&hostname)).await }).await
}

#[tauri::command]
pub async fn cloudflare_tunnel_open(id: String, port: u16) -> Result<String, AppError> {
    crate::log::command("cloudflare_tunnel_open", async move { attempt(move || cloudflare::open(&id, port)).await })
        .await
}

#[tauri::command]
pub async fn cloudflare_tunnel_close(id: String) -> Result<(), AppError> {
    crate::log::command("cloudflare_tunnel_close", async move { attempt(move || cloudflare::close(&id)).await }).await
}

#[tauri::command]
pub async fn cloudflare_routes() -> Result<Vec<cloudflare::RouteState>, AppError> {
    crate::log::command("cloudflare_routes", async move { blocking(cloudflare::routes).await }).await
}
