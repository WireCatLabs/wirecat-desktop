//! Removing one account through the tool's own commands (`accountRemove` in the catalog). Today every CLI only signs
//! the profile out; none deletes one account's data, so `delete_data` is refused until a tool names a command for it.

use crate::catalog::{self, Tool};
use crate::skills;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// Signing out may reach the messenger's servers (tg's `logout`, max's LOGOUT, wa unlinking the device).
const END: Duration = Duration::from_mins(1);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountRemoveSource {
    /// `{profile} session end`: the sign-in on this computer goes; the account's data stays.
    pub sign_out: Option<Vec<String>>,
    /// A command that also deletes the account's data; no CLI has one yet.
    #[serde(default)]
    pub delete_data: Option<Vec<String>>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum AccountRemoved {
    /// `was_signed_in` is false when the tool found no sign-in to end.
    #[serde(rename_all = "camelCase")]
    SignedOut {
        was_signed_in: bool,
    },
    Failed {
        message: String,
    },
}

pub fn remove(tool: &Tool, profile: &str, delete_data: bool) -> Result<AccountRemoved, String> {
    let src = tool.account_remove.as_ref().ok_or_else(|| format!("{} cannot remove an account", tool.name))?;
    let words = if delete_data {
        src.delete_data.as_ref().ok_or_else(|| format!("{} cannot delete an account's data", tool.name))?
    } else {
        src.sign_out.as_ref().ok_or_else(|| format!("{} cannot sign an account out", tool.name))?
    };
    let args = catalog::with_profile(words, Some(profile))?;
    let (out, json) = skills::call(tool, &args, END)?;
    if out.code != Some(0) {
        return Ok(AccountRemoved::Failed { message: skills::failure(&out, json.as_ref()) });
    }
    Ok(AccountRemoved::SignedOut { was_signed_in: json.as_ref().is_none_or(ended) })
}

/// tg and wa say `ended`, max `forgotten`, drive `signed_out`; a tool that says none of them did what it was asked.
fn ended(v: &Value) -> bool {
    let body = skills::body(v);
    ["ended", "forgotten", "signed_out"].iter().find_map(|k| body[*k].as_bool()).unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_each_tools_word_for_a_sign_in_that_ended() {
        assert!(ended(&json!({"item": {"profile": "work", "ended": true}})));
        assert!(!ended(&json!({"item": {"profile": "work", "ended": false}})));
        assert!(!ended(&json!({"item": {"forgotten": false, "revoked_on_server": false}})));
        assert!(ended(&json!({"item": {"signed_out": true, "cached_data": "retained"}})));
        assert!(ended(&json!({"profile": "work"})), "an answer without the word still means it ran");
    }

    #[test]
    fn every_sign_out_names_the_profile_and_is_recorded() {
        for t in &catalog::catalog().tools {
            let Some(src) = &t.account_remove else { continue };
            for words in [&src.sign_out, &src.delete_data].into_iter().flatten() {
                assert_eq!(words.first().map(String::as_str), Some("{profile}"), "{}", t.id);
                assert!(words.iter().any(|w| w == "--record"), "{}: {words:?}", t.id);
            }
        }
    }

    #[test]
    fn refuses_what_the_catalog_does_not_offer() {
        let tg = catalog::tool("tg").unwrap();
        assert!(remove(tg, "work", true).is_err(), "no CLI deletes one account's data yet");
        assert!(remove(tg, "--help", false).is_err());
        assert!(remove(catalog::tool("zm").unwrap(), "personal", false).is_err(), "zm has no sign-out");
    }
}
