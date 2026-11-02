use crate::catalog::{SearchField, Tool};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;

const MAX_REQUEST: usize = 500;
const MAX_ANSWER: usize = 300;
const CLAUDE_TIMEOUT: Duration = Duration::from_secs(45);
const CODEX_TIMEOUT: Duration = Duration::from_secs(90);
/// Codex runs read-only, but could still read the owner's files; the page tells him the app asks it not to.
const CODEX_FIRST: &str = "Answer from the text below only. Do not run any command and do not read any file.";
const SCHEMA: &str =
    r#"{"type":"object","properties":{"query":{"type":"string"}},"required":["query"],"additionalProperties":false}"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Writer {
    ClaudeCode,
    Codex,
}

impl Writer {
    fn program(self) -> &'static str {
        match self {
            Writer::ClaudeCode => "claude",
            Writer::Codex => "codex",
        }
    }
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Draft {
    Query {
        query: String,
        by: Writer,
    },
    /// Neither Claude Code nor Codex is on this computer; nothing was started.
    None,
    /// `reason` lets the page say it in the owner's language; `message` is the agent's own words for `other`.
    Failed {
        reason: &'static str,
        message: String,
        by: Writer,
    },
}

#[derive(Debug, PartialEq)]
enum Failure {
    SignedOut,
    TimedOut,
    /// The agent found nothing in the words to search for.
    Empty,
    Other(String),
}

impl Failure {
    fn reason(&self) -> &'static str {
        match self {
            Failure::SignedOut => "signed-out",
            Failure::TimedOut => "timed-out",
            Failure::Empty => "empty",
            Failure::Other(_) => "other",
        }
    }
}

/// The owner's words as one query for `tool`, written by his own Claude Code, or Codex when Claude Code is missing or
/// signed out. Only the words, the tool's keys and today's date reach the agent; never a message or a hit.
pub fn write(tool: &Tool, request: &str) -> Result<Draft, String> {
    let request = validate_request(request)?;
    let prompt = system_prompt(tool)?;
    let message = user_message(&request, chrono::Local::now().date_naive());
    let found: Vec<(Writer, PathBuf)> =
        [Writer::ClaudeCode, Writer::Codex].into_iter().filter_map(|w| Some((w, paths::find(w.program())?))).collect();
    Ok(first_answer(&found, |writer, program| match writer {
        Writer::ClaudeCode => ask_claude(program, &prompt, &message),
        Writer::Codex => ask_codex(program, &prompt, &message),
    }))
}

/// The next agent is asked only when this one is signed out: any other failure would most likely repeat, and the
/// owner would wait twice for it.
fn first_answer(found: &[(Writer, PathBuf)], mut ask: impl FnMut(Writer, &Path) -> Result<String, Failure>) -> Draft {
    let mut first: Option<(Writer, Failure)> = None;
    for (writer, program) in found {
        let writer = *writer;
        match ask(writer, program) {
            Ok(query) => return Draft::Query { query, by: writer },
            Err(failure) => {
                let signed_out = failure == Failure::SignedOut;
                first.get_or_insert((writer, failure));
                if !signed_out {
                    break;
                }
            }
        }
    }
    match first {
        None => Draft::None,
        Some((by, failure)) => Draft::Failed { reason: failure.reason(), message: describe(by, &failure), by },
    }
}

fn validate_request(request: &str) -> Result<String, String> {
    let words = request.split_whitespace().collect::<Vec<_>>().join(" ");
    if words.is_empty() || words.chars().count() > MAX_REQUEST || words.chars().any(char::is_control) {
        return Err(format!("describe what to find in 1 to {MAX_REQUEST} characters"));
    }
    Ok(words)
}

fn describe(by: Writer, failure: &Failure) -> String {
    match (by, failure) {
        (Writer::ClaudeCode, Failure::SignedOut) => {
            "it is not signed in. Run claude in a terminal once and sign in".into()
        }
        (Writer::Codex, Failure::SignedOut) => "it is not signed in. Run codex login in a terminal once".into(),
        (_, Failure::TimedOut) => "it did not answer in time".into(),
        (_, Failure::Empty) => "it found nothing to search for in these words".into(),
        (_, Failure::Other(why)) => why.clone(),
    }
}

pub fn claude_args(prompt: &str) -> Vec<&str> {
    vec![
        "-p",
        "--model",
        "haiku",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--output-format",
        "json",
        "--json-schema",
        SCHEMA,
        "--system-prompt",
        prompt,
    ]
}

fn ask_claude(program: &Path, prompt: &str, message: &str) -> Result<String, Failure> {
    let out = run_with_input(program, &claude_args(prompt), message, CLAUDE_TIMEOUT)?;
    read_claude(&out)
}

fn read_claude(out: &run::Output) -> Result<String, Failure> {
    let Some(json) = out.json() else {
        return Err(other(first_line(&out.stderr).unwrap_or("it gave no answer")));
    };
    let result = json["result"].as_str().unwrap_or_default();
    if json["is_error"].as_bool() == Some(true) || out.code != Some(0) {
        return Err(if signed_out(result) || signed_out(&out.stderr) {
            Failure::SignedOut
        } else {
            other(first_line(result).or_else(|| first_line(&out.stderr)).unwrap_or("it stopped with an error"))
        });
    }
    let query = json["structured_output"]["query"]
        .as_str()
        .map(str::to_owned)
        .or_else(|| serde_json::from_str::<Value>(result).ok()?["query"].as_str().map(str::to_owned))
        .unwrap_or_else(|| result.to_owned());
    validate_answer(&query)
}

/// Codex has no system prompt of its own: the rules go first in its prompt, the request after them on stdin. It runs
/// in an empty folder, read-only, without the owner's MCP servers and settings, and keeps no session.
pub fn codex_args<'a>(dir: &'a str, schema: &'a str, last: &'a str) -> Vec<&'a str> {
    vec![
        "exec",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--skip-git-repo-check",
        "--ignore-user-config",
        "--color",
        "never",
        "-C",
        dir,
        "--output-schema",
        schema,
        "-o",
        last,
        "-",
    ]
}

fn ask_codex(program: &Path, prompt: &str, message: &str) -> Result<String, Failure> {
    let dir = std::env::temp_dir().join(format!("wirecat-query-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| other(&e.to_string()))?;
    let schema = dir.join("schema.json");
    let last = dir.join("answer.txt");
    let answer = std::fs::write(&schema, SCHEMA).map_err(|e| other(&e.to_string())).and_then(|()| {
        let args = codex_args(dir.to_str().unwrap_or("."), schema.to_str().unwrap_or(""), last.to_str().unwrap_or(""));
        let out = run_with_input(program, &args, &format!("{CODEX_FIRST}\n\n{prompt}\n\n{message}"), CODEX_TIMEOUT)?;
        read_codex(&out, std::fs::read_to_string(&last).ok().as_deref())
    });
    let _ = std::fs::remove_dir_all(&dir);
    answer
}

fn read_codex(out: &run::Output, last: Option<&str>) -> Result<String, Failure> {
    let last = last.map(str::trim).filter(|s| !s.is_empty());
    let Some(last) = last.filter(|_| out.code == Some(0)) else {
        let said = format!("{}\n{}", out.stderr, out.stdout);
        return Err(if signed_out(&said) {
            Failure::SignedOut
        } else {
            other(
                said.lines()
                    .rev()
                    .map(str::trim)
                    .find(|l| l.starts_with("ERROR") || l.starts_with("Error"))
                    .or_else(|| first_line(&out.stderr))
                    .unwrap_or("it stopped with an error"),
            )
        });
    };
    let query = serde_json::from_str::<Value>(last)
        .ok()
        .and_then(|v| v["query"].as_str().map(str::to_owned))
        .unwrap_or_else(|| last.to_owned());
    validate_answer(&query)
}

fn signed_out(said: &str) -> bool {
    let s = said.to_lowercase();
    ["not logged in", "please run /login", "codex login", "not signed in", "invalid api key", "401 unauthorized"]
        .iter()
        .any(|m| s.contains(m))
}

fn other(why: &str) -> Failure {
    let why = redact::text(why.trim());
    Failure::Other(why.chars().take(200).collect())
}

fn first_line(s: &str) -> Option<&str> {
    s.lines().map(str::trim).find(|l| !l.is_empty())
}

/// One line the owner checks before searching. A model that wraps it in backticks or quotes the whole line still
/// meant the query inside.
fn validate_answer(answer: &str) -> Result<String, Failure> {
    let mut q = answer.trim();
    for wrap in ["```", "`"] {
        if let Some(inner) = q.strip_prefix(wrap).and_then(|s| s.strip_suffix(wrap)) {
            q = inner.trim();
        }
    }
    if q.is_empty() {
        return Err(Failure::Empty);
    }
    if q.contains('\n') || q.chars().any(char::is_control) {
        return Err(other("it answered with more than one line"));
    }
    if q.chars().count() > MAX_ANSWER {
        return Err(other("its query was too long"));
    }
    Ok(q.to_owned())
}

fn run_with_input(program: &Path, args: &[&str], input: &str, timeout: Duration) -> Result<run::Output, Failure> {
    let path = paths::search_path();
    let cmd = run::command(program, args, Some(&path));
    let (mut stdout, mut stderr) = (String::new(), String::new());
    let code = run::stream_with_input(
        cmd,
        Some(input.as_bytes()),
        timeout,
        || false,
        |line| match line {
            run::Line::Out(l) => {
                stdout.push_str(&l);
                stdout.push('\n');
            }
            run::Line::Err(l) => {
                stderr.push_str(&l);
                stderr.push('\n');
            }
        },
    )
    .map_err(|e| match e {
        run::RunError::TimedOut => Failure::TimedOut,
        e => other(&e.to_string()),
    })?;
    Ok(run::Output { code, stdout, stderr })
}

pub fn user_message(request: &str, today: chrono::NaiveDate) -> String {
    format!("Today is {} ({}).\nDescription: {request}", today.format("%Y-%m-%d"), today.format("%A"))
}

/// What each key means, where its example alone would leave the agent guessing.
fn meaning(what: &str, field: &str) -> &'static str {
    match (what, field) {
        ("mail", "from") => "the sender's name or address",
        ("mail", "to") => "a recipient's name or address",
        ("mail", "email") => "an address the mail was sent to or from",
        (_, "from") => "the person who sent it",
        (_, "chat") => "the chat or group it is in, by name",
        (_, "author") => "the person who wrote it",
        ("mail", "date") => "when it arrived",
        (_, "date") => "when it was sent or last changed",
        (_, "has") => "what it holds besides text",
        (_, "tag") => "a tag the owner gave it",
        (_, "text") => "words in the text itself only, not in attachments",
        (_, "transcript") => "words said in a voice message",
        (_, "content") => "words inside attached files",
        (_, "filename") => "an attached file's name",
        (_, "title") => "words in the title",
        (_, "kind") => "the kind of chat",
        (_, "in") => "the owner's own account, its bots, or both",
        (_, "is") => "a mark the owner set",
        (_, "email") => "an email address mentioned in it",
        (_, "phone") => "a phone number mentioned in it",
        (_, "url") => "a link to exactly this address",
        (_, "link") => "links whose address contains this",
        (_, "domain" | "site") => "a website",
        (_, "mailbox") => "a mailbox such as important or bulk",
        (_, "label") => "a label on the mail",
        (_, "source") => "where the note came from",
        _ => "",
    }
}

fn field_line(what: &str, f: &SearchField) -> String {
    let values = f.values.as_ref().and_then(Value::as_array).map(|vs| {
        let vs: Vec<&str> = vs.iter().filter_map(Value::as_str).collect();
        format!(" Only these values: {}.", vs.join(", "))
    });
    let meaning = meaning(what, &f.name);
    let meaning = if meaning.is_empty() { String::new() } else { format!(": {meaning}") };
    format!("- {}{meaning}. Example: {}.{}", f.name, f.example, values.unwrap_or_default())
}

struct Example {
    needs: &'static [&'static str],
    words: &'static str,
    query: &'static str,
}

const EXAMPLES: &[Example] = &[
    Example {
        needs: &["from", "has", "date"],
        words: "photos Ana sent last week about the flat",
        query: r#"flat from:"Ana" has:photo date>=7d"#,
    },
    Example {
        needs: &["from"], words: "как купить велосипед у Милы", query: r#"купить велосипед from:"Мила""#
    },
    Example {
        needs: &["from", "has"],
        words: "голосовые от Сергея Иванова про договор аренды",
        query: r#"договор аренды from:"Сергей Иванов" has:voice"#,
    },
    Example {
        needs: &["chat", "has", "date"],
        words: "ссылки из чата Дизайн за последний месяц",
        query: r#"chat:"Дизайн" has:link date>=30d"#,
    },
    Example {
        needs: &["from", "date"],
        words: "что Оля писала вчера про отпуск",
        query: r#"отпуск from:"Оля" date:yesterday"#,
    },
    Example {
        needs: &["from"],
        words: "anything about rent or the deposit, but not from Marco",
        query: r#"(rent OR deposit) NOT from:"Marco""#,
    },
    Example {
        needs: &["from", "date"],
        words: "el presupuesto que mandó Lucía en febrero",
        query: r#"presupuesto from:"Lucía" date:[2026-02-01 TO 2026-02-28]"#,
    },
    Example { needs: &["from", "has"], words: "the invoice pdf Kai sent", query: r#"invoice from:"Kai" has:file"# },
    Example {
        needs: &["from", "date"],
        words: "письма от Stripe про возврат за эту неделю",
        query: r#"возврат from:"Stripe" date>=7d"#,
    },
    Example {
        needs: &["from", "filename"],
        words: "the contract Ana mailed as an attachment",
        query: r#"contract from:"Ana" filename:contract"#,
    },
    Example {
        needs: &["title", "author"],
        words: "the quarterly plan Ana wrote",
        query: r#"title:quarterly plan author:"Ana""#,
    },
    Example {
        needs: &["tag", "date"],
        words: "мои заметки про отпуск с тегом семья за этот месяц",
        query: "отпуск tag:семья date>=2026-03-01",
    },
    Example { needs: &["date"], words: "notes I changed today about the launch", query: "launch date:today" },
    Example {
        needs: &[], words: "встреча, где обсуждали бюджет на рекламу", query: "бюджет реклама"
    },
    Example { needs: &[], words: "the call where someone said the word roadmap", query: r#""roadmap""# },
    Example {
        needs: &[], words: "что Мила говорила на созвоне про переезд", query: "Мила переезд"
    },
    Example { needs: &[], words: "la reunión sobre el presupuesto de marketing", query: "presupuesto marketing" },
    Example { needs: &[], words: "the demo with Kai where we talked pricing", query: "demo Kai pricing" },
    Example {
        needs: &[],
        words: "pricing or discount, not the old plan",
        query: r#"(pricing OR discount) NOT "old plan""#,
    },
];

fn rules(names: &[&str]) -> Vec<&'static str> {
    let has_names = ["from", "chat", "author"].iter().any(|k| names.contains(k));
    let mut rules = vec![
        "Keep topic words in the language and alphabet the person used. Never translate them.",
        if names.is_empty() {
            "Drop words that only frame the request: find, show, meeting, call, about, the, где, как, найди, встреча, \
             про, qué, reunión."
        } else {
            "Drop words that only frame the request: find, show, messages, about, the, где, как, найди, сообщения, \
             про, qué, mensajes. Drop words a key already says, such as the kind of attachment or the \
             time."
        },
    ];
    if has_names {
        rules.push(
            "Names of people and chats go into their key in the dictionary form, nominative case: \"у Милы\" is \
             from:\"Мила\", \"от Сергея Иванова\" is from:\"Сергей Иванов\". Keep the person's own spelling and \
             alphabet; never transliterate. Quote every name.",
        );
        rules.push("Several people or chats: (from:\"Маша\" OR from:\"Петя\").");
    } else {
        rules.push(
            "Names of people are plain words in the dictionary form, nominative case: \"с Милой\" is Мила. Keep the \
             person's own spelling and alphabet; never transliterate.",
        );
    }
    if !names.is_empty() {
        rules.push(
            "Use only the keys listed above and only their listed values. When the description needs a key that is \
             not listed, write those words as plain words or leave them out.",
        );
    }
    rules.push(
        "Answer with the query only: one line, no explanation, no code block. When nothing in the description can \
         be searched, answer with an empty query.",
    );
    rules
}

/// The rules, the tool's keys and examples; the same for every request, so no owner data is in it.
pub fn system_prompt(tool: &Tool) -> Result<String, String> {
    let src = tool.search.as_ref().ok_or("This tool cannot search its local data.")?;
    let what = src.what.as_str();
    let names: Vec<&str> = src.fields.iter().map(|f| f.name.as_str()).collect();
    let keys = if src.fields.is_empty() {
        "This tool has no keys: the query is words, \"phrases\", AND, OR, NOT and parentheses only. Put names and \
         dates in as plain words, or leave dates out."
            .to_owned()
    } else {
        let lines: Vec<String> = src.fields.iter().map(|f| field_line(what, f)).collect();
        format!("Keys this tool searches by (key:value, key:\"two words\"):\n{}", lines.join("\n"))
    };
    let dates = if names.contains(&"date") {
        "\nDates: date>=7d (the last 7 days), date>=30d, date:today, date:yesterday, date>=YYYY-MM-DD (from that day \
         on), date:[YYYY-MM-DD TO YYYY-MM-DD] (between two days). \"Last week\" is date>=7d, \"last month\" or \"this \
         past month\" is date>=30d, \"this month\" is date>= the first day of the current month, a named month is that \
         month's range in the latest year it has already begun. Work dates out from today's date."
    } else {
        ""
    };
    let examples: Vec<String> = EXAMPLES
        .iter()
        .filter(|e| e.needs.iter().all(|n| names.contains(n)))
        .take(8)
        .map(|e| format!("Description: {}\nQuery: {}", e.words, e.query))
        .collect();
    Ok(format!(
        "You turn a person's description of what they want to find into one search query for {name}, which searches \
         the {what} stored on their own computer. You see only the description, never the {what} themselves.

Query language: plain words (all must match; every form of a word matches), \"exact phrases\", AND, OR, NOT in \
capitals, parentheses.
{keys}{dates}

Rules:
{rules}

Examples (in these, today is 2026-03-16, Monday):
{examples}",
        name = tool.name,
        rules = rules(&names).iter().enumerate().map(|(i, r)| format!("{}. {r}", i + 1)).collect::<Vec<_>>().join("\n"),
        examples = examples.join("\n\n"),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog;

    fn out(code: i32, stdout: &str, stderr: &str) -> run::Output {
        run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn claude_runs_without_tools_settings_or_a_session_and_reads_the_request_from_stdin() {
        let args = claude_args("RULES");
        assert_eq!(&args[..3], ["-p", "--model", "haiku"]);
        for pair in
            [["--tools", ""], ["--setting-sources", ""], ["--output-format", "json"], ["--system-prompt", "RULES"]]
        {
            assert!(args.windows(2).any(|w| w == pair), "{pair:?}");
        }
        assert!(args.contains(&"--strict-mcp-config") && args.contains(&"--no-session-persistence"));
        assert!(!args.contains(&"--bare"), "--bare never reads the owner's sign-in");
    }

    #[test]
    fn codex_runs_read_only_in_its_own_folder_and_ends_with_stdin() {
        let args = codex_args("/t/d", "/t/d/schema.json", "/t/d/answer.txt");
        assert_eq!(args[0], "exec");
        assert!(args.windows(2).any(|w| w == ["--sandbox", "read-only"]));
        assert!(args.windows(2).any(|w| w == ["-C", "/t/d"]));
        assert!(args.contains(&"--ephemeral") && args.contains(&"--ignore-user-config"));
        assert_eq!(args.last(), Some(&"-"));
    }

    #[test]
    fn a_request_is_one_line_of_words_within_the_limit() {
        assert_eq!(validate_request("  photos\n from  Ana ").unwrap(), "photos from Ana");
        assert!(validate_request(" \n ").is_err());
        assert!(validate_request(&"я".repeat(MAX_REQUEST + 1)).is_err());
        assert!(validate_request(&"я".repeat(MAX_REQUEST)).is_ok(), "counted in letters, not bytes");
    }

    #[test]
    fn reads_claudes_structured_answer() {
        let json = r#"{"type":"result","is_error":false,"result":"{\"query\":\"x\"}","structured_output":{"query":" велосипед from:\"Мила\" "}}"#;
        assert_eq!(read_claude(&out(0, json, "")).unwrap(), r#"велосипед from:"Мила""#);
        let plain = r#"{"type":"result","is_error":false,"result":"`flat has:photo`"}"#;
        assert_eq!(read_claude(&out(0, plain, "")).unwrap(), "flat has:photo");
    }

    #[test]
    fn tells_a_signed_out_claude_from_other_failures() {
        let signed_out = r#"{"type":"result","is_error":true,"result":"Not logged in · Please run /login"}"#;
        assert_eq!(read_claude(&out(1, signed_out, "")), Err(Failure::SignedOut));
        let limit = r#"{"type":"result","is_error":true,"result":"Claude AI usage limit reached"}"#;
        assert_eq!(read_claude(&out(1, limit, "")), Err(Failure::Other("Claude AI usage limit reached".into())));
        assert!(matches!(read_claude(&out(1, "", "")), Err(Failure::Other(_))));
    }

    #[test]
    fn refuses_an_answer_the_owner_could_not_check_at_a_glance() {
        assert!(validate_answer("").is_err());
        assert!(validate_answer("a\nb").is_err());
        assert!(validate_answer(&"a ".repeat(MAX_ANSWER)).is_err());
        assert_eq!(validate_answer("```has:photo```").unwrap(), "has:photo");
    }

    #[test]
    fn reads_codexs_last_message_and_its_sign_in_error() {
        assert_eq!(read_codex(&out(0, "", ""), Some(r#"{"query":"has:link"}"#)).unwrap(), "has:link");
        assert_eq!(read_codex(&out(0, "", ""), Some("has:link\n")).unwrap(), "has:link");
        let err = out(1, "", "ERROR: Not logged in. Run codex login");
        assert_eq!(read_codex(&err, None), Err(Failure::SignedOut));
        assert_eq!(
            read_codex(&out(1, "", "ERROR: stream disconnected"), None),
            Err(other("ERROR: stream disconnected"))
        );
    }

    #[test]
    fn the_prompt_names_the_tools_keys_values_and_examples_that_use_only_them() {
        let tg = system_prompt(catalog::tool("tg").unwrap()).unwrap();
        assert!(tg.contains("- has: what it holds besides text. Example: has:photo. Only these values: photo, file"));
        assert!(tg.contains("date:[YYYY-MM-DD TO YYYY-MM-DD]"));
        assert!(tg.contains(r#"from:"Мила""#));
        assert_eq!(tg.matches("\nQuery: ").count(), 8);
        assert!(!tg.contains("chats, contacts"), "a store list's name is not a value");
        let zm = system_prompt(catalog::tool("zm").unwrap()).unwrap();
        assert!(zm.contains("This tool has no keys") && !zm.contains("from:") && !zm.contains("date>="));
        let notes = system_prompt(catalog::tool("memo").unwrap()).unwrap();
        assert!(notes.contains(r#"author:"Ana""#) && !notes.contains("has:"));
    }

    #[test]
    fn every_catalog_key_has_a_meaning_or_an_example_that_says_it() {
        for tool in &catalog::catalog().tools {
            let Some(src) = &tool.search else { continue };
            for f in &src.fields {
                assert!(!meaning(&src.what, &f.name).is_empty(), "{}: {}", tool.id, f.name);
            }
        }
    }

    #[test]
    fn asks_codex_only_when_claude_code_is_missing_or_signed_out() {
        let both = [(Writer::ClaudeCode, PathBuf::from("claude")), (Writer::Codex, PathBuf::from("codex"))];
        let mut asked = vec![];
        let draft = first_answer(&both, |w, _| {
            asked.push(w);
            if w == Writer::ClaudeCode { Err(Failure::SignedOut) } else { Ok("has:photo".into()) }
        });
        assert_eq!(draft, Draft::Query { query: "has:photo".into(), by: Writer::Codex });
        assert_eq!(asked, [Writer::ClaudeCode, Writer::Codex]);

        let draft = first_answer(&both, |w, _| match w {
            Writer::ClaudeCode => Err(Failure::TimedOut),
            Writer::Codex => panic!("a timeout is not a reason to wait for another agent"),
        });
        assert!(matches!(draft, Draft::Failed { reason: "timed-out", by: Writer::ClaudeCode, .. }));

        let draft = first_answer(&both, |_, _| Err(Failure::SignedOut));
        assert!(
            matches!(draft, Draft::Failed { reason: "signed-out", by: Writer::ClaudeCode, .. }),
            "the first choice"
        );
        assert_eq!(first_answer(&[], |_, _| unreachable!()), Draft::None);
    }

    #[test]
    fn a_failure_names_its_reason_and_writer_for_the_page() {
        let draft = Draft::Failed { reason: Failure::SignedOut.reason(), message: "x".into(), by: Writer::Codex };
        assert_eq!(
            serde_json::to_value(draft).unwrap(),
            serde_json::json!({"kind": "failed", "reason": "signed-out", "message": "x", "by": "codex"})
        );
        assert_eq!(serde_json::to_value(Draft::None).unwrap(), serde_json::json!({"kind": "none"}));
    }

    #[test]
    fn the_message_holds_the_date_and_the_words_only() {
        let day = chrono::NaiveDate::from_ymd_opt(2026, 11, 2).unwrap();
        assert_eq!(user_message("фото", day), "Today is 2026-11-02 (Monday).\nDescription: фото");
    }

    /// `QUERIES=<file> cargo test --lib real_agent -- --ignored --nocapture`: each line `tool<TAB>description`, asked
    /// of the Claude Code on this computer exactly as the app asks it.
    #[test]
    #[ignore = "asks the real Claude Code"]
    fn real_agent() {
        let lines = std::fs::read_to_string(std::env::var("QUERIES").unwrap()).unwrap();
        let program = paths::find("claude").unwrap();
        for line in lines.lines().filter(|l| !l.trim().is_empty()) {
            let (id, words) = line.split_once('\t').unwrap();
            let prompt = system_prompt(catalog::tool(id).unwrap()).unwrap();
            let started = std::time::Instant::now();
            let answer = ask_claude(&program, &prompt, &user_message(words, chrono::Local::now().date_naive()));
            println!("{id}\t{words}\t{answer:?}\t{} ms", started.elapsed().as_millis());
        }
    }
}
