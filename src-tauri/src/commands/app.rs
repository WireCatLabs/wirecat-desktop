use super::{attempt, blocking};
use crate::error::AppError;
use crate::{notifications, package_update, report, system};
use tauri::ipc::Channel;

/// The interface's one listener for wirecat:// links; a link that started the app arrives at once.
#[tauri::command]
pub fn deep_link_listen(links: tauri::State<'_, crate::deep_link::Links>, on_link: Channel<crate::deep_link::Opened>) {
    links.listen(on_link);
}

/// A web page in the owner's browser; a launcher that fails is an error the interface shows with the address.
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), AppError> {
    crate::log::command("open_url", async move { attempt(move || crate::host_open::url(&url)).await }).await
}

#[tauri::command]
pub async fn readiness() -> Result<system::Readiness, AppError> {
    crate::log::command("readiness", async move { blocking(system::readiness).await }).await
}

#[tauri::command]
#[must_use]
pub fn sandbox() -> Option<String> {
    system::sandbox()
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
pub async fn update_package_terminal() -> Result<crate::terminal::Opened, AppError> {
    crate::log::command("update_package_terminal", async move { attempt(package_update::open_terminal).await }).await
}

/// Whether the app opens when the owner logs in: the autostart plugin's entry (an `XDG` autostart file, a launchd agent
/// or a `Run` key in the registry).
#[tauri::command]
pub async fn autostart_status(app: tauri::AppHandle) -> Result<bool, AppError> {
    use tauri_plugin_autostart::ManagerExt;
    crate::log::command("autostart_status", async move {
        attempt(move || app.autolaunch().is_enabled().map_err(|e| e.to_string())).await
    })
    .await
}

#[tauri::command]
pub async fn autostart_set(app: tauri::AppHandle, on: bool) -> Result<bool, AppError> {
    use tauri_plugin_autostart::ManagerExt;
    crate::log::command(
        "autostart_set",
        async move { attempt(move || system::set_autostart(&app.autolaunch(), on)).await },
    )
    .await
}

/// The bell's unread count on the app icon; 0 takes the badge away.
#[tauri::command]
#[cfg(target_os = "linux")]
pub async fn dock_badge(count: u32) -> Result<(), AppError> {
    crate::log::command("dock_badge", attempt(move || crate::dock_badge::set(count))).await
}

/// Tauri's own badge works on macOS; Windows has none (only an overlay icon), so there the call does nothing.
#[tauri::command]
#[cfg(not(target_os = "linux"))]
pub fn dock_badge(app: tauri::AppHandle, count: u32) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_badge_count((count > 0).then_some(i64::from(count)));
    }
}
