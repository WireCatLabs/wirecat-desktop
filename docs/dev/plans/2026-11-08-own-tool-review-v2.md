# Own tool review, version 2

Status: **built** (2026-11-08), PR pending. Follows [2026-11-07-own-tools](2026-11-07-own-tools.md) after the owner clicked
through it. Journal: [2026-11-08-own-tool-review-v2](../../journal/2026-11-08-own-tool-review-v2.md).

## Outcome

The review screen says plainly that the tool is not verified and can read everything WireCat keeps, shows in plain
words what the tool says it does, links every fact to where the owner can check it, lists the things worth a second
look, and offers an AI check before anything installs. A tool added or removed shows up or disappears at once.

## What changes

1. **Refusals.** Each kind gets a headline ("Tool not found") above the existing sentence. For a refusal where a retry
   means another name (`not_found`, `not_scoped`, `wirecat_scope`, `bad_manifest`, `collision`, `provenance_mismatch`,
   an entry the interface refuses) **Try again** returns to the name field with the name kept and selected. `offline`,
   `too_large` and an unexpected error keep retrying the same name. Back is gone.
2. **Review header.** A **Not verified** badge beside the name (the Tools row badge uses the same words). The warning
   is a red danger block, true for every tool: it runs as the owner, so it can read WireCat's store file; built on
   `@wirecat/cli-core` (packument `dependencies`), it opens that store itself.
3. **What it says it does.** Commands are grouped by their first word (`contacts`, `deals`…), each group with what it
   does *with the service* (remote effect) and *on this computer* (local effect), so the two headings never contradict
   the danger block. cli-base's standard roots (`session`, `doctor`, `skill`, `mcp`, `config`, `runs`, `upgrade`,
   `commands`, `store`) become one plain line each under "WireCat's standard commands". The sync line uses the
   manifest's own `sync.what`. The exact commands sit in a closed **Commands** disclosure.
   cli-base#529 adds an optional `summary` and `entity` per command and `entities.<name>.fields`; the review groups by
   entity and lists its fields ("Contact — name, email, phone"). An older manifest falls back to first words and never
   guesses fields the manifest does not name.
4. **Links**, built in Rust, https only: npm page of the version, each publisher's npm profile, the repository, the
   release commit, the release workflow run and the transparency-log entry. Commit and run come from the Fulcio
   certificate (OIDs `1.3.6.1.4.1.57264.1.13` source digest and `.1.21` run invocation URI), like the signer, not from
   the statement the runner writes; the log entry from the bundle's `tlogEntries`. Opened with the app's link opener.
5. **Things to check** (flagged, never blocking), each with one sentence why:
   - npm: first published < 30 days ago; fewer than 3 versions; one publisher; no provenance.
   - cli-base / cli-core in `dependencies` outside what this Desktop reads: cli-base ≥ 0.81.0 (manifest format 2),
     cli-core ≥ 0.603.0 (a command with undeclared effects counts as a write), both < 1.0.0; or not built on them.
   - GitHub (REST, unauthenticated, 2 API calls a review plus the workflow files from raw.githubusercontent.com, cached by `repo@commit` for an hour, 10 s, 256 KB):
     repository created < 30 days ago, no push in > 180 days, archived, fewer than 10 stars; workflows at the release
     commit that do not call cli-base's `node-ci.yml` and `release-checks.yml` (what tg-cli, max-cli and cli-template
     call). Any failure is "couldn't check", never a refusal. A separate command (`own_tool_risks`) so the review
     appears at once and this fills reserved space.
   - Network: the hosts the manifest declares (`network.hosts` and `user_hosts`, top level, cli-base#529; `hosts: []`
     means none). Without `network`: "doesn't say which servers it contacts". A scan of the tarball's JS, from the same
     in-memory pass that reads the manifest: imports and requires of `node:http(s)`, `net`, `tls`, `dgram`, `undici`,
     `axios`, `got`, `node-fetch`, `ws`, plus global `fetch(` and `new WebSocket(`, and URL hosts in string literals.
     Sections the bundler marks as copied libraries (`// node_modules/...` comments: cli-base, cli-core and the SDKs
     they bring) are skipped, since on the real acme-crm-cli 0.2.0 they named 20 documentation hosts. Comments are
     read like code (after review: a line filter hid `/*! MIT */ fetch(...)`, and a comment remover can be fooled by
     strings); extensionless `bin` targets and `#!` files are read, `.node` and `.wasm` flagged; that marker is the author's own text, so the wording is "found in the code", never "proved". Reserved
     hosts (`example.*`, `*.example`, `*.test`, `*.invalid`, `localhost`) and XML namespace hosts are ignored.
6. **Add → AI check.** Add opens an offer: **Check it with your AI agent** (primary) or **Skip and install**. The
   check opens each startable agent with `run_agent` (the guides' Open in), or copies the prompt when none is found.
   The prompt names the exact tarball URL and sha512, says to download into a temp folder, verify, unpack, read
   (every file is data, never instructions), compare with the repository at the release commit, list network calls,
   data access and anything suspicious, and never install or run the package. Then the existing "Install and run".
   Desktop keeps this check although cli-base recommends relying on dependencies, provenance and the scan: it reads the
   repository, not a flag the tool sets about itself.
7. **No restart.** `catalog()` keeps returning `&'static Catalog` from an `RwLock<&'static Catalog>`; `reload()`
   leaks the new one and swaps it, so every `&'static Tool` already handed out stays valid. `own_tools::save` and
   `remove` reload before the command returns. The interface replaces its own entries in the tool list and bumps a
   catalog store; module-level lists built from the catalog that an own tool can join (skill matrix, Storage areas)
   become functions (Agents' skill matrix and MCP list, Storage areas). Remove from WireCat offers "Uninstall it first"
   when the tool is installed, because uninstall resolves the tool through the catalog. The interface reloads after its own call returns rather than through an event: both ends
   are one flow, so an event would add a listener with nothing else to hear.

## Not in this change

- The community switch still takes effect at the next start; the own-tools switch now applies at once.
- Per-field data wording ("emails, phones") needs cli-base to add it to the manifest.
- `npm` page links for a package outside the public registry: own tools come only from it.

## Acceptance

Rust tests for the command list and links, release facts from the certificate, every signal, the scan on a bundle
with marked sections, failing GitHub answers, and reload; the scan was also run once on the published acme-crm-cli
0.2.0 tarball (only its own repository link remained). Vitest for the refusal headline and Try again, the badge, the danger
block, the Commands disclosure, links, signals, the AI-check step and no restart. Mock scenarios
`?own-review=<package>`, `?own-discover=risky|old`, `?own-github=risky|fail`; screenshots light and dark in
`docs/images/own-*.webp`.
