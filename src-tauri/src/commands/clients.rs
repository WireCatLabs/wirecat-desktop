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
