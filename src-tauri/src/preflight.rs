use crate::archive::Answer;
use crate::catalog::Tool;
use crate::compat;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

const REGISTRY: &str = "https://registry.npmjs.org";
const CORE: &str = "@wirecat/cli-core";

/// What a published version does to the shared store, from its cli-core's `wirecat.store` in package.json.
#[derive(Debug, PartialEq, Clone, Copy)]
pub(crate) struct StoreMeta {
    pub speaks: u64,
    pub min_compatible: u64,
}

/// The newest published version of a package and, when its cli-core says, what it does to the store.
#[derive(Debug, PartialEq, Clone)]
pub(crate) struct Published {
    pub version: String,
    pub store: Option<StoreMeta>,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CannotOpen {
    /// The schema the new version reads.
    pub speaks: u64,
    /// The oldest schema the store file still lets a tool open.
    pub needs: u64,
}

#[derive(specta::Type, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    pub id: String,
    pub version: String,
}

/// What installing the newest version of a tool does to the other installed tools. Empty when it is safe or unknown.
#[derive(specta::Type, Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Preflight {
    /// The version npm installs; None when the registry did not answer.
    pub version: Option<String>,
    /// False when the new version's store metadata is missing: nothing was checked.
    pub known: bool,
    pub cannot_open: Option<CannotOpen>,
    /// Installed tools whose newest version reads the store afterwards: updated in the same step, without a question.
    pub also_update: Vec<Update>,
    /// Installed tools that cannot read the store afterwards until a newer version of theirs is published.
    pub stops: Vec<String>,
}

/// An installed tool that opens the store now, with the schema it reads.
pub(crate) struct Reader {
    pub id: String,
    pub speaks: u64,
}

/// `file_min` is the store file's `min_compatible`, None when there is no file. `readers` leaves the target out.
pub(crate) fn decide(
    file_min: Option<u64>,
    next: Option<&Published>,
    readers: &[Reader],
    latest: &HashMap<String, Published>,
) -> Preflight {
    let Some(next) = next else { return Preflight::default() };
    let Some(store) = next.store else {
        return Preflight { version: Some(next.version.clone()), ..Preflight::default() };
    };
    let mut answer = Preflight { version: Some(next.version.clone()), known: true, ..Preflight::default() };
    if let Some(needs) = file_min
        && store.speaks < needs
    {
        // A version that refuses the file never runs its migrations, so it cannot lock anyone else out.
        answer.cannot_open = Some(CannotOpen { speaks: store.speaks, needs });
        return answer;
    }
    let mut after = store.min_compatible.max(file_min.unwrap_or(0));
    // A tool updated alongside runs its own migrations too, so its minimum can strand a third tool.
    loop {
        let (fixed, stuck): (Vec<_>, Vec<_>) = readers
            .iter()
            .filter(|r| r.speaks < after)
            .partition(|r| latest.get(&r.id).and_then(|p| p.store).is_some_and(|s| s.speaks >= after));
        let raised = fixed.iter().filter_map(|r| latest[&r.id].store).map(|s| s.min_compatible).fold(after, u64::max);
        if raised > after {
            after = raised;
            continue;
        }
        answer.also_update =
            fixed.iter().map(|r| Update { id: r.id.clone(), version: latest[&r.id].version.clone() }).collect();
        answer.stops = stuck.iter().map(|r| r.id.clone()).collect();
        return answer;
    }
}

/// npm reads a bare version as that exact version, where `semver::VersionReq` would read it as `^`; ranges with `||`
/// or npm's space-separated form are left unknown.
pub(crate) fn resolve_core<'a>(wanted: &str, published: impl IntoIterator<Item = &'a str>) -> Option<semver::Version> {
    let wanted = wanted.trim();
    if let Ok(exact) = semver::Version::parse(wanted.trim_start_matches('=')) {
        return Some(exact);
    }
    if wanted.contains("||") || wanted.contains(' ') {
        return None;
    }
    let range = semver::VersionReq::parse(wanted).ok()?;
    published.into_iter().filter_map(|v| semver::Version::parse(v).ok()).filter(|v| range.matches(v)).max()
}

fn store_of(core: &Value) -> Option<StoreMeta> {
    let s = &core["wirecat"]["store"];
    Some(StoreMeta { speaks: s["speaks"].as_u64()?, min_compatible: s["minCompatible"].as_u64()? })
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(4))).max_redirects(0).build().into()
}

fn get(agent: &ureq::Agent, path: &str, abbreviated: bool) -> Option<Value> {
    let mut request = agent.get(&format!("{REGISTRY}/{}", path.replacen('/', "%2f", 1)));
    if abbreviated {
        request = request.header("Accept", "application/vnd.npm.install-v1+json");
    }
    request.call().ok()?.body_mut().read_json().ok()
}

/// The package's `latest`, then the cli-core it depends on. The abbreviated document has no `wirecat` field, so the
/// chosen cli-core version is read on its own.
fn published(agent: &ureq::Agent, package: &str) -> Option<Published> {
    let latest = get(agent, &format!("{package}/latest"), false)?;
    let version = latest["version"].as_str()?.to_string();
    let store = latest["dependencies"][CORE].as_str().and_then(|wanted| {
        let core = resolve_core(wanted, []).or_else(|| {
            let all = get(agent, CORE, true)?;
            resolve_core(wanted, all["versions"].as_object()?.keys().map(String::as_str))
        })?;
        store_of(&get(agent, &format!("{CORE}/{core}"), false)?)
    });
    Some(Published { version, store })
}

/// The registry's `latest` as the check above read it. `npm view` reads the full document, which the registry's cache
/// keeps for five minutes and which lags the version's own document further right after a publish.
pub fn newest_version(package: &str) -> Option<String> {
    get(&agent(), &format!("{package}/latest"), false)?["version"].as_str().map(str::to_string)
}

fn file_min(answers: &compat::Answers) -> Option<u64> {
    let (_, v) = compat::best(answers)?;
    let item = v.get("item").unwrap_or(v);
    if item["exists"].as_bool() != Some(true) {
        return None;
    }
    item["schema"]["min_compatible"].as_u64()
}

/// Same rule as `readsNow` in `domain/compat.ts`: a tool counts only while it opens the store.
fn readers(answers: &compat::Answers, target: &str) -> Vec<Reader> {
    answers
        .iter()
        .filter(|(tool, answer)| tool.id != target && matches!(answer, Ok(Answer::Envelope(_))))
        .filter_map(|(tool, answer)| {
            let view = compat::view(&tool.id, answer);
            (view.writable != Some(false)).then_some(Reader { id: tool.id.clone(), speaks: view.speaks? })
        })
        .collect()
}

pub fn preflight(tool: &Tool) -> Preflight {
    if tool.store_info.is_none() {
        return Preflight::default();
    }
    let agent = &agent();
    let (answers, next, latest) = std::thread::scope(|scope| {
        let probe = scope.spawn(compat::probe);
        let next = scope.spawn(move || published(agent, &tool.package));
        let others: Vec<_> = compat::installed()
            .into_iter()
            .filter(|t| t.id != tool.id)
            .map(|t| (t.id.clone(), scope.spawn(move || published(agent, &t.package))))
            .collect();
        let latest: HashMap<String, Published> =
            others.into_iter().filter_map(|(id, h)| Some((id, h.join().ok()??))).collect();
        (probe.join().unwrap_or_default(), next.join().ok().flatten(), latest)
    });
    decide(file_min(&answers), next.as_ref(), &readers(&answers, &tool.id), &latest)
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn meta(speaks: u64, min_compatible: u64) -> StoreMeta {
        StoreMeta { speaks, min_compatible }
    }

    fn version(v: &str, store: Option<StoreMeta>) -> Published {
        Published { version: v.into(), store }
    }

    fn reader(id: &str, speaks: u64) -> Reader {
        Reader { id: id.into(), speaks }
    }

    #[test]
    fn a_version_older_than_the_file_cannot_open_it_and_moves_nothing() {
        let next = version("0.117.0", Some(meta(31, 31)));
        let answer = decide(Some(32), Some(&next), &[reader("wa", 30)], &HashMap::new());
        assert_eq!(answer.cannot_open, Some(CannotOpen { speaks: 31, needs: 32 }));
        assert_eq!(answer.stops, Vec::<String>::new());
    }

    fn update(id: &str, version: &str) -> Update {
        Update { id: id.into(), version: version.into() }
    }

    #[test]
    fn a_tool_whose_newest_version_reads_the_new_format_is_updated_and_only_the_rest_stop() {
        let next = version("0.7.0", Some(meta(34, 34)));
        let latest = HashMap::from([
            ("memo".into(), version("0.95.0", Some(meta(34, 33)))),
            ("max".into(), version("0.74.0", Some(meta(33, 32)))),
        ]);
        let readers = [reader("memo", 33), reader("max", 33), reader("drive", 34)];
        let answer = decide(Some(32), Some(&next), &readers, &latest);
        assert!(answer.known);
        assert_eq!(answer.also_update, vec![update("memo", "0.95.0")]);
        assert_eq!(answer.stops, vec!["max".to_string()]);
    }

    #[test]
    fn a_newer_version_without_metadata_is_no_fix() {
        let next = version("0.7.0", Some(meta(34, 34)));
        let latest = HashMap::from([("tg".into(), version("0.89.0", None))]);
        let answer = decide(Some(32), Some(&next), &[reader("tg", 33)], &latest);
        assert_eq!((answer.also_update, answer.stops), (Vec::new(), vec!["tg".to_string()]));
    }

    #[test]
    fn a_tool_updated_alongside_can_raise_the_minimum_for_a_third() {
        let next = version("0.7.0", Some(meta(34, 34)));
        let latest = HashMap::from([
            ("tg".into(), version("0.89.0", Some(meta(35, 35)))),
            ("max".into(), version("0.75.0", Some(meta(34, 34)))),
        ]);
        let readers = [reader("tg", 33), reader("max", 33), reader("drive", 34)];
        let answer = decide(Some(32), Some(&next), &readers, &latest);
        assert_eq!(answer.also_update, vec![update("tg", "0.89.0")]);
        assert_eq!(answer.stops, vec!["max".to_string(), "drive".to_string()]);
    }

    #[test]
    fn the_file_minimum_counts_when_it_is_higher_than_the_new_version_s() {
        let next = version("0.7.0", Some(meta(34, 30)));
        let answer = decide(Some(33), Some(&next), &[reader("tg", 33)], &HashMap::new());
        assert_eq!(answer.stops, Vec::<String>::new());
        let none_yet = decide(None, Some(&next), &[reader("tg", 29)], &HashMap::new());
        assert_eq!(none_yet.stops.len(), 1);
    }

    #[test]
    fn missing_metadata_or_no_registry_warns_about_nothing() {
        let old_core = version("0.7.0", None);
        let answer = decide(Some(40), Some(&old_core), &[reader("tg", 1)], &HashMap::new());
        assert_eq!((answer.known, answer.cannot_open, answer.stops.len()), (false, None, 0));
        assert_eq!(answer.version.as_deref(), Some("0.7.0"));
        assert_eq!(decide(Some(40), None, &[reader("tg", 1)], &HashMap::new()), Preflight::default());
    }

    #[test]
    fn a_bare_version_is_exact_and_a_range_takes_the_newest_match() {
        let published = ["0.567.0", "0.567.1", "0.568.0", "1.0.0"];
        assert_eq!(resolve_core("0.567.0", published), Some(semver::Version::new(0, 567, 0)));
        assert_eq!(resolve_core("^0.567.0", published), Some(semver::Version::new(0, 567, 1)));
        assert_eq!(resolve_core("~0.567.0", published), Some(semver::Version::new(0, 567, 1)));
        assert_eq!(resolve_core(">=0.567.0 <1.0.0", published), None);
        assert_eq!(resolve_core("^1 || ^2", published), None);
        assert_eq!(resolve_core("^2.0.0", published), None);
    }

    #[test]
    fn reads_the_store_block_cli_core_publishes() {
        let core = serde_json::json!({"version": "0.600.0", "wirecat": {"store": {"speaks": 34, "minCompatible": 33}}});
        assert_eq!(store_of(&core), Some(meta(34, 33)));
        assert_eq!(store_of(&serde_json::json!({"version": "0.590.0"})), None);
    }

    #[test]
    #[ignore = "reaches registry.npmjs.org"]
    fn reads_a_published_tool_from_npm() {
        let tg = published(&agent(), "@wirecat/tg-cli").expect("npm answered");
        assert!(semver::Version::parse(&tg.version).is_ok(), "{tg:?}");
        let core = get(&agent(), &format!("{CORE}/0.567.0"), false).expect("cli-core 0.567.0");
        assert_eq!(core["version"], "0.567.0");
    }
}
