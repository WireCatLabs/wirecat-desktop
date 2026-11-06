use super::{attempt, blocking, known_tool};
use crate::error::AppError;
use crate::{agent_run, catalog, chats, mcp, paths, skills, terminal_path};
use std::collections::HashMap;

#[tauri::command]
pub async fn run_agent(agent: String, prompt: String) -> Result<agent_run::AgentRun, AppError> {
    crate::log::command("run_agent", async move { attempt(move || agent_run::run(&agent, &prompt)).await }).await
}

#[tauri::command]
pub async fn detect_agents() -> Result<Vec<skills::Agent>, AppError> {
    crate::log::command("detect_agents", async move { blocking(skills::agents).await }).await
}

#[tauri::command]
pub async fn skill_status(id: String) -> Result<skills::SkillReport, AppError> {
    crate::log::command("skill_status", async move {
        let tool = known_tool(&id)?;
        attempt(move || skills::status(tool)).await
    })
    .await
}

#[tauri::command]
pub async fn skill_install(id: String, target: String) -> Result<Option<String>, AppError> {
    crate::log::command("skill_install", async move {
        let tool = known_tool(&id)?;
        skills::validate_target(&target)?;
        attempt(move || skills::install(tool, &target)).await
    })
    .await
}

#[tauri::command]
pub async fn skill_show(id: String) -> Result<skills::SkillText, AppError> {
    crate::log::command("skill_show", async move {
        let tool = known_tool(&id)?;
        attempt(move || skills::show(tool)).await
    })
    .await
}

/// Which installed tools a terminal finds on its own PATH, by tool id. For Hermes it is the `bash -l` its gateway
/// runs commands in, started from the gateway's own PATH; without a gateway service, a terminal's.
#[tauri::command]
pub async fn terminal_reach(agent: Option<String>) -> Result<HashMap<String, bool>, AppError> {
    crate::log::command("terminal_reach", async move {
        blocking(move || {
            let gateway = if agent.as_deref() == Some("hermes") { chats::hermes_base_path() } else { None };
            let gateway = gateway.and_then(|base| paths::bash_login_path(&base));
            catalog::catalog()
                .tools
                .iter()
                .filter(|t| t.part_of.is_none() && paths::find(&t.bin).is_some())
                .map(|t| {
                    let found = match &gateway {
                        Some(path) => paths::finds(&t.bin, path),
                        None => paths::in_terminal(&t.bin),
                    };
                    (t.id.clone(), found)
                })
                .collect()
        })
        .await
    })
    .await
}

/// Puts the folders of the listed installed tools on the user's PATH when a fresh terminal does not find them.
#[tauri::command]
pub async fn fix_terminal_path(ids: Vec<String>) -> Result<terminal_path::PathFix, AppError> {
    crate::log::command("fix_terminal_path", async move { attempt(move || terminal_path::fix(&ids)).await }).await
}

/// The shells `/etc/shells` lists that exist here, for "Which shell does your terminal run?".
#[tauri::command]
pub async fn terminal_shells() -> Result<terminal_path::ShellChoices, AppError> {
    crate::log::command("terminal_shells", async move { blocking(terminal_path::choices).await }).await
}

/// Saves the shell the user picked (one of `terminal_shells`), then puts the listed tools on its PATH and checks again.
#[tauri::command]
pub async fn use_terminal_shell(shell: String, ids: Vec<String>) -> Result<terminal_path::PathFix, AppError> {
    crate::log::command(
        "use_terminal_shell",
        async move { attempt(move || terminal_path::use_shell(&shell, &ids)).await },
    )
    .await
}

#[tauri::command]
pub async fn agent_chats(agent: String) -> Result<chats::Chats, AppError> {
    crate::log::command("agent_chats", async move { attempt(move || chats::read(&agent)).await }).await
}

#[tauri::command]
pub async fn mcp_registrations(agent: String) -> Result<mcp::Registrations, AppError> {
    crate::log::command("mcp_registrations", async move { attempt(move || mcp::registrations(&agent)).await }).await
}

/// `profile: None` removes the bare `<bin>` entry a person may have added by hand.
#[tauri::command]
pub async fn mcp_remove(id: String, profile: Option<String>, agent: String) -> Result<(), AppError> {
    crate::log::command("mcp_remove", async move {
        let tool = known_tool(&id)?;
        attempt(move || mcp::remove(tool, profile.as_deref(), &agent)).await
    })
    .await
}
