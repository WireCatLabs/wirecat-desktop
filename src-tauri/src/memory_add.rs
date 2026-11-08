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

type Feed<'a> = dyn Fn(&[String], Option<&[u8]>) -> Result<Value, String> + Sync + 'a;

fn fed(bin: &Path, args: &[String], input: Option<&[u8]>, timeout: Duration) -> Result<Value, String> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(bin, &refs, Some(&paths::search_path()));
    let (mut stdout, mut stderr) = (String::new(), String::new());
    let code = run::stream_with_input(
        cmd,
        input,
        timeout,
        || false,
        |line| match line {
            run::Line::Out(l) => stdout.push_str(&(l + "\n")),
            run::Line::Err(l) => stderr.push_str(&(l + "\n")),
        },
    )
    .map_err(|e| e.to_string())?;
    panel_answer(&run::Output { code, stdout, stderr }, input.is_some())
}

/// memo's refusals of a source or a reader, which the panel words in the owner's language.
const WORDED: [&str; 2] = ["source.", "reader."];
pub const REFUSED: &str = "memo.refused";

/// memo's message can quote what it read on stdin (the pasted text or the key), escaped or cut so that no replace
/// finds it. A run fed on stdin therefore answers only with a reason the panel knows, never with memo's words.
fn panel_answer(out: &run::Output, fed: bool) -> Result<Value, String> {
    let reason = out.json().and_then(|v| text(&v["error"], "reason"));
    let worded = reason.filter(|r| r.len() <= 60 && plain(r).is_some() && WORDED.iter().any(|p| r.starts_with(p)));
    match (answer(out), worded) {
        (Ok(v), _) => Ok(v),
        (Err(_), Some(reason)) => Err(reason),
        (Err(_), None) if fed => Err(REFUSED.into()),
        (Err(e), None) => Err(e),
    }
}

fn with_memo<T>(timeout: Duration, f: impl FnOnce(&Feed) -> Result<T, String>) -> Result<T, String> {
    let bin = memory::memo_bin()?;
    f(&|args: &[String], input: Option<&[u8]>| fed(&bin, args, input, timeout))
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
}

fn one_line(what: &str, s: &str, most: usize) -> Result<String, String> {
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

fn link(url: &str) -> Result<&str, String> {
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
}

/// A reader or provider id goes into a command line, so it is only ever a plain lowercase word.
fn id_word<'a>(what: &str, s: &'a str) -> Result<&'a str, String> {
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
    })
}

// The C6 commands are written against the plan's interface; each line lives only here, to adjust in one place.
const READERS: [&str; 2] = ["sources", "readers"];
const CHOOSE: [&str; 3] = ["config", "set", "sources.reader"];
const KEY: [&str; 3] = ["models", "keys", "set"];
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
    let mut args: Vec<String> = CHOOSE.iter().map(|s| (*s).to_string()).collect();
    args.push(id_word("reader", id)?.into());
    feed(&words(&args.iter().map(String::as_str).collect::<Vec<_>>()), None)?;
    readers_with(feed)
}

pub fn choose(id: &str) -> Result<Vec<Reader>, String> {
    with_memo(READ, |feed| choose_with(feed, id))
}

/// Whether memo kept the key, and where; the key itself never comes back.
#[derive(Serialize, Debug, PartialEq)]
pub struct KeySaved {
    pub provider: String,
    /// `keyring`, or `file` when no keyring answered.
    pub source: Option<String>,
}

fn key_with(feed: &Feed, provider: &str, key: &str) -> Result<KeySaved, String> {
    let key = key.trim();
    if key.is_empty() || key.len() > 400 || key.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("Paste the key as the provider shows it: one word, no spaces.".into());
    }
    let provider = id_word("provider", provider)?;
    let mut args: Vec<&str> = KEY.to_vec();
    args.push(provider);
    let v = feed(&words(&args), Some(key.as_bytes()))?;
    let item = body(&v);
    if item["stored"].as_bool() != Some(true) {
        return Err("Memo did not say the key was saved.".into());
    }
    Ok(KeySaved { provider: provider.into(), source: text(item, "source") })
}

pub fn set_key(provider: &str, key: &str) -> Result<KeySaved, String> {
    with_memo(READ, |feed| key_with(feed, provider, key))
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
    args.push(format!("--reader={}", id_word("reader", reader)?));
    for s in subjects {
        args.push(format!("--subject={}", subject(s)?));
    }
    if again {
        args.push("--again".into());
    }
    args.extend(words(&[]));
    let v = feed(&args, None)?;
    let item = body(&v);
    let id = id_of(&item[BATCH]).ok_or("Memo did not name the suggested facts")?;
    let reused = item["reused"].as_bool().unwrap_or(false);
    let batch = batch_of(&feed(&words(&["actions", "show", &id]), None)?, reference, reused)?;
    Ok(Suggested { batch, reused })
}

pub fn suggest(reference: &str, reader: &str, subjects: &[String], again: bool) -> Result<Suggested, String> {
    with_memo(SUGGEST, |feed| suggest_with(feed, reference, reader, subjects, again))
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

    // `memo sources add --json` from cli-memo #711, snake_cased by memo's itemAnswer.
    fn added_answer() -> Value {
        json!({"item":{"ref":"document:42","created":true,"duplicate_of":null,"title":"Call with Lena","kind":"text",
            "mime":null,"bytes":812,"chars":800,"truncated":false,"extractor":"text","read":"extracted","url":null,
            "kept":"text","searchable":{"words":true,"meaning":false},"subjects":["person:7"]}})
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
            json!({"ref":"document:42","created":true,"duplicateOf":null,"title":"Call with Lena","kind":"text",
                "mime":null,"bytes":812,"chars":800,"truncated":false,"read":"extracted","url":null,"kept":"text",
                "searchableWords":true,"searchableMeaning":false,"subjects":["person:7"]})
        );
        let r = reader(&json!({"id":"ollama","available":true,"model":"llama3.2","leaves_computer":false})).unwrap();
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            json!({"id":"ollama","available":true,"signedIn":null,"model":"llama3.2","provider":null,
                "leavesComputer":false,"readsFiles":true,"chosen":false})
        );
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
        assert_eq!(a.reference, "document:42");
        assert_eq!(a.kept.as_deref(), Some("text"));
        assert_eq!(a.subjects, ["person:7"]);
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
        assert_eq!(panel_answer(&refusal(""), true), Err(REFUSED.into()));
        assert_eq!(panel_answer(&refusal(r#","reason":"source.no-text""#), true), Err("source.no-text".into()));
        assert_eq!(panel_answer(&refusal(r#","reason":"store.busy""#), true), Err(REFUSED.into()));
        let unfed = panel_answer(&refusal(""), false).unwrap_err();
        assert!(unfed.contains("cannot read"), "a run with nothing on stdin keeps memo's words: {unfed}");
        let ok = run::Output { code: Some(0), stdout: r#"{"item":{"stored":true}}"#.into(), stderr: String::new() };
        assert!(panel_answer(&ok, true).is_ok());
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
        let out = run::Output {
            code: Some(1),
            stdout:
                r#"{"error":{"code":"validation_error","message":"localhost refused","reason":"source.url-refused"}}"#
                    .into(),
            stderr: String::new(),
        };
        assert_eq!(panel_answer(&out, false), Err("source.url-refused".into()));
        assert_eq!(answer(&out), Err("localhost refused".into()), "the Memory page's own calls keep memo's words");
    }

    #[test]
    fn mentions_keep_only_refs_that_can_become_subjects() {
        let fake = Fake::new(|_, _| {
            Ok(json!({"items":[{"ref":"person:7","type":"person","name":"Lena Ortiz","found_as":["Lena"]},
                {"ref":"organization:3","type":"organization","name":"Northbridge","found_as":["Northbridge"]},
                {"ref":"--all","type":"person","name":null,"found_as":[]}],
                "missing":[{"field":"organizations","why":"only the first 500"}]}))
        });
        let m = mentions_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "document:42").unwrap();
        assert_eq!(m.items.iter().map(|i| i.reference.as_str()).collect::<Vec<_>>(), ["person:7", "organization:3"]);
        assert!(m.partial);
        assert_eq!(fake.seen()[0].0, strs(&["sources", "mentions", "document:42", "--json", "--no-record"]));
        assert!(mentions_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "note:3").is_err());
    }

    #[test]
    fn readers_are_listed_as_memo_found_them_and_none_is_picked_here() {
        let fake = Fake::new(|a, _| {
            Ok(if a[0] == "sources" {
                json!({"items":[{"id":"claude-code","available":true,"signed_in":true,"model":"sonnet","provider":"anthropic",
                    "leaves_computer":true,"reads_files":false,"chosen":false},
                    {"id":"ollama","available":true,"model":"llama3.2","leaves_computer":false,"chosen":false},
                    {"id":"codex","available":false,"reads_files":true}]})
            } else {
                json!({"item":{"key":"sources.reader","value":"ollama"}})
            })
        });
        let feed = |a: &[String], i: Option<&[u8]>| fake.feed(a, i);
        let r = readers_with(&feed).unwrap();
        assert!(r.iter().all(|r| !r.chosen));
        assert!(!r[1].leaves_computer);
        assert!(r[2].leaves_computer, "unknown counts as leaving");
        assert!(r[1].reads_files, "unknown counts as reading files");
        assert!(!r[0].reads_files);
        choose_with(&feed, "ollama").unwrap();
        assert_eq!(fake.seen()[1].0, strs(&["config", "set", "sources.reader", "ollama", "--json", "--no-record"]));
        assert!(choose_with(&feed, "--all").is_err());
    }

    #[test]
    fn the_key_goes_on_stdin_and_never_comes_back() {
        let fake = Fake::new(|_, _| Err("the provider refused the key".into()));
        assert!(key_with(&|a: &[String], i: Option<&[u8]>| fake.feed(a, i), "openai", " sk-test-123 ").is_err());
        let (args, input) = &fake.seen()[0];
        assert_eq!(args, &strs(&["models", "keys", "set", "openai", "--json", "--no-record"]));
        assert_eq!(input.as_deref(), Some("sk-test-123"));
        let ok = Fake::new(|_, _| Ok(json!({"item":{"provider":"openai","stored":true,"source":"keyring"}})));
        let saved = key_with(&|a: &[String], i: Option<&[u8]>| ok.feed(a, i), "openai", "sk-test-123").unwrap();
        assert_eq!(saved, KeySaved { provider: "openai".into(), source: Some("keyring".into()) });
        assert!(key_with(&|a: &[String], i: Option<&[u8]>| ok.feed(a, i), "openai", "two words").is_err());
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
                "--reader=ollama",
                "--subject=person:7",
                "--json",
                "--no-record"
            ])
        );
        assert_eq!(fake.seen()[1].0, strs(&["actions", "show", "9", "--json", "--no-record"]));
    }
}
