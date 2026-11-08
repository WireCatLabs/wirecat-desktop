//! The Digests page: memo's morning digest runs, read from the files its schedule keeps
//! (`<memo state>/schedules/morning-digest/runs/<stamp>.md`, and `<stamp>.report.json`, the checked
//! `wirecat.report/1` document, from cli-core with report rendering). memo has no command that lists a schedule's
//! runs, so the files are the only source. Shown unmasked, an exception to rule 4 like memory.rs: the digest is the
//! owner's own summary of his own data. Never logged or put in a report.

use crate::deep_link::{self, Target};
use crate::{catalog, storage};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const SCHEDULE: &str = "morning-digest";
/// A digest is a page of text; a larger file is not one memo wrote.
const MAX_FILE: u64 = 1024 * 1024;
const MAX_SUMMARY: usize = 200;

/// One day on the Digests page: its newest run.
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Day {
    /// The day the digest is about: the document's own `date`, or the run's local day for an older run.
    pub date: String,
    /// The run's file stamp, `2026-11-08T07-30-10Z`; a newer stamp is a newer run.
    pub stamp: String,
    pub summary: Option<String>,
    /// The run kept a `wirecat.report/1` document; an older one has only its text.
    pub report: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Digest {
    pub date: String,
    pub stamp: String,
    /// The checked document as cli-core wrote it; the interface checks its shape again.
    pub document: Option<Value>,
    /// The run's plain text, for a run without a document.
    pub text: Option<String>,
}

fn runs_dir() -> Result<PathBuf, String> {
    let memo = catalog::tool("memo")?;
    Ok(storage::state_folder(&memo.storage).join("schedules").join(SCHEDULE).join("runs"))
}

/// `2026-11-08T07-30-10Z`, as cli-core names a run's files.
fn is_stamp(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 20
        && b.iter().enumerate().all(|(i, c)| match i {
            4 | 7 | 13 | 16 => *c == b'-',
            10 => *c == b'T',
            19 => *c == b'Z',
            _ => c.is_ascii_digit(),
        })
}

fn read_small(path: &Path) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE {
        return None;
    }
    std::fs::read_to_string(path).ok()
}

/// The local day a run started, for a run whose document does not name one.
fn local_day(stamp: &str) -> Option<String> {
    let iso = format!("{}T{}:{}:{}Z", &stamp[..10], &stamp[11..13], &stamp[14..16], &stamp[17..19]);
    let at = chrono::DateTime::parse_from_rfc3339(&iso).ok()?;
    Some(at.with_timezone(&chrono::Local).format("%Y-%m-%d").to_string())
}

fn document(dir: &Path, stamp: &str) -> Option<Value> {
    let value: Value = serde_json::from_str(&read_small(&dir.join(format!("{stamp}.report.json")))?).ok()?;
    (value.get("format").and_then(Value::as_str) == Some("wirecat.report/1")).then_some(value)
}

fn text(dir: &Path, stamp: &str) -> Option<String> {
    read_small(&dir.join(format!("{stamp}.md"))).filter(|t| !t.trim().is_empty())
}

fn short(summary: &str) -> String {
    let line = summary.lines().next().unwrap_or_default().trim();
    if line.chars().count() <= MAX_SUMMARY {
        line.to_string()
    } else {
        format!("{}…", line.chars().take(MAX_SUMMARY - 1).collect::<String>())
    }
}

fn day_of(dir: &Path, stamp: &str) -> Option<Day> {
    if let Some(doc) = document(dir, stamp) {
        let date = doc.get("date").and_then(Value::as_str).filter(|d| deep_link::is_date(d))?.to_string();
        let summary = doc.get("summary").and_then(Value::as_str).map(short);
        return Some(Day { date, stamp: stamp.to_string(), summary, report: true });
    }
    let text = text(dir, stamp)?;
    // An old run's text has no summary field; its first line is the nearest thing (cli-core's notice does the same).
    let summary = text.lines().find(|l| !l.trim().is_empty()).map(short);
    Some(Day { date: local_day(stamp)?, stamp: stamp.to_string(), summary, report: false })
}

fn days_in(dir: &Path) -> Vec<Day> {
    let Ok(entries) = std::fs::read_dir(dir) else { return Vec::new() };
    let mut stamps: Vec<String> = entries
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter_map(|name| name.split('.').next().map(str::to_string))
        .filter(|stamp| is_stamp(stamp))
        .collect();
    stamps.sort_unstable();
    stamps.dedup();
    let mut by_day: BTreeMap<String, Day> = BTreeMap::new();
    for stamp in stamps {
        if let Some(day) = day_of(dir, &stamp) {
            by_day.insert(day.date.clone(), day);
        }
    }
    by_day.into_values().rev().collect()
}

/// One entry per day, newest first; a day with several runs shows its newest. No folder yet is no digest yet.
pub fn list() -> Result<Vec<Day>, String> {
    Ok(days_in(&runs_dir()?))
}

fn show_in(dir: &Path, date: &str) -> Result<Digest, String> {
    if !deep_link::is_date(date) {
        return Err(format!("not a day: {date}"));
    }
    let day = days_in(dir).into_iter().find(|d| d.date == date).ok_or_else(|| format!("no digest for {date}"))?;
    let document = if day.report { document(dir, &day.stamp) } else { None };
    let text = if document.is_none() { text(dir, &day.stamp) } else { None };
    Ok(Digest { date: day.date, stamp: day.stamp, document, text })
}

pub fn show(date: &str) -> Result<Digest, String> {
    show_in(&runs_dir()?, date)
}

fn one_line(s: &str, limit: usize) -> String {
    s.chars().filter(|c| !c.is_control()).take(limit).collect()
}

/// A system notification for a new digest; a click opens its day. The words come from the interface, in its language.
pub fn notify(app: &tauri::AppHandle, date: &str, title: &str, body: &str, open: &str) -> Result<(), String> {
    if !deep_link::is_date(date) {
        return Err(format!("not a day: {date}"));
    }
    let mut note = notify_rust::Notification::new();
    note.summary(&one_line(title, 120))
        .body(&one_line(body, 240))
        .appname("WireCat")
        .action("default", &one_line(open, 40));
    // An installed copy is registered under the bundle identifier; a dev build would fail to show under it.
    #[cfg(all(windows, not(debug_assertions)))]
    note.app_id("dev.wirecat.desktop");
    let handle = note.show().map_err(|e| e.to_string())?;
    let app = app.clone();
    let date = date.to_string();
    // Linux and macOS answer "default" for a click on the notice, Windows for its Open button; until the owner acts or
    // the notice closes, this thread waits.
    std::thread::spawn(move || {
        handle.wait_for_action(|action| {
            if action == "default" {
                deep_link::open_target(&app, Target::Digest { date });
            }
        });
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(dir: &Path, name: &str, body: &str) {
        std::fs::write(dir.join(name), body).unwrap();
    }

    fn report(date: &str, summary: &str) -> String {
        format!(
            r#"{{"format":"wirecat.report/1","kind":"morning-digest","date":"{date}","summary":"{summary}","sections":[]}}"#
        )
    }

    #[test]
    fn lists_one_day_per_date_newest_first_with_its_newest_run() {
        let dir = std::env::temp_dir().join(format!("wirecat-digests-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        write(&dir, "2026-11-07T07-30-00Z.md", "{}");
        write(&dir, "2026-11-07T07-30-00Z.report.json", &report("2026-11-07", "Two replies wait."));
        write(&dir, "2026-11-08T07-30-10Z.md", "{}");
        write(&dir, "2026-11-08T07-30-10Z.report.json", &report("2026-11-08", "Early run."));
        write(&dir, "2026-11-08T13-51-48Z.md", "{}");
        write(&dir, "2026-11-08T13-51-48Z.report.json", &report("2026-11-08", "Later run."));
        write(&dir, "2026-11-08T13-51-48Z.jsonl", "");
        write(&dir, "latest.md", "not a run");
        write(&dir, "2026-11-09T07-30-00Z.md", "   ");

        let days = days_in(&dir);
        let shown: Vec<(&str, &str, Option<&str>)> =
            days.iter().map(|d| (d.date.as_str(), d.stamp.as_str(), d.summary.as_deref())).collect();
        assert_eq!(
            shown,
            [
                ("2026-11-08", "2026-11-08T13-51-48Z", Some("Later run.")),
                ("2026-11-07", "2026-11-07T07-30-00Z", Some("Two replies wait.")),
            ]
        );
        let digest = show_in(&dir, "2026-11-08").unwrap();
        assert_eq!(digest.document.unwrap()["summary"], "Later run.");
        assert!(digest.text.is_none());
        assert!(show_in(&dir, "2026-11-10").is_err());
        assert!(show_in(&dir, "../etc").is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_older_run_without_a_document_shows_its_text() {
        let dir = std::env::temp_dir().join(format!("wirecat-digests-old-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        write(&dir, "2026-11-06T12-00-00Z.md", "\n# Morning digest\n\n- reply to Anna\n");
        write(&dir, "2026-11-06T12-00-00Z.report.json", r#"{"format":"something/else"}"#);
        let days = days_in(&dir);
        assert_eq!(days.len(), 1);
        assert!(!days[0].report);
        assert_eq!(days[0].summary.as_deref(), Some("# Morning digest"));
        let digest = show_in(&dir, &days[0].date).unwrap();
        assert!(digest.document.is_none());
        assert!(digest.text.unwrap().contains("reply to Anna"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reads_only_run_stamps() {
        assert!(is_stamp("2026-11-08T07-30-10Z"));
        for bad in ["latest", "2026-11-08T07:30:10Z", "2026-11-08T07-30-10", "../2026-11-08T07-30"] {
            assert!(!is_stamp(bad), "{bad}");
        }
    }
}
