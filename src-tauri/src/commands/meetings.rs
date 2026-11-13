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
