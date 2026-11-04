# A new screen

A screen is a page in the sidebar. It is one entry in `src/app/sections.tsx` and one folder in `src/features/`.

## Rules

- **Today.** Add `{ id, icon, page }` to [sections.tsx](../../../src/app/sections.tsx). The sidebar label comes from
  the app messages by `id`.
- **Today.** The folder holds the page, its parts, its `store.ts` and its `messages.tsx`. Copy the shape of
  [features/tasks/](../../../src/features/tasks/) (a page, a store, messages, tests).
- **Today.** The first frame has the final layout. Use `Skeleton` for values that wait (see "Loading without layout
  shift" in [ARCHITECTURE.md](../ARCHITECTURE.md#loading-without-layout-shift)).
- **Today.** Add a mock answer in `src/platform/mock-<area>.ts` so `pnpm dev` shows the page with data. Add a
  `?<area>=<state>` scenario when a state is hard to reach by clicks, and list it in [CLAUDE.md](../../../CLAUDE.md).
- **Today.** Rule 9: nothing jumps, nothing vanishes. A flow of steps stays on one surface.
- **Target.** The page is lazy: `page: lazy(() => import("@/features/<area>"))`.
- **Target.** The folder has `index.ts` (exports the page and what others may use) and `api.ts` (query hooks).

## Checklist

1. `sections.tsx` entry and sidebar label in en, ru, es.
2. Page component under 300 lines. Parts in their own files.
3. Mock answers and, if needed, a scenario.
4. An app test that opens the page from the sidebar by role, like
   [Storage.test.tsx](../../../src/app/Storage.test.tsx).
5. `node scripts/capture.mjs out.png "?section=<id>"` in light and `--dark`.
6. `node scripts/layout-shift.mjs <id> --port <port>` under budget.
7. `pnpm check`.
