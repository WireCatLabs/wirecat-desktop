//! The real install, verify and uninstall code with the real npm, on a tiny package served from a registry inside the
//! test, in folders made for the run. CI runs it on Windows, macOS and Linux; locally: `bin/install-e2e`.

use crate::catalog::Tool;
use crate::install::{self, InstallEvent, Running};
use crate::{npm_prefix, own_pnpm, paths, system};
use sha2::{Digest, Sha512};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};

pub const PACKAGE: &str = "wirecat-install-probe";
const BIN: &str = "wirecat-probe";
const VERSION: &str = "1.0.0";
/// A release whose `commands` fails, as a release with a broken build would.
const BROKEN: &str = "1.1.0";
/// What the registry gives as `latest`; the update scenarios move it.
static LATEST: Mutex<&str> = Mutex::new(VERSION);

#[test]
#[ignore = "runs the real npm and pnpm and changes this process's environment; bin/install-e2e"]
fn install_e2e() {
    let root = std::env::temp_dir().join(format!("wirecat-install-e2e-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let registry = serve_registry();
    let home = root.join("home");
    let missing = root.join("not-created-yet").join("npm");
    let pnpm_dir = root.join("Application Support").join("pnpm");
    for (name, value) in [
        ("HOME", home.clone()),
        ("USERPROFILE", home.clone()),
        ("APPDATA", home.join("AppData").join("Roaming")),
        ("LOCALAPPDATA", home.join("AppData").join("Local")),
        ("XDG_DATA_HOME", home.join(".local").join("share")),
        ("WIRECAT_NODE_DIR", root.join("no-managed-node")),
        // macOS keeps the app's data under `Application Support`: the space must survive pnpm's shims and flags.
        ("WIRECAT_PNPM_DIR", pnpm_dir.clone()),
        ("npm_config_cache", root.join("npm-cache")),
        ("npm_config_userconfig", root.join("npmrc")),
        ("npm_config_registry", PathBuf::from(&registry)),
        ("npm_config_prefix", missing.clone()),
    ] {
        set_env(name, value.as_os_str());
    }
    std::fs::create_dir_all(&home).unwrap();
    // pnpm 11 reads the registry from an .npmrc, not from npm's variables.
    for npmrc in [home.join(".npmrc"), root.join("npmrc")] {
        std::fs::write(npmrc, format!("registry={registry}\n")).unwrap();
    }
    let tool = probe_tool();

    println!("npm's global folder does not exist yet: {}", missing.display());
    let ready = system::readiness();
    assert_eq!(ready.npm_prefix_writable, Some(true), "a missing global folder is not a locked one");

    println!("A copy the user installed with npm moves to the app's pnpm on the next update");
    npm_install_by_hand();
    // A user's npm folder is on their PATH; without it here the copy would be invisible and nothing would be moved.
    isolate_path(&root, &npm_prefix::bin_dir(&missing));
    paths::refresh(&[]);
    assert!(paths::find(BIN).unwrap().starts_with(npm_prefix::bin_dir(&missing)), "the npm copy is in place");
    run(&tool, install::install, "done");
    let copies = paths::find_all(BIN);
    assert_eq!(copies.len(), 1, "one copy is left: {copies:?}");
    assert!(own_pnpm::owns(&copies[0]), "{} is not the app's pnpm copy", copies[0].display());
    assert!(!npm_prefix::bin_dir(&missing).join(BIN).exists(), "the npm copy is removed");
    run(&tool, install::uninstall, "removed");
    assert!(paths::find(BIN).is_none());

    let locked = root.join("locked");
    std::fs::create_dir_all(&locked).unwrap();
    lock(&locked);
    assert!(std::fs::write(locked.join("probe"), b"").is_err() || running_as_root(), "the folder must refuse writes");
    set_env("npm_config_prefix", locked.as_os_str());
    println!("npm's global folder refuses writes, which the app's pnpm does not need: {}", locked.display());
    run(&tool, install::install, "done");
    let copy = paths::find(BIN).unwrap();
    assert!(own_pnpm::owns(&copy), "{} is not the app's pnpm copy", copy.display());
    if cfg!(windows) {
        assert!(paths::in_terminal(BIN), "a new terminal must find it through the user Path");
    }

    println!("An update that fails its check puts the version from before back");
    *LATEST.lock().unwrap() = BROKEN;
    run(&tool, install::install, "failed");
    *LATEST.lock().unwrap() = VERSION;
    let copies = crate::tools::detect(&tool, true).installs;
    assert_eq!(copies.len(), 1, "{:?}", copies.iter().map(|c| &c.path).collect::<Vec<_>>());
    assert_eq!(copies[0].version.as_deref(), Some(VERSION), "the tool is still there, at the version from before");

    println!("A pnpm whose files are gone is installed again");
    let pnpm_dist = pnpm_dir.join(if cfg!(windows) {
        "program/node_modules/pnpm/dist"
    } else {
        "program/lib/node_modules/pnpm/dist"
    });
    std::fs::remove_dir_all(&pnpm_dist).unwrap();
    assert!(own_pnpm::working().is_none());
    run(&tool, install::install, "done");
    assert!(own_pnpm::working().is_some());

    println!("Programs left without their tool's folder are removed with it");
    let folder = own_pnpm::package_dir(PACKAGE).unwrap();
    let folder = std::fs::canonicalize(&folder).unwrap();
    assert!(folder.starts_with(std::fs::canonicalize(&pnpm_dir).unwrap()), "{}", folder.display());
    std::fs::remove_dir_all(&folder).unwrap();
    assert_ne!(own_pnpm::shims_of(PACKAGE), Vec::<PathBuf>::new());
    run(&tool, install::uninstall, "removed");
    assert!(paths::find(BIN).is_none());
    assert_eq!(own_pnpm::shims_of(PACKAGE), Vec::<PathBuf>::new());

    #[cfg(unix)]
    only_the_apps_own_node(&tool, &root);

    unlock(&locked);
    let _ = std::fs::remove_dir_all(&root);
}

/// The app's own Node.js is on the app's search path and on no shell's PATH; pnpm's program must still find `node`.
/// 0.9.2 checked pnpm with the shell's PATH, and every install with the app's Node.js failed.
#[cfg(unix)]
fn only_the_apps_own_node(tool: &Tool, root: &Path) {
    use std::os::unix::fs::symlink;
    println!("With only the app's own Node.js, which no shell PATH has");
    let node = paths::find("node").unwrap();
    let out = crate::run::run(&node, &["--version"], None, std::time::Duration::from_secs(10)).unwrap();
    let own = root.join("own-node");
    let bin = own.join(out.stdout.trim()).join("bin");
    std::fs::create_dir_all(&bin).unwrap();
    for program in ["node", "npm"] {
        symlink(std::fs::canonicalize(paths::find(program).unwrap()).unwrap(), bin.join(program)).unwrap();
    }
    set_env("WIRECAT_NODE_DIR", own.as_os_str());
    set_env("PATH", std::ffi::OsStr::new("/usr/bin:/bin"));
    paths::forget_login_shell();
    paths::refresh(&[]);
    assert!(paths::which_in("node", std::ffi::OsStr::new("/usr/bin:/bin")).is_none(), "the shell must have no node");
    // macOS also knows Homebrew's folder, which no shell PATH here has either: the case is the same.
    assert!(paths::find("node").is_some(), "the app finds a Node.js the shell does not");
    run(tool, install::install, "done");
    run(tool, install::uninstall, "removed");
}

/// The real tg from npm: a copy installed with npm moves to the app's pnpm, its database driver is built, and it still
/// opens a store. Downloads about 100 MB; run by hand with `bin/install-e2e real_tool_e2e`.
#[test]
#[ignore = "downloads the real tg twice and changes this process's environment"]
fn real_tool_e2e() {
    let root = std::env::temp_dir().join(format!("wirecat-real-tool-e2e-{}", std::process::id()));
    let home = root.join("home");
    let prefix = root.join("npm");
    for (name, value) in [
        ("HOME", home.clone()),
        ("USERPROFILE", home.clone()),
        ("APPDATA", home.join("AppData").join("Roaming")),
        ("LOCALAPPDATA", home.join("AppData").join("Local")),
        ("XDG_DATA_HOME", home.join(".local").join("share")),
        ("XDG_CONFIG_HOME", home.join(".config")),
        ("WIRECAT_NODE_DIR", root.join("no-managed-node")),
        // macOS keeps the app's data under `Application Support`: the space must survive pnpm's shims and flags.
        ("WIRECAT_PNPM_DIR", root.join("Application Support").join("pnpm")),
        ("npm_config_cache", root.join("npm-cache")),
        ("npm_config_userconfig", root.join("npmrc")),
        ("npm_config_prefix", prefix.clone()),
    ] {
        set_env(name, value.as_os_str());
    }
    std::fs::create_dir_all(&home).unwrap();
    isolate_path(&root, &npm_prefix::bin_dir(&prefix));
    let tool = crate::catalog::tool("tg").unwrap();

    let npm = paths::find("npm").expect("npm");
    let status = crate::run::command(&npm, &["install", "--global", &tool.package, "--no-fund", "--no-audit"], None)
        .status()
        .unwrap();
    assert!(status.success(), "npm install by hand");
    paths::refresh(&[]);
    let found = paths::find_all(&tool.bin);
    assert!(found.iter().all(|c| c.starts_with(&root)), "only the run's own copy may be moved: {found:?}");
    run(tool, install::install, "done");
    let copies = paths::find_all(&tool.bin);
    assert_eq!(copies.len(), 1, "one copy is left: {copies:?}");
    assert!(own_pnpm::owns(&copies[0]), "{} is not the app's pnpm copy", copies[0].display());
    assert_eq!(own_pnpm::unbuilt_drivers_of(&tool.package), Vec::<PathBuf>::new());
    // Every store opens through this driver; a profile, which a fresh home lacks, is needed for the tool to open one.
    let links = root.join("Application Support/pnpm/store/v11/links/@/better-sqlite3");
    let driver = std::fs::read_dir(&links)
        .unwrap()
        .flatten()
        .flat_map(|v| std::fs::read_dir(v.path()).unwrap().flatten())
        .map(|h| h.path().join("node_modules/better-sqlite3"))
        .next()
        .expect("the driver is in the store");
    let open = format!("new (require({:?}))(':memory:').prepare('select 1').get()", driver.display().to_string());
    let node = paths::find("node").unwrap();
    let out = crate::run::run(&node, &["-e", &open], None, std::time::Duration::from_secs(30)).unwrap();
    assert_eq!(out.code, Some(0), "the driver opens a database: {}", out.stderr);

    println!("A driver whose build is gone is built again by the next install");
    let built = driver.join("build/Release/better_sqlite3.node");
    std::fs::remove_file(&built).unwrap();
    assert_eq!(own_pnpm::unbuilt_drivers_of(&tool.package).len(), 1, "the check sees the driver tg loads");
    run(tool, install::install, "done");
    assert_eq!(own_pnpm::unbuilt_drivers_of(&tool.package), Vec::<PathBuf>::new());
    run(tool, install::uninstall, "removed");
    let _ = std::fs::remove_dir_all(&root);
}

/// PATH with `first`, then Node.js alone. The folder Node.js sits in holds the user's own tools too (nvm puts every
/// global program beside `node`), and the install moves and removes every npm copy it finds: on 2026-11-27 a run with
/// the real PATH removed the owner's own tg. So on Unix only links to `node` and `npm` are kept. A CI runner has no
/// tools of its own, so Windows keeps its PATH.
fn isolate_path(root: &Path, first: &Path) {
    let mut path = vec![first.to_path_buf()];
    if cfg!(windows) {
        path.extend(std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()));
    } else {
        let node = root.join("node-only");
        std::fs::create_dir_all(&node).unwrap();
        for program in ["node", "npm"] {
            #[cfg(unix)]
            std::os::unix::fs::symlink(paths::find(program).unwrap(), node.join(program)).unwrap();
        }
        path.push(node);
        path.extend(["/usr/bin", "/bin"].map(PathBuf::from));
    }
    set_env("PATH", &std::env::join_paths(path).unwrap());
    paths::forget_login_shell();
    paths::refresh(&[]);
    let outside: Vec<String> = paths::lookup().folders.into_iter().filter(|f| f.contains(".nvm")).collect();
    assert!(outside.is_empty(), "the run must not see the user's own npm folders: {outside:?}");
}

/// The install a user makes in a terminal, into the npm folder the environment names.
fn npm_install_by_hand() {
    let npm = paths::find("npm").expect("npm");
    let spec = format!("{PACKAGE}@{VERSION}");
    let status = crate::run::command(&npm, &["install", "--global", &spec, "--no-fund", "--no-audit"], None)
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status()
        .unwrap();
    assert!(status.success(), "npm install by hand");
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
        "doctor": ["doctor", "--json"],
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

/// The two requests npm makes for one package: its document, then the tarball the document names. The document is
/// built on each request, so `LATEST` moves the release an update gets.
fn serve_registry() -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let tarballs: Vec<(String, Vec<u8>)> =
        [VERSION, BROKEN].iter().map(|v| (format!("/{PACKAGE}/-/{PACKAGE}-{v}.tgz"), package_tarball(v))).collect();
    let document = {
        let base = base.clone();
        let tarballs = tarballs.clone();
        move || {
            let mut versions = serde_json::Map::new();
            // pnpm installs only releases older than a day, and reads their age here.
            let mut time =
                serde_json::json!({ "created": "2020-01-01T00:00:00.000Z", "modified": "2020-01-01T00:00:00.000Z" });
            for (v, (path, tarball)) in [VERSION, BROKEN].iter().zip(&tarballs) {
                let integrity = format!("sha512-{}", base64(&Sha512::digest(tarball)));
                versions.insert(
                    (*v).into(),
                    serde_json::json!({
                        "name": PACKAGE,
                        "version": v,
                        "bin": { BIN: "cli.js" },
                        "dist": { "tarball": format!("{base}{path}"), "integrity": integrity },
                    }),
                );
                time[*v] = "2020-01-01T00:00:00.000Z".into();
            }
            let latest = *LATEST.lock().unwrap();
            serde_json::json!({ "name": PACKAGE, "dist-tags": { "latest": latest }, "time": time, "versions": versions })
                .to_string()
        }
    };
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let (document, tarballs) = (document(), tarballs.clone());
            std::thread::spawn(move || answer(stream, &document, &tarballs));
        }
    });
    format!("{base}/")
}

fn answer(mut stream: std::net::TcpStream, document: &str, tarballs: &[(String, Vec<u8>)]) {
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
    let tarball = tarballs.iter().find(|(p, _)| *p == path).map(|(_, t)| t.as_slice());
    let (status, kind, body): (&str, &str, &[u8]) = if path == format!("/{PACKAGE}") {
        ("200 OK", "application/json", document.as_bytes())
    } else if let Some(tarball) = tarball {
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
fn package_tarball(version: &str) -> Vec<u8> {
    let manifest = serde_json::json!({ "name": PACKAGE, "version": version, "bin": { BIN: "cli.js" } }).to_string();
    let commands = if version == BROKEN {
        "{ console.error(\"broken build\"); process.exit(1) }"
    } else {
        "console.log(JSON.stringify({ commands: [] }))"
    };
    let cli = format!(
        "#!/usr/bin/env node\nif (process.argv.includes(\"--version\")) console.log(\"{version}\")\n\
         if (process.argv[2] === \"commands\") {commands}\n"
    );
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
