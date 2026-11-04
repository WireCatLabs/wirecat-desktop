# Where logic goes

A component shows state and sends events. It does not decide. Put each kind of code in its layer.

| Kind of code | Where | Example |
| --- | --- | --- |
| A rule: what a status means, which step comes next, how to read a tool's line | `src/domain/*.ts`, a pure function | [domain/status.ts](../../../src/domain/status.ts), [domain/install-progress.ts](../../../src/domain/install-progress.ts) |
| A call to Rust | **Today:** the feature's store. **Target:** the feature's `api.ts` | [features/tools/store.ts](../../../src/features/tools/store.ts) |
| The shape of Rust's answer | `src/platform/*-schemas.ts` (**Target:** generated from Rust) | [platform/schemas.ts](../../../src/platform/schemas.ts) |
| Loading, error, retry, cache of an answer | **Today:** the store, by hand. **Target:** TanStack Query in `api.ts` | |
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
- **Target.** Reads are `useQuery` and writes are `useMutation` in `api.ts`. The query key names the tool and
  profile: `["tools", "profiles", id]`.
- **Target.** zustand holds only what no query holds: UI state and the state built from a live event channel.
- **Target.** `useEffect` is for effects on the outside world (focus, a timer, a subscription). Not for loading.

## Checklist

1. Each branch about data is in a `domain/` function with a test.
2. The component file has no `platform` import.
3. No answer is stored twice (store and query).
4. No `biome-ignore` for `useExhaustiveDependencies` added. If you need one, the logic is in the wrong place.
