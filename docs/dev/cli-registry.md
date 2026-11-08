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
  default). `registry.rs` reads the copy kept in `<app data>/registry/`, checks its signature again, and hands its
  entries over, expired or not ([expiry](#when-the-list-expires)). Without a copy that verifies the app has its
  built-in tools only.
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
   entry. A new list takes effect at the next start, so a page never changes under the owner. An expired kept copy
   still lists its tools, but blocks their installs and updates ([below](#when-the-list-expires)).
   `bin/registry-live` checks the live list with this build's key through the same code, in a temp folder:
   it passes, and a changed byte, an expired copy and a lower version than the kept one are each refused.
4. **Removal.** A tool pulled from the list stops being offered. An installed copy stays installed and is listed as
   "No longer listed", with Uninstall; the app never removes it on its own.
5. **Icons.** No code from the registry. Either the generic package icon (today), or an optional `icon` holding one
   SVG path (`d`), checked in Rust to contain only path commands and numbers, at most 2 KB, drawn in the app's own
   colour on a 24 x 24 box.

## When the list expires

Decided 2026-11-08 (NEED-2285): an expired list has a real effect, and the app says so at the top of every page.

- **State.** `registry::status()` reports the kept copy's `expiresAt` and a `state`: `fresh`, `expiring` (seven days
  or fewer left), `expired`, or `neverFetched`. It reads the copy on disk each time, so a refresh while the app runs
  clears it, and an app left open past the expiry sees it.
- **Effect.** The tools of an expired copy stay in the catalog, so installed ones keep running, signing in and syncing.
  Install and Update of a listed tool are refused with `FailReason::listExpired` (`listed_release_allowed` in
  `install.rs`) while the copy is expired or gone: nothing vouches for a newer release, or for a tool the list has
  dropped since. Uninstall works. Own tools do not use the list and are not affected. The tool's row on the Tools page
  says why.
- **Notice.** While "Enable community tools" is on and the state is `expiring` or `expired`, a notice across the top
  of the app (`src/shared/notices-store.ts`, shown by `src/app/TopNotices.tsx`) says how many days are left or that
  installs and updates have stopped, with a link to the desktop docs. Dismissing it holds until the state or the
  expiry date changes. The interface reads the status at start and on the bell's hourly timer
  (`src/features/tools/registry-store.ts`).

## Your own tools (not checked)

Status: **built** (2026-11-07): `src-tauri/src/own_tools.rs` and `src/features/tools/OwnToolDialog.tsx`; the current
flow, refusal kinds and checks are in [the plan](plans/2026-11-07-own-tools.md). Owner's ruling 2026-11-06: anyone may
add any tool on their own computer, behind a clear warning that WireCat has not checked it. A private repository's
tool, which can never be listed, can only be added this way. The button is on the Tools page (NEED-2281 A); only scoped
npm packages (NEED-2280).

**Data folder of an own tool.** Deleting a tool's data removes only folders whose last part is its `storage.app`
(`storage.rs`, `ensure_ours`); `storage.env` only names variables that can move those folders, and a moved folder
must still end in `storage.app`. So the folder name is what must belong to the tool. For an own tool from
`@<scope>/<name>`, `storage.app` lower-cased must be `<scope>-<name>` or start with `<scope>-<name>-`, with every
`.` and `_` of the package name turned into `-` (`@leemour/acme-crm-cli` → `leemour-acme-crm-cli`, `@x/a_b` →
`x-a-b`), at most 64 characters. An own tool's folders are always its default locations: a `<PREFIX>_CONFIG_DIR`
override does not move what Delete data removes. A folder that already existed when the owner added the tool is
recorded in its entry (`own.preexisting`, kept by updates); Delete data lists it with why it stays and never removes
it, because a free scope can still match another program's folder (`@google/chrome` → `google-chrome`). Only the scope's owner can publish under
a scope, so that folder name is theirs; the unscoped name alone (`@evil/gh` → `gh`) and the manifest's own `name`
prove nothing. `storage.env` has no naming rule, but it may not be one an official tool or the shared store uses. A
manifest that breaks the rule is refused as `bad_manifest(storage)`, at review and at every start.

The entry comes from the tool's manifest `contracts/wirecat.json` (format 2), read out of the npm tarball before
anything is installed; `--wcat-describe` only confirms after install that the program names the same manifest.
Developers can still write entries into `<app data>/extra-tools.json` by hand and start the app with
`WIRECAT_EXTRA_TOOLS=1`.

**1. A switch in Settings.** "Allow tools WireCat has not checked", off by default, under "Enable community tools".
Turning it on opens a warning that the owner must confirm before the switch turns on. Cancel leaves it off. Turning it
off hides the own tools at the next start, and installed ones stay installed, like the community switch. Its "How it
works" link opens the Desktop docs, section "Add your own tool".

**2. A button on the Tools page.** While the switch is on (or the flag is set), the Tools page shows **Add your own
tool** at the top, next to Check again. It opens a dialog that takes a scoped npm name and warns again, in plain words:

- "This tool gets access to all your personal data that WireCat holds: your messages, mail, notes and files."
- "Add it only if you trust its authors completely."
- "WireCat has not checked this tool and takes no responsibility for what it does."

**3. Discovery and review, before anything is installed.** The app reads npm only (`own_tools.rs`): its npm metadata, the
provenance as `provenance.rs` reads it, and the manifest out of the tarball, checked against `dist.integrity`. The
manifest becomes a catalog entry that every `community.rs` rule checks, plus the folder-name rule above. The review
shows publishers, repository, version, where npm built it (or "No record of where npm built it"; neither blocks),
what the tool asks for, sign-in, sync and agent connection. A refusal is a kind with a sentence and what to do
([plan, Failures](plans/2026-11-07-own-tools.md#failures-the-user-can-act-on)).

**4. Two confirmations.** **Add** opens "Install and run `<package>`? Its install scripts and first run use your
permissions.", with Back and **Install and run**. Only that button installs.

**5. Then the app:**

1. Installs exactly the reviewed version with the usual install path (`install.rs`). `confirm_release` reports the
   provenance for an own tool, and refuses only a build from another repository than the review showed.
2. Runs `--wcat-describe` and refuses the tool when it names another manifest than the one reviewed. The package is
   installed by then, so the dialog offers **Uninstall it**.
3. Saves the entry to `<app data>/extra-tools.json`, with the data folders that already existed (`own.preexisting`).
   It survives restarts and updates and is never sent anywhere.
4. Takes effect at the next start, with Restart now, because pages build some lists when their module loads.

**How it looks.** A tool from this file carries the badge **Not checked** instead of **Community**, on the Tools page
and on Choose tools. The badge comes from the source, the file, not from a key in the entry, so a signed-list entry can
neither claim it nor drop it. Its details have **Remove from WireCat**, which deletes the entry and offers Uninstall.

**Updates.** Install and Update of an own tool open the same dialog, which reads npm again. The review then lists what
changed since the entry the owner confirmed: repository, provenance, publishers, new commands, new write access, new
or changed parts. Any change, or access the tool does not describe, needs "I accept these changes" before Add.

**The signed list and the file together.** The app reads the signed list first (while "Enable community tools" is on)
and then the file (while "Allow tools WireCat has not checked" is on, or the flag is set). An own entry whose id,
package or data folder a listed entry already uses is refused, with the sentence "This tool is now listed. Remove your
own entry to use the listed one."

**What this does not change.** No `community.rs` rule is relaxed for the signed list, `provenance.rs` still refuses
for listed tools, and nothing the owner adds reaches another computer.

## Open decisions

- Whether a signed list needs a second maintainer's approval (today: the pull request review and the `production`
  environment's rules).
- Whether community tools may use the store commands (backup, reset), `bot` or the Memory and Tasks pages later.
- Registry removal (point 4) and icons (point 5) are not built yet.
- **More tools.** The block for WireCat's own extras (CRM, telephony) needs no switch, since those are reviewed
  first-party tools.
- **Who may publish.** Listing is for approved publishers only, by application or invitation. The admission rule
  (who decides, what a publisher shows, how one loses it) is open.
- **Provenance through our reusable workflow.** If a listed tool's publish step moves into a pinned WireCatLabs
  reusable workflow, its Sigstore certificate's subject (the Build Signer URI, from the token's `job_workflow_ref`)
  names that workflow, and the tool's own `release.yml` on `main` moves to the Build Config URI (OID
  1.3.6.1.4.1.57264.1.18, from `workflow_ref`) ([Fulcio OID list](https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md)).
  `provenance.rs` reads only the subject today, so it would refuse such a release. Changing it to check the signer
  against the pinned workflow and the config against the repository is a code change, not done.
- **Settings' "How to make your own"** opens `build-create-cli`. It could open
  [List your tool in WireCat](https://wirecat.dev/en/docs/build-list-tool) instead (a one-line change in
  `CommunitySetting.tsx`).
