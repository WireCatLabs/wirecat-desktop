//! A CRM's own CLI (catalog `crm`; b24 for Bitrix24): the Clients board moves that CRM's cards and switches its sync
//! scope through it, as the profile memo's `writes_with` names or the owner chose. The program and its words come
//! from the catalog by the account's provider; memo's `tool` is only checked against the catalog, never run.

use super::{CrmAccount, CrmKind, CrmMovable, CrmPipeline, CrmWritesWith, invalid, validate_card, validate_stage};
use crate::catalog::{self, CrmSource, Tool};
use crate::memo_cli::{Call, Failure};
use crate::task_board::{self, Unusable};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use std::time::Duration;

const WRITE: Duration = Duration::from_secs(30);
const READ: Duration = Duration::from_secs(30);
const MAX_HOST: usize = 253;

/// The CRM account and the profile of its CLI that write a move; the owner chose the profile, or memo named the one.
#[derive(Deserialize, Type, Debug)]
pub struct CrmVia {
    pub account: CrmAccount,
    pub profile: String,
}

/// Whether the account's CRM CLI can write from the board, as `movable` says it to the page.
#[derive(Clone, Copy)]
pub(crate) enum Writer {
    Ready(&'static Tool),
    Missing,
    Old,
    /// No catalog tool writes this provider.
    None,
}

/// `scope` is the account's `crm.<provider>:<account>.scope`: what its next sync copies. `applied` is always `null`
/// here: what the last sync applied is in its own answer, which the board does not read.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrmScope {
    Settable {
        scope: String,
        applied: Option<()>,
    },
    /// `crmCli` (no CLI writes this CRM, or none releases the setting yet), `crmCliMissing`, `crmCliOld`, `profile`
    /// (no profile is chosen for the account).
    Unavailable {
        scope: Option<String>,
        applied: Option<()>,
        why: String,
    },
}

fn crm_tool(provider: &str) -> Option<(&'static Tool, &'static CrmSource)> {
    catalog::catalog().tools.iter().find_map(|t| t.crm.as_ref().filter(|c| c.provider == provider).map(|c| (t, c)))
}

pub(crate) fn writer(provider: &str) -> Writer {
    let Some((tool, crm)) = crm_tool(provider) else { return Writer::None };
    match task_board::unusable(tool, &crm.min_version) {
        None => Writer::Ready(tool),
        Some(Unusable::Missing) => Writer::Missing,
        Some(Unusable::Old { .. }) => Writer::Old,
    }
}

fn no(why: &str) -> CrmMovable {
    CrmMovable::No { why: why.into() }
}

/// An own pipeline moves through memo; a CRM's only when memo names the CLI that writes it and that CLI can.
pub(crate) fn movable(p: &CrmPipeline, writer: &dyn Fn(&str) -> Writer) -> CrmMovable {
    let Some(account) = &p.account else { return CrmMovable::Yes };
    let Some(w) = p.writes_with.as_ref().filter(|w| &w.account == account) else { return no("crmCli") };
    match writer(&account.provider) {
        Writer::Ready(tool) if tool.bin == w.tool => CrmMovable::Yes,
        Writer::Ready(_) | Writer::None => no("crmCli"),
        Writer::Missing => no("crmCliMissing"),
        Writer::Old => no("crmCliOld"),
    }
}

pub(crate) fn writes_with(v: &Value) -> Option<CrmWritesWith> {
    let w = v.get("writes_with").filter(|w| w.is_object())?;
    let text = |k: &str| w.get(k).and_then(Value::as_str).map(str::to_string);
    Some(CrmWritesWith {
        tool: text("tool")?,
        account: super::account(w)?,
        profile: text("profile"),
        profiles: w["profiles"]
            .as_array()
            .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_default(),
        why: text("why"),
    })
}

/// A CRM account's host as memo names it (`northstar.example`, `example.bitrix24.ru`): it goes into a setting's name.
pub fn validate_host(account: &str) -> Result<&str, String> {
    let ok = !account.is_empty()
        && account.len() <= MAX_HOST
        && !account.starts_with(['-', '.'])
        && account.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-'));
    if ok { Ok(account) } else { Err(format!("not a CRM account: {account}")) }
}

fn filled(template: &[String], slots: &[(&str, &str)]) -> Vec<String> {
    template
        .iter()
        .map(|w| slots.iter().find(|(slot, _)| w == slot).map_or_else(|| w.clone(), |(_, v)| (*v).to_string()))
        .collect()
}

fn ready(account: &CrmAccount) -> Result<(&'static Tool, &'static CrmSource), String> {
    let (tool, crm) = crm_tool(&account.provider).ok_or_else(|| format!("no tool here writes {}", account.provider))?;
    match task_board::unusable(tool, &crm.min_version) {
        None => Ok((tool, crm)),
        Some(Unusable::Missing) => Err(format!("{} is not installed", tool.name)),
        Some(Unusable::Old { need, .. }) => Err(format!("{} {need} or newer is needed", tool.name)),
    }
}

fn with_tool<T>(tool: &Tool, timeout: Duration, f: impl FnOnce(&Call) -> Result<T, Failure>) -> Result<T, String> {
    let bin = crate::tools::program(&tool.bin).ok_or_else(|| format!("{} is not installed", tool.name))?;
    f(&|args: &[String]| crate::memo_cli::spawn_at(&bin, args, timeout)).map_err(String::from)
}

/// The CLI writes the CRM, then its own copy in the shared store; the page reads the card again from memo.
pub(super) fn move_with(
    call: &Call,
    crm: &CrmSource,
    kind: CrmKind,
    reference: &str,
    stage: &str,
    profile: &str,
) -> Result<(), Failure> {
    catalog::validate_profile(profile).map_err(invalid)?;
    validate_card(kind, reference).map_err(invalid)?;
    validate_stage(stage).map_err(invalid)?;
    // The CLI takes the CRM's own stage id or a name; memo's `stage:<id>` would not be found in the CRM.
    if super::base::validate_stage_ref(stage).is_ok() {
        return Err(invalid(format!("a move names the card's own stage, not {stage}")));
    }
    let template = match kind {
        CrmKind::Deal => &crm.move_deal,
        CrmKind::Lead => &crm.move_lead,
    };
    call(&filled(template, &[("{profile}", profile), ("{ref}", reference), ("{stage}", stage)])).map(drop)
}

pub fn move_card(kind: CrmKind, reference: &str, stage: &str, via: &CrmVia) -> Result<(), String> {
    let (tool, crm) = ready(&via.account)?;
    with_tool(tool, WRITE, |call| move_with(call, crm, kind, reference, stage, &via.profile))
}

fn setting(crm: &CrmSource, account: &CrmAccount) -> Result<String, Failure> {
    validate_host(&account.account).map_err(invalid)?;
    Ok(format!("crm.{}:{}.scope", crm.provider, account.account))
}

/// cli-core lists a CRM account's settings among the store's; a scope never set is `mine`, the default.
pub(super) fn scope_with(
    call: &Call,
    crm: &CrmSource,
    account: &CrmAccount,
    profile: &str,
) -> Result<CrmScope, Failure> {
    catalog::validate_profile(profile).map_err(invalid)?;
    let key = setting(crm, account)?;
    let shown = call(&filled(&crm.scope.show, &[("{profile}", profile)]))?;
    let item = &shown["item"];
    let rows = item["store_settings"].as_array().into_iter().chain(item["settings"].as_array()).flatten();
    let value = rows.filter(|r| r["setting"].as_str() == Some(&key)).find_map(|r| r["value"].as_str());
    let scope = if value == Some("all") { "all" } else { "mine" };
    Ok(CrmScope::Settable { scope: scope.into(), applied: None })
}

pub(super) fn scope_set_with(
    call: &Call,
    crm: &CrmSource,
    account: &CrmAccount,
    profile: &str,
    scope: &str,
) -> Result<(), Failure> {
    catalog::validate_profile(profile).map_err(invalid)?;
    // The owner's ruling (2026-11-10): a CRM's sync never copies everyone's; `all` is read only to offer the way back.
    if scope != "mine" {
        return Err(invalid(format!("not a sync scope WireCat sets: {scope}")));
    }
    let key = setting(crm, account)?;
    call(&filled(&crm.scope.set, &[("{profile}", profile), ("{setting}", &key), ("{value}", scope)])).map(drop)
}

fn unavailable(why: &str) -> CrmScope {
    CrmScope::Unavailable { scope: None, applied: None, why: why.into() }
}

/// Settable only from the release with the setting (`crm.scope.minVersion`), and with a profile to run it as.
fn scope_gate(account: &CrmAccount) -> Result<(&'static Tool, &'static CrmSource), CrmScope> {
    let Some((tool, crm)) = crm_tool(&account.provider) else { return Err(unavailable("crmCli")) };
    let Some(need) = crm.scope.min_version.as_deref() else { return Err(unavailable("crmCli")) };
    match task_board::unusable(tool, need) {
        None => Ok((tool, crm)),
        Some(Unusable::Missing) => Err(unavailable("crmCliMissing")),
        Some(Unusable::Old { .. }) => Err(unavailable("crmCliOld")),
    }
}

pub fn scope(account: &CrmAccount, profile: Option<&str>) -> Result<CrmScope, String> {
    let (tool, crm) = match scope_gate(account) {
        Ok(found) => found,
        Err(scope) => return Ok(scope),
    };
    let Some(profile) = profile else { return Ok(unavailable("profile")) };
    with_tool(tool, READ, |call| scope_with(call, crm, account, profile))
}

pub fn scope_set(account: &CrmAccount, profile: &str, scope: &str) -> Result<(), String> {
    let (tool, crm) =
        scope_gate(account).map_err(|_| format!("WireCat cannot change {}'s sync scope", account.account))?;
    with_tool(tool, WRITE, |call| scope_set_with(call, crm, account, profile, scope))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn b24() -> &'static CrmSource {
        crm_tool("bitrix24").expect("the catalog has a CRM tool for bitrix24").1
    }

    fn northstar() -> CrmAccount {
        CrmAccount { provider: "bitrix24".into(), account: "northstar.example".into() }
    }

    fn recording<'a>(seen: &'a Mutex<Vec<String>>, answer: &'a Value) -> impl Fn(&[String]) -> Result<Value, Failure> {
        move |a| {
            seen.lock().unwrap().push(a.join(" "));
            Ok(answer.clone())
        }
    }

    fn pipeline(writes_with: Option<CrmWritesWith>) -> CrmPipeline {
        CrmPipeline {
            reference: "pipeline:7".into(),
            name: "Northstar sales".into(),
            account: Some(northstar()),
            open: 1,
            movable: no("crmCli"),
            writes_with,
        }
    }

    fn named(tool: &str) -> CrmWritesWith {
        CrmWritesWith {
            tool: tool.into(),
            account: northstar(),
            profile: Some("work".into()),
            profiles: vec!["work".into()],
            why: None,
        }
    }

    #[test]
    fn a_crm_pipeline_moves_only_when_memo_names_the_cli_and_that_cli_can_write() {
        let b24 = catalog::tool("bitrix").unwrap();
        let ready = |_: &str| Writer::Ready(b24);
        assert_eq!(movable(&pipeline(Some(named("b24"))), &ready), CrmMovable::Yes);
        assert_eq!(movable(&pipeline(None), &ready), no("crmCli"));
        assert_eq!(movable(&pipeline(Some(named("acme"))), &ready), no("crmCli"));
        assert_eq!(movable(&pipeline(Some(named("b24"))), &|_| Writer::Missing), no("crmCliMissing"));
        assert_eq!(movable(&pipeline(Some(named("b24"))), &|_| Writer::Old), no("crmCliOld"));
        assert_eq!(movable(&pipeline(Some(named("b24"))), &|_| Writer::None), no("crmCli"));
        let own = CrmPipeline { account: None, ..pipeline(None) };
        assert_eq!(movable(&own, &|_| Writer::None), CrmMovable::Yes);
    }

    #[test]
    fn reads_writes_with_and_leaves_the_profile_to_the_owner_when_memo_names_none() {
        let row = json!({"writes_with":{"tool":"b24","account":{"provider":"bitrix24","account":"northstar.example"},
            "profile":null,"profiles":["sales","work"],"why":"two b24 profiles are on this account; the owner chooses one"}});
        let w = writes_with(&row).unwrap();
        assert_eq!((w.profile, w.profiles.len()), (None, 2));
        assert!(w.why.unwrap().contains("the owner chooses"));
        assert!(writes_with(&json!({"writes_with": null})).is_none());
    }

    #[test]
    fn a_move_runs_the_crms_cli_as_the_chosen_profile_with_the_cards_own_stage() {
        let seen = Mutex::new(vec![]);
        let answer = json!({"operation_id":"op-1","deal":{}});
        move_with(&recording(&seen, &answer), b24(), CrmKind::Deal, "deal:12", "Invoice sent", "work").unwrap();
        move_with(&recording(&seen, &answer), b24(), CrmKind::Lead, "lead:3", "C2:NEW", "sales").unwrap();
        assert_eq!(
            *seen.lock().unwrap(),
            ["work deals move deal:12 Invoice sent --record --json", "sales leads move lead:3 C2:NEW --record --json"]
        );
    }

    #[test]
    fn a_refused_move_answers_the_clis_own_reason() {
        let refuse = |_: &[String]| -> Result<Value, Failure> {
            Err(Failure {
                reason: None,
                details: Value::Null,
                message: "deal:12 is not a deal of this CRM account".into(),
            })
        };
        let err = move_with(&refuse, b24(), CrmKind::Deal, "deal:12", "Quote", "work").unwrap_err();
        assert_eq!(err.message, "deal:12 is not a deal of this CRM account");
    }

    #[test]
    fn a_move_refuses_a_bad_profile_ref_or_memos_stage_ref_before_the_cli_runs() {
        let seen = Mutex::new(vec![]);
        let answer = json!({});
        let call = recording(&seen, &answer);
        assert!(move_with(&call, b24(), CrmKind::Deal, "deal:12", "Quote", "--all").is_err());
        assert!(move_with(&call, b24(), CrmKind::Deal, "lead:12", "Quote", "work").is_err());
        assert!(move_with(&call, b24(), CrmKind::Deal, "deal:12", "stage:3", "work").is_err());
        assert!(move_with(&call, b24(), CrmKind::Deal, "deal:12", "-x", "work").is_err());
        assert!(seen.lock().unwrap().is_empty());
    }

    #[test]
    fn the_scope_is_the_accounts_store_setting_and_mine_until_set() {
        let seen = Mutex::new(vec![]);
        let set = json!({"item":{"store_settings":[
            {"setting":"crm.bitrix24:other.example.scope","value":"mine"},
            {"setting":"crm.bitrix24:northstar.example.scope","value":"all"}]}});
        let read = scope_with(&recording(&seen, &set), b24(), &northstar(), "work").unwrap();
        assert_eq!(read, CrmScope::Settable { scope: "all".into(), applied: None });
        let unset = json!({"item":{"store_settings":[]}});
        let read = scope_with(&recording(&seen, &unset), b24(), &northstar(), "work").unwrap();
        assert_eq!(read, CrmScope::Settable { scope: "mine".into(), applied: None });
        assert_eq!(seen.lock().unwrap()[0], "work config show --no-record --json");
    }

    #[test]
    fn a_scope_switch_sets_the_accounts_setting_through_the_crms_cli() {
        let seen = Mutex::new(vec![]);
        let answer = json!({});
        scope_set_with(&recording(&seen, &answer), b24(), &northstar(), "work", "mine").unwrap();
        assert_eq!(
            *seen.lock().unwrap(),
            ["work config set crm.bitrix24:northstar.example.scope mine --record --json"]
        );
        let call = recording(&seen, &answer);
        assert!(scope_set_with(&call, b24(), &northstar(), "work", "all").is_err());
        assert!(scope_set_with(&call, b24(), &northstar(), "work", "everyone").is_err());
        let odd = CrmAccount { provider: "bitrix24".into(), account: "x.scope mine;".into() };
        assert!(scope_set_with(&call, b24(), &odd, "work", "mine").is_err());
        assert_eq!(seen.lock().unwrap().len(), 1);
    }

    #[test]
    fn the_scope_switch_needs_the_release_of_the_cli_that_has_the_setting() {
        assert_eq!(b24().scope.min_version.as_deref(), Some("0.12.0"));
        let elsewhere = CrmAccount { provider: "acme".into(), account: "acme.example".into() };
        assert_eq!(scope(&elsewhere, Some("work")).unwrap(), unavailable("crmCli"));
    }

    #[test]
    fn hosts_are_checked_before_they_name_a_setting() {
        assert!(validate_host("example.bitrix24.ru").is_ok());
        assert!(validate_host("Northstar.example").is_err());
        assert!(validate_host("-x").is_err());
        assert!(validate_host("a:b").is_err());
        assert!(validate_host("").is_err());
    }
}
