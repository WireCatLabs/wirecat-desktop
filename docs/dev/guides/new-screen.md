# A new screen

A screen is a page in the sidebar. It is one entry in `src/app/sections.tsx` and one folder in `src/features/`.

## Rules

- **Today.** Add `{ id, icon, page }` to [sections.tsx](../../../src/app/sections.tsx), at its place in the
  sidebar's order. The sidebar label comes from the app messages by `id`.
- **Today.** A page that belongs beside another is a tab: `tabOf: "<page>"` on its entry, nothing else; `TabbedPage`
  draws the tabs and the page keeps its own `Page` and `PageHeader` ([ARCHITECTURE.md](../ARCHITECTURE.md#pages-tabs-and-sub-pages)).
  A page reached only from another is `hidden`. Never add an entry without a `page`: it shows as a disabled item.
- **Today.** The folder holds the page, its parts, its `store.ts` and its `messages.tsx`. Copy the shape of
  [features/tasks/](../../../src/features/tasks/) (a page, a store, messages, tests).
- **Today.** The first frame has the final layout. Use `Skeleton` for values that wait (see "Loading without layout
  shift" in [ARCHITECTURE.md](../ARCHITECTURE.md#loading-without-layout-shift)).
- **Today.** Add a mock answer in `src/platform/mock-<area>.ts` so `pnpm dev` shows the page with data. Add a
  `?<area>=<state>` scenario when a state is hard to reach by clicks, and list it in [CLAUDE.md](../../../CLAUDE.md).
  A scenario is read in `src/platform/mock-<area>.ts`, or in [app/scenarios.ts](../../../src/app/scenarios.ts) when
  it opens a store's state; only a switch that opens a component's own state stays in the component.
  [scenarios-docs.test.ts](../../../src/app/scenarios-docs.test.ts) fails when CLAUDE.md and the mocks disagree.
- **Today.** Rule 9: nothing jumps, nothing vanishes. A flow of steps stays on one surface.
- **Today.** The page is lazy. `features/<area>/page.ts` exports only the page, and `sections.tsx` imports that file:
  `lazy(() => import("@/features/<area>/page").then((m) => ({ default: m.AreaPage })))`. Importing the feature's
  `index.ts` instead would pull the whole feature into the first chunk; `pnpm bundle:check` fails when the start chunk
  grows past its budget.
- **Today.** The folder has `index.ts`: what other features may import. They import nothing else from it
  (`no-cycles.test.ts`).
- **Target.** The folder has `api.ts` with its query hooks (analytics, clients, search and tools have one).

## Checklist

1. `sections.tsx` entry and sidebar label in en, ru, es.
2. Page component under 300 lines. Parts in their own files.
3. Mock answers and, if needed, a scenario.
4. An app test that opens the page from the sidebar by role (a tab: the page, then the tab by role `tab`), like
   [Storage.test.tsx](../../../src/app/Storage.test.tsx); add it to the order in
   [Navigation.test.tsx](../../../src/app/Navigation.test.tsx).
5. `node scripts/capture.mjs out.png "?section=<id>"` in light and `--dark`.
6. `node scripts/layout-shift.mjs <id> --port <port>` under budget.
7. `pnpm check`.
