//! Confirms, before a global install, that an npm release of a tool was built by its own repository's release workflow
//! on GitHub Actions, so a release published with a stolen npm token never reaches the owner's accounts (RISK-2099).
//!
//! `npm audit signatures` checks the registry signature and the Sigstore signature of every attestation, and that the
//! attestation names this tarball's sha512. It refuses global installs, so it runs on a project of one stub package
//! in a temporary folder; it reads only `name` and `version` and checks the registry's data, so no tarball is needed.
//! It passes a release with no provenance at all and never asks whose workflow signed it: that is checked here, on
//! the identity in the Sigstore certificate, not on the statement's own fields, which the publisher's runner writes.

use crate::{paths, run};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;
use std::fmt::Write;
use std::path::Path;
use std::time::Duration;
use x509_parser::der_parser::parse_der;
use x509_parser::prelude::{FromDer, GeneralName, X509Certificate};

const REGISTRY: &str = "https://registry.npmjs.org";
const SLSA_V1: &str = "https://slsa.dev/provenance/v1";
const WORKFLOW: &str = ".github/workflows/release.yml";
const GITHUB_ACTIONS: &str = "https://token.actions.githubusercontent.com";
/// Fulcio's "Issuer (V2)" extension, a DER `UTF8String`; the V1 one at `.1.1` holds raw bytes.
const OIDC_ISSUER: &str = "1.3.6.1.4.1.57264.1.8";
/// Fulcio's "Source Repository Digest" and "Run Invocation URI", also `UTF8String`s
/// (<https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md>).
const SOURCE_DIGEST: &str = "1.3.6.1.4.1.57264.1.13";
const RUN_URI: &str = "1.3.6.1.4.1.57264.1.21";

#[derive(Debug, PartialEq)]
pub enum Refusal {
    /// The check ran and the release did not pass it; the reason is for the log.
    Unconfirmed(String),
    Unreachable(String),
}

pub fn confirm(npm: &Path, package: &str, version: &str, repo: &str) -> Result<(), Refusal> {
    audit(npm, package, version)?;
    let agent = agent();
    let name = package.replacen('/', "%2f", 1);
    let release = get_json(&agent, &format!("{REGISTRY}/{name}/{version}"))?;
    let integrity = release["dist"]["integrity"].as_str().unwrap_or_default();
    let attestations = get_json(&agent, &format!("{REGISTRY}/-/npm/v1/attestations/{name}@{version}"))?;
    provenance_verdict(&attestations, package, version, integrity, repo).map_err(Refusal::Unconfirmed)
}

fn audit(npm: &Path, package: &str, version: &str) -> Result<(), Refusal> {
    let dir = std::env::temp_dir().join(format!(
        "wirecat-provenance-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()
    ));
    let result = stub(&dir, package, version)
        .map_err(|e| Refusal::Unconfirmed(format!("could not prepare the check: {e}")))
        .and_then(|()| {
            let mut cmd = run::command(
                npm,
                &["audit", "signatures", "--json", &format!("--registry={REGISTRY}/")],
                Some(&paths::search_path()),
            );
            cmd.current_dir(&dir);
            run::run_command(cmd, Duration::from_mins(2)).map_err(|e| Refusal::Unreachable(e.to_string()))
        })
        .and_then(|out| audit_verdict(out.code, &out.stdout));
    let _ = std::fs::remove_dir_all(&dir);
    result
}

fn stub(dir: &Path, package: &str, version: &str) -> std::io::Result<()> {
    let module = dir.join("node_modules").join(package);
    std::fs::create_dir_all(&module)?;
    // Without the dependency in package.json, npm leaves the package out of the audit and still answers "all clear".
    let project = serde_json::json!({ "private": true, "dependencies": { package: version } });
    std::fs::write(dir.join("package.json"), project.to_string())?;
    std::fs::write(module.join("package.json"), serde_json::json!({ "name": package, "version": version }).to_string())
}

fn audit_verdict(code: Option<i32>, stdout: &str) -> Result<(), Refusal> {
    let out: Value = serde_json::from_str(stdout).unwrap_or_default();
    if let Some(error) = out.get("error") {
        let code = error["code"].as_str().unwrap_or_default();
        let summary = error["summary"].as_str().unwrap_or("npm audit signatures failed");
        // The code goes into the text so `install::classify` can tell a certificate or proxy problem from the rest.
        let summary = if code.is_empty() { summary.to_string() } else { format!("{code}: {summary}") };
        let network = ["ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].contains(&code);
        return Err(if network { Refusal::Unreachable(summary) } else { Refusal::Unconfirmed(summary) });
    }
    if let Some(bad) = out["invalid"].as_array().and_then(|a| a.first()) {
        return Err(Refusal::Unconfirmed(format!(
            "{}@{}: {}",
            bad["name"].as_str().unwrap_or_default(),
            bad["version"].as_str().unwrap_or_default(),
            bad["message"].as_str().unwrap_or("invalid signature")
        )));
    }
    if out["missing"].as_array().is_some_and(|a| !a.is_empty()) {
        return Err(Refusal::Unconfirmed("the release has no registry signature".into()));
    }
    if code != Some(0) || !out["invalid"].is_array() {
        return Err(Refusal::Unconfirmed("npm audit signatures did not finish".into()));
    }
    Ok(())
}

/// `attestations` is the registry's answer for this release; `integrity` its `dist.integrity`.
fn provenance_verdict(
    attestations: &Value,
    package: &str,
    version: &str,
    integrity: &str,
    repo: &str,
) -> Result<(), String> {
    let Signer { issuer, workflow } = attested(attestations, package, version, integrity)?;
    if issuer != GITHUB_ACTIONS {
        return Err(format!("signed with an identity from {issuer}, not from GitHub Actions"));
    }
    let expected = release_workflow(repo);
    if workflow != expected {
        return Err(format!("built by {workflow}, not by {expected}"));
    }
    Ok(())
}

/// The signer of the provenance tied to this exact tarball: its subject names the release and its sha512.
fn attested(attestations: &Value, package: &str, version: &str, integrity: &str) -> Result<Signer, String> {
    let bundle = attested_bundle(attestations, package, version, integrity)?;
    signer(bundle).ok_or_else(|| "the provenance has no readable signing certificate".into())
}

fn attested_bundle<'a>(
    attestations: &'a Value,
    package: &str,
    version: &str,
    integrity: &str,
) -> Result<&'a Value, String> {
    let bundle = attestations["attestations"]
        .as_array()
        .and_then(|list| list.iter().find(|a| a["predicateType"] == SLSA_V1))
        .map(|a| &a["bundle"])
        .ok_or("the release has no provenance")?;
    let payload = STANDARD
        .decode(bundle["dsseEnvelope"]["payload"].as_str().unwrap_or_default())
        .map_err(|_| "the provenance cannot be read")?;
    let statement: Value = serde_json::from_slice(&payload).map_err(|_| "the provenance cannot be read")?;
    let subject = &statement["subject"][0];
    if subject["name"] != purl(package, version) {
        return Err(format!("the provenance is for {}", subject["name"]));
    }
    let digest = integrity
        .strip_prefix("sha512-")
        .and_then(|b64| STANDARD.decode(b64).ok())
        .map(|bytes| {
            bytes.iter().fold(String::new(), |mut hex, b| {
                let _ = write!(hex, "{b:02x}");
                hex
            })
        })
        .ok_or("the registry gave no sha512 for the release")?;
    if subject["digest"]["sha512"] != digest.as_str() {
        return Err("the provenance is for another tarball".into());
    }
    Ok(bundle)
}

/// Where the owner can look at the build that made this tarball: the commit and the workflow run, read from the
/// signing certificate like the signer (the statement's own copies are written by the publisher's runner), and the
/// transparency-log entry that recorded it.
#[derive(Debug, PartialEq, Clone, Default)]
pub struct Release {
    pub commit: Option<String>,
    pub run: Option<String>,
    pub log_index: Option<u64>,
}

pub fn release(attestations: &Value, package: &str, version: &str, integrity: &str) -> Option<Release> {
    let bundle = attested_bundle(attestations, package, version, integrity).ok()?;
    let cert = certificate(bundle)?;
    let (_, cert) = X509Certificate::from_der(&cert).ok()?;
    let text = |oid: &str| {
        let ext = cert.extensions().iter().find(|e| e.oid.to_id_string() == oid)?;
        Some(parse_der(ext.value).ok()?.1.as_str().ok()?.to_string())
    };
    let commit = text(SOURCE_DIGEST).filter(|c| c.len() == 40 && c.bytes().all(|b| b.is_ascii_hexdigit()));
    let run = text(RUN_URI).filter(|u| u.starts_with("https://github.com/") && u.contains("/actions/runs/"));
    let log_index = bundle["verificationMaterial"]["tlogEntries"][0]["logIndex"]
        .as_str()
        .and_then(|i| i.parse().ok())
        .or_else(|| bundle["verificationMaterial"]["tlogEntries"][0]["logIndex"].as_u64());
    Some(Release { commit, run, log_index })
}

/// Where npm says an own tool's release was built: shown to the owner, never required.
#[derive(Debug, PartialEq, Clone)]
pub enum Built {
    /// A GitHub Actions run of `repo` (`https://github.com/<owner>/<name>`) with `workflow` (path and ref).
    By { repo: String, workflow: String },
    /// No provenance, or none that names a GitHub repository; the reason is for the log.
    Unknown(String),
}

pub fn built(attestations: &Value, package: &str, version: &str, integrity: &str) -> Built {
    match attested(attestations, package, version, integrity) {
        Ok(Signer { issuer, workflow }) if issuer == GITHUB_ACTIONS => {
            match workflow.split_once("/.github/workflows/") {
                Some((repo, rest)) if repo.starts_with("https://github.com/") => {
                    Built::By { repo: repo.to_string(), workflow: format!(".github/workflows/{rest}") }
                }
                _ => Built::Unknown(format!("built by {workflow}")),
            }
        }
        Ok(Signer { issuer, .. }) => Built::Unknown(format!("signed with an identity from {issuer}")),
        Err(why) => Built::Unknown(why),
    }
}

/// The registry's attestations of one release; a release with none answers 404, read here as an empty list.
pub fn attestations(package: &str, version: &str) -> Result<Value, Refusal> {
    let agent = agent();
    attestations_with(&|url| get_json(&agent, url), package, version)
}

fn attestations_with(
    get: &dyn Fn(&str) -> Result<Value, Refusal>,
    package: &str,
    version: &str,
) -> Result<Value, Refusal> {
    let name = package.replacen('/', "%2f", 1);
    match get(&format!("{REGISTRY}/-/npm/v1/attestations/{name}@{version}")) {
        Err(Refusal::Unconfirmed(_)) => Ok(serde_json::json!({ "attestations": [] })),
        other => other,
    }
}

/// An own tool's release: the registry's signatures must still verify, but provenance is reported, not required. It
/// refuses a release whose tarball is not the one reviewed (`integrity`), or one built by another repository than the
/// one the owner was shown (`repo`, empty for none).
pub fn confirm_own(npm: &Path, package: &str, version: &str, repo: &str, integrity: &str) -> Result<Built, Refusal> {
    audit(npm, package, version)?;
    let agent = agent();
    own_verdict(&|url| get_json(&agent, url), package, version, repo, integrity)
}

fn own_verdict(
    get: &dyn Fn(&str) -> Result<Value, Refusal>,
    package: &str,
    version: &str,
    repo: &str,
    reviewed: &str,
) -> Result<Built, Refusal> {
    let name = package.replacen('/', "%2f", 1);
    let release = get(&format!("{REGISTRY}/{name}/{version}"))?;
    let integrity = release["dist"]["integrity"].as_str().unwrap_or_default();
    if integrity != reviewed {
        return Err(Refusal::Unconfirmed("the release is not the package file that was reviewed".into()));
    }
    let found = built(&attestations_with(get, package, version)?, package, version, integrity);
    match &found {
        Built::By { repo: by, .. } if !by.eq_ignore_ascii_case(repo) => {
            let shown = if repo.is_empty() { "no repository" } else { repo };
            Err(Refusal::Unconfirmed(format!("built by {by}, but the review showed {shown}")))
        }
        _ => Ok(found),
    }
}

/// Only `main`: anyone who can push a side branch could otherwise publish a release from it (owner, NEED-2170).
fn release_workflow(repo: &str) -> String {
    format!("{repo}/{WORKFLOW}@refs/heads/main")
}

#[derive(Debug, PartialEq)]
struct Signer {
    issuer: String,
    workflow: String,
}

/// Who the Fulcio certificate was issued to: the OIDC issuer extension and the URI subject alternative name.
fn signer(bundle: &Value) -> Option<Signer> {
    let der = certificate(bundle)?;
    let (_, cert) = X509Certificate::from_der(&der).ok()?;
    let issuer = cert.extensions().iter().find(|e| e.oid.to_id_string() == OIDC_ISSUER)?;
    let issuer = parse_der(issuer.value).ok()?.1.as_str().ok()?.to_string();
    let san = cert.subject_alternative_name().ok()??;
    let workflow = san.value.general_names.iter().find_map(|name| match name {
        GeneralName::URI(uri) => Some((*uri).to_string()),
        _ => None,
    })?;
    Some(Signer { issuer, workflow })
}

fn certificate(bundle: &Value) -> Option<Vec<u8>> {
    let material = &bundle["verificationMaterial"];
    let raw = material["certificate"]["rawBytes"]
        .as_str()
        .or_else(|| material["x509CertificateChain"]["certificates"][0]["rawBytes"].as_str())?;
    STANDARD.decode(raw).ok()
}

fn purl(package: &str, version: &str) -> String {
    format!("pkg:npm/{}@{version}", package.replacen('@', "%40", 1))
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(30)))
        .https_only(true)
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

fn get_json(agent: &ureq::Agent, url: &str) -> Result<Value, Refusal> {
    match agent.get(url).call() {
        Ok(mut response) => response.body_mut().read_json().map_err(|e| Refusal::Unreachable(e.to_string())),
        Err(ureq::Error::StatusCode(404)) => Err(Refusal::Unconfirmed("the release has no provenance".into())),
        Err(e) => Err(Refusal::Unreachable(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TG: &str = include_str!("../tests/fixtures/provenance/tg-cli-0.113.0.json");
    const TG_INTEGRITY: &str =
        "sha512-sBW5c/osDNPolJRmvoN6Eb63S08Zg5r3B5zSCQSlE8dS1aD1IxFVd9zeLDGxT6XD91MnRe+6iTkgotS++OGIFA==";
    const TG_REPO: &str = "https://github.com/WireCatLabs/tg-cli";

    fn tg() -> Value {
        serde_json::from_str(TG).unwrap()
    }

    #[test]
    fn a_release_built_by_its_own_release_workflow_passes() {
        assert_eq!(provenance_verdict(&tg(), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY, TG_REPO), Ok(()));
    }

    #[test]
    fn the_signer_comes_from_the_certificate() {
        let bundle = &tg()["attestations"][1]["bundle"];
        let expected = Signer {
            issuer: GITHUB_ACTIONS.into(),
            workflow: "https://github.com/WireCatLabs/tg-cli/.github/workflows/release.yml@refs/heads/main".into(),
        };
        assert_eq!(signer(bundle), Some(expected));
    }

    #[test]
    fn a_release_built_in_another_repository_is_refused() {
        let other = "https://github.com/WireCatLabs/max-cli";
        let refused = provenance_verdict(&tg(), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY, other).unwrap_err();
        assert!(refused.contains("not by https://github.com/WireCatLabs/max-cli/"), "{refused}");
    }

    #[test]
    fn only_the_main_branch_counts() {
        let main = release_workflow(TG_REPO);
        assert_eq!(main, "https://github.com/WireCatLabs/tg-cli/.github/workflows/release.yml@refs/heads/main");
        assert_ne!(main, format!("{TG_REPO}/{WORKFLOW}@refs/heads/side"));
        assert_ne!(main, format!("{TG_REPO}/{WORKFLOW}@refs/tags/v0.113.0"));
    }

    #[test]
    fn a_release_without_provenance_is_refused() {
        let mut only_publish = tg();
        only_publish["attestations"].as_array_mut().unwrap().retain(|a| a["predicateType"] != SLSA_V1);
        let refused = provenance_verdict(&only_publish, "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY, TG_REPO);
        assert_eq!(refused, Err("the release has no provenance".into()));
    }

    #[test]
    fn provenance_for_another_version_or_tarball_is_refused() {
        assert!(provenance_verdict(&tg(), "@wirecat/tg-cli", "0.114.0", TG_INTEGRITY, TG_REPO).is_err());
        let other = "sha512-AAAAc/osDNPolJRmvoN6Eb63S08Zg5r3B5zSCQSlE8dS1aD1IxFVd9zeLDGxT6XD91MnRe+6iTkgotS++OGIFA==";
        let refused = provenance_verdict(&tg(), "@wirecat/tg-cli", "0.113.0", other, TG_REPO);
        assert_eq!(refused, Err("the provenance is for another tarball".into()));
    }

    #[test]
    fn a_clean_audit_passes() {
        assert_eq!(audit_verdict(Some(0), "{\n  \"invalid\": [],\n  \"missing\": []\n}\n"), Ok(()));
    }

    #[test]
    fn an_invalid_signature_or_attestation_is_refused() {
        // Shape from npm's lib/utils/verify-signatures.js.
        let out = r#"{"invalid":[{"code":"EATTESTATIONVERIFY","message":"@wirecat/tg-cli@0.113.0 failed to verify attestation: signature verification failed","name":"@wirecat/tg-cli","version":"0.113.0","location":"node_modules/@wirecat/tg-cli","registry":"https://registry.npmjs.org/","type":"dependencies"}],"missing":[]}"#;
        let Err(Refusal::Unconfirmed(why)) = audit_verdict(Some(1), out) else { panic!("must refuse") };
        assert!(why.contains("failed to verify attestation"), "{why}");
        let missing = r#"{"invalid":[],"missing":[{"name":"@wirecat/tg-cli","version":"0.113.0"}]}"#;
        assert!(matches!(audit_verdict(Some(1), missing), Err(Refusal::Unconfirmed(_))));
    }

    #[test]
    fn a_registry_out_of_reach_is_told_apart() {
        let out = r#"{"error":{"code":"ENOTFOUND","summary":"request to https://registry.npmjs.org/-/npm/v1/keys failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org","detail":""}}"#;
        assert!(matches!(audit_verdict(Some(1), out), Err(Refusal::Unreachable(_))));
        let nothing = r#"{"error":{"summary":"found no dependencies to audit that were installed from a supported registry","detail":""}}"#;
        assert!(matches!(audit_verdict(Some(1), nothing), Err(Refusal::Unconfirmed(_))));
        assert!(matches!(audit_verdict(Some(1), "npm error"), Err(Refusal::Unconfirmed(_))));
    }

    #[test]
    #[ignore = "asks the npm registry"]
    fn confirms_every_published_tool() {
        let npm = paths::find("npm").expect("npm");
        for t in &crate::catalog::catalog().tools {
            let version = crate::tools::latest_version(&t.package).expect("latest version");
            let started = std::time::Instant::now();
            assert_eq!(confirm(&npm, &t.package, &version, &t.repo), Ok(()), "{}", t.package);
            println!("{}@{version}: {:?}", t.package, started.elapsed());
        }
        let other = "https://github.com/WireCatLabs/max-cli";
        let version = crate::tools::latest_version("@wirecat/tg-cli").unwrap();
        assert!(matches!(confirm(&npm, "@wirecat/tg-cli", &version, other), Err(Refusal::Unconfirmed(_))));
        assert!(matches!(confirm(&npm, "is-number", "7.0.0", other), Err(Refusal::Unconfirmed(_))));
    }

    #[test]
    fn an_own_tools_build_is_read_without_refusing() {
        let by = built(&tg(), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY);
        let workflow = ".github/workflows/release.yml@refs/heads/main".to_string();
        assert_eq!(by, Built::By { repo: TG_REPO.into(), workflow });
        assert!(matches!(built(&serde_json::json!({}), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY), Built::Unknown(_)));
        let other = "sha512-AAAAc/osDNPolJRmvoN6Eb63S08Zg5r3B5zSCQSlE8dS1aD1IxFVd9zeLDGxT6XD91MnRe+6iTkgotS++OGIFA==";
        assert!(matches!(built(&tg(), "@wirecat/tg-cli", "0.113.0", other), Built::Unknown(_)), "another tarball");
    }

    #[test]
    fn the_release_commit_and_run_come_from_the_certificate() {
        let found = release(&tg(), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY).unwrap();
        assert_eq!(found.commit.as_deref(), Some("d2f457578a88f67fce5cdb5da2eb572d85403633"));
        assert_eq!(
            found.run.as_deref(),
            Some("https://github.com/WireCatLabs/tg-cli/actions/runs/41391131685/attempts/1")
        );
        assert_eq!(found.log_index, Some(3_637_711_518));
        assert_eq!(release(&serde_json::json!({}), "@wirecat/tg-cli", "0.113.0", TG_INTEGRITY), None);
    }

    #[test]
    fn an_own_tool_from_another_repository_or_another_tarball_is_refused_and_offline_is_told_apart() {
        let answer = |release: Value, attestations: Value| {
            move |url: &str| -> Result<Value, Refusal> {
                Ok(if url.contains("/attestations/") { attestations.clone() } else { release.clone() })
            }
        };
        let release = serde_json::json!({ "dist": { "integrity": TG_INTEGRITY } });
        let get = answer(release.clone(), tg());
        let ok = own_verdict(&get, "@wirecat/tg-cli", "0.113.0", TG_REPO, TG_INTEGRITY);
        assert!(matches!(ok, Ok(Built::By { .. })));
        let other = own_verdict(&get, "@wirecat/tg-cli", "0.113.0", "https://github.com/example/fork", TG_INTEGRITY);
        assert!(matches!(other, Err(Refusal::Unconfirmed(why)) if why.contains("review showed")));
        let none = own_verdict(&get, "@wirecat/tg-cli", "0.113.0", "", TG_INTEGRITY);
        assert!(matches!(none, Err(Refusal::Unconfirmed(_))), "an attested build the review did not show");
        let changed = own_verdict(&get, "@wirecat/tg-cli", "0.113.0", TG_REPO, "sha512-other");
        assert!(matches!(changed, Err(Refusal::Unconfirmed(why)) if why.contains("reviewed")));
        let unsigned = answer(release, serde_json::json!({ "attestations": [] }));
        assert!(matches!(
            own_verdict(&unsigned, "@wirecat/tg-cli", "0.113.0", "", TG_INTEGRITY),
            Ok(Built::Unknown(_))
        ));
        let offline = |_: &str| -> Result<Value, Refusal> { Err(Refusal::Unreachable("ENOTFOUND".into())) };
        assert!(matches!(
            own_verdict(&offline, "@wirecat/tg-cli", "0.113.0", TG_REPO, TG_INTEGRITY),
            Err(Refusal::Unreachable(_))
        ));
    }

    #[test]
    fn scoped_names_are_encoded_like_npm_does() {
        assert_eq!(purl("@wirecat/tg-cli", "0.113.0"), "pkg:npm/%40wirecat/tg-cli@0.113.0");
    }
}
