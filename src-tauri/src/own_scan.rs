//! What an own tool's JavaScript says about the network, read as text out of its npm tarball: modules that open
//! connections, global `fetch` and `WebSocket`, and the hosts its URLs name. Nothing runs. A bundler copies
//! cli-base, cli-core and their libraries into the package and marks each copied module with a `// node_modules/...`
//! comment; only the tool's own code is read, because those libraries name hundreds of documentation hosts and use
//! `fetch` for their own reasons. Comments are read like code: a comment remover can be fooled by a string or a regular
//! expression into hiding a real call, and the tool's own code names few documentation pages. The marker is the
//! author's text, so a finding means "found in the code", and no finding proves nothing.

use regex::Regex;
use std::collections::BTreeSet;
use std::sync::LazyLock;

const NETWORK: [&str; 15] = [
    "http",
    "https",
    "http2",
    "net",
    "tls",
    "dgram",
    "undici",
    "axios",
    "got",
    "node-fetch",
    "cross-fetch",
    "ky",
    "superagent",
    "request",
    "ws",
];
/// A bound on memory for the undeclared hosts only: declared ones are left out as they are found, so they never use it.
const MAX_HOSTS: usize = 2000;
const MAX_NATIVE: usize = 20;

/// Hosts that cannot be a server the tool talks to: reserved names (RFC 2606, RFC 6761) and XML or schema
/// namespaces, which libraries write as URLs without ever opening them.
const NOT_SERVERS: [&str; 9] = [
    "example.com",
    "example.net",
    "example.org",
    "localhost",
    "w3.org",
    "json-schema.org",
    "purl.org",
    "schemas.openxmlformats.org",
    "schemas.microsoft.com",
];
const RESERVED_TLDS: [&str; 4] = ["example", "test", "invalid", "localhost"];

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Code {
    /// Network modules imported or required, `node:` dropped: `https`, `axios`.
    pub modules: BTreeSet<String>,
    /// Hosts named in `http(s)://` and `ws(s)://` URLs, lower case.
    pub hosts: BTreeSet<String>,
    pub fetch: bool,
    pub websocket: bool,
    /// `child_process`: it can start other programs, which can reach the network themselves.
    pub programs: bool,
    /// `.node` and `.wasm` files: native code this scan cannot read.
    pub native: BTreeSet<String>,
    /// The `@wirecat` packages a bundler copied in, with the version its path names when it names one.
    pub bundled: std::collections::BTreeMap<String, Option<String>>,
    /// Ways of hiding a call from a reader: `escaped name`, `computed global`, `process binding`.
    pub hidden: BTreeSet<String>,
    /// Declared hosts and the repository's, as cli-base writes them (`*.x` for the names under x).
    allowed: Vec<String>,
    /// The last part of every path the code imports or requires (`./notes.md` → `notes.md`).
    named: BTreeSet<String>,
    /// Files the code loads that are not JavaScript by their name: Node.js runs them as code all the same.
    pub foreign: BTreeSet<String>,
}

/// What Node.js loads as a module by its extension; a `require` of anything else still runs it as JavaScript.
pub fn is_module(path: &str) -> bool {
    [".js", ".mjs", ".cjs", ".json", ".node"].iter().any(|ext| path.ends_with(ext))
}

pub fn is_script(path: &str) -> bool {
    [".js", ".mjs", ".cjs"].iter().any(|ext| path.ends_with(ext))
}

const MAX_NAMED: usize = 10_000;

impl Code {
    /// Whether scanned code imports or requires a file with this path's name.
    pub fn names(&self, path: &str) -> bool {
        self.named.contains(path.rsplit('/').next().unwrap_or(path))
    }
}

/// As cli-base's `hostCovered`: `*.x` covers the names under x, not x itself.
pub fn covered(host: &str, allowed: &[String]) -> bool {
    allowed.iter().any(|d| {
        let d = d.to_ascii_lowercase();
        d.strip_prefix('*').map_or(host == d, |suffix| host.ends_with(suffix))
    })
}

impl Code {
    pub fn allowing(allowed: &[String]) -> Self {
        Self { allowed: allowed.to_vec(), ..Self::default() }
    }

    pub fn touches_network(&self) -> bool {
        !self.modules.is_empty() || self.fetch || self.websocket
    }
}

static SECTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^// ((?:\.\./)*\S+\.(?:[cm]?[jt]sx?|json))\s*$").expect("a valid pattern"));
static SPECIFIER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?:\bfrom|\bimport|\brequire)\s*\(?\s*["']([^"'\s]{1,200})["']"#).expect("a valid pattern")
});
static FETCH: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|[^.\w$])fetch\s*\(|globalThis\.fetch\s*\(").expect("a valid pattern"));
static WEBSOCKET: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\bnew\s+WebSocket\s*\(").expect("a valid pattern"));
/// `f\u0065tch(`: an escape inside a name that is then called, which reads as nothing to a search for `fetch`.
static ESCAPED_CALL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[A-Za-z_$]?\\u(?:[0-9A-Fa-f]{4}|\{[0-9A-Fa-f]{1,6}\})(?:[\w$]|\\u(?:[0-9A-Fa-f]{4}|\{[0-9A-Fa-f]{1,6}\}))*\s*\(")
        .expect("a valid pattern")
});
static GLOBAL_KEY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:globalThis|global|window|self)\s*\[([^\]]{0,200})\]").expect("a valid pattern"));
static PLAIN_KEY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"^\s*(?:"[\w$]*"|'[\w$]*')\s*$"#).expect("a valid pattern"));
static BINDING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bprocess\s*\.\s*(?:binding|_linkedBinding)\s*\(").expect("a valid pattern"));
static URL_HOST: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:https?|wss?)://([A-Za-z0-9][A-Za-z0-9.-]{0,252})").expect("a valid pattern"));

pub fn is_native(path: &str) -> bool {
    [".node", ".wasm"].iter().any(|ext| path.ends_with(ext))
}

impl Code {
    pub fn add_native(&mut self, path: &str) {
        if self.native.len() < MAX_NATIVE {
            self.native.insert(path.to_string());
        }
    }
}

static BUNDLED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"node_modules/@wirecat/(cli-base|cli-core)/").expect("a valid pattern"));
/// pnpm's folder names the version: `.pnpm/@wirecat+cli-core@0.605.0_…/node_modules/@wirecat/cli-core/`.
static PNPM_VERSION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@wirecat\+(cli-base|cli-core)@(\d+\.\d+\.\d+)").expect("a valid pattern"));

fn note_bundled(path: &str, code: &mut Code) {
    let Some(m) = BUNDLED.captures(path) else { return };
    let version = PNPM_VERSION.captures_iter(path).find(|v| v[1] == m[1]).map(|v| v[2].to_string());
    let known = code.bundled.entry(format!("@wirecat/{}", &m[1])).or_insert(None);
    if known.is_none() {
        *known = version;
    }
}

/// Adds what one file says to `code`, leaving out the sections the bundler marks as copied libraries.
pub fn scan(text: &str, code: &mut Code) {
    let mut start = 0;
    let mut ours = false;
    for marker in SECTION.captures_iter(text) {
        let whole = marker.get(0).expect("a match");
        if !ours {
            scan_section(&text[start..whole.start()], code);
        }
        ours = marker[1].contains("node_modules/");
        note_bundled(&marker[1], code);
        start = whole.end();
    }
    if !ours {
        scan_section(&text[start..], code);
    }
}

/// A file no script loads: every code signal, but no hosts, which there are links in a licence or bytes in an image.
pub fn scan_doc(text: &str, code: &mut Code) {
    scan_with(text, code, false);
}

fn scan_section(text: &str, code: &mut Code) {
    scan_with(text, code, true);
}

fn scan_with(text: &str, code: &mut Code, hosts: bool) {
    for m in SPECIFIER.captures_iter(text) {
        if code.named.len() < MAX_NAMED
            && let Some(last) = m[1].rsplit('/').next()
        {
            code.named.insert(last.to_string());
        }
        let root = root(&m[1]);
        if NETWORK.contains(&root) {
            code.modules.insert(root.to_string());
        } else if root == "child_process" {
            code.programs = true;
        }
    }
    if ESCAPED_CALL.is_match(text) {
        code.hidden.insert("escaped name".into());
    }
    if GLOBAL_KEY.captures_iter(text).any(|m| !PLAIN_KEY.is_match(&m[1])) {
        code.hidden.insert("computed global".into());
    }
    if BINDING.is_match(text) {
        code.hidden.insert("process binding".into());
    }
    code.fetch |= FETCH.is_match(text);
    code.websocket |= WEBSOCKET.is_match(text);
    if !hosts {
        return;
    }
    for m in URL_HOST.captures_iter(text) {
        if let Some(host) = server(&m[1])
            && !covered(&host, &code.allowed)
            && code.hosts.len() < MAX_HOSTS
        {
            code.hosts.insert(host);
        }
    }
}

/// `node:https` → `https`, `axios/lib/x` → `axios`, `@scope/pkg/x` → `@scope/pkg`.
fn root(specifier: &str) -> &str {
    let s = specifier.strip_prefix("node:").unwrap_or(specifier);
    let end = if s.starts_with('@') { s.match_indices('/').nth(1) } else { s.match_indices('/').next() };
    end.map_or(s, |(i, _)| &s[..i])
}

fn server(raw: &str) -> Option<String> {
    let host = raw.trim_end_matches(['.', '-']).to_ascii_lowercase();
    let last = host.rsplit('.').next()?;
    if !host.contains('.') && host != "localhost" {
        return None;
    }
    let ip = last.bytes().all(|b| b.is_ascii_digit());
    if ip && (host.starts_with("127.") || host == "0.0.0.0") {
        return None;
    }
    if !ip && (last.len() < 2 || !last.bytes().all(|b| b.is_ascii_alphabetic())) {
        return None;
    }
    let under = |base: &str| host == base || host.ends_with(&format!(".{base}"));
    if NOT_SERVERS.iter().any(|n| under(n)) || RESERVED_TLDS.contains(&last) {
        return None;
    }
    Some(host)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn of(text: &str) -> Code {
        let mut code = Code::default();
        scan(text, &mut code);
        code
    }

    #[test]
    fn network_modules_fetch_and_hosts_in_the_tools_own_code_are_found() {
        let code = of(r#"import { request } from "node:https";
const ax = require("axios/lib/core");
import("ws").then(() => {});
const r = await fetch("https://api.acme.io/v1/contacts");
const s = new WebSocket("wss://stream.acme.io");
import { spawn } from "child_process";
"#);
        assert_eq!(code.modules.iter().map(String::as_str).collect::<Vec<_>>(), ["axios", "https", "ws"]);
        assert!(code.fetch && code.websocket && code.programs);
        assert_eq!(code.hosts.iter().map(String::as_str).collect::<Vec<_>>(), ["api.acme.io", "stream.acme.io"]);
    }

    #[test]
    fn sections_the_bundler_marks_as_copied_libraries_are_skipped() {
        let text = r#"import { createRequire } from "node:module";

// node_modules/.pnpm/@wirecat+cli-core@0.605.0_x/node_modules/@wirecat/cli-core/dist/http/listen.js
import { createServer } from "node:http";
const u = "https://api.anthropic.com";

// dist/acme/transport.js
import { connect } from "node:tls";
const base = "https://acme-crm.example.invalid/v1/";

// node_modules/.pnpm/@anthropic-ai+sdk@1.0.0/node_modules/@anthropic-ai/sdk/client.js
await fetch(url);
"#;
        let code = of(text);
        assert_eq!(code.modules.iter().map(String::as_str).collect::<Vec<_>>(), ["tls"]);
        assert!(!code.fetch, "the fetch is in a library's section");
        assert!(code.hosts.is_empty(), "cli-core's host is skipped and a .invalid one is no server");
    }

    #[test]
    fn method_calls_named_fetch_and_reserved_or_namespace_hosts_are_not_reported() {
        let code = of(r#"client.fetch(x); this.fetch(y); const ns = "http://www.w3.org/2000/svg";
const a = "https://example.com/x"; const b = "http://localhost:8080"; const c = "https://api.test";
const d = "http://127.0.0.1:9"; const e = "https://203.0.113.9/up";"#);
        assert!(!code.fetch);
        assert_eq!(code.hosts.iter().map(String::as_str).collect::<Vec<_>>(), ["203.0.113.9"]);
    }

    #[test]
    fn a_call_after_a_comment_on_the_same_line_is_found() {
        let code = of(r#"/*! MIT */ fetch("https://evil.io/x")"#);
        assert!(code.fetch);
        assert_eq!(code.hosts.iter().map(String::as_str).collect::<Vec<_>>(), ["evil.io"]);
        let code = of("// a comment\n * a doc line */ new WebSocket(\"wss://ws.evil.io\")");
        assert!(code.websocket && code.hosts.contains("ws.evil.io"));
    }

    #[test]
    fn hosts_are_kept_well_past_what_the_review_shows() {
        let mut text: String = (0..25).map(|i| format!("\"https://h{i}.acme.io\"; ")).collect::<Vec<_>>().concat();
        text.push_str("\"https://collector.evil.io\"");
        assert!(of(&text).hosts.contains("collector.evil.io"));
    }

    #[test]
    fn two_thousand_declared_hosts_cannot_hide_an_undeclared_one() {
        let mut text: String = (0..2000).map(|i| format!("\"https://h{i}.acme.io\"; ")).collect::<Vec<_>>().concat();
        text.push_str("\"https://collector.evil.io\"");
        let mut code = Code::allowing(&["*.acme.io".to_string()]);
        scan(&text, &mut code);
        assert_eq!(code.hosts.iter().map(String::as_str).collect::<Vec<_>>(), ["collector.evil.io"]);
    }

    #[test]
    fn escaped_names_computed_globals_and_process_bindings_are_found() {
        assert_eq!(of(r#"f\u0065tch("x")"#).hidden.iter().map(String::as_str).collect::<Vec<_>>(), ["escaped name"]);
        assert!(of(r"\u{66}etch(1)").hidden.contains("escaped name"));
        assert!(of(r#"globalThis["fe"+"tch"]("x")"#).hidden.contains("computed global"));
        assert!(of("window[k](1)").hidden.contains("computed global"));
        assert!(of(r#"process.binding("tcp_wrap")"#).hidden.contains("process binding"));
        assert!(of(r#"process._linkedBinding("x")"#).hidden.contains("process binding"));
        let plain = of(r#"globalThis["fetch"]; const s = "caf\u00e9"; window['x'] = 1"#);
        assert!(plain.hidden.is_empty(), "{:?}", plain.hidden);
    }

    #[test]
    fn bundled_cli_core_and_its_version_are_noted() {
        let code = of(
            "// node_modules/.pnpm/@wirecat+cli-core@0.605.0_@wirecat+cli-base@0.82.0_x/node_modules/@wirecat/cli-core/dist/a.js\nx\n",
        );
        assert_eq!(code.bundled.get("@wirecat/cli-core"), Some(&Some("0.605.0".to_string())));
        let code = of("// node_modules/@wirecat/cli-core/dist/a.js\nx\n");
        assert_eq!(code.bundled.get("@wirecat/cli-core"), Some(&None));
    }
}
