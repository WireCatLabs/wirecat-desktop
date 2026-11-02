//! The real install, verify and uninstall code with the real npm, on a tiny package served from a registry inside the
//! test, in folders made for the run. CI runs it on Windows, macOS and Linux; locally: `bin/install-e2e`.

use crate::catalog::Tool;
use crate::install::{self, InstallEvent, Running};
use crate::{npm_prefix, paths, system};
use sha2::{Digest, Sha512};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};

pub const PACKAGE: &str = "wirecat-install-probe";
const BIN: &str = "wirecat-probe";
const VERSION: &str = "1.0.0";

#[test]
#[ignore = "runs the real npm and changes this process's environment; bin/install-e2e"]
fn install_e2e() {
    let root = std::env::temp_dir().join(format!("wirecat-install-e2e-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let registry = serve_registry();
    let home = root.join("home");
    let missing = root.join("not-created-yet").join("npm");
    for (name, value) in [
        ("HOME", home.clone()),
        ("USERPROFILE", home.clone()),
        ("APPDATA", home.join("AppData").join("Roaming")),
        ("LOCALAPPDATA", home.join("AppData").join("Local")),
        ("XDG_DATA_HOME", home.join(".local").join("share")),
        ("WIRECAT_NODE_DIR", root.join("no-managed-node")),
        ("npm_config_cache", root.join("npm-cache")),
        ("npm_config_userconfig", root.join("npmrc")),
        ("npm_config_registry", PathBuf::from(&registry)),
        ("npm_config_prefix", missing.clone()),
    ] {
        set_env(name, value.as_os_str());
    }
    std::fs::create_dir_all(&home).unwrap();
    let tool = probe_tool();

    println!("npm's global folder does not exist yet: {}", missing.display());
    let ready = system::readiness();
    assert_eq!(ready.npm_prefix_writable, Some(true), "a missing global folder is not a locked one");
    run(&tool, install::install, "done");
    assert!(paths::find(BIN).unwrap().starts_with(npm_prefix::bin_dir(&missing)), "installed into npm's own folder");
    run(&tool, install::uninstall, "removed");
    assert!(paths::find(BIN).is_none());

    let locked = root.join("locked");
    std::fs::create_dir_all(&locked).unwrap();
    lock(&locked);
    assert!(std::fs::write(locked.join("probe"), b"").is_err() || running_as_root(), "the folder must refuse writes");
    set_env("npm_config_prefix", locked.as_os_str());
    println!("npm's global folder refuses writes: {}", locked.display());
    let user = npm_prefix::user_prefix().unwrap();
    let ready = system::readiness();
    assert_eq!(ready.npm_prefix_writable, Some(true));
    assert_eq!(ready.npm_prefix.as_deref(), Some(paths::tilde(&user.to_string_lossy()).as_str()));
    run(&tool, install::install, "done");
    let copy = paths::find(BIN).unwrap();
    assert!(copy.starts_with(npm_prefix::bin_dir(&user)), "{} is not in the user's folder", copy.display());
    if cfg!(windows) {
        assert!(paths::in_terminal(BIN), "a new terminal must find it through the user Path");
    }
    run(&tool, install::uninstall, "removed");
    assert!(paths::find(BIN).is_none());

    unlock(&locked);
    let _ = std::fs::remove_dir_all(&root);
}

fn run(tool: &Tool, op: fn(&Tool, &Running, &Channel<InstallEvent>), expected: &str) {
    let events = Arc::new(Mutex::new(Vec::<String>::new()));
    let sink = Arc::clone(&events);
    let channel = Channel::new(move |body| {
        if let InvokeResponseBody::Json(json) = body {
            println!("  {json}");
            sink.lock().unwrap().push(json);
        }
        Ok(())
    });
    op(tool, &Running::default(), &channel);
    let last = events.lock().unwrap().last().cloned().unwrap_or_default();
    let event: serde_json::Value = serde_json::from_str(&last).unwrap_or_default();
    assert_eq!(event["event"], expected, "{last}");
}

fn probe_tool() -> Tool {
    let mut tool = serde_json::json!({
        "id": "probe",
        "name": "Probe",
        "bin": BIN,
        "package": PACKAGE,
        "repo": "WireCatLabs/wirecat-install-probe",
        "doctor": [],
        "storage": { "app": "wirecat-probe", "env": "WIRECAT_PROBE" },
    });
    for optional in ["profiles", "skill", "background", "mcp", "mcpServer", "sync", "partOf", "tasks", "memory"] {
        tool[optional] = serde_json::Value::Null;
    }
    serde_json::from_value(tool).expect("a tool the catalog would accept")
}

#[allow(unsafe_code)]
fn set_env(name: &str, value: &std::ffi::OsStr) {
    // SAFETY: this test runs alone (`--exact`), and nothing else reads the environment while it changes.
    unsafe { std::env::set_var(name, value) };
}

#[cfg(unix)]
fn lock(dir: &Path) {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o555)).unwrap();
}

#[cfg(unix)]
fn unlock(dir: &Path) {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o755)).unwrap();
}

/// A deny entry for the user holds even for an elevated runner, which is the closest a CI machine gets to a
/// `Program Files` folder seen without administrator rights.
#[cfg(windows)]
fn lock(dir: &Path) {
    icacls(dir, &["/deny", &format!("{}:(OI)(CI)W", whoami())]);
}

#[cfg(windows)]
fn unlock(dir: &Path) {
    icacls(dir, &["/remove:d", &whoami()]);
}

#[cfg(windows)]
fn whoami() -> String {
    let out = std::process::Command::new("whoami").output().unwrap();
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[cfg(windows)]
fn icacls(dir: &Path, args: &[&str]) {
    let status = std::process::Command::new("icacls").arg(dir).args(args).status().unwrap();
    assert!(status.success(), "icacls {args:?}");
}

fn running_as_root() -> bool {
    cfg!(unix) && std::env::var("USER").is_ok_and(|u| u == "root")
}

/// The two requests npm makes for one package: its document, then the tarball the document names.
fn serve_registry() -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}/", listener.local_addr().unwrap());
    let tarball = package_tarball();
    let tarball_path = format!("/{PACKAGE}/-/{PACKAGE}-{VERSION}.tgz");
    let integrity = format!("sha512-{}", base64(&Sha512::digest(&tarball)));
    let document = serde_json::json!({
        "name": PACKAGE,
        "dist-tags": { "latest": VERSION },
        "versions": { VERSION: {
            "name": PACKAGE,
            "version": VERSION,
            "bin": { BIN: "cli.js" },
            "dist": { "tarball": format!("{}{}", base.trim_end_matches('/'), tarball_path), "integrity": integrity },
        }},
    })
    .to_string();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let (document, tarball, tarball_path) = (document.clone(), tarball.clone(), tarball_path.clone());
            std::thread::spawn(move || answer(stream, &document, &tarball, &tarball_path));
        }
    });
    base
}

fn answer(mut stream: std::net::TcpStream, document: &str, tarball: &[u8], tarball_path: &str) {
    let mut request = Vec::new();
    let mut buf = [0u8; 4096];
    while !request.windows(4).any(|w| w == b"\r\n\r\n") {
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return,
            Ok(n) => request.extend_from_slice(&buf[..n]),
        }
    }
    let line = String::from_utf8_lossy(&request).lines().next().unwrap_or_default().to_string();
    let path = line.split_whitespace().nth(1).unwrap_or_default().to_string();
    println!("  registry: {line}");
    let (status, kind, body): (&str, &str, &[u8]) = if path == format!("/{PACKAGE}") {
        ("200 OK", "application/json", document.as_bytes())
    } else if path == tarball_path {
        ("200 OK", "application/octet-stream", tarball)
    } else {
        ("404 Not Found", "application/json", b"{}")
    };
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
}

/// The shape of a `WireCat` CLI that matters to installing it: a `bin` that answers `--version`.
fn package_tarball() -> Vec<u8> {
    let manifest = serde_json::json!({ "name": PACKAGE, "version": VERSION, "bin": { BIN: "cli.js" } }).to_string();
    let cli = format!("#!/usr/bin/env node\nif (process.argv.includes(\"--version\")) console.log(\"{VERSION}\")\n");
    let mut tar = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default()));
    for (name, body, mode) in
        [("package/package.json", manifest.as_bytes(), 0o644), ("package/cli.js", cli.as_bytes(), 0o755)]
    {
        let mut header = tar::Header::new_gnu();
        header.set_size(body.len() as u64);
        header.set_mode(mode);
        header.set_cksum();
        tar.append_data(&mut header, name, body).unwrap();
    }
    tar.into_inner().unwrap().finish().unwrap()
}

fn base64(bytes: &[u8]) -> String {
    const ABC: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, b)| n | u32::from(*b) << (16 - 8 * i));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ABC[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

#[test]
fn base64_matches_the_standard_alphabet() {
    assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    assert_eq!(base64(b"fo"), "Zm8=");
    assert_eq!(base64(b"f"), "Zg==");
}
