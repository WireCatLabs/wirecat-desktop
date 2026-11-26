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
2. **pnpm comes with Desktop's own Node through corepack**, pinned to one version, so the user needs nothing new.
3. **Builds are allowed by a list in the catalog**: `better-sqlite3`, `ssh2`, `cpu-features`. The CLIs' own
   `postinstall` installs agent skills and, on Windows, repairs PATH (`tg-cli install/postinstall.mjs`); Desktop does
   both itself (`src-tauri/src/skills.rs`, `profile.rs`), so it stays off unless a test shows it is needed.
4. **A check after every install runs `<bin> commands` and one store-opening command**, not `--version`.
5. **Migration is open question 1.** Today's global npm copies are not removed by default.

## Work items (wirecat-desktop unless named)

1. **pnpm on Desktop's Node**: corepack, pinned version, `PNPM_HOME` and store under the app data folder; PATH entry
   through `profile.rs`.
2. **Default manager pnpm** for a new install (`install.rs:270`), with the catalog's allowed builds; the existing pnpm
   path for updates and uninstall stays.
3. **Post-install check**: `commands` plus a store-opening command, in `install.rs` after the step that runs today.
4. **Migration** as the owner decides (open question 1), with the old copy kept until the new one passes the check.
5. **Tests**: `install_e2e.rs` with pnpm on Linux, macOS and Windows (today Linux only, `.github/workflows/ci.yml:61-82`):
   two tools on different cores share files (link count above 1), both pass the check; an update keeps the path in a
   background unit working; a user's own npm copy is left alone.
6. **cli-core**: update the comment at `src/background/system.ts:62-63` if pnpm 11's layout needs other wording; no
   code change expected.
7. **Docs** on wirecat.dev (cli-docs): where Desktop puts tools.

## Rollout

A Desktop release. New installs use pnpm at once. Migration of existing copies follows the owner's answer; if a step
fails, the old copy stays and the app keeps using it.

## Open questions for the owner

1. **Existing copies** (the owner's 16 CLIs sit in nvm's global npm folder, 4.5 GB): leave them and use pnpm for new
   installs only; move them to pnpm automatically on the next update of each tool; or offer one "free space" button?
2. **pnpm for people who install without Desktop**: recommend `pnpm add -g` on the site, or keep npm as the default
   there?
