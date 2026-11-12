use crate::catalog::{self, Tool};
use crate::install::Running;
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
use tauri::ipc::Channel;

/// `wa` ends its history wait on SIGTERM and then answers with what it kept; this is its time to do so.
pub const GRACE: Duration = Duration::from_secs(5);
/// The code renews until someone scans it, then the phone's history can take minutes on a large account; a code sent
/// by Telegram or a page approved in the browser fits inside it too.
const TIMEOUT: Duration = Duration::from_mins(15);
/// The code a run past `TIMEOUT` fails with; not `timeout`, which the tools use for a QR code nobody scanned.
pub const TOOK_TOO_LONG: &str = "took_too_long";

pub type Answer = zeroize::Zeroizing<String>;

const KEY: &str = "sign-in:";

/// The running sign-in of one tool, in `Running`; its stop removes the key.
pub fn key(id: &str) -> String {
    format!("{KEY}{id}")
}

/// The tool a `Running` key signs in to, if it is a sign-in's.
pub fn signing_in(key: &str) -> Option<&str> {
    key.strip_prefix(KEY)
}

/// Starts the tool's sign-in key unless a sign-in to it, or an install or update of its package, runs; the refusal is
/// the sentence the window shows.
fn claim(tool: &'static Tool, running: &Running) -> Result<String, String> {
    let key = key(&tool.id);
    let package = &catalog::owner(tool).id;
    if running.start_unless(&key, |k| k == package) {
        return Ok(key);
    }
    Err(if running.busy(package) {
        format!("{} is being installed or updated. Sign in when it is done.", tool.name)
    } else {
        format!("A {} sign-in is still running or stopping. Try again in a few seconds.", tool.name)
    })
}

/// One sign-in per tool, none while its package installs; steps and the result arrive on `events`.
pub fn run_guarded(tool: &'static Tool, prepared: &Prepared, running: &Running, events: &Channel<SignInEvent>) {
    let send = |e: SignInEvent| {
        let _ = events.send(e);
    };
    match claim(tool, running) {
        Err(message) => send(SignInEvent::Failed { message, code: None, reason: None }),
        Ok(key) => {
            run(tool, prepared, &|| !running.is_running(&key), &send);
            running.finish(&key);
        }
    }
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
    /// Sign in in the browser with the tool's own app, which a new mail profile for Gmail would not do by itself.
    #[serde(default)]
    pub oauth: bool,
    /// The portal a local application signs in to; its id and key come with it, the key in `password`.
    pub portal: Option<String>,
    pub app_id: Option<String>,
}

/// A run ready to start: its words, the variables it reads, and the client file it may name, removed with this.
pub struct Prepared {
    pub args: Vec<String>,
    env: Vec<(String, Answer)>,
    /// The whole stdin of a method that reads its secret until EOF; nothing else is ever written to it.
    stdin: Option<Answer>,
    /// Variables the tool would read ahead of what the owner typed; removed from this run.
    unset: Vec<String>,
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
    let mut stdin = None;
    let mut client = None;
    let mut unset = Vec::new();
    if let Some(address) = inputs.address {
        args.extend([flag(method.address.as_ref(), "an address")?.clone(), valid_address(&address)?]);
    }
    let app = method.portal.is_some();
    if app && (inputs.portal.is_none() || inputs.app_id.is_none() || inputs.password.is_none()) {
        return Err("A local application signs in with its portal, Application ID and Application key.".into());
    }
    if let Some(portal) = inputs.portal {
        args.extend([flag(method.portal.as_ref(), "a portal")?.clone(), valid_portal(&portal)?]);
    }
    if app {
        // b24 takes these ahead of --client-id and stdin, so one left in the owner's shell would win silently.
        unset.extend([
            format!("{}_BITRIX24_CLIENT_ID", tool.storage.env),
            format!("{}_BITRIX24_CLIENT_SECRET", tool.storage.env),
        ]);
    }
    if let Some(id) = inputs.app_id {
        args.extend([flag(method.app_id.as_ref(), "an application")?.clone(), valid_app_id(&id)?]);
    }
    if let Some(password) = inputs.password {
        let password = Answer::new(password);
        if app {
            stdin = Some(valid_app_key(&password)?);
        } else if method.stdin {
            stdin = Some(valid_webhook(&password)?);
        } else if password.is_empty() || password.len() > 1024 || password.chars().any(char::is_control) {
            return Err("The app password is one line of at most 1024 characters.".into());
        } else {
            env.push((flag(method.password.as_ref(), "a password")?.clone(), password));
        }
    }
    if let Some(json) = inputs.client_file {
        let name = flag(method.client_file.as_ref(), "an app of your own")?;
        let file = ClientFile::write(&json)?;
        args.extend([name.clone(), file.path().to_string_lossy().into_owned()]);
        client = Some(file);
    } else if inputs.oauth {
        args.extend(method.oauth.clone().ok_or_else(|| "This sign-in takes no browser choice.".to_string())?);
    }
    Ok(Prepared { args, env, stdin, unset, _client: client })
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

/// A profile already signed in to the portal the owner is about to sign in to, and whose webhook it holds.
#[derive(specta::Type, serde::Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Signed {
    pub profile: String,
    /// The employee's id the portal names; None when the portal did not answer.
    pub user: Option<String>,
}

const IDENTITY: Duration = Duration::from_secs(30);

/// Every profile of the tool on `host`, with the employee its webhook acts as. The portal is asked only for a profile
/// on the same host; the address never leaves the tool.
pub fn on_portal(tool: &Tool, host: &str) -> Result<Vec<Signed>, String> {
    let sign_in = tool.sign_in.as_ref();
    let words = sign_in.and_then(|s| s.identity.as_ref()).ok_or_else(|| format!("{} keeps no portal", tool.name))?;
    let host = host.trim().to_ascii_lowercase();
    let mut found = Vec::new();
    for profile in crate::tools::profiles(tool)?.unwrap_or_default() {
        if profile.signed_in == Some(false) {
            continue;
        }
        let args = catalog::with_profile(words, Some(&profile.name))?;
        let Ok((_, Some(local))) = crate::skills::call(tool, &args, IDENTITY) else { continue };
        if local["item"]["portal"].as_str().map(str::to_ascii_lowercase).as_deref() != Some(host.as_str()) {
            continue;
        }
        let user = sign_in.and_then(|s| s.identity_check.as_ref()).and_then(|check| {
            let asked: Vec<String> = args.iter().cloned().chain([check.clone()]).collect();
            let (_, json) = crate::skills::call(tool, &asked, IDENTITY).ok()?;
            user_id(&json?["item"]["user"]["id"])
        });
        found.push(Signed { profile: profile.name, user });
    }
    Ok(found)
}

fn user_id(v: &serde_json::Value) -> Option<String> {
    v.as_str().map(str::to_string).or_else(|| v.as_u64().map(|n| n.to_string())).filter(|s| !s.is_empty())
}

/// A Bitrix24 incoming webhook as the portal shows it, `https://<portal>/rest/<user id>/<secret>/`. The error never
/// repeats it: the secret is part of the address.
fn valid_webhook(address: &Answer) -> Result<Answer, String> {
    let refused = || "This is not an incoming webhook address. Copy the whole address Bitrix24 shows.".to_string();
    let text = address.trim();
    let rest = text.strip_prefix("https://").ok_or_else(refused)?;
    let (host, path) = rest.split_once('/').ok_or_else(refused)?;
    // REST 3.0 pastes carry `api/` after `rest/`; b24 takes both.
    let mut parts = path.split('/').filter(|p| *p != "api");
    let shaped = !host.is_empty()
        && host.contains('.')
        && host.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':'))
        && parts.next() == Some("rest")
        && parts.next().is_some_and(|user| !user.is_empty() && user.chars().all(|c| c.is_ascii_digit()))
        && parts.next().is_some_and(|key| {
            !key.is_empty() && key.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
        });
    if !shaped || text.len() > 512 || text.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(refused());
    }
    Ok(Answer::new(text.to_string()))
}

/// A portal's host as b24's `--portal` takes it: no scheme, port or path, so nothing but a name reaches the flag.
fn valid_portal(portal: &str) -> Result<String, String> {
    let host = portal.trim().to_ascii_lowercase();
    let shaped = host.len() <= 253
        && host.contains('.')
        && !host.starts_with(['-', '.'])
        && !host.ends_with('.')
        && host.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-'));
    if !shaped {
        return Err("Type the portal's address, such as mycompany.bitrix24.ru.".into());
    }
    Ok(host)
}

/// Bitrix24 shows the Application ID as `local.<hex>.<digits>`; any shape of id is let through, never one that reads
/// as a flag.
fn valid_app_id(id: &str) -> Result<String, String> {
    let id = id.trim();
    let shaped = !id.is_empty()
        && id.len() <= 128
        && !id.starts_with('-')
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    if !shaped {
        return Err("This is not an Application ID. Copy the client_id Bitrix24 shows for the application.".into());
    }
    Ok(id.to_string())
}

/// The application's key; the error never repeats it.
fn valid_app_key(key: &Answer) -> Result<Answer, String> {
    let text = key.trim();
    if text.is_empty() || text.len() > 256 || text.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("This is not an Application key. Copy the client_secret Bitrix24 shows for the application.".into());
    }
    Ok(Answer::new(text.to_string()))
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
    for name in &prepared.unset {
        cmd.env_remove(name);
    }
    let mut parser = Parser::default();
    let mut outcome = None;
    let k = key(&tool.id);
    let result = run::stream_stoppable(
        cmd,
        TIMEOUT,
        stopped,
        GRACE,
        |mut stdin| match &prepared.stdin {
            // Dropped at once: the tool reads until EOF.
            Some(secret) => {
                let _ = stdin.write_all(secret.as_bytes()).and_then(|()| stdin.write_all(b"\n"));
            }
            None => {
                answers().lock().unwrap().insert(k.clone(), stdin);
            }
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
    fn a_sign_in_waits_for_an_install_of_its_package() {
        let tg = catalog::tool("tg").unwrap();
        let running = Running::default();
        assert!(running.start("tg"));
        assert!(claim(tg, &running).unwrap_err().contains("being installed"));
        running.finish("tg");
        assert_eq!(claim(tg, &running).unwrap(), key("tg"));
        assert!(claim(tg, &running).unwrap_err().contains("still running"));
    }

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
            ..Inputs::default()
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
    fn a_webhook_goes_only_to_stdin_and_a_bad_one_is_never_repeated() {
        let b24 = catalog::tool("bitrix").unwrap();
        let hook = "https://acme.bitrix24.ru/rest/12/s3cr3tk3y/";
        let typed = |text: &str| Inputs { password: Some(text.into()), ..Inputs::default() };
        assert!(args(b24, "webhook", "work", typed("https://acme.bitrix24.ru/rest/api/12/s3cr3tk3y/")).is_ok());
        let prepared = args(b24, "webhook", "work", typed(&format!(" {hook} "))).unwrap();
        assert_eq!(prepared.args, ["work", "session", "start", "--json"]);
        assert_eq!(prepared.env.len(), 0);
        assert_eq!(prepared.unset.len(), 0);
        assert_eq!(prepared.stdin.as_deref().map(String::as_str), Some(hook));
        for bad in [
            "http://acme.bitrix24.ru/rest/12/s3cr3tk3y/",
            "https://acme.bitrix24.ru/rest/x/s3cr3tk3y/",
            "https://acme.bitrix24.ru/crm/12/s3cr3tk3y/",
            "https://acme.bitrix24.ru/rest/12/",
            "https://acme.bitrix24.ru/rest/12/s3cr3t k3y/",
            "--help",
        ] {
            let error = args(b24, "webhook", "work", typed(bad)).err().unwrap();
            assert!(!error.contains("s3cr3t"), "{error}");
        }
        assert!(
            args(b24, "webhook", "work", Inputs { address: Some("me@x.com".into()), ..Inputs::default() }).is_err()
        );
    }

    #[test]
    fn a_local_application_passes_its_portal_and_id_as_flags_and_its_key_only_on_stdin() {
        let b24 = catalog::tool("bitrix").unwrap();
        let typed = |portal: &str, id: &str, key: &str| Inputs {
            portal: Some(portal.into()),
            app_id: Some(id.into()),
            password: Some(key.into()),
            ..Inputs::default()
        };
        let prepared =
            args(b24, "app", "work", typed(" Acme.Bitrix24.ru ", "local.0123abcd.45678901", " k3y5ecr3t ")).unwrap();
        assert_eq!(
            prepared.args,
            [
                "work",
                "session",
                "start",
                "--json",
                "--portal",
                "acme.bitrix24.ru",
                "--client-id",
                "local.0123abcd.45678901"
            ]
        );
        assert_eq!(prepared.env.len(), 0);
        assert_eq!(prepared.stdin.as_deref().map(String::as_str), Some("k3y5ecr3t"));
        assert!(!prepared.args.iter().any(|a| a.contains("k3y5ecr3t")));
        assert_eq!(prepared.unset, ["B24_BITRIX24_CLIENT_ID", "B24_BITRIX24_CLIENT_SECRET"]);
        for (portal, id) in [
            ("https://acme.bitrix24.ru/", "local.1"),
            ("acme", "local.1"),
            ("-x.ru", "local.1"),
            ("acme.ru:8443", "local.1"),
            ("acme.ru", "--help"),
            ("acme.ru", "local 1"),
            ("acme.ru", ""),
        ] {
            assert!(args(b24, "app", "work", typed(portal, id, "k")).is_err(), "{portal} {id}");
        }
        for bad in ["s3cr3t key", "s3cr3t\nx", ""] {
            let error = args(b24, "app", "work", typed("acme.ru", "local.1", bad)).err().unwrap();
            assert!(bad.is_empty() || !error.contains("s3cr3t"), "{error}");
        }
        let without_key =
            Inputs { portal: Some("acme.ru".into()), app_id: Some("local.1".into()), ..Inputs::default() };
        assert!(args(b24, "app", "work", without_key).is_err(), "b24 would read an empty key as a webhook");
        let hook = Inputs { portal: Some("acme.ru".into()), ..Inputs::default() };
        assert!(args(b24, "webhook", "work", hook).is_err(), "the webhook takes no portal");
    }

    #[test]
    fn gmail_by_browser_asks_for_oauth_unless_an_own_client_file_already_does() {
        let email = catalog::tool("email").unwrap();
        let google = Inputs { oauth: true, ..Inputs::default() };
        let words = args(email, "gmail", "work", google).unwrap().args;
        assert_eq!(words, ["work", "session", "start", "--json", "--answer-stdin", "--method", "oauth"]);
        let json = r#"{"installed":{"client_id":"1.apps.googleusercontent.com","client_secret":"s"}}"#;
        let own = Inputs { oauth: true, client_file: Some(json.into()), ..Inputs::default() };
        let prepared = args(email, "gmail", "work", own).unwrap();
        assert!(!prepared.args.contains(&"--method".to_string()));
        assert!(args(email, "imap", "work", Inputs { oauth: true, ..Inputs::default() }).is_err());
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
