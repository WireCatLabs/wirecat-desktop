# Plan: install the tools with pnpm, so they share one copy of their files

Status: built, 2026-11-27 (`src-tauri/src/own_pnpm.rs`, `install.rs`). See "As built" at the end. Backlog: cli-core
[CORE-73](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/BACKLOG.md).

## Goal

The WireCat CLIs that Desktop installs share one copy of cli-core and its heavy dependencies on disk, while each
CLI stays its own package with its exact cli-core pin. The user loses no command, sees no new step, and a tool they
installed themselves keeps working.

Not in scope: people who install CLIs with npm and no Desktop. Their install stays as it is.

## Current state

- Desktop installs each tool as its own global package: npm `install --global` by default, pnpm or bun
  `add --global` when the existing copy came from them (`src-tauri/src/install.rs:247-281,358-366`).
- npm gives every global package its own `node_modules` with real copies. Measured 2026-11-26 on the owner's
  machine: 16 CLIs, 4.5 GB, about 300 MB each; `stat` link count 1 on the same file in two CLIs.
- The published CLIs pin four cli-core versions: 1.3.0, 1.2.0, 1.1.0 and 1.0.0 (`npm view`, 2026-11-26). Each pin
  is exact; a core change reaches a CLI through a Dependabot bump and a release (cli-core
  `docs/dev/ARCHITECTURE.md:1064`).
- Desktop finds tools by PATH (`src-tauri/src/paths.rs:33,318,391`), already recognises pnpm copies by path
  (`paths.rs:442`), and already writes PATH blocks for shells and `HKCU\Environment\Path` (`src-tauri/src/profile.rs`).
- cli-core's background units (systemd, launchd) store the program path as the shim gave it, unresolved, written for
  pnpm (`cli-core src/background/system.ts:62-65`).

### Measured (2026-11-27, pnpm 11.28.8, one `PNPM_HOME` and store, real registry)

| Installed, one `pnpm add --global` each | Disk (`du` over home and store together) |
|---|---|
| tg-cli 0.137.0 | 378 MB |
| + zoom-cli 0.82.0 (core 1.0.0, tg has 1.3.0) | 404 MB |
| + max-cli, notion-cli | 468 MB |
| + whatsapp-cli, cli-memo (core 1.1.0) | 605 MB |

The same six with `npm install -g` are about 1.9 GB (≈310 MB each, from the owner's install). pnpm keeps every file
once in its store and links it into each package, across core versions too, so no core alignment is needed.

Also checked:

- Every program answers `<bin> commands` (which loads the command tree; `--version` does not).
- `tg` opened its store: a run in a throwaway home created `wirecat.db`.
- Each package keeps its own folder (`global/v11/<hash>/`); adding max did not touch tg, and updating tg from 0.137.0
  to 0.136.0 kept the same folder, so the paths in background units stay valid.
- **Trap:** pnpm skips build scripts by default. Without `--allow-build=better-sqlite3` no `better_sqlite3.node` was
  built, and only commands that open the store would fail. Packages with install scripts across the installed CLIs:
  `better-sqlite3`, `ssh2`, `cpu-features`, and the CLIs' own `postinstall` (tg, whatsapp, memo).

## Decisions

1. **Desktop installs WireCat tools with pnpm**, one `PNPM_HOME` and one store that Desktop owns, on the same disk
   (hard links need it). Each tool stays a separate global package, so install, update, uninstall, locks and PATH
   keep their current per-tool shape. Rejected: one Desktop-owned npm project folder (measured 435 MB for four CLIs,
   about the same saving) because it needs own shims, folder generations and one lock for all tools.
2. **Desktop installs pnpm itself with npm**, pinned to one version (`npm install --prefix <app data>/pnpm
   pnpm@11.28.8`), and calls that copy by its full path. The user needs nothing new: npm comes with every Node.
   Not corepack: Desktop downloads the newest supported Node (`src-tauri/src/node.rs:185-191`, 24+ allowed by
   `system.rs:131-137`), and Node 26.1.0 ships no corepack (checked: its `bin/` holds only `node`, `npm`, `npx`).
   The user's own pnpm, if any, is never used.
3. **Builds are allowed by a list in the catalog**: `better-sqlite3`, `ssh2`, `cpu-features`. The CLIs' own
   `postinstall` installs agent skills and, on Windows, repairs PATH (`tg-cli install/postinstall.mjs`); Desktop does
   both itself (`src-tauri/src/skills.rs`, `profile.rs`), so it stays off unless a test shows it is needed.
4. **A check after every install runs `<bin> commands` and one store-opening command**, not `--version`.
5. **Migration: moved automatically on the next update of each tool** (owner, 2026-11-27). Desktop installs the new
   version through pnpm, runs the check from decision 4, switches to the new copy, and only then removes the old npm
   copy. A failed step leaves the old copy in use.
   Correction (2026-11-27, owner): copies the user installed with npm outside Desktop move too, nvm folders
   included. Removal reuses what uninstall does today: `paths::find_all` finds every copy and each is removed by the
   npm that owns it, the one beside it for nvm (`src-tauri/src/install.rs:482-500`). Order for one tool:
   1. install the new version through Desktop's pnpm and run the check (decision 4);
   2. if the tool's background service runs, stop it with the old copy and start it with the new one, so the unit
      points at the pnpm path (the CLI writes its own unit, `src-tauri/src/background.rs:163-199`);
   3. remove every npm copy; check that `<bin>` on PATH now resolves to the pnpm copy.
   A copy npm cannot remove (for example in `/usr/local` without write access) stays; Desktop names its path and the
   command to remove it. A bun or volta copy is left alone: the owner asked about npm only.
6. **Without Desktop the site keeps `npm install -g`** (owner, 2026-11-27). pnpm is recommended in one place only:
   a section for people who install three or more tools, with the full command including `--allow-build`, and why
   (npm keeps a full copy of the shared core in every tool).

## Work items (wirecat-desktop unless named)

1. **pnpm on Desktop's Node**: pinned version installed with npm (decision 2), `PNPM_HOME` and store under the app data folder; PATH entry
   through `profile.rs`.
2. **Default manager pnpm** for a new install (`install.rs:270`), with the catalog's allowed builds; the existing pnpm
   path for updates and uninstall stays.
3. **Post-install check**: `commands` plus a store-opening command, in `install.rs` after the step that runs today.
4. **Migration** on each tool's next update (decision 5), with the old copy kept until the new one passes the check.
5. **Tests**: `install_e2e.rs` with pnpm on Linux, macOS and Windows (today Linux only, `.github/workflows/ci.yml:61-82`):
   two tools on different cores share files (link count above 1), both pass the check; an update keeps the path in a
   background unit working; a user's own npm copy in an nvm folder is moved and removed, and a copy npm cannot
   remove stays with a message.
6. **cli-core**: update the comment at `src/background/system.ts:62-63` if pnpm 11's layout needs other wording; no
   code change expected.
7. **Docs** on wirecat.dev (cli-docs): where Desktop puts tools; the "several tools" section with pnpm (decision 6).

## Rollout

A Desktop release. New installs use pnpm at once. Existing copies move on each tool's next update; if a step fails,
the old copy stays and the app keeps using it.

## Owner's answers (2026-11-27)

1. Existing copies: move them automatically on the next update (decision 5), including the ones installed with npm
   outside Desktop. Users have npm, not pnpm, so Desktop
   brings its own pnpm (decision 2).
2. Without Desktop: keep npm on the site, recommend pnpm only for several tools (decision 6).

## As built (2026-11-27)

Correction to the decisions above, where the code differs:

- **The allowed builds are a list in `own_pnpm.rs`**, not in the catalog: the same three for every tool, changed
  together with the pinned pnpm.
- **The check opens no store.** Every store command needs a profile, which a new install lacks. The check reads that
  the build ran for the driver the tool itself loads (`better_sqlite3.node`, found by following the tool's
  dependencies through pnpm's store; correction: at first every driver in the store was read, so one failed build
  failed every later install) and runs `<bin> commands --json` for tools
  built on cli-core (those with a doctor). `bin/install-e2e real_tool_e2e` opens a database with that driver.
- **pnpm's own release is checked** like a tool's: provenance from `pnpm/pnpm`'s release workflow on the tag
  `v11.28.8` (`provenance::confirm_built_by`), before npm installs it.
- **A background unit whose start at login is off is not written again**: `server install` would turn it on. The
  Tools page writes it when the owner starts that server.
- **Tests:** `bin/install-e2e` moves an npm copy of a test package to the app's pnpm, and installs with npm's
  folder locked. `bin/install-e2e real_tool_e2e` does the same with the real tg (about 100 MB). Both run on Linux
  here; CI runs the first on macOS and Windows (`install-e2e.yml`; correction: this said Linux only), and the release's install check runs the app's install on all three OSs.
- **A failed check never leaves the tool missing** (added after the release, owner's request to check install,
  uninstall and versions): the copy is installed once more, then goes, and when the app's pnpm held the tool before,
  that version is installed back. A pnpm that does not start is installed again; an uninstall removes programs left
  after their tool's folder went; `pnpm store prune` runs after an install or uninstall unless another runs. Each
  case was first reproduced with pnpm 11.28.8 by hand, then in `bin/install-e2e` (probe) and
  `bin/install-e2e real_tool_e2e` (a deleted driver build).
- **Found while testing:** npm 11.17 warns `allow-scripts … not yet covered by allowScripts` on a plain
  `npm install --global @wirecat/tg-cli`, but still runs the scripts: `better_sqlite3.node` is built (checked in a
  fresh prefix, 2026-11-27). The warning says a later npm may skip them, as pnpm does; then the npm path for own and
  community tools, and the site's `npm install -g`, would need `--allow-scripts`.
