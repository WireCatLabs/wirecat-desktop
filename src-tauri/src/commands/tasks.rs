use super::{attempt, known_tool};
use crate::error::AppError;
use crate::{task_board, tasks};

#[tauri::command]
pub async fn task_claims(id: String, profile: String) -> Result<tasks::Claims, AppError> {
    crate::log::command("task_claims", async move {
        let tool = known_tool(&id)?;
        attempt(move || tasks::claims(tool, &profile)).await
    })
    .await
}

#[tauri::command]
pub async fn task_release(id: String, profile: String, task: String) -> Result<(), AppError> {
    crate::log::command("task_release", async move {
        let tool = known_tool(&id)?;
        attempt(move || tasks::release(tool, &profile, &task)).await
    })
    .await
}

#[tauri::command]
pub async fn task_list(query: String) -> Result<task_board::Read, AppError> {
    crate::log::command("task_list", async move { attempt(move || task_board::list(&query)).await }).await
}

#[tauri::command]
pub async fn task_chats() -> Result<task_board::ChatTasks, AppError> {
    crate::log::command("task_chats", async move { attempt(task_board::chats).await }).await
}

#[tauri::command]
pub async fn task_counts(query: String) -> Result<task_board::Counts, AppError> {
    crate::log::command("task_counts", async move { attempt(move || task_board::counts(&query)).await }).await
}

#[tauri::command]
pub async fn task_show(key: String) -> Result<task_board::Task, AppError> {
    crate::log::command("task_show", async move { attempt(move || task_board::show(&key)).await }).await
}

#[tauri::command]
pub async fn task_history(key: String) -> Result<Vec<task_board::Event>, AppError> {
    crate::log::command("task_history", async move { attempt(move || task_board::history(&key)).await }).await
}

#[tauri::command]
pub async fn task_create(task: task_board::New) -> Result<task_board::Write, AppError> {
    crate::log::command("task_create", async move { attempt(move || task_board::create(&task)).await }).await
}

#[tauri::command]
pub async fn task_update(key: String, revision: u64, edit: task_board::Edit) -> Result<task_board::Write, AppError> {
    crate::log::command("task_update", async move { attempt(move || task_board::update(&key, revision, &edit)).await })
        .await
}

#[tauri::command]
pub async fn task_move(key: String, revision: u64, place: task_board::Place) -> Result<task_board::Write, AppError> {
    crate::log::command(
        "task_move",
        async move { attempt(move || task_board::move_task(&key, revision, &place)).await },
    )
    .await
}

#[tauri::command]
pub async fn task_assign(
    key: String,
    revision: u64,
    person: Option<String>,
    account: Option<String>,
) -> Result<task_board::Write, AppError> {
    crate::log::command("task_assign", async move {
        attempt(move || task_board::assign(&key, revision, person.as_deref(), account.as_deref())).await
    })
    .await
}

#[tauri::command]
pub async fn task_comments(key: String) -> Result<Vec<task_board::Comment>, AppError> {
    crate::log::command("task_comments", async move { attempt(move || task_board::comments(&key)).await }).await
}

#[tauri::command]
pub async fn task_comment_add(key: String, text: String) -> Result<task_board::Comment, AppError> {
    crate::log::command("task_comment_add", async move { attempt(move || task_board::comment_add(&key, &text)).await })
        .await
}

#[tauri::command]
pub async fn people_named(refs: Vec<String>) -> Result<Vec<task_board::Person>, AppError> {
    crate::log::command("people_named", async move { attempt(move || task_board::people_named(&refs)).await }).await
}

#[tauri::command]
pub async fn people_search(query: String) -> Result<Vec<task_board::Person>, AppError> {
    crate::log::command("people_search", async move { attempt(move || task_board::people_search(&query)).await }).await
}

#[tauri::command]
pub async fn person_add(name: String) -> Result<task_board::Person, AppError> {
    crate::log::command("person_add", async move { attempt(move || task_board::person_add(&name)).await }).await
}

#[tauri::command]
pub async fn project_list() -> Result<Vec<task_board::Project>, AppError> {
    crate::log::command("project_list", async move { attempt(task_board::projects).await }).await
}
