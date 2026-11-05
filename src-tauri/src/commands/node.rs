use super::{attempt, blocking};
use crate::error::AppError;
use crate::install::Running;
use crate::{install, node, paths, profile, terminal_path};
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
            let send = |e: node::NodeEvent| {
                let _ = on_event.send(e);
            };
            if !running.start(node::OPERATION) {
                return send(node::NodeEvent::Failed {
                    reason: install::Reason::Failed,
                    message: "Node.js setup is already running.".into(),
                    hint: None,
                });
            }
            let result = match node::root() {
                Some(root) => node::setup(&root, &send, &|| !running.is_running(node::OPERATION)),
                None => Err(node::Failure::no_home()),
            };
            running.finish(node::OPERATION);
            // Tools installed with this Node.js are linked beside it; the user's PATH changes without an administrator,
            // so a terminal and the AI apps find them with nothing more to do. A failure here never fails the setup.
            if result.is_ok() {
                send(node::NodeEvent::Step { step: node::Step::Path });
            }
            let path_fix =
                result.as_ref().ok().and_then(|done| terminal_path::after_node_setup(&node::bin_dir(&done.dir)));
            paths::refresh(&[]);
            send(match result {
                Ok(done) => node::NodeEvent::Done {
                    version: done.version.to_string(),
                    path: paths::tilde(&done.dir.to_string_lossy()),
                    path_fix,
                },
                Err(f) => f.into(),
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
