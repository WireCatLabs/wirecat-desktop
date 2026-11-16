use super::{attempt, blocking, known_tool};
use crate::error::AppError;
use crate::install::Running;
use crate::{bots, setup_flow, signin};
use std::collections::BTreeMap;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// Signs a profile in inside the window with one of the catalog's `signIn.methods`.
#[tauri::command]
pub async fn sign_in(
    id: String,
    method: String,
    profile: String,
    inputs: Option<signin::Inputs>,
    running: State<'_, Arc<Running>>,
    on_event: Channel<signin::SignInEvent>,
) -> Result<(), AppError> {
    crate::log::command("sign_in", async move {
        let tool = known_tool(&id)?;
        let prepared = signin::args(tool, &method, &profile, inputs.unwrap_or_default())?;
        let running = Arc::clone(&running);
        blocking(move || signin::run_guarded(tool, &prepared, &running, &on_event)).await
    })
    .await
}

/// Connects a bot to the profile the owner named: the catalog's settings first (`WhatsApp`'s ids), then the token on
/// the tool's stdin. The token is wiped once written and never comes back.
#[tauri::command]
pub async fn bot_sign_in(
    id: String,
    profile: String,
    token: String,
    fields: BTreeMap<String, String>,
) -> Result<bots::BotResult, AppError> {
    crate::log::command("bot_sign_in", async move {
        let token = bots::Token::new(token);
        let tool = known_tool(&id)?;
        attempt(move || bots::connect(tool, &profile, &token, &fields)).await
    })
    .await
}

/// Every bot name on this computer, from the tool's own `bot list`.
#[tauri::command]
pub async fn list_bots(id: String) -> Result<Vec<bots::BotProfile>, AppError> {
    crate::log::command("list_bots", async move {
        let tool = known_tool(&id)?;
        attempt(move || bots::list(tool)).await
    })
    .await
}

/// The same list after the tool asked the messenger about each token.
#[tauri::command]
pub async fn check_bots(id: String) -> Result<Vec<bots::BotProfile>, AppError> {
    crate::log::command("check_bots", async move {
        let tool = known_tool(&id)?;
        attempt(move || bots::check_all(tool)).await
    })
    .await
}

/// Forgets one bot's token on this computer, with the tool's own `bot auth remove`.
#[tauri::command]
pub async fn remove_bot(id: String, profile: String) -> Result<(), AppError> {
    crate::log::command("remove_bot", async move {
        let tool = known_tool(&id)?;
        attempt(move || bots::remove(tool, &profile)).await
    })
    .await
}

/// The tool's profiles already signed in to this portal, for the window to refuse a second profile with the same
/// webhook before it runs.
#[tauri::command]
pub async fn sign_in_on_portal(id: String, host: String) -> Result<Vec<signin::Signed>, AppError> {
    crate::log::command("sign_in_on_portal", async move {
        let tool = known_tool(&id)?;
        attempt(move || signin::on_portal(tool, &host)).await
    })
    .await
}

/// Hands the running sign-in the answer to its last `needs` step, on its stdin; the value is wiped after the write.
#[tauri::command]
pub fn sign_in_answer(id: String, value: String) -> Result<(), AppError> {
    crate::log::command_now("sign_in_answer", || {
        let value = signin::Answer::new(value);
        Ok(signin::answer(&known_tool(&id)?.id, &value)?)
    })
}

/// Asks the running sign-in to stop; `sign_in` answers `stopped`, or `done` when the tool kept what had come.
#[tauri::command]
pub fn sign_in_stop(id: String, running: State<'_, Arc<Running>>) -> Result<(), AppError> {
    crate::log::command_now("sign_in_stop", || {
        running.cancel(&signin::key(&known_tool(&id)?.id));
        Ok(())
    })
}

/// The tool's own connection flow, from `<tool> <profile> setup show --json`; a tool from before the format refuses
/// with "unknown command", and the window keeps its hand-made form.
#[tauri::command]
pub async fn setup_show(id: String, profile: String) -> Result<setup_flow::Shown, AppError> {
    crate::log::command("setup_show", async move {
        let tool = known_tool(&id)?;
        attempt(move || setup_flow::show(tool, &profile)).await
    })
    .await
}

/// Checks the answers of the path with `setup apply --dry-run`, on the tool's stdin; nothing is saved.
#[tauri::command]
pub async fn setup_check(id: String, profile: String, answers: String) -> Result<serde_json::Value, AppError> {
    crate::log::command("setup_check", async move {
        let answers = signin::Answer::new(answers);
        let tool = known_tool(&id)?;
        attempt(move || setup_flow::check(tool, &profile, &answers)).await
    })
    .await
}

/// The flow's `apply` run: the answers on stdin's first line, then the tool's steps as a sign-in streams them.
/// `sign_in_answer` and `sign_in_stop` reach it, and it never runs beside another sign-in of the same tool.
#[tauri::command]
pub async fn setup_apply(
    id: String,
    profile: String,
    answers: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<signin::SignInEvent>,
) -> Result<(), AppError> {
    crate::log::command("setup_apply", async move {
        let tool = known_tool(&id)?;
        let prepared = signin::setup_apply(&profile, signin::Answer::new(answers))?;
        let running = Arc::clone(&running);
        blocking(move || signin::run_guarded(tool, &prepared, &running, &on_event)).await
    })
    .await
}

/// The system's own file or folder window for a flow's `file` or `folder` input; None when the owner closes it.
#[tauri::command]
pub async fn setup_pick_path(app: AppHandle, folder: bool, accept: Vec<String>) -> Result<Option<String>, AppError> {
    crate::log::command("setup_pick_path", async move {
        let extensions: Vec<String> = accept
            .iter()
            .filter_map(|a| a.strip_prefix('.'))
            .filter(|e| !e.is_empty() && e.len() <= 10 && e.chars().all(|c| c.is_ascii_alphanumeric()))
            .map(str::to_string)
            .collect();
        let picked = blocking(move || {
            let dialog = app.dialog().file();
            if folder {
                dialog.blocking_pick_folder()
            } else if extensions.is_empty() {
                dialog.blocking_pick_file()
            } else {
                let refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
                dialog.add_filter(refs.join(", "), &refs).blocking_pick_file()
            }
        })
        .await?;
        Ok(picked.and_then(|p| p.into_path().ok()).and_then(|p| p.to_str().map(str::to_string)))
    })
    .await
}
