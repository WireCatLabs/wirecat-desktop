//! The two editors on the Digests page: the owner's brief (what the morning digest collects, `memo digest brief`) and
//! the digest's templates (how it looks, `memo templates`). Every read and write is memo's own command; Desktop runs
//! as the owner, so memo takes the writes it refuses to an agent. Text goes to memo on stdin, never as an argument or a
//! file. The brief, the templates and the preview are the owner's own words and his digest; they leave Rust unmasked,
//! like the digest itself, and are never logged.

use crate::catalog::Tool;
use crate::skills::{body, call, call_with_input, failure};
use crate::{redact, tools};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const KEY: &str = "report/morning-digest";
const CHANNELS: [&str; 3] = ["telegram", "email", "text"];
const LOCALES: [&str; 2] = ["ru", "en"];
/// memo's own limits are far below this (4 000 characters for the brief); this only keeps a stray paste off the pipe.
const MAX_TEXT: usize = 64 * 1024;
const CALL: Duration = Duration::from_secs(30);

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum Brief {
    NoMemo,
    /// This memo has no `digest brief` yet.
    Unsupported,
    /// `body` is `None` when the owner wrote none; `history` counts the bodies an undo can put back.
    #[serde(rename_all = "camelCase")]
    Ready {
        body: Option<String>,
        chars: u64,
        limit: u64,
        updated_at: Option<String>,
        updated_by: Option<String>,
        history: u64,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum DigestTemplate {
    NoMemo,
    /// This memo has no `templates` yet.
    Unsupported,
    /// `stored` is the owner's own template; otherwise the one memo ships.
    #[serde(rename_all = "camelCase")]
    Ready {
        body: String,
        stored: bool,
        updated_at: Option<String>,
        updated_by: Option<String>,
        history: u64,
    },
}

/// What memo would send on a channel; `sample` when there is no real digest yet to render.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplatePreview {
    pub text: String,
    pub problems: Vec<String>,
    pub template_failed: bool,
    pub sample: bool,
}

fn words(list: &[&str]) -> Vec<String> {
    list.iter().map(|w| (*w).to_string()).collect()
}

fn memo() -> Result<Option<&'static Tool>, String> {
    let memo = crate::catalog::tool("memo")?;
    Ok((!tools::detect(memo, false).installs.is_empty()).then_some(memo))
}

/// A memo from before the command answers with a usage error naming it.
fn unknown_command(json: Option<&Value>, names: &[&str]) -> bool {
    json.and_then(|v| v["error"]["message"].as_str())
        .is_some_and(|m| names.iter().any(|n| m.starts_with(&format!("unknown command '{n}'"))))
}

fn text_of(v: &Value) -> Option<String> {
    v.as_str().map(str::to_string)
}

fn checked_text(text: &str) -> Result<(), String> {
    if text.len() > MAX_TEXT {
        return Err(format!("the text is over {} KB", MAX_TEXT / 1024));
    }
    Ok(())
}

const BRIEF_COMMANDS: [&str; 2] = ["digest", "brief"];

fn read_brief(v: &Value) -> Brief {
    let b = body(v);
    Brief::Ready {
        body: text_of(&b["body"]),
        chars: b["chars"].as_u64().unwrap_or(0),
        limit: b["limit"].as_u64().unwrap_or(4000),
        updated_at: text_of(&b["updated_at"]),
        updated_by: text_of(&b["updated_by"]),
        history: b["history"].as_array().map_or(0, |h| h.len() as u64),
    }
}

pub fn brief() -> Result<Brief, String> {
    let Some(memo) = memo()? else { return Ok(Brief::NoMemo) };
    let (out, json) = call(memo, &words(&["digest", "brief", "show", "--json"]), CALL)?;
    if unknown_command(json.as_ref(), &BRIEF_COMMANDS) {
        return Ok(Brief::Unsupported);
    }
    match json {
        Some(v) if out.code == Some(0) => Ok(read_brief(&v)),
        j => Err(failure(&out, j.as_ref())),
    }
}

/// A write, then the brief as memo now has it. memo's refusal (too long, empty, not the owner) is the error, in its
/// own words.
fn brief_change(args: &[&str], input: Option<&str>) -> Result<Brief, String> {
    let Some(memo) = memo()? else { return Ok(Brief::NoMemo) };
    let args = words(args);
    let (out, json) = match input {
        Some(text) => call_with_input(memo, &args, text, CALL)?,
        None => call(memo, &args, CALL)?,
    };
    if unknown_command(json.as_ref(), &BRIEF_COMMANDS) {
        return Ok(Brief::Unsupported);
    }
    if out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    brief()
}

pub fn brief_save(text: &str) -> Result<Brief, String> {
    checked_text(text)?;
    brief_change(&["digest", "brief", "edit", "--file", "-", "--json"], Some(text))
}

pub fn brief_undo() -> Result<Brief, String> {
    brief_change(&["digest", "brief", "edit", "--undo", "--json"], None)
}

pub fn brief_reset() -> Result<Brief, String> {
    brief_change(&["digest", "brief", "reset", "--json"], None)
}

const TEMPLATE_COMMANDS: [&str; 1] = ["templates"];

/// `templates <verb> report/morning-digest --channel <c> --locale <l>`, the channel and language checked.
fn template_args(verb: &str, channel: &str, locale: &str) -> Result<Vec<String>, String> {
    if !CHANNELS.contains(&channel) {
        return Err(format!("not a channel memo has: {}", redact::text(channel)));
    }
    if !LOCALES.contains(&locale) {
        return Err(format!("not a language the digest has: {}", redact::text(locale)));
    }
    Ok(words(&["templates", verb, KEY, "--channel", channel, "--locale", locale]))
}

/// memo's `templates` reads `--file` as a path and has no `-` for stdin yet; `/dev/stdin` is that path on Linux and
/// macOS. Windows has none, so there a draft cannot reach memo without a file.
#[cfg(unix)]
const STDIN_PATH: Option<&str> = Some("/dev/stdin");
#[cfg(not(unix))]
const STDIN_PATH: Option<&str> = None;

fn stdin_path() -> Result<&'static str, String> {
    STDIN_PATH.ok_or_else(|| {
        "On Windows memo cannot take a template from WireCat yet. Use memo templates edit in a terminal.".to_string()
    })
}

fn read_template(v: &Value) -> DigestTemplate {
    let b = body(v);
    DigestTemplate::Ready {
        body: text_of(&b["body"]).unwrap_or_default(),
        stored: b["source"].as_str() == Some("stored"),
        updated_at: text_of(&b["updated_at"]),
        updated_by: text_of(&b["updated_by"]),
        history: b["history"].as_array().map_or(0, |h| h.len() as u64),
    }
}

pub fn template(channel: &str, locale: &str) -> Result<DigestTemplate, String> {
    let args = with_json(template_args("show", channel, locale)?);
    let Some(memo) = memo()? else { return Ok(DigestTemplate::NoMemo) };
    let (out, json) = call(memo, &args, CALL)?;
    if unknown_command(json.as_ref(), &TEMPLATE_COMMANDS) {
        return Ok(DigestTemplate::Unsupported);
    }
    match json {
        Some(v) if out.code == Some(0) => Ok(read_template(&v)),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn with_json(mut args: Vec<String>) -> Vec<String> {
    args.push("--json".into());
    args
}

fn template_change(
    channel: &str,
    locale: &str,
    args: Vec<String>,
    input: Option<&str>,
) -> Result<DigestTemplate, String> {
    let Some(memo) = memo()? else { return Ok(DigestTemplate::NoMemo) };
    let (out, json) = match input {
        Some(text) => call_with_input(memo, &args, text, CALL)?,
        None => call(memo, &args, CALL)?,
    };
    if unknown_command(json.as_ref(), &TEMPLATE_COMMANDS) {
        return Ok(DigestTemplate::Unsupported);
    }
    if out.code != Some(0) {
        return Err(failure(&out, json.as_ref()));
    }
    template(channel, locale)
}

/// memo checks the template against the last real digest and a sample before it stores it, and says why it did not.
pub fn template_save(channel: &str, locale: &str, text: &str) -> Result<DigestTemplate, String> {
    checked_text(text)?;
    let mut args = template_args("edit", channel, locale)?;
    args.extend(["--file".into(), stdin_path()?.into()]);
    template_change(channel, locale, with_json(args), Some(text))
}

pub fn template_undo(channel: &str, locale: &str) -> Result<DigestTemplate, String> {
    let mut args = template_args("edit", channel, locale)?;
    args.push("--undo".into());
    template_change(channel, locale, with_json(args), None)
}

pub fn template_reset(channel: &str, locale: &str) -> Result<DigestTemplate, String> {
    let args = with_json(template_args("reset", channel, locale)?);
    template_change(channel, locale, args, None)
}

fn read_preview(v: &Value) -> TemplatePreview {
    let b = body(v);
    TemplatePreview {
        text: text_of(&b["text"]).unwrap_or_default(),
        problems: b["problems"].as_array().into_iter().flatten().filter_map(Value::as_str).map(redact::text).collect(),
        template_failed: b["template_failed"].as_bool().unwrap_or(false),
        sample: b["against"].as_str() == Some("sample"),
    }
}

/// What memo would send with `draft`, or with the template that applies when there is none; saves nothing.
pub fn template_preview(channel: &str, locale: &str, draft: Option<&str>) -> Result<TemplatePreview, String> {
    let mut args = template_args("preview", channel, locale)?;
    if let Some(text) = draft {
        checked_text(text)?;
        args.extend(["--file".into(), stdin_path()?.into()]);
    }
    let args = with_json(args);
    let memo = memo()?.ok_or("Memo is not installed")?;
    let (out, json) = match draft {
        Some(text) => call_with_input(memo, &args, text, CALL)?,
        None => call(memo, &args, CALL)?,
    };
    match json {
        Some(v) if out.code == Some(0) => Ok(read_preview(&v)),
        j => Err(failure(&out, j.as_ref())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_brief_and_counts_what_undo_can_put_back() {
        let v = json!({"item": {"body": "Only HRB and the warehouse.", "chars": 27, "limit": 4000,
            "updated_at": "2026-11-09T08:00:00.000Z", "updated_by": "memo",
            "history": [{"saved_at": "x", "saved_by": "memo", "replaced_at": "y", "chars": 12}]}});
        assert_eq!(
            read_brief(&v),
            Brief::Ready {
                body: Some("Only HRB and the warehouse.".into()),
                chars: 27,
                limit: 4000,
                updated_at: Some("2026-11-09T08:00:00.000Z".into()),
                updated_by: Some("memo".into()),
                history: 1,
            }
        );
        let none = json!({"item": {"body": null, "chars": 0, "limit": 4000, "updated_at": null, "updated_by": null,
            "history": []}});
        assert!(matches!(read_brief(&none), Brief::Ready { body: None, history: 0, .. }));
    }

    #[test]
    fn an_older_memo_is_unsupported_and_other_refusals_are_not() {
        let old = json!({"error": {"code": "validation_error", "message": "unknown command 'brief'"}});
        assert!(unknown_command(Some(&old), &BRIEF_COMMANDS));
        let refused = json!({"error": {"code": "permission_error", "reason": "brief.owner-only",
            "message": "only the owner changes the digest brief, not an agent"}});
        assert!(!unknown_command(Some(&refused), &BRIEF_COMMANDS));
        assert!(unknown_command(
            Some(&json!({"error": {"message": "unknown command 'templates'"}})),
            &TEMPLATE_COMMANDS
        ));
    }

    #[test]
    fn template_commands_take_only_the_digest_key_and_known_channels_and_languages() {
        assert_eq!(
            template_args("show", "telegram", "ru").unwrap().join(" "),
            "templates show report/morning-digest --channel telegram --locale ru"
        );
        assert!(template_args("show", "sms", "ru").is_err());
        assert!(template_args("show", "text", "--file").is_err());
        assert!(template_args("show", "text", "es").is_err());
    }

    #[test]
    fn reads_a_template_and_its_preview() {
        let v = json!({"item": {"key": KEY, "channel": "text", "language": "en", "source": "stored",
            "body": "{{ summary }}", "updated_at": "2026-11-09T08:00:00.000Z", "updated_by": "memo", "history": [{}, {}]}});
        assert_eq!(
            read_template(&v),
            DigestTemplate::Ready {
                body: "{{ summary }}".into(),
                stored: true,
                updated_at: Some("2026-11-09T08:00:00.000Z".into()),
                updated_by: Some("memo".into()),
                history: 2,
            }
        );
        let p = json!({"item": {"template": "/dev/stdin", "against": "sample", "template_failed": true,
            "problems": ["it does not render: output \"{{ nope \" not closed, line:1, col:1"], "text": "Digest"}});
        let preview = read_preview(&p);
        assert!(preview.sample && preview.template_failed);
        assert_eq!(preview.problems.len(), 1);
        assert!(!read_preview(&json!({"item": {"against": "/x/runs/1.report.json", "text": "x"}})).sample);
    }

    #[test]
    fn refuses_a_text_too_big_for_the_pipe() {
        assert!(checked_text(&"x".repeat(MAX_TEXT + 1)).is_err());
        assert!(checked_text("Only HRB.").is_ok());
    }

    #[test]
    fn the_answer_has_the_shape_the_interface_reads() {
        assert_eq!(serde_json::to_value(Brief::Unsupported).unwrap(), json!({"state": "unsupported"}));
        let ready =
            DigestTemplate::Ready { body: "x".into(), stored: false, updated_at: None, updated_by: None, history: 0 };
        assert_eq!(
            serde_json::to_value(ready).unwrap(),
            json!({"state": "ready", "body": "x", "stored": false, "updatedAt": null, "updatedBy": null, "history": 0})
        );
    }
}
