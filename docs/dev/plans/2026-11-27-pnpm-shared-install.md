# Plan: install the tools with pnpm, so they share one copy of their files

Status: draft for the owner's review, 2026-11-27. Nothing here is built. Backlog: cli-core
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
   `system.rs:131-137`), and the Node project's docs describe corepack as no longer shipped with Node 25 and later.
   The user's own pnpm, if any, is never used.
3. **Builds are allowed by a list in the catalog**: `better-sqlite3`, `ssh2`, `cpu-features`. The CLIs' own
   `postinstall` installs agent skills and, on Windows, repairs PATH (`tg-cli install/postinstall.mjs`); Desktop does
   both itself (`src-tauri/src/skills.rs`, `profile.rs`), so it stays off unless a test shows it is needed.
4. **A check after every install runs `<bin> commands` and one store-opening command**, not `--version`.
5. **Migration: moved automatically on the next update of each tool** (owner, 2026-11-27). Desktop installs the new
   version through pnpm, runs the check from decision 4, switches to the new copy, and only then removes the old npm
   copy. A failed step leaves the old copy in use. A copy the user installed outside Desktop is left alone.
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
   background unit working; a user's own npm copy is left alone.
6. **cli-core**: update the comment at `src/background/system.ts:62-63` if pnpm 11's layout needs other wording; no
   code change expected.
7. **Docs** on wirecat.dev (cli-docs): where Desktop puts tools; the "several tools" section with pnpm (decision 6).

## Rollout

A Desktop release. New installs use pnpm at once. Existing copies move on each tool's next update; if a step fails,
the old copy stays and the app keeps using it.

## Owner's answers (2026-11-27)

1. Existing copies: move them automatically on the next update (decision 5). Users have npm, not pnpm, so Desktop
   brings its own pnpm (decision 2).
2. Without Desktop: keep npm on the site, recommend pnpm only for several tools (decision 6).
