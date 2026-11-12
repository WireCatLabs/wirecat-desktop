//! One place per rule in the Rust sources, checked by reading them: test code and comments are left out.

use std::fs;
use std::path::{Path, PathBuf};

fn sources(dir: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            found.extend(sources(&path));
        } else if path.extension().is_some_and(|e| e == "rs") {
            found.push(path);
        }
    }
    found
}

/// The index just past a string or char literal starting at `i`, or `i + 1` when none starts there.
fn past_literal(b: &[u8], i: usize) -> usize {
    if b[i] == b'r' && matches!(b.get(i + 1), Some(b'"' | b'#')) && (i == 0 || !b[i - 1].is_ascii_alphanumeric()) {
        let hashes = b[i + 1..].iter().take_while(|&&c| c == b'#').count();
        if b.get(i + 1 + hashes) == Some(&b'"') {
            let close: Vec<u8> = std::iter::once(b'"').chain(std::iter::repeat_n(b'#', hashes)).collect();
            let from = i + 2 + hashes;
            return b[from..].windows(close.len()).position(|w| w == close).map_or(b.len(), |p| from + p + close.len());
        }
    }
    if b[i] == b'"' {
        let mut j = i + 1;
        while j < b.len() && b[j] != b'"' {
            j += if b[j] == b'\\' { 2 } else { 1 };
        }
        return j + 1;
    }
    if b[i] == b'\'' {
        let len = if b.get(i + 1) == Some(&b'\\') {
            b[i + 2..].iter().position(|&c| c == b'\'').map(|p| p + 2)
        } else {
            None
        };
        let end = len.unwrap_or(2);
        if b.get(i + end) == Some(&b'\'') {
            return i + end + 1;
        }
    }
    i + 1
}

/// The end of the item that starts at `i`: its `;`, or the brace that closes its body.
fn item_end(b: &[u8], mut i: usize) -> usize {
    let mut depth = 0;
    while i < b.len() {
        match b[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return i + 1;
                }
            }
            b';' if depth == 0 => return i + 1,
            b'"' | b'\'' | b'r' => {
                i = past_literal(b, i);
                continue;
            }
            _ => {}
        }
        i += 1;
    }
    b.len()
}

/// The file without comment lines and without the items only tests compile.
fn production(text: &str) -> String {
    let code: String = text.lines().filter(|l| !l.trim_start().starts_with("//")).collect::<Vec<_>>().join("\n");
    let mut kept = String::new();
    let mut rest = code.as_str();
    while let Some(at) = ["#[cfg(test)]", "#[cfg(all(test,"].iter().filter_map(|a| rest.find(a)).min() {
        kept.push_str(&rest[..at]);
        rest = &rest[at + item_end(&rest.as_bytes()[at..], 0)..];
    }
    kept.push_str(rest);
    kept
}

/// Modules `lib.rs` compiles only for tests.
fn test_modules(root: &Path) -> Vec<String> {
    let lib = fs::read_to_string(root.join("lib.rs")).unwrap();
    let lines: Vec<&str> = lib.lines().collect();
    lines
        .windows(2)
        .filter(|w| w[0].trim() == "#[cfg(test)]")
        .filter_map(|w| w[1].trim().strip_prefix("mod ")?.strip_suffix(';').map(|m| format!("{m}.rs")))
        .collect()
}

fn using(pattern: &str, allowed: &[&str]) -> Vec<String> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let tests = test_modules(&root);
    let mut found: Vec<String> = sources(&root)
        .into_iter()
        .map(|p| p.strip_prefix(&root).unwrap().to_string_lossy().replace('\\', "/"))
        .filter(|f| !allowed.contains(&f.as_str()) && !tests.contains(f))
        .filter(|f| production(&fs::read_to_string(root.join(f)).unwrap()).contains(pattern))
        .collect();
    found.sort();
    found
}

#[test]
fn production_strips_comments_and_test_items_only() {
    let text = "fn a() { \"unknown command\" }\n/// unknown option\n#[cfg(test)]\nmod tests {\n    let c = '{';\n    \
                fn b() { r#\"}\"# }\n}\nfn c() {}\n#[cfg(test)]\nuse x;\nfn d() {}";
    let kept = production(text);
    assert!(kept.contains("unknown command") && kept.contains("fn c()") && kept.contains("fn d()"), "{kept}");
    assert!(!kept.contains("unknown option") && !kept.contains("fn b()") && !kept.contains("use x"), "{kept}");
}

#[test]
fn commanders_refusals_are_read_only_in_memo_cli() {
    for words in ["unknown command", "unknown option", "too many arguments"] {
        assert_eq!(using(words, &["memo_cli.rs"]), Vec::<String>::new(), "{words}: use memo_cli's helpers");
    }
}

#[test]
fn an_installed_version_is_compared_with_a_minimum_only_through_tools_older() {
    let reasons = [
        ("tools.rs", "`older` itself"),
        ("skills.rs", "a skill copy's stamp: an unreadable one is somebody's own, not older"),
        ("system.rs", "Node's supported range, not one minimum"),
        ("node.rs", "picks the newest Node release"),
        ("paths.rs", "picks the newest installed Node"),
        ("install.rs", "picks the newer of two npm answers"),
        ("tailscale_install.rs", "picks the newest package"),
        ("preflight.rs", "resolves an npm range"),
        ("own_tools.rs", "checks only that npm's answer is a version"),
        ("own_risks.rs", "a package.json range, below 1.0.0"),
    ];
    let allowed: Vec<&str> = reasons.iter().map(|(f, _)| *f).collect();
    assert_eq!(using("semver::", &allowed), Vec::<String>::new());
}
