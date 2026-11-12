//! What the owner makes in the Zoom App Marketplace before zm can sign in: zm's own `app --json` lists the app's type,
//! the redirect URL and the scopes, so the window shows what the installed version needs and not a copy that ages.

use crate::catalog::Tool;
use crate::{redact, skills};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const CALL: Duration = Duration::from_secs(30);

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZoomScope {
    pub scope: String,
    pub required: bool,
    pub purpose: String,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZoomAppSetup {
    pub marketplace_url: String,
    pub guide_url: String,
    pub app_type: String,
    pub management: String,
    pub oauth: String,
    pub redirect_url: String,
    pub allow_list: Vec<String>,
    pub scopes: Vec<ZoomScope>,
    pub config_key: String,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum ZoomAppAnswer {
    Ready {
        setup: ZoomAppSetup,
    },
    /// The installed zm has no `app` command; the window uses its built-in list.
    Old,
    Failed {
        message: String,
    },
}

pub fn setup(tool: &Tool) -> Result<ZoomAppAnswer, String> {
    let words = tool
        .sign_in
        .as_ref()
        .and_then(|s| s.app_setup.as_ref())
        .ok_or_else(|| format!("{} has no app to make first", tool.name))?;
    let (out, json) = skills::call(tool, words, CALL)?;
    if let Some(json) = json.as_ref().filter(|_| out.code == Some(0)) {
        return Ok(parse(json));
    }
    let message = skills::failure(&out, json.as_ref());
    let text = format!("{message}\n{}", out.stderr).to_lowercase();
    if crate::memo_cli::unknown_to_cli(&text) { Ok(ZoomAppAnswer::Old) } else { Ok(ZoomAppAnswer::Failed { message }) }
}

fn parse(json: &Value) -> ZoomAppAnswer {
    match read(&json["item"]) {
        Some(setup) => ZoomAppAnswer::Ready { setup },
        None => ZoomAppAnswer::Failed { message: "zm answered with an app description the app cannot read.".into() },
    }
}

fn read(item: &Value) -> Option<ZoomAppSetup> {
    let text = |k: &str| item[k].as_str().map(redact::text);
    let link = |k: &str| item[k].as_str().filter(|u| u.starts_with("https://")).map(str::to_string);
    let scopes = item["scopes"]
        .as_array()?
        .iter()
        .map(|s| {
            Some(ZoomScope {
                scope: s["scope"].as_str()?.to_string(),
                required: s["required"].as_bool()?,
                purpose: s["use"].as_str().map(redact::text).unwrap_or_default(),
            })
        })
        .collect::<Option<Vec<_>>>()?;
    Some(ZoomAppSetup {
        marketplace_url: link("marketplace_url")?,
        guide_url: link("guide_url")?,
        app_type: text("app_type")?,
        management: text("management")?,
        oauth: text("oauth")?,
        redirect_url: text("redirect_url")?,
        allow_list: item["allow_list"].as_array()?.iter().filter_map(|u| u.as_str().map(str::to_string)).collect(),
        scopes,
        config_key: text("config_key")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn answer(marketplace: &str) -> Value {
        serde_json::json!({ "item": {
            "marketplace_url": marketplace, "guide_url": "https://wirecat.dev/en/docs/zm/zoom-app",
            "app_type": "General app", "management": "User-managed", "oauth": "OAuth with PKCE",
            "redirect_url": "http://127.0.0.1:53682/callback", "allow_list": ["http://127.0.0.1:53682/callback"],
            "scopes": [{ "scope": "meeting:read", "required": true, "use": "list meetings" }],
            "config_key": "zoom.client_id"
        }})
    }

    #[test]
    fn reads_the_apps_description_and_keeps_only_https_links() {
        let ZoomAppAnswer::Ready { setup } = parse(&answer("https://marketplace.zoom.us/develop/create")) else {
            panic!("not ready");
        };
        assert_eq!(
            setup.scopes,
            [ZoomScope { scope: "meeting:read".into(), required: true, purpose: "list meetings".into() }]
        );
        assert_eq!(setup.allow_list.len(), 1);
        assert!(matches!(parse(&answer("javascript:alert(1)")), ZoomAppAnswer::Failed { .. }));
        assert!(matches!(parse(&serde_json::json!({ "item": {} })), ZoomAppAnswer::Failed { .. }));
    }
}
