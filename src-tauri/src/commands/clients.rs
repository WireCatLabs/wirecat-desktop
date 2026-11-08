use super::attempt;
use crate::crm_board::{self, CrmKind};
use crate::error::AppError;

#[tauri::command]
pub async fn clients_read(kind: CrmKind, pipeline: Option<String>) -> Result<crm_board::CrmRead, AppError> {
    crate::log::command(
        "clients_read",
        async move { attempt(move || crm_board::read(kind, pipeline.as_deref())).await },
    )
    .await
}

/// `via` names the CRM account and the profile of its CLI for a CRM's copy; `None` moves the owner's own through memo.
#[tauri::command]
pub async fn clients_move(
    kind: CrmKind,
    reference: String,
    stage: String,
    via: Option<crm_board::CrmVia>,
) -> Result<Option<crm_board::CrmCard>, AppError> {
    crate::log::command("clients_move", async move {
        attempt(move || crm_board::move_card(kind, &reference, &stage, via.as_ref())).await
    })
    .await
}

#[tauri::command]
pub async fn clients_scope(
    account: crm_board::CrmAccount,
    profile: Option<String>,
) -> Result<crm_board::CrmScope, AppError> {
    crate::log::command("clients_scope", async move {
        attempt(move || crm_board::scope(&account, profile.as_deref())).await
    })
    .await
}

/// Saves the account's sync scope through its CRM's CLI; the page then starts that profile's sync.
#[tauri::command]
pub async fn clients_scope_set(account: crm_board::CrmAccount, profile: String, scope: String) -> Result<(), AppError> {
    crate::log::command("clients_scope_set", async move {
        attempt(move || crm_board::scope_set(&account, &profile, &scope)).await
    })
    .await
}

#[tauri::command]
pub async fn clients_map_set(stage: String, base: String) -> Result<(), AppError> {
    crate::log::command("clients_map_set", async move { attempt(move || crm_board::map_stage(&stage, &base)).await })
        .await
}

#[tauri::command]
pub async fn clients_map_confirm(kind: CrmKind, pipeline: Option<String>) -> Result<(), AppError> {
    crate::log::command("clients_map_confirm", async move {
        attempt(move || crm_board::confirm(kind, pipeline.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn clients_base_edit(kind: CrmKind, edit: crm_board::CrmBaseEdit) -> Result<(), AppError> {
    crate::log::command("clients_base_edit", async move { attempt(move || crm_board::edit_base(kind, &edit)).await })
        .await
}
