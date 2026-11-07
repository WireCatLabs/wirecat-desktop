use super::{attempt, blocking, known_tool};
use crate::error::AppError;
use crate::install::Running;
use crate::{bots, signin};
use std::collections::BTreeMap;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

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
        blocking(move || {
            let send = |e: signin::SignInEvent| {
                let _ = on_event.send(e);
            };
            let key = signin::key(&tool.id);
            if !running.start(&key) {
                return send(signin::SignInEvent::Failed {
                    message: format!(
                        "A {} sign-in is still running or stopping. Try again in a few seconds.",
                        tool.name
                    ),
                    code: None,
                    reason: None,
                });
            }
            signin::run(tool, &prepared, &|| !running.is_running(&key), &send);
            running.finish(&key);
        })
        .await
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
