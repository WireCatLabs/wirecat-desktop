//! The conversation a `chat/…` or `msg/…` link opens, read only. memo's `show` names the chat and says whether this
//! computer holds it; memo's `messages show` reads a message with its stored neighbours, which is also how the page
//! goes further back or forward from the oldest or newest message it has. memo lists no chat from its newest message,
//! so a messenger chat opens through the messenger's own `messages list --offline`, with the profile memo names for
//! the link's account. A mail thread opens from its first email: Gmail names a thread by its first message's id.
//! The text is the owner's own data on the owner's own page (as on the Search page): not masked, never logged.

use crate::skills::failure;
use crate::{catalog, paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const READ: Duration = Duration::from_mins(1);
/// Messages either side of a linked message, and the size of each later page.
const AROUND: usize = 10;
const PAGE: usize = 30;
const MAX_PART: usize = 512;
const MAX_TEXT: usize = 20_000;
/// Messengers whose `messages list` takes a chat reference and `--offline`; memo names them by their program.
pub(crate) const LISTS: [&str; 3] = ["tg", "max", "wa"];

/// What the page asks for: the first view, or the page before the oldest or after the newest message it shows.
#[derive(specta::Type, Debug, Deserialize, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatPage {
    Open,
    Older { message: String },
    Newer { message: String },
}

#[derive(specta::Type, Debug, Deserialize, Clone, PartialEq)]
pub struct ChatPlace {
    pub provider: String,
    pub account: String,
    pub chat: String,
    /// The linked message, for a `msg/…` link.
    pub message: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Conversation {
    NoMemo,
    /// The installed memo has no `show` or `messages show` yet.
    Old {
        message: String,
    },
    Found {
        /// Only on the first view; a later page keeps the header it had.
        chat: Option<ChatHeader>,
        messages: Vec<ChatMessage>,
        older: bool,
        newer: bool,
    },
    Missing {
        what: ChatMissing,
    },
    Failed {
        message: String,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChatMissing {
    /// No profile on this computer is signed in to the link's account.
    Account,
    /// The chat or the message is not in the store: deleted, or not synced here.
    Stored,
    /// A mail thread memo holds but cannot list from its first email.
    Thread,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatHeader {
    pub title: Option<String>,
    /// memo's `in`: the messenger's name for a chat, the mailbox for a mail thread.
    pub place: Option<String>,
    /// The profile signed in to the link's account, as the account's label.
    pub profile: Option<String>,
    pub email: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    #[serde(rename = "ref")]
    pub reference: String,
    pub id: String,
    pub sender: Option<String>,
    pub address: Option<String>,
    pub from_me: bool,
    pub at: Option<String>,
    pub subject: Option<String>,
    pub text: Option<String>,
    /// Attachment names only: their text and their bytes stay in the store.
    pub files: Vec<ChatFile>,
    pub anchor: bool,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatFile {
    /// Its name, else its kind.
    pub name: String,
    /// Its place among all the message's attachments, from 1, as `images read --attachment` counts them.
    pub position: u32,
    /// A PNG, JPEG or WebP picture, as cli-core's `images read` accepts it.
    pub picture: bool,
    /// The tool keeps a copy on this computer (`local_path`, cli-core 0.643.0); the path itself stays in Rust.
    pub saved: bool,
}

/// Runs one program (`memo`, or a messenger's program as memo names it) and answers its JSON, or why it failed.
type Call<'a> = dyn Fn(&str, &[String]) -> Result<Value, Failure> + Sync + 'a;

#[derive(Debug, PartialEq)]
pub enum Failure {
    NotFound,
    Old(String),
    Other(String),
}

/// As JavaScript's `encodeURIComponent`, which `referenceOf` in `src/domain/links.ts` uses for the same reference.
fn encode(part: &str) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(part.len());
    for b in part.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(char::from(b));
        } else {
            let _ = write!(out, "%{b:02X}");
        }
    }
    out
}

fn valid_part(part: &str) -> bool {
    !part.is_empty() && part.len() <= MAX_PART && !part.chars().any(char::is_control)
}

impl ChatPlace {
    pub(crate) fn validate(&self) -> Result<(), String> {
        let provider = !self.provider.is_empty()
            && self.provider.len() <= 32
            && self.provider.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit());
        let parts = [&self.account, &self.chat].into_iter().chain(self.message.as_ref()).all(|p| valid_part(p));
        if provider && parts { Ok(()) } else { Err("not a chat or message of the store".into()) }
    }

    pub(crate) fn chat_ref(&self) -> String {
        format!("chat:{}/{}/{}", self.provider, encode(&self.account), encode(&self.chat))
    }

    pub(crate) fn message_ref(&self, message: &str) -> String {
        format!("msg:{}/{}/{}/{}", self.provider, encode(&self.account), encode(&self.chat), encode(message))
    }

    fn email(&self) -> bool {
        self.provider == "email"
    }
}

fn words(parts: &[&str]) -> Vec<String> {
    parts.iter().chain(&["--no-record", "--json"]).map(|s| (*s).to_string()).collect()
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.trim().is_empty()).map(str::to_string)
}

fn clipped(t: String) -> String {
    if t.chars().count() <= MAX_TEXT {
        return t;
    }
    let mut cut: String = t.chars().take(MAX_TEXT).collect();
    cut.push('…');
    cut
}

fn message(v: &Value, asked: Option<&str>) -> Option<ChatMessage> {
    let reference = text(v, "ref")?;
    let email = &v["email"];
    Some(ChatMessage {
        // Decoded from the ref, so encoding it again for the next page gives back the same ref.
        id: reference.rsplit('/').next().and_then(crate::deep_link::decode)?,
        sender: text(v, "sender_name").or_else(|| text(&email["from"], "name")),
        address: text(&email["from"], "address"),
        from_me: v["sender_is_me"].as_bool().or_else(|| v["outgoing"].as_bool()).unwrap_or(false),
        at: text(v, "timestamp"),
        subject: text(email, "subject"),
        text: text(v, "text").or_else(|| text(v, "transcript")).map(clipped),
        files: v["attachments"].as_array().map(|a| files(a)).unwrap_or_default(),
        anchor: asked.is_some_and(|a| a == reference),
        reference,
    })
}

/// The position counts every attachment, the files with no name or kind too, as the store numbers them.
fn files(list: &[Value]) -> Vec<ChatFile> {
    list.iter()
        .zip(1u32..)
        .filter_map(|(f, position)| {
            let name = text(f, "name").or_else(|| text(f, "kind"))?;
            Some(ChatFile { position, picture: is_picture(f), saved: text(f, "local_path").is_some(), name })
        })
        .collect()
}

/// cli-core's test in `readPicture`: a photo, an `image/` type, or a PNG, JPEG or WebP name.
pub(crate) fn is_picture(f: &Value) -> bool {
    let name = text(f, "name").unwrap_or_default().to_ascii_lowercase();
    text(f, "kind").as_deref() == Some("photo")
        || text(f, "mime").is_some_and(|m| m.starts_with("image/"))
        || [".png", ".jpg", ".jpeg", ".webp"].iter().any(|e| name.ends_with(e))
}

fn messages(v: &Value, asked: Option<&str>) -> Vec<ChatMessage> {
    v["items"].as_array().map(|a| a.iter().filter_map(|m| message(m, asked)).collect()).unwrap_or_default()
}

/// memo's `show` of the chat: its header, and the profile its messenger reads it with.
pub(crate) struct Shown {
    pub chat: ChatHeader,
    pub available: bool,
    pub tool: Option<String>,
}

pub(crate) fn shown(v: &Value, email: bool) -> Option<Shown> {
    let item = v["items"].as_array()?.first()?;
    let profile = item["open"]["profiles"].as_array().and_then(|p| p.first()).and_then(Value::as_str);
    Some(Shown {
        chat: ChatHeader {
            title: text(item, "title"),
            place: text(item, "in"),
            profile: profile.filter(|p| catalog::validate_profile(p).is_ok()).map(str::to_string),
            email,
        },
        available: text(item, "state").as_deref() == Some("available"),
        tool: text(item, "tool"),
    })
}

/// Where the asked message sits among the ones memo answered: how many came before it and after it.
fn split(list: &[ChatMessage], asked: &str) -> Option<(usize, usize)> {
    let at = list.iter().position(|m| m.reference == asked)?;
    Some((at, list.len() - at - 1))
}

fn neighbours(call: &Call, reference: &str, before: usize, after: usize) -> Result<Value, Failure> {
    let (b, a) = (before.to_string(), after.to_string());
    call("memo", &words(&["messages", "show", reference, "--before-n", &b, "--after-n", &a]))
}

fn failed(f: Failure, missing: ChatMissing) -> Conversation {
    match f {
        Failure::NotFound => Conversation::Missing { what: missing },
        Failure::Old(message) => Conversation::Old { message },
        Failure::Other(message) => Conversation::Failed { message },
    }
}

fn open(call: &Call, place: &ChatPlace) -> Conversation {
    let chat_ref = place.chat_ref();
    let asked = place.message.as_deref().map(|m| place.message_ref(m));
    // Each is its own Node.js start, so the linked message is read while memo names the chat.
    let (show, around) = std::thread::scope(|s| {
        let around = asked.as_deref().map(|r| s.spawn(move || neighbours(call, r, AROUND, AROUND)));
        let show = call("memo", &words(&["show", &chat_ref]));
        (show, around.map(|h| h.join().unwrap_or_else(|_| Err(Failure::Other("a read stopped".into())))))
    });
    let show = match show {
        Ok(v) => v,
        Err(f) => return failed(f, ChatMissing::Stored),
    };
    let Some(shown) = shown(&show, place.email()) else {
        return Conversation::Failed { message: "memo did not name the chat".into() };
    };
    if !shown.available {
        let signed_in = shown.chat.profile.is_some() || place.email();
        return Conversation::Missing { what: if signed_in { ChatMissing::Stored } else { ChatMissing::Account } };
    }
    let chat = Some(shown.chat.clone());
    if let (Some(asked), Some(around)) = (asked.as_deref(), around) {
        let list = match around {
            Ok(v) => messages(&v, Some(asked)),
            Err(f) => return failed(f, ChatMissing::Stored),
        };
        let Some((before, after)) = split(&list, asked) else {
            return Conversation::Missing { what: ChatMissing::Stored };
        };
        return Conversation::Found { chat, messages: list, older: before == AROUND, newer: after == AROUND };
    }
    if place.email() {
        let first = place.message_ref(&place.chat);
        return match neighbours(call, &first, 0, PAGE) {
            Ok(v) => {
                let list = messages(&v, None);
                let after = split(&list, &first).map_or(0, |(_, a)| a);
                Conversation::Found { chat, messages: list, older: false, newer: after == PAGE }
            }
            Err(f) => failed(f, ChatMissing::Thread),
        };
    }
    latest(call, &chat_ref, &shown, chat)
}

fn latest(call: &Call, chat_ref: &str, shown: &Shown, chat: Option<ChatHeader>) -> Conversation {
    let (Some(tool), Some(profile)) = (shown.tool.as_deref(), shown.chat.profile.as_deref()) else {
        return Conversation::Missing { what: ChatMissing::Account };
    };
    if !LISTS.contains(&tool) {
        return Conversation::Missing { what: ChatMissing::Thread };
    }
    let limit = PAGE.to_string();
    match call(tool, &words(&[profile, "messages", "list", chat_ref, "--offline", "--limit", &limit])) {
        Ok(v) => Conversation::Found {
            chat,
            messages: messages(&v, None),
            older: v["page"]["has_more"].as_bool().unwrap_or(false),
            newer: false,
        },
        Err(f) => failed(f, ChatMissing::Stored),
    }
}

fn page(call: &Call, place: &ChatPlace, from: &str, older: bool) -> Conversation {
    let reference = place.message_ref(from);
    let (before, after) = if older { (PAGE, 0) } else { (0, PAGE) };
    match neighbours(call, &reference, before, after) {
        Ok(v) => {
            let mut list = messages(&v, None);
            let Some((b, a)) = split(&list, &reference) else {
                return Conversation::Missing { what: ChatMissing::Stored };
            };
            list.retain(|m| m.reference != reference);
            Conversation::Found { chat: None, messages: list, older: older && b == PAGE, newer: !older && a == PAGE }
        }
        Err(f) => failed(f, ChatMissing::Stored),
    }
}

pub fn read_with(call: &Call, place: &ChatPlace, ask: &ChatPage) -> Result<Conversation, String> {
    place.validate()?;
    Ok(match ask {
        ChatPage::Open => open(call, place),
        ChatPage::Older { message } | ChatPage::Newer { message } if !valid_part(message) => {
            return Err("not a message of the store".into());
        }
        ChatPage::Older { message } => page(call, place, message, true),
        ChatPage::Newer { message } => page(call, place, message, false),
    })
}

fn call_program(bin: &std::path::Path, args: &[String]) -> Result<Value, Failure> {
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(bin, &refs, Some(&paths::search_path()), READ).map_err(|e| Failure::Other(e.to_string()))?;
    let json = out.json();
    match json {
        Some(v) if crate::skills::ok(&out, &v) => Ok(v),
        Some(v) if v["error"]["code"].as_str() == Some("not_found") => Err(Failure::NotFound),
        j => {
            let message = failure(&out, j.as_ref());
            Err(if crate::memo_cli::unknown_to_cli(&message) { Failure::Old(message) } else { Failure::Other(message) })
        }
    }
}

pub fn read(place: &ChatPlace, ask: &ChatPage) -> Result<Conversation, String> {
    let memo = catalog::tool("memo")?;
    let Some(memo_bin) = crate::tools::program(&memo.bin) else { return Ok(Conversation::NoMemo) };
    // The messenger is found by the program memo names, and only among the catalog's own messengers.
    let call = |program: &str, args: &[String]| -> Result<Value, Failure> {
        if program == "memo" {
            return call_program(&memo_bin, args);
        }
        let known = LISTS.contains(&program) && catalog::catalog().tools.iter().any(|t| t.bin == program);
        let bin = known.then(|| crate::tools::program(program)).flatten();
        bin.map_or_else(|| Err(Failure::Other(format!("{program} is not installed"))), |b| call_program(&b, args))
    };
    read_with(&call, place, ask)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn place(provider: &str, chat: &str, message: Option<&str>) -> ChatPlace {
        ChatPlace {
            provider: provider.into(),
            account: if provider == "email" { "owner@example.com".into() } else { "1001".into() },
            chat: chat.into(),
            message: message.map(Into::into),
        }
    }

    fn msg(r: &str) -> Value {
        json!({ "ref": r, "id": r.rsplit('/').next(), "sender_name": "Ana Sample", "timestamp": "2026-11-08T08:00:00Z",
                "text": "synthetic", "attachments": [{ "kind": "file", "name": "plan.pdf", "text": "never shown" }] })
    }

    fn shown_chat(state: &str, profiles: &[&str], tool: &str) -> Value {
        json!({ "items": [{ "ref": "chat:x", "kind": "chat", "title": "Book club", "in": "Telegram", "tool": tool,
                "state": state, "open": { "profiles": profiles } }] })
    }

    /// Answers each call by its arguments and keeps what was asked.
    struct Fake {
        calls: Mutex<Vec<(String, Vec<String>)>>,
    }

    impl Fake {
        fn new() -> Self {
            Fake { calls: Mutex::new(Vec::new()) }
        }

        fn run(
            &self,
            answer: impl Fn(&str, &[String]) -> Result<Value, Failure> + Sync,
            p: &ChatPlace,
            a: &ChatPage,
        ) -> Conversation {
            let call = |program: &str, args: &[String]| {
                self.calls.lock().unwrap().push((program.to_string(), args.to_vec()));
                answer(program, args)
            };
            read_with(&call, p, a).unwrap()
        }
    }

    fn around(chat: &str, ids: std::ops::RangeInclusive<u32>) -> Value {
        json!({ "items": ids.map(|i| msg(&format!("msg:telegram/1001/{chat}/{i}"))).collect::<Vec<_>>() })
    }

    #[test]
    fn each_file_keeps_its_place_among_all_attachments_and_says_whether_it_is_a_picture() {
        let list = json!([
            { "kind": "webpage", "name": "" },
            { "kind": "photo", "local_path": "/home/u/.local/share/tg/photo.jpg" },
            { "kind": "document", "name": "Scan.PNG", "mime": "application/octet-stream" },
            { "kind": "document", "name": "plan.pdf", "mime": "application/pdf" },
            { "kind": "file", "name": "board", "mime": "image/webp" }
        ]);
        let got: Vec<_> =
            files(list.as_array().unwrap()).into_iter().map(|f| (f.name, f.position, f.picture, f.saved)).collect();
        assert_eq!(
            got,
            [
                ("webpage".to_string(), 1, false, false),
                ("photo".to_string(), 2, true, true),
                ("Scan.PNG".to_string(), 3, true, false),
                ("plan.pdf".to_string(), 4, false, false),
                ("board".to_string(), 5, true, false),
            ]
        );
    }

    #[test]
    fn a_reference_is_encoded_as_the_interface_encodes_it() {
        let p = place("email", "thread one/a", Some("<id@mail.example>"));
        assert_eq!(p.chat_ref(), "chat:email/owner%40example.com/thread%20one%2Fa");
        assert_eq!(
            p.message_ref("<id@mail.example>"),
            "msg:email/owner%40example.com/thread%20one%2Fa/%3Cid%40mail.example%3E"
        );
        assert_eq!(place("max", "-2002", None).chat_ref(), "chat:max/1001/-2002");
    }

    #[test]
    fn a_part_can_never_become_a_flag_or_a_second_argument() {
        let p = place("telegram", "--json --full", Some("3 4"));
        assert_eq!(p.message_ref("3 4"), "msg:telegram/1001/--json%20--full/3%204");
        for bad in [place("Telegram", "1", None), place("tele/gram", "1", None), place("telegram", "", None)] {
            assert!(read_with(&|_, _| Ok(json!({})), &bad, &ChatPage::Open).is_err());
        }
        let control = place("telegram", "1\n2", None);
        assert!(read_with(&|_, _| Ok(json!({})), &control, &ChatPage::Open).is_err());
        let older = ChatPage::Older { message: String::new() };
        assert!(read_with(&|_, _| Ok(json!({})), &place("telegram", "1", None), &older).is_err());
    }

    #[test]
    fn a_message_opens_among_its_neighbours_with_its_chat_named() {
        let f = Fake::new();
        let p = place("telegram", "2", Some("30"));
        let got = f.run(
            |_, args| {
                Ok(if args[0] == "show" { shown_chat("available", &["personal"], "tg") } else { around("2", 20..=40) })
            },
            &p,
            &ChatPage::Open,
        );
        let Conversation::Found { chat, messages, older, newer } = got else { panic!("{got:?}") };
        let chat = chat.unwrap();
        assert_eq!(
            (chat.title.as_deref(), chat.place.as_deref(), chat.profile.as_deref()),
            (Some("Book club"), Some("Telegram"), Some("personal"))
        );
        assert_eq!(messages.len(), 21);
        assert_eq!(messages.iter().filter(|m| m.anchor).map(|m| m.id.as_str()).collect::<Vec<_>>(), ["30"]);
        assert_eq!(messages[0].files[0].name, "plan.pdf");
        assert!(older && newer);
        let calls = f.calls.lock().unwrap();
        assert!(calls.iter().all(|(program, _)| program == "memo"));
        let around =
            ["messages", "show", "msg:telegram/1001/2/30", "--before-n", "10", "--after-n", "10"].map(String::from);
        assert!(calls.iter().any(|(_, a)| a.starts_with(&around)));
        assert!(calls.iter().all(|(_, a)| a.ends_with(&["--no-record".into(), "--json".into()])));
    }

    #[test]
    fn a_message_near_the_start_of_its_chat_has_nothing_older() {
        let p = place("telegram", "2", Some("3"));
        let got = Fake::new().run(
            |_, args| {
                Ok(if args[0] == "show" { shown_chat("available", &["personal"], "tg") } else { around("2", 1..=13) })
            },
            &p,
            &ChatPage::Open,
        );
        assert!(matches!(got, Conversation::Found { older: false, newer: true, .. }), "{got:?}");
    }

    #[test]
    fn a_chat_opens_on_its_newest_messages_through_its_messenger_offline() {
        let f = Fake::new();
        let got = f.run(
            |program, _| {
                Ok(if program == "memo" {
                    shown_chat("available", &["personal"], "tg")
                } else {
                    json!({ "items": [msg("msg:telegram/1001/2/9")], "page": { "has_more": true } })
                })
            },
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert!(matches!(got, Conversation::Found { older: true, newer: false, .. }), "{got:?}");
        let calls = f.calls.lock().unwrap();
        let (program, args) = calls.iter().find(|(p, _)| p == "tg").unwrap();
        assert_eq!(program, "tg");
        assert_eq!(&args[..5], ["personal", "messages", "list", "chat:telegram/1001/2", "--offline"]);
    }

    #[test]
    fn an_older_page_is_the_messages_before_the_oldest_shown_without_it() {
        let f = Fake::new();
        let got = f.run(
            |_, _| Ok(around("2", 1..=31)),
            &place("telegram", "2", None),
            &ChatPage::Older { message: "31".into() },
        );
        let Conversation::Found { chat, messages, older, newer } = got else { panic!() };
        assert!(chat.is_none());
        assert_eq!(messages.len(), 30);
        assert!(messages.iter().all(|m| m.id != "31"));
        assert!(older && !newer);
        let got = f.run(
            |_, _| Ok(around("2", 1..=5)),
            &place("telegram", "2", None),
            &ChatPage::Older { message: "5".into() },
        );
        assert!(matches!(got, Conversation::Found { older: false, .. }));
        let got = f.run(
            |_, _| Ok(around("2", 5..=9)),
            &place("telegram", "2", None),
            &ChatPage::Newer { message: "5".into() },
        );
        assert!(matches!(got, Conversation::Found { older: false, newer: false, .. }));
        assert_eq!(f.calls.lock().unwrap()[2].1[3..7], ["--before-n", "0", "--after-n", "30"]);
    }

    #[test]
    fn a_mail_thread_opens_from_its_first_email() {
        let f = Fake::new();
        let thread = json!({ "items": [{ "ref": "msg:email/owner%40example.com/77/77", "id": "77", "text": "Hello\n> old",
            "timestamp": "2026-11-08T08:00:00Z", "email": { "subject": "Lease", "from": { "name": "Ana", "address": "ana@example.com" } } }] });
        let got = f.run(
            move |_, args| Ok(if args[0] == "show" { shown_chat("available", &[], "mail") } else { thread.clone() }),
            &place("email", "77", None),
            &ChatPage::Open,
        );
        let Conversation::Found { chat, messages, .. } = got else { panic!() };
        assert!(chat.unwrap().email);
        assert_eq!(
            (messages[0].subject.as_deref(), messages[0].address.as_deref()),
            (Some("Lease"), Some("ana@example.com"))
        );
        assert!(f.calls.lock().unwrap().iter().any(|(_, a)| a[2] == "msg:email/owner%40example.com/77/77"));
        let got = Fake::new().run(
            |_, args| if args[0] == "show" { Ok(shown_chat("available", &[], "mail")) } else { Err(Failure::NotFound) },
            &place("email", "77", None),
            &ChatPage::Open,
        );
        assert_eq!(got, Conversation::Missing { what: ChatMissing::Thread });
    }

    #[test]
    fn what_is_missing_is_said_plainly() {
        let account = Fake::new().run(
            |_, _| Ok(shown_chat("unavailable", &[], "tg")),
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert_eq!(account, Conversation::Missing { what: ChatMissing::Account });
        let chat = Fake::new().run(
            |_, _| Ok(shown_chat("unavailable", &["personal"], "tg")),
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert_eq!(chat, Conversation::Missing { what: ChatMissing::Stored });
        let message = Fake::new().run(
            |_, args| {
                if args[0] == "show" {
                    Ok(shown_chat("available", &["personal"], "tg"))
                } else {
                    Err(Failure::NotFound)
                }
            },
            &place("telegram", "2", Some("3")),
            &ChatPage::Open,
        );
        assert_eq!(message, Conversation::Missing { what: ChatMissing::Stored });
        let old = Fake::new().run(
            |_, _| Err(Failure::Old("unknown command 'show'".into())),
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert!(matches!(old, Conversation::Old { .. }));
    }

    #[test]
    fn a_messenger_memo_names_is_used_only_when_it_is_a_known_one() {
        let f = Fake::new();
        let got = f.run(
            |_, _| Ok(shown_chat("available", &["personal"], "rm -rf")),
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert_eq!(got, Conversation::Missing { what: ChatMissing::Thread });
        assert!(f.calls.lock().unwrap().iter().all(|(p, _)| p == "memo"));
        let bad_profile = Fake::new().run(
            |_, _| Ok(shown_chat("available", &["--all"], "tg")),
            &place("telegram", "2", None),
            &ChatPage::Open,
        );
        assert_eq!(bad_profile, Conversation::Missing { what: ChatMissing::Account });
    }

    #[test]
    fn real_answers_are_read() {
        let v = json!({ "items": [{ "id": "119247", "chat_id": "5", "sender_id": "9", "sender_name": "Ana", "timestamp": "2026-06-26T06:11:31.000Z",
            "edited_at": null, "text": "synthetic", "outgoing": true, "attachments": [], "reply_to": null, "ref": "msg:telegram/1/5/119247" }],
            "page": { "mode": "page", "limit": 7, "has_more": false } });
        let m = &messages(&v, Some("msg:telegram/1/5/119247"))[0];
        assert!(m.from_me && m.anchor);
        assert_eq!(m.id, "119247");
    }

    /// `WIRECAT_REAL_PLACES="telegram/1/2 telegram/1/2/3 email/a@b/7" cargo test -- --ignored real_conversation`: reads
    /// those places through the installed memo, paging once each way; prints states and counts, never a message.
    #[test]
    #[ignore = "needs memo and a synced store; the places come from the environment"]
    fn real_conversation() {
        let places = std::env::var("WIRECAT_REAL_PLACES").unwrap_or_default();
        for spec in places.split_whitespace() {
            let parts: Vec<&str> = spec.splitn(4, '/').collect();
            let [provider, account, chat, rest @ ..] = parts.as_slice() else { continue };
            let p = ChatPlace {
                provider: (*provider).into(),
                account: (*account).into(),
                chat: (*chat).into(),
                message: rest.first().map(|m| (*m).to_string()),
            };
            let summary = |c: &Conversation| match c {
                Conversation::Found { chat, messages, older, newer } => format!(
                    "found: header={}, {} messages, {} linked, older={older}, newer={newer}",
                    chat.is_some(),
                    messages.len(),
                    messages.iter().filter(|m| m.anchor).count()
                ),
                Conversation::Missing { what } => format!("missing {what:?}"),
                other => format!("{:?}", std::mem::discriminant(other)),
            };
            let first = read(&p, &ChatPage::Open).unwrap();
            println!("{provider} open{}: {}", if p.message.is_some() { " message" } else { "" }, summary(&first));
            if let Conversation::Found { messages, .. } = &first {
                if let Some(oldest) = messages.first() {
                    println!(
                        "  older: {}",
                        summary(&read(&p, &ChatPage::Older { message: oldest.id.clone() }).unwrap())
                    );
                }
                if let Some(newest) = messages.last() {
                    println!(
                        "  newer: {}",
                        summary(&read(&p, &ChatPage::Newer { message: newest.id.clone() }).unwrap())
                    );
                }
            }
        }
    }
}
