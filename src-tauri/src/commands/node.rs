use super::{attempt, blocking};
use crate::error::AppError;
use crate::install::Running;
use crate::{node, profile};
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn node_offer() -> Result<node::Offer, AppError> {
    crate::log::command("node_offer", async move { attempt(node::offer).await }).await
}

#[tauri::command]
pub async fn setup_node(running: State<'_, Arc<Running>>, on_event: Channel<node::NodeEvent>) -> Result<(), AppError> {
    crate::log::command("setup_node", async move {
        let running = Arc::clone(&running);
        blocking(move || {
            node::set_up(&running, &|e| {
                let _ = on_event.send(e);
            });
        })
        .await
    })
    .await
}

#[tauri::command]
pub fn cancel_node_setup(running: State<'_, Arc<Running>>) {
    crate::log::command_now("cancel_node_setup", || {
        running.cancel(node::OPERATION);
    });
}

#[tauri::command]
pub async fn remove_node() -> Result<(), AppError> {
    crate::log::command("remove_node", async move { attempt(node::remove).await }).await
}

/// What "Add to PATH" would write and where, for the app's own Node.js.
#[tauri::command]
pub async fn node_path() -> Result<profile::PathPlan, AppError> {
    crate::log::command("node_path", async move {
        attempt(|| {
            let found = node::installed()
                .ok_or_else(|| AppError::NotInstalled("WireCat has not set up Node.js on this computer.".into()))?;
            Ok::<_, AppError>(profile::plan(&node::bin_dir(&found.dir)))
        })
        .await
    })
    .await
}

#[tauri::command]
pub async fn set_node_path(add: bool) -> Result<profile::PathPlan, AppError> {
    crate::log::command("set_node_path", async move {
        attempt(move || {
            let found = node::installed()
                .ok_or_else(|| AppError::NotInstalled("WireCat has not set up Node.js on this computer.".into()))?;
            let bin = node::bin_dir(&found.dir);
            Ok::<_, AppError>(if add { profile::add(&bin) } else { profile::remove(&bin) }?)
        })
        .await
    })
    .await
}
