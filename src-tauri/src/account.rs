//! Removing one account through the tool's own commands (`accountRemove` in the catalog). A tool whose installed
//! version has cli-core's `account remove` signs the profile out and forgets it, keeping or deleting its data; an
//! older one only signs out with `session end`, which keeps everything else.

use crate::catalog::{self, Tool};
use crate::{paths, redact, skills};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// Signing out may reach the messenger's servers (tg's `logout`, max's LOGOUT, wa unlinking the device).
const END: Duration = Duration::from_mins(1);
/// The full removal signs out first, then may purge the account from the shared store.
const REMOVE: Duration = Duration::from_mins(2);
const PLAN: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountRemoveSource {
    /// `{profile} session end`: the sign-in on this computer goes; the account's data stays.
    pub sign_out: Option<Vec<String>>,
    /// cli-core's `account remove`; until the installed version has it, `sign_out` is the fallback.
    #[serde(default)]
    pub remove: Option<FullRemove>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullRemove {
    /// Null until the tool's release with `account remove` is known: the command counts as missing.
    pub min_version: Option<String>,
    pub keep_data: Vec<String>,
    pub delete_data: Vec<String>,
    pub dry_run: String,
    pub confirm: String,
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

/// What `account remove` answered: the plan of a dry run, what a confirmed run did, or why it did nothing.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum AccountRemoval {
    Answered {
        removal: Removal,
    },
    /// The installed version has no `account remove`: the dialog offers the sign-out instead.
    TooOld,
    /// `holder` says what holds the account when the app itself refused; `None` when the tool did.
    Refused {
        reason: RemovalRefusal,
        holder: Option<RemovalHolder>,
        message: String,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Removal {
    pub data: RemovalData,
    pub dry_run: bool,
    /// Whether the provider took the sign-in back; `None` when the tool does not revoke, or in a dry run.
    pub revoked: Option<bool>,
    pub config_file: Option<String>,
    pub removed: Vec<RemovalEntry>,
    pub kept: Vec<RemovalEntry>,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RemovalData {
    Kept,
    Deleted,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemovalEntry {
    pub kind: RemovalKind,
    /// A path with `~`, a keyring entry's name, a config key, or the tool's own words for a sign-in; for the store,
    /// only the provider, since the account's id says who it is.
    pub target: String,
    /// Only for what is kept: the tool's own reason, unless it stays because the owner chose `--keep-data`.
    pub reason: Option<String>,
    /// Kept only because the owner chose to keep the account's data; the dialog says so in its own words.
    pub chosen: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RemovalKind {
    SignIn,
    Keyring,
    Config,
    File,
    Store,
    Unit,
    Schedule,
}

/// cli-core's `account-remove.*` reasons, plus `failed` for anything else.
#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RemovalRefusal {
    Busy,
    UnknownProfile,
    NoChoice,
    PathOutside,
    FolderOutside,
    Unconfirmed,
    Failed,
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RemovalHolder {
    Sync,
    Install,
    SignIn,
}

/// The fallback for a tool without `account remove`: its own sign-out, which keeps the account's data and its name.
pub fn sign_out(tool: &Tool, profile: &str) -> Result<AccountRemoved, String> {
    let src = tool.account_remove.as_ref().ok_or_else(|| format!("{} cannot remove an account", tool.name))?;
    let words = src.sign_out.as_ref().ok_or_else(|| format!("{} cannot sign an account out", tool.name))?;
    let args = catalog::with_profile(words, Some(profile))?;
    let (out, json) = skills::call(tool, &args, END)?;
    if out.code != Some(0) {
        return Ok(AccountRemoved::Failed { message: skills::failure(&out, json.as_ref()) });
    }
    Ok(AccountRemoved::SignedOut { was_signed_in: json.as_ref().is_none_or(ended) })
}

/// Whether the installed version has `account remove`; a catalog without its version counts as no.
pub fn supported(tool: &Tool) -> bool {
    let Some(min) = full(tool).and_then(|r| r.min_version.as_deref()) else { return false };
    let Some(bin) = crate::tools::program(&tool.bin) else { return false };
    !crate::tools::older(crate::tools::version_of(&bin).as_deref(), min)
}

/// `--dry-run` with `plan`, `--yes` without: the dialog shows the plan, and only its confirm runs the real one.
pub fn remove(tool: &Tool, profile: &str, delete_data: bool, plan: bool) -> Result<AccountRemoval, String> {
    let Some(src) = full(tool).filter(|_| supported(tool)) else { return Ok(AccountRemoval::TooOld) };
    let args = words(src, profile, delete_data, plan)?;
    let (out, json) = skills::call(tool, &args, if plan { PLAN } else { REMOVE })?;
    Ok(answer(&out, json.as_ref()))
}

fn full(tool: &Tool) -> Option<&FullRemove> {
    tool.account_remove.as_ref()?.remove.as_ref()
}

fn words(src: &FullRemove, profile: &str, delete_data: bool, plan: bool) -> Result<Vec<String>, String> {
    let mut words = if delete_data { src.delete_data.clone() } else { src.keep_data.clone() };
    words.push(if plan { src.dry_run.clone() } else { src.confirm.clone() });
    catalog::with_profile(&words, Some(profile))
}

fn answer(out: &crate::run::Output, json: Option<&Value>) -> AccountRemoval {
    if out.code == Some(0) {
        return match json.and_then(|v| removal(skills::body(v))) {
            Some(removal) => AccountRemoval::Answered { removal },
            None => refused(
                RemovalRefusal::Failed,
                "The tool answered in a shape this version of WireCat does not read.".into(),
            ),
        };
    }
    let message = skills::failure(out, json);
    let error = json.map(|v| &v["error"]);
    let reason = error.and_then(|e| e["reason"].as_str().or_else(|| e["details"]["reason"].as_str()));
    let unknown = format!("{message}\n{}", out.stderr).to_lowercase();
    if unknown.contains("unknown command") || unknown.contains("unknown option") {
        return AccountRemoval::TooOld;
    }
    let refusal = match reason.unwrap_or_default() {
        "account-remove.busy" => RemovalRefusal::Busy,
        "account-remove.unknown-profile" => RemovalRefusal::UnknownProfile,
        "account-remove.no-choice" => RemovalRefusal::NoChoice,
        "account-remove.path-outside" => RemovalRefusal::PathOutside,
        "account-remove.folder-outside" => RemovalRefusal::FolderOutside,
        "account-remove.unconfirmed" => RemovalRefusal::Unconfirmed,
        _ if error.and_then(|e| e["code"].as_str()) == Some("conflict") => RemovalRefusal::Busy,
        _ => RemovalRefusal::Failed,
    };
    refused(refusal, message)
}

fn refused(reason: RemovalRefusal, message: String) -> AccountRemoval {
    AccountRemoval::Refused { reason, holder: None, message }
}

fn removal(v: &Value) -> Option<Removal> {
    let data = match v["data"].as_str()? {
        "kept" => RemovalData::Kept,
        "deleted" => RemovalData::Deleted,
        _ => return None,
    };
    let entries = |k: &str, kept: bool| -> Vec<RemovalEntry> {
        v[k].as_array().into_iter().flatten().filter_map(|e| entry(e, kept)).collect()
    };
    Some(Removal {
        data,
        dry_run: v["dry_run"].as_bool().unwrap_or(false),
        revoked: v["revoked"].as_bool(),
        config_file: v["config_file"].as_str().map(redact::text),
        removed: entries("removed", false),
        kept: entries("kept", true),
    })
}

fn entry(v: &Value, kept: bool) -> Option<RemovalEntry> {
    let kind = match v["kind"].as_str()? {
        "sign_in" => RemovalKind::SignIn,
        "keyring" => RemovalKind::Keyring,
        "config" => RemovalKind::Config,
        "file" => RemovalKind::File,
        "store" => RemovalKind::Store,
        "unit" => RemovalKind::Unit,
        "schedule" => RemovalKind::Schedule,
        _ => return None,
    };
    let target = v["target"].as_str()?;
    let target = match kind {
        RemovalKind::Store => target.split(':').next().unwrap_or_default().to_string(),
        RemovalKind::File | RemovalKind::Unit => redact::text(&paths::tilde(target)),
        _ => redact::text(target),
    };
    let reason = if kept { v["reason"].as_str() } else { None };
    let chosen = reason.is_some_and(|r| r.starts_with("--keep-data"));
    Some(RemovalEntry { kind, target, reason: reason.filter(|_| !chosen).map(redact::text), chosen })
}

/// tg and wa say `ended`, max `forgotten`, drive `signed_out`; a tool that says none of them did what it was asked.
fn ended(v: &Value) -> bool {
    let body = skills::body(v);
    ["ended", "forgotten", "signed_out"].iter().find_map(|k| body[*k].as_bool()).unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::Output;
    use serde_json::json;

    fn output(code: i32, v: &Value) -> Output {
        let (stdout, stderr) = if code == 0 { (v.to_string(), String::new()) } else { (String::new(), v.to_string()) };
        Output { code: Some(code), stdout, stderr }
    }

    fn answered(v: &Value) -> AccountRemoval {
        let out = output(i32::from(v.get("error").is_some()), v);
        answer(&out, out.json().as_ref())
    }

    #[test]
    fn reads_each_tools_word_for_a_sign_in_that_ended() {
        assert!(ended(&json!({"item": {"profile": "work", "ended": true}})));
        assert!(!ended(&json!({"item": {"profile": "work", "ended": false}})));
        assert!(!ended(&json!({"item": {"forgotten": false, "revoked_on_server": false}})));
        assert!(ended(&json!({"item": {"signed_out": true, "cached_data": "retained"}})));
        assert!(ended(&json!({"profile": "work"})), "an answer without the word still means it ran");
    }

    #[test]
    fn every_command_names_the_profile_and_is_recorded() {
        for t in &catalog::catalog().tools {
            let Some(src) = &t.account_remove else { continue };
            let full = src.remove.iter().flat_map(|r| [&r.keep_data, &r.delete_data]);
            for words in src.sign_out.iter().chain(full) {
                assert_eq!(words.first().map(String::as_str), Some("{profile}"), "{}", t.id);
                assert!(words.iter().any(|w| w == "--record"), "{}: {words:?}", t.id);
                assert!(words.iter().any(|w| w == "--json"), "{}: {words:?}", t.id);
            }
        }
    }

    #[test]
    fn keep_and_delete_differ_only_in_the_choice_and_a_dry_run_never_confirms() {
        let tg = catalog::tool("tg").unwrap();
        let src = full(tg).unwrap();
        assert_eq!(
            words(src, "work", false, true).unwrap(),
            ["work", "account", "remove", "--keep-data", "--record", "--json", "--dry-run"]
        );
        assert_eq!(
            words(src, "work", true, false).unwrap(),
            ["work", "account", "remove", "--delete-data", "--record", "--json", "--yes"]
        );
        assert!(words(src, "--help", false, true).is_err());
    }

    #[test]
    fn a_version_not_yet_released_counts_as_missing() {
        for t in &catalog::catalog().tools {
            if full(t).is_some_and(|r| r.min_version.is_none()) {
                assert!(!supported(t), "{}", t.id);
                assert_eq!(remove(t, "work", false, true).unwrap(), AccountRemoval::TooOld, "{}", t.id);
            }
        }
    }

    #[test]
    fn reads_the_plan_with_paths_short_and_the_account_id_left_out() {
        let home = paths::home().unwrap().to_string_lossy().into_owned();
        let got = answered(&json!({"item": {
            "profile": "personal", "data": "kept", "dry_run": true,
            "account": {"provider": "telegram", "account": "500"}, "revoked": null,
            "config_file": format!("{home}/.config/tg-cli/config.json"),
            "removed": [
                {"kind": "sign_in", "target": "the Telegram session"},
                {"kind": "keyring", "target": "app-keys:personal"},
                {"kind": "file", "target": format!("{home}/.local/state/tg-cli/accounts/personal.json")},
                {"kind": "something_new", "target": "x"}
            ],
            "kept": [
                {"kind": "store", "target": "telegram:500", "reason": "--keep-data: its messages stay in the store"},
                {"kind": "file", "target": "/tmp/sends/personal.jsonl", "reason": "the record of what was sent"}
            ]
        }}));
        let AccountRemoval::Answered { removal } = got else { panic!("{got:?}") };
        assert_eq!(removal.data, RemovalData::Kept);
        assert!(removal.dry_run);
        assert_eq!(removal.config_file.as_deref(), Some("~/.config/tg-cli/config.json"));
        let targets: Vec<_> = removal.removed.iter().map(|e| (e.kind, e.target.as_str())).collect();
        assert_eq!(
            targets,
            [
                (RemovalKind::SignIn, "the Telegram session"),
                (RemovalKind::Keyring, "app-keys:personal"),
                (RemovalKind::File, "~/.local/state/tg-cli/accounts/personal.json"),
            ]
        );
        assert_eq!(
            removal.kept,
            [
                RemovalEntry { kind: RemovalKind::Store, target: "telegram".into(), reason: None, chosen: true },
                RemovalEntry {
                    kind: RemovalKind::File,
                    target: "/tmp/sends/personal.jsonl".into(),
                    reason: Some("the record of what was sent".into()),
                    chosen: false,
                },
            ]
        );
    }

    #[test]
    fn maps_each_refusal_to_its_reason() {
        let error = |code: &str, reason: &str| json!({"error": {"code": code, "message": "`tg serve` is running for personal — stop it first", "reason": reason}});
        let cases = [
            ("conflict", "account-remove.busy", RemovalRefusal::Busy),
            ("not_found", "account-remove.unknown-profile", RemovalRefusal::UnknownProfile),
            ("validation_error", "account-remove.no-choice", RemovalRefusal::NoChoice),
            ("configuration_error", "account-remove.path-outside", RemovalRefusal::PathOutside),
            ("configuration_error", "account-remove.folder-outside", RemovalRefusal::FolderOutside),
            ("confirmation_required", "account-remove.unconfirmed", RemovalRefusal::Unconfirmed),
            ("conflict", "", RemovalRefusal::Busy),
            ("read_only", "", RemovalRefusal::Failed),
        ];
        for (code, reason, want) in cases {
            let AccountRemoval::Refused { reason: got, holder, message } = answered(&error(code, reason)) else {
                panic!("{code} {reason}")
            };
            assert_eq!(got, want, "{code} {reason}");
            assert_eq!(holder, None);
            assert!(message.starts_with("`tg serve` is running"), "{message}");
        }
    }

    #[test]
    fn a_version_without_the_command_is_too_old_and_secrets_in_a_refusal_are_masked() {
        let old = json!({"error": {"code": "usage_error", "message": "unknown command 'account'"}});
        assert_eq!(answered(&old), AccountRemoval::TooOld);
        let leaky = json!({"error": {"code": "internal", "message": "failed for owner@example.org"}});
        let AccountRemoval::Refused { message, .. } = answered(&leaky) else { panic!() };
        assert_eq!(message, "failed for [email]");
    }

    #[test]
    fn refuses_what_the_catalog_does_not_offer() {
        let tg = catalog::tool("tg").unwrap();
        assert!(sign_out(tg, "--help").is_err());
        assert!(sign_out(catalog::tool("zm").unwrap(), "personal").is_err(), "zm has no sign-out");
        assert!(sign_out(catalog::tool("memo").unwrap(), "personal").is_err());
    }
}
