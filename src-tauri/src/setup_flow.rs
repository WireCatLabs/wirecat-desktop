//! A tool's connection flow as its CLI describes it (the WireCat setup format v1, `docs/dev/setup-api.md`). Desktop
//! trusts nothing in the document and runs no command from it: only the three fixed commands below, as argument lists,
//! with the profile the owner chose. The interface checks the document's shape (`src/domain/setup-flow.ts`); here the
//! size of the answer, and the images, which are read only from inside the tool's own package.

use crate::catalog::{self, Tool};
use crate::run;
use crate::signin::Answer;
use base64::Engine;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(30);
/// `show` adds each setting's JSON Schema to the 256 KB document, so the answer may be larger than the document.
const MAX_ANSWER: usize = 1024 * 1024;
const MAX_IMAGE: u64 = 2 * 1024 * 1024;
const MAX_IMAGES: usize = 24;

static ASSET_FILE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\.(png|jpe?g|webp)$")
        .expect("a valid pattern")
});
static ASSET_ID: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^[a-z][a-z0-9-]{0,47}$").expect("a valid pattern"));

/// The document as the tool printed it, and each image it names that passed the checks, as a `data:` URL.
#[derive(Serialize, specta::Type, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Shown {
    #[specta(type = specta_typescript::Unknown)]
    pub document: Value,
    pub images: BTreeMap<String, String>,
}

pub fn show_args(profile: &str) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    Ok([profile, "setup", "show", "--json"].map(str::to_string).to_vec())
}

pub fn check_args(profile: &str) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    Ok([profile, "setup", "apply", "--dry-run", "--json"].map(str::to_string).to_vec())
}

pub fn apply_args(profile: &str) -> Result<Vec<String>, String> {
    catalog::validate_profile(profile)?;
    Ok([profile, "setup", "run", "apply", "--json", "--answer-stdin"].map(str::to_string).to_vec())
}

/// `<tool> <profile> setup show --json`. A tool from before the format fails with "unknown command", which the window
/// reads as "keep the hand-made form".
pub fn show(tool: &Tool, profile: &str) -> Result<Shown, String> {
    let bin = crate::tools::program(&tool.bin).ok_or_else(|| format!("{} is not installed.", tool.name))?;
    let args = show_args(profile)?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run_capped(&bin, &refs, Some(&crate::paths::search_path()), TIMEOUT, MAX_ANSWER)
        .map_err(|e| format!("Could not run {}: {e}.", tool.name))?;
    if out.stdout.len() > MAX_ANSWER {
        return Err(format!("{}'s setup flow is larger than the app reads.", tool.name));
    }
    let json = out.json().ok_or_else(|| format!("{} did not describe its setup.", tool.name))?;
    if let Some(error) = json.get("error") {
        return Err(error["message"].as_str().unwrap_or("the tool refused to describe its setup").to_string());
    }
    let document = json.get("item").cloned().ok_or_else(|| format!("{} did not describe its setup.", tool.name))?;
    let images = package_root(tool, &bin).map(|root| images(&document, &root)).unwrap_or_default();
    Ok(Shown { document, images })
}

/// `setup apply --dry-run` with the answers on stdin, never as arguments; the tool's item, or its error object.
pub fn check(tool: &Tool, profile: &str, answers: &Answer) -> Result<Value, String> {
    let bin = crate::tools::program(&tool.bin).ok_or_else(|| format!("{} is not installed.", tool.name))?;
    let args = check_args(profile)?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&crate::paths::search_path()));
    let out = run::run_with_input(cmd, Some(answers.as_bytes()), TIMEOUT, || false)
        .map_err(|e| format!("Could not run {}: {e}.", tool.name))?;
    let json = out.json().ok_or_else(|| format!("{} did not check the answers.", tool.name))?;
    if let Some(error) = json.get("error") {
        return Err(crate::redact::text(error["message"].as_str().unwrap_or("the tool refused the answers")));
    }
    json.get("item").cloned().ok_or_else(|| format!("{} did not check the answers.", tool.name))
}

/// The installed package's folder: the program's real path, up to the `package.json` that names the catalog's package.
/// npm on Windows links a `.cmd` beside `node_modules` instead, so that folder is tried too.
fn package_root(tool: &Tool, bin: &Path) -> Option<PathBuf> {
    let package = &tool.package;
    let named = |dir: &Path| {
        std::fs::read_to_string(dir.join("package.json"))
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .is_some_and(|json| json["name"].as_str() == Some(package.as_str()))
    };
    let real = std::fs::canonicalize(bin).ok()?;
    if let Some(dir) = real.ancestors().skip(1).find(|dir| named(dir)) {
        return std::fs::canonicalize(dir).ok();
    }
    let prefix = crate::npm_prefix::of_copy(bin)?;
    [prefix.join("node_modules").join(package), prefix.join("lib").join("node_modules").join(package)]
        .into_iter()
        .find(|dir| named(dir))
        .and_then(|dir| std::fs::canonicalize(dir).ok())
}

/// Each asset that is a PNG, JPEG or WebP by its first bytes, at most 2 MB, inside the package once links are
/// followed. Any other is left out, and the window shows its alt text.
fn images(document: &Value, root: &Path) -> BTreeMap<String, String> {
    let Some(assets) = document["assets"].as_object() else { return BTreeMap::new() };
    assets
        .iter()
        .take(MAX_IMAGES)
        .filter(|(id, _)| ASSET_ID.is_match(id))
        .filter_map(|(id, asset)| Some((id.clone(), image(root, asset["file"].as_str()?)?)))
        .collect()
}

pub fn image(root: &Path, file: &str) -> Option<String> {
    if !ASSET_FILE.is_match(file) {
        return None;
    }
    let path = std::fs::canonicalize(root.join(file)).ok()?;
    if !path.starts_with(root) || !path.is_file() || std::fs::metadata(&path).ok()?.len() > MAX_IMAGE {
        return None;
    }
    let bytes = std::fs::read(&path).ok()?;
    if bytes.len() as u64 > MAX_IMAGE {
        return None;
    }
    let mime = image_type(&bytes)?;
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes)))
}

/// By the first bytes, whatever the file is named: an SVG can carry a script, so it is never one of these.
fn image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        Some("image/png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

    /// A package folder in a folder of its own, so a file beside the package is outside it.
    fn package(name: &str) -> (PathBuf, PathBuf) {
        let dir = std::env::temp_dir().join(format!("wirecat-setup-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let root = dir.join("pkg");
        std::fs::create_dir_all(root.join("setup")).unwrap();
        (dir.clone(), std::fs::canonicalize(&root).unwrap())
    }

    #[test]
    fn runs_only_the_fixed_commands_with_the_owners_profile() {
        assert_eq!(show_args("office").unwrap(), ["office", "setup", "show", "--json"]);
        assert_eq!(check_args("office").unwrap(), ["office", "setup", "apply", "--dry-run", "--json"]);
        assert_eq!(apply_args("office").unwrap(), ["office", "setup", "run", "apply", "--json", "--answer-stdin"]);
        for bad in ["", "--help", "a;rm -rf ~", "../x y"] {
            assert!(show_args(bad).is_err(), "{bad}");
            assert!(check_args(bad).is_err(), "{bad}");
            assert!(apply_args(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn an_image_is_read_only_from_inside_the_package() {
        let (dir, root) = package("inside");
        std::fs::write(root.join("setup/screen.png"), PNG).unwrap();
        std::fs::write(dir.join("outside.png"), PNG).unwrap();
        assert!(image(&root, "setup/screen.png").unwrap().starts_with("data:image/png;base64,"));
        for refused in ["../outside.png", "/etc/passwd.png", "setup/../../outside.png", "setup/.hidden.png", "x.svg"] {
            assert!(image(&root, refused).is_none(), "{refused}");
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(dir.join("outside.png"), root.join("setup/link.png")).unwrap();
            assert!(image(&root, "setup/link.png").is_none(), "a link that leads outside the package");
        }
    }

    #[test]
    fn an_image_is_a_small_png_jpeg_or_webp_by_its_bytes() {
        let (_dir, root) = package("bytes");
        std::fs::write(root.join("setup/svg.png"), b"<svg onload=alert(1)></svg>").unwrap();
        assert!(image(&root, "setup/svg.png").is_none());
        std::fs::write(root.join("setup/a.jpg"), [0xff, 0xd8, 0xff, 0xe0]).unwrap();
        assert!(image(&root, "setup/a.jpg").unwrap().starts_with("data:image/jpeg;"));
        std::fs::write(root.join("setup/a.webp"), b"RIFF\0\0\0\0WEBPVP8 ").unwrap();
        assert!(image(&root, "setup/a.webp").unwrap().starts_with("data:image/webp;"));
        let mut big = PNG.to_vec();
        big.resize(usize::try_from(MAX_IMAGE).unwrap() + 1, 0);
        std::fs::write(root.join("setup/big.png"), big).unwrap();
        assert!(image(&root, "setup/big.png").is_none());
    }

    #[test]
    fn only_the_assets_the_document_names_are_read() {
        let (_dir, root) = package("named");
        std::fs::write(root.join("setup/screen.png"), PNG).unwrap();
        let document = serde_json::json!({ "assets": {
            "screen": { "file": "setup/screen.png" },
            "Bad Id": { "file": "setup/screen.png" },
            "gone": { "file": "setup/missing.png" },
        } });
        let found = images(&document, &root);
        assert_eq!(found.keys().collect::<Vec<_>>(), ["screen"]);
    }
}
