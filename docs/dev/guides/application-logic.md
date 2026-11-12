# Where logic goes

A component shows state and sends events. It does not decide. Put each kind of code in its layer.

| Kind of code | Where | Example |
| --- | --- | --- |
| A rule: what a status means, which step comes next, how to read a tool's line | `src/domain/*.ts`, a pure function | [domain/status.ts](../../../src/domain/status.ts), [domain/install-progress.ts](../../../src/domain/install-progress.ts) |
| A call to Rust | a query hook in the feature's `api.ts` (analytics, clients, search, tools), or the feature's store | [features/tools/api.ts](../../../src/features/tools/api.ts), [shared/tools-store.ts](../../../src/shared/tools-store.ts) |
| The shape of Rust's answer | generated [platform/bindings.ts](../../../src/platform/bindings.ts), or an older hand schema in `src/platform/*-schemas.ts` | [platform/schemas.ts](../../../src/platform/schemas.ts) |
| Loading, error, retry, cache of an answer | TanStack Query in `api.ts`, or the store by hand ([below](#the-shape-of-a-store)) | [shared/query.ts](../../../src/shared/query.ts) |
| Asking again on a timer | `usePoll` (skips a tick while the window is hidden, never runs two at once), or a query's `refetchInterval` | [shared/use-poll.ts](../../../src/shared/use-poll.ts) |
| Saved in the browser | a zustand `persist` with `safeStorage` (never throws where storage is refused) | [shared/safe-storage.ts](../../../src/shared/safe-storage.ts) |
| UI state: open row, selected tab, a queue, live progress from events | zustand store in the feature | `expanded`, `sessions` in the tools store |
| What the screen shows for a state | the component, reading the store or hooks | [ToolRow.tsx](../../../src/features/tools/ToolRow.tsx) |
| Text | the feature's `messages.tsx` | [system/messages.tsx](../../../src/features/system/messages.tsx) |

## Rules

- **Today.** A rule with a branch goes to `domain/` with a unit test. If you write `if` about tool states in a
  component, stop and move it.
- **Today.** `domain/` imports nothing above it: no React, no zustand, no platform (Biome enforces it).
- **Today.** A store calls `platform` and keeps the result. A component never imports `platform` in new code, even
  though 36 components do today.
- **Today.** Never pick a profile or account for the owner (rule 3). A function that needs one takes it as an
  argument.
- **Today.** Reads are `useQuery` and writes are `useMutation` in `api.ts` where a feature has one. There is one
  `QueryClient` (`queryClient()` in [shared/query.ts](../../../src/shared/query.ts)): no retry, no read again on
  focus or reconnect, because each read starts a tool. A tool's key comes from `toolKeys` and starts with the tool:
  `["tool", id, "profiles"]`. A query that must read again when the owner comes back to the window sets
  `refetchOnWindowFocus: true`; window focus counts, not only visibility.
- **Target.** Every feature reads through `api.ts`; the stores that call `platform` move there.
- **Target.** zustand holds only what no query holds: UI state and the state built from a live event channel.
- **Today.** A component reads a store through a selector, `useStore((s) => s.field)`, or several fields at once
  with `useStore(useShallow((s) => ({ a: s.a, b: s.b })))`. A bare `useStore()` re-renders on every change of the
  store; only a container that hands the whole state to a helper keeps it.
- **Target.** `useEffect` is for effects on the outside world (focus, a timer, a subscription). Not for loading.

- **Today.** A failure becomes text only through `errorText(e)` from
  [shared/errors.ts](../../../src/shared/errors.ts). A CLI's `reason` is matched with `knownReason`
  ([domain/reasons.ts](../../../src/domain/reasons.ts)); an unknown one gets the page's generic sentence, and the tool's
  own text goes under Details (`ErrorNotice raw`), never into the sentence.

## The shape of a store

New stores use these names; an older store is renamed when it is next changed.

- **A list of records** (people, memory, tasks): the page read has `readAt: number | null` and
  `error: string | null`. Actions on one record are kept by its key: `busy: Record<string, Op>` while it runs,
  `failed: Record<string, string>` with the failure's text, and `done: Record<string, Done>` for what the row says
  happened. A full read clears all three. Example: [features/people/store.ts](../../../src/features/people/store.ts).
- **One thing** (a setting, the AI model, a digest book): the value is `null` until the first answer, and the read's
  failure is `error: string | null`. One action runs at a time: `busy: Op | null`. Its failure is
  `failed: { what: Op; message: string } | null`, so the page names what did not happen. No `actionError`,
  `chooseError` or `readError` beside it.
- **A value that loads in parts** (a person's details, a page of doubts): a union with `state`:
  `{ state: "loading" } | { state: "ready"; … } | { state: "failed"; error: string }`. The failure's text is `error`,
  never `message`.

## Checklist

1. Each branch about data is in a `domain/` function with a test.
2. The component file has no `platform` import.
3. No answer is stored twice (store and query).
4. No `biome-ignore` for `useExhaustiveDependencies` added. If you need one, the logic is in the wrong place.
