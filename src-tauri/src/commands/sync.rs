use super::{attempt, blocking, known_tool, valid_profile};
use crate::error::AppError;
use crate::install::Running;
use crate::{sync, sync_schedule};
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
    crate::log::command("sync_run", async move {
        let tool = known_tool(&id)?;
        let args = sync::args(tool, profile.as_deref())?;
        let running = Arc::clone(&running);
        blocking(move || sync::run_guarded(tool, profile.as_deref(), &args, &running, &on_event)).await
    })
    .await
}

/// Asks that profile's running sync to stop: SIGTERM to its process, then its group after a few seconds.
#[tauri::command]
pub fn sync_stop(id: String, profile: Option<String>, running: State<'_, Arc<Running>>) -> Result<(), AppError> {
    crate::log::command_now("sync_stop", || {
        let tool = known_tool(&id)?;
        if let Some(p) = &profile {
            valid_profile(p)?;
        }
        running.cancel(&sync::key(tool, profile.as_deref()));
        Ok(())
    })
}

#[tauri::command]
pub async fn sync_last(id: String, profile: Option<String>) -> Result<sync::LastSync, AppError> {
    crate::log::command("sync_last", async move {
        let tool = known_tool(&id)?;
        attempt(move || sync::last(tool, profile.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn sync_schedule_status(id: String, profile: String) -> Result<sync_schedule::SyncSchedule, AppError> {
    crate::log::command("sync_schedule_status", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || sync_schedule::status(tool, &profile)).await
    })
    .await
}

/// `every` (an interval) or `at` (daily, `HH:MM`) makes or replaces the account's sync schedule; neither removes it.
#[tauri::command]
pub async fn sync_schedule_set(
    id: String,
    profile: String,
    every: Option<String>,
    at: Option<String>,
) -> Result<sync_schedule::SyncSchedule, AppError> {
    crate::log::command("sync_schedule_set", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || {
            let when = match (every.as_deref(), at.as_deref()) {
                (Some(_), Some(_)) => return Err("a schedule runs at an interval or at a time, not both".to_string()),
                (Some(every), None) => Some(sync_schedule::When::Every(every)),
                (None, Some(at)) => Some(sync_schedule::When::At(at)),
                (None, None) => None,
            };
            sync_schedule::set(tool, &profile, when)
        })
        .await
    })
    .await
}

/// Runs the account's schedule once now, as its timer would, and waits for it. Counts as this window's sync of the
/// profile, so a sync from the page and the test run never hold the store at once.
#[tauri::command]
pub async fn sync_schedule_test(
    id: String,
    profile: String,
    running: State<'_, Arc<Running>>,
) -> Result<sync_schedule::ScheduleTest, AppError> {
    let running = Arc::clone(&running);
    crate::log::command("sync_schedule_test", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        let key = sync::claim(tool, Some(&profile), &running).map_err(AppError::Busy)?;
        let result = attempt(move || sync_schedule::test(tool, &profile)).await;
        running.finish(&key);
        result
    })
    .await
}
