use super::attempt;
use crate::error::AppError;
use crate::organization_card;

/// A company's card: its people, its open deals and leads, and how many calls its people had.
#[tauri::command]
pub async fn organization_card(reference: String) -> Result<organization_card::OrganizationCard, AppError> {
    crate::log::command("organization_card", async move { attempt(move || organization_card::card(&reference)).await })
        .await
}
