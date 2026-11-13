use super::attempt;
use crate::crm_board::{self, CrmKind};
use crate::error::AppError;

#[tauri::command]
pub async fn clients_read(kind: CrmKind) -> Result<crm_board::CrmRead, AppError> {
    crate::log::command("clients_read", async move { attempt(move || crm_board::read(kind)).await }).await
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

/// The calls of a CRM card's people; `None` when the CRM's CLI is too old to name them.
#[tauri::command]
pub async fn clients_calls(
    kind: CrmKind,
    reference: String,
    via: crm_board::CrmVia,
) -> Result<Option<Vec<crate::calls::ClientCall>>, AppError> {
    crate::log::command("clients_calls", async move { attempt(move || crm_board::calls(kind, &reference, &via)).await })
        .await
}

/// One call, in the tool that recorded it, as the profile the owner chose; the transcript only when it has one.
#[tauri::command]
pub async fn call_open(
    tool: String,
    profile: String,
    meeting: u32,
    transcript: bool,
) -> Result<crate::calls::CallOpened, AppError> {
    crate::log::command("call_open", async move {
        attempt(move || crate::calls::open(&tool, &profile, meeting, transcript)).await
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
pub async fn clients_map_suggest(kind: CrmKind) -> Result<crm_board::CrmSuggested, AppError> {
    crate::log::command("clients_map_suggest", async move { attempt(move || crm_board::suggest(kind)).await }).await
}

#[tauri::command]
pub async fn clients_base_edit(kind: CrmKind, edit: crm_board::CrmBaseEdit) -> Result<(), AppError> {
    crate::log::command("clients_base_edit", async move { attempt(move || crm_board::edit_base(kind, &edit)).await })
        .await
}
