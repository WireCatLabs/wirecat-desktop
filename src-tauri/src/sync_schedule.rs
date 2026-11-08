//! A tool's sync on a timer, per account: the tool's own `<bin> <profile> schedule command <name> --every <d> --
//! <sync words>`, `schedule list` and `schedule remove`. The tool writes the schedule file and the timer; nothing here
//! does. The schedule is named `<bin>-<profile>`, the name mail's existing ones already carry (`mail-gmail`).

use crate::catalog::{self, Tool};
use crate::digest_schedule::{ScheduleRun, run_of};
use crate::skills::{call, failure};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleSource {
    // The catalog's `every`, the interval a new schedule starts with, is the interface's to offer.
    /// The intervals the page offers.
    pub choices: Vec<String>,
    /// The sync command the timer runs, without the profile: the profile comes from the schedule's environment.
    pub args: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum SyncSchedule {
    Off,
    /// `every`: `5m` when memo's words name one of the catalog's intervals, else `None` and `when` says it.
    #[serde(rename_all = "camelCase")]
    On {
        when: String,
        every: Option<String>,
        last: Option<Box<ScheduleRun>>,
    },
}

fn source(tool: &Tool) -> Result<&ScheduleSource, String> {
    tool.sync.as_ref().and_then(|s| s.schedule.as_ref()).ok_or_else(|| format!("{} has no sync schedule", tool.name))
}

/// `mail-gmail`. A schedule name is lowercase letters, digits and dashes; a profile name may hold more.
fn name_of(tool: &Tool, profile: &str) -> Result<String, String> {
    catalog::validate_profile(profile)?;
    let clean: String =
        profile.chars().map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' }).collect();
    Ok(format!("{}-{}", tool.bin, clean.trim_matches('-')))
}

/// memo's `every 5m`, `every 1h`, `every 90m`: the catalog's interval it is, if any.
fn every_of(src: &ScheduleSource, when: &str) -> Option<String> {
    let words = when.strip_prefix("every ")?;
    let minutes = |d: &str| -> Option<u64> {
        let (n, unit) = d.split_at(d.find(|c: char| !c.is_ascii_digit())?);
        let n: u64 = n.parse().ok()?;
        match unit {
            "m" => Some(n),
            "h" => Some(n * 60),
            "d" => Some(n * 1440),
            _ => None,
        }
    };
    let have = minutes(words)?;
    src.choices.iter().find(|c| minutes(c) == Some(have)).cloned()
}

fn read(src: &ScheduleSource, name: &str, v: &Value) -> SyncSchedule {
    let found = v["items"].as_array().into_iter().flatten().find(|i| i["name"].as_str() == Some(name));
    let Some(item) = found else { return SyncSchedule::Off };
    let when = item["when"].as_str().unwrap_or_default().to_string();
    SyncSchedule::On { every: every_of(src, &when), when, last: run_of(&item["last"]).map(Box::new) }
}

fn words(list: &[&str]) -> Vec<String> {
    list.iter().map(|w| (*w).to_string()).collect()
}

pub fn status(tool: &Tool, profile: &str) -> Result<SyncSchedule, String> {
    let src = source(tool)?;
    let name = name_of(tool, profile)?;
    let args = [vec![profile.to_string()], words(&["schedule", "list", "--json"])].concat();
    let (out, json) = call(tool, &args, Duration::from_secs(30))?;
    match json {
        Some(v) if out.code == Some(0) => Ok(read(src, &name, &v)),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn on_args(tool: &Tool, profile: &str, every: &str) -> Result<Vec<String>, String> {
    let src = source(tool)?;
    if !src.choices.iter().any(|c| c == every) {
        return Err(format!("not an interval {} offers: {every}", tool.name));
    }
    let name = name_of(tool, profile)?;
    let mut args = vec![profile.to_string()];
    args.extend(words(&["schedule", "command", &name, "--every", every, "--notify-on", "failures", "--json", "--"]));
    args.extend(src.args.iter().cloned());
    Ok(args)
}

/// `Some(every)` makes or replaces the schedule at that interval; `None` removes it (its past runs stay).
pub fn set(tool: &Tool, profile: &str, every: Option<&str>) -> Result<SyncSchedule, String> {
    let args = match every {
        Some(every) => on_args(tool, profile, every)?,
        None => {
            [vec![profile.to_string()], words(&["schedule", "remove", &name_of(tool, profile)?, "--json"])].concat()
        }
    };
    let (out, json) = call(tool, &args, Duration::from_mins(1))?;
    let gone = every.is_none() && json.as_ref().and_then(|v| v["error"]["code"].as_str()) == Some("not_found");
    if out.code != Some(0) && !gone {
        return Err(failure(&out, json.as_ref()));
    }
    status(tool, profile)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tool(id: &str) -> &'static Tool {
        catalog::tool(id).unwrap()
    }

    #[test]
    fn the_messengers_and_mail_sync_on_a_timer_with_their_own_schedule_command() {
        assert_eq!(
            on_args(tool("email"), "gmail", "5m").unwrap().join(" "),
            "gmail schedule command mail-gmail --every 5m --notify-on failures --json -- sync"
        );
        assert_eq!(
            on_args(tool("tg"), "personal", "1h").unwrap().join(" "),
            "personal schedule command tg-personal --every 1h --notify-on failures --json -- messages sync --all --timeout 50m"
        );
        assert!(on_args(tool("tg"), "personal", "1m").is_err());
        assert!(on_args(tool("tg"), "--all", "1h").is_err());
        assert!(source(tool("memo")).is_err());
    }

    #[test]
    fn a_schedule_name_is_what_the_tool_accepts() {
        assert_eq!(name_of(tool("email"), "Work_Mail").unwrap(), "mail-work-mail");
    }

    #[test]
    fn reads_the_profiles_schedule_with_its_latest_run_and_failing_streak() {
        let src = source(tool("email")).unwrap();
        let v = json!({"items": [
            {"name": "mail-gmail-test", "kind": "command", "when": "every 15m", "last": null},
            {"name": "mail-gmail", "kind": "command", "when": "every 5m", "last": {"at": "2026-11-08T22:26:00Z",
                "exit_code": 2, "output": "", "reason": "configuration_error", "failing_since": "2026-11-08T08:00:00Z",
                "failures": 40}}
        ]});
        let SyncSchedule::On { every, last: Some(last), .. } = read(src, "mail-gmail", &v) else { panic!() };
        assert_eq!(every.as_deref(), Some("5m"));
        assert_eq!(last.failing_since.as_deref(), Some("2026-11-08T08:00:00Z"));
        assert_eq!(read(src, "mail-ya", &v), SyncSchedule::Off);
        assert_eq!(every_of(src, "every 60m").as_deref(), Some("1h"));
        assert_eq!(every_of(src, "every 7m"), None);
        assert_eq!(every_of(src, "daily at 04:30"), None);
    }
}
