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
pub async fn digest_list(digest: Option<String>) -> Result<Vec<crate::digests::Day>, AppError> {
    crate::log::command("digest_list", async move { attempt(move || crate::digests::list(digest.as_deref())).await })
        .await
}

#[tauri::command]
pub async fn digest_show(digest: Option<String>, date: String) -> Result<crate::digests::Digest, AppError> {
    crate::log::command(
        "digest_show",
        async move { attempt(move || crate::digests::show(digest.as_deref(), &date)).await },
    )
    .await
}

#[tauri::command]
pub async fn digest_book() -> Result<crate::digest_book::DigestBook, AppError> {
    crate::log::command("digest_book", async move { attempt(crate::digest_book::book).await }).await
}

/// `create` adds a digest; otherwise memo replaces the settings of the one named.
#[tauri::command]
pub async fn digest_save(
    spec: crate::digest_book::DigestSpec,
    create: bool,
) -> Result<crate::digest_book::DigestBook, AppError> {
    crate::log::command("digest_save", async move { attempt(move || crate::digest_book::save(&spec, create)).await })
        .await
}

#[tauri::command]
pub async fn digest_run(
    digest: String,
    delivery: crate::digest_book::SendTo,
) -> Result<crate::digest_book::DigestBook, AppError> {
    crate::log::command("digest_run", async move { attempt(move || crate::digest_book::run(&digest, &delivery)).await })
        .await
}

#[tauri::command]
pub async fn digest_set_scheduled(digest: String, on: bool) -> Result<crate::digest_book::DigestBook, AppError> {
    crate::log::command("digest_set_scheduled", async move {
        attempt(move || crate::digest_book::set_scheduled(&digest, on)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_remove(digest: String) -> Result<crate::digest_book::DigestBook, AppError> {
    crate::log::command("digest_remove", async move { attempt(move || crate::digest_book::remove(&digest)).await })
        .await
}

/// The bots, own chats and mailboxes a digest's route can name; a tool that is missing or fails offers none.
#[tauri::command]
pub async fn digest_route_choices() -> Result<crate::digest_routes::RouteChoices, AppError> {
    crate::log::command("digest_route_choices", async move {
        attempt(|| Ok::<_, String>(crate::digest_routes::choices())).await
    })
    .await
}

/// `yes` false only prices the days; true builds them.
#[tauri::command]
pub async fn digest_backfill(
    digest: Option<String>,
    from: String,
    to: String,
    yes: bool,
) -> Result<crate::digest_schedule::Backfill, AppError> {
    crate::log::command("digest_backfill", async move {
        attempt(move || crate::digest_schedule::backfill(digest.as_deref(), &from, &to, yes)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_brief(digest: Option<String>) -> Result<crate::digest_editors::Brief, AppError> {
    crate::log::command("digest_brief", async move {
        attempt(move || crate::digest_editors::brief(digest.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn digest_brief_save(digest: Option<String>, body: String) -> Result<crate::digest_editors::Brief, AppError> {
    crate::log::command("digest_brief_save", async move {
        attempt(move || crate::digest_editors::brief_save(digest.as_deref(), &body)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_brief_undo(digest: Option<String>) -> Result<crate::digest_editors::Brief, AppError> {
    crate::log::command("digest_brief_undo", async move {
        attempt(move || crate::digest_editors::brief_undo(digest.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn digest_brief_reset(digest: Option<String>) -> Result<crate::digest_editors::Brief, AppError> {
    crate::log::command("digest_brief_reset", async move {
        attempt(move || crate::digest_editors::brief_reset(digest.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn digest_template(
    digest: Option<String>,
    channel: String,
    locale: String,
) -> Result<crate::digest_editors::DigestTemplate, AppError> {
    crate::log::command("digest_template", async move {
        attempt(move || crate::digest_editors::template(digest.as_deref(), &channel, &locale)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_template_save(
    digest: Option<String>,
    channel: String,
    locale: String,
    body: String,
) -> Result<crate::digest_editors::DigestTemplate, AppError> {
    crate::log::command("digest_template_save", async move {
        attempt(move || crate::digest_editors::template_save(digest.as_deref(), &channel, &locale, &body)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_template_undo(
    digest: Option<String>,
    channel: String,
    locale: String,
) -> Result<crate::digest_editors::DigestTemplate, AppError> {
    crate::log::command("digest_template_undo", async move {
        attempt(move || crate::digest_editors::template_undo(digest.as_deref(), &channel, &locale)).await
    })
    .await
}

#[tauri::command]
pub async fn digest_template_reset(
    digest: Option<String>,
    channel: String,
    locale: String,
) -> Result<crate::digest_editors::DigestTemplate, AppError> {
    crate::log::command("digest_template_reset", async move {
        attempt(move || crate::digest_editors::template_reset(digest.as_deref(), &channel, &locale)).await
    })
    .await
}

/// `draft` null previews the template that applies; a draft is previewed without being saved.
#[tauri::command]
pub async fn digest_template_preview(
    digest: Option<String>,
    channel: String,
    locale: String,
    draft: Option<String>,
) -> Result<crate::digest_editors::TemplatePreview, AppError> {
    crate::log::command("digest_template_preview", async move {
        attempt(move || crate::digest_editors::template_preview(digest.as_deref(), &channel, &locale, draft.as_deref()))
            .await
    })
    .await
}

/// Async: a sync command runs on the main thread, and showing a notice waits on the desktop's notification service.
#[tauri::command]
pub async fn digest_notify(
    app: tauri::AppHandle,
    date: String,
    title: String,
    body: String,
    open: String,
) -> Result<(), AppError> {
    attempt(move || crate::digests::notify(&app, &date, &title, &body, &open)).await
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
pub async fn update_package_terminal() -> Result<(), AppError> {
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
