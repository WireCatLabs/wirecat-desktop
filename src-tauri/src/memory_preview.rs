//! A look at a source before it is added: the picked file read here (a picture as a thumbnail, a text file's first
//! lines), a web page read by memo without keeping it. The app never fetches a page itself: memo refuses private
//! addresses, sign-in pages and long redirect chains, and a page's own pictures would load from someone else's server.

use crate::memory::{answer, text, words};
use crate::skills::body;
use base64::Engine;
use serde::Serialize;
use serde_json::Value;
use std::io::Read;
use std::path::Path;
use std::time::Duration;

const IMAGE_BYTES: u64 = 4 * 1024 * 1024;
const TEXT_BYTES: u64 = 16 * 1024;
const EXCERPT_CHARS: usize = 600;
const PAGE: Duration = Duration::from_secs(45);

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub name: String,
    pub bytes: u64,
    pub mime: Option<String>,
    /// A `data:` address the window may show; only for a picture under 4 MiB.
    pub image: Option<String>,
    pub excerpt: Option<String>,
}

fn mime_of(ext: &str) -> Option<&'static str> {
    Some(match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "txt" => "text/plain",
        "md" | "markdown" => "text/markdown",
        "csv" => "text/csv",
        "tsv" => "text/tab-separated-values",
        "pdf" => "application/pdf",
        "docx" | "doc" | "odt" => "application/msword",
        "xlsx" | "xls" | "ods" => "application/vnd.ms-excel",
        "pptx" => "application/vnd.ms-powerpoint",
        "html" | "htm" => "text/html",
        "epub" => "application/epub+zip",
        _ => return None,
    })
}

fn excerpt(text: &str) -> Option<String> {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.is_empty() {
        return None;
    }
    let cut: String = flat.chars().take(EXCERPT_CHARS).collect();
    Some(if cut.chars().count() < flat.chars().count() { format!("{cut}…") } else { cut })
}

fn head(path: &Path, bytes: u64) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    std::fs::File::open(path)
        .and_then(|f| f.take(bytes).read_to_end(&mut out))
        .map_err(|_| "The file cannot be read.".to_string())?;
    Ok(out)
}

pub fn file(path: &Path) -> Result<FilePreview, String> {
    let meta = std::fs::metadata(path).map_err(|_| "The file is not there any more.".to_string())?;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
    let mime = mime_of(&ext);
    let bytes = meta.len();
    let image = match mime {
        Some(m) if m.starts_with("image/") && bytes <= IMAGE_BYTES => {
            let data = base64::engine::general_purpose::STANDARD.encode(head(path, IMAGE_BYTES)?);
            Some(format!("data:{m};base64,{data}"))
        }
        _ => None,
    };
    let excerpt = match mime {
        Some(m) if m.starts_with("text/") && m != "text/html" => {
            excerpt(&String::from_utf8_lossy(&head(path, TEXT_BYTES)?))
        }
        _ => None,
    };
    Ok(FilePreview { name, bytes, mime: mime.map(str::to_string), image, excerpt })
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    pub url: String,
    pub title: Option<String>,
    pub site: Option<String>,
    pub description: Option<String>,
    pub excerpt: Option<String>,
    pub kind: Option<String>,
    pub chars: Option<u64>,
}

type Call<'a> = dyn Fn(&[String]) -> Result<Value, String> + Sync + 'a;

/// `None` from a memo without `sources preview`: the panel then shows the page once it is saved, as before.
fn link_with(call: &Call, url: &str) -> Result<Option<LinkPreview>, String> {
    let u = crate::memory_add::link(url)?;
    let v = match call(&words(&["sources", "preview", u])) {
        Ok(v) => v,
        Err(e) if e.contains("unknown command") || e.contains("unknown option") => return Ok(None),
        Err(e) => return Err(e),
    };
    let item = body(&v);
    Ok(Some(LinkPreview {
        url: text(item, "url").unwrap_or_else(|| u.to_string()),
        title: text(item, "title"),
        site: text(item, "site"),
        description: text(item, "description"),
        excerpt: text(item, "excerpt").and_then(|e| excerpt(&e)),
        kind: text(item, "kind"),
        chars: item["chars"].as_u64(),
    }))
}

pub fn link(url: &str) -> Result<Option<LinkPreview>, String> {
    let bin = crate::memory::memo_bin()?;
    link_with(
        &|args: &[String]| {
            let refs: Vec<&str> = args.iter().map(String::as_str).collect();
            let out = crate::memo_server::run(&bin, &refs, PAGE).map_err(|e| e.to_string())?;
            answer(&out)
        },
        url,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-preview-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join(name);
        std::fs::write(&p, bytes).unwrap();
        p
    }

    #[test]
    fn a_picture_comes_as_a_thumbnail_and_a_text_file_as_its_first_words() {
        let png = file(&temp("a.PNG", &[0x89, b'P', b'N', b'G'])).unwrap();
        assert_eq!(png.image.as_deref(), Some("data:image/png;base64,iVBORw=="));
        assert_eq!(png.excerpt, None);
        let note = file(&temp("n.md", "# Plan\n\n  Kai   signs\n".as_bytes())).unwrap();
        assert_eq!((note.image, note.excerpt.as_deref()), (None, Some("# Plan Kai signs")));
        let pdf = file(&temp("d.pdf", b"%PDF")).unwrap();
        assert_eq!((pdf.mime.as_deref(), pdf.image, pdf.excerpt, pdf.bytes), (Some("application/pdf"), None, None, 4));
    }

    #[test]
    fn a_long_text_is_cut_with_an_ellipsis() {
        let long = "word ".repeat(400);
        let cut = excerpt(&long).unwrap();
        assert!(cut.ends_with('…'));
        assert_eq!(cut.chars().count(), EXCERPT_CHARS + 1);
    }

    #[test]
    fn a_page_is_read_by_memo_and_an_older_memo_gives_no_preview() {
        let page = |_: &[String]| {
            Ok(json!({"item":{"url":"https://example.org/a","title":"A page","site":"example.org",
                "description":"About a","excerpt":"First   words","kind":"web-page","chars":3211}}))
        };
        let got = link_with(&page, " https://example.org/a ").unwrap().unwrap();
        assert_eq!(
            (got.title.as_deref(), got.excerpt.as_deref(), got.chars),
            (Some("A page"), Some("First words"), Some(3211))
        );
        let old = |_: &[String]| Err("error: unknown command 'preview'".to_string());
        assert_eq!(link_with(&old, "https://example.org/a").unwrap(), None);
        let never = |_: &[String]| -> Result<Value, String> { panic!("must not run") };
        assert!(link_with(&never, "file:///etc/passwd").is_err());
    }
}
