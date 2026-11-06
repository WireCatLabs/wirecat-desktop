use crate::{paths, run};
use serde::Serialize;
use std::path::Path;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::utils::config::BundleType;
use tauri_plugin_updater::{Error, UpdaterExt};

/// How this copy takes an update. A .deb or .rpm copy can only be replaced with administrator rights, which the app
/// never asks for (rule 6): it downloads the signed package and hands it to the system's installer, which asks for the
/// password itself. The updater plugin's own `install` would run `pkexec` or pipe a password to `sudo -S`.
#[derive(specta::Type, Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
#[serde(rename = "UpdateKind")]
pub enum Kind {
    #[serde(rename = "self")]
    SelfUpdate,
    Deb,
    Rpm,
    /// A Linux build the bundler did not mark (`pnpm app`): which file would replace it is unknown.
    Other,
}

pub fn kind(linux: bool, bundle: Option<BundleType>) -> Kind {
    if !linux {
        return Kind::SelfUpdate;
    }
    match bundle {
        Some(BundleType::AppImage) => Kind::SelfUpdate,
        Some(BundleType::Deb) => Kind::Deb,
        Some(BundleType::Rpm) => Kind::Rpm,
        _ => Kind::Other,
    }
}

pub fn current() -> Kind {
    kind(cfg!(target_os = "linux"), tauri::utils::platform::bundle_type())
}

#[derive(specta::Type, Serialize, Clone)]
#[serde(rename = "UpdateProgress")]
pub struct Progress {
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq, Eq)]
#[serde(tag = "result", rename_all = "camelCase")]
#[serde(rename = "PackageOutcome")]
pub enum Outcome {
    #[serde(rename_all = "camelCase")]
    Saved {
        file: String,
        /// `~`-shortened, for the sentence that says where it is.
        path: String,
        /// The system's software installer opened it; otherwise the file manager shows it.
        opened: bool,
        command: String,
    },
    /// Nothing was written: the bytes never left memory.
    BadSignature,
}

/// Why a package download failed, so the dialog can say what to do next. `detail` is the technical text for a small
/// line under the advice, never the main message.
#[derive(specta::Type, Serialize, Debug, PartialEq, Eq)]
#[serde(tag = "reason", rename_all = "camelCase")]
#[serde(rename = "UpdateFailure")]
pub enum Failure {
    Offline {
        detail: String,
    },
    /// GitHub keeps the releases: a rate limit or a server error there, not on this computer.
    Server {
        detail: String,
    },
    DiskFull {
        folder: String,
        detail: String,
    },
    NotWritable {
        folder: String,
        detail: String,
    },
    Newer {
        version: String,
    },
    Other {
        detail: String,
    },
}

fn busy_status(code: u16) -> bool {
    matches!(code, 403 | 429 | 500..=599)
}

/// The plugin reports a refused download only as text: "Download request failed with status: 403 Forbidden".
fn status_in(text: &str) -> Option<u16> {
    text.rsplit_once("status: ")?.1.get(..3)?.parse().ok()
}

fn failure(e: &Error) -> Failure {
    let detail = e.to_string();
    match e {
        Error::Reqwest(r) if r.status().is_some_and(|s| busy_status(s.as_u16())) => Failure::Server { detail },
        Error::Reqwest(r) if r.is_connect() || r.is_timeout() || r.is_request() || r.is_body() => {
            Failure::Offline { detail }
        }
        Error::Network(text) if status_in(text).is_some_and(busy_status) => Failure::Server { detail },
        // The plugin says this when every endpoint answered without a usable latest.json.
        Error::ReleaseNotFound => Failure::Server { detail },
        _ => Failure::Other { detail },
    }
}

fn write_failure(folder: &Path, e: &std::io::Error) -> Failure {
    use std::io::ErrorKind;
    let folder = paths::tilde(&folder.to_string_lossy());
    let detail = e.to_string();
    match e.kind() {
        ErrorKind::StorageFull | ErrorKind::QuotaExceeded => Failure::DiskFull { folder, detail },
        _ => Failure::NotWritable { folder, detail },
    }
}

/// A plain release version such as `0.4.0` or `0.5.0-beta.1`: it becomes part of a file name and a terminal line.
fn plain_version(version: &str) -> bool {
    let core = version.split(['-', '+']).next().unwrap_or_default();
    let parts: Vec<&str> = core.split('.').collect();
    version.len() <= 64
        && parts.len() == 3
        && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
        && version.bytes().all(|b| b.is_ascii_alphanumeric() || b".-+".contains(&b))
}

/// The release's own asset name, so the owner recognises it in Downloads. It is built, not read from the download URL:
/// the manifest points at GitHub API addresses (`/releases/assets/<id>`) that carry no file name.
fn file_name(kind: Kind, version: &str, arch: &str) -> Option<String> {
    if !plain_version(version) {
        return None;
    }
    match kind {
        Kind::Deb => {
            let arch = match arch {
                "x86_64" => "amd64",
                "aarch64" => "arm64",
                other => other,
            };
            Some(format!("wirecat_{version}_{arch}.deb"))
        }
        Kind::Rpm => Some(format!("wirecat-{version}-1.{arch}.rpm")),
        _ => None,
    }
}

fn shell_word(s: &str) -> String {
    if s.bytes().all(|b| b.is_ascii_alphanumeric() || b"._/+~-".contains(&b)) {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', r"'\''"))
    }
}

/// The program that installs a local package here. An .rpm copy may run on Fedora (dnf) or openSUSE (zypper); the
/// program on PATH decides, as for `tailscale_linux`'s curl line, because os-release names many rpm systems.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Manager {
    Apt,
    Dnf,
    Zypper,
}

fn manager(kind: Kind, has: impl Fn(&str) -> bool) -> Manager {
    match kind {
        Kind::Rpm if has("zypper") => Manager::Zypper,
        Kind::Rpm => Manager::Dnf,
        _ => Manager::Apt,
    }
}

/// The line the user runs in their terminal, where `sudo` asks for their password; the app itself never runs it. apt
/// reads a local package as its unprivileged `_apt` user, which cannot enter a home folder that is `drwxr-x---`, and
/// then prints "Download is performed unsandboxed as root". The copy goes to apt's own archive folder, which only root
/// can write and `_apt` can read: a copy in `/tmp` under the release's public name could be a file another user made
/// beforehand and still writes to, so their package would be installed as root. dnf and zypper have no such user.
/// `path` is the file Rust saved; `file` is plain (checked by `file_name`), so it needs no quoting.
const APT_ARCHIVES: &str = "/var/cache/apt/archives";

fn install_line(manager: Manager, path: &str, file: &str) -> String {
    let arg = shell_word(path);
    match manager {
        Manager::Apt => format!("sudo install -m 644 {arg} {APT_ARCHIVES}/ && sudo apt install {APT_ARCHIVES}/{file}"),
        Manager::Dnf => format!("sudo dnf install {arg}"),
        Manager::Zypper => format!("sudo zypper install {arg}"),
    }
}

/// The line for the package this run saved last. The interface only asks to open it; it never sends a path.
static SAVED_LINE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

pub fn open_terminal() -> Result<(), String> {
    let line = SAVED_LINE.lock().unwrap().clone().ok_or("No update package was downloaded in this session.")?;
    crate::terminal::open_line(&line)
}

fn bad_signature(e: &Error) -> bool {
    matches!(
        e,
        Error::Minisign(_)
            | Error::Base64(_)
            | Error::SignatureUtf8(_)
            | Error::SignedVersionMismatch { .. }
            | Error::MissingSignedVersion
    )
}

/// Only an installer is trusted to be what `xdg-open` starts: on this Ubuntu .rpm opens in the archive manager, and
/// "the installer opened" must not be said of that. Unknown handlers get the file shown in the file manager instead.
fn is_installer(desktop_id: &str) -> bool {
    const INSTALLERS: [&str; 7] = [
        "snap-store",
        "org.gnome.Software",
        "gnome-software",
        "gdebi",
        "org.kde.discover",
        "io.elementary.appcenter",
        "mintinstall",
    ];
    let id = desktop_id.trim();
    INSTALLERS.iter().any(|name| id.starts_with(name))
}

fn default_handler(kind: Kind) -> Option<String> {
    let mime = if kind == Kind::Rpm { "application/x-rpm" } else { "application/vnd.debian.binary-package" };
    let xdg = crate::paths::which_in("xdg-mime", &std::env::var_os("PATH").unwrap_or_default())?;
    let out = run::run(&xdg, &["query", "default", mime], None, Duration::from_secs(5)).ok()?;
    (out.code == Some(0)).then_some(out.stdout)
}

fn hand_over(kind: Kind, path: &Path) -> bool {
    let opened = default_handler(kind).is_some_and(|h| is_installer(&h))
        && tauri_plugin_opener::open_path(path, None::<&str>).is_ok();
    if !opened {
        let _ = tauri_plugin_opener::reveal_item_in_dir(path);
    }
    opened
}

fn write_package(dir: &Path, file: &str, bytes: &[u8]) -> Result<std::path::PathBuf, Failure> {
    std::fs::create_dir_all(dir).map_err(|e| write_failure(dir, &e))?;
    let to = dir.join(file);
    let partial = dir.join(format!(".{file}.partial"));
    let written = std::fs::write(&partial, bytes).and_then(|()| std::fs::rename(&partial, &to));
    if let Err(e) = written {
        let _ = std::fs::remove_file(&partial);
        return Err(write_failure(dir, &e));
    }
    Ok(to)
}

fn save(kind: Kind, file: String, bytes: &[u8]) -> Result<Outcome, Failure> {
    let dir = paths::downloads().ok_or_else(|| Failure::Other { detail: "No home folder to download into.".into() })?;
    let to = write_package(&dir, &file, bytes)?;
    let opened = hand_over(kind, &to);
    let command = install_line(manager(kind, |bin| paths::find(bin).is_some()), &to.to_string_lossy(), &file);
    *SAVED_LINE.lock().unwrap() = Some(command.clone());
    let path = paths::tilde(&to.to_string_lossy());
    Ok(Outcome::Saved { file, path, opened, command })
}

/// Downloads the package of the update the dialog named, checked against the app's signing key by the updater plugin
/// before any byte is written, saves it in Downloads and hands it to the system.
pub async fn download<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    version: &str,
    on_event: &Channel<Progress>,
) -> Result<Outcome, Failure> {
    let kind = current();
    if !matches!(kind, Kind::Deb | Kind::Rpm) {
        return Err(Failure::Other { detail: "This copy was not installed from a .deb or .rpm package.".into() });
    }
    let net = |e: Error| failure(&e);
    let update = app
        .updater()
        .map_err(net)?
        .check()
        .await
        .map_err(net)?
        .ok_or_else(|| Failure::Other { detail: "No update was found to download.".into() })?;
    if update.version != version {
        return Err(Failure::Newer { version: update.version });
    }
    let file = file_name(kind, &update.version, std::env::consts::ARCH).ok_or_else(|| Failure::Other {
        detail: format!("The update's version is not a plain one: {}", update.version),
    })?;
    let mut downloaded = 0u64;
    let bytes = update.download(
        |chunk, total| {
            downloaded += chunk as u64;
            let _ = on_event.send(Progress { downloaded, total });
        },
        || {},
    );
    let bytes = match bytes.await {
        Ok(bytes) => bytes,
        Err(e) if bad_signature(&e) => return Ok(Outcome::BadSignature),
        Err(e) => return Err(net(e)),
    };
    tauri::async_runtime::spawn_blocking(move || save(kind, file, &bytes))
        .await
        .map_err(|e| Failure::Other { detail: e.to_string() })?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_linux_packages_need_the_system_installer() {
        assert_eq!(kind(false, None), Kind::SelfUpdate);
        assert_eq!(kind(false, Some(BundleType::Msi)), Kind::SelfUpdate);
        assert_eq!(kind(true, Some(BundleType::AppImage)), Kind::SelfUpdate);
        assert_eq!(kind(true, Some(BundleType::Deb)), Kind::Deb);
        assert_eq!(kind(true, Some(BundleType::Rpm)), Kind::Rpm);
        assert_eq!(kind(true, None), Kind::Other);
    }

    #[test]
    fn names_the_package_like_the_release_asset() {
        assert_eq!(file_name(Kind::Deb, "0.4.0", "x86_64").unwrap(), "wirecat_0.4.0_amd64.deb");
        assert_eq!(file_name(Kind::Rpm, "0.4.0", "x86_64").unwrap(), "wirecat-0.4.0-1.x86_64.rpm");
        assert_eq!(file_name(Kind::Deb, "0.5.0-beta.1", "aarch64").unwrap(), "wirecat_0.5.0-beta.1_arm64.deb");
        assert_eq!(file_name(Kind::Other, "0.4.0", "x86_64"), None);
        assert_eq!(file_name(Kind::SelfUpdate, "0.4.0", "x86_64"), None);
    }

    #[test]
    fn a_github_api_asset_url_does_not_stop_the_update() {
        // v0.4.0's latest.json, linux-x86_64-deb: the name came from this URL and was refused.
        let url = "https://api.github.com/repos/WireCatLabs/wirecat-desktop/releases/assets/711991432";
        assert!(tauri::Url::parse(url).is_ok());
        assert_eq!(file_name(Kind::Deb, "0.4.0", "x86_64").unwrap(), "wirecat_0.4.0_amd64.deb");
    }

    #[test]
    fn refuses_a_version_that_is_not_plain() {
        for bad in ["", "0.4", "v0.4.0", "0.4.0/../x", "0.4.0 x", "0.4.0;rm", "../0.4.0", "0.4.a"] {
            assert_eq!(file_name(Kind::Deb, bad, "x86_64"), None, "{bad:?} was accepted");
        }
    }

    #[test]
    fn a_rate_limit_or_server_error_is_github_not_the_network() {
        let refused = |code: &str| Error::Network(format!("Download request failed with status: {code}"));
        assert!(matches!(failure(&refused("403 Forbidden")), Failure::Server { .. }));
        assert!(matches!(failure(&refused("429 Too Many Requests")), Failure::Server { .. }));
        assert!(matches!(failure(&refused("502 Bad Gateway")), Failure::Server { .. }));
        assert!(matches!(failure(&Error::ReleaseNotFound), Failure::Server { .. }));
        assert!(matches!(failure(&refused("404 Not Found")), Failure::Other { .. }));
    }

    #[test]
    fn no_connection_is_told_to_check_the_internet() {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let sent = tauri::async_runtime::block_on(reqwest::Client::new().get("http://127.0.0.1:1/").send());
        let e = Error::Reqwest(sent.expect_err("nothing listens on port 1"));
        assert!(matches!(failure(&e), Failure::Offline { .. }));
    }

    #[test]
    fn a_full_disk_names_the_folder() {
        let dir = Path::new("/home/someone/Downloads");
        let full = std::io::Error::from_raw_os_error(28);
        assert!(matches!(write_failure(dir, &full), Failure::DiskFull { folder, .. } if folder.ends_with("Downloads")));
        let denied = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        assert!(matches!(write_failure(dir, &denied), Failure::NotWritable { .. }));
    }

    #[cfg(unix)]
    #[test]
    fn a_folder_that_cannot_be_written_is_named_and_left_clean() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("wirecat-package-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o555)).unwrap();
        let result = write_package(&dir, "wirecat_0.4.0_amd64.deb", b"package");
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
        let left = std::fs::read_dir(&dir).unwrap().count();
        std::fs::remove_dir_all(&dir).unwrap();
        assert!(matches!(result, Err(Failure::NotWritable { .. })), "{result:?}");
        assert_eq!(left, 0, "a partial file was left behind");
    }

    #[test]
    fn a_failure_reaches_the_interface_with_its_reason() {
        let json =
            serde_json::to_value(Failure::DiskFull { folder: "~/Downloads".into(), detail: "x".into() }).unwrap();
        assert_eq!(json, serde_json::json!({ "reason": "diskFull", "folder": "~/Downloads", "detail": "x" }));
    }

    #[test]
    fn builds_the_apt_line_from_the_absolute_path() {
        let deb = "wirecat_0.1.2_amd64.deb";
        assert_eq!(
            install_line(Manager::Apt, &format!("/home/u/Downloads/{deb}"), deb),
            format!(
                "sudo install -m 644 /home/u/Downloads/{deb} /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/{deb}"
            )
        );
    }

    #[test]
    fn an_rpm_goes_to_zypper_where_it_exists_and_to_dnf_otherwise() {
        let rpm = "wirecat-0.1.2-1.x86_64.rpm";
        let path = format!("/home/u/Downloads/{rpm}");
        let fedora = manager(Kind::Rpm, |bin| bin == "dnf");
        let opensuse = manager(Kind::Rpm, |bin| bin == "zypper");
        assert_eq!(install_line(fedora, &path, rpm), format!("sudo dnf install {path}"));
        assert_eq!(install_line(opensuse, &path, rpm), format!("sudo zypper install {path}"));
        assert_eq!(manager(Kind::Rpm, |_| false), Manager::Dnf);
        assert_eq!(manager(Kind::Deb, |_| true), Manager::Apt);
    }

    #[test]
    fn quotes_a_path_with_spaces_or_quotes() {
        let deb = "wirecat_0.1.2_amd64.deb";
        assert_eq!(
            install_line(Manager::Apt, &format!("/home/u/My Downloads/{deb}"), deb),
            format!(
                "sudo install -m 644 '/home/u/My Downloads/{deb}' /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/{deb}"
            )
        );
        assert_eq!(
            install_line(Manager::Dnf, "/mnt/it's/$(w).rpm", "w.rpm"),
            r"sudo dnf install '/mnt/it'\''s/$(w).rpm'"
        );
    }

    #[test]
    fn opens_no_terminal_before_a_package_was_saved() {
        *SAVED_LINE.lock().unwrap() = None;
        assert!(open_terminal().is_err());
    }

    #[test]
    fn a_signature_problem_is_told_apart_from_a_network_one() {
        assert!(bad_signature(&Error::MissingSignedVersion));
        assert!(bad_signature(&Error::SignedVersionMismatch { signed: "0.1.1".into(), announced: "0.1.2".into() }));
        assert!(!bad_signature(&Error::Network("connection reset".into())));
        assert!(!bad_signature(&Error::ReleaseNotFound));
    }

    #[test]
    fn trusts_only_known_installers_to_open_a_package() {
        assert!(is_installer("snap-store_snap-store.desktop\n"));
        assert!(is_installer("org.gnome.Software.desktop"));
        assert!(!is_installer("org.gnome.FileRoller.desktop"));
        assert!(!is_installer(""));
    }
}
