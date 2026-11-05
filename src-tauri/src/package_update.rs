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

/// The line to paste in a terminal. `~/` stays outside the quotes, or the shell would not expand it. apt reads a local
/// package as its unprivileged `_apt` user, which cannot enter a home folder that is `drwxr-x---`, and then prints
/// "Download is performed unsandboxed as root". The copy goes to apt's own archive folder, which only root can write and
/// `_apt` can read: a copy in `/tmp` under the release's public name could be a file another user made beforehand and
/// still writes to, so their package would be installed as root. dnf has no such user. `file` is plain (checked by
/// `file_name`), so it needs no quoting.
const APT_ARCHIVES: &str = "/var/cache/apt/archives";

pub fn install_line(kind: Kind, path: &str, file: &str) -> String {
    let arg = match path.strip_prefix("~/") {
        Some(rest) => format!("~/{}", shell_word(rest)),
        None => shell_word(path),
    };
    if kind == Kind::Rpm {
        format!("sudo dnf install {arg}")
    } else {
        format!("sudo install -m 644 {arg} {APT_ARCHIVES}/ && sudo apt install {APT_ARCHIVES}/{file}")
    }
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
    let path = paths::tilde(&to.to_string_lossy());
    let command = install_line(kind, &path, &file);
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
    fn builds_the_terminal_line() {
        let deb = "wirecat_0.1.2_amd64.deb";
        assert_eq!(
            install_line(Kind::Deb, &format!("~/Downloads/{deb}"), deb),
            format!(
                "sudo install -m 644 ~/Downloads/{deb} /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/{deb}"
            )
        );
        assert_eq!(
            install_line(Kind::Rpm, "~/Downloads/wirecat-0.1.2-1.x86_64.rpm", "wirecat-0.1.2-1.x86_64.rpm"),
            "sudo dnf install ~/Downloads/wirecat-0.1.2-1.x86_64.rpm"
        );
        assert_eq!(
            install_line(Kind::Deb, &format!("~/My Downloads/{deb}"), deb),
            format!(
                "sudo install -m 644 ~/'My Downloads/{deb}' /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/{deb}"
            )
        );
        assert_eq!(
            install_line(Kind::Deb, "/mnt/it's/w.deb", "w.deb"),
            r"sudo install -m 644 '/mnt/it'\''s/w.deb' /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/w.deb"
        );
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
