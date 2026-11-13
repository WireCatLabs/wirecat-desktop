//! One mailbox's rules, read only: mail-cli's own `rules list` (which mail is stored whole, as an envelope or
//! skipped, the tags it gets, whether it is protected or saved as a meeting's notes). Addresses and domains in a rule
//! are the owner's data: they reach the window and nothing else, never a log.

use crate::catalog::{self, Tool};
use crate::skills;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const LIST: Duration = Duration::from_secs(30);
const MAX_PAGE: u32 = 100;
const TOO_OLD: &str = "This version cannot list mail rules yet. Update it on the Tools page.";

#[derive(Debug, Deserialize)]
pub struct MailRulesSource {
    /// `{profile}` is the account the owner opened.
    pub list: Vec<String>,
}

/// One condition of a rule; every condition must hold. `value` is the CLI's value as text (`365`, `true`).
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
pub struct RuleCondition {
    pub key: String,
    pub value: String,
}

/// How many emails an envelope rule has recorded, and their size at the source.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
pub struct RuleRecorded {
    pub emails: u64,
    pub bytes: u64,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MailRule {
    pub id: Option<u32>,
    pub conditions: Vec<RuleCondition>,
    /// `keep`, `envelope` or `skip`.
    pub action: String,
    pub tags: Vec<String>,
    pub reason: Option<String>,
    pub protected: bool,
    /// The meetings provider whose notes these emails are, such as `telemost`.
    pub meeting_notes: Option<String>,
    /// `owner`, `preset:<kind>`, `probe` or `gmail-filter`; `None` for a rule the owner added by hand.
    pub source: Option<String>,
    pub decided_at: String,
    pub recorded: Option<RuleRecorded>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum MailRules {
    /// One page of the rules in the CLI's order (protected first); `total` counts them all.
    Listed {
        rules: Vec<MailRule>,
        total: u32,
    },
    Failed {
        message: String,
        code: Option<String>,
        reason: Option<String>,
    },
}

fn source(tool: &Tool) -> Result<&MailRulesSource, String> {
    tool.mail_rules.as_ref().ok_or_else(|| format!("{} has no mail rules", tool.name))
}

/// mail-cli answers every rule at once (its `rules list` takes no `--limit` or `--page`), so the page is cut here
/// and the window still receives one page.
pub fn list(tool: &Tool, profile: &str, page: u32, limit: u32) -> Result<MailRules, String> {
    let src = source(tool)?;
    if page == 0 || !(1..=MAX_PAGE).contains(&limit) {
        return Err("That page of mail rules does not exist.".into());
    }
    let argv = catalog::with_profile(&src.list, Some(profile))?;
    let (out, json) = skills::call(tool, &argv, LIST)?;
    if let Some(json) = json.as_ref().filter(|_| out.code == Some(0)) {
        return Ok(read(json, page, limit));
    }
    let (message, code, reason) = skills::refusal(&out, json.as_ref(), TOO_OLD);
    Ok(MailRules::Failed { message, code, reason })
}

fn read(json: &Value, page: u32, limit: u32) -> MailRules {
    let body = skills::body(json);
    let rules: Vec<MailRule> = json["items"]
        .as_array()
        .or_else(|| body["items"].as_array())
        .into_iter()
        .flatten()
        .filter_map(rule_of)
        .collect();
    let total = u32::try_from(rules.len()).unwrap_or(u32::MAX);
    let skip = usize::try_from((page - 1).saturating_mul(limit)).unwrap_or(usize::MAX);
    let take = usize::try_from(limit).unwrap_or(usize::MAX);
    MailRules::Listed { rules: rules.into_iter().skip(skip).take(take).collect(), total }
}

fn rule_of(v: &Value) -> Option<MailRule> {
    let text = |k: &str| v[k].as_str().map(str::to_string);
    let conditions = v["match"]
        .as_object()?
        .iter()
        .filter(|(_, value)| !value.is_null())
        .map(|(key, value)| RuleCondition {
            key: key.clone(),
            value: value.as_str().map_or_else(|| value.to_string(), str::to_string),
        })
        .collect();
    Some(MailRule {
        id: v["id"].as_u64().and_then(|id| u32::try_from(id).ok()),
        conditions,
        action: text("action")?,
        tags: v["tags"].as_array().into_iter().flatten().filter_map(|t| t.as_str().map(str::to_string)).collect(),
        reason: text("reason"),
        protected: v["protected"].as_bool().unwrap_or(false),
        meeting_notes: text("meeting_notes"),
        source: text("source"),
        decided_at: text("decided_at").unwrap_or_default(),
        recorded: v["recorded"].as_object().map(|r| RuleRecorded {
            emails: r.get("emails").and_then(Value::as_u64).unwrap_or(0),
            bytes: r.get("bytes").and_then(Value::as_u64).unwrap_or(0),
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn answer() -> Value {
        serde_json::json!({
            "items": [
                { "id": 3, "match": { "from": "boss@example.com" }, "action": "keep", "protected": true,
                  "reason": "never lose these", "decided_at": "2026-11-01T09:00:00.000Z" },
                { "id": 1, "match": { "from": "keeper@telemost.example.test" }, "action": "keep",
                  "meeting_notes": "telemost", "source": "owner", "decided_at": "2026-11-13T08:00:00.000Z" },
                { "id": 2, "match": { "domain": "shop.example", "older_than_days": 365, "bulk": true },
                  "action": "envelope", "tags": ["promo"], "decided_at": "2026-10-02T10:00:00.000Z",
                  "recorded": { "emails": 120, "bytes": 5_242_880 } },
                { "match": { "preset": "social" }, "action": "skip", "source": "preset:social",
                  "decided_at": "2026-09-01T10:00:00.000Z" },
                { "match": { "from": "no-action@example.com" }, "decided_at": "2026-09-01T10:00:00.000Z" },
            ],
            "page": { "limit": 5, "has_more": false }
        })
    }

    #[test]
    fn reads_every_rule_in_the_cli_order_with_its_conditions_and_flags() {
        let MailRules::Listed { rules, total } = read(&answer(), 1, 25) else { panic!("not listed") };
        assert_eq!(total, 4, "a rule without an action is left out");
        assert!(rules[0].protected);
        assert_eq!(rules[1].meeting_notes.as_deref(), Some("telemost"));
        assert_eq!(rules[1].source.as_deref(), Some("owner"));
        let mut conditions = rules[2].conditions.clone();
        conditions.sort_by(|a, b| a.key.cmp(&b.key));
        assert_eq!(
            conditions,
            vec![
                RuleCondition { key: "bulk".into(), value: "true".into() },
                RuleCondition { key: "domain".into(), value: "shop.example".into() },
                RuleCondition { key: "older_than_days".into(), value: "365".into() },
            ]
        );
        assert_eq!(rules[2].recorded, Some(RuleRecorded { emails: 120, bytes: 5_242_880 }));
        assert_eq!(rules[2].tags, vec!["promo".to_string()]);
        assert_eq!((rules[3].id, rules[3].source.as_deref()), (None, Some("preset:social")));
        assert_eq!(rules[3].meeting_notes, None);
    }

    #[test]
    fn cuts_one_page_and_counts_them_all() {
        let MailRules::Listed { rules, total } = read(&answer(), 2, 3) else { panic!("not listed") };
        assert_eq!((rules.len(), total), (1, 4));
        let nested = serde_json::json!({ "item": { "items": [] } });
        assert_eq!(read(&nested, 1, 25), MailRules::Listed { rules: vec![], total: 0 });
    }

    #[test]
    fn refuses_a_tool_without_rules_a_bad_profile_and_a_page_that_cannot_exist() {
        let email = catalog::tool("email").unwrap();
        assert!(list(catalog::tool("tg").unwrap(), "personal", 1, 25).is_err());
        assert!(list(email, "--help", 1, 25).is_err());
        assert!(list(email, "personal", 0, 25).is_err());
        assert!(list(email, "personal", 1, 0).is_err());
        assert!(list(email, "personal", 1, MAX_PAGE + 1).is_err());
        assert_eq!(source(email).unwrap().list, ["{profile}", "rules", "list", "--no-record", "--json"]);
    }
}
