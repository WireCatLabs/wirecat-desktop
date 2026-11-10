pub mod agents;
pub mod app;
pub mod clients;
pub mod cloudflare;
pub mod community;
pub mod enrichment;
pub mod groups;
pub mod mcp_server;
pub mod memory;
pub mod node;
pub mod notes_setup;
pub mod own_tools;
pub mod people;
pub mod person_profile;
pub mod records;
pub mod search;
pub mod search_harder;
pub mod settings;
pub mod setup_extras;
pub mod signin;
pub mod storage;
pub mod store;
pub mod sync;
pub mod tailscale;
pub mod tasks;
pub mod tools;

use crate::catalog::{self, Tool};
use crate::error::AppError;

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, AppError> {
    let span = tracing::Span::current();
    tauri::async_runtime::spawn_blocking(move || span.in_scope(f)).await.map_err(|e| AppError::Internal(e.to_string()))
}

async fn attempt<T: Send + 'static, E: Into<AppError> + Send + 'static>(
    f: impl FnOnce() -> Result<T, E> + Send + 'static,
) -> Result<T, AppError> {
    blocking(f).await?.map_err(Into::into)
}

fn known_tool(id: &str) -> Result<&'static Tool, AppError> {
    catalog::tool(id).map_err(|_| AppError::UnknownTool(id.to_string()))
}

fn valid_profile(profile: &str) -> Result<(), AppError> {
    catalog::validate_profile(profile).map_err(|_| AppError::InvalidProfile(profile.to_string()))
}

#[cfg(test)]
mod tests {
    use crate::error::AppError;
    use tauri::async_runtime::block_on;

    fn kind<T>(result: Result<T, AppError>) -> &'static str {
        result.err().expect("the command should fail").kind()
    }

    #[test]
    fn an_unknown_tool_id_gives_unknown_tool() {
        assert_eq!(kind(block_on(super::tools::list_profiles("no-such-tool".into()))), "unknown_tool");
        assert_eq!(kind(block_on(super::mcp_server::mcp_server_status("no-such-tool".into()))), "unknown_tool");
        assert_eq!(kind(super::signin::sign_in_answer("no-such-tool".into(), "1234".into())), "unknown_tool");
    }

    #[test]
    fn a_profile_that_is_not_a_plain_name_gives_invalid_profile() {
        let id = crate::catalog::catalog().tools[0].id.clone();
        assert_eq!(kind(block_on(super::tools::background_status(id, "--all".into()))), "invalid_profile");
    }

    #[test]
    fn a_failure_the_operation_reports_keeps_its_words() {
        let err = block_on(super::attempt(|| Err::<(), _>("store is locked".to_string()))).unwrap_err();
        assert_eq!((err.kind(), err.to_string().as_str()), ("failed", "store is locked"));
    }
}
