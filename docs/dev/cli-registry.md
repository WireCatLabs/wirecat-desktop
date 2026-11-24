# Community CLIs in the desktop app

Status: **built, keyed**. cli-docs builds and signs the list on every deploy and serves it at
`https://wirecat.dev/registry/v1/desktop-tools.json`. The same public key is in cli-docs `registry/minisign.pub` and in
[`src-tauri/registry-key.pub`](../../src-tauri/registry-key.pub), so a build fetches and checks the list while the
switch is on. No community tool is listed yet. Decided 2026-11-05: the list lives in cli-docs `tools.json`
(NEED-2204 A) and is signed in CI with a key the owner holds (NEED-2205 A). Your own tools, added from the app by their
npm name without a review, are built ([below](#your-own-tools-not-checked)).

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
   WireCatLabs; every link is `https`. An own tool may be a `@wirecat` package that no built-in tool installs, and
   only such a package may name a WireCatLabs repository ([below](#your-own-tools-not-checked)).
4. It sets none of `partOf`, `commandPrefix`, `memory`, `taskBoard`, `crmBoard`, `crm`, `bot`, `storeReset`,
   `storeResetPreview`, `configRepair`, `storeRecover` or `signIn.command` (a command line shown for the owner to copy).
   Its `signIn.methods`, the sign-ins the app runs in its own window, hold only `id` (a lower-case name), `label` (one
   line, at most 40 characters), `words` and `stdin`. The words start with `{profile}` and fill no other slot;
   `stdin: true` sends what the owner types as the command's whole stdin, closed after it. A variable, a setting or a
   flag for what the owner typed (`password`, `clientId`, `clientFile`, `address`, `oauth`, `portal`, `appId`) is
   refused. Its `accountRemove` words (`signOut`, `remove.keepData`, `remove.deleteData`) start with `{profile}` and
   fill no other slot, and `remove.dryRun` and `remove.confirm` are cli-core's `--dry-run` and `--yes`: the app adds
   the first to the preview and the second to the real removal, so swapped flags would delete on the preview.
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
3. **The app.** `registry.rs` fetches the fixed URL at start and then at most once a day while the build has a real
   key (since 2026-11-23 whatever the switch says, for the [official tools](#official-tools)) (HTTPS only, no redirects, 512 KB cap). It keeps the new copy only when the signature
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

## Official tools

Status: **built** (2026-11-23). Owner's decision NEED-2897, both A and B: WireCat's own tools come from the signed
list, the compiled catalog stays as the fallback, and a check fails when either drifts from the CLIs. The goal is that
a new official CLI appears in Desktop, translated and with its icon, without a Desktop release.

**Where each fact lives.** Facts about the CLI come from the CLI's own manifest, `contracts/wirecat.json` in its npm
package. It is the same `desktop` object the CLI's `--wcat-describe` prints. Presentation, and what only Desktop
assigns, comes from cli-docs `registry/official.json`: Desktop's id when it differs from the site's name (`b24` is
`bitrix`), the name, the texts in `en`, `ru` and `es` (`name`, `tagline`, `summary`, `gives`, `asks`, `syncNote`), an
icon, an MCP port and a sign-in screen. Nothing new was needed in cli-base's manifest for this.

**How the list is built.** In cli-docs, `pnpm registry:official` reads each of our tools' latest npm package, checks
the file against npm's integrity, and writes `registry/official-manifests.json`. That file is committed, so the
deploy job that signs the list still reads only reviewed files and fetches nothing. `scripts/desktop-registry.ts`
writes one entry per tool into a new top-level key, `official`, beside `tools`:

```json
{ "id": "attio", "name": "Attio", "package": "@wirecat/attio-cli",
  "repo": "https://github.com/WireCatLabs/attio-cli", "docs": "https://wirecat.dev/en/docs/attio",
  "summary": "…", "summaries": { "en": "…", "ru": "…", "es": "…" },
  "bin": "wcat-attio", "version": "0.2.2", "manifestSha256": "…", "desktop": { "…": "the manifest's object" },
  "mcpPort": 8740, "icon": "M2 2h20v20H2z", "screen": "pbx", "i18n": { "ru": { "tagline": "…" } } }
```

The list keeps `"format": 1`, so a Desktop that predates the key ignores it and still reads its community tools. It is
published with the site, as before: every deploy, and daily.

**How the app reads it.** `registry.rs` now fetches the list once a day whenever the build has the list's key, not
only while "Enable community tools" is on. The switch decides only whether `tools` is read. `community.rs` reads the
sources in this order: `official`, then community tools, then own tools, so an official tool's names win.
`official.rs` checks each official entry:

- **A tool this app has compiled in** takes only its presentation from the list: `i18n`, `icon` (only when the app
  has no logo of its own for it) and `screen`. Its commands come from the installed CLI itself
  ([below](#commands-from-the-installed-cli)), never from the list. The package must be the compiled one, or the entry
  is refused. The texts come before the app's own translations (`toolText`).
- **A tool this app does not have** becomes a catalog entry the way an own tool does (`own_tools::desktop_entry`),
  with the list's id, name, texts and port. It must be a `@wirecat` package built in a `WireCatLabs` repository, and
  every rule of a listed tool applies: plain words, no key in `FORBIDDEN`, its data folder named after its package,
  no name, program, package, folder, port or call provider of another tool. Its install still needs npm provenance
  from that repository's `release.yml`, like every built-in tool. It shows no badge. An MCP server without a port in
  the list is refused.
- **Signatures.** Only a list whose minisign signature matches `registry-key.pub` is kept, exactly as before. Official
  and community entries share the key; the array marks which is which, and the rules above stop a community entry
  from claiming to be ours and an official entry from pointing outside `@wirecat`.
- **The icon** is one SVG path on a 24 by 24 box, path commands and numbers only, at most 2 KB, drawn in the text
  colour. It is checked in Rust and again in the interface. It can never load anything.
- **The sign-in screen.** `screen` names a built-in tool whose own screens the tool uses (`screenOf` in
  `src/domain/catalog.ts`): Bitrix24's webhook and application steps and Asterisk's source form. The bots' screens
  (`tg`, `max`, `wa`) need the catalog's `bot` block, which only a compiled-in tool may have, so they are refused.
- **An expired list.** The official tools of an expired copy stay, and their installs are not blocked: only WireCat
  publishes under `@wirecat`, and provenance still ties each release to our repository.
- A list fetched now takes effect at the next start, as before.

### Commands from the installed CLI

Status: **built** (2026-11-24). Owner's decision NEED-2912 A: an installed official tool's commands come from the CLI
itself, through its `--wcat-describe` answer, not from the compiled catalog and never from the signed list.
`described.rs` does it.

- **What is taken.** The `desktop` object of the answer, overlaid on the compiled entry with the drift check's rules:
  only the keys that hold commands (`profiles`, `doctor`, `runs`, `setup`, `skill`, `mcpServer`, `accountRemove`,
  `meetings`, `sync.run`, `sync.last` with its `sync.lastShape`, `signIn.methods`, `signIn.setupFrom`); a `null` or
  missing key says nothing; an object is merged key by key; a word list replaces the catalog's whole.
- **What stays the catalog's.** The texts (`tagline`, `signIn.gives` and `asks`, `sync.what` and `note`; translations
  come from the catalog and the signed list), the MCP port, what a sign-out keeps and removes, and every key only
  Desktop has (`bot`, `search`, `crm`, `folderPicker`…). A tool the catalog lists without an MCP server gets none from
  its answer, since it has no port (gcal, email and zm, owner's call 2026-11-24).
- **Checks.** The answer is refused, with a line in the log, and the catalog's commands stay, when the program does not
  answer within 15 s, answers more than 64 KB, exits with an error, is not `wcat_describe: 2`, is for another version
  than the program's `--version`, or its `desktop` object fails the rules of an own tool's manifest
  (`own_tools::desktop_entry`), sets a key only the catalog may set (`community::FORBIDDEN`), names another data
  folder, has a command word that is not plain, swaps `accountRemove`'s `--dry-run` and `--yes`, or no longer parses
  as a catalog entry. The answer comes from the package whose code the app runs anyway, so trusting it adds no trust;
  the checks keep a broken answer from breaking the app.
- **When it is read.** Answers are kept in `<app data>/described.json` by tool, with the program file and its stamp
  (`cache::Stamp`). At start the catalog applies each kept answer whose program is unchanged, without starting a
  process. After the window opens, `refresh_all` asks every installed official tool whose program changed, four at a
  time, and reloads the catalog once if anything changed; the interface waits for it through `described_tools` and
  reads `extra_tools` again. An install, update or removal asks that tool again before it answers. A program that gave
  no usable answer is not asked again until it changes.
- **Not installed.** The compiled catalog, and the signed list for a tool this app does not have, are what the Tools
  page shows and installs.
- **The interface** gets the same commands: each changed tool is an `official` entry `{ id, described }` in
  `extra_tools`, whose keys replace the compiled ones (`addDescribed` in `src/domain/catalog.ts`).

**The drift check (A).** cli-docs `pnpm registry:drift`, and its Registry drift workflow (daily, and on pull requests
that touch the registry), fails when the committed manifests are behind npm, or when this repository's
`catalog/tools.json` on `main` says something else than a manifest, comparing only what the manifest states. The
catalog's `bin` must be one of the package's programs (the manifest names the `wcat-` one). Each known difference is a
line in cli-docs `registry/drift-allow.json` with why, and a line that no longer differs fails too. A CLI release that
changes its manifest turns the check red until someone runs `pnpm registry:official` and commits the result.

**What a new official CLI needs now.** In cli-docs: an entry in `tools.json` (which also lists it on the site), an
entry in `registry/official.json` with the Russian and Spanish texts, an icon and an `mcpPort` when it has an MCP
server, then `pnpm registry:official` and a merge. Each Desktop with this change shows it at its next start after the
daily fetch. A Desktop release is still needed for anything the manifest cannot say yet: search fields, a CRM board,
a folder picker, a bot, a sign-in screen of its own.

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

Status: **built** (2026-11-07): `src-tauri/src/own_tools.rs` and `src/features/tools/OwnToolDialog.tsx`; the manifest
and the refusal kinds are [below](#the-manifest-format-2). Owner's ruling 2026-11-06: anyone may
add any tool on their own computer, behind a clear warning that WireCat has not checked it. A private repository's
tool, which can never be listed, can only be added this way. The button is on the Tools page (NEED-2281 A); only scoped
npm packages (NEED-2280). A `@wirecat` package that is not in `catalog/tools.json` is added this way too (owner's
ruling 2026-11-16, first `@wirecat/beeline-cli`); one a built-in tool installs is refused as `wirecat_scope` before npm
is asked.

**Data folder of an own tool.** Deleting a tool's data removes only folders whose last part is its `storage.app`
(`storage.rs`, `ensure_ours`); `storage.env` only names variables that can move those folders, and a moved folder
must still end in `storage.app`. So the folder name is what must belong to the tool. For an own tool from
`@<scope>/<name>`, `storage.app` lower-cased must be `<scope>-<name>` or start with `<scope>-<name>-`, with every
`.` and `_` of the package name turned into `-` (`@leemour/acme-crm-cli` → `leemour-acme-crm-cli`, `@x/a_b` →
`x-a-b`), at most 64 characters. A `@wirecat/<name>` package is ours, so its folder is the one our CLIs use:
`storage.app` must be `<name>` or start with `<name>-` (`@wirecat/beeline-cli` → `beeline-cli`). Rule 2 still refuses
the id, program, package and folders of every built-in tool and of the shared store, so such a tool never takes over
their names or data. An own tool's folders are always its default locations: a `<PREFIX>_CONFIG_DIR`
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
off hides the own tools at once (`set_allowed` reloads the catalog), and installed ones stay installed. The community
switch still takes effect at the next start. Its "How it
works" link opens the Desktop docs, section "Add your own tool".

**2. A button on the Tools page.** While the switch is on (or the flag is set), the Tools page shows **Add your own
tool** at the top, next to Check again. It opens a dialog that takes a scoped npm name and warns again, in a red block,
in plain words:

- "It runs as you on this computer, so it can read everything WireCat keeps: your messages, mail, notes and files."
- On the review, for a tool whose `dependencies` include `@wirecat/cli-core`: "It is built on cli-core, WireCat's own
  library, so it opens that data directly."
- "Add it only if you trust its authors completely."
- "WireCat has not checked this tool and takes no responsibility for what it does."

A refusal opens with a headline ("Tool not found") above its sentence. **Try again** returns to the name, kept and
selected, except after `offline`, `too_large` or an unexpected error, where it reads the same name again.

**3. Discovery and review, before anything is installed.** The app reads npm only (`own_tools.rs`): its npm metadata, the
provenance as `provenance.rs` reads it, and the manifest out of the tarball, checked against `dist.integrity`. The
manifest becomes a catalog entry that every `community.rs` rule checks, plus the folder-name rule above. The review
shows a **Not verified** badge, publishers, repository, version, where npm built it (or "No record of where npm built
it"; neither blocks), each as a link (npm profile, repository, the version's npm page, the release commit, the
workflow run and the transparency-log entry, the last three from the Fulcio certificate), then:

- **Things to check** (`own_risks.rs`), flagged and never blocking: npm (first published < 30 days, < 3 versions, one
  publisher, no provenance), the `@wirecat/cli-base` and `@wirecat/cli-core` versions in `dependencies` (cli-base
  0.81.0+, the format-2 manifest; cli-core 0.603.0+, undeclared effects count as writes; both < 1.0.0), the code
  (`own_scan.rs`: network modules, `fetch`, `WebSocket`, `child_process` and URL hosts in the tool's own JavaScript,
  which is every file but `package.json` and the manifest, decoded as Node.js decodes it, since Node.js runs any file a
  `require` names; hosts come only from scripts and from files a script loads, and a loaded file that is not
  JavaScript by its name is flagged; declared hosts are left out as they are found, so they cannot
  fill the bound; escaped names, computed globals and `process.binding` are flagged as hidden calls; comments are
  read like code; sections a bundler marks as `node_modules/` are skipped, but a bundled cli-base or cli-core counts
  as one, with the version pnpm's folder names; `.node` and `.wasm` files are flagged as unreadable; only the
  repository's host counts as the tool's own, and the review shows 20 undeclared hosts and how many more), a manifest
  without `network`, and GitHub
  (`own_tool_risks`, unauthenticated REST, cached an hour by `repo@commit`: created < 30 days, no push > 180 days,
  archived, < 10 stars, workflows at the release commit whose `uses:` keys do not call cli-base's `node-ci.yml` and
  `release-checks.yml`; one agent, no redirects (a renamed repository's 301 is flagged as moved, named by one more
  read on api.github.com), 15 s for all calls together; a failure is "Couldn't check" with its
  reason). `network.hosts` follows cli-base's `HOST_PATTERN` exactly (`*.` only before two labels), with no count cap.
  The package file must come from `https://registry.npmjs.org/`.
- **Servers it contacts**: the manifest's `network.hosts` and `user_hosts` (cli-base#529).
- **What it says it does**: commands grouped by `entity` (else their first word) with the most they ask for with the
  service and on this computer, the entity's `fields`, the sync's own words, cli-base's standard roots in plain words,
  and the exact commands under **Commands**.

A refusal is a kind with a sentence and what to do ([Refusals](#refusals)).

**4. An AI check, then two confirmations.** **Add** first offers **Check it with `<agent>`** for the agent last used, with the
others `run_agent` can start in its menu (or **Copy the check**), with a prompt that names the reviewed tarball and its sha512 and tells the agent to
download, verify, unpack and read it, compare it with the repository at the release commit, and never install or run
it; or **Skip and install**. Then "Install and run `<package>`? Its install scripts and first run use your
permissions.", with Back and **Install and run**. Only that button installs.

**5. Then the app:**

1. Installs exactly the reviewed version with the usual install path (`install.rs`). `confirm_release` reports the
   provenance for an own tool, and refuses only a build from another repository than the review showed.
2. Runs `--wcat-describe` and refuses the tool when it names another manifest than the one reviewed. The package is
   installed by then, so the dialog offers **Uninstall it**.
3. Saves the entry to `<app data>/extra-tools.json`, with the data folders that already existed (`own.preexisting`).
   It survives restarts and updates and is never sent anywhere.
4. Reloads the catalog (`catalog::reload`, which leaks the old one so every `&'static Tool` handed out stays valid;
   the signed list keeps the copy read at start), and the interface reads its tools again (`reloadAddedTools`, `src/shared/added-tools.ts`), so
   the tool is listed at once. Remove from WireCat does the same.

**How it looks.** A tool from this file carries the badge **Not verified** instead of **Community**, on the Tools page
and on Choose tools. Until it is installed, its row says "Added by you, made by `<owner>`. WireCat has not checked
it."; a `@wirecat` package says instead that it is a WireCat tool this version of the app does not include yet, since
only WireCat publishes under that scope. The badge comes from the source, the file, not from a key in the entry, so a signed-list entry can
neither claim it nor drop it. Its details have **Remove from WireCat**, which deletes the entry; when the tool is installed it offers **Uninstall it
first**, so the uninstall runs while the tool is still in the catalog.

**Updates.** Install and Update of an own tool open the same dialog, which reads npm again. The review then lists what
changed since the entry the owner confirmed: repository, provenance, publishers, new commands, new write access, new
or changed parts. Any change, or access the tool does not describe, needs "I accept these changes" before Add.

**The signed list and the file together.** The app reads the signed list first (while "Enable community tools" is on)
and then the file (while "Allow tools WireCat has not checked" is on, or the flag is set). An own entry whose id,
package or data folder a listed entry already uses is refused, with the sentence "This tool is now listed. Remove your
own entry to use the listed one."

**What this does not change.** No `community.rs` rule is relaxed for the signed list, `provenance.rs` still refuses
for listed tools, and nothing the owner adds reaches another computer.

### The manifest (format 2)

`contracts/wirecat.json` in the npm tarball, written by cli-base's `cli-dev manifest`. Desktop reads only format 2:

- `wcat_manifest`: `2`. `package` must be the npm name asked for. `version` may be left out; when present it must
  be npm's version. `bin`, `name`, `description` and `docs_url` describe the program.
- `commands`: `[{ path, effects: { remote, local }, summary, entity }]`. Each level is `none`, `read` or `write`; a
  command with no `effects` counts as a write. Every word of `path` is a plain word.
- `desktop`: a catalog entry with exactly these keys, `null` when unused: `tagline`, `profiles`, `doctor`, `runs`,
  `search`, `setup`, `signIn`, `skill`, `mcpServer`, `tasks`, `sync`, `storeInfo`, `storeTables`,
  `storeTableSizes`, `storeCheck`, `storeBackup`, `storeBackupEncrypted`, `storeResetPreview`, `storeReset`,
  `storage`, `settings`, `accountRemove`. `community.rs` checks it like a listed entry. `meetings` may be added (cli-base 0.104.0,
  `ManifestIdentity.meetingsProvider`): `{ provider, show, transcript }`, how a client's call opens from the Clients
  page and Meetings (`calls.rs`, `call_recording.rs`). The provider is a lower-case name no other tool uses, so a
  manifest cannot take over Zoom's or Asterisk's calls, and both commands take the call as `{id}`. `sync.what` is one
  of `messages`, `files`, `meetings`, `calls`, `notes and mail`, `mail`, `records`, `tracker`, `content`; any other text counts as
  `records`. `signIn.methods` (cli-base's `ManifestIdentity.signIn.methods`) lets the tool sign in in the window,
  under rule 4 above: the window shows the tool's `signIn.asks` and, for a `stdin` method, a token field; with
  `site: "--site"` and `login: "--login"` (cli-core's application password, the only flags taken) it asks the
  site and the user name too, and the password goes on stdin. The review
  says the tool signs in in the window, and an update that changes the methods lists the sign-in among the changed
  parts. `accountRemove` (cli-base's `desktop.accountRemove`) has the catalog's shape and gives the account menu
  Sign out and Remove account (`account.rs`); a manifest without it gets `null`. An update that adds it or changes
  its words lists it among the new or changed parts. `sync.last` may hold one word with a quote and spaces,
  `command:"meetings sync" status:success`, cli-base's filter for a sync path of two or more lower-case words; the
  quoted path must be `sync.run`'s own.
- `network`: `{ hosts, user_hosts }`. No `network` means the tool did not say; `hosts: []` means none.
- `entities`: `{ <name>: { fields } }`.

The manifest names no MCP port. Desktop picks one from 8770 to 8999 that no other tool uses, and an update keeps
the one it had.

Limits: 20 s per npm call, a 512 KiB packument, a 10 MiB tarball, a 256 KiB manifest, 64 MiB unpacked.

After the install, `<bin> --wcat-describe` must answer, within 15 s and 64 KiB, with `manifest_sha256` equal (any
case) to the SHA-256 of the manifest the owner reviewed. Otherwise the tool is not added.

### Refusals

Each is `{ "kind": … }` in snake_case, with its fields in camelCase: `not_found`, `not_scoped`, `wirecat_scope` (a
built-in tool's package), `no_manifest` (offers pasting the `desktop` object), `bad_manifest { key, rule }` (also a
WireCatLabs repository on a package outside `@wirecat`), `collision { with, listed }`,
`provenance_mismatch { claimed, built }`, `offline { detail }`, `too_large { what }`. Any other error reads
"Something went wrong reading npm: <message>".

## Open decisions

- Whether a signed list needs a second maintainer's approval (today: the pull request review and the `production`
  environment's rules).
- Whether community tools may use the store commands (backup, reset), `bot` or the Memory and Tasks pages later.
- Registry removal (point 4) is not built yet. Icons (point 5) are built for official tools only.
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
