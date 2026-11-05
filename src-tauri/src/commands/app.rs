use super::{attempt, blocking};
use crate::error::AppError;
use crate::{notifications, package_update, report, system};
use tauri::ipc::Channel;

#[tauri::command]
pub async fn readiness() -> Result<system::Readiness, AppError> {
    blocking(system::readiness).await
}

#[tauri::command]
pub async fn report_context() -> Result<report::Context, AppError> {
    blocking(report::context).await
}

#[tauri::command]
pub async fn send_report(draft: report::Draft, context: report::Context) -> Result<report::Sent, AppError> {
    attempt(move || report::send(draft, context)).await
}

#[tauri::command]
pub async fn notifications(app: tauri::AppHandle) -> Result<Vec<notifications::Notification>, AppError> {
    let version = app.package_info().version.to_string();
    attempt(move || notifications::fetch(&version)).await
}

#[tauri::command]
pub fn update_kind() -> package_update::Kind {
    package_update::current()
}

#[tauri::command]
pub async fn update_download_package(
    app: tauri::AppHandle,
    version: String,
    on_event: Channel<package_update::Progress>,
) -> Result<package_update::Outcome, package_update::Failure> {
    package_update::download(&app, &version, &on_event).await
}
