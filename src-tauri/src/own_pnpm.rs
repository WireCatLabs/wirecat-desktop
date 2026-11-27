//! The app's own pnpm, which installs official tools. npm gives every global package its own `node_modules`, so each
//! tool carried a full copy of cli-core and its dependencies (about 340 MB a tool). pnpm keeps one copy of each file
//! in a store and links it into every tool, across cli-core versions too, so each tool keeps its exact pin.
//! Plan: `docs/dev/plans/2026-11-27-pnpm-shared-install.md`.
//!
//! The app installs pnpm itself with npm, which comes with every Node.js: the user may have no pnpm, and corepack is not
//! shipped with Node.js 25 and later. The user's own pnpm, if any, is never used for these copies.

use crate::{node, npm_prefix};
use std::path::{Path, PathBuf};
use std::sync::RwLock;

pub const VERSION: &str = "11.28.8";
/// pnpm publishes from its release workflow on the version's tag.
pub const BUILT_BY: &str = "https://github.com/pnpm/pnpm/.github/workflows/release.yml@refs/tags/v11.28.8";

const REGISTRY: &str = "https://registry.npmjs.org/";

/// Dependencies whose install scripts must run; pnpm skips every other one. `better-sqlite3` builds the driver every
/// store opens through; `ssh2` and `cpu-features` build optional speedups and fall back without them.
const BUILDS: [&str; 3] = ["better-sqlite3", "ssh2", "cpu-features"];

/// `<app local data>/pnpm`; `WIRECAT_PNPM_DIR` moves it for tests. One folder, so the store and the tools sit on the
/// same drive: pnpm can link a file only within one drive.
fn root() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("WIRECAT_PNPM_DIR") {
        return Some(PathBuf::from(dir));
    }
    // Code here removes files; a test that forgot the variable must not reach the owner's real tools.
    if cfg!(test) {
        return None;
    }
    node::app_data().map(|d| d.join("pnpm"))
}

/// Held by every run of the app's pnpm; a store prune takes it alone, as removing packages under an install breaks it.
pub static RUNS: RwLock<()> = RwLock::new(());

/// `PNPM_HOME` for the tools: pnpm links their programs into `bin` and keeps each tool's folder under `global`.
pub fn home() -> Option<PathBuf> {
    root().map(|r| r.join("home"))
}

pub fn bin_dir() -> Option<PathBuf> {
    home().map(|h| h.join("bin"))
}

fn store() -> Option<PathBuf> {
    root().map(|r| r.join("store"))
}

/// Where npm installs pnpm itself, as a global prefix of its own.
fn prefix() -> Option<PathBuf> {
    root().map(|r| r.join("program"))
}

fn program_at(prefix: &Path) -> PathBuf {
    npm_prefix::bin_dir(prefix).join(if cfg!(windows) { "pnpm.cmd" } else { "pnpm" })
}

fn installed_version(prefix: &Path) -> Option<String> {
    let lib = if cfg!(windows) { prefix.join("node_modules") } else { prefix.join("lib").join("node_modules") };
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(lib.join("pnpm/package.json")).ok()?).ok()?;
    manifest["version"].as_str().map(str::to_string)
}

/// The app's pnpm when it is installed at `VERSION`.
pub fn program() -> Option<PathBuf> {
    let prefix = prefix()?;
    let program = program_at(&prefix);
    (program.is_file() && installed_version(&prefix).as_deref() == Some(VERSION)).then_some(program)
}

/// `program()` that also starts: npm sees `package.json` and counts pnpm as installed, even with its files gone. With
/// the app's PATH, which has the app's own Node.js: pnpm's program finds `node` there.
pub fn working() -> Option<PathBuf> {
    let program = program()?;
    let path = crate::paths::search_path();
    let out = crate::run::run(&program, &["--version"], Some(&path), std::time::Duration::from_secs(30)).ok()?;
    (out.code == Some(0) && out.stdout.trim() == VERSION).then_some(program)
}

pub fn is_program(path: &Path) -> bool {
    prefix().is_some_and(|p| path.starts_with(p))
}

/// A copy of a tool this pnpm installed.
pub fn owns(copy: &Path) -> bool {
    home().is_some_and(|h| copy.starts_with(h))
}

/// What npm runs to install pnpm `VERSION` into the app's folder, from the public registry whatever `.npmrc` says,
/// as provenance is checked there.
pub fn setup_args() -> Option<(PathBuf, Vec<String>)> {
    let prefix = prefix()?;
    let args = vec![
        "install".into(),
        "--global".into(),
        format!("pnpm@{VERSION}"),
        format!("--registry={REGISTRY}"),
        "--no-fund".into(),
        "--no-audit".into(),
    ];
    Some((prefix, args))
}

/// `pnpm add --global` with the app's store and the builds the tools need.
pub fn add_args(spec: &str, extra: &[&str]) -> Vec<String> {
    let mut args: Vec<String> = vec!["add".into(), "--global".into(), spec.into()];
    if let Some(store) = store() {
        args.push(format!("--store-dir={}", store.display()));
    }
    args.extend(BUILDS.iter().map(|b| format!("--allow-build={b}")));
    args.extend(extra.iter().map(|s| (*s).to_string()));
    args
}

pub fn remove_args(package: &str) -> Vec<String> {
    vec!["remove".into(), "--global".into(), package.into()]
}

/// The environment the app's pnpm runs with: its own home, whatever `PNPM_HOME` the user set.
pub fn configure(cmd: &mut std::process::Command) {
    if let Some(home) = home() {
        cmd.env("PNPM_HOME", home);
    }
}

/// What prunes the store of packages no installed tool links to: every update leaves the old version's files.
pub fn prune_args() -> Option<Vec<String>> {
    store().map(|s| vec!["store".into(), "prune".into(), format!("--store-dir={}", s.display())])
}

/// The folder pnpm installed `package` into, while it is there.
pub fn package_dir(package: &str) -> Option<PathBuf> {
    let global = home()?.join("global").join("v11");
    std::fs::read_dir(global)
        .ok()?
        .flatten()
        .map(|e| e.path().join("node_modules").join(package))
        .find(|p| p.join("package.json").is_file())
}

/// Programs in the app's `bin` that still run `package`: pnpm leaves them when the tool's folder went first.
pub fn shims_of(package: &str) -> Vec<PathBuf> {
    let Some(bin) = bin_dir() else { return Vec::new() };
    let marks = [format!("node_modules/{package}/"), format!("node_modules\\{}\\", package.replace('/', "\\"))];
    std::fs::read_dir(&bin).map_or_default(|r| {
        r.flatten()
            .map(|e| e.path())
            .filter(|p| p.starts_with(&bin) && p.is_file())
            .filter(|p| std::fs::read_to_string(p).is_ok_and(|text| marks.iter().any(|m| text.contains(m))))
            .collect()
    })
}

/// Drivers `package` loads whose build did not run, found by following its dependencies through the store. Only its
/// own: a failed build another tool left must not fail this one.
pub fn unbuilt_drivers_of(package: &str) -> Vec<PathBuf> {
    package_dir(package).map_or_default(|dir| unbuilt_from(&dir, package))
}

/// pnpm puts a package's dependencies beside it, in the `node_modules` that holds it, as links into the store.
fn unbuilt_from(dir: &Path, package: &str) -> Vec<PathBuf> {
    let mut seen = std::collections::HashSet::new();
    let mut queue = vec![(std::fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf()), package.to_string())];
    let mut unbuilt = Vec::new();
    while let Some((pkg, name)) = queue.pop() {
        if !seen.insert(pkg.clone()) {
            continue;
        }
        if name == "better-sqlite3" && !pkg.join("build").join("Release").join("better_sqlite3.node").is_file() {
            unbuilt.push(pkg.clone());
        }
        let Some(modules) = pkg.ancestors().nth(name.split('/').count()) else { continue };
        for (dep, dep_name) in packages_in(modules) {
            if dep_name != name
                && let Ok(real) = std::fs::canonicalize(&dep)
            {
                queue.push((real, dep_name));
            }
        }
    }
    unbuilt
}

fn packages_in(modules: &Path) -> Vec<(PathBuf, String)> {
    let names = |p: &Path| -> Vec<String> {
        std::fs::read_dir(p).map_or_default(|r| {
            r.flatten().map(|e| e.file_name().to_string_lossy().to_string()).filter(|n| !n.starts_with('.')).collect()
        })
    };
    names(modules)
        .into_iter()
        .flat_map(|n| {
            if n.starts_with('@') {
                names(&modules.join(&n)).into_iter().map(|m| format!("{n}/{m}")).collect()
            } else {
                vec![n]
            }
        })
        .map(|n| (modules.join(&n), n))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The layout pnpm 11 gives a global install: each package in the store's `links`, its dependencies linked beside it.
    #[cfg(unix)]
    #[test]
    fn finds_only_the_unbuilt_driver_its_own_dependencies_reach() {
        use std::os::unix::fs::symlink;
        let root = std::env::temp_dir().join(format!("wirecat-own-pnpm-{}", std::process::id()));
        let links = root.join("links");
        let place = |name: &str, hash: &str| {
            let dir = links.join(name).join(hash).join("node_modules").join(name);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("package.json"), "{}").unwrap();
            dir
        };
        let link = |from: &Path, name: &str, to: &Path| {
            let at = from.ancestors().nth(from_depth(from)).unwrap().join(name);
            std::fs::create_dir_all(at.parent().unwrap()).unwrap();
            symlink(to, at).unwrap();
        };
        let tool = place("@wirecat/tg-cli", "t");
        let mtcute = place("@mtcute/node", "m");
        let reached = place("better-sqlite3", "a");
        let elsewhere = place("better-sqlite3", "b");
        link(&tool, "@mtcute/node", &mtcute);
        link(&mtcute, "better-sqlite3", &reached);
        assert_eq!(unbuilt_from(&tool, "@wirecat/tg-cli"), vec![std::fs::canonicalize(&reached).unwrap()]);
        std::fs::create_dir_all(reached.join("build/Release")).unwrap();
        std::fs::write(reached.join("build/Release/better_sqlite3.node"), "").unwrap();
        assert!(elsewhere.is_dir(), "an unbuilt driver no dependency reaches");
        assert_eq!(unbuilt_from(&tool, "@wirecat/tg-cli"), Vec::<PathBuf>::new());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    fn from_depth(pkg: &Path) -> usize {
        if pkg.parent().and_then(Path::file_name).is_some_and(|n| n.to_string_lossy().starts_with('@')) { 2 } else { 1 }
    }

    #[test]
    fn the_workflow_tag_is_the_pinned_version() {
        assert!(BUILT_BY.ends_with(&format!("@refs/tags/v{VERSION}")));
    }

    #[test]
    fn adds_with_the_store_and_the_allowed_builds() {
        let args = add_args("@wirecat/tg-cli@1.0.0", &["--x"]);
        assert_eq!(&args[..3], ["add", "--global", "@wirecat/tg-cli@1.0.0"]);
        assert!(args.iter().any(|a| a == "--allow-build=better-sqlite3"));
        assert_eq!(args.last().unwrap(), "--x");
    }
}
