# Reuse before you write

Search first. Most things this app needs exist once already.

## Where shared things live

| What | Where |
| --- | --- |
| Buttons, dialogs, selects, skeletons, steppers, copy fields | [src/ui/](../../../src/ui/) |
| Motion, focus without a jump, scroll helpers | [ui/motion.ts](../../../src/ui/motion.ts) |
| Class names joined | [ui/cx.ts](../../../src/ui/cx.ts) |
| Formatting numbers, sizes, dates | [domain/format.ts](../../../src/domain/format.ts) |
| Tool list, ids, owners, profiles | [domain/catalog.ts](../../../src/domain/catalog.ts) |
| Tool icon: the service's logo beside its name | [shared/ToolIcon.tsx](../../../src/shared/ToolIcon.tsx) |
| A logo standing in for the service's name (`@kai_m` with Telegram's logo, not "Telegram @kai_m") | [shared/ServiceIcon.tsx](../../../src/shared/ServiceIcon.tsx) |
| A page that needs a tool: missing, too old, signed out, with the button to fix it | [shared/ToolNeeded.tsx](../../../src/shared/ToolNeeded.tsx), `useNeed` in [shared/needs.ts](../../../src/shared/needs.ts) and the rule in [domain/needs.ts](../../../src/domain/needs.ts) |
| "Report this" button | [shared/ReportThis.tsx](../../../src/shared/ReportThis.tsx) |
| JSON viewer | [shared/JsonTree.tsx](../../../src/shared/JsonTree.tsx) |
| localStorage that never throws; a zustand `persist` takes it through `createJSONStorage(() => safeStorage)` | [shared/safe-storage.ts](../../../src/shared/safe-storage.ts) |
| A failure as text | `errorText` in [shared/errors.ts](../../../src/shared/errors.ts), the only one |
| A CLI's `reason` the page words itself, or null | `knownReason` in [domain/reasons.ts](../../../src/domain/reasons.ts) |
| Why a terminal did not open (`reason` from Rust) | [shared/messages-terminal.ts](../../../src/shared/messages-terminal.ts) |
| Copy to the clipboard, with "Copied" or "Could not copy" | [ui/CopyButton.tsx](../../../src/ui/CopyButton.tsx), the only copy (a one-way rule) |
| A button that waits: spinner, `aria-busy`, keeps focus | `Button busy` in [ui/Button.tsx](../../../src/ui/Button.tsx) |
| A field's error under it | `useFieldError` and `FieldError` in [ui/FieldError.tsx](../../../src/ui/FieldError.tsx) |
| A dialog's first focus | `data-autofocus` on the element; [ui/Dialog.tsx](../../../src/ui/Dialog.tsx) focuses it after it opens. React's `autoFocus` does nothing there |
| Asking again every few seconds | `usePoll` in [shared/use-poll.ts](../../../src/shared/use-poll.ts), or a query's `refetchInterval` |
| A clock that ticks each second; seconds since | `useNow`, `useElapsed` in [shared/use-elapsed.ts](../../../src/shared/use-elapsed.ts) |
| "5 minutes ago" | `ago` in [i18n/ago.ts](../../../src/i18n/ago.ts) |
| Russian counts (one, few, many) | `pluralRu` in [i18n/index.ts](../../../src/i18n/index.ts) |
| A record without one key | `without` in [domain/record.ts](../../../src/domain/record.ts) |
| A tool's query keys | `toolKeys` in [shared/query.ts](../../../src/shared/query.ts) |
| A button that opens a web page, with its link to copy beside it | [shared/OpenLink.tsx](../../../src/shared/OpenLink.tsx) |
| An inline web link, the only one (a one-way rule); any other element that opens a page gets `externalHref(url)` so right-click can copy it | [shared/ExtLink.tsx](../../../src/shared/ExtLink.tsx), [shared/external-href.ts](../../../src/shared/external-href.ts) |
| Query bar of Logs and Search | [features/query/](../../../src/features/query/) |
| Running a program in Rust | [run.rs](../../../src-tauri/src/run.rs) |
| Masking personal data in Rust | [redact.rs](../../../src-tauri/src/redact.rs) |
| Finding a tool's binary | [paths.rs](../../../src-tauri/src/paths.rs), `tools::program` |

## How to search

```sh
ls src/ui src/shared src/domain
grep -rn "role=\"progressbar\"" src --include=*.tsx
grep -rln "export function <Name>" src
```

`pnpm dlx knip@5` lists files and exports nothing imports ([knip.json](../../../knip.json) names the entries). Run it
after a move or a removal.

## Rule of two

- **One use:** keep it where it is used.
- **Second use:** extract it before you write the second copy. A presentational part goes to `ui/`, a part that
  knows data to `shared/`, a rule to `domain/`.
- Never copy a component and edit the copy. Add a prop or a variant instead.
- When you find an existing copy (a hand-made progress bar, a tab list), replace it with the shared one in the same
  PR if it is small, or note it in the PR.

## Do not reinvent

- Not a new modal: `Dialog`. Not a new collapse: `Collapse` or `Disclosure`. Not a new loader: `Skeleton`.
- Not a new fetch layer: a query in the feature's `api.ts`, or its store ([application-logic.md](application-logic.md)).
- Not a tool's own feature: rule 1 says the CLI gets it, the app calls it.
