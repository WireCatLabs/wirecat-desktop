use super::blocking;
use crate::{catalog, task_board, tasks};

#[tauri::command]
pub async fn task_claims(id: String, profile: String) -> Result<tasks::Claims, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tasks::claims(tool, &profile)).await?
}

#[tauri::command]
pub async fn task_release(id: String, profile: String, task: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tasks::release(tool, &profile, &task)).await?
}

#[tauri::command]
pub async fn task_list(query: String) -> Result<task_board::Read, String> {
    blocking(move || task_board::list(&query)).await?
}

#[tauri::command]
pub async fn task_counts(query: String) -> Result<task_board::Counts, String> {
    blocking(move || task_board::counts(&query)).await?
}

#[tauri::command]
pub async fn task_show(key: String) -> Result<task_board::Task, String> {
    blocking(move || task_board::show(&key)).await?
}

#[tauri::command]
pub async fn task_history(key: String) -> Result<Vec<task_board::Event>, String> {
    blocking(move || task_board::history(&key)).await?
}

#[tauri::command]
pub async fn task_create(task: task_board::New) -> Result<task_board::Write, String> {
    blocking(move || task_board::create(&task)).await?
}

#[tauri::command]
pub async fn task_update(key: String, revision: u64, edit: task_board::Edit) -> Result<task_board::Write, String> {
    blocking(move || task_board::update(&key, revision, &edit)).await?
}

#[tauri::command]
pub async fn task_move(key: String, revision: u64, place: task_board::Place) -> Result<task_board::Write, String> {
    blocking(move || task_board::move_task(&key, revision, &place)).await?
}

#[tauri::command]
pub async fn task_assign(key: String, revision: u64, person: Option<String>) -> Result<task_board::Write, String> {
    blocking(move || task_board::assign(&key, revision, person.as_deref())).await?
}

#[tauri::command]
pub async fn task_comments(key: String) -> Result<Vec<task_board::Comment>, String> {
    blocking(move || task_board::comments(&key)).await?
}

#[tauri::command]
pub async fn task_comment_add(key: String, text: String) -> Result<task_board::Comment, String> {
    blocking(move || task_board::comment_add(&key, &text)).await?
}

#[tauri::command]
pub async fn people_list() -> Result<Vec<task_board::Person>, String> {
    blocking(task_board::people).await?
}

#[tauri::command]
pub async fn person_add(name: String) -> Result<task_board::Person, String> {
    blocking(move || task_board::person_add(&name)).await?
}

#[tauri::command]
pub async fn project_list() -> Result<Vec<task_board::Project>, String> {
    blocking(task_board::projects).await?
}
