use serde::ser::SerializeStruct;

/// What a command hands the interface when it fails: `{ kind, message }`. The message is the same text the command
/// returned before kinds existed; the kind lets the interface choose its own words later.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("unknown tool: {0}")]
    UnknownTool(String),
    #[error("not a valid profile name: {0}")]
    InvalidProfile(String),
    #[error("{0}")]
    NotInstalled(String),
    /// The same operation is already running; `Running` refused to start another.
    #[error("{0}")]
    Busy(String),
    /// The background task that ran the command panicked or was dropped.
    #[error("{0}")]
    Internal(String),
    /// The operation ran and reported a failure in its own words.
    #[error("{0}")]
    Failed(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::UnknownTool(_) => "unknown_tool",
            AppError::InvalidProfile(_) => "invalid_profile",
            AppError::NotInstalled(_) => "not_installed",
            AppError::Busy(_) => "busy",
            AppError::Internal(_) => "internal",
            AppError::Failed(_) => "failed",
        }
    }
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::Failed(message)
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        AppError::Failed(message.to_string())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("kind", self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

#[cfg(test)]
mod tests {
    use super::AppError;
    use serde_json::json;

    fn wire(e: &AppError) -> serde_json::Value {
        serde_json::to_value(e).unwrap()
    }

    #[test]
    fn every_kind_reaches_the_interface_with_its_old_message() {
        let cases = [
            (AppError::UnknownTool("zz".into()), "unknown_tool", "unknown tool: zz"),
            (AppError::InvalidProfile("-x".into()), "invalid_profile", "not a valid profile name: -x"),
            (AppError::NotInstalled("the tool is not installed".into()), "not_installed", "the tool is not installed"),
            (AppError::Busy("The download is already running.".into()), "busy", "The download is already running."),
            (AppError::Internal("task panicked".into()), "internal", "task panicked"),
            (AppError::Failed("store is locked".into()), "failed", "store is locked"),
        ];
        for (error, kind, message) in cases {
            assert_eq!(wire(&error), json!({ "kind": kind, "message": message }));
        }
    }

    #[test]
    fn a_plain_message_from_a_module_is_a_failure() {
        assert_eq!(AppError::from("no store yet".to_string()).kind(), "failed");
        assert_eq!(AppError::from("no store yet").to_string(), "no store yet");
    }
}
