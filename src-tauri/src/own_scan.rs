//! What an own tool's JavaScript says about the network, read as text out of its npm tarball: modules that open
//! connections, global `fetch` and `WebSocket`, and the hosts its URLs name. Nothing runs. A bundler copies
//! cli-base, cli-core and their libraries into the package and marks each copied module with a `// node_modules/...`
//! comment; only the tool's own code is read, because those libraries name hundreds of documentation hosts and use
//! `fetch` for their own reasons. The marker is the author's text, so a finding means "found in the code", and no
//! finding proves nothing.

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
const MAX_HOSTS: usize = 20;

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
}

impl Code {
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
static URL_HOST: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:https?|wss?)://([A-Za-z0-9][A-Za-z0-9.-]{0,252})").expect("a valid pattern"));

pub fn is_code(path: &str) -> bool {
    [".js", ".mjs", ".cjs"].iter().any(|ext| path.ends_with(ext))
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
        start = whole.end();
    }
    if !ours {
        scan_section(&text[start..], code);
    }
}

fn scan_section(text: &str, code: &mut Code) {
    // Comment lines name documentation pages, not servers; code after a comment on the same line is still read.
    let text: String = text
        .lines()
        .filter(|l| {
            let t = l.trim_start();
            !(t.starts_with("//") || t.starts_with("/*") || t.starts_with('*'))
        })
        .collect::<Vec<_>>()
        .join("\n");
    let text = text.as_str();
    for m in SPECIFIER.captures_iter(text) {
        let root = root(&m[1]);
        if NETWORK.contains(&root) {
            code.modules.insert(root.to_string());
        } else if root == "child_process" {
            code.programs = true;
        }
    }
    code.fetch |= FETCH.is_match(text);
    code.websocket |= WEBSOCKET.is_match(text);
    for m in URL_HOST.captures_iter(text) {
        if code.hosts.len() >= MAX_HOSTS {
            break;
        }
        if let Some(host) = server(&m[1]) {
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
    fn comments_method_calls_named_fetch_and_reserved_or_namespace_hosts_are_not_reported() {
        let code = of(r#"client.fetch(x); this.fetch(y); const ns = "http://www.w3.org/2000/svg";
const a = "https://example.com/x"; const b = "http://localhost:8080"; const c = "https://api.test";
const d = "http://127.0.0.1:9"; const e = "https://203.0.113.9/up";
/** See https://developer.mozilla.org/docs for the fetch( API.
 * https://docs.example.org */
// https://github.com/acme/crm"#);
        assert!(!code.fetch);
        assert_eq!(code.hosts.iter().map(String::as_str).collect::<Vec<_>>(), ["203.0.113.9"]);
    }

    #[test]
    fn only_javascript_files_are_read() {
        assert!(is_code("package/dist/a.js") && is_code("package/x.mjs") && is_code("package/x.cjs"));
        assert!(!is_code("package/dist/a.js.map") && !is_code("package/dist/a.d.ts"));
    }
}
