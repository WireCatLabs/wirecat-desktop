//! Add to Memory: a file, a web page or pasted text kept by memo as a source of its own (`memo sources …`), the people
//! and organizations named in it, and facts suggested from it by the reader the owner chose in Settings. Pasted text
//! and the reader's key go on stdin, never on the command line, which other programs can read. Every call passes
//! `--no-record`, so neither lands in memo's run log; the text never goes into a log or a report.

use crate::memory::{self, Entry, action, answer, id_of, plain, strings, text, words};
use crate::skills::body;
use crate::{paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

const READ: Duration = Duration::from_mins(1);
/// memo reads a page for up to 30 s and a large file for longer.
const ADD: Duration = Duration::from_mins(3);
/// A model on this computer may take minutes over a long source.
const SUGGEST: Duration = Duration::from_mins(10);
pub const MAX_TEXT: usize = 200_000;
const MAX_TITLE: usize = 500;
const MAX_URL: usize = 2048;
const SUBJECTS: [&str; 5] = ["person", "organization", "project", "task", "meeting"];

pub(crate) type Feed<'a> = dyn Fn(&[String], Option<&[u8]>) -> Result<Value, String> + Sync + 'a;

fn fed(bin: &Path, args: &[String], input: Option<&[u8]>, timeout: Duration, worded: &[&str]) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let Some(input) = input else {
        let out = crate::memo_server::run(bin, &refs, timeout).map_err(|e| e.to_string())?;
        return panel_answer(&out, false, worded);
    };
    let cmd = run::command(bin, &refs, Some(&paths::search_path()));
    let out = run::run_with_input(cmd, Some(input), timeout, || false).map_err(|e| e.to_string())?;
    panel_answer(&out, true, worded)
}

/// memo's refusals of a source or a reader, which the panel words in the owner's language.
const WORDED: [&str; 2] = ["source.", "reader."];
pub const REFUSED: &str = "memo.refused";

/// memo's message can quote what it read on stdin (the pasted text or the key), escaped or cut so that no replace
/// finds it. A run fed on stdin therefore answers only with a reason the panel knows, never with memo's words.
fn panel_answer(out: &run::Output, fed: bool, prefixes: &[&str]) -> Result<Value, String> {
    let reason = out.json().and_then(|v| text(&v["error"], "reason"));
    let worded = reason.filter(|r| r.len() <= 60 && plain(r).is_some() && prefixes.iter().any(|p| r.starts_with(p)));
    match (answer(out), worded) {
        (Ok(v), _) => Ok(v),
        (Err(_), Some(reason)) => Err(reason),
        (Err(_), None) if fed => Err(REFUSED.into()),
        (Err(e), None) => Err(e),
    }
}

fn with_memo<T>(timeout: Duration, f: impl FnOnce(&Feed) -> Result<T, String>) -> Result<T, String> {
    with_memo_worded(timeout, &WORDED, f)
}

/// As `with_memo`, for a feature whose refusals carry reasons with other prefixes.
pub(crate) fn with_memo_worded<T>(
    timeout: Duration,
    worded: &[&str],
    f: impl FnOnce(&Feed) -> Result<T, String>,
) -> Result<T, String> {
    let bin = memory::memo_bin()?;
    f(&|args: &[String], input: Option<&[u8]>| fed(&bin, args, input, timeout, worded))
}

/// The file the owner last chose in the system's file window. Only that path reaches `sources add`: the interface
/// sends a path back, and could send any.
#[derive(Default)]
pub struct PickedFile(pub Mutex<Option<PathBuf>>);

/// A path memo cannot be handed as one word is refused here rather than mangled.
pub fn picked_path(path: PathBuf) -> Result<String, String> {
    path.into_os_string()
        .into_string()
        .map_err(|_| "This file's name cannot be read. Rename it, then choose it again.".into())
}

#[derive(Deserialize, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Given {
    Text { text: String },
    File { path: String },
    Link { url: String },
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AddSource {
    pub given: Given,
    pub title: Option<String>,
    #[serde(default)]
    pub subjects: Vec<String>,
}

/// What memo kept, in its own words: the page says "Text kept" or "File kept" from `kept`, never by guessing.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Added {
    #[serde(rename = "ref")]
    pub reference: String,
    pub created: bool,
    /// A watched-folder or Drive document with the same content; only the subjects were linked to it.
    pub duplicate_of: Option<String>,
    pub title: Option<String>,
    /// `file`, `page` or `text`.
    pub kind: String,
    pub mime: Option<String>,
    pub bytes: Option<u64>,
    pub chars: u64,
    pub truncated: Option<bool>,
    /// `extracted`, or `no-text` for a picture or a scan: found by its title and subjects only.
    pub read: String,
    pub url: Option<String>,
    /// `text` or `copy`; `None` for a duplicate.
    pub kept: Option<String>,
    pub searchable_words: bool,
    pub searchable_meaning: bool,
    pub subjects: Vec<String>,
    /// Only for a picture: who read it, or why nobody did.
    pub image: Option<ImageRead>,
}

/// How memo's AI model dealt with a picture: `read_by` like `anthropic/claude-haiku-4-5`, or a `reason` the page words.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageRead {
    pub read_by: Option<String>,
    pub reason: Option<String>,
}

pub(crate) fn one_line(what: &str, s: &str, most: usize) -> Result<String, String> {
    let t = s.trim();
    if t.is_empty() || t.chars().count() > most || t.chars().any(char::is_control) {
        return Err(format!("{what} is 1 to {most} characters on one line"));
    }
    Ok(t.to_string())
}

pub fn subject(s: &str) -> Result<&str, String> {
    let bad = || format!("not a subject: {s}");
    let (prefix, rest) = s.split_once(':').ok_or_else(bad)?;
    if !SUBJECTS.contains(&prefix)
        || rest.is_empty()
        || s.len() > 200
        || plain(s).is_none()
        || s.contains(char::is_control)
    {
        return Err(bad());
    }
    Ok(s)
}

fn document(s: &str) -> Result<&str, String> {
    let id = s.strip_prefix("document:").unwrap_or_default();
    if id.is_empty() || id.len() > 15 || !id.bytes().all(|b| b.is_ascii_digit()) || id.starts_with('0') {
        return Err(format!("not a source: {s}"));
    }
    Ok(s)
}

pub(crate) fn link(url: &str) -> Result<&str, String> {
    let u = url.trim();
    let scheme = u.split_once("://").map(|(s, _)| s.to_ascii_lowercase());
    if !matches!(scheme.as_deref(), Some("http" | "https")) || u.len() > MAX_URL || u.contains(char::is_whitespace) {
        return Err("Give a web address that starts with http:// or https://.".into());
    }
    Ok(u)
}

fn file<'a>(path: &'a str, picked: Option<&Path>) -> Result<&'a str, String> {
    let p = Path::new(path);
    if picked != Some(p) || !p.is_absolute() || !p.is_file() {
        return Err("Choose the file again in the file window.".into());
    }
    Ok(path)
}

fn add_args(source: &AddSource, picked: Option<&Path>) -> Result<(Vec<String>, Option<String>), String> {
    let (what, input) = match &source.given {
        Given::Text { text } => {
            if text.trim().is_empty() || text.chars().count() > MAX_TEXT {
                return Err(format!("Paste 1 to {MAX_TEXT} characters of text."));
            }
            ("-".to_string(), Some(text.clone()))
        }
        Given::File { path } => (file(path, picked)?.to_string(), None),
        Given::Link { url } => (link(url)?.to_string(), None),
    };
    let mut args: Vec<String> = vec!["sources".into(), "add".into(), what];
    if let Some(t) = source.title.as_deref().filter(|t| !t.trim().is_empty()) {
        // One word each, so a title that starts with `-` is never read as an option.
        args.push(format!("--title={}", one_line("A title", t, MAX_TITLE)?));
    }
    for s in &source.subjects {
        args.push(format!("--subject={}", subject(s)?));
    }
    // The owner added it: without this memo takes an app run for nobody's, and the subjects would wait unconfirmed.
    args.push("--from-app".into());
    args.extend(words(&[]));
    Ok((args, input))
}

fn added(v: &Value) -> Option<Added> {
    let item = body(v);
    let refs = |v: &Value| -> Vec<String> {
        v.as_array()
            .map(|a| a.iter().filter_map(|s| s.as_str().map(str::to_string).or_else(|| text(s, "ref"))).collect())
            .unwrap_or_default()
    };
    Some(Added {
        reference: text(item, "ref")?,
        created: item["created"].as_bool().unwrap_or(false),
        duplicate_of: text(item, "duplicate_of"),
        title: text(item, "title"),
        kind: text(item, "kind")?,
        mime: text(item, "mime"),
        bytes: item["bytes"].as_u64(),
        chars: item["chars"].as_u64().unwrap_or(0),
        truncated: item["truncated"].as_bool(),
        read: text(item, "read").unwrap_or_else(|| "extracted".into()),
        url: text(item, "url"),
        kept: text(item, "kept"),
        searchable_words: item["searchable"]["words"].as_bool().unwrap_or(false),
        searchable_meaning: item["searchable"]["meaning"].as_bool().unwrap_or(false),
        subjects: refs(&item["subjects"]),
        image: item["image"].is_object().then(|| ImageRead {
            read_by: text(&item["image"], "read_by"),
            reason: text(&item["image"], "reason").filter(|r| r.len() <= 60 && plain(r).is_some()),
        }),
    })
}

fn add_with(feed: &Feed, source: &AddSource, picked: Option<&Path>) -> Result<Added, String> {
    let (args, input) = add_args(source, picked)?;
    let v = feed(&args, input.as_deref().map(str::as_bytes))?;
    added(&v).ok_or_else(|| "Memo's answer did not describe the source".into())
}

pub fn add(source: &AddSource, picked: Option<&Path>) -> Result<Added, String> {
    with_memo(ADD, |feed| add_with(feed, source, picked))
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    #[serde(rename = "ref")]
    pub reference: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub name: Option<String>,
    pub found_as: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Mentions {
    pub items: Vec<Mention>,
    /// memo matched only the first organizations by name; more may be named.
    pub partial: bool,
}

fn mentions_with(feed: &Feed, reference: &str) -> Result<Mentions, String> {
    let v = feed(&words(&["sources", "mentions", document(reference)?]), None)?;
    let items = v["items"].as_array().cloned().unwrap_or_default();
    Ok(Mentions {
        items: items
            .iter()
            .filter_map(|m| {
                Some(Mention {
                    reference: text(m, "ref").filter(|r| subject(r).is_ok())?,
                    kind: text(m, "type")?,
                    name: text(m, "name"),
                    found_as: strings(&m["found_as"]),
                })
            })
            .collect(),
        partial: v["missing"].as_array().is_some_and(|a| !a.is_empty()),
    })
}

pub fn mentions(reference: &str) -> Result<Mentions, String> {
    with_memo(READ, |feed| mentions_with(feed, reference))
}

/// The stored text, as memo keeps it: the source opens here, not at a path that may be gone.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Shown {
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: Option<String>,
    pub kind: Option<String>,
    pub url: Option<String>,
    pub file_name: Option<String>,
    pub kept: Option<String>,
    pub chars: u64,
    pub text: String,
    pub text_truncated: bool,
    pub subjects: Vec<Linked>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Linked {
    #[serde(rename = "ref")]
    pub reference: String,
    pub confirmed: bool,
}

fn show_with(feed: &Feed, reference: &str) -> Result<Shown, String> {
    let v = feed(&words(&["sources", "show", document(reference)?]), None)?;
    let item = body(&v);
    Ok(Shown {
        reference: text(item, "ref").ok_or("Memo's answer did not describe the source")?,
        title: text(item, "title"),
        kind: text(item, "kind"),
        url: text(item, "url"),
        file_name: text(item, "file_name"),
        kept: text(item, "kept"),
        chars: item["chars"].as_u64().unwrap_or(0),
        text: item["text"].as_str().unwrap_or_default().to_string(),
        text_truncated: item["text_truncated"].as_bool().unwrap_or(false),
        subjects: item["subjects"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|l| {
                Some(Linked { reference: text(l, "ref")?, confirmed: l["confirmed"].as_bool().unwrap_or(false) })
            })
            .collect(),
    })
}

pub fn show(reference: &str) -> Result<Shown, String> {
    with_memo(READ, |feed| show_with(feed, reference))
}

/// One way to read a source for facts, as memo found it on this computer. memo never chooses one; the owner does.
#[expect(clippy::struct_excessive_bools, reason = "each is its own line in Settings")]
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Reader {
    pub id: String,
    pub available: bool,
    pub signed_in: Option<bool>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub leaves_computer: bool,
    /// The reader can open files on this computer, so the page warns before it is chosen.
    pub reads_files: bool,
    pub chosen: bool,
    /// Why memo cannot read with it yet, such as `ai-model` with no model chosen; the page points to «AI model».
    pub problem: Option<String>,
}

/// A reader or provider id goes into a command line, so it is only ever a plain lowercase word.
pub(crate) fn id_word<'a>(what: &str, s: &'a str) -> Result<&'a str, String> {
    if s.is_empty()
        || s.len() > 40
        || s.starts_with('-')
        || !s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err(format!("not a {what}: {s}"));
    }
    Ok(s)
}

fn reader(v: &Value) -> Option<Reader> {
    let flag = |k: &str| v[k].as_bool().unwrap_or(false);
    Some(Reader {
        id: text(v, "id").filter(|id| id_word("reader", id).is_ok())?,
        available: flag("available"),
        signed_in: v["signed_in"].as_bool(),
        model: text(v, "model"),
        provider: text(v, "provider"),
        // Unknown counts as the riskier answer for both: the page then warns, never the opposite.
        leaves_computer: v["leaves_computer"].as_bool().unwrap_or(true),
        reads_files: v["reads_files"].as_bool().unwrap_or(true),
        chosen: flag("chosen"),
        problem: text(v, "problem"),
    })
}

const READERS: [&str; 2] = ["sources", "readers"];
const CHOOSE: [&str; 3] = ["sources", "readers", "set"];
const SUGGEST_CMD: [&str; 2] = ["sources", "suggest"];
const BATCH: &str = "batch";

fn readers_with(feed: &Feed) -> Result<Vec<Reader>, String> {
    let v = feed(&words(&READERS), None)?;
    Ok(v["items"].as_array().map(|a| a.iter().filter_map(reader).collect()).unwrap_or_default())
}

pub fn readers() -> Result<Vec<Reader>, String> {
    with_memo(READ, readers_with)
}

fn choose_with(feed: &Feed, id: &str) -> Result<Vec<Reader>, String> {
    let id = id_word("reader", id)?;
    let listed = feed(&words(&READERS), None)?;
    let entry = listed["items"].as_array().and_then(|a| a.iter().find(|r| r["id"].as_str() == Some(id)));
    let mut args: Vec<String> = CHOOSE.iter().map(|s| (*s).to_string()).collect();
    args.push(id.into());
    // memo refuses Ollama and the API readers without a model, and only the owner may name one.
    if entry.is_some_and(|r| r["needs_model"].as_bool() == Some(true)) {
        let model = entry.and_then(|r| text(r, "model")).ok_or_else(|| {
            format!("{id} needs a model, and WireCat cannot choose one yet. Choose it in Memo, then here again.")
        })?;
        args.push(format!("--model={}", one_line("A model", &model, 200)?));
    }
    args.push("--from-app".into());
    feed(&words(&args.iter().map(String::as_str).collect::<Vec<_>>()), None)?;
    readers_with(feed)
}

pub fn choose(id: &str) -> Result<Vec<Reader>, String> {
    with_memo(READ, |feed| choose_with(feed, id))
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Suggested {
    /// The findings batch, decided like any other on the Memory page: ticking a fact keeps it.
    pub batch: Entry,
    /// memo had read this source with this reader before and made no new call.
    pub reused: bool,
}

/// The batch read back is used only if it is the findings of this source: proposed, or already decided when memo says
/// it reused an earlier reading, and every finding citing the document.
fn batch_of(shown: &Value, reference: &str, reused: bool) -> Result<Entry, String> {
    let wrong = || "Memo's answer did not describe this source's suggested facts".to_string();
    let batch = action(body(shown)).filter(|b| b.findings.is_some()).ok_or_else(wrong)?;
    let cites = batch.findings.iter().flatten().all(|f| f.evidence.iter().any(|e| e == reference));
    if !cites || (batch.status != "proposed" && !reused) {
        return Err(wrong());
    }
    Ok(batch)
}

fn suggest_with(
    feed: &Feed,
    reference: &str,
    reader: &str,
    subjects: &[String],
    again: bool,
) -> Result<Suggested, String> {
    let mut args: Vec<String> = SUGGEST_CMD.iter().map(|s| (*s).to_string()).collect();
    args.push(document(reference)?.into());
    // Named every time: what the page said reads the text is what reads it.
    args.push(format!("--provider={}", id_word("reader", reader)?));
    for s in subjects {
        args.push(format!("--subject={}", subject(s)?));
    }
    if again {
        args.push("--rescan".into());
    }
    args.push("--from-app".into());
    args.extend(words(&[]));
    let v = feed(&args, None)?;
    let item = body(&v);
    let id = id_of(&item[BATCH]).ok_or("Memo did not name the suggested facts")?;
    let reused = item["reused"].as_bool().unwrap_or(false);
    let batch = batch_of(&feed(&words(&["actions", "show", &id]), None)?, reference, reused)?;
    Ok(Suggested { batch, reused })
}

/// memo 0.131.77 refuses `--provider=ai-model` with no AI model chosen as `config.invalid`, not `reader.ai-not-set`.
const AI_NOT_SET: &str = "config.invalid";

fn suggest_worded(reader: &str) -> &'static [&'static str] {
    if reader == "ai-model" { &["source.", "reader.", AI_NOT_SET] } else { &WORDED }
}

fn ai_not_set(e: String) -> String {
    if e == AI_NOT_SET { "reader.ai-not-set".into() } else { e }
}

pub fn suggest(reference: &str, reader: &str, subjects: &[String], again: bool) -> Result<Suggested, String> {
    with_memo_worded(SUGGEST, suggest_worded(reader), |feed| suggest_with(feed, reference, reader, subjects, again))
        .map_err(ai_not_set)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    type Seen = Mutex<Vec<(Vec<String>, Option<String>)>>;
    type Answer = Box<dyn Fn(&[String], Option<&str>) -> Result<Value, String> + Sync>;

    struct Fake {
        seen: Seen,
        answer: Answer,
    }

    impl Fake {
        fn new(answer: impl Fn(&[String], Option<&str>) -> Result<Value, String> + Sync + 'static) -> Fake {
            Fake { seen: Mutex::new(Vec::new()), answer: Box::new(answer) }
        }
        fn feed(&self, args: &[String], input: Option<&[u8]>) -> Result<Value, String> {
            let input = input.map(|b| String::from_utf8_lossy(b).to_string());
            self.seen.lock().unwrap().push((args.to_vec(), input.clone()));
            (self.answer)(args, input.as_deref())
        }
        fn seen(&self) -> Vec<(Vec<String>, Option<String>)> {
            self.seen.lock().unwrap().clone()
        }
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    // Real answers of cli-memo #711 on a throwaway store; see tests/fixtures/memory-add/README.md.
    fn fixture(name: &str) -> Value {
        serde_json::from_str(match name {
            "add-subject" => include_str!("../tests/fixtures/memory-add/add-subject.json"),
            "add-copy" => include_str!("../tests/fixtures/memory-add/add-copy.json"),
            "show" => include_str!("../tests/fixtures/memory-add/show.json"),
            "mentions" => include_str!("../tests/fixtures/memory-add/mentions.json"),
            "url-refused" => include_str!("../tests/fixtures/memory-add/url-refused.json"),
            "no-text" => include_str!("../tests/fixtures/memory-add/no-text.json"),
            "unsupported" => include_str!("../tests/fixtures/memory-add/unsupported.json"),
            _ => panic!("no fixture {name}"),
        })
        .unwrap()
    }

    fn added_answer() -> Value {
        fixture("add-subject")
    }

    /// memo's refusal as it prints it: JSON on stderr, exit code 2, nothing on stdout.
    fn refusal(name: &str) -> run::Output {
        run::Output { code: Some(2), stdout: String::new(), stderr: fixture(name).to_string() }
    }

    fn text_source(text: &str) -> AddSource {
        AddSource {
            given: Given::Text { text: text.into() },
            title: Some("-Call".into()),
            subjects: vec!["person:7".into()],
        }
    }

    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        let a = added(&added_answer()).unwrap();
        assert_eq!(
            serde_json::to_value(&a).unwrap(),
            json!({"ref":"document:3","created":true,"duplicateOf":null,"title":"Lena moves the review to Friday.",
                "kind":"text","mime":"text/plain","bytes":33,"chars":32,"truncated":false,"read":"extracted","url":null,
                "kept":"text","searchableWords":true,"searchableMeaning":false,"subjects":["person:2"],"image":null})
        );
        let r = reader(&json!({"id":"ollama","available":true,"model":"llama3.2","leaves_computer":false})).unwrap();
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            json!({"id":"ollama","available":true,"signedIn":null,"model":"llama3.2","provider":null,
                "leavesComputer":false,"readsFiles":true,"chosen":false,"problem":null})
        );
    }

    #[test]
    fn a_pictures_reading_comes_through_as_who_read_it_or_why_not() {
        let mut v = added_answer();
        v["item"]["image"] = json!({"read_by": "anthropic/claude-haiku-4-5", "reason": null});
        let read = added(&v).unwrap().image.unwrap();
        assert_eq!(read, ImageRead { read_by: Some("anthropic/claude-haiku-4-5".into()), reason: None });
        v["item"]["image"] = json!({"read_by": null, "reason": "ai.images-not-allowed"});
        assert_eq!(added(&v).unwrap().image.unwrap().reason.as_deref(), Some("ai.images-not-allowed"));
        v["item"]["image"] = json!({"read_by": null, "reason": "two words"});
        assert_eq!(added(&v).unwrap().image.unwrap().reason, None);
        assert!(added(&added_answer()).unwrap().image.is_none());
    }

    #[test]
    fn pasted_text_goes_on_stdin_never_on_the_command_line() {
        let fake = Fake::new(|_, _| Ok(added_answer()));
        let a = add_with(
            &|a: &[String], i: Option<&[u8]>| fake.feed(a, i),
            &text_source("we agreed delivery on the 28th"),
            None,
        )
        .unwrap();
        assert_eq!(a.reference, "document:3");
        assert_eq!(a.kept.as_deref(), Some("text"));
        assert_eq!(a.subjects, ["person:2"]);
        let (args, input) = &fake.seen()[0];
        assert_eq!(
            args,
            &strs(&[
                "sources",
                "add",
                "-",
                "--title=-Call",
                "--subject=person:7",
                "--from-app",
                "--json",
                "--no-record"
            ])
        );
        assert_eq!(input.as_deref(), Some("we agreed delivery on the 28th"));
        assert!(!args.iter().any(|a| a.contains("delivery")));
    }

    #[test]
    fn a_run_fed_on_stdin_answers_only_with_a_reason_never_memos_words() {
        let pasted = "Lena said \"ship it\"\non the 28th, and the key is sk-test-123";
        let quoted = serde_json::to_string(&format!("cannot read: {pasted}")).unwrap();
        let refusal = |reason: &str| run::Output {
            code: Some(1),
            stdout: format!(r#"{{"error":{{"code":"validation_error","message":{quoted}{reason}}}}}"#),
            stderr: format!("cannot read: {pasted}\n"),
        };
        assert_eq!(panel_answer(&refusal(""), true, &WORDED), Err(REFUSED.into()));
        assert_eq!(
            panel_answer(&refusal(r#","reason":"source.no-text""#), true, &WORDED),
            Err("source.no-text".into())
        );
        assert_eq!(panel_answer(&refusal(r#","reason":"store.busy""#), true, &WORDED), Err(REFUSED.into()));
        let ai = refusal(r#","reason":"ai.key-rejected""#);
        assert_eq!(panel_answer(&ai, true, &WORDED), Err(REFUSED.into()), "the panel does not word ai reasons");
        assert_eq!(panel_answer(&ai, true, &["ai."]), Err("ai.key-rejected".into()));
        let unfed = panel_answer(&refusal(""), false, &WORDED).unwrap_err();
        assert!(unfed.contains("cannot read"), "a run with nothing on stdin keeps memo's words: {unfed}");
        let ok = run::Output { code: Some(0), stdout: r#"{"item":{"stored":true}}"#.into(), stderr: String::new() };
        assert!(panel_answer(&ok, true, &WORDED).is_ok());
    }

    #[test]
    fn an_unset_ai_model_is_worded_as_reader_ai_not_set_only_for_the_ai_model_reader() {
        let out = run::Output {
            code: Some(1),
            stdout: r#"{"error":{"code":"configuration_error","reason":"config.invalid",
                "message":"no AI model is chosen: memo models ai set"}}"#
                .into(),
            stderr: String::new(),
        };
        let ai = panel_answer(&out, false, suggest_worded("ai-model")).map_err(ai_not_set);
        assert_eq!(ai.unwrap_err(), "reader.ai-not-set");
        let other = panel_answer(&out, false, suggest_worded("codex")).map_err(ai_not_set).unwrap_err();
        assert!(other.contains("no AI model is chosen"), "another reader keeps memo's words: {other}");
    }

    #[test]
    fn reads_the_source_the_interface_sends() {
        let s: AddSource = serde_json::from_value(
            json!({"given":{"kind":"text","text":"notes"},"title":null,"subjects":["person:7"]}),
        )
        .unwrap();
        assert!(matches!(s.given, Given::Text { ref text } if text == "notes"));
        let l: AddSource =
            serde_json::from_value(json!({"given":{"kind":"link","url":"https://x.org"},"title":"T","subjects":[]}))
                .unwrap();
        assert!(matches!(l.given, Given::Link { .. }));
    }

    #[test]
    fn a_link_must_be_http_and_a_file_must_be_the_one_picked() {
        let fake = Fake::new(|_, _| Ok(added_answer()));
        let feed = |a: &[String], i: Option<&[u8]>| fake.feed(a, i);
        let src = |given| AddSource { given, title: None, subjects: vec![] };
        for bad in ["file:///etc/passwd", "javascript:alert(1)", "-https://x", "https://a b", "ftp://x"] {
            assert!(add_with(&feed, &src(Given::Link { url: bad.into() }), None).is_err(), "{bad}");
        }
        let dir = std::env::temp_dir().join(format!("wirecat-add-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (picked, other) = (dir.join("notes.pdf"), dir.join("other.pdf"));
        std::fs::write(&picked, "x").unwrap();
        std::fs::write(&other, "x").unwrap();
        let file = |p: &Path| src(Given::File { path: p.to_string_lossy().into() });
        assert!(add_with(&feed, &file(&other), Some(&picked)).is_err(), "only the file the window gave");
        assert!(add_with(&feed, &file(&picked), None).is_err(), "nothing picked yet");
        assert!(fake.seen().is_empty(), "nothing reached memo");
        add_with(&feed, &file(&picked), Some(&picked)).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        add_with(&feed, &src(Given::Link { url: " https://example.org/notes ".into() }), None).unwrap();
        assert_eq!(fake.seen()[1].0[..3], strs(&["sources", "add", "https://example.org/notes"]));
        assert_eq!(fake.seen()[1].1, None);
    }

    #[test]
    fn only_known_kinds_of_subject_reach_memo() {
        for good in ["person:7", "organization:3", "project:1", "task:HRB-14", "meeting:9"] {
            assert!(subject(good).is_ok(), "{good}");
        }
        for bad in ["note:1", "person:", "person:7 --all", "--json", "telegram:Kai Sample", "person:a\nb"] {
            assert!(subject(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn source_reasons_go_back_as_ids_for_the_panel_only() {
        for (name, reason, fed) in [
            ("url-refused", "source.url-refused", false),
            ("no-text", "source.no-text", true),
            ("unsupported", "source.unsupported", false),
        ] {
            assert_eq!(panel_answer(&refusal(name), fed, &WORDED), Err(reason.into()), "{name}");
        }
        let words = answer(&refusal("url-refused")).unwrap_err();
        assert!(words.starts_with("127.0.0.1 is not on the public internet"), "the Memory page keeps memo's words");
    }

    #[test]
    fn a_kept_copy_and_the_stored_text_read_as_memo_answers_them() {
        assert_eq!(added(&fixture("add-copy")).unwrap().kept.as_deref(), Some("copy"));
        let fake = Fake::new(|_, _| Ok(fixture("show")));
        let shown = show_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "document:2").unwrap();
        assert_eq!((shown.file_name.as_deref(), shown.kept.as_deref()), (Some("notes.txt"), Some("copy")));
        assert!(shown.text.starts_with("Call with Lena Ortiz."));
        assert_eq!(shown.subjects, Vec::<Linked>::new());
    }

    #[test]
    fn mentions_keep_only_refs_that_can_become_subjects() {
        let real = Fake::new(|_, _| Ok(fixture("mentions")));
        let m = mentions_with(&|a: &[String], i: Option<&[u8]>| real.feed(a, i), "document:2").unwrap();
        assert_eq!(m.items.iter().map(|i| i.reference.as_str()).collect::<Vec<_>>(), ["person:2", "person:4"]);
        assert_eq!(m.items[1].found_as, ["lena@example.org"]);
        assert!(!m.partial);
        let fake = Fake::new(|_, _| {
            let mut v = fixture("mentions");
            v["items"].as_array_mut().unwrap().push(json!({"ref":"--all","type":"person","name":null,"found_as":[]}));
            v["missing"] = json!([{"field":"organizations","why":"only the first 500"}]);
            Ok(v)
        });
        let m = mentions_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "document:42").unwrap();
        assert_eq!(m.items.len(), 2, "a ref that reads as an option is dropped");
        assert!(m.partial);
        assert_eq!(fake.seen()[0].0, strs(&["sources", "mentions", "document:42", "--json", "--no-record"]));
        assert!(mentions_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "note:3").is_err());
    }

    #[test]
    fn readers_are_listed_as_memo_found_them_and_none_is_picked_here() {
        let fake = Fake::new(|a, _| {
            Ok(if a[2] == "set" {
                json!({"item":{"reader":"ollama","model":"llama3.2","leaves_computer":false,"reads_files":false}})
            } else {
                json!({"items":[{"id":"ai-model","available":false,"needs_model":false,"leaves_computer":true,
                    "reads_files":false,"chosen":false,"problem":"no AI model is chosen: memo models ai set"},
                    {"id":"claude-code","available":true,"signed_in":true,"model":"sonnet","provider":"anthropic",
                    "needs_model":false,"leaves_computer":true,"reads_files":false,"chosen":false},
                    {"id":"ollama","available":true,"model":"llama3.2","needs_model":true,"leaves_computer":false,"chosen":false},
                    {"id":"codex","available":false,"reads_files":true},
                    {"id":"openai","available":true,"signed_in":false,"model":null,"needs_model":true,"chosen":false}]})
            })
        });
        let feed = |a: &[String], i: Option<&[u8]>| fake.feed(a, i);
        let r = readers_with(&feed).unwrap();
        assert!(r.iter().all(|r| !r.chosen));
        assert_eq!(r[0].problem.as_deref(), Some("no AI model is chosen: memo models ai set"));
        assert_eq!(r[1].problem, None);
        assert!(!r[2].leaves_computer);
        assert!(r[3].leaves_computer, "unknown counts as leaving");
        assert!(r[2].reads_files, "unknown counts as reading files");
        assert!(!r[1].reads_files);
        choose_with(&feed, "ollama").unwrap();
        assert_eq!(
            fake.seen()[2].0,
            strs(&["sources", "readers", "set", "ollama", "--model=llama3.2", "--from-app", "--json", "--no-record"])
        );
        choose_with(&feed, "claude-code").unwrap();
        assert_eq!(
            fake.seen()[5].0,
            strs(&["sources", "readers", "set", "claude-code", "--from-app", "--json", "--no-record"])
        );
        choose_with(&feed, "ai-model").unwrap();
        assert_eq!(
            fake.seen()[8].0,
            strs(&["sources", "readers", "set", "ai-model", "--from-app", "--json", "--no-record"])
        );
        let sent = fake.seen().len();
        assert!(choose_with(&feed, "openai").unwrap_err().contains("needs a model"));
        assert_eq!(fake.seen().len(), sent + 1, "nothing is set without a model");
        assert!(choose_with(&feed, "--all").is_err());
    }

    fn batch(status: &str, cites: &str) -> Value {
        json!({"item":{"id":"9","kind":"evidence_findings","status":status,"created_at":"2026-11-07T10:00:00.000Z",
            "proposed_by":{"type":"bot","name":"memo-reader"},"fingerprint":"5adf3e","payload":{"findings":[
            {"id":"f1","kind":"fact","statement":"Delivery is on the 28th","evidence":[{"reference":cites}]}]}}})
    }

    fn suggesting(reused: bool, shown: Value) -> Fake {
        Fake::new(move |a, _| {
            Ok(if a[0] == "sources" { json!({"item":{"batch":"9","reused":reused}}) } else { shown.clone() })
        })
    }

    #[test]
    fn a_batch_that_is_not_this_sources_proposed_findings_is_refused() {
        let run = |fake: &Fake| {
            suggest_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "document:42", "ollama", &[], false)
        };
        assert!(run(&suggesting(false, batch("proposed", "document:7"))).is_err(), "cites another source");
        assert!(run(&suggesting(false, batch("approved", "document:42"))).is_err(), "decided, not reused");
        let reused = run(&suggesting(true, batch("approved", "document:42"))).unwrap();
        assert_eq!(reused.batch.status, "approved", "a reused reading may be decided already; the panel says so");
        let no_id = Fake::new(|a, _| Ok(if a[0] == "sources" { json!({"item":{"id":"9"}}) } else { Value::Null }));
        assert!(run(&no_id).is_err(), "only the documented field names the batch");
    }

    #[test]
    fn suggestions_come_back_as_the_findings_batch_the_owner_ticks() {
        let fake = suggesting(true, batch("proposed", "document:42"));
        let s = suggest_with(
            &|a: &[String], i: Option<&[u8]>| fake.feed(a, i),
            "document:42",
            "ollama",
            &strs(&["person:7"]),
            false,
        )
        .unwrap();
        assert!(s.reused);
        assert_eq!(s.batch.reference, "action:9");
        assert_eq!(s.batch.findings.as_ref().unwrap()[0].text, "Delivery is on the 28th");
        assert_eq!(
            fake.seen()[0].0,
            strs(&[
                "sources",
                "suggest",
                "document:42",
                "--provider=ollama",
                "--subject=person:7",
                "--from-app",
                "--json",
                "--no-record"
            ])
        );
        assert_eq!(fake.seen()[1].0, strs(&["actions", "show", "9", "--json", "--no-record"]));
    }
}
