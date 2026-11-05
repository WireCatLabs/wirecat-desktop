use super::blocking;
use crate::install::Running;
use crate::{funnel_helper, tailscale, tailscale_install, terminal};
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

/// `profile` is `None` only for a tool without profiles (memo); the catalog's words say whether one is needed.
#[tauri::command]
pub async fn tailscale_status() -> Result<tailscale::Status, String> {
    blocking(tailscale::status).await
}

#[tauri::command]
pub async fn tailscale_download(
    kind: String,
    running: State<'_, Arc<Running>>,
) -> Result<tailscale_install::Downloaded, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        let key = "tailscale-download";
        if !running.start(key) {
            return Err("The download is already running.".to_string());
        }
        let result = tailscale_install::download(&kind, &|| !running.is_running(key));
        running.finish(key);
        result
    })
    .await?
}

#[tauri::command]
pub async fn tailscale_terminal(what: String) -> Result<(), String> {
    blocking(move || terminal::open_line(&tailscale::terminal_line(&what)?)).await?
}

#[tauri::command]
pub async fn tailscale_login(
    running: State<'_, Arc<Running>>,
    on_event: Channel<tailscale::PageEvent>,
) -> Result<(), String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(tailscale::LOGIN) {
            return Err("The Tailscale login is already running.".to_string());
        }
        let result = tailscale::login(&|| !running.is_running(tailscale::LOGIN), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(tailscale::LOGIN);
        result
    })
    .await?
}

/// Stops a waiting login or Funnel approval; whatever the person already did in the browser stays done.
#[tauri::command]
pub fn tailscale_stop(running: State<'_, Arc<Running>>) {
    running.cancel(tailscale::LOGIN);
    running.cancel(tailscale::FUNNEL);
    running.cancel(funnel_helper::START);
}

#[tauri::command]
pub async fn tailscale_funnel_open(
    id: String,
    port: u16,
    running: State<'_, Arc<Running>>,
    on_event: Channel<tailscale::PageEvent>,
) -> Result<String, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(tailscale::FUNNEL) {
            return Err("Tailscale Funnel is being set up for another server; wait for it to finish.".to_string());
        }
        let result = tailscale::funnel_open(&id, port, &|| !running.is_running(tailscale::FUNNEL), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(tailscale::FUNNEL);
        result
    })
    .await?
}

/// Closes the tool's paths on both: the system's Tailscale and the app's own connection.
#[tauri::command]
pub async fn tailscale_funnel_close(id: String) -> Result<(), String> {
    blocking(move || tailscale::funnel_close(&id).and(funnel_helper::close(&id))).await?
}

#[tauri::command]
pub async fn tailscale_funnels() -> Result<Vec<tailscale::FunnelState>, String> {
    blocking(|| {
        let mut all = tailscale::funnels();
        all.extend(funnel_helper::funnels());
        all
    })
    .await
}

#[tauri::command]
pub async fn funnel_helper_status() -> Result<funnel_helper::Status, String> {
    blocking(funnel_helper::status).await
}

/// Starts the app's own Tailscale connection and waits for the owner in the browser; `tailscale_stop` ends the wait.
#[tauri::command]
pub async fn funnel_helper_start(
    running: State<'_, Arc<Running>>,
    on_event: Channel<tailscale::PageEvent>,
) -> Result<funnel_helper::Status, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(funnel_helper::START) {
            return Err("WireCat's Tailscale connection is already starting.".to_string());
        }
        let result = funnel_helper::start(&|| !running.is_running(funnel_helper::START), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(funnel_helper::START);
        result
    })
    .await?
}

#[tauri::command]
pub async fn funnel_helper_open(id: String, port: u16) -> Result<String, String> {
    blocking(move || funnel_helper::open(&id, port)).await?
}
