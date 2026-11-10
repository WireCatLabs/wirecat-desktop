use super::attempt;
use crate::error::AppError;
use crate::person_profile;

/// What the match dialog compares about one person: contacts, companies, activity and the latest messages.
#[tauri::command]
pub async fn people_profile(reference: String) -> Result<person_profile::Profile, AppError> {
    crate::log::command("people_profile", async move { attempt(move || person_profile::profile(&reference)).await })
        .await
}
