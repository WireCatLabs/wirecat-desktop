//! An `apt` copy's update through `PackageKit`, the system service App Center and GNOME Software install with. The app
//! stays an ordinary user process: `PackageKit` installs only a signed package from a configured repository, and polkit
//! decides whether to ask for the password, in its own window (rule 6). On Ubuntu a member of `sudo` is not asked
//! (`/usr/share/polkit-1/rules.d/org.freedesktop.packagekit.rules`).

use crate::package_update::Failure;
use serde::Serialize;
use std::collections::HashMap;
use tauri::ipc::Channel;
use zbus::MatchRule;
use zbus::blocking::{Connection, MessageIterator, Proxy};
use zbus::message::{Message, Type as MessageType};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};

const SERVICE: &str = "org.freedesktop.PackageKit";
const ROOT: &str = "/org/freedesktop/PackageKit";
const TRANSACTION: &str = "org.freedesktop.PackageKit.Transaction";
const PACKAGE: &str = "wirecat";

// Bit positions from PackageKit's pk-enum.h.
const FILTER_NONE: u64 = 1 << 1;
const FILTER_INSTALLED: u64 = 1 << 2;
const ONLY_TRUSTED: u64 = 1 << 1;

const EXIT_SUCCESS: u32 = 1;
const PERCENT_UNKNOWN: u32 = 101;

#[derive(specta::Type, Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "AptStage")]
pub enum Stage {
    Checking,
    /// polkit's window is open.
    Password,
    /// Another install, often unattended-upgrades, holds apt's lock.
    Waiting,
    Downloading,
    Installing,
}

#[derive(specta::Type, Serialize, Clone, PartialEq, Eq, Debug)]
#[serde(rename = "AptProgress")]
pub struct Progress {
    pub stage: Stage,
    pub percent: Option<u8>,
}

#[derive(Debug, PartialEq, Eq)]
enum Event {
    Package(String),
    Error(u32, String),
    Status(u32),
    Percentage(u32),
    Finished(u32),
    Gone,
}

fn event(msg: &Message) -> Option<Event> {
    let header = msg.header();
    let body = msg.body();
    match header.member()?.as_str() {
        "Package" => body.deserialize::<(u32, String, String)>().ok().map(|(_, id, _)| Event::Package(id)),
        "ErrorCode" => body.deserialize::<(u32, String)>().ok().map(|(code, text)| Event::Error(code, text)),
        "Finished" => body.deserialize::<(u32, u32)>().ok().map(|(exit, _)| Event::Finished(exit)),
        "Destroy" => Some(Event::Gone),
        "PropertiesChanged" => {
            let (_, changed, _) = body.deserialize::<(String, HashMap<String, OwnedValue>, Vec<String>)>().ok()?;
            let number = |key: &str| changed.get(key).and_then(|v| u32::try_from(v).ok());
            number("Percentage").map(Event::Percentage).or_else(|| number("Status").map(Event::Status))
        }
        _ => None,
    }
}

/// `PackageKit`'s `PkStatusEnum`; the steps not listed keep the stage shown before.
fn stage(status: u32) -> Option<Stage> {
    match status {
        4 | 7 | 13 | 20 | 21 | 27 => Some(Stage::Checking),
        31 => Some(Stage::Password),
        30 => Some(Stage::Waiting),
        8 => Some(Stage::Downloading),
        9 | 10 | 11 | 14 | 15 | 16 | 35 | 36 => Some(Stage::Installing),
        _ => None,
    }
}

/// `PackageKit`'s `PkErrorEnum`.
fn failure(code: u32, detail: String) -> Failure {
    match code {
        2 | 10 | 37 | 43 => Failure::Offline { detail },
        17 | 48 => Failure::Refused { detail },
        26 | 66 | 67 => Failure::Busy { detail },
        46 => Failure::DiskFull { folder: "/var/cache/apt".into(), detail },
        _ => Failure::Other { detail },
    }
}

fn unavailable(e: &zbus::Error) -> Failure {
    Failure::Unavailable { detail: e.to_string() }
}

/// A package id is `name;version;arch;repository`.
fn version_of(id: &str) -> Option<&str> {
    let mut parts = id.split(';');
    (parts.next()? == PACKAGE).then_some(())?;
    parts.next().filter(|v| !v.is_empty())
}

/// A Debian version may carry a revision (`0.8.0-1`) that the release tag does not.
fn same_version(package: &str, wanted: &str) -> bool {
    package == wanted || package.strip_prefix(wanted).is_some_and(|rest| rest.starts_with('-'))
}

#[derive(Debug, PartialEq, Eq)]
enum Pick {
    Update(String),
    /// The repository already has a later release than the dialog named.
    Newer(String),
    /// The repository has not caught up with the release yet (it is rebuilt after each one).
    NotYet,
}

fn pick(ids: &[String], wanted: &str) -> Pick {
    let Some((id, version)) = ids.iter().find_map(|id| version_of(id).map(|v| (id, v))) else { return Pick::NotYet };
    if same_version(version, wanted) {
        Pick::Update(id.clone())
    } else if crate::tools::older(Some(wanted), version) {
        Pick::Newer(version.to_string())
    } else {
        Pick::NotYet
    }
}

/// `RefreshCache` passes through "waiting for auth" without a window, and the install resolves dependencies after it
/// started downloading: neither may move the stage the user sees.
fn shows(installs: bool, next: Stage) -> bool {
    match next {
        Stage::Password => installs,
        Stage::Checking => !installs,
        _ => true,
    }
}

/// One `PackageKit` transaction: what it reported, or why it failed.
struct Run<'a> {
    bus: &'a Connection,
    on_event: &'a dyn Fn(Progress),
    stage: Stage,
    installs: bool,
}

impl Run<'_> {
    fn call<B>(&mut self, method: &str, body: &B, stage: Stage) -> Result<Vec<String>, Failure>
    where
        B: serde::Serialize + zbus::zvariant::DynamicType,
    {
        let path: OwnedObjectPath = self
            .bus
            .call_method(Some(SERVICE), ROOT, Some("org.freedesktop.PackageKit"), "CreateTransaction", &())
            .and_then(|reply| reply.body().deserialize())
            .map_err(|e| unavailable(&e))?;
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .path(path.as_ref())
            .map_err(|e| unavailable(&e))?
            .build();
        // Subscribed before the method starts the transaction, so its first signals are not missed.
        let signals = MessageIterator::for_match_rule(rule, self.bus, None).map_err(|e| unavailable(&e))?;
        let proxy = Proxy::new(self.bus, SERVICE, path.as_ref(), TRANSACTION).map_err(|e| unavailable(&e))?;
        let locale = std::env::var("LANG").unwrap_or_default();
        let hints = vec!["interactive=true".to_string(), format!("locale={locale}")];
        let _ = proxy.call_method("SetHints", &(hints,));
        proxy.call_method(method, body).map_err(|e| Failure::Other { detail: e.to_string() })?;
        self.stage = stage;
        self.installs = method == "UpdatePackages";
        (self.on_event)(Progress { stage, percent: None });
        self.follow(signals)
    }

    fn follow(&mut self, signals: MessageIterator) -> Result<Vec<String>, Failure> {
        let mut ids = Vec::new();
        let mut error = None;
        let mut percent = None;
        for msg in signals {
            let Ok(msg) = msg else { continue };
            match event(&msg) {
                Some(Event::Package(id)) => ids.push(id),
                Some(Event::Error(code, text)) => error = Some(failure(code, text)),
                Some(Event::Status(status)) => {
                    if let Some(next) = stage(status).filter(|s| *s != self.stage && shows(self.installs, *s)) {
                        self.stage = next;
                        percent = None;
                        (self.on_event)(Progress { stage: next, percent });
                    }
                }
                Some(Event::Percentage(p)) => {
                    // Each step of a transaction may count its own 0 to 100; the bar only fills, it never empties.
                    let counts = matches!(self.stage, Stage::Downloading | Stage::Installing);
                    let p = (counts && p < PERCENT_UNKNOWN).then(|| u8::try_from(p).unwrap_or(100));
                    if p > percent {
                        percent = p;
                        (self.on_event)(Progress { stage: self.stage, percent });
                    }
                }
                Some(Event::Finished(EXIT_SUCCESS)) => return error.map_or(Ok(ids), Err),
                Some(Event::Finished(exit)) => {
                    return Err(
                        error.unwrap_or_else(|| Failure::Other { detail: format!("PackageKit stopped (exit {exit})") })
                    );
                }
                Some(Event::Gone) => break,
                None => {}
            }
        }
        Err(error
            .unwrap_or_else(|| Failure::Other { detail: "PackageKit ended the transaction without an answer.".into() }))
    }
}

fn update(version: &str, flags: u64, on_event: &dyn Fn(Progress)) -> Result<(), Failure> {
    let bus = Connection::system().map_err(|e| unavailable(&e))?;
    let mut run = Run { bus: &bus, on_event, stage: Stage::Checking, installs: false };
    run.call("RefreshCache", &(false,), Stage::Checking)?;
    let updates = run.call("GetUpdates", &(FILTER_NONE,), Stage::Checking)?;
    let id = match pick(&updates, version) {
        Pick::Update(id) => id,
        Pick::Newer(version) => return Err(Failure::Newer { version }),
        Pick::NotYet => {
            // Software Updater may have installed it while this copy kept running: a restart is all that is left.
            let installed = run.call("Resolve", &(FILTER_INSTALLED, vec![PACKAGE]), Stage::Checking)?;
            if installed.iter().filter_map(|id| version_of(id)).any(|v| same_version(v, version)) {
                return Ok(());
            }
            return Err(Failure::NotYet { version: version.to_string() });
        }
    };
    run.call("UpdatePackages", &(flags, vec![id]), Stage::Downloading)?;
    Ok(())
}

/// Installs the version the dialog named from the apt repository; the interface restarts the app after it.
pub async fn install(version: String, on_event: Channel<Progress>) -> Result<(), Failure> {
    if crate::package_update::current() != crate::package_update::Kind::Apt {
        return Err(Failure::Other { detail: "This copy does not update through apt.".into() });
    }
    tauri::async_runtime::spawn_blocking(move || {
        update(&version, ONLY_TRUSTED, &|p| {
            let _ = on_event.send(p);
        })
    })
    .await
    .map_err(|e| Failure::Other { detail: e.to_string() })?
}

#[cfg(test)]
mod tests {
    use super::*;
    use zbus::zvariant::Value;

    const SIMULATE: u64 = 1 << 2;

    fn signal<B>(member: &str, body: &B) -> Message
    where
        B: serde::Serialize + zbus::zvariant::DynamicType,
    {
        Message::signal("/1_abc", TRANSACTION, member).unwrap().build(body).unwrap()
    }

    #[test]
    fn reads_the_transaction_signals() {
        let id = "wirecat;0.8.0;amd64;wirecat-stable-main";
        assert_eq!(event(&signal("Package", &(11_u32, id, "WireCat"))), Some(Event::Package(id.into())));
        assert_eq!(event(&signal("ErrorCode", &(48_u32, "no"))), Some(Event::Error(48, "no".into())));
        assert_eq!(event(&signal("Finished", &(1_u32, 900_u32))), Some(Event::Finished(1)));
        assert_eq!(event(&signal("Destroy", &())), Some(Event::Gone));
        assert_eq!(event(&signal("RepoDetail", &("main", "x", true))), None);
    }

    #[test]
    fn reads_percentage_and_status_from_property_changes() {
        let changed = |key: &str, n: u32| {
            let props = HashMap::from([(key.to_string(), Value::from(n))]);
            Message::signal("/1_abc", "org.freedesktop.DBus.Properties", "PropertiesChanged")
                .unwrap()
                .build(&(TRANSACTION, props, Vec::<String>::new()))
                .unwrap()
        };
        assert_eq!(event(&changed("Percentage", 40)), Some(Event::Percentage(40)));
        assert_eq!(event(&changed("Status", 31)), Some(Event::Status(31)));
        assert_eq!(event(&changed("Speed", 5)), None);
    }

    #[test]
    fn tells_the_password_window_and_a_busy_apt_apart() {
        assert_eq!(stage(31), Some(Stage::Password));
        assert_eq!(stage(30), Some(Stage::Waiting));
        assert_eq!(stage(8), Some(Stage::Downloading));
        assert_eq!(stage(16), Some(Stage::Installing));
        assert_eq!(stage(7), Some(Stage::Checking));
        assert_eq!(stage(3), None);
    }

    #[test]
    fn the_stage_never_steps_back_or_asks_for_a_password_while_checking() {
        assert!(!shows(false, Stage::Password));
        assert!(shows(false, Stage::Waiting));
        assert!(shows(true, Stage::Password));
        assert!(!shows(true, Stage::Checking));
        assert!(shows(true, Stage::Installing));
    }

    #[test]
    fn maps_packagekit_errors_to_what_the_user_can_do() {
        assert!(matches!(failure(2, "x".into()), Failure::Offline { .. }));
        assert!(matches!(failure(48, "x".into()), Failure::Refused { .. }));
        assert!(matches!(failure(26, "x".into()), Failure::Busy { .. }));
        assert!(matches!(failure(46, "x".into()), Failure::DiskFull { .. }));
        assert!(matches!(failure(30, "x".into()), Failure::Other { .. }));
    }

    #[test]
    fn picks_wirecat_at_the_version_the_dialog_named() {
        let ids: Vec<String> =
            ["firefox;140.0;amd64;ubuntu", "wirecat;0.8.0;amd64;wirecat-stable-main"].map(String::from).to_vec();
        assert_eq!(pick(&ids, "0.8.0"), Pick::Update(ids[1].clone()));
        assert_eq!(pick(&ids, "0.7.5"), Pick::Newer("0.8.0".into()));
        assert_eq!(pick(&ids, "0.9.0"), Pick::NotYet);
        assert_eq!(pick(&ids[..1], "0.8.0"), Pick::NotYet);
        assert_eq!(pick(&["wirecat;0.8.0-1;amd64;x".into()], "0.8.0"), Pick::Update("wirecat;0.8.0-1;amd64;x".into()));
    }

    #[test]
    fn reads_only_wirecat_ids() {
        assert_eq!(version_of("wirecat;0.8.0;amd64;repo"), Some("0.8.0"));
        assert_eq!(version_of("wirecat-cli;0.8.0;amd64;repo"), None);
        assert_eq!(version_of("wirecat;;amd64;repo"), None);
        assert!(!same_version("0.8.01", "0.8.0"));
    }

    /// Asks this computer's `PackageKit` for the update and simulates it: nothing is installed.
    #[test]
    #[ignore = "talks to the system's PackageKit; needs WIRECAT_PROBES=apt"]
    fn simulates_the_update_through_packagekit() {
        if !crate::probe::accounts().iter().any(|(tool, _)| tool == "apt") {
            return;
        }
        let version = std::env::var("WIRECAT_APT_VERSION").expect("WIRECAT_APT_VERSION names the version to offer");
        let seen = std::sync::Mutex::new(Vec::new());
        let result = update(&version, ONLY_TRUSTED | SIMULATE, &|p| seen.lock().unwrap().push(p));
        println!("{result:?} {:?}", seen.lock().unwrap());
        assert!(result.is_ok(), "{result:?}");
    }
}
