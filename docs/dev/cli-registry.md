# Community CLIs in the desktop app

Status: **built, keyed**. cli-docs builds and signs the list on every deploy and serves it at
`https://wirecat.dev/registry/v1/desktop-tools.json`. The same public key is in cli-docs `registry/minisign.pub` and in
[`src-tauri/registry-key.pub`](../../src-tauri/registry-key.pub), so a build fetches and checks the list while the
switch is on. No community tool is listed yet. Decided 2026-11-05: the list lives in cli-docs `tools.json`
(NEED-2204 A) and is signed in CI with a key the owner holds (NEED-2205 A). Your own tools, added from the app by their
npm name without a review, are built ([below](#your-own-tools-not-checked); [plan](plans/2026-11-07-own-tools.md)).

## Process at a glance

WireCat tools hold personal data, so a listing is not open submission: only approved publishers list tools, and a
human approves each one last. What is built and what is planned is marked.

1. **The maker is an approved publisher** (an application or an invitation). Planned. The admission rule is an open
   decision.
2. **The maker builds the tool** from cli-template, or to the
   [New CLI standard](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md#done-when), in a
   public repository, and releases it with npm trusted publishing from its own `release.yml` on `main`. Built. Planned:
   the publish step runs inside a pinned WireCatLabs reusable workflow that runs our standards checks first, so the
   npm provenance proves our checks passed (see the cli-docs guide).
3. **The maker opens a pull request** to cli-docs `tools.json` with `"community": true` and a `desktop` object. The
   public guide is [List your tool in WireCat](https://wirecat.dev/en/docs/build-list-tool).
4. **Automated checks on the pull request.** Built: cli-docs' tests run the same entry rules as `community.rs`.
   Planned: the provenance and build signer check, a re-run of the standards checks on the tagged source, a secret and
   malware scan of the npm tarball, and a fresh-agent audit run by CI.
5. **A maintainer approves it last**, against
   [REVIEWING.md, "Community tools"](https://github.com/WireCatLabs/cli-docs/blob/main/docs/REVIEWING.md#community-tools).
6. **The merge registers it.** The site lists it, and the next deploy signs a list that includes it.
7. **The app offers it** to an owner who turned on "Enable community tools", with a **Community** badge, and checks
   each release's npm provenance before install.
8. **Outside the list**, an owner can add any tool on their own computer, unchecked, from the Tools page
   ([Your own tools](#your-own-tools-not-checked)).

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

`src-tauri/src/community.rs` adds community tools to the compiled catalog once, at start, from two sources, in this
order and through one set of taken names:

- **The signed list**, while "Enable community tools" in Settings is on (`<app data>/community-tools.json`, off by
  default). `registry.rs` reads the copy kept in `<app data>/registry/`, checks its signature and expiry again,
  and hands its entries over. Without a good copy the app has its built-in tools only.
- **The owner's own tools**: `<app data>/extra-tools.json`, shaped `{ "version": 1, "tools": [...] }`, while "Allow
  tools WireCat has not checked" is on (`<app data>/own-tools.json`, off by default) or the environment has
  `WIRECAT_EXTRA_TOOLS=1` (for developers). The app writes the file (`own_tools.rs`); the flag no longer hides the
  signed list.

Each tool carries its source (official, community, own) to the interface, and the badge follows the source.

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

Each refusal is a sentence the interface writes to its console and Settings lists under the switch of its source. The interface parses the accepted entries again
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

## Your own tools (not checked)

Status: **built** (2026-11-07): `src-tauri/src/own_tools.rs` and `src/features/tools/OwnToolDialog.tsx`; the current
flow, refusal kinds and checks are in [the plan](plans/2026-11-07-own-tools.md). Owner's ruling 2026-11-06: anyone may
add any tool on their own computer, behind a clear warning that WireCat has not checked it. A private repository's
tool, which can never be listed, can only be added this way. The button is on the Tools page (NEED-2281 A); only scoped
npm packages (NEED-2280).

The entry comes from the tool's manifest `contracts/wirecat.json` (format 2), read out of the npm tarball before
anything is installed; `--wcat-describe` only confirms after install that the program names the same manifest. The
points below are the design that led there. Developers can still write entries into `<app data>/extra-tools.json` by
hand and start the app with `WIRECAT_EXTRA_TOOLS=1`.

**1. A switch in Settings.** "Allow tools WireCat has not checked", off by default, next to "Enable community tools".
Turning it on opens a warning that the owner must confirm before the switch turns on. Cancel leaves it off. Turning it
off hides the own tools at the next start, and installed ones stay installed, like the community switch.

**2. A button on the Agents page.** While the switch is on, the Agents page (`src/features/agents`, title "Agents")
shows **Add your own tool**. It opens a dialog that takes an npm package name and warns again, in plain words:

- "This tool gets access to all your personal data that WireCat holds: your messages, mail, notes and files."
- "Add it only if you trust its authors completely."
- "WireCat has not checked this tool and takes no responsibility for what it does."

Before anything is installed, the dialog reads npm only (no install, no script): the version, the repository the
package claims, and its provenance, which `provenance.rs` already reads without installing. It shows where npm built
the package, or "No record of where npm built it". Neither blocks.

**3. A second confirmation.** Pressing Add opens one more dialog, "Install `<package>`? It runs with your permissions.",
with Install and Cancel. Only Install installs.

**4. Then the app:**

1. Installs with the usual install path (`install.rs`). npm runs the package's install scripts, which is why both
   confirmations come first. `confirm_release` reports the provenance instead of refusing for an entry from this file.
2. Builds the catalog entry (below) and checks it with every `community.rs` rule: plain words, an id of 2 to 16
   lowercase letters, no id, program, package or data folder of ours or of an earlier entry, `https` links, none of the
   keys only WireCat's tools set, the size cap. One exception to rule 3: the repository may be missing or private, and
   then the app says that no provenance can be checked. A refused entry is not saved. The app shows the refusal
   sentences and offers Uninstall, since the package is already installed.
3. Saves the entry to `<app data>/extra-tools.json`. It survives restarts and updates and is never sent anywhere.
4. Takes effect at the next start, with Restart now, because pages build some lists when their module loads.

**How it looks.** A tool from this file carries the badge **Not checked** instead of **Community**, on the Tools page
and on Choose tools. The badge comes from the source, the file, not from a key in the entry, so a signed-list entry can
neither claim it nor drop it. Its row has **Remove from WireCat**, which deletes the entry and offers Uninstall.

**Where the entry comes from.** The app needs a whole catalog entry: the keys the `desktop` object of a cli-docs
`tools.json` entry has, plus `id`, `name`, `package`, `repo`, `summary` and `docs`.

- npm gives `package`, and `repo` from the package's `repository` field.
- `--wcat-describe` (cli-base `src/wcat/describe.ts`) gives `name`, `version`, `description` and `docs_url` today.
  That fills `id`, `name`, `summary` and `docs`.
- `commands --json` (cli-base `@wirecat/cli-base/commands`) gives the command tree. It says which commands exist, but
  not the words the app runs, the data folder (`storage`), the sign-in texts (`signIn`), `tagline` or the shape of the
  profile list.
- **So a self-description is needed.** It belongs in cli-base's `--wcat-describe`, as format 2 (`DESCRIBE_FORMAT`
  already promises that a later format adds keys and keeps the old ones). Its new key holds the same object as the
  cli-docs `desktop` object, nothing more. `wcatStart` takes it and cli-template fills it. Running it is the tool's
  first run, after both confirmations.
- Until a tool answers format 2, the dialog asks the owner to paste that `desktop` object, the same one the cli-docs
  guide shows, and checks it the same way.

**The signed list and the file together.** Today the flag wins and the two sources never mix. With this design the app
reads the signed list first (while "Enable community tools" is on) and then the file (while "Allow tools WireCat has
not checked" is on, or the flag is set). An own entry whose id, package or data folder a listed entry already uses is
refused as "an earlier entry", with the sentence "This tool is now listed. Remove your own entry to use the listed
one."

**What this does not change.** No `community.rs` rule is relaxed for the signed list, `provenance.rs` still refuses
for listed tools, and nothing the owner adds reaches another computer.

## Open decisions

- Whether a signed list needs a second maintainer's approval (today: the pull request review and the `production`
  environment's rules).
- Whether community tools may use the store commands (backup, reset), `bot` or the Memory and Tasks pages later.
- Removal (point 4) and icons (point 5) are not built yet.
- **Two switches.** "Enable community tools" covers the signed list. "Allow tools WireCat has not checked" covers own
  tools, behind its own warning. The "More tools" block for WireCat's own extras (CRM, telephony) needs no switch,
  since those are reviewed first-party tools.
- **Who may publish.** Listing is for approved publishers only, by application or invitation. The admission rule
  (who decides, what a publisher shows, how one loses it) is open.
- **Provenance through our reusable workflow.** If a listed tool's publish step moves into a pinned WireCatLabs
  reusable workflow, its Sigstore certificate's subject (the Build Signer URI, from the token's `job_workflow_ref`)
  names that workflow, and the tool's own `release.yml` on `main` moves to the Build Config URI (OID
  1.3.6.1.4.1.57264.1.18, from `workflow_ref`) ([Fulcio OID list](https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md)).
  `provenance.rs` reads only the subject today, so it would refuse such a release. Changing it to check the signer
  against the pinned workflow and the config against the repository is a code change, not done.
- **A local program**, not from npm: no package, repository or provenance, and the app neither installs nor updates
  it. It needs the program on PATH and a self-description. Whether the first version supports it at all.
- **Updates of an own tool** are offered like any tool's; each repeats discovery, and a changed repository or new
  write access asks again.
- **Settings' "How to make your own"** opens `build-create-cli`. It could open
  [List your tool in WireCat](https://wirecat.dev/en/docs/build-list-tool) instead (a one-line change in
  `CommunitySetting.tsx`).
