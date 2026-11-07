use crate::catalog::{self, Tool};
use crate::paths;
use crate::run::{self, RunError};
use crate::signin_steps::Parser;
pub use crate::signin_steps::SignInEvent;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::ChildStdin;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// `wa` ends its history wait on SIGTERM and then answers with what it kept; this is its time to do so.
pub const GRACE: Duration = Duration::from_secs(5);
/// The code renews until someone scans it, then the phone's history can take minutes on a large account; a code sent
/// by Telegram or a page approved in the browser fits inside it too.
const TIMEOUT: Duration = Duration::from_mins(15);
/// The code a run past `TIMEOUT` fails with; not `timeout`, which the tools use for a QR code nobody scanned.
pub const TOOK_TOO_LONG: &str = "took_too_long";

pub type Answer = zeroize::Zeroizing<String>;

/// The running sign-in of one tool, in `Running`; its stop removes the key.
pub fn key(id: &str) -> String {
    format!("sign-in:{id}")
}

/// Each running sign-in's stdin, open for its answers; dropped, and so closed, when the run ends.
fn answers() -> &'static Mutex<HashMap<String, ChildStdin>> {
    static A: OnceLock<Mutex<HashMap<String, ChildStdin>>> = OnceLock::new();
    A.get_or_init(Mutex::default)
}

/// What the owner typed in the window before the run: each reaches the tool only if the method names its flag.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Inputs {
    pub address: Option<String>,
    pub password: Option<String>,
    /// The text of the owner's own OAuth client JSON, not a path: the window has no file paths.
    pub client_file: Option<String>,
}

/// A run ready to start: its words, the variables it reads, and the client file it may name, removed with this.
pub struct Prepared {
    pub args: Vec<String>,
    env: Vec<(String, Answer)>,
    _client: Option<ClientFile>,
}

/// The catalog's words for the method with the profile the owner chose or named; never a default one.
pub fn args(tool: &Tool, method: &str, profile: &str, inputs: Inputs) -> Result<Prepared, String> {
    let method = tool
        .sign_in
        .as_ref()
        .and_then(|s| s.methods.iter().find(|m| m.id == method))
        .ok_or_else(|| format!("{} cannot sign in from the app this way", tool.name))?;
    let mut args = catalog::with_profile(&method.words, Some(profile))?;
    let mut env = Vec::new();
    let mut client = None;
    if let Some(address) = inputs.address {
        args.extend([flag(method.address.as_ref(), "an address")?.clone(), valid_address(&address)?]);
    }
    if let Some(password) = inputs.password {
        let password = Answer::new(password);
        if password.is_empty() || password.len() > 1024 || password.chars().any(char::is_control) {
            return Err("The app password is one line of at most 1024 characters.".into());
        }
        env.push((flag(method.password.as_ref(), "a password")?.clone(), password));
    }
    if let Some(json) = inputs.client_file {
        let name = flag(method.client_file.as_ref(), "an app of your own")?;
        let file = ClientFile::write(&json)?;
        args.extend([name.clone(), file.path().to_string_lossy().into_owned()]);
        client = Some(file);
    }
    Ok(Prepared { args, env, _client: client })
}

fn flag<'a>(name: Option<&'a String>, what: &str) -> Result<&'a String, String> {
    name.ok_or_else(|| format!("This sign-in takes no {what}."))
}

/// One address, never a flag: the tool's discovery takes it from here.
fn valid_address(address: &str) -> Result<String, String> {
    let address = address.trim();
    let shaped = address.split_once('@').is_some_and(|(user, domain)| {
        !user.is_empty()
            && domain.contains('.')
            && !domain.starts_with('.')
            && !domain.ends_with('.')
            && !domain.contains('@')
    });
    if !shaped
        || address.len() > 254
        || address.starts_with('-')
        || address.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err("Type the whole mail address, such as name@example.com.".into());
    }
    Ok(address.to_string())
}

/// The owner's client JSON in a folder only they can open, for one run; the tool keeps the client with its sign-in,
/// so the file goes when the run ends.
struct ClientFile {
    dir: PathBuf,
}

impl ClientFile {
    const MAX: usize = 64 * 1024;

    fn write(json: &str) -> Result<Self, String> {
        let refused =
            || "This is not an OAuth client file. Download the JSON of a Desktop app client again.".to_string();
        if json.len() > Self::MAX {
            return Err(refused());
        }
        let value: serde_json::Value = serde_json::from_str(json).map_err(|_| refused())?;
        let client = value.get("installed").or_else(|| value.get("web")).ok_or_else(refused)?;
        if client["client_id"].as_str().is_none_or(|id| id.trim().is_empty()) {
            return Err(refused());
        }
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos());
        let dir = std::env::temp_dir().join(format!("wirecat-client-{}-{nanos}", std::process::id()));
        let mut folder = std::fs::DirBuilder::new();
        #[cfg(unix)]
        std::os::unix::fs::DirBuilderExt::mode(&mut folder, 0o700);
        folder.create(&dir).map_err(|e| format!("Could not keep the client file for the sign-in: {e}"))?;
        let file = Self { dir };
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
        options
            .open(file.path())
            .and_then(|mut f| f.write_all(json.as_bytes()))
            .map_err(|e| format!("Could not keep the client file for the sign-in: {e}"))?;
        Ok(file)
    }

    fn path(&self) -> PathBuf {
        self.dir.join("client.json")
    }
}

impl Drop for ClientFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Writes one answer and a newline to the running sign-in. The error never repeats the answer: it may reach the
/// window's error list.
pub fn answer(id: &str, value: &Answer) -> Result<(), String> {
    // A line break would answer the next question too, before the owner saw it.
    if value.chars().any(char::is_control) {
        return Err("An answer is one line, without tabs or line breaks.".into());
    }
    let mut kept = answers().lock().unwrap();
    let stdin = kept.get_mut(&key(id)).ok_or("The sign-in has already ended.")?;
    stdin
        .write_all(value.as_bytes())
        .and_then(|()| stdin.write_all(b"\n"))
        .and_then(|()| stdin.flush())
        .map_err(|_| "The tool stopped before it read the answer.".to_string())
}

pub fn run(tool: &Tool, prepared: &Prepared, stopped: &dyn Fn() -> bool, send: &dyn Fn(SignInEvent)) {
    let Some(bin) = crate::tools::program(&tool.bin) else {
        return send(failed(format!("{} is not installed.", tool.name)));
    };
    let refs: Vec<&str> = prepared.args.iter().map(String::as_str).collect();
    let mut cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    for (name, value) in &prepared.env {
        cmd.env(name, value.as_str());
    }
    let mut parser = Parser::default();
    let mut outcome = None;
    let k = key(&tool.id);
    let result = run::stream_stoppable(
        cmd,
        TIMEOUT,
        stopped,
        GRACE,
        |stdin| {
            answers().lock().unwrap().insert(k.clone(), stdin);
        },
        |line| match parser.read(line) {
            Some(e @ (SignInEvent::Done { .. } | SignInEvent::Failed { .. })) => outcome = Some(e),
            Some(e) => send(e),
            None => {}
        },
    );
    answers().lock().unwrap().remove(&k);
    send(finish(&tool.name, result, outcome, stopped()));
}

/// What the run ended with. A stop during the history wait still answers `done` with what was kept; a stop before
/// that, or a kill after the grace, is `stopped`, whatever the tool said on its way out.
fn finish(
    name: &str,
    result: Result<Option<i32>, RunError>,
    outcome: Option<SignInEvent>,
    stopped: bool,
) -> SignInEvent {
    match (result, outcome) {
        (Ok(_), Some(done @ SignInEvent::Done { .. })) => done,
        (Err(RunError::Cancelled) | Ok(_), _) if stopped => SignInEvent::Stopped,
        (Ok(_), Some(failure)) => failure,
        (Ok(code), None) => failed(match code {
            Some(code) => format!("{name} stopped with exit code {code} and said nothing about the sign-in."),
            None => format!("{name} was stopped by the system before the sign-in finished."),
        }),
        (Err(RunError::TimedOut), _) => SignInEvent::Failed {
            message: format!("The sign-in took longer than {} minutes.", TIMEOUT.as_secs() / 60),
            code: Some(TOOK_TOO_LONG.into()),
            reason: None,
        },
        (Err(e), _) => failed(format!("Could not run {name}: {e}.")),
    }
}

fn failed(message: String) -> SignInEvent {
    SignInEvent::Failed { message, code: None, reason: None }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_answer_with_a_line_break_never_reaches_the_tool() {
        for bad in ["123\n456", "code\r", "a\tb"] {
            let refused = answer("tg", &Answer::new(bad.into())).unwrap_err();
            assert!(refused.contains("one line"), "{bad:?}: {refused}");
            assert!(!refused.contains(bad), "the error never repeats the answer");
        }
    }

    #[test]
    fn a_stop_is_done_only_when_the_tool_answered() {
        let done = SignInEvent::Done { already_linked: false, received: None };
        let refused = failed("cancelled".into());
        assert_eq!(finish("wa", Ok(Some(0)), Some(done.clone()), true), done);
        assert_eq!(finish("wa", Ok(Some(143)), Some(refused.clone()), true), SignInEvent::Stopped);
        assert_eq!(finish("wa", Err(RunError::Cancelled), None, true), SignInEvent::Stopped);
        assert_eq!(finish("wa", Ok(Some(2)), Some(refused.clone()), false), refused);
        assert!(matches!(finish("wa", Ok(Some(1)), None, false), SignInEvent::Failed { .. }));
        assert!(matches!(
            finish("wa", Err(RunError::TimedOut), None, false),
            SignInEvent::Failed { code: Some(c), .. } if c == TOOK_TOO_LONG
        ));
    }

    fn words(tool: &str, method: &str, profile: &str) -> Result<Vec<String>, String> {
        args(catalog::tool(tool).unwrap(), method, profile, Inputs::default()).map(|p| p.args)
    }

    #[test]
    fn runs_the_catalogs_words_for_a_method_and_a_profile_the_owner_named() {
        assert_eq!(words("wa", "qr", "personal").unwrap(), ["personal", "session", "start", "qr", "--json"]);
        assert_eq!(
            words("tg", "phone", "work").unwrap(),
            ["work", "session", "start", "phone", "--json", "--answer-stdin"]
        );
        for bad in ["", "--help", "a;rm -rf ~", "../x y"] {
            assert!(words("wa", "qr", bad).is_err(), "{bad}");
        }
        assert_eq!(
            words("wa", "phone", "personal").unwrap(),
            ["personal", "session", "start", "phone", "--json", "--answer-stdin"]
        );
        assert!(words("memo", "qr", "personal").is_err());
        assert!(catalog::tool("nope").is_err());
    }

    #[test]
    fn what_the_owner_typed_goes_only_where_the_method_names_it() {
        let email = catalog::tool("email").unwrap();
        let typed = |address: &str, password: Option<&str>| Inputs {
            address: Some(address.into()),
            password: password.map(str::to_string),
            client_file: None,
        };
        let imap = args(email, "imap", "work", typed(" me@example.com ", None)).unwrap();
        assert_eq!(imap.args, ["work", "session", "start", "--json", "--answer-stdin", "--address", "me@example.com"]);
        for bad in ["--help@x.com", "me", "me@localhost", "a b@x.com", "me\n@x.com", "@x.com"] {
            assert!(args(email, "imap", "work", typed(bad, None)).is_err(), "{bad}");
        }
        for method in ["microsoft", "gmail", "imap"] {
            let refused = args(email, method, "work", typed("me@example.com", Some("x")));
            assert!(refused.is_err(), "{method}: the tool asks the password on stdin");
        }
        assert!(args(catalog::tool("tg").unwrap(), "qr", "work", typed("me@x.com", None)).is_err());
    }

    #[test]
    fn an_own_client_file_is_private_and_gone_after_the_run() {
        let gcal = catalog::tool("gcal").unwrap();
        let json = r#"{"installed":{"client_id":"1.apps.googleusercontent.com","client_secret":"s"}}"#;
        let own = |text: &str| Inputs { client_file: Some(text.into()), ..Inputs::default() };
        let prepared = args(gcal, "browser", "personal", own(json)).unwrap();
        let path = PathBuf::from(prepared.args.last().unwrap());
        assert_eq!(prepared.args[prepared.args.len() - 2], "--client-file");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), json);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        }
        drop(prepared);
        assert!(!path.exists());
        for bad in ["{}", "not json", r#"{"installed":{"client_id":""}}"#] {
            assert!(args(gcal, "browser", "personal", own(bad)).is_err(), "{bad}");
        }
        assert!(args(catalog::tool("zm").unwrap(), "browser", "personal", own(json)).is_err());
    }

    #[test]
    fn an_answer_to_no_running_sign_in_fails_without_repeating_it() {
        let error = answer("drive", &Answer::new("not-a-real-password".into())).unwrap_err();
        assert!(!error.contains("not-a-real-password"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn answers_reach_the_tool_one_line_each() {
        let tool = catalog::tool("zm").unwrap();
        let k = key(&tool.id);
        let cmd = run::command(
            std::path::Path::new("sh"),
            &[
                "-c",
                r#"echo '{"event":"needs","field":"code","secret":false,"prompt":"code"}' >&2; read a; echo "{\"item\":{\"len\":${#a}}}""#,
            ],
            None,
        );
        let mut seen = Vec::new();
        let result = run::stream_stoppable(
            cmd,
            Duration::from_secs(10),
            || false,
            GRACE,
            |stdin| {
                answers().lock().unwrap().insert(k.clone(), stdin);
            },
            |line| {
                let mut parser = Parser::default();
                if let Some(e) = parser.read(line) {
                    if matches!(e, SignInEvent::Needs { .. }) {
                        answer("zm", &Answer::new("12345".into())).unwrap();
                    }
                    seen.push(e);
                }
            },
        );
        answers().lock().unwrap().remove(&k);
        assert_eq!(result.unwrap(), Some(0));
        assert!(matches!(seen.last(), Some(SignInEvent::Done { .. })), "{seen:?}");
    }
}
