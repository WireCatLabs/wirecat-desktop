use crate::{catalog, community, registry};

/// The community tools Rust accepted at start, so the interface lists exactly the tools Rust will run.
#[tauri::command]
pub fn extra_tools() -> community::Extra {
    catalog::catalog().extra.clone()
}

#[tauri::command]
pub fn community_status() -> registry::Status {
    registry::status()
}

/// Takes effect at the next start; turning it on fetches the list now, so that start has it.
#[tauri::command]
pub async fn set_community_shown(show: bool) -> Result<(), String> {
    registry::set_shown(show)?;
    if show {
        std::thread::spawn(registry::check_now);
    }
    Ok(())
}
