//! "Things to check" on an own tool's review: facts from npm, its dependencies, its code and its GitHub repository
//! that are worth a second look. Each is a hint shown with a sentence why; none refuses the tool, and a check that
//! cannot run says so instead of passing.

use crate::own_scan::Code;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

const NEW_DAYS: i64 = 30;
const STALE_DAYS: i64 = 180;
const FEW_VERSIONS: usize = 3;
const FEW_STARS: u64 = 10;

/// The oldest cli-base that writes the format-2 manifest this review reads, and the oldest cli-core that counts a
/// command with undeclared effects as a write (0.603.0), so a readonly profile refuses it. Both are before 1.0.0, where
/// a minor version may break callers.
pub const MIN_BASE: &str = "0.81.0";
pub const MIN_CORE: &str = "0.603.0";
const BASE: &str = "@wirecat/cli-base";
const CORE: &str = "@wirecat/cli-core";

/// The shared workflows tg-cli, max-cli and cli-template call: the standard checks and the release's checks.
pub const STANDARD_WORKFLOWS: [&str; 2] = ["node-ci.yml", "release-checks.yml"];
const SHARED: &str = "WireCatLabs/cli-base/.github/workflows/";

#[derive(specta::Type, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
#[serde(rename = "OwnSignal")]
pub enum Signal {
    NewPackage {
        days: u32,
    },
    FewVersions {
        count: u32,
    },
    OnePublisher,
    NoProvenance,
    NoRepository,
    /// `found` is the version spec in `dependencies`; `None` when the tool does not depend on it.
    BaseOutOfRange {
        found: Option<String>,
        min: String,
    },
    CoreOutOfRange {
        found: Option<String>,
        min: String,
    },
    NoHosts,
    /// Network modules, `fetch` or `WebSocket` in the tool's own code.
    NetworkCode {
        modules: Vec<String>,
    },
    /// Hosts its code names that the manifest does not declare: the first `MAX_SHOWN`, and how many more.
    UndeclaredHosts {
        hosts: Vec<String>,
        more: u32,
    },
    /// `.node` or `.wasm` files: native code the scan cannot read.
    NativeCode {
        files: Vec<String>,
    },
    /// A bundler copied cli-base or cli-core in without naming its version.
    BundledUnknown {
        package: String,
    },
    StartsPrograms,
    RepoNew {
        days: u32,
    },
    RepoStale {
        days: u32,
    },
    RepoArchived,
    FewStars {
        stars: u32,
    },
    /// cli-base's shared workflows its workflows at the release commit do not call.
    NoStandardChecks {
        missing: Vec<String>,
    },
    GithubUnchecked {
        reason: Unchecked,
    },
}

/// Why GitHub could not be asked, for the interface to say in the owner's language.
#[derive(specta::Type, Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "OwnGithubUnchecked")]
pub enum Unchecked {
    /// GitHub's 60 unsigned requests an hour are used up.
    Limit,
    /// The repository is private, renamed or gone.
    NotFound,
    Unreachable,
}

const NOT_FOUND: &str = "not found";
const LIMIT: &str = "rate limited";

fn unchecked(detail: &str) -> Signal {
    tracing::warn!("own tool risks: GitHub could not be asked: {detail}");
    let reason = match detail {
        NOT_FOUND => Unchecked::NotFound,
        LIMIT => Unchecked::Limit,
        _ => Unchecked::Unreachable,
    };
    Signal::GithubUnchecked { reason }
}

fn days_since(iso: &str, now: chrono::DateTime<chrono::Utc>) -> Option<i64> {
    let at = chrono::DateTime::parse_from_rfc3339(iso).ok()?;
    Some((now - at.with_timezone(&chrono::Utc)).num_days())
}

fn days(n: i64) -> u32 {
    u32::try_from(n.max(0)).unwrap_or(u32::MAX)
}

/// What npm's answer says: how new the package is, how many versions and publishers it has, whether npm knows where
/// it was built, and whether it is built on a cli-base and cli-core this Desktop reads.
pub fn npm(
    view: &Value,
    bundled: &BTreeMap<String, Option<String>>,
    publishers: usize,
    built: bool,
    now: chrono::DateTime<chrono::Utc>,
) -> Vec<Signal> {
    let mut out = Vec::new();
    if let Some(age) = view["time"]["created"].as_str().and_then(|t| days_since(t, now))
        && age < NEW_DAYS
    {
        out.push(Signal::NewPackage { days: days(age) });
    }
    let versions = view["versions"].as_array().map_or(1, Vec::len);
    if versions < FEW_VERSIONS {
        out.push(Signal::FewVersions { count: u32::try_from(versions).unwrap_or(u32::MAX) });
    }
    if publishers <= 1 {
        out.push(Signal::OnePublisher);
    }
    if !built {
        out.push(Signal::NoProvenance);
    }
    for (package, min) in [(BASE, MIN_BASE), (CORE, MIN_CORE)] {
        let found = match (view["dependencies"][package].as_str(), bundled.get(package)) {
            (Some(spec), _) => Some(spec),
            (None, Some(Some(version))) => Some(version.as_str()),
            (None, Some(None)) => {
                out.push(Signal::BundledUnknown { package: package.into() });
                continue;
            }
            (None, None) => None,
        };
        if let Some(found) = out_of_range(found, min) {
            let min = min.to_string();
            out.push(if package == BASE {
                Signal::BaseOutOfRange { found, min }
            } else {
                Signal::CoreOutOfRange { found, min }
            });
        }
    }
    out
}

/// A dependency, or a copy a bundler made: either way its code opens the shared store.
pub fn uses_core(view: &Value, bundled: &BTreeMap<String, Option<String>>) -> bool {
    view["dependencies"][CORE].is_string() || bundled.contains_key(CORE)
}

/// `Some(spec)` when the dependency is missing (`Some(None)`) or its lowest version is outside `min`..1.0.0. A spec
/// such as `^0.82.0` or `~0.605.0` is read by its version; `*`, a tag or a link is outside, since nothing pins it.
#[expect(clippy::option_option, reason = "outer: out of range; inner: the spec, None when not a dependency")]
fn out_of_range(spec: Option<&str>, min: &str) -> Option<Option<String>> {
    let Some(spec) = spec else { return Some(None) };
    let lowest = spec.trim().trim_start_matches(['^', '~', '=', '>', 'v', ' ']);
    let ok = semver::Version::parse(lowest).is_ok_and(|v| {
        let min = semver::Version::parse(min).expect("a valid minimum");
        v >= min && v.major < 1
    });
    (!ok).then(|| Some(spec.to_string()))
}

const MAX_SHOWN: usize = 20;

/// What the code scan found, against the hosts the manifest declares (`None`: it declares none). `known` is the host
/// of the repository the review links to; a homepage or docs page is the author's to choose, so it counts as a server.
pub fn network(code: &Code, declared: Option<&[String]>, known: &[String]) -> Vec<Signal> {
    let mut out = Vec::new();
    if declared.is_none() {
        out.push(Signal::NoHosts);
    }
    if code.touches_network() {
        let mut modules: Vec<String> = code.modules.iter().cloned().collect();
        if code.fetch {
            modules.push("fetch".into());
        }
        if code.websocket {
            modules.push("WebSocket".into());
        }
        out.push(Signal::NetworkCode { modules });
    }
    let declared = declared.unwrap_or_default();
    let covered = |host: &str| {
        // As cli-base's `hostCovered`: `*.x` covers the names under x, not x itself.
        declared.iter().chain(known).any(|d| {
            let d = d.to_ascii_lowercase();
            d.strip_prefix('*').map_or(host == d, |suffix| host.ends_with(suffix))
        })
    };
    let hosts: Vec<String> = code.hosts.iter().filter(|h| !covered(h)).cloned().collect();
    if !hosts.is_empty() {
        let more = u32::try_from(hosts.len().saturating_sub(MAX_SHOWN)).unwrap_or(u32::MAX);
        out.push(Signal::UndeclaredHosts { hosts: hosts.into_iter().take(MAX_SHOWN).collect(), more });
    }
    if code.programs {
        out.push(Signal::StartsPrograms);
    }
    if !code.native.is_empty() {
        out.push(Signal::NativeCode { files: code.native.iter().cloned().collect() });
    }
    out
}

/// What GitHub's REST API answers about a repository; the tests answer from fixtures.
pub trait GitHub {
    fn json(&self, url: &str) -> Result<Value, String>;
    fn text(&self, url: &str) -> Result<String, String>;
}

/// One agent for every call, with no redirects, and a time budget for all calls of a review together.
pub struct Rest {
    deadline: Instant,
}

/// A slow GitHub must not keep "Checking its GitHub repository…" on screen; what is left says "Couldn't check".
const BUDGET: Duration = Duration::from_secs(15);
const OUT_OF_TIME: &str = "out of time";

static AGENT: LazyLock<ureq::Agent> = LazyLock::new(|| {
    ureq::Agent::config_builder()
        .https_only(true)
        .max_redirects(0)
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
});

const API: &str = "https://api.github.com/repos/";
const MAX_ANSWER: u64 = 256 * 1024;
const MAX_WORKFLOWS: usize = 12;

impl GitHub for Rest {
    fn json(&self, url: &str) -> Result<Value, String> {
        serde_json::from_str(&self.text(url)?).map_err(|e| e.to_string())
    }

    fn text(&self, url: &str) -> Result<String, String> {
        let left = self.deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(OUT_OF_TIME.into());
        }
        let request = AGENT.get(url).header("Accept", "application/vnd.github+json");
        let mut answer = request.config().timeout_global(Some(left)).build().call().map_err(|e| match e {
            ureq::Error::StatusCode(404) => NOT_FOUND.to_string(),
            ureq::Error::StatusCode(403 | 429) => LIMIT.to_string(),
            e => e.to_string(),
        })?;
        answer.body_mut().with_config().limit(MAX_ANSWER).read_to_string().map_err(|e| e.to_string())
    }
}

type Cached = LazyLock<Mutex<HashMap<String, (Instant, Vec<Signal>)>>>;
/// GitHub allows 60 unsigned requests an hour, and the owner may open the same review several times.
static CACHE: Cached = LazyLock::new(|| Mutex::new(HashMap::new()));
const KEEP: Duration = Duration::from_hours(1);

/// `repo` is `https://github.com/<owner>/<name>`; `commit` the release commit, when npm's provenance names one.
pub fn github(repo: &str, commit: Option<&str>) -> Vec<Signal> {
    let key = format!("{repo}@{}", commit.unwrap_or("HEAD"));
    if let Some((at, signals)) = CACHE.lock().unwrap().get(&key)
        && at.elapsed() < KEEP
    {
        return signals.clone();
    }
    let gh = Rest { deadline: Instant::now() + BUDGET };
    let (signals, complete) = github_with(&gh, repo, commit, chrono::Utc::now());
    if complete {
        CACHE.lock().unwrap().insert(key, (Instant::now(), signals.clone()));
    }
    signals
}

/// The signals, and whether every check answered (only then is the answer cached).
pub fn github_with(
    gh: &impl GitHub,
    repo: &str,
    commit: Option<&str>,
    now: chrono::DateTime<chrono::Utc>,
) -> (Vec<Signal>, bool) {
    let Some(path) = repo.strip_prefix("https://github.com/") else { return (vec![Signal::NoRepository], true) };
    let mut out = Vec::new();
    let mut complete = true;
    match gh.json(&format!("{API}{path}")) {
        Ok(r) => {
            if let Some(age) = r["created_at"].as_str().and_then(|t| days_since(t, now))
                && age < NEW_DAYS
            {
                out.push(Signal::RepoNew { days: days(age) });
            }
            if let Some(idle) = r["pushed_at"].as_str().and_then(|t| days_since(t, now))
                && idle > STALE_DAYS
            {
                out.push(Signal::RepoStale { days: days(idle) });
            }
            if r["archived"] == true {
                out.push(Signal::RepoArchived);
            }
            if let Some(stars) = r["stargazers_count"].as_u64()
                && stars < FEW_STARS
            {
                out.push(Signal::FewStars { stars: u32::try_from(stars).unwrap_or(u32::MAX) });
            }
        }
        Err(detail) => {
            complete = false;
            out.push(unchecked(&detail));
        }
    }
    match standard_checks(gh, path, commit) {
        Ok(missing) if missing.is_empty() => {}
        Ok(missing) => out.push(Signal::NoStandardChecks { missing }),
        Err(detail) => {
            complete = false;
            if !out.iter().any(|s| matches!(s, Signal::GithubUnchecked { .. })) {
                out.push(unchecked(&detail));
            }
        }
    }
    (out, complete)
}

/// The shared workflows none of the repository's workflow files call, at the release commit. A repository without a
/// workflows folder calls none.
fn standard_checks(gh: &impl GitHub, path: &str, commit: Option<&str>) -> Result<Vec<String>, String> {
    let at = commit.map(|c| format!("?ref={c}")).unwrap_or_default();
    let listing = match gh.json(&format!("{API}{path}/contents/.github/workflows{at}")) {
        Ok(listing) => listing,
        Err(e) if e == NOT_FOUND => Value::Array(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut called = String::new();
    let files = listing.as_array().into_iter().flatten().filter(|f| {
        let ext = std::path::Path::new(f["name"].as_str().unwrap_or_default()).extension();
        f["type"] == "file" && ext.is_some_and(|e| e.eq_ignore_ascii_case("yml") || e.eq_ignore_ascii_case("yaml"))
    });
    for file in files.take(MAX_WORKFLOWS) {
        // Only GitHub's own file host: the listing is GitHub's answer, but its links are followed, not trusted.
        if let Some(url) = file["download_url"].as_str().filter(|u| u.starts_with("https://raw.githubusercontent.com/"))
        {
            called.push_str(&gh.text(url)?);
            called.push('\n');
        }
    }
    let used = uses_of(&called);
    Ok(STANDARD_WORKFLOWS.iter().filter(|w| !used.contains(**w)).map(|w| (*w).to_string()).collect())
}

/// The cli-base shared workflows the files call: a `uses:` key pinned with `@`, not a comment or a line that only
/// mentions one.
fn uses_of(yaml: &str) -> std::collections::BTreeSet<String> {
    static USES: LazyLock<regex::Regex> = LazyLock::new(|| {
        let shared = regex::escape(SHARED);
        regex::Regex::new(&format!(r#"(?m)^\s*(?:-\s+)?uses:\s*["']?{shared}([A-Za-z0-9._-]+)@[0-9A-Za-z._-]+"#))
            .expect("a valid pattern")
    });
    USES.captures_iter(yaml).map(|m| m[1].to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::RefCell;

    fn now() -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::parse_from_rfc3339("2026-11-08T12:00:00Z").unwrap().with_timezone(&chrono::Utc)
    }

    #[test]
    fn a_new_package_with_one_version_one_publisher_and_no_provenance_is_flagged() {
        let view = json!({
            "time": { "created": "2026-11-07T23:47:41.427Z" },
            "versions": ["0.1.0"],
            "dependencies": { "@wirecat/cli-base": "0.82.0", "@wirecat/cli-core": "^0.605.0" }
        });
        assert_eq!(
            npm(&view, &BTreeMap::new(), 1, false, now()),
            [
                Signal::NewPackage { days: 0 },
                Signal::FewVersions { count: 1 },
                Signal::OnePublisher,
                Signal::NoProvenance
            ]
        );
        let settled = json!({ "time": { "created": "2025-01-01T00:00:00Z" }, "versions": ["1", "2", "3"],
            "dependencies": { "@wirecat/cli-base": "0.82.0", "@wirecat/cli-core": "0.605.0" } });
        assert_eq!(npm(&settled, &BTreeMap::new(), 2, true, now()), []);
    }

    #[test]
    fn cli_base_and_cli_core_outside_what_desktop_reads_are_flagged() {
        let view = |base: Value, core: Value| json!({ "versions": ["1", "2", "3"], "dependencies": { "@wirecat/cli-base": base, "@wirecat/cli-core": core } });
        let flags = |v: &Value| npm(v, &BTreeMap::new(), 2, true, now());
        assert_eq!(
            flags(&view(json!("0.64.0"), json!("latest"))),
            [
                Signal::BaseOutOfRange { found: Some("0.64.0".into()), min: MIN_BASE.into() },
                Signal::CoreOutOfRange { found: Some("latest".into()), min: MIN_CORE.into() }
            ]
        );
        assert_eq!(
            flags(&view(json!("~0.81.0"), json!("1.2.0"))),
            [Signal::CoreOutOfRange { found: Some("1.2.0".into()), min: MIN_CORE.into() }]
        );
        let none = json!({ "versions": ["1", "2", "3"] });
        assert!(flags(&none).contains(&Signal::BaseOutOfRange { found: None, min: MIN_BASE.into() }));
        assert!(!uses_core(&none, &BTreeMap::new()));
    }

    #[test]
    fn hosts_in_the_code_that_the_manifest_does_not_declare_are_flagged() {
        let mut code = Code { fetch: true, ..Code::default() };
        code.hosts.extend([
            "api.acme.io".to_string(),
            "acme.io".into(),
            "evil.example.net".into(),
            "github.com".into(),
        ]);
        let known = ["github.com".to_string()];
        assert_eq!(
            network(&code, Some(&["*.acme.io".to_string()]), &known),
            [
                Signal::NetworkCode { modules: vec!["fetch".into()] },
                Signal::UndeclaredHosts { hosts: vec!["acme.io".into(), "evil.example.net".into()], more: 0 }
            ]
        );
        assert_eq!(network(&Code::default(), None, &known), [Signal::NoHosts]);
    }

    #[test]
    fn a_bundled_cli_core_without_a_version_says_so_and_twenty_shown_hosts_report_the_rest() {
        let view = json!({ "versions": ["1", "2", "3"], "dependencies": { "@wirecat/cli-base": "0.82.0" } });
        let bundled = BTreeMap::from([("@wirecat/cli-core".to_string(), None)]);
        assert_eq!(
            npm(&view, &bundled, 2, true, now()),
            [Signal::BundledUnknown { package: "@wirecat/cli-core".into() }]
        );
        assert!(uses_core(&view, &bundled));
        let mut code = Code::default();
        code.hosts.extend((0..25).map(|i| format!("h{i}.evil.io")));
        let found = network(&code, Some(&[]), &[]);
        assert!(matches!(&found[0], Signal::UndeclaredHosts { hosts, more: 5 } if hosts.len() == 20));
    }

    #[test]
    fn only_a_uses_key_counts_as_calling_a_shared_workflow() {
        let yaml = "# uses: WireCatLabs/cli-base/.github/workflows/release-checks.yml@abc\n\
            run: echo WireCatLabs/cli-base/.github/workflows/release-checks.yml@abc\n\
            jobs:\n  ci:\n    uses: WireCatLabs/cli-base/.github/workflows/node-ci.yml@08d954b # v0.61.2\n\
            steps:\n  - uses: 'WireCatLabs/cli-base/.github/workflows/changelog-guard.yml@abc'\n";
        let used: Vec<String> = uses_of(yaml).into_iter().collect();
        assert_eq!(used, ["changelog-guard.yml", "node-ci.yml"]);
    }

    struct Fake {
        answers: HashMap<String, Result<String, String>>,
        asked: RefCell<Vec<String>>,
    }

    impl GitHub for Fake {
        fn json(&self, url: &str) -> Result<Value, String> {
            Ok(serde_json::from_str(&self.text(url)?).unwrap())
        }
        fn text(&self, url: &str) -> Result<String, String> {
            self.asked.borrow_mut().push(url.into());
            self.answers.get(url).cloned().unwrap_or_else(|| Err(NOT_FOUND.into()))
        }
    }

    fn fake(answers: &[(&str, Result<String, String>)]) -> Fake {
        Fake {
            answers: answers.iter().map(|(u, a)| ((*u).to_string(), a.clone())).collect(),
            asked: RefCell::new(Vec::new()),
        }
    }

    const REPO: &str = "https://api.github.com/repos/acme/crm";
    const RAW: &str = "https://raw.githubusercontent.com/acme/crm/abc/.github/workflows/ci.yml";

    #[test]
    fn a_young_quiet_repository_without_the_standard_checks_is_flagged_at_the_release_commit() {
        let repo = json!({ "created_at": "2026-11-01T00:00:00Z", "pushed_at": "2026-11-01T00:00:00Z",
            "archived": false, "stargazers_count": 2 })
        .to_string();
        let listing = json!([{ "name": "ci.yml", "type": "file", "download_url": RAW }]).to_string();
        let ci = "jobs:\n  ci:\n    uses: WireCatLabs/cli-base/.github/workflows/node-ci.yml@08d954b # v0.61.2\n";
        let gh = fake(&[
            (REPO, Ok(repo)),
            (&format!("{REPO}/contents/.github/workflows?ref=abc"), Ok(listing)),
            (RAW, Ok(ci.into())),
        ]);
        let (signals, complete) = github_with(&gh, "https://github.com/acme/crm", Some("abc"), now());
        assert!(complete);
        assert_eq!(
            signals,
            [
                Signal::RepoNew { days: 7 },
                Signal::FewStars { stars: 2 },
                Signal::NoStandardChecks { missing: vec!["release-checks.yml".into()] }
            ]
        );
        assert_eq!(gh.asked.borrow().len(), 3, "two API calls and one file");
    }

    #[test]
    fn an_archived_stale_repository_and_one_without_workflows_are_flagged() {
        let repo = json!({ "created_at": "2024-01-01T00:00:00Z", "pushed_at": "2025-01-01T00:00:00Z",
            "archived": true, "stargazers_count": 500 })
        .to_string();
        let gh = fake(&[(REPO, Ok(repo))]);
        let (signals, complete) = github_with(&gh, "https://github.com/acme/crm", None, now());
        assert!(complete);
        assert_eq!(
            signals,
            [
                Signal::RepoStale { days: 676 },
                Signal::RepoArchived,
                Signal::NoStandardChecks { missing: STANDARD_WORKFLOWS.map(String::from).to_vec() }
            ]
        );
    }

    #[test]
    fn github_out_of_reach_says_it_could_not_check_and_is_not_cached() {
        let gh = fake(&[(REPO, Err(LIMIT.into()))]);
        let (signals, complete) = github_with(&gh, "https://github.com/acme/crm", None, now());
        assert!(!complete);
        assert_eq!(signals[0], Signal::GithubUnchecked { reason: Unchecked::Limit });
        assert_eq!(github_with(&gh, "https://gitlab.com/acme/crm", None, now()).0, [Signal::NoRepository]);
    }

    #[test]
    fn a_workflow_link_outside_githubs_file_host_is_not_followed() {
        let listing = json!([{ "name": "ci.yml", "type": "file", "download_url": "https://evil.example.net/ci.yml" }]);
        let gh = fake(&[(&format!("{REPO}/contents/.github/workflows"), Ok(listing.to_string()))]);
        assert_eq!(standard_checks(&gh, "acme/crm", None).unwrap().len(), 2);
        assert!(!gh.asked.borrow().iter().any(|u| u.contains("evil")));
    }
}
