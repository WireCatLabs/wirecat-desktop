# Community CLIs in the desktop app

Status: **built, not live**. The app fetches and checks the signed list; cli-docs builds and signs it on deploy
(`scripts/desktop-registry.ts`, `.github/workflows/deploy.yml`). It goes live when the owner has run cli-docs'
`bin/registry-key` and pasted the public key it prints into [`src-tauri/registry-key.pub`](../../src-tauri/registry-key.pub).
Until then the app fetches nothing. Decided 2026-11-05: the list lives in cli-docs `tools.json` (NEED-2204 A) and is
signed in CI with a key the owner holds (NEED-2205 A).

## What exists today (2026-11-05)

- **The website's list.** `tools.json` in [cli-docs](https://github.com/WireCatLabs/cli-docs/blob/main/tools.json)
  lists every tool on wirecat.dev. A tool from outside WireCatLabs joins it by a pull request with
  `"community": true`, reviewed against
  [REVIEWING.md, "Community tools"](https://github.com/WireCatLabs/cli-docs/blob/main/docs/REVIEWING.md#community-tools):
  the New CLI checklist is green on the tagged commit, a fresh-agent audit passed, every command names its profile,
  and nothing uses the `@wirecat` scope or the name WireCat. `scripts/sync.ts` (`toolProblems`) rejects a community
  entry with a `@wirecat/` package or a `WireCatLabs/` repository. No community entry is listed yet.
- **That list is not a registry the app can use.** It is compiled into the site, not served as a file; it is not
  signed; and it holds only what the site needs (name, repository, package, summary, docs tag). The app needs the
  whole catalog entry: the binary, doctor and setup words, data folders, sign-in.
- **cli-core** keeps its own hard-coded list, `WIRECAT_TOOLS` in `src/cli/help/first-screen.ts`, for the "Works with"
  lines of a tool's first screen (`chore/register-mail-cli` adds mail to it). Community tools never join it.
- **The desktop** compiles `catalog/tools.json` in (rule 7).

## What the app does now

`src-tauri/src/community.rs` adds community tools to the compiled catalog once, at start, from one of two sources:

- **The signed list**, while Settings → Advanced → "Show community tools" is on (`<app data>/community-tools.json`,
  off by default). `registry.rs` reads the copy kept in `<app data>/registry/`, checks its signature and expiry again,
  and hands its entries over. Without a good copy the app has its built-in tools only.
- **A local file**, for development: `<app data>/extra-tools.json` while the environment has `WIRECAT_EXTRA_TOOLS=1`,
  shaped `{ "version": 1, "tools": [...] }`. The flag wins over the setting.

The switch is off by default because no community tool has been reviewed yet, and turning it on is the owner's own
choice to trust a review that checks how a tool is built and released, not what it does. A change takes effect at the
next start; the page says so and offers Restart now.

An entry is a `catalog/tools.json` entry with `"community": true`. Every key a built-in entry has must be there
(`null` when unused): Rust tolerates a missing one, the interface does not, and an entry the interface refuses is not
shown. `src/platform/mock-community.ts` holds a full example.

Rust accepts an entry only when:

1. Every string inside any array is a plain word: letters, digits, `._:=,/+@-`, at most two leading dashes, `--`
   alone, and `{name}` slots. No spaces, quotes, `$`, `;`, `|`, `&`, backticks, globs, `~` or newlines. The arrays are
   command words run without a shell, except `setup`, which `terminal.rs` joins into one shell line; a word check on
   every array also covers fields added later.
2. The id is 2 to 16 lowercase letters; the id, binary, package and data folder (`storage.app`, `storage.env`) are
   not used by a built-in tool, the shared store (`WireCat`, `WIRECAT`) or an earlier entry. `storage.rs` deletes a
   tool's folders by those names, so a community tool can never point it at ours.
3. The package is `@scope/name` outside `@wirecat`; the repository is `https://github.com/<owner>/<name>` outside
   WireCatLabs; every link is `https`.
4. It sets none of `partOf`, `commandPrefix`, `memory`, `taskBoard`, `bot`, `storeReset`, `storeResetPreview`,
   `configRepair` or `signIn.command` (a command line shown for the owner to copy).
5. The file is at most 512 KB and the first 32 entries are read.

Each refusal is a sentence the interface writes to its console. The interface parses the accepted entries again
(`addCommunityTools` in `src/domain/catalog.ts`) before any page module loads, because pages build some lists when
their module loads. A community tool shows a **Community** badge on the Tools page and on Choose tools, and, until it
is installed, the note "Made by `<owner>`, not by WireCat. The app checks where npm built it, not what it does."
Its icon is a generic package (`ToolIcon.tsx`).

Install is unchanged: `provenance.rs` refuses a release that npm's Sigstore attestation does not tie to the entry's
own repository's `release.yml` on `main`. So a community tool must publish with npm trusted publishing, as ours do.

## The security model

- **Installing a package runs its code.** No check here makes a third-party CLI safe; the review in cli-docs and the
  owner's own trust do. The badge and the note say so before the install.
- **What the app guarantees:** a registry entry cannot make the app run anything but the entry's own binary with
  plain words; cannot reach a shell line with shell syntax; cannot take a name, package or data folder of ours, so
  nothing of ours is updated, uninstalled or deleted on its behalf; and its npm release must be built by the
  repository the entry names.
- **What it does not guarantee:** what the binary does once it runs, or that the repository's owner is who they say.

## The registry

1. **Source.** The community entries stay in cli-docs `tools.json`; each gets a `desktop` object holding the catalog
   keys the site does not already have (`tagline`, `bin`, the command words, `storage`…). The list fills `id`, `name`,
   `package`, `repo`, `summary` and `docs` from the entry itself. One pull request lists the tool on the site and in
   the app, reviewed once. cli-docs' tests run the same rules as `community.rs` (`desktopProblems`,
   `registryProblems`), so a bad entry fails the pull request; the app checks again anyway.
2. **Publishing.** Every deploy of cli-docs (each merge to `main`, and daily) builds
   `https://wirecat.dev/registry/v1/desktop-tools.json`, signs it with minisign in a job of the `production`
   environment that holds only the signing key, and serves the signature beside it as `desktop-tools.json.minisig`.
   The file is `{ "format": 1, "version": <build time in seconds>, "generated_at", "expires_at": <30 days on>,
   "tools": [...] }`. The daily deploy keeps it fresh; a deploy that stops lets it expire.
3. **The app.** `registry.rs` fetches the fixed URL at start and then at most once a day, only while the switch is on
   and the build has a real key (HTTPS only, no redirects, 512 KB cap). It keeps the new copy only when the signature
   verifies against `registry-key.pub` (a key of its own, never the updater's), the version is not lower than the
   copy kept (no rollback to an older list, even after that copy expired) and it has not expired. A copy that fails
   leaves the kept one; no good copy leaves the built-in catalog. The same `community.rs` rules then apply to every
   entry. A new list takes effect at the next start, so a page never changes under the owner.
4. **Removal.** A tool pulled from the list stops being offered. An installed copy stays installed and is listed as
   "No longer listed", with Uninstall; the app never removes it on its own.
5. **Icons.** No code from the registry. Either the generic package icon (today), or an optional `icon` holding one
   SVG path (`d`), checked in Rust to contain only path commands and numbers, at most 2 KB, drawn in the app's own
   colour on a 24 x 24 box.

## Open decisions

- Whether a signed list needs a second maintainer's approval (today: the pull request review and the `production`
  environment's rules).
- Whether community tools may use the store commands (backup, reset), `bot` or the Memory and Tasks pages later.
- Removal (point 4) and icons (point 5) are not built yet.
