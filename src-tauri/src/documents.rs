//! The Documents page: every document memo stores, of every account, through memo's own `documents tree|list|show`.
//! Titles, folders, paths and text are the owner's own data on the owner's own page, shown unmasked like the Memory
//! and People pages, never logged.

use crate::catalog::{self, Tool};
use crate::memo_cli::{self, Failure};
use crate::skills::body;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_mins(1);
const QUIET: [&str; 2] = ["--json", "--no-record"];
/// memo's own bounds: a page holds 1–500 documents, the tree 0–20 folder levels, a text read 1–200 000 characters.
const MAX_LIMIT: u32 = 500;
const DEPTH: u32 = 3;
pub const TEXT_PART: u32 = 20_000;
const MAX_QUERY: usize = 2_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentsSource {
    pub min_version: String,
}

/// The account a document is in, as memo names it: `source` is what a `source:` term takes.
#[derive(specta::Type, Serialize, Debug, PartialEq, Clone)]
pub struct DocumentAccount {
    pub provider: String,
    pub account: String,
    pub source: String,
    pub label: String,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct DocumentFolder {
    pub path: String,
    pub name: String,
    pub depth: u32,
    pub count: u64,
}

/// One account holding documents, with its folders parents first.
#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct DocumentSource {
    pub provider: String,
    pub source: String,
    pub label: String,
    pub name: Option<String>,
    pub count: u64,
    /// Documents in no folder.
    pub loose: u64,
    pub folders: Vec<DocumentFolder>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DocumentsRead {
    Missing,
    /// The installed memo has no `documents` commands; the page offers its update.
    Old {
        version: Option<String>,
        need: String,
    },
    Ready {
        sources: Vec<DocumentSource>,
    },
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRow {
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: Option<String>,
    pub file_name: Option<String>,
    pub kind: String,
    pub mime: Option<String>,
    pub size: Option<u64>,
    pub source: DocumentAccount,
    pub folder: Option<String>,
    pub path: Option<String>,
    pub url: Option<String>,
    /// memo keeps the file on this computer; the path itself stays in Rust, which reads it again to show it.
    pub local: bool,
    pub source_modified_at: Option<String>,
    pub stored_at: Option<String>,
    pub has_text: bool,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPage {
    pub documents: Vec<DocumentRow>,
    pub total: u64,
    /// memo stopped counting: `total` is a floor.
    pub total_more: bool,
    pub more: bool,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct DocumentPerson {
    #[serde(rename = "ref")]
    pub reference: String,
    pub name: Option<String>,
    pub kind: String,
}

/// A meeting or a calendar event the document belongs to.
#[derive(specta::Type, Serialize, Debug, PartialEq)]
pub struct DocumentLinked {
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: Option<String>,
    pub at: Option<String>,
    pub role: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentDetails {
    pub document: DocumentRow,
    pub text: Option<String>,
    pub text_offset: u64,
    /// Where the next part starts, in characters as memo's SQLite counts them; JavaScript's `length` counts an emoji
    /// as two, so the page never adds it up itself.
    pub next_cursor: u64,
    pub text_length: u64,
    pub has_more: bool,
    pub extraction_error: Option<String>,
    pub language: Option<String>,
    pub tags: Vec<String>,
    pub people: Vec<DocumentPerson>,
    pub meetings: Vec<DocumentLinked>,
    pub events: Vec<DocumentLinked>,
}

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(QUIET.iter()).map(|s| (*s).to_string()).collect()
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn count(v: &Value, key: &str) -> u64 {
    v[key].as_u64().unwrap_or(0)
}

/// `document:<id>`, the only way the page names a document to memo.
fn document_ref(s: &str) -> Result<&str, String> {
    let id = s.strip_prefix("document:").unwrap_or_default();
    if id.is_empty() || id.len() > 15 || id.starts_with('0') || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not a document: {s}"));
    }
    Ok(s)
}

/// The search goes to memo as one word after `--`, so it can never read as an option.
fn query_word(query: &str) -> Result<String, String> {
    let q = query.trim();
    if q.len() > MAX_QUERY {
        return Err("That search is too long.".into());
    }
    if q.chars().any(char::is_control) {
        return Err("That search holds a character memo cannot take.".into());
    }
    Ok(q.to_string())
}

fn account_of(v: &Value) -> Option<DocumentAccount> {
    Some(DocumentAccount {
        provider: text(v, "provider")?,
        account: text(v, "account")?,
        source: text(v, "source")?,
        label: text(v, "label").unwrap_or_default(),
    })
}

fn source_of(v: &Value) -> Option<DocumentSource> {
    let folders = items_at(v, "folders")
        .iter()
        .filter_map(|f| {
            Some(DocumentFolder {
                path: text(f, "path")?,
                name: text(f, "name")?,
                depth: u32::try_from(count(f, "depth")).unwrap_or(u32::MAX),
                count: count(f, "count"),
            })
        })
        .collect();
    let account = account_of(v)?;
    Some(DocumentSource {
        provider: account.provider,
        source: account.source,
        label: account.label,
        name: text(v, "name"),
        count: count(v, "count"),
        loose: count(v, "loose"),
        folders,
    })
}

fn items_at<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v[key].as_array().map_or(&[], Vec::as_slice)
}

fn row_of(v: &Value) -> Option<DocumentRow> {
    let reference = text(v, "ref")?;
    document_ref(&reference).ok()?;
    Some(DocumentRow {
        reference,
        title: text(v, "title"),
        file_name: text(v, "file_name"),
        kind: text(v, "kind").unwrap_or_else(|| "other".into()),
        mime: text(v, "mime"),
        size: v["size"].as_u64(),
        source: account_of(&v["source"])?,
        folder: text(v, "folder"),
        path: text(v, "path"),
        url: text(v, "url").filter(|u| u.starts_with("https://")),
        local: text(v, "local_path").is_some(),
        source_modified_at: text(v, "source_modified_at"),
        stored_at: text(v, "stored_at"),
        has_text: v["has_text"].as_bool().unwrap_or(false),
    })
}

fn linked(v: &Value) -> Option<DocumentLinked> {
    Some(DocumentLinked {
        reference: text(v, "ref")?,
        title: text(v, "title"),
        at: text(v, "at"),
        role: text(v, "role"),
    })
}

fn details_of(v: &Value) -> Option<DocumentDetails> {
    let part = v["text"].as_str().map(str::to_string);
    let text_offset = count(v, "text_offset");
    Some(DocumentDetails {
        document: row_of(v)?,
        next_cursor: text_offset + part.as_deref().map_or(0, |t| t.chars().count() as u64),
        text: part,
        text_offset,
        text_length: count(v, "text_length"),
        has_more: v["has_more"].as_bool().unwrap_or(false),
        extraction_error: text(v, "extraction_error"),
        language: text(v, "language"),
        tags: items_at(v, "tags").iter().filter_map(|t| t.as_str().map(str::to_string)).collect(),
        people: items_at(v, "people")
            .iter()
            .filter_map(|p| {
                Some(DocumentPerson {
                    reference: text(p, "ref")?,
                    name: text(p, "name"),
                    kind: text(p, "kind").unwrap_or_default(),
                })
            })
            .collect(),
        meetings: items_at(v, "meetings").iter().filter_map(linked).collect(),
        events: items_at(v, "events").iter().filter_map(linked).collect(),
    })
}

type Call<'a> = memo_cli::Call<'a>;

fn tree_with(call: &Call) -> Result<DocumentsRead, Failure> {
    let v = call(&words(&["documents", "tree", "--depth", &DEPTH.to_string()]))?;
    Ok(DocumentsRead::Ready { sources: items_at(&v, "items").iter().filter_map(source_of).collect() })
}

fn list_with(call: &Call, query: &str, page: u32, limit: u32) -> Result<DocumentPage, Failure> {
    let (limit, page) = (limit.to_string(), page.to_string());
    let mut args = words(&["documents", "list", "--limit", &limit, "--page", &page]);
    let q = query_word(query).map_err(Failure::plain)?;
    if !q.is_empty() {
        args.extend(["--".to_string(), q]);
    }
    let v = call(&args)?;
    let total = &v["page"]["total"];
    let documents: Vec<DocumentRow> = items_at(&v, "items").iter().filter_map(row_of).collect();
    Ok(DocumentPage {
        total: total["value"].as_u64().unwrap_or(documents.len() as u64),
        total_more: total["relation"].as_str().is_some_and(|r| r != "eq"),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
        documents,
    })
}

fn show_args(reference: &str, cursor: u64, max: u32) -> Vec<String> {
    words(&["documents", "show", reference, "--cursor", &cursor.to_string(), "--max-chars", &max.to_string()])
}

fn show_with(call: &Call, reference: &str, cursor: u64) -> Result<DocumentDetails, Failure> {
    let v = call(&show_args(reference, cursor, TEXT_PART))?;
    details_of(body(&v)).ok_or_else(|| Failure::plain("Memo's answer about this document could not be read."))
}

/// The file memo keeps for a document, found again from memo's own answer, never from the interface.
fn local_file(call: &Call, reference: &str) -> Result<PathBuf, Failure> {
    let v = call(&show_args(reference, 0, 1))?;
    let path = text(body(&v), "local_path").ok_or_else(|| Failure::plain("Memo keeps no file for this document."))?;
    let file = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| Failure::plain("The document's file is not on this computer any more."))?;
    if !file.is_file() {
        return Err(Failure::plain("The document's file is not on this computer any more."));
    }
    Ok(file)
}

fn memo() -> Result<&'static Tool, String> {
    catalog::tool("memo")
}

fn with_memo<T>(f: impl FnOnce(&Call) -> Result<T, Failure>) -> Result<T, String> {
    memo_cli::with_memo(TIMEOUT, f)
}

fn limits(page: u32, limit: u32) -> Result<(), String> {
    if page == 0 || !(1..=MAX_LIMIT).contains(&limit) {
        return Err("That page of documents does not exist.".into());
    }
    Ok(())
}

/// The page's first read: the accounts and folders, or why memo cannot give them.
pub fn read() -> Result<DocumentsRead, String> {
    let tool = memo()?;
    let need = tool.documents.as_ref().ok_or("Memo has no Documents commands in the catalog")?.min_version.clone();
    let state = crate::tools::detect(tool, false);
    let Some(first) = state.installs.first() else { return Ok(DocumentsRead::Missing) };
    if crate::tools::older(first.version.as_deref(), &need) {
        return Ok(DocumentsRead::Old { version: first.version.clone(), need });
    }
    let version = first.version.clone();
    with_memo(|call| match tree_with(call) {
        Err(f) if f.unknown_command() => Ok(DocumentsRead::Old { version, need }),
        r => r,
    })
}

pub fn list(query: &str, page: u32, limit: u32) -> Result<DocumentPage, String> {
    limits(page, limit)?;
    with_memo(|call| list_with(call, query, page, limit))
}

pub fn show(reference: &str, cursor: u64) -> Result<DocumentDetails, String> {
    let reference = document_ref(reference)?;
    with_memo(|call| show_with(call, reference, cursor))
}

/// The file shown in its folder, never opened: a document's file may come from anywhere, and opening could run it.
pub fn reveal(reference: &str) -> Result<(), String> {
    let reference = document_ref(reference)?;
    let file = with_memo(|call| local_file(call, reference))?;
    tauri_plugin_opener::reveal_item_in_dir(file).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn row() -> Value {
        json!({
            "ref": "document:40", "id": "40", "title": "Budget 2027", "file_name": "budget.pdf", "kind": "pdf",
            "mime": "application/pdf", "size": 52_400,
            "source": { "provider": "google-drive", "account": "ana@example.org",
                        "source": "google-drive:ana@example.org", "label": "Google Drive · Ana" },
            "folder": "Projects/Acme", "path": "Projects/Acme/budget.pdf",
            "url": "https://drive.google.com/file/d/abc", "local_path": null,
            "source_modified_at": "2026-11-10T09:00:00.000Z", "stored_at": "2026-11-10T09:05:00.000Z",
            "has_text": true, "untrusted": ["title"]
        })
    }

    #[test]
    fn reads_one_page_with_memo_s_total_and_a_capped_count() {
        let seen = Mutex::new(Vec::new());
        let call = |args: &[String]| {
            seen.lock().unwrap().push(args.to_vec());
            Ok(json!({ "items": [row(), { "ref": "note:1" }],
                       "page": { "has_more": true, "total": { "value": 10_000, "relation": "gte" } } }))
        };
        let page = list_with(&call, " budget kind:pdf ", 2, 25).unwrap();
        assert_eq!(page.documents.len(), 1, "a row that is not a document is left out");
        assert_eq!((page.total, page.total_more, page.more), (10_000, true, true));
        assert_eq!(page.documents[0].source.source, "google-drive:ana@example.org");
        assert!(!page.documents[0].local);
        assert_eq!(
            seen.lock().unwrap()[0],
            ["documents", "list", "--limit", "25", "--page", "2", "--json", "--no-record", "--", "budget kind:pdf"]
        );
    }

    #[test]
    fn sends_no_query_word_for_an_empty_search() {
        let seen = Mutex::new(Vec::new());
        let call = |args: &[String]| {
            seen.lock().unwrap().push(args.to_vec());
            Ok(json!({ "items": [], "page": { "has_more": false, "total": { "value": 0, "relation": "eq" } } }))
        };
        list_with(&call, "  ", 1, 50).unwrap();
        assert!(!seen.lock().unwrap()[0].contains(&"--".to_string()));
    }

    #[test]
    fn reads_the_tree_with_its_folders_parents_first() {
        let call = |_: &[String]| {
            Ok(json!({ "items": [{
                "provider": "notes", "account": "1", "source": "notes:1", "label": "Notes · Synthetic notes",
                "name": "Synthetic notes", "count": 2, "loose": 1,
                "folders": [{ "path": "Projects", "name": "Projects", "depth": 1, "count": 1 },
                            { "path": "Projects/Acme", "name": "Acme", "depth": 2, "count": 1 }]
            }] }))
        };
        let DocumentsRead::Ready { sources } = tree_with(&call).unwrap() else { panic!("not ready") };
        assert_eq!((sources[0].count, sources[0].loose, sources[0].folders.len()), (2, 1, 2));
        assert_eq!(sources[0].folders[1].depth, 2);
    }

    #[test]
    fn reads_a_document_s_text_people_and_meetings() {
        let call = |args: &[String]| {
            assert_eq!(args[..7], ["documents", "show", "document:40", "--cursor", "20000", "--max-chars", "20000"]);
            let mut item = row();
            let extra = json!({
                "text": "an invented budget 📈", "text_offset": 20_000, "text_length": 40_018, "has_more": false,
                "extraction": "pdf", "extraction_error": null, "language": "en", "tags": ["budget"],
                "people": [{ "ref": "person:7", "name": "Kai Sample", "kind": "person" }],
                "meetings": [{ "ref": "meeting:3/7", "title": "Board", "at": "2026-11-12T10:00:00.000Z", "role": null }],
                "events": []
            });
            item.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            Ok(json!({ "item": item }))
        };
        let d = show_with(&call, "document:40", 20_000).unwrap();
        assert_eq!((d.text_offset, d.text_length, d.has_more), (20_000, 40_018, false));
        assert_eq!(d.next_cursor, 20_020, "the chart emoji is one character to memo, two to JavaScript");
        assert_eq!(d.people[0].reference, "person:7");
        assert_eq!(d.meetings[0].reference, "meeting:3/7");
        assert_eq!(d.tags, ["budget"]);
    }

    #[test]
    fn refuses_a_ref_that_is_not_a_document_and_a_page_that_cannot_exist() {
        for bad in ["note:1", "document:", "document:01", "document:1 --yes", "--help"] {
            assert!(document_ref(bad).is_err(), "{bad}");
        }
        assert!(limits(0, 25).is_err());
        assert!(limits(1, 0).is_err());
        assert!(limits(1, MAX_LIMIT + 1).is_err());
        assert!(query_word("budget\n--yes").is_err());
        assert!(query_word(&"a".repeat(MAX_QUERY + 1)).is_err());
    }

    #[test]
    fn keeps_only_https_links_to_open() {
        let mut v = row();
        v["url"] = json!("file:///etc/passwd");
        assert_eq!(row_of(&v).unwrap().url, None);
    }

    #[test]
    fn the_catalog_names_the_first_memo_with_documents() {
        let need = &memo().unwrap().documents.as_ref().unwrap().min_version;
        assert!(semver::Version::parse(need).is_ok());
    }
}
