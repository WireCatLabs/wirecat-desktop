use super::attempt;
use crate::error::AppError;
use crate::meetings::{self, Window};

/// One window of a calendar (`from` and `to` both set, oldest first) or one page of the whole history (neither set,
/// newest first); `query` is memo's own search words (`kind:call has_transcript:true`).
#[tauri::command]
pub async fn meetings_list(
    query: String,
    from: Option<String>,
    to: Option<String>,
    page: u32,
    limit: u32,
) -> Result<meetings::MeetingsRead, AppError> {
    crate::log::command("meetings_list", async move {
        attempt(move || {
            let window = match (from.as_deref(), to.as_deref()) {
                (Some(from), Some(to)) => Window::Days { from, to },
                (None, None) => Window::All,
                _ => return Err("A window needs both its ends.".to_string()),
            };
            meetings::list(&query, &window, page, limit)
        })
        .await
    })
    .await
}

/// One meeting with its transcript lines from `cursor` (a line position).
#[tauri::command]
pub async fn meetings_show(reference: String, cursor: u64) -> Result<meetings::MeetingDetails, AppError> {
    crate::log::command("meetings_show", async move { attempt(move || meetings::show(&reference, cursor)).await }).await
}

/// The stored meeting a provider's id names (a link from a CLI), or a meeting by its `meeting:` ref, read in the tool
/// that recorded it as `profile`, with where its recording is.
#[tauri::command]
pub async fn meeting_find(
    provider: String,
    profile: String,
    meeting: String,
) -> Result<crate::call_recording::MeetingFound, AppError> {
    crate::log::command("meeting_find", async move {
        attempt(move || crate::call_recording::find(&provider, &profile, &meeting)).await
    })
    .await
}

/// The recording's bytes for the player; Rust reads only the file the tool names for this meeting now.
#[tauri::command]
pub async fn meeting_recording_read(
    provider: String,
    profile: String,
    meeting: String,
) -> Result<tauri::ipc::Response, AppError> {
    crate::log::command("meeting_recording_read", async move {
        attempt(move || crate::call_recording::read(&provider, &profile, &meeting).map(tauri::ipc::Response::new)).await
    })
    .await
}

/// The recording in the system's own player.
#[tauri::command]
pub async fn meeting_recording_open(provider: String, profile: String, meeting: String) -> Result<(), AppError> {
    crate::log::command("meeting_recording_open", async move {
        attempt(move || crate::call_recording::open(&provider, &profile, &meeting)).await
    })
    .await
}
