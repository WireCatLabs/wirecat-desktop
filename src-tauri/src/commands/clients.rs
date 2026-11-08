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

#[tauri::command]
pub async fn clients_move(kind: CrmKind, reference: String, stage: String) -> Result<crm_board::CrmCard, AppError> {
    crate::log::command(
        "clients_move",
        async move { attempt(move || crm_board::move_card(kind, &reference, &stage)).await },
    )
    .await
}

#[tauri::command]
pub async fn clients_map_set(stage: String, base: String) -> Result<(), AppError> {
    crate::log::command("clients_map_set", async move { attempt(move || crm_board::map_stage(&stage, &base)).await })
        .await
}

#[tauri::command]
pub async fn clients_map_confirm(pipelines: Vec<String>) -> Result<(), AppError> {
    crate::log::command("clients_map_confirm", async move { attempt(move || crm_board::confirm(&pipelines)).await })
        .await
}

#[tauri::command]
pub async fn clients_base_edit(kind: CrmKind, edit: crm_board::CrmBaseEdit) -> Result<(), AppError> {
    crate::log::command("clients_base_edit", async move { attempt(move || crm_board::edit_base(kind, &edit)).await })
        .await
}
