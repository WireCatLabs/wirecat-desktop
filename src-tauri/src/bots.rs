use crate::catalog::{self, Tool};
use crate::paths;
use crate::redact;
use crate::run::{self, Output};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;

/// `auth set` asks the messenger whose token it is before it keeps it; a slow network fits inside.
const CHECK_TIMEOUT: Duration = Duration::from_secs(90);
const SETTING_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_TOKEN: usize = 4096;

pub type Token = zeroize::Zeroizing<String>;

/// The catalog's `bot` block. `create` and `docs` are links for the interface only.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotSource {
    /// `<profile> bot auth set`: it reads the token from stdin to its end when stdin is not a terminal.
    pub set: Vec<String>,
    /// `bot list` names every bot on this computer.
    pub list: Vec<String>,
    /// `bot list --check` asks the messenger who each token belongs to.
    pub check: Vec<String>,
    /// `<profile> bot auth remove` forgets the token on this computer; the bot itself stays with the messenger.
    pub remove: Vec<String>,
    /// The tool's first version whose `bot list` takes no profile word; an older one is asked to update.
    pub list_min_version: String,
    pub token: TokenShape,
    /// Settings `auth set` needs before it can check the token (`WhatsApp`'s `phone_number_id`), set with the tool's
    /// own `config set --bot`.
    #[serde(default)]
    pub fields: Vec<BotField>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TokenShape {
    /// `<bot id>:<key>`, as `@BotFather` gives it.
    Telegram,
    /// MAX and Meta document no shape: one line without spaces.
    Opaque,
}

#[derive(Debug, Deserialize)]
pub struct BotField {
    pub key: String,
    pub words: Vec<String>,
}

#[derive(specta::Type, Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum BotResult {
    /// The bot's own public name and username, as the messenger reported them; never the token.
    Connected {
        name: Option<String>,
        username: Option<String>,
    },
    Failed {
        message: String,
        code: Option<String>,
        reason: Option<String>,
    },
}

#[derive(specta::Type, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BotProfile {
    pub name: String,
    /// Where the token comes from: `keyring`, `file` or `env`.
    pub source: Option<String>,
    /// The bot's username or name as the messenger reported it; only from a check.
    pub bot: Option<String>,
    /// The error code the messenger's answer ended in; only from a check.
    pub problem: Option<String>,
}

/// A tool too old for the bot commands: the interface offers the update.
pub const NEEDS_UPDATE: &str = "needs_update";

fn source(tool: &Tool) -> Result<&BotSource, String> {
    tool.bot.as_ref().ok_or_else(|| format!("{} has no bot sign-in in the app", tool.name))
}

/// The refusals never repeat the token: they may reach the window's error list.
pub fn validate_token(shape: TokenShape, token: &str) -> Result<(), String> {
    if token.is_empty() {
        return Err("Paste the bot token first.".into());
    }
    if token.len() > MAX_TOKEN || token.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("A bot token is one line without spaces.".into());
    }
    let ok = match shape {
        TokenShape::Telegram => token.split_once(':').is_some_and(|(id, key)| {
            !id.is_empty()
                && id.bytes().all(|b| b.is_ascii_digit())
                && key.len() >= 30
                && key.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
        }),
        TokenShape::Opaque => token.len() >= 16 && token.is_ascii(),
    };
    if ok { Ok(()) } else { Err("This does not look like a bot token.".into()) }
}

/// Meta's ids are digits, and the tool takes them as a JSON string: `"100000000000001"`.
fn validate_field(value: &str) -> Result<(), String> {
    if !value.is_empty() && value.len() <= 32 && value.bytes().all(|b| b.is_ascii_digit()) {
        Ok(())
    } else {
        Err("An id from Meta is digits only.".into())
    }
}

pub fn set_args(tool: &Tool, profile: &str) -> Result<Vec<String>, String> {
    catalog::with_profile(&source(tool)?.set, Some(profile))
}

/// Every catalog field's `config set` words, in catalog order; a field the catalog does not name is refused.
pub fn field_args(tool: &Tool, profile: &str, values: &BTreeMap<String, String>) -> Result<Vec<Vec<String>>, String> {
    let fields = &source(tool)?.fields;
    if let Some(unknown) = values.keys().find(|k| !fields.iter().any(|f| &f.key == *k)) {
        return Err(format!("{} has no bot setting {unknown}", tool.name));
    }
    fields
        .iter()
        .map(|field| {
            let value = values.get(&field.key).map(|v| v.trim()).unwrap_or_default();
            validate_field(value).map_err(|e| format!("{}: {e}", field.key))?;
            catalog::with_profile(&field.words, Some(profile)).map(|words| {
                words.into_iter().map(|w| if w == "{value}" { format!("\"{value}\"") } else { w }).collect()
            })
        })
        .collect()
}

/// Sets the fields, then hands the token to `auth set` on stdin, which checks it with the messenger before keeping
/// it. The token is never an argument (the process list shows those) and never in an answer.
pub fn connect(
    tool: &Tool,
    profile: &str,
    token: &Token,
    fields: &BTreeMap<String, String>,
) -> Result<BotResult, String> {
    let shape = source(tool)?.token;
    let token = token.trim();
    validate_token(shape, token)?;
    // A reconnect replaces only the token: the settings the bot was added with stay.
    let settings = if fields.is_empty() { Vec::new() } else { field_args(tool, profile, fields)? };
    let set = set_args(tool, profile)?;
    let Some(bin) = crate::tools::program(&tool.bin) else {
        return Ok(failed(format!("{} is not installed.", tool.name), None, None));
    };
    for words in &settings {
        let refs: Vec<&str> = words.iter().map(String::as_str).collect();
        match run::run(&bin, &refs, Some(&paths::search_path()), SETTING_TIMEOUT) {
            Ok(out) if out.code == Some(0) => {}
            Ok(out) => return Ok(failure(&tool.name, &out, token)),
            Err(e) => return Ok(failed(format!("Could not run {}: {e}.", tool.name), None, None)),
        }
    }
    Ok(check(&bin, &tool.name, &set, token))
}

fn check(bin: &Path, name: &str, args: &[String], token: &str) -> BotResult {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(bin, &refs, Some(&paths::search_path()));
    let (mut stdout, mut stderr) = (String::new(), String::new());
    let code = run::stream_with_input(
        cmd,
        Some(token.as_bytes()),
        CHECK_TIMEOUT,
        || false,
        |line| match line {
            run::Line::Out(l) => stdout.push_str(&(l + "\n")),
            run::Line::Err(l) => stderr.push_str(&(l + "\n")),
        },
    );
    match code {
        Ok(code) => answer(name, &Output { code, stdout, stderr }, token),
        Err(run::RunError::TimedOut) => failed(
            format!("{name} did not answer within {} seconds.", CHECK_TIMEOUT.as_secs()),
            Some("timeout".into()),
            None,
        ),
        Err(e) => failed(format!("Could not run {name}: {e}."), None, None),
    }
}

fn answer(name: &str, out: &Output, token: &str) -> BotResult {
    if out.code != Some(0) {
        return failure(name, out, token);
    }
    let item = out.json().map_or(Value::Null, |v| v["item"].clone());
    let text = |key: &str| item.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string);
    BotResult::Connected { name: text("bot"), username: text("username") }
}

/// The tool's own refusal, its code and reason for the interface's words, with the token masked first: masking
/// after `redact` could miss a token that `redact` had already cut in two.
fn failure(name: &str, out: &Output, token: &str) -> BotResult {
    let masked = |s: &str| redact::text(&mask(s, token));
    let all = format!("{}\n{}", out.stdout, out.stderr);
    if all.contains("unknown command") || all.contains("unknown option") {
        return failed(
            format!("This {name} cannot connect a bot from the app yet. Update it on the Tools page."),
            Some(NEEDS_UPDATE.into()),
            None,
        );
    }
    let json = out.json();
    let error = json.as_ref().map_or(&Value::Null, |v| &v["error"]);
    let field = |key: &str| error.get(key).and_then(Value::as_str).map(str::to_string);
    let message = field("message").unwrap_or_else(|| {
        let last = out.stderr.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or_default();
        if last.is_empty() { format!("{name} stopped with exit code {:?}.", out.code) } else { last.to_string() }
    });
    failed(masked(&message), field("code"), field("reason"))
}

fn mask(s: &str, token: &str) -> String {
    if token.is_empty() { s.to_string() } else { s.replace(token, "•••") }
}

fn failed(message: String, code: Option<String>, reason: Option<String>) -> BotResult {
    BotResult::Failed { message, code, reason }
}

/// Every name on this computer with a bot token, from the tool's own `bot list`; it asks the messenger nothing.
pub fn list(tool: &Tool) -> Result<Vec<BotProfile>, String> {
    read(tool, &source(tool)?.list, SETTING_TIMEOUT)
}

/// The same list after asking the messenger about each token; a bot it refuses carries `problem`.
pub fn check_all(tool: &Tool) -> Result<Vec<BotProfile>, String> {
    read(tool, &source(tool)?.check, CHECK_TIMEOUT)
}

fn read(tool: &Tool, words: &[String], timeout: Duration) -> Result<Vec<BotProfile>, String> {
    let bot = source(tool)?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    if crate::tools::older(crate::tools::version_of(&bin).as_deref(), &bot.list_min_version) {
        return Err(format!("needs {} {} or newer", tool.bin, bot.list_min_version));
    }
    let refs: Vec<&str> = words.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), timeout).map_err(|e| e.to_string())?;
    parse_list(&out)
}

pub fn remove_args(tool: &Tool, profile: &str) -> Result<Vec<String>, String> {
    catalog::with_profile(&source(tool)?.remove, Some(profile))
}

/// Forgets one bot's token through the tool's own `bot auth remove`.
pub fn remove(tool: &Tool, profile: &str) -> Result<(), String> {
    let words = remove_args(tool, profile)?;
    let bin = crate::tools::program(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = words.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), SETTING_TIMEOUT).map_err(|e| e.to_string())?;
    removal(&out)
}

fn removal(out: &Output) -> Result<(), String> {
    if out.code == Some(0) {
        return Ok(());
    }
    let refused = out.json().and_then(|v| v["error"]["message"].as_str().map(redact::text));
    Err(refused.unwrap_or_else(|| redact::text(out.stderr.lines().last().unwrap_or_default())))
}

fn parse_list(out: &Output) -> Result<Vec<BotProfile>, String> {
    let value = out.json().ok_or_else(|| redact::text(out.stderr.lines().last().unwrap_or_default()))?;
    if let Some(message) = value["error"]["message"].as_str() {
        return Err(redact::text(message));
    }
    Ok(value["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|row| {
            Some(BotProfile {
                name: row.get("name")?.as_str()?.to_string(),
                source: row.get("token").and_then(Value::as_str).map(str::to_string),
                bot: row.get("bot").and_then(Value::as_str).map(str::to_string),
                problem: row.get("problem").and_then(Value::as_str).map(str::to_string),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TG_TOKEN: &str = "12345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";

    fn out(code: i32, stdout: &str, stderr: &str) -> Output {
        Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn the_catalog_gives_tg_max_and_wa_a_bot_and_the_others_none() {
        for id in ["tg", "max", "wa"] {
            assert!(catalog::tool(id).unwrap().bot.is_some(), "{id}");
        }
        for id in ["zm", "drive", "memo"] {
            assert!(catalog::tool(id).unwrap().bot.is_none(), "{id}");
        }
    }

    #[test]
    fn auth_set_runs_for_the_profile_the_owner_named_and_records_the_run() {
        for id in ["tg", "max", "wa"] {
            let tool = catalog::tool(id).unwrap();
            assert_eq!(set_args(tool, "sales").unwrap(), ["sales", "bot", "auth", "set", "--record", "--json"]);
            for bad in ["", "--help", "a;rm -rf ~", "../x", ".hidden"] {
                assert!(set_args(tool, bad).is_err(), "{id} {bad}");
            }
        }
        assert!(set_args(catalog::tool("zm").unwrap(), "sales").is_err());
    }

    #[test]
    fn the_bot_list_reads_without_recording_and_names_no_profile_of_the_owner() {
        for id in ["tg", "max", "wa"] {
            let bot = catalog::tool(id).unwrap().bot.as_ref().unwrap();
            assert_eq!(bot.list, ["bot", "list", "--no-record", "--json"], "{id}");
            assert!(!bot.list_min_version.is_empty(), "{id}");
        }
    }

    #[test]
    fn the_check_asks_the_messenger_and_removal_names_the_bot_the_owner_chose() {
        for id in ["tg", "max", "wa"] {
            let tool = catalog::tool(id).unwrap();
            assert_eq!(tool.bot.as_ref().unwrap().check, ["bot", "list", "--check", "--no-record", "--json"], "{id}");
            assert_eq!(remove_args(tool, "sales").unwrap(), ["sales", "bot", "auth", "remove", "--record", "--json"]);
            for bad in ["", "--help", "a;rm -rf ~", "../x", ".hidden"] {
                assert!(remove_args(tool, bad).is_err(), "{id} {bad}");
            }
        }
    }

    #[test]
    fn a_checked_bot_says_who_it_is_or_what_the_messenger_answered() {
        let listed = parse_list(&out(
            0,
            r#"{"items":[{"name":"sales","token":"keyring","bot":"sales_bot","id":1},
                {"name":"old","token":"file","problem":"authentication_error"}]}"#,
            "",
        ))
        .unwrap();
        assert_eq!(listed[0].bot.as_deref(), Some("sales_bot"));
        assert_eq!(listed[0].problem, None);
        assert_eq!(listed[1].problem.as_deref(), Some("authentication_error"));
    }

    #[test]
    fn a_refused_removal_says_why_in_the_tools_words() {
        assert_eq!(removal(&out(0, r#"{"item":{"removed":["keyring"]}}"#, "")), Ok(()));
        assert_eq!(
            removal(&out(7, r#"{"error":{"message":"the keyring is locked"}}"#, "")),
            Err("the keyring is locked".to_string())
        );
    }

    #[test]
    fn whatsapps_ids_go_to_config_set_as_json_strings_and_nothing_else_passes() {
        let wa = catalog::tool("wa").unwrap();
        let values = BTreeMap::from([
            ("phone_number_id".to_string(), " 100000000000001 ".to_string()),
            ("waba_id".to_string(), "200000000000002".to_string()),
        ]);
        assert_eq!(
            field_args(wa, "shop", &values).unwrap(),
            [
                ["shop", "config", "set", "--bot", "phone_number_id", "\"100000000000001\"", "--json"],
                ["shop", "config", "set", "--bot", "waba_id", "\"200000000000002\"", "--json"],
            ]
        );
        let mut bad = values.clone();
        bad.insert("phone_number_id".into(), "1\" --x".into());
        assert!(field_args(wa, "shop", &bad).is_err());
        let mut missing = values.clone();
        missing.remove("waba_id");
        assert!(field_args(wa, "shop", &missing).is_err());
        let mut extra = values;
        extra.insert("permissions.send".into(), "1".into());
        assert!(field_args(wa, "shop", &extra).is_err());
        assert!(
            field_args(catalog::tool("tg").unwrap(), "sales", &BTreeMap::new()).unwrap().is_empty(),
            "tg takes no field"
        );
    }

    #[test]
    fn a_token_of_the_wrong_shape_is_refused_without_being_repeated() {
        assert!(validate_token(TokenShape::Telegram, TG_TOKEN).is_ok());
        assert!(validate_token(TokenShape::Opaque, "f9LHodD0cOKbEJgyW3NlrDqWsyUh0Gbk").is_ok());
        for (shape, bad) in [
            (TokenShape::Telegram, ""),
            (TokenShape::Telegram, "AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"),
            (TokenShape::Telegram, "12ab:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"),
            (TokenShape::Telegram, "123:short"),
            (TokenShape::Telegram, "123456789:AAHdqTcvCH1vGWJ xfSeofSAs0K5PALDsaw"),
            (TokenShape::Opaque, "short"),
            (TokenShape::Opaque, "f9LHodD0cOKbEJgyW3Nl\nrDqWsyUh0Gbk"),
        ] {
            let refused = validate_token(shape, bad).unwrap_err();
            assert!(bad.is_empty() || !refused.contains(bad), "{refused}");
        }
    }

    #[test]
    fn the_bots_name_comes_from_the_tools_answer() {
        let done = out(
            0,
            r#"{"item":{"profile":"sales","stored":"keyring","bot":"Helper","id":"9","username":"helper_bot"}}"#,
            "",
        );
        assert_eq!(
            answer("Telegram", &done, TG_TOKEN),
            BotResult::Connected { name: Some("Helper".into()), username: Some("helper_bot".into()) }
        );
        let business = out(0, r#"{"item":{"profile":"shop","bot":"Shop","id":"1","username":null}}"#, "");
        assert_eq!(
            answer("WhatsApp", &business, "x"),
            BotResult::Connected { name: Some("Shop".into()), username: None }
        );
    }

    #[test]
    fn a_refusal_keeps_the_tools_code_and_never_carries_the_token() {
        let refused = out(
            4,
            "",
            &format!(
                r#"{{"error":{{"code":"authentication_error","reason":"auth.failed","message":"Telegram did not accept {TG_TOKEN}"}}}}"#
            ),
        );
        let BotResult::Failed { message, code, reason } = answer("Telegram", &refused, TG_TOKEN) else {
            panic!("a refusal is a failure")
        };
        assert!(!message.contains(TG_TOKEN) && !message.contains("AAHdqTcv"), "{message}");
        assert_eq!(code.as_deref(), Some("authentication_error"));
        assert_eq!(reason.as_deref(), Some("auth.failed"));
    }

    #[test]
    fn a_tool_without_bot_commands_is_told_to_update() {
        let old = out(1, "", "error: unknown command 'bot'");
        assert!(matches!(answer("MAX", &old, "x"), BotResult::Failed { code: Some(c), .. } if c == NEEDS_UPDATE));
    }

    #[test]
    fn the_bot_list_names_each_bot_and_where_its_token_lives() {
        let listed =
            out(0, r#"{"items":[{"name":"sales","token":"keyring"},{"name":"ci","token":"env"},{"token":"x"}]}"#, "");
        assert_eq!(
            parse_list(&listed).unwrap(),
            [
                BotProfile { name: "sales".into(), source: Some("keyring".into()), bot: None, problem: None },
                BotProfile { name: "ci".into(), source: Some("env".into()), bot: None, problem: None },
            ]
        );
        assert!(parse_list(&out(2, "", r#"{"error":{"message":"no"}}"#)).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn the_token_reaches_the_tool_on_stdin_and_not_in_its_arguments() {
        let script =
            r#"read -r t || true; case "$*" in *AAHdq*) exit 9;; esac; printf '{"item":{"bot":"Len%s"}}\n' "${#t}""#;
        let args = ["-c".to_string(), script.to_string(), "sh".to_string(), "bot".to_string()];
        let result = check(Path::new("sh"), "Telegram", &args, TG_TOKEN);
        assert_eq!(result, BotResult::Connected { name: Some(format!("Len{}", TG_TOKEN.len())), username: None });
    }
}
