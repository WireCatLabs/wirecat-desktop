use super::{attempt, blocking, known_tool, valid_profile};
use crate::error::AppError;
use crate::install::Running;
use crate::{catalog, sync};
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

/// Runs the tool's own sync for the profile the owner chose; stages and the result arrive on the channel.
#[tauri::command]
pub async fn sync_run(
    id: String,
    profile: Option<String>,
    running: State<'_, Arc<Running>>,
    on_event: Channel<sync::SyncEvent>,
) -> Result<(), AppError> {
    let tool = known_tool(&id)?;
    let args = sync::args(tool, profile.as_deref())?;
    let running = Arc::clone(&running);
    blocking(move || {
        let send = |e: sync::SyncEvent| {
            let _ = on_event.send(e);
        };
        let key = sync::key(tool, profile.as_deref());
        let busy = running.busy(&catalog::owner(tool).id);
        if busy || !running.start(&key) {
            return send(sync::SyncEvent::Failed {
                message: if busy {
                    format!("{} is being installed or updated. Sync when it is done.", tool.name)
                } else {
                    "This sync is still running or stopping. Try again in a few seconds.".into()
                },
                code: None,
                reason: Some("app.busy".into()),
                run: None,
                retry_after_ms: None,
            });
        }
        sync::run(tool, &args, &|| !running.is_running(&key), &send);
        running.finish(&key);
    })
    .await
}

/// Asks that profile's running sync to stop: SIGTERM to its process, then its group after a few seconds.
#[tauri::command]
pub fn sync_stop(id: String, profile: Option<String>, running: State<'_, Arc<Running>>) -> Result<(), AppError> {
    let tool = known_tool(&id)?;
    if let Some(p) = &profile {
        valid_profile(p)?;
    }
    running.cancel(&sync::key(tool, profile.as_deref()));
    Ok(())
}

#[tauri::command]
pub async fn sync_last(id: String, profile: Option<String>) -> Result<sync::LastSync, AppError> {
    let tool = known_tool(&id)?;
    attempt(move || sync::last(tool, profile.as_deref())).await
}
