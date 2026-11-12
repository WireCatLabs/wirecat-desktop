use super::{attempt, blocking};
use crate::error::AppError;
use crate::{catalog, community, registry};

/// The community tools Rust accepted at start, so the interface lists exactly the tools Rust will run.
#[tauri::command]
pub fn extra_tools() -> community::Extra {
    catalog::catalog().extra.clone()
}

// Async: the status reads the saved list and checks its signature.
#[tauri::command]
pub async fn community_status() -> Result<registry::Status, AppError> {
    crate::log::command("community_status", async move { blocking(registry::status).await }).await
}

/// Takes effect at the next start; turning it on fetches the list now, so that start has it.
#[tauri::command]
pub async fn set_community_shown(show: bool) -> Result<(), AppError> {
    crate::log::command("set_community_shown", async move {
        attempt(move || registry::set_shown(show)).await?;
        if show {
            std::thread::spawn(registry::check_now);
        }
        Ok(())
    })
    .await
}
