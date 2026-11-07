use crate::catalog::Tool;
use crate::community::Source;
use crate::provenance::{self, Refusal};
use crate::{node, npm_prefix, paths, redact, run, skills, system, tools};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::ipc::Channel;

const PNPM_WIRECAT_NOW: &str = "--config.minimum-release-age-exclude=@wirecat/*";
const INSTALL_TIMEOUT: Duration = Duration::from_mins(15);

#[derive(specta::Type, Serialize, Clone)]
// `rename_all` renames only the variants; the fields need `rename_all_fields` to reach the interface as camelCase.
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event")]
pub enum InstallEvent {
    Step {
        step: Step,
    },
    /// What the verify step does now, so the interface says it instead of one long "Verifying".
    Check {
        what: Check,
    },
    Log {
        line: String,
        stderr: bool,
    },
    Done {
        version: String,
        path: String,
        shadowed_by: Option<String>,
        skills: skills::SkillRefresh,
        path_fix: Option<crate::terminal_path::PathFix>,
    },
    Removed,
    Failed {
        reason: Reason,
        message: String,
        hint: Option<String>,
    },
}

#[derive(specta::Type, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "InstallCheck")]
pub enum Check {
    /// Putting the tool's folder on the PATH and asking the shells whether they find it.
    Path,
    /// Running the tool once for its version.
    Start,
    /// Refreshing the copies of its skill, after an update.
    Skills,
}

#[derive(specta::Type, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "InstallStep")]
pub enum Step {
    Check,
    Install,
    Remove,
    Verify,
}

#[derive(specta::Type, Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "FailReason")]
pub enum Reason {
    Requirements,
    Permission,
    Network,
    Timeout,
    /// No space left on the drive (ENOSPC).
    Disk,
    /// A proxy or a company certificate sits between the computer and the registry.
    Proxy,
    /// Windows refused a path that is too long.
    LongPath,
    Cancelled,
    Verify,
    /// The release could not be confirmed as built by the tool's own release workflow (`provenance.rs`).
    Unconfirmed,
    Failed,
}

/// What runs, and what was asked to stop but has not exited yet. A stopped run keeps its slot until it finishes: a
/// sign-in started in its grace time would get the answers typed for the old one, and an install or a reset would run
/// under a sync or a backup that is still writing.
#[derive(Default)]
pub struct Running(Mutex<Keys>);

#[derive(Default)]
struct Keys {
    live: HashSet<String>,
    stopping: HashSet<String>,
}

impl Keys {
    fn busy(&self, id: &str) -> bool {
        self.live.contains(id) || self.stopping.contains(id)
    }
}

impl Running {
    pub fn start(&self, id: &str) -> bool {
        self.start_unless(id, |_| false)
    }
    /// Starts `id` unless it, or any running or stopping key `conflicts` names, is busy; checked under one lock.
    pub fn start_unless(&self, id: &str, conflicts: impl Fn(&str) -> bool) -> bool {
        let mut keys = self.0.lock().unwrap();
        if keys.busy(id) || keys.live.iter().chain(&keys.stopping).any(|k| conflicts(k)) {
            return false;
        }
        keys.live.insert(id.to_string())
    }
    pub fn finish(&self, id: &str) {
        let mut keys = self.0.lock().unwrap();
        keys.live.remove(id);
        keys.stopping.remove(id);
    }
    /// False once the run was asked to stop: the run's own loop reads this to end.
    pub fn is_running(&self, id: &str) -> bool {
        self.0.lock().unwrap().live.contains(id)
    }
    /// Running, or stopped and not yet exited.
    pub fn busy(&self, id: &str) -> bool {
        self.0.lock().unwrap().busy(id)
    }
    pub fn cancel(&self, id: &str) {
        let mut keys = self.0.lock().unwrap();
        if keys.live.remove(id) {
            keys.stopping.insert(id.to_string());
        }
    }
}

struct Failure(Reason, String, Option<String>);

/// Installs a new tool with npm, or updates an existing one with the manager that owns it,
/// so an update never leaves a second copy that shadows the first.
pub fn install(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) {
    guarded(tool, running, events, &|t, r, e| install_steps(t, r, e, None));
}

/// Installs exactly `version`, the one the owner reviewed, then runs `verify` on what was installed before the install
/// counts as done; an own tool's first run is checked against its review this way (`own_tools.rs`).
pub fn install_reviewed(
    tool: &Tool,
    version: &str,
    running: &Running,
    events: &Channel<InstallEvent>,
    verify: &dyn Fn() -> Result<(), String>,
) {
    guarded(tool, running, events, &|t, r, e| {
        let done = install_steps(t, r, e, Some(version))?;
        verify().map_err(|why| Failure(Reason::Verify, why, None))?;
        Ok(done)
    });
}

/// Removes every copy of the tool, each with the manager that installed it. Data stays; see `storage.rs`.
pub fn uninstall(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) {
    guarded(tool, running, events, &uninstall_steps);
}

type Steps<'a> = &'a dyn Fn(&Tool, &Running, &Channel<InstallEvent>) -> Result<InstallEvent, Failure>;

fn guarded(tool: &Tool, running: &Running, events: &Channel<InstallEvent>, steps: Steps) {
    // npm replaces the program under a running sync, which then fails halfway.
    let syncs = crate::sync::package_prefix(&tool.id);
    if !running.start_unless(&tool.id, |k| k.starts_with(&syncs)) {
        let _ = events.send(InstallEvent::Failed {
            reason: Reason::Failed,
            message: "Another operation on this tool is running, such as a sync. Stop it first.".into(),
            hint: None,
        });
        return;
    }
    let result = steps(tool, running, events);
    running.finish(&tool.id);
    let _ = events.send(match result {
        Ok(done) => done,
        Err(Failure(reason, message, hint)) => InstallEvent::Failed { reason, message, hint },
    });
}

fn install_steps(
    tool: &Tool,
    running: &Running,
    events: &Channel<InstallEvent>,
    pinned: Option<&str>,
) -> Result<InstallEvent, Failure> {
    let send = |e| {
        let _ = events.send(e);
    };
    send(InstallEvent::Step { step: Step::Check });
    let ready = system::readiness();
    if !ready.node.ok {
        return Err(Failure(
            Reason::Requirements,
            format!("Node.js {}.", ready.node.problem.as_deref().unwrap_or("is missing")),
            Some(
                "Let WireCat set up Node.js for you, or install Node.js 22.16 or newer (24 recommended) yourself."
                    .into(),
            ),
        ));
    }
    let existing = tools::detect(tool, false).installs.into_iter().next();
    let manager = existing.as_ref().map_or("npm", |i| i.manager);
    // The exact version, not `@latest`: it is the one whose provenance is checked, and a manager that still holds new
    // releases back then fails loudly instead of quietly installing an older one.
    let wanted = match pinned {
        Some(version) => version.to_string(),
        None => retry_on_network(&|| !running.is_running(&tool.id), &send, "npm view", || {
            let latest = tools::latest_version_checked(&tool.package).map_err(|log| classify_registry(&log))?;
            let viewed =
                semver::Version::parse(&latest).map_err(|_| classify_registry("network: unreadable version"))?;
            Ok(newer_of(viewed, crate::preflight::newest_version(&tool.package)).to_string())
        })?,
    };
    let spec = format!("{}@{wanted}", tool.package);
    let (program, args): (&str, Vec<&str>) = match manager {
        // pnpm 11+ waits a day before installing a new release; WireCat's own packages are exempt (owner, NEED-26).
        "pnpm" => ("pnpm", vec!["add", "--global", &spec, PNPM_WIRECAT_NOW]),
        "bun" => ("bun", vec!["add", "--global", &spec]),
        // `http` prints a line per package looked up and per package fetched: the only progress npm reports while it
        // downloads; at its default level it is silent until the end (`install-progress.ts` reads these lines).
        _ => ("npm", vec!["install", "--global", &spec, "--no-fund", "--no-audit", "--loglevel", "http"]),
    };
    let program_path = paths::find(program).ok_or_else(|| {
        Failure(
            Reason::Requirements,
            format!("{program} was not found."),
            Some(format!("{manager} installed this tool; reinstall {program} or install Node.js again.")),
        )
    })?;
    if program == "npm" && ready.npm_prefix_writable == Some(false) {
        return Err(Failure(
            Reason::Permission,
            format!("npm installs into {}, which needs administrator rights.", ready.npm_prefix.unwrap_or_default()),
            Some("Let WireCat set up its own Node.js in your home folder, or point npm at one: npm config set prefix ~/.npm-global.".into()),
        ));
    }

    confirm_release(tool, &wanted, &send)?;
    let prefix = (program == "npm").then(|| install_prefix(existing.as_ref())).flatten();

    send(InstallEvent::Step { step: Step::Install });
    retry_on_network(&|| !running.is_running(&tool.id), &send, "the installation", || {
        run_manager(&program_path, &args, prefix.as_deref(), tool, running, &send, "Installation")
    })?;

    send(InstallEvent::Step { step: Step::Verify });
    send(InstallEvent::Check { what: Check::Path });
    let path_fix = prefix.as_deref().and_then(|p| npm_prefix::reachable_from_terminal(p, &tool.id, &tool.bin));
    let extra: Vec<_> = prefix.or_else(system::npm_prefix).map(|p| npm_prefix::bin_dir(&p)).into_iter().collect();
    paths::refresh(&extra);
    send(InstallEvent::Check { what: Check::Start });
    let state = tools::detect(tool, true);
    let first = state.installs.first().ok_or_else(|| {
        Failure(
            Reason::Verify,
            format!("The install finished, but `{}` is not on your PATH.", tool.bin),
            Some(path_hint(&extra)),
        )
    })?;
    let version = first.version.clone().ok_or_else(|| {
        Failure(
            Reason::Verify,
            format!("`{} --version` did not run: {}", tool.bin, first.problem.clone().unwrap_or_default()),
            None,
        )
    })?;
    let ours = state.installs.iter().find(|i| i.manager == manager).unwrap_or(first);
    if let Some(got) = ours.version.as_deref()
        && wanted != got
    {
        return Err(Failure(
            Reason::Verify,
            format!("{manager} installed {} {got}, not {wanted}.", tool.bin),
            Some(format!(
                "{manager} may hold back new releases for a while. Try again later, or run `{manager} add --global {}@{wanted}` yourself.",
                tool.package
            )),
        ));
    }
    let shadowed_by = (ours.path != first.path).then(|| first.path.clone());
    // Only an update: copies left by an uninstalled version are the owner's to refresh, and a first install stays fast.
    let skills = if existing.is_some() {
        send(InstallEvent::Check { what: Check::Skills });
        skills::refresh(tool, &version, |line| send(InstallEvent::Log { line, stderr: false }))
    } else {
        skills::SkillRefresh::default()
    };
    Ok(InstallEvent::Done { version, path: ours.path.clone(), shadowed_by, skills, path_fix })
}

/// Checked with npm whichever manager installs: npm comes with every Node.js.
fn confirm_release(tool: &Tool, version: &str, send: &impl Fn(InstallEvent)) -> Result<(), Failure> {
    // The end-to-end test's package comes from a registry inside the test, which signs nothing.
    #[cfg(test)]
    if tool.package == crate::install_e2e::PACKAGE {
        return Ok(());
    }
    send(InstallEvent::Log {
        line: if tool.repo.is_empty() {
            format!("Checking the registry's signatures of {} {version}…", tool.package)
        } else {
            format!("Checking that {} {version} was built by {}…", tool.package, tool.repo)
        },
        stderr: false,
    });
    let npm = paths::find("npm").ok_or_else(|| {
        Failure(
            Reason::Requirements,
            "npm was not found, so this release cannot be checked.".into(),
            Some("Let WireCat set up Node.js for you, or install Node.js again.".into()),
        )
    })?;
    let checked = if tool.source == Source::Own {
        provenance::confirm_own(&npm, &tool.package, version, &tool.repo).map(|built| {
            let line = match built {
                provenance::Built::By { repo, workflow } => format!("Built by {repo} ({workflow}) on GitHub Actions."),
                provenance::Built::Unknown(why) => format!("No record of where npm built it ({why})."),
            };
            send(InstallEvent::Log { line, stderr: false });
        })
    } else {
        provenance::confirm(&npm, &tool.package, version, &tool.repo)
    };
    checked.map_err(|refusal| match refusal {
        Refusal::Unreachable(detail) => {
            send(InstallEvent::Log { line: redact::text(&detail), stderr: true });
            specific(&detail, cfg!(windows)).unwrap_or_else(|| {
                Failure(
                    Reason::Network,
                    "Could not check this release with the npm registry.".into(),
                    Some("Check your internet connection or proxy, then try again.".into()),
                )
            })
        }
        Refusal::Unconfirmed(detail) => {
            send(InstallEvent::Log { line: redact::text(&detail), stderr: true });
            // A certificate or disk problem stops the check itself; the release is not at fault.
            if let Some(failure) = specific(&detail, cfg!(windows)) {
                return failure;
            }
            Failure(
                Reason::Unconfirmed,
                format!(
                    "{} {version} could not be confirmed as built by {}, so it was not installed.",
                    tool.package,
                    if tool.repo.is_empty() { "the repository it was reviewed with" } else { &tool.repo }
                ),
                Some("Try again later. If it keeps happening, tell WireCat with Report a problem.".into()),
            )
        }
    })
}

fn install_prefix(existing: Option<&tools::Install>) -> Option<std::path::PathBuf> {
    let own = system::npm_prefix();
    match existing {
        Some(copy) => npm_prefix::for_update(&paths::untilde(&copy.path), own),
        None => npm_prefix::for_install(own),
    }
}

fn uninstall_steps(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) -> Result<InstallEvent, Failure> {
    let _ = events.send(InstallEvent::Step { step: Step::Check });
    let mut plan = Vec::new();
    for copy in paths::find_all(&tool.bin) {
        let manager = paths::manager_for(&copy);
        let (program, args): (&str, Vec<&str>) = match manager {
            "pnpm" => ("pnpm", vec!["remove", "--global", &tool.package]),
            "bun" => ("bun", vec!["remove", "--global", &tool.package]),
            "volta" => ("volta", vec!["uninstall", &tool.package]),
            _ => ("npm", vec!["uninstall", "--global", &tool.package]),
        };
        // An nvm copy belongs to the npm of that Node version, which sits beside it.
        let beside = copy.parent().and_then(|dir| paths::which_in(program, dir.as_os_str()));
        let path = beside.or_else(|| paths::find(program)).ok_or_else(|| {
            Failure(
                Reason::Requirements,
                format!("{program} was not found, so {} cannot be removed.", paths::tilde(&copy.to_string_lossy())),
                None,
            )
        })?;
        let prefix = (program == "npm").then(|| npm_prefix::of_copy(&copy)).flatten();
        plan.push((path, args, prefix));
    }

    let _ = events.send(InstallEvent::Step { step: Step::Remove });
    let send = |e| {
        let _ = events.send(e);
    };
    for (program, args, prefix) in &plan {
        run_manager(program, args, prefix.as_deref(), tool, running, &send, "Uninstalling")?;
    }

    let _ = events.send(InstallEvent::Step { step: Step::Verify });
    paths::refresh(&[]);
    if let Some(left) = paths::find(&tool.bin) {
        return Err(Failure(
            Reason::Verify,
            format!("`{}` is still at {}.", tool.bin, paths::tilde(&left.to_string_lossy())),
            Some("It was not installed by npm or pnpm. Remove it the way you installed it.".into()),
        ));
    }
    Ok(InstallEvent::Removed)
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CopyRemoval {
    pub removed: bool,
    /// Why nothing ran, for the interface to say in the reader's language; `message` is the English fallback.
    pub refused: Option<CopyRefusal>,
    pub log: Vec<String>,
    pub message: Option<String>,
    pub hint: Option<String>,
}

/// Removes one unused copy of a tool, the one at `shown` (as `tools::detect` reports it), with the manager that put it
/// there. Never the copy the app runs, and only npm and pnpm: each is told exactly which global folder to act on, so the
/// other copy cannot be the one removed.
pub fn remove_copy(tool: &Tool, shown: &str, running: &Running) -> CopyRemoval {
    let refused = |why: CopyRefusal, message: String| CopyRemoval {
        removed: false,
        refused: Some(why),
        log: Vec::new(),
        message: Some(message),
        hint: None,
    };
    let target = paths::untilde(shown);
    let found = paths::find_all(&tool.bin);
    if !found.contains(&target) {
        return refused(CopyRefusal::Gone, format!("{shown} is no longer a copy of `{}`. Check again.", tool.bin));
    }
    if tools::program(&tool.bin).as_ref() == Some(&target) {
        return refused(CopyRefusal::Runs, format!("{shown} is the copy WireCat runs, so it stays."));
    }
    let plan = match copy_removal(&target, &tool.package, paths::pnpm_home().map(PathBuf::from).as_deref()) {
        Ok(plan) => plan,
        Err(message) => return refused(CopyRefusal::Manager, message),
    };
    let Some(program) = plan.beside(&target).or_else(|| paths::find(plan.program)) else {
        return refused(
            CopyRefusal::Manager,
            format!("{} was not found, so {shown} cannot be removed here.", plan.program),
        );
    };

    let syncs = crate::sync::package_prefix(&tool.id);
    if !running.start_unless(&tool.id, |k| k.starts_with(&syncs)) {
        return refused(
            CopyRefusal::Busy,
            "Another operation on this tool is running, such as a sync. Stop it first.".into(),
        );
    }
    let log = Mutex::new(Vec::new());
    let send = |e| {
        if let InstallEvent::Log { line, .. } = e {
            log.lock().unwrap().push(line);
        }
    };
    let args: Vec<&str> = plan.args.iter().map(String::as_str).collect();
    let result = run_manager(&program, &args, plan.prefix.as_deref(), tool, running, &send, "Removing the copy");
    running.finish(&tool.id);
    paths::refresh(&[]);
    let log = log.into_inner().unwrap();
    match result {
        Err(Failure(_, message, hint)) => {
            CopyRemoval { removed: false, refused: None, log, message: Some(message), hint }
        }
        Ok(()) if paths::find_all(&tool.bin).contains(&target) => CopyRemoval {
            removed: false,
            refused: None,
            log,
            message: Some(format!("{} finished, but {shown} is still there.", plan.program)),
            hint: Some("Remove it with the program that installed it.".into()),
        },
        Ok(()) => CopyRemoval { removed: true, refused: None, log, message: None, hint: None },
    }
}

#[derive(specta::Type, Serialize, Debug, PartialEq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum CopyRefusal {
    /// No longer one of the copies on PATH.
    Gone,
    /// The copy the app runs.
    Runs,
    /// Not an npm or pnpm copy the app can place, or its manager is missing.
    Manager,
    /// A sync or another install holds the tool.
    Busy,
}

#[derive(Debug, PartialEq)]
struct CopyPlan {
    program: &'static str,
    args: Vec<String>,
    /// npm's global folder for this copy, given to npm as its prefix.
    prefix: Option<PathBuf>,
}

impl CopyPlan {
    /// An nvm copy belongs to the npm of that Node version, which sits beside it.
    fn beside(&self, copy: &Path) -> Option<PathBuf> {
        (self.program == "npm").then(|| copy.parent().and_then(|dir| paths::which_in("npm", dir.as_os_str()))).flatten()
    }
}

fn copy_removal(copy: &Path, package: &str, pnpm_home: Option<&Path>) -> Result<CopyPlan, String> {
    let shown = paths::tilde(&copy.to_string_lossy());
    match paths::manager_for(copy) {
        // pnpm acts on its one global folder; a copy outside it belongs to another pnpm.
        "pnpm" if pnpm_home.is_some_and(|home| copy.starts_with(home)) => Ok(CopyPlan {
            program: "pnpm",
            args: vec!["remove".into(), "--global".into(), package.into()],
            prefix: None,
        }),
        "npm" => match npm_prefix::of_copy(copy) {
            Some(prefix) => Ok(CopyPlan {
                program: "npm",
                args: vec!["uninstall".into(), "--global".into(), package.into()],
                prefix: Some(prefix),
            }),
            None => Err(format!("WireCat cannot tell which npm folder {shown} belongs to.")),
        },
        manager => Err(format!("WireCat removes only npm and pnpm copies; remove {shown} with {manager}.")),
    }
}

/// Runs npm, pnpm, bun or volta with streamed, masked output; `what` names the operation in errors. `prefix` is the
/// global folder npm acts on, whatever its own config says.
fn run_manager(
    program: &std::path::Path,
    args: &[&str],
    prefix: Option<&std::path::Path>,
    tool: &Tool,
    running: &Running,
    send: &dyn Fn(InstallEvent),
    what: &str,
) -> Result<(), Failure> {
    let name = program.file_stem().unwrap_or_default().to_string_lossy().to_string();
    send(InstallEvent::Log { line: format!("$ {name} {}", args.join(" ")), stderr: false });
    let mut tail: Vec<String> = Vec::new();
    let mut cmd = run::command(program, args, Some(&paths::search_path()));
    if let Some(home) = paths::pnpm_home() {
        cmd.env("PNPM_HOME", home);
    }
    if let Some(prefix) = prefix.map(std::path::Path::to_path_buf).or_else(|| node::owner_of(program)) {
        cmd.env("npm_config_prefix", prefix);
    }
    let code = run::stream(
        cmd,
        INSTALL_TIMEOUT,
        || !running.is_running(&tool.id),
        |line| {
            let (line, stderr) = match line {
                run::Line::Out(l) => (l, false),
                run::Line::Err(l) => (l, true),
            };
            let line = redact::text(&line);
            // A package URL such as `node-gyp-build` would otherwise pick the wrong failure in `classify`.
            if !line.starts_with("npm http ") {
                tail.push(line.clone());
            }
            if tail.len() > 40 {
                tail.remove(0);
            }
            send(InstallEvent::Log { line, stderr });
        },
    )
    .map_err(|e| match e {
        run::RunError::Cancelled => Failure(Reason::Cancelled, format!("{what} cancelled."), None),
        run::RunError::TimedOut => Failure(
            Reason::Timeout,
            format!("{what} took longer than 15 minutes and was stopped."),
            Some("Check your connection and try again.".into()),
        ),
        other => Failure(Reason::Failed, other.to_string(), None),
    })?;
    if code == Some(0) { Ok(()) } else { Err(classify(&tail.join("\n"), &name)) }
}

fn classify(log: &str, program: &str) -> Failure {
    classify_on(log, program, cfg!(windows))
}

/// The `npm view` step has no program name in its text: Network unless the words say otherwise.
/// The store check (`preflight.rs`) reads the registry directly; installing an older version that `npm view` can still
/// show right after a publish would leave a tool it promised to update unable to read the store.
fn newer_of(viewed: semver::Version, fresh: Option<String>) -> semver::Version {
    fresh.and_then(|v| semver::Version::parse(&v).ok()).filter(|v| *v > viewed).unwrap_or(viewed)
}

fn classify_registry(log: &str) -> Failure {
    specific(log, cfg!(windows)).unwrap_or_else(|| {
        Failure(
            Reason::Network,
            "Could not reach the npm registry.".into(),
            Some("Check your internet connection or proxy, then try again.".into()),
        )
    })
}

/// Causes that stop an install or a check whichever step meets them, and that more tries do not cure. Disk first: a
/// full drive breaks every later step. Certificates before the generic network words, as a proxy that rewrites
/// certificates also shows up as a failed fetch.
fn specific(log: &str, windows: bool) -> Option<Failure> {
    let l = log.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|k| l.contains(k));
    if has(&["enospc", "no space left"]) {
        Some(Failure(
            Reason::Disk,
            "There is not enough free space on the drive.".into(),
            Some("A tool needs about 200 MB. Free some space on the drive npm installs to, then try again.".into()),
        ))
    } else if has(&["path too long", "max_path", "filename or extension is too long"])
        || (windows && has(&["enametoolong"]))
    {
        Some(Failure(
            Reason::LongPath,
            "Windows refused a file path because it is too long.".into(),
            Some(
                "Turn on long paths in Settings > System > For developers (Enable long paths), then try again. \
                 No command line is needed."
                    .into(),
            ),
        ))
    } else if has(&[
        "self_signed_cert_in_chain",
        "self-signed certificate",
        "unable_to_get_issuer_cert_locally",
        "unable_to_verify_leaf_signature",
        "cert_has_expired",
        "e407",
        "proxy",
    ]) {
        Some(Failure(
            Reason::Proxy,
            "A proxy or a security certificate blocks the connection to the npm registry.".into(),
            Some(
                "Ask your IT team for the company certificate file, then run `npm config set cafile <file>`. If a \
                 proxy is needed, run `npm config set proxy <address>` and `npm config set https-proxy <address>`. \
                 Then try again."
                    .into(),
            ),
        ))
    } else {
        None
    }
}

/// One more try after a short wait when the first failed on the network and nothing else: a dropped connection often
/// is gone a moment later, any other cause comes back the same.
fn retry_on_network<T>(
    cancelled: &dyn Fn() -> bool,
    send: &dyn Fn(InstallEvent),
    what: &str,
    mut attempt: impl FnMut() -> Result<T, Failure>,
) -> Result<T, Failure> {
    let first = attempt();
    if !matches!(first, Err(Failure(Reason::Network, ..))) {
        return first;
    }
    send(InstallEvent::Log {
        line: format!("The network failed during {what}. Trying once more in 3 s."),
        stderr: false,
    });
    for _ in 0..30 {
        if cancelled() {
            return first;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    attempt()
}

/// On Windows npm writes only to folders in the user's profile, so EPERM and EBUSY there mean a running program holds
/// the tool's files, not a missing administrator right.
fn classify_on(log: &str, program: &str, windows: bool) -> Failure {
    let l = log.to_lowercase();
    if let Some(failure) = specific(log, windows) {
        failure
    } else if windows && (l.contains("ebusy") || l.contains("eperm")) {
        Failure(
            Reason::Failed,
            format!("{program} could not replace the tool's files: a running program still uses them."),
            Some("Close the AI apps and terminals that run this tool, then try again.".into()),
        )
    } else if l.contains("eacces") || l.contains("eperm") || l.contains("permission denied") {
        Failure(
            Reason::Permission,
            format!("{program} could not write to its global folder."),
            Some("Use a global folder in your home instead of a system one, then try again.".into()),
        )
    } else if ["enotfound", "etimedout", "econnreset", "eai_again", "network", "fetch failed"]
        .iter()
        .any(|k| l.contains(k))
    {
        Failure(
            Reason::Network,
            "Could not reach the npm registry.".into(),
            Some("Check your internet connection or proxy, then try again.".into()),
        )
    } else if l.contains("node-gyp") || l.contains("gyp err") {
        Failure(
            Reason::Failed,
            "A native part of the tool could not be built.".into(),
            Some("Install build tools for your system (on Windows: Visual Studio Build Tools), then try again.".into()),
        )
    } else {
        Failure(Reason::Failed, format!("{program} stopped with an error."), Some("Open the log for details.".into()))
    }
}

fn path_hint(extra: &[std::path::PathBuf]) -> String {
    match extra.first() {
        Some(dir) => format!("Add {} to your PATH, then open a new terminal.", paths::tilde(&dir.to_string_lossy())),
        None => "Add npm's global folder to your PATH, then open a new terminal.".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installs_the_registry_s_fresher_version_never_an_older_one() {
        let v = |s: &str| semver::Version::parse(s).unwrap();
        assert_eq!(newer_of(v("0.88.0"), Some("0.89.0".into())), v("0.89.0"));
        assert_eq!(newer_of(v("0.89.0"), Some("0.88.0".into())), v("0.89.0"));
        assert_eq!(newer_of(v("0.89.0"), Some("garbage".into())), v("0.89.0"));
        assert_eq!(newer_of(v("0.89.0"), None), v("0.89.0"));
    }

    #[test]
    fn a_stopped_run_keeps_its_slot_until_it_finishes() {
        let running = Running::default();
        assert!(running.start("sign-in:tg"));
        running.cancel("sign-in:tg");
        assert!(!running.is_running("sign-in:tg"), "the run's own loop must see the stop");
        assert!(running.busy("sign-in:tg"));
        assert!(!running.start("sign-in:tg"), "a second run waits until the first exits");
        assert!(!running.start_unless("install:tg", |k| k.starts_with("sign-in:")));
        running.finish("sign-in:tg");
        assert!(running.start("sign-in:tg"));
    }

    #[test]
    fn a_reset_never_starts_under_a_backup_that_is_still_copying() {
        let running = Running::default();
        assert!(running.start("backup"));
        running.cancel("backup");
        assert!(!running.start_unless("reset", |k| k == "backup"));
        running.finish("backup");
        assert!(running.start_unless("reset", |k| k == "backup"));
        running.cancel("never-started");
        assert!(!running.busy("never-started"));
    }

    #[test]
    fn events_reach_the_interface_in_camel_case() {
        let skills = skills::SkillRefresh { refreshed: vec!["claude".into()], failed: None };
        let done = InstallEvent::Done {
            version: "0.91.0".into(),
            path: "~/bin/tg".into(),
            shadowed_by: None,
            skills,
            path_fix: None,
        };
        let json = serde_json::to_value(&done).unwrap();
        assert_eq!(json["event"], "done");
        assert!(json.get("shadowedBy").is_some(), "{json}");
        assert_eq!(json["skills"], serde_json::json!({"refreshed": ["claude"], "failed": null}));
    }

    #[test]
    fn classifies_npm_failures() {
        assert_eq!(classify_on("npm ERR! code EACCES", "npm", false).0, Reason::Permission);
        assert_eq!(classify("npm ERR! code ENOTFOUND registry", "npm").0, Reason::Network);
        assert_eq!(classify("something odd", "npm").0, Reason::Failed);
        assert_eq!(classify_on("npm error code EPERM", "npm", false).0, Reason::Permission);
        let busy = classify_on("npm error code EPERM\nnpm error syscall unlink", "npm", true);
        assert_eq!(busy.0, Reason::Failed);
        assert!(busy.1.contains("running program"), "{}", busy.1);
    }

    #[test]
    fn classifies_disk_proxy_and_long_path_failures() {
        assert_eq!(classify_on("npm error code ENOSPC\nnpm error nospc", "npm", false).0, Reason::Disk);
        assert_eq!(classify_on("write failed: No space left on device", "npm", false).0, Reason::Disk);
        for code in [
            "SELF_SIGNED_CERT_IN_CHAIN",
            "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
            "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            "CERT_HAS_EXPIRED",
            "E407 Proxy Authentication Required",
        ] {
            let log = format!("npm error code {code}\nnpm error network request failed");
            assert_eq!(classify_on(&log, "npm", false).0, Reason::Proxy, "{code}");
        }
        assert_eq!(classify_on("npm error code ENAMETOOLONG", "npm", true).0, Reason::LongPath);
        assert_eq!(classify_on("npm error code ENAMETOOLONG", "npm", false).0, Reason::Failed);
        assert_eq!(classify_on("The specified path is too long (MAX_PATH)", "npm", false).0, Reason::LongPath);
        assert_eq!(classify_registry("npm error code UNABLE_TO_VERIFY_LEAF_SIGNATURE").0, Reason::Proxy);
        assert_eq!(classify_registry("npm error code ENOTFOUND").0, Reason::Network);
    }

    #[test]
    fn reasons_reach_the_interface_in_camel_case() {
        let name = |r: Reason| serde_json::to_value(r).unwrap();
        assert_eq!(name(Reason::Disk), "disk");
        assert_eq!(name(Reason::Proxy), "proxy");
        assert_eq!(name(Reason::LongPath), "longPath");
    }

    #[test]
    fn only_a_network_failure_is_tried_again() {
        let tries = std::cell::Cell::new(0);
        let net = || {
            tries.set(tries.get() + 1);
            Err::<(), _>(Failure(Reason::Network, String::new(), None))
        };
        assert!(retry_on_network(&|| false, &|_| {}, "x", net).is_err());
        assert_eq!(tries.get(), 2);
        tries.set(0);
        let other = || {
            tries.set(tries.get() + 1);
            Err::<(), _>(Failure(Reason::Proxy, String::new(), None))
        };
        assert!(retry_on_network(&|| false, &|_| {}, "x", other).is_err());
        assert_eq!(tries.get(), 1);
    }

    #[cfg(not(windows))]
    #[test]
    fn a_copy_is_removed_by_the_manager_of_its_own_folder() {
        let pkg = "@wirecat/tg-cli";
        let home = Path::new("/home/o/.local/share/pnpm");
        let nvm = Path::new("/home/o/.nvm/versions/node/v24.19.0/bin/tg");
        assert_eq!(
            copy_removal(nvm, pkg, Some(home)),
            Ok(CopyPlan {
                program: "npm",
                args: vec!["uninstall".into(), "--global".into(), pkg.into()],
                prefix: Some(PathBuf::from("/home/o/.nvm/versions/node/v24.19.0")),
            })
        );
        let pnpm = copy_removal(&home.join("bin/tg"), pkg, Some(home)).unwrap();
        assert_eq!((pnpm.program, pnpm.args), ("pnpm", vec!["remove".into(), "--global".into(), pkg.into()]));
    }

    #[cfg(not(windows))]
    #[test]
    fn a_copy_of_unknown_origin_is_refused() {
        let pkg = "@wirecat/tg-cli";
        let other_pnpm = Path::new("/opt/pnpm/bin/tg");
        assert!(copy_removal(other_pnpm, pkg, Some(Path::new("/home/o/.local/share/pnpm"))).is_err());
        assert!(copy_removal(other_pnpm, pkg, None).is_err());
        assert!(copy_removal(Path::new("/home/o/.bun/bin/tg"), pkg, None).unwrap_err().contains("bun"));
        assert!(copy_removal(Path::new("/home/o/.volta/bin/tg"), pkg, None).is_err());
        assert!(copy_removal(Path::new("/home/o/tools/tg"), pkg, None).is_err(), "not in a bin folder");
    }
}
