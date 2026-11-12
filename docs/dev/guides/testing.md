# Testing

Vitest with jsdom and Testing Library for TypeScript ([vitest.config.ts](../../../vitest.config.ts)), `cargo test`
for Rust.

## The shape

1. **Many domain unit tests.** Pure functions in `src/domain/`, one `x.test.ts` beside `x.ts`. Fast and exact. Copy
   [domain/status.test.ts](../../../src/domain/status.test.ts).
2. **Component and flow tests by role.** Render a part or the whole `App` with the mock platform, click like a user,
   assert what a user sees. Copy [RemoveCopy.test.tsx](../../../src/features/tools/RemoveCopy.test.tsx) for a part,
   [Storage.test.tsx](../../../src/app/Storage.test.tsx) for a flow.
3. **Few end to end tests.** **Today:** none, and `bin/install-e2e` checks a real npm install in CI. `bin/own-tool-e2e` adds the real `@leemour/acme-crm-cli` from npm as an own tool and runs it through sign-in, sync, doctor, agent connection, offline and removal, by hand only (it needs the public registry). A fresh first start by hand: the skill [`try-fresh-install`](../../../.claude/skills/try-fresh-install/SKILL.md).
   **Target:** a Playwright smoke run on the mock build ([the report](../architecture-report.md#further-improvements)).
4. **Rust unit tests** in each module under `#[cfg(test)]`.

## Rules

- Find elements by role and accessible name: `getByRole("button", { name: "Remove" })`. Text only when it is short
  and the point of the test.
- Do not assert classes, pixels, colours or long copy. A copy change should not break a test.
- Spy on the platform method, not on fetch or Tauri: `vi.spyOn(platform, "removeCopy").mockResolvedValue(...)`.
- Do not reset stores by hand. [setup.ts](../../../src/testing/setup.ts) puts every store, the query client, the
  language and saved settings back before and after each test; render with
  [render.tsx](../../../src/testing/render.tsx), which adds the providers. Seed only the state the test needs.
- Use the mock's scenarios instead of building fake data in each test when one exists (`src/platform/mock-*.ts`).
- No real waits. The mock answers at once in every test ([mock-speed.ts](../../../src/testing/mock-speed.ts)); a test
  of a loading state calls `answerAtOnce(false)` to get the real delays back. Wait for what the click starts (a focus
  move, a list) before you type or read, with the default timeouts. A `{ timeout: }` only waits out the app's own
  pause, written from its `MOTION` value (a finished state held on screen), or a page made slow on purpose
  (TourSlowPage); [timeouts.test.ts](../../../src/testing/timeouts.test.ts) lists the allowed ones. A test of
  something that must take time uses fake timers or a small knob such as the logs' `timing`; a test that waits for a fade to end calls `reduceMotion()` ([motion.ts](../../../src/testing/motion.ts)) instead. A
  `vi.mock` of `mock-delay` in a test file has no effect: [setup.ts](../../../src/testing/setup.ts) loads the mock
  first.
- Every command line in `catalog/tools.json` is checked against the tools' own command lists in
  [commands.fixture.json](../../../src/features/guides/commands.fixture.json)
  ([catalog-commands.test.ts](../../../src/domain/catalog-commands.test.ts)): an option a tool removed fails, and so
  does a `null` gate on a command the tool has released. After a tool release, refresh the list with
  `node scripts/guide-commands.mjs` (it runs only `commands --json` and `--help`, D-Bus off).
- Write the test name as a sentence about behaviour, without a comment above it.
- A new rule in `domain/` always gets a unit test. A new screen gets one flow test.

## Probes

A Rust test marked `#[ignore]` is a probe: it runs real tools, the network or an end to end script, never in CI.
The probes that read the owner's real store or accounts, ask a real agent, or change this computer (Tailscale Funnel)
return at once unless `WIRECAT_PROBES` names what they may touch ([probe.rs](../../../src-tauri/src/probe.rs)):
`tool:profile` pairs, or a bare `tool` without profiles, comma-separated, such as
`WIRECAT_PROBES=tg:personal,memo cargo test real_search -- --ignored --nocapture`. No profile is written into a probe.
The others need the network (the community list, Node.js, cloudflared, npm), or a throwaway store and memo through
`MEMO_BIN` or `MESSAGING_STORE`, as their `#[ignore]` reason says. Never run `cargo test -- --include-ignored` on
the whole crate: it downloads about 60 MB and starts the end to end installs.

## Memory

The machine is small. Check `free -g` before a suite. `vitest.config.ts` allows 4 workers. With less than about
12 GB free, run one: `pnpm test -- --maxWorkers=1`. Run one file while you work: `pnpm test src/domain/status.test.ts`.
One heavy command at a time: not `pnpm test` and `cargo test` together.

## Checklist

1. Domain function tested.
2. Component tested by role, no class or pixel assertions.
3. No store reset by hand, no real wait, no timeout above the default.
4. `pnpm test` green, then `pnpm check` before the PR.
