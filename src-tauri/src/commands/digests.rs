use super::attempt;
use crate::error::AppError;

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
