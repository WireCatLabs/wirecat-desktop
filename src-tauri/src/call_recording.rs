//! A call's or meeting's recording, as the tool that recorded it answers `meetings show` (catalog `meetings`): which
//! stored meeting a link's provider id names, and whether its recording is a file on this computer. The window never
//! sends a path: each read asks the tool again and plays or opens only the file it names now. A recording kept on
//! the phone system (pbx over SFTP) or at the meeting service has no path here and is never fetched.

use crate::calls::tool_for;
use crate::catalog::{self, MeetingsSource};
use crate::memo_cli::Failure;
use serde::Serialize;
use serde_json::Value;
use specta::Type;
use std::path::{Path, PathBuf};
use std::time::Duration;

const READ: Duration = Duration::from_mins(1);
const MAX_MEETING: usize = 300;
/// Played from memory: an hour of 16-bit 8 kHz WAV is 58 MB. A larger file opens in the system's player instead.
pub const MAX_PLAYED: u64 = 200 * 1024 * 1024;
/// What `MixMonitor` and `Monitor` write on an Asterisk, and the formats a meeting service saves audio in.
const AUDIO: [&str; 9] = ["wav", "gsm", "mp3", "ogg", "opus", "flac", "m4a", "sln", "webm"];

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Recording {
    /// The tool lists no recording for this meeting.
    None,
    /// The tool lists one but says nothing of where it is: it is older than the `local_path` of its attachments.
    Unknown { name: Option<String> },
    /// Not on this computer: on the phone system, or at the meeting service.
    Elsewhere { name: Option<String> },
    /// The tool names a file that is not there any more.
    Gone { name: Option<String> },
    Here {
        name: Option<String>,
        mime: Option<String>,
        size: u64,
        /// Over `MAX_PLAYED`: offered to the system's player only.
        #[serde(rename = "tooLarge")]
        too_large: bool,
    },
}

#[derive(Serialize, Type, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingFound {
    /// `meeting:<account>/<meeting>`: what memo's `meetings show` takes.
    #[serde(rename = "ref")]
    pub reference: String,
    pub recording: Recording,
}

/// A stored meeting's ref or number, or the provider's own id (`1731571200.42#3` for a pbx call); it goes after the
/// profile as one word, so it may not read as an option.
fn meeting_word(meeting: &str) -> Result<&str, String> {
    let ok = !meeting.is_empty()
        && meeting.len() <= MAX_MEETING
        && !meeting.starts_with('-')
        && !meeting.chars().any(|c| c.is_control() || c.is_whitespace());
    if ok { Ok(meeting) } else { Err(format!("not a meeting: {meeting}")) }
}

fn show_args(src: &MeetingsSource, profile: &str, meeting: &str) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    let meeting = meeting_word(meeting)?;
    Ok(src
        .show
        .iter()
        .map(|w| match w.as_str() {
            "{profile}" => profile.to_string(),
            "{id}" => meeting.to_string(),
            _ => w.clone(),
        })
        .collect())
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)
}

fn is_audio(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| AUDIO.contains(&e.to_ascii_lowercase().as_str()))
}

/// The meeting's recording among its attachments: pbx names it `recording`, a meeting service by its audio type.
fn recording_of(item: &Value) -> Option<&Value> {
    item["attachments"].as_array()?.iter().find(|a| {
        a["kind"].as_str() == Some("recording") || a["mime"].as_str().is_some_and(|m| m.starts_with("audio/"))
    })
}

/// The file the tool names now, if it is an audio file on this computer.
fn file_of(attachment: &Value) -> Option<PathBuf> {
    let path = PathBuf::from(attachment["local_path"].as_str().filter(|p| !p.is_empty())?);
    let file = path.canonicalize().ok().filter(|f| f.is_file())?;
    is_audio(&file).then_some(file)
}

fn found_of(v: &Value) -> Option<MeetingFound> {
    let item = &v["item"];
    let reference = text(item, "ref").filter(|r| r.starts_with("meeting:"))?;
    let recording = match recording_of(item) {
        None => Recording::None,
        Some(a) => {
            let name = text(a, "name");
            match a.get("local_path") {
                None => Recording::Unknown { name },
                Some(Value::Null) => Recording::Elsewhere { name },
                Some(_) => match file_of(a) {
                    None => Recording::Gone { name },
                    Some(file) => {
                        let size = std::fs::metadata(&file).map_or(0, |m| m.len());
                        Recording::Here { name, mime: text(a, "mime"), size, too_large: size > MAX_PLAYED }
                    }
                },
            }
        }
    };
    Some(MeetingFound { reference, recording })
}

type Call<'a> = &'a dyn Fn(&[String]) -> Result<Value, Failure>;

fn show_with(call: Call, src: &MeetingsSource, profile: &str, meeting: &str) -> Result<Value, Failure> {
    call(&show_args(src, profile, meeting).map_err(Failure::plain)?)
}

fn with_tool<T>(provider: &str, f: impl FnOnce(Call, &MeetingsSource) -> Result<T, Failure>) -> Result<T, Failure> {
    let (tool, src) =
        tool_for(provider).ok_or_else(|| Failure::plain(format!("No WireCat tool records {provider} meetings.")))?;
    let bin =
        crate::tools::program(&tool.bin).ok_or_else(|| Failure::plain(format!("{} is not installed", tool.name)))?;
    f(&|args: &[String]| crate::memo_cli::spawn_at(&bin, args, READ), src)
}

/// The stored meeting and its recording, by the provider's id, the store's number or its `meeting:` ref.
pub fn find(provider: &str, profile: &str, meeting: &str) -> Result<MeetingFound, Failure> {
    with_tool(provider, |call, src| {
        let v = show_with(call, src, profile, meeting)?;
        found_of(&v).ok_or_else(|| Failure::plain("The tool's answer about this meeting could not be read."))
    })
}

fn file_now(call: Call, src: &MeetingsSource, profile: &str, meeting: &str) -> Result<PathBuf, Failure> {
    let v = show_with(call, src, profile, meeting)?;
    recording_of(&v["item"]).and_then(file_of).ok_or_else(|| Failure::plain("This recording is not on this computer."))
}

/// The recording's bytes, for the window's player.
pub fn read(provider: &str, profile: &str, meeting: &str) -> Result<Vec<u8>, Failure> {
    with_tool(provider, |call, src| {
        let file = file_now(call, src, profile, meeting)?;
        if std::fs::metadata(&file).map_err(|e| Failure::plain(e.to_string()))?.len() > MAX_PLAYED {
            return Err(Failure::plain("This recording is too large to play here; open it in your player."));
        }
        std::fs::read(&file).map_err(|e| Failure::plain(e.to_string()))
    })
}

/// The recording in the system's own player, for a format or a size the window cannot play.
pub fn open(provider: &str, profile: &str, meeting: &str) -> Result<(), Failure> {
    with_tool(provider, |call, src| {
        let file = file_now(call, src, profile, meeting)?;
        crate::memory::open_file(&file).map_err(Failure::plain)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn pbx() -> &'static MeetingsSource {
        tool_for("asterisk").unwrap().1
    }

    /// cli-core's `meetings show` item for a pbx call (`src/meetings/answers.ts`, `asterisk-cli/src/call-source.ts`),
    /// with `local_path` on the attachment; numbers made up.
    fn shown(local_path: Option<Value>) -> Value {
        let mut attachment = json!({ "position": 0, "kind": "recording", "name": "out-201-1731571200.42.wav",
                                     "mime": "audio/wav", "size": 44, "url": null });
        if let Some(path) = local_path {
            attachment["local_path"] = path;
        }
        json!({ "item": { "ref": "meeting:4/77", "id": "77", "provider_id": "1731571200.42#3",
                          "provider": "asterisk", "account": "office", "attachments": [attachment] } })
    }

    fn file(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-recording-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(name);
        std::fs::write(&file, b"RIFF0000WAVEfmt ").unwrap();
        file
    }

    #[test]
    fn asks_the_recording_tool_as_the_links_profile_with_the_providers_id_as_one_word() {
        let args = show_args(pbx(), "office", "1731571200.42#3").unwrap();
        assert_eq!(args.join(" "), "office meetings show 1731571200.42#3 --no-record --json");
        for bad in ["", "--json", "a b", "x\n", &"1".repeat(MAX_MEETING + 1)] {
            assert!(show_args(pbx(), "office", bad).is_err(), "{bad:?}");
        }
        assert!(show_args(pbx(), "--all", "77").is_err());
    }

    #[test]
    fn a_recording_is_here_only_when_the_tool_names_an_audio_file_that_exists() {
        let wav = file("here.wav");
        let here = found_of(&shown(Some(json!(wav.to_str().unwrap())))).unwrap();
        assert_eq!(here.reference, "meeting:4/77");
        assert!(matches!(here.recording, Recording::Here { size: 16, too_large: false, .. }), "{:?}", here.recording);

        let gone = found_of(&shown(Some(json!("/nowhere/out-201.wav")))).unwrap();
        assert!(matches!(gone.recording, Recording::Gone { .. }));

        let script = file("here.sh");
        let not_audio = found_of(&shown(Some(json!(script.to_str().unwrap())))).unwrap();
        assert!(matches!(not_audio.recording, Recording::Gone { .. }), "only an audio file is played or opened");
    }

    #[test]
    fn tells_a_recording_elsewhere_from_a_tool_too_old_to_say() {
        let sftp = found_of(&shown(Some(Value::Null))).unwrap();
        assert_eq!(sftp.recording, Recording::Elsewhere { name: Some("out-201-1731571200.42.wav".into()) });
        let old = found_of(&shown(None)).unwrap();
        assert!(matches!(old.recording, Recording::Unknown { .. }));
        let none = found_of(&json!({ "item": { "ref": "meeting:4/71", "attachments": [] } })).unwrap();
        assert_eq!(none.recording, Recording::None);
        assert_eq!(found_of(&json!({ "item": { "ref": "deal:1" } })), None);
    }

    #[test]
    fn plays_the_file_the_tool_names_now_and_never_another() {
        let wav = file("now.wav");
        let path = wav.to_str().unwrap().to_string();
        let call = |args: &[String]| {
            assert_eq!(args[3], "meeting:4/77");
            Ok(shown(Some(json!(path))))
        };
        assert_eq!(file_now(&call, pbx(), "office", "meeting:4/77").unwrap(), wav.canonicalize().unwrap());
        let elsewhere = |_: &[String]| Ok(shown(Some(Value::Null)));
        assert!(file_now(&elsewhere, pbx(), "office", "meeting:4/77").is_err());
    }
}
