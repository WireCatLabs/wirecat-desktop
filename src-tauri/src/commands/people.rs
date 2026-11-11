use super::attempt;
use crate::error::AppError;
use crate::people;

/// `kind` is one of memo's kinds of people (`person` when absent); an older memo lists everyone.
#[tauri::command]
pub async fn people_read(kind: Option<String>) -> Result<people::Read, AppError> {
    crate::log::command("people_read", async move {
        attempt(move || people::read(kind.as_deref().unwrap_or("person"))).await
    })
    .await
}

/// One page of one kind of people; `query` looks for a name, `sort` is one of memo's orders.
#[tauri::command]
pub async fn people_page(
    kind: String,
    page: u32,
    size: u32,
    query: String,
    sort: String,
) -> Result<people::Page, AppError> {
    crate::log::command(
        "people_page",
        async move { attempt(move || people::page(&kind, page, size, &query, &sort)).await },
    )
    .await
}

#[tauri::command]
pub async fn people_kinds() -> Result<std::collections::BTreeMap<String, people::KindCount>, AppError> {
    crate::log::command("people_kinds", async move { attempt(people::kinds).await }).await
}

#[tauri::command]
pub async fn people_show(reference: String) -> Result<people::Person, AppError> {
    crate::log::command("people_show", async move { attempt(move || people::show(&reference)).await }).await
}

#[tauri::command]
pub async fn people_decide(
    reference: String,
    id: String,
    answer: people::Answer,
    reason: Option<String>,
) -> Result<people::Person, AppError> {
    crate::log::command("people_decide", async move {
        attempt(move || people::decide(&reference, &id, answer, reason.as_deref())).await
    })
    .await
}

/// Says the shared mailbox of one match is a company's: the two people stay apart.
#[tauri::command]
pub async fn people_resolve(
    reference: String,
    id: String,
    organization: Option<String>,
    name: Option<String>,
) -> Result<people::Resolved, AppError> {
    crate::log::command("people_resolve", async move {
        attempt(move || people::resolve(&reference, &id, organization.as_deref(), name.as_deref())).await
    })
    .await
}

/// Joins the people the owner chose from one group of matches into one person.
#[tauri::command]
pub async fn people_merge(references: Vec<String>) -> Result<people::Merged, AppError> {
    crate::log::command("people_merge", async move { attempt(move || people::join_group(&references)).await }).await
}

#[tauri::command]
pub async fn people_unlink(reference: String, identities: Vec<String>) -> Result<people::Unlinked, AppError> {
    crate::log::command("people_unlink", async move { attempt(move || people::unlink(&reference, &identities)).await })
        .await
}

#[tauri::command]
pub async fn people_unmerge(reference: String, merge: String) -> Result<people::Person, AppError> {
    crate::log::command("people_unmerge", async move { attempt(move || people::unmerge(&reference, &merge)).await })
        .await
}

/// The person who has exactly this account, for the page's search; `None` when no one does.
#[tauri::command]
pub async fn people_find(account: String) -> Result<Option<people::Person>, AppError> {
    crate::log::command("people_find", async move { attempt(move || people::find(&account)).await }).await
}

/// The owner's answer to a split an agent proposed on `reference`; a turn-down carries the owner's reason.
#[tauri::command]
pub async fn people_split_decide(
    reference: String,
    id: String,
    answer: people::Answer,
    reason: Option<String>,
) -> Result<people::Person, AppError> {
    crate::log::command("people_split_decide", async move {
        attempt(move || people::decide_split(&reference, &id, answer, reason.as_deref())).await
    })
    .await
}

/// The owner says a person's accounts in doubt belong together, with memo's `people links resolve keep`.
#[tauri::command]
pub async fn people_keep(reference: String) -> Result<people::Kept, AppError> {
    crate::log::command("people_keep", async move { attempt(move || people::keep(&reference)).await }).await
}

/// The owner says a person is test data, with memo's `people links resolve test`: memo hides them from every list.
#[tauri::command]
pub async fn people_test_data(reference: String) -> Result<(), AppError> {
    crate::log::command("people_test_data", async move { attempt(move || people::test_data(&reference)).await }).await
}

/// The people memo hides as test data, from memo's `people list kind:test`.
#[tauri::command]
pub async fn people_test_people() -> Result<people::TestPeople, AppError> {
    crate::log::command("people_test_people", async move { attempt(people::test_people).await }).await
}

/// The owner says a person writes from a company's shared mailbox, with memo's `relationships add --role contact`.
#[tauri::command]
pub async fn people_contact(reference: String, organization: String) -> Result<(), AppError> {
    crate::log::command(
        "people_contact",
        async move { attempt(move || people::contact(&reference, &organization)).await },
    )
    .await
}

/// One page of the people whose identities look wrongly joined, from memo's `people links check`.
#[tauri::command]
pub async fn people_doubts(page: u32, size: u32) -> Result<people::Doubts, AppError> {
    crate::log::command("people_doubts", async move { attempt(move || people::doubts(page, size)).await }).await
}
