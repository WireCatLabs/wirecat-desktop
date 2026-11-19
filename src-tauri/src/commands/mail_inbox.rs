use super::{attempt, known_tool, valid_profile};
use crate::error::AppError;
use crate::{mail_inbox, sync_schedule};

/// One page of every named account's sorted mail, merged; `profiles` is the window's list of every account.
#[tauri::command]
pub async fn mail_inbox_list(
    id: String,
    profiles: Vec<String>,
    filter: mail_inbox::InboxFilter,
    page: u32,
    limit: u32,
) -> Result<mail_inbox::InboxPage, AppError> {
    crate::log::command("mail_inbox_list", async move {
        let tool = known_tool(&id)?;
        for p in &profiles {
            valid_profile(p)?;
        }
        attempt(move || mail_inbox::list(tool, &profiles, &filter, page, limit)).await
    })
    .await
}

/// Sorts one account's new mail now; `yes` once the owner agreed to send it to a model outside this computer.
#[tauri::command]
pub async fn mail_inbox_run(id: String, profile: String, yes: bool) -> Result<mail_inbox::InboxRun, AppError> {
    crate::log::command("mail_inbox_run", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || mail_inbox::run(tool, &profile, yes)).await
    })
    .await
}

#[tauri::command]
pub async fn mail_inbox_schedule_status(id: String, profile: String) -> Result<sync_schedule::SyncSchedule, AppError> {
    crate::log::command("mail_inbox_schedule_status", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || sync_schedule::status(tool, sync_schedule::Job::Inbox, &profile)).await
    })
    .await
}

/// `every` makes or replaces the account's sorting schedule; `None` removes it.
#[tauri::command]
pub async fn mail_inbox_schedule_set(
    id: String,
    profile: String,
    every: Option<String>,
) -> Result<sync_schedule::SyncSchedule, AppError> {
    crate::log::command("mail_inbox_schedule_set", async move {
        let tool = known_tool(&id)?;
        valid_profile(&profile)?;
        attempt(move || {
            let when = every.as_deref().map(sync_schedule::When::Every);
            sync_schedule::set(tool, sync_schedule::Job::Inbox, &profile, when)
        })
        .await
    })
    .await
}
