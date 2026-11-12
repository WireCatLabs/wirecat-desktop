use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{background_agent, mail_agent};

#[tauri::command]
pub async fn mail_agent_status(id: String) -> Result<mail_agent::MailAgent, AppError> {
    crate::log::command("mail_agent_status", async move {
        let tool = known_tool(&id)?;
        attempt(move || mail_agent::status(tool)).await
    })
    .await
}

#[tauri::command]
/// `every` is the interval for on; none keeps the catalog's. `agent` is the owner's pick for this job only.
pub async fn mail_agent_set(
    id: String,
    on: bool,
    every: Option<String>,
    agent: Option<String>,
) -> Result<mail_agent::MailAgent, AppError> {
    crate::log::command("mail_agent_set", async move {
        let tool = known_tool(&id)?;
        attempt(move || mail_agent::set(tool, on, every.as_deref(), agent.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn background_agents() -> Result<background_agent::BackgroundAgents, AppError> {
    crate::log::command("background_agents", async move { attempt(|| Ok::<_, String>(background_agent::list())).await })
        .await
}

#[tauri::command]
pub async fn background_agent_choose(id: String) -> Result<background_agent::BackgroundAgents, AppError> {
    crate::log::command("background_agent_choose", async move { attempt(move || background_agent::choose(&id)).await })
        .await
}

#[tauri::command]
pub async fn background_agent_acknowledge(id: String) -> Result<background_agent::BackgroundAgents, AppError> {
    crate::log::command("background_agent_acknowledge", async move {
        attempt(move || background_agent::acknowledge(&id)).await
    })
    .await
}

#[tauri::command]
pub async fn mail_agent_waiting(id: String) -> Result<Option<u64>, AppError> {
    crate::log::command("mail_agent_waiting", async move {
        let tool = known_tool(&id)?;
        attempt(move || mail_agent::waiting(tool)).await
    })
    .await
}
