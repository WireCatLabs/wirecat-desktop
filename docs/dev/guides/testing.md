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
- Reset the stores you touch in `beforeEach`: `useTools.setState(useTools.getInitialState(), true)`.
  [setup.ts](../../../src/testing/setup.ts) resets nav, language and kept state after each test.
  **Target:** a shared `src/testing/render.tsx` does all resets and providers.
- Use the mock's scenarios instead of building fake data in each test when one exists (`src/platform/mock-*.ts`).
- No real waits. A flow test calls `answerAtOnce()` ([mock-speed.ts](../../../src/testing/mock-speed.ts)) so the mock
  answers at once, and waits for what the click starts (a focus move, a list) before it types or reads. A `vi.mock`
  of `mock-delay` in a test file has no effect: [setup.ts](../../../src/testing/setup.ts) loads the mock first.
- Every command line in `catalog/tools.json` is checked against the tools' own command lists in
  [commands.fixture.json](../../../src/features/guides/commands.fixture.json)
  ([catalog-commands.test.ts](../../../src/domain/catalog-commands.test.ts)): an option a tool removed fails, and so
  does a `null` gate on a command the tool has released. After a tool release, refresh the list with
  `node scripts/guide-commands.mjs` (it runs only `commands --json` and `--help`, D-Bus off).
- Write the test name as a sentence about behaviour, without a comment above it.
- A new rule in `domain/` always gets a unit test. A new screen gets one flow test.

## Memory

The machine is small. Check `free -g` before a suite. `vitest.config.ts` allows 4 workers. With less than about
12 GB free, run one: `pnpm test -- --maxWorkers=1`. Run one file while you work: `pnpm test src/domain/status.test.ts`.
One heavy command at a time: not `pnpm test` and `cargo test` together.

## Checklist

1. Domain function tested.
2. Component tested by role, no class or pixel assertions.
3. Stores reset.
4. `pnpm test` green, then `pnpm check` before the PR.
