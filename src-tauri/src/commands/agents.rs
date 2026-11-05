use super::blocking;
use crate::{agent_run, catalog, chats, mcp, paths, skills, terminal_path};
use std::collections::HashMap;

#[tauri::command]
pub async fn run_agent(agent: String, prompt: String) -> Result<agent_run::AgentRun, String> {
    blocking(move || agent_run::run(&agent, &prompt)).await?
}

#[tauri::command]
pub async fn detect_agents() -> Result<Vec<skills::Agent>, String> {
    blocking(skills::agents).await
}

#[tauri::command]
pub async fn skill_status(id: String) -> Result<skills::SkillReport, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || skills::status(tool)).await?
}

#[tauri::command]
pub async fn skill_install(id: String, target: String) -> Result<Option<String>, String> {
    let tool = catalog::tool(&id)?;
    skills::validate_target(&target)?;
    blocking(move || skills::install(tool, &target)).await?
}

#[tauri::command]
pub async fn skill_show(id: String) -> Result<skills::SkillText, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || skills::show(tool)).await?
}

/// Which installed tools a terminal finds on its own PATH, by tool id. For Hermes it is the `bash -l` its gateway
/// runs commands in, started from the gateway's own PATH; without a gateway service, a terminal's.
#[tauri::command]
pub async fn terminal_reach(agent: Option<String>) -> Result<HashMap<String, bool>, String> {
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
}

/// Puts the folders of the listed installed tools on the user's PATH when a fresh terminal does not find them.
#[tauri::command]
pub async fn fix_terminal_path(ids: Vec<String>) -> Result<terminal_path::PathFix, String> {
    blocking(move || terminal_path::fix(&ids)).await?
}

/// The shells `/etc/shells` lists that exist here, for "Which shell does your terminal run?".
#[tauri::command]
pub async fn terminal_shells() -> Result<terminal_path::ShellChoices, String> {
    blocking(terminal_path::choices).await
}

/// Saves the shell the user picked (one of `terminal_shells`), then puts the listed tools on its PATH and checks again.
#[tauri::command]
pub async fn use_terminal_shell(shell: String, ids: Vec<String>) -> Result<terminal_path::PathFix, String> {
    blocking(move || terminal_path::use_shell(&shell, &ids)).await?
}

#[tauri::command]
pub async fn agent_chats(agent: String) -> Result<chats::Chats, String> {
    blocking(move || chats::read(&agent)).await?
}

#[tauri::command]
pub async fn mcp_registrations(agent: String) -> Result<mcp::Registrations, String> {
    blocking(move || mcp::registrations(&agent)).await?
}

#[tauri::command]
pub async fn mcp_check(id: String, profile: String) -> Result<mcp::Health, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::check(tool, &profile)).await?
}

#[tauri::command]
pub async fn mcp_add(id: String, profile: String, agent: String, allow_writes: bool) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::add(tool, &profile, &agent, allow_writes)).await?
}

/// `profile: None` removes the bare `<bin>` entry a person may have added by hand.
#[tauri::command]
pub async fn mcp_remove(id: String, profile: Option<String>, agent: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::remove(tool, profile.as_deref(), &agent)).await?
}
