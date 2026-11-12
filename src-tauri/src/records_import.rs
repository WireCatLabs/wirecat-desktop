//! Storage's import: a template to fill for one type of record (`memo records templates show`), then `memo records check`
//! and `memo records import` of the file the owner chose. Only the file chosen in the system's own window reaches
//! memo; the interface never sends a path.

use crate::memo_server;
use crate::memory::memo_bin;
use crate::run::Output;
use crate::skills::{body, failure};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

const READ: Duration = Duration::from_mins(1);
/// A check holds the store's write lock for its length; a sheet of many thousand rows takes minutes.
const IMPORT: Duration = Duration::from_mins(15);
pub const TOO_OLD: &str = "records.too-old";
const FORMATS: [&str; 2] = ["csv", "json"];
/// The Excel language a CSV template is for: memo writes `,` for en and `;` for ru and es.
const LOCALES: [&str; 3] = ["en", "ru", "es"];

/// The file the owner last chose for an import.
#[derive(Default)]
pub struct PickedSheet(pub Mutex<Option<PathBuf>>);

/// What a check or an import answered: memo's receipt, as it printed it, or why it never ran.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Outcome {
    Receipt { receipt: Value },
    Failed { message: String },
}

fn call(args: &[String], timeout: Duration) -> Result<(Output, Option<Value>), String> {
    let bin = memo_bin()?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = memo_server::run(&bin, &refs, timeout).map_err(|e| e.to_string())?;
    let json = out.json();
    Ok((out, json))
}

/// An installed memo without `records templates` or `--type` answers with commander's own words.
fn worded(out: &Output, json: Option<&Value>) -> String {
    let message = failure(out, json);
    let text = format!("{message}\n{}", out.stderr).to_lowercase();
    if crate::memo_cli::unknown_to_cli(&text) { TOO_OLD.into() } else { message }
}

fn answered(out: &Output, json: Option<Value>) -> Result<Value, String> {
    match json {
        Some(v) if crate::skills::ok(out, &v) => Ok(body(&v).clone()),
        j => Err(worded(out, j.as_ref())),
    }
}

/// A word memo takes as one argument: a record type or a source account, never an option.
fn one_word<'a>(what: &str, s: &'a str) -> Result<&'a str, String> {
    let s = s.trim();
    if s.is_empty() || s.len() > 200 || s.starts_with('-') || s.chars().any(char::is_whitespace) {
        return Err(format!("{what} is one word, such as sheet:rentals"));
    }
    Ok(s)
}

fn quiet(mut args: Vec<String>) -> Vec<String> {
    args.extend(["--json".into(), "--no-record".into()]);
    args
}

/// Every type a sheet can hold, with its columns.
pub fn types() -> Result<Value, String> {
    let (out, json) = call(&quiet(vec!["records".into(), "templates".into(), "list".into()]), READ)?;
    answered(&out, json).map(|v| v["types"].clone())
}

pub fn template_args(kind: &str, format: &str, locale: &str, account: Option<&str>) -> Result<Vec<String>, String> {
    if !FORMATS.contains(&format) {
        return Err("A template is CSV or JSON".into());
    }
    if !LOCALES.contains(&locale) {
        return Err("A template's language is en, ru or es".into());
    }
    let mut args: Vec<String> = vec![
        "records".into(),
        "templates".into(),
        "show".into(),
        one_word("A record type", kind)?.into(),
        format!("--format={format}"),
        format!("--locale={locale}"),
    ];
    if let Some(a) = account.filter(|a| !a.trim().is_empty()) {
        args.push(format!("--account={}", one_word("A source", a)?));
    }
    Ok(quiet(args))
}

/// The template's text, as memo writes it.
pub fn template(kind: &str, format: &str, locale: &str, account: Option<&str>) -> Result<String, String> {
    let (out, json) = call(&template_args(kind, format, locale, account)?, READ)?;
    let v = answered(&out, json)?;
    v["text"].as_str().map(str::to_string).ok_or_else(|| "memo wrote no template".into())
}

/// The file name the save window offers for a template, and the template's text.
pub fn template_file(
    kind: &str,
    format: &str,
    locale: &str,
    account: Option<&str>,
) -> Result<(String, String), String> {
    let text = template(kind, format, locale, account)?;
    Ok((format!("{kind}-template.{format}"), text))
}

pub fn save_template(path: &Path, text: &str) -> Result<(), String> {
    std::fs::write(path, text).map_err(|e| format!("The template could not be written: {e}"))
}

pub fn run_args(file: &Path, kind: Option<&str>, account: &str, dry_run: bool) -> Result<Vec<String>, String> {
    let path = file.to_str().ok_or("This file's name cannot be read. Rename it, then choose it again.")?;
    let mut args: Vec<String> = vec![
        "records".into(),
        (if dry_run { "check" } else { "import" }).into(),
        path.into(),
        format!("--account={}", one_word("A source", account)?),
    ];
    if let Some(k) = kind.filter(|k| !k.trim().is_empty()) {
        args.push(format!("--type={}", one_word("A record type", k)?));
    }
    Ok(quiet(args))
}

/// Checks or imports the chosen file. A receipt that refused records is still an answer: the page lists them.
pub fn run(file: &Path, kind: Option<&str>, account: &str, dry_run: bool) -> Result<Outcome, String> {
    let (out, json) = call(&run_args(file, kind, account, dry_run)?, IMPORT)?;
    match json {
        Some(v) if v.get("error").is_none() && body(&v).get("created").is_some() => {
            Ok(Outcome::Receipt { receipt: body(&v).clone() })
        }
        j => Ok(Outcome::Failed { message: worded(&out, j.as_ref()) }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_template_asks_for_one_type_in_a_known_format() {
        assert_eq!(
            template_args("invoice", "csv", "ru", Some("sheet:rentals")).unwrap(),
            [
                "records",
                "templates",
                "show",
                "invoice",
                "--format=csv",
                "--locale=ru",
                "--account=sheet:rentals",
                "--json",
                "--no-record"
            ]
        );
        assert!(template_args("invoice", "xlsx", "en", None).is_err());
        assert!(template_args("--help", "csv", "en", None).is_err());
    }

    #[test]
    fn a_check_names_the_chosen_file_the_source_and_the_type() {
        let args = run_args(Path::new("/tmp/x.csv"), Some("payment"), "sheet:r", true).unwrap();
        assert_eq!(args[..4], ["records", "check", "/tmp/x.csv", "--account=sheet:r"]);
        assert!(args.contains(&"--type=payment".to_string()));
        assert!(run_args(Path::new("/tmp/x.json"), None, "two words", false).is_err());
        assert_eq!(run_args(Path::new("/tmp/x.json"), None, "sheet:r", false).unwrap()[1], "import");
    }

    #[test]
    fn an_old_memo_is_too_old_not_a_failure() {
        let out = Output { code: Some(1), stdout: String::new(), stderr: "error: unknown option '--type'".into() };
        assert_eq!(worded(&out, None), TOO_OLD);
    }
}
