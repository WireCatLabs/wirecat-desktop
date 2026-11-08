use super::{attempt, blocking};
use crate::error::AppError;
use crate::{notifications, package_update, report, system};
use tauri::ipc::Channel;

/// The interface's one listener for wirecat:// links; a link that started the app arrives at once.
#[tauri::command]
pub fn deep_link_listen(links: tauri::State<'_, crate::deep_link::Links>, on_link: Channel<crate::deep_link::Opened>) {
    links.listen(on_link);
}

#[tauri::command]
pub async fn digest_list() -> Result<Vec<crate::digests::Day>, AppError> {
    crate::log::command("digest_list", async move { attempt(crate::digests::list).await }).await
}

#[tauri::command]
pub async fn digest_show(date: String) -> Result<crate::digests::Digest, AppError> {
    crate::log::command("digest_show", async move { attempt(move || crate::digests::show(&date)).await }).await
}

#[tauri::command]
pub fn digest_notify(
    app: tauri::AppHandle,
    date: String,
    title: String,
    body: String,
    open: String,
) -> Result<(), AppError> {
    crate::digests::notify(&app, &date, &title, &body, &open).map_err(AppError::from)
}

#[tauri::command]
pub async fn readiness() -> Result<system::Readiness, AppError> {
    crate::log::command("readiness", async move { blocking(system::readiness).await }).await
}

#[tauri::command]
pub async fn report_context() -> Result<report::Context, AppError> {
    crate::log::command("report_context", async move { blocking(report::context).await }).await
}

#[tauri::command]
pub async fn send_report(draft: report::Draft, context: report::Context) -> Result<report::Sent, AppError> {
    crate::log::command("send_report", async move { attempt(move || report::send(draft, context)).await }).await
}

#[tauri::command]
pub async fn notifications(app: tauri::AppHandle) -> Result<Vec<notifications::Notification>, AppError> {
    crate::log::command("notifications", async move {
        let version = app.package_info().version.to_string();
        attempt(move || notifications::fetch(&version)).await
    })
    .await
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
    crate::log::command(
        "update_download_package",
        async move { package_update::download(&app, &version, &on_event).await },
    )
    .await
}

/// Opens the user's terminal with the install line for the package `update_download_package` saved; the user types
/// their password there (rule 6).
#[tauri::command]
pub async fn update_package_terminal() -> Result<(), AppError> {
    crate::log::command("update_package_terminal", async move { attempt(package_update::open_terminal).await }).await
}
