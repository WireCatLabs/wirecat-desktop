# Architecture report

This report is for a reader who knows web apps but not this one. It explains how WireCat Desktop works from a click
to a process and back, what each layer owns, what is good and bad today, and the plan to make it easy to grow.

The reference for each module stays in [ARCHITECTURE.md](ARCHITECTURE.md). The rules for each kind of change are in
[guides/](guides/). Numbers below were measured on 2026-11-04 on branch `feat/smooth-install`.

## In one paragraph

WireCat Desktop is a [Tauri](https://tauri.app) app. The window is a web page (React) that the operating system's
webview shows. Behind it runs a Rust program. The page cannot start programs or read files. It asks Rust, by name,
to do one fixed operation ("install tool `tg`"). Rust checks the request, runs the tool's own command (`npm install`,
`tg doctor`), masks personal data in the output, and sends the answer back. The page checks the answer's shape before
it uses it. In a normal browser (`pnpm dev`) there is no Rust, so a mock answers instead.

## How a request travels

```text
 React screen (src/features/tools/ToolRow.tsx)
   | user clicks "Install"
   v
 store (src/features/tools/store.ts, zustand)          <-- holds state, queues installs
   | platform.install("tg", onEvent)
   v
 platform/bridge (src/platform/bridge.ts)              <-- the only door to Rust
   | invoke("install_tool", { id, onEvent: Channel })
   v
 ======================== process boundary (Tauri IPC) ========================
   v
 Tauri command (src-tauri/src/lib.rs, install_tool)    <-- one function per operation
   | catalog::tool(&id)?  (unknown id = error)
   v
 Rust module (src-tauri/src/install.rs)
   | run::command(...) builds the argv from the catalog, never a shell line
   v
 fixed program (npm install --global <package>@<version>)
   |
   | each output line -> redact.rs -> Channel event { event: "log" | "step" | "done" }
   v
 ======================== process boundary (Tauri IPC) ========================
   v
 platform/bridge: v.safeParse(InstallEventSchema, raw)  <-- schema check (valibot)
   v
 store: updates the install session
   v
 React screen re-renders (progress, log, result)
```

A plain request and answer (no events) is the same path in one step: `call(schema, "detect_tools")`
([bridge.ts:79](../../src/platform/bridge.ts)) invokes the command and parses the answer with the schema.

## The layers

Rails comparison, to anchor the words: `features/` is close to controllers plus views, `domain/` is plain Ruby
objects, `platform/` is an API client, `ui/` is a component library, and Rust is the backend.

| Layer | Owns | May import | Real example |
| --- | --- | --- | --- |
| `src/app/` | The shell: window frame, sidebar, page list, theme, browser scenarios | everything | [sections.tsx](../../src/app/sections.tsx), [App.tsx](../../src/app/App.tsx) |
| `src/features/<area>/` | One area of the app: its page, its components, its store, its messages | `domain`, `platform`, `ui`, `i18n`, other features (today) | [features/tools/](../../src/features/tools/) |
| `src/ui/` | Presentational parts: props in, events out. No data | `i18n`, React | [Button.tsx](../../src/ui/Button.tsx), [Dialog.tsx](../../src/ui/Dialog.tsx) |
| `src/platform/` | Calls to Rust, schemas of every answer, the browser mock | `domain`, valibot, `@tauri-apps/*` | [bridge.ts](../../src/platform/bridge.ts), [schemas.ts](../../src/platform/schemas.ts) |
| `src/domain/` | Plain TypeScript rules: catalog, statuses, parsing, formatting | nothing above it | [status.ts](../../src/domain/status.ts), [catalog.ts](../../src/domain/catalog.ts) |
| `src/i18n/` | Language choice, `useMessages`, plurals | zustand, React | [index.ts](../../src/i18n/index.ts) |
| `catalog/tools.json` | The list of tools, read by TypeScript and Rust | | [tools.json](../../catalog/tools.json) |
| `src-tauri/src/lib.rs` | The native surface: every `#[tauri::command]` | all Rust modules | `install_tool`, `remove_copy` |
| `src-tauri/src/*.rs` | One module per job: install, sync, sign-in, storage, redact | each other, `run.rs` | [install.rs](../../src-tauri/src/install.rs), [run.rs](../../src-tauri/src/run.rs) |

Biome enforces the arrows for `domain`, `platform`, `ui` and `features` with `noRestrictedImports`
([biome.json](../../biome.json)). Only `platform` may import `@tauri-apps/*`.

### What each layer must not do

- **domain** has no React, no Tauri, no state. A function in, a value out. This is where tests are cheapest.
- **platform** knows no UI. It returns parsed data or throws. It does not decide what to show.
- **ui** knows no data. It never imports a store, the platform or a feature.
- **features** never call Tauri directly and never import the app shell.
- **Rust** never builds a shell line from input (rule 2 in [CLAUDE.md](../../CLAUDE.md)). It maps a tool id to a
  fixed program from the catalog.

## Current state, measured

### Good

- **Layer rules hold.** `pnpm lint` passes with the import rules above in force, so the arrows are real, not a wish.
- **Every Rust answer is checked.** `call` parses with valibot ([bridge.ts:79](../../src/platform/bridge.ts)), and
  event channels drop or replace an answer that does not parse ([bridge.ts:82](../../src/platform/bridge.ts)).
- **Domain is tested.** 24 of the 50 files in `src/domain/` are tests: almost one test file per module.
- **Tests read like a user.** They find elements by role and name
  ([RemoveCopy.test.tsx](../../src/features/tools/RemoveCopy.test.tsx)). They do not test CSS classes.
- **Rust is tested.** 368 `#[test]` functions in 47 of 51 Rust files.
- **i18n is enforced.** [no-literals.test.ts](../../src/i18n/no-literals.test.ts) fails on text in JSX outside a
  messages file, and [catalogs.test.ts](../../src/i18n/catalogs.test.ts) fails when Russian or Spanish misses a key.
- **One catalog.** `catalog/tools.json` is read by both sides, so a tool's id means the same thing everywhere.

### Bad

- **Features import each other in cycles.** Measured by the imports in each folder:
  `tools` imports `agents`, `config`, `fix`, `logs`, `onboarding`, `report`, `signin`, `storage`, `system`, and
  `agents`, `config`, `logs`, `onboarding`, `report`, `signin`, `storage` import `tools` back. `onboarding` and
  `report` import each other too. A change in one area can break another, and nothing in a folder says what it
  offers to others (no folder has an `index.ts`).
- **Shared parts live in features.** `ToolIcon` ([features/tools/ToolIcon.tsx](../../src/features/tools/ToolIcon.tsx)),
  `ReportThis` ([features/report/ReportThis.tsx](../../src/features/report/ReportThis.tsx)), `safeStorage`
  ([features/onboarding/store.ts:33](../../src/features/onboarding/store.ts)) and `JsonTree`
  ([features/logs/JsonTree.tsx](../../src/features/logs/JsonTree.tsx)) are used by other features. That is the main
  cause of the cycles.
- **Large components.** 29 `.tsx` files over 300 lines, messages files not counted. The largest:
  `tools/ConnectGuide.tsx` 1112, `memory/Row.tsx` 845, `analytics/sections.tsx` 758, `onboarding/steps.tsx` 701,
  `guides/GuidesPage.tsx` 672.
- **Effects that fight the linter.** 21 `biome-ignore lint/correctness/useExhaustiveDependencies` comments. Most
  are data loading in `useEffect`, which a query library would replace.
- **Components call the platform.** 62 non-test files in `features/` import `platform/bridge`, 36 of them `.tsx`.
  Loading, caching, retry and errors are written again in each place.
- **Missing UI primitives.** `ui/` has no Tabs, Switch, Field, Progress, Table, Toast, Tooltip or Popover. A progress
  bar (`role="progressbar"`) is written by hand in 8 feature files, a tab list in `config/ConfigPage.tsx` and
  `agents/AgentList.tsx`.
- **The mock ships to users.** `bridge.ts:32` imports `createMock` statically, so the whole mock (25
  `mock-*.ts` files) is in the production bundle although Tauri never uses it.
- **No lazy pages.** [sections.tsx](../../src/app/sections.tsx) imports all ten pages at start.
- **No end to end test.** `playwright-core` is a dev dependency for the capture scripts, but no test runs the built
  app. No shared render helper exists, so each test resets stores by hand.
- **Types written twice.** Each Rust struct has a hand-written valibot schema and a TypeScript type in
  [platform/types.ts](../../src/platform/types.ts) (305 lines). Nothing checks that they agree until runtime.
- **Rust errors are strings.** `lib.rs` is 1088 lines with 113 commands, 108 of them return `Result<_, String>`.
  The interface cannot tell "not installed" from "timed out" without reading the text.
- **No Rust log.** `src-tauri/Cargo.toml` has no `tracing` or `log` crate. A user's bug report cannot include what
  Rust did.

## Target architecture

Decided by the owner on 2026-11-04: TanStack Query plus generated types (NEED-2191 = A), typed Rust errors, a log
file and `lib.rs` split by feature in a separate PR after the frontend work (NEED-2192 = A). The UI behaviour library
is still open. See [ui-libraries.md](ui-libraries.md).

```text
src/
  app/          shell, routes (lazy pages), providers (QueryClient)
  features/
    tools/
      index.ts  the public surface: what other features may import
      api.ts    the only file in the feature that calls platform: TanStack Query hooks
      store.ts  zustand: UI state and live event state only
      ToolsPage.tsx, parts/…
  shared/       parts used by two or more features: ToolIcon, ReportThis, JsonTree, safeStorage
  ui/           primitives: Button, Dialog, Tabs, Switch, Field, Progress, Table, Toast, Tooltip, Popover
  platform/     bridge.ts + generated bindings, mock loaded only in the browser build
  domain/       unchanged
src-tauri/src/
  commands/     lib.rs split: one file of commands per feature
  error.rs      thiserror enum, serialised as { kind, message }
  log.rs        tracing to a rotating file in the app's log folder
```

The rules in the target:

1. **A feature's `index.ts` is its only public surface.** A Biome rule forbids `@/features/x/anything` from outside
   `x` except `@/features/x`. Deep imports fail lint.
2. **No cycles.** A part two features need moves to `shared/`. A feature that needs another's data reads it through
   that feature's `index.ts`, and only one direction is allowed (written in the rule's message).
3. **`api.ts` is the only platform caller in a feature.** Components call hooks from `api.ts`, never `platform`.
4. **TanStack Query for request and answer.** `useQuery` for reads, `useMutation` for writes, with keys per tool and
   profile. It gives loading, error, retry, cache and refresh in one place, and removes most `useEffect` fetching.
5. **zustand only for UI state and live events.** Which row is open, the install queue, a sync's progress from a
   channel. Not a copy of an answer that a query already holds.
6. **Types come from Rust.** `tauri-specta` (or `ts-rs`) writes TypeScript types and command bindings from the Rust
   structs. valibot schemas stay at the edge only where the answer comes from outside (a tool's JSON output).
7. **Typed errors.** Rust returns `{ kind: "not_installed" | "timeout" | … , message }`. The interface picks words
   and the next step by `kind`.
8. **A log file.** `tracing` writes each command, its program, its duration and its result kind (masked by
   `redact.rs`). The bug report attaches its tail.
9. **Lazy pages.** Each page in `sections.tsx` is `lazy(() => import(...))` with a skeleton of the final shape.
10. **The mock leaves the production bundle.** `bridge.ts` loads it with a dynamic import behind
    `import.meta.env.DEV` or a build flag, so Vite drops it from the Tauri build.
11. **ui/ primitives first.** The eight missing primitives are added to `ui/` (on the chosen behaviour library) and
    the hand-written copies are replaced.

## Migration plan

Each step is one PR. Each step adds its tests first, then changes code, and leaves `pnpm check` green. Steps 1 to 4
change no behaviour.

| Step | Change | Tests added first |
| --- | --- | --- |
| 1 | Shared test helper `src/testing/render.tsx`: renders with providers, resets every store, sets English | A test that renders a page twice and sees no state from the first render |
| 2 | Move `ToolIcon`, `ReportThis`, `JsonTree`, `safeStorage` to `src/shared/` | None new: the current tests of their users must still pass. Add a lint rule: `shared` imports no feature |
| 3 | `index.ts` per feature, then the Biome rule against deep imports. Break each cycle on the way | A small script test that fails on a cycle between feature folders (reads imports, like `no-literals.test.ts`) |
| 4 | Mock out of the production bundle (dynamic import), pages lazy | A build check that greps `dist/` for a mock-only string and fails if found |
| 5 | Generated types: `tauri-specta` on the Rust side, bindings in `platform/`. Replace `types.ts` one area at a time | A Rust test that regenerates the bindings and fails if the committed file differs |
| 6 | TanStack Query: `QueryClientProvider` in `app/`, then one `api.ts` per feature, starting with `tools` | For each moved feature: component tests for loading, error and retry states with the mock |
| 7 | ui/ primitives: Progress and Tabs first (the most copies), then Switch, Field, Table, Toast, Tooltip, Popover | Per primitive: a test by role (keyboard, `aria-*`), and the Rule 9 scroll check on one page that uses it |
| 8 | Split the largest components (ConnectGuide, memory Row, onboarding steps) into parts and `domain/` functions | Domain unit tests for every rule pulled out of a component, before the move |
| 9 | Rust (separate PR): `lib.rs` split into `commands/<feature>.rs`, `thiserror` error enum, `tracing` log file | Rust tests per error kind (an unknown id gives `unknown_tool`), and a test that a logged line is masked |

**Step 5, first PR (2026-11-05).** `specta` 2.0.0-rc.26 with `specta-typescript` 0.0.13, the versions
`tauri-specta` 2.0.0-rc.26 pins, so command bindings can follow without a version change. Only types for now:
command bindings need every one of the 113 commands annotated at once, because `tauri-specta` replaces the single
`generate_handler!` list. Moved: readiness, Node.js setup, tool detection and install events, storage, community
list, app update, Cloudflare tunnel, MCP server and public address, sync and background, backups and reset, bots,
config repair. Left on valibot: agents and skills, Tailscale and the funnel helper (their URL checks stay), memory,
tasks, search, analytics, archive and compat, settings, permissions, notifications (link check), sign-in events
(URL check), runs (tool JSON) and the bug report context (tool JSON). Integers above 2^53 do not occur in these
answers, so every 64-bit integer is exported as `number` (`dangerous_bigints_as_number` in `bindings.rs`).

**Step 6, first PR (2026-11-05).** `@tanstack/react-query` with one client in `shared/query.ts`. Moved: tools
(profiles, shared by every feature that lists them; permissions; background serve), search (the tool's value lists),
analytics (extra counts, aggregates, closed tasks per week). Left: the tools store's detection and installs (read by
twelve features outside React), MCP server, sync, tunnels and the guides in tools; search's own search and profiles
(the tour writes them); analytics' page load; agents, config, logs, memory, tasks, storage, system, update,
notifications. Removed 3 of the 21 `useExhaustiveDependencies` ignores; most of the rest are focus and layout effects,
not data loading.

## Further improvements

Recommended:

- **Playwright smoke tests on the mock build.** Five to ten flows (open each page, install a tool, sign in with a
  QR) against `pnpm preview`. `playwright-core` is already installed. It catches what jsdom cannot: layout, real
  focus, real dialogs.
- **axe checks in those smoke tests** (`@axe-core/playwright`). One line per page, catches missing labels and
  contrast in both themes.
- **Bundle size budget in CI.** A script that fails when the main chunk grows past a set number of kB. It makes
  step 4's gain stay.
- **Coverage threshold for `domain/` only.** For example 90 percent lines. Domain is pure, so a high number is cheap
  and meaningful. No threshold for components: it rewards bad tests.
- **Ladle for ui/ primitives.** A small component catalogue (Vite based, lighter than Storybook) so the next
  person finds Tabs before they write a new one. Use it for `ui/` and `shared/` only.

Not recommended:

- **Storybook.** Heavier than Ladle, a second build to maintain, and the mock scenarios (`?state=…`) already show
  whole pages.
- **Snapshot tests of components.** They break on every copy change and nobody reads the diff.
- **Visual regression in CI on every PR.** Fonts and webviews differ per OS. Keep the capture script for review.
- **A router library.** The app has ten pages and a sidebar. `sections.tsx` plus lazy pages is enough.
