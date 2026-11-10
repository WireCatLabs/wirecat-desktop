# Reuse before you write

Search first. Most things this app needs exist once already.

## Where shared things live

| What | Where today | Target |
| --- | --- | --- |
| Buttons, dialogs, selects, skeletons, steppers, copy fields | [src/ui/](../../../src/ui/) | same |
| Motion, focus without a jump, scroll helpers | [ui/motion.ts](../../../src/ui/motion.ts) | same |
| Class names joined | [ui/cx.ts](../../../src/ui/cx.ts) | same |
| Formatting numbers, sizes, dates | [domain/format.ts](../../../src/domain/format.ts) | same |
| Tool list, ids, owners, profiles | [domain/catalog.ts](../../../src/domain/catalog.ts) | same |
| Tool icon: the service's logo beside its name | [shared/ToolIcon.tsx](../../../src/shared/ToolIcon.tsx) | same |
| A logo standing in for the service's name (`@kai_m` with Telegram's logo, not "Telegram @kai_m") | [shared/ServiceIcon.tsx](../../../src/shared/ServiceIcon.tsx) | same |
| A page that needs a tool: missing, too old, signed out, with the button to fix it | [features/tools/ToolNeeded.tsx](../../../src/features/tools/ToolNeeded.tsx), `useNeed` and the rule in [domain/needs.ts](../../../src/domain/needs.ts) | same |
| "Report this" button | [features/report/ReportThis.tsx](../../../src/features/report/ReportThis.tsx) | `src/shared/` |
| JSON viewer | [features/logs/JsonTree.tsx](../../../src/features/logs/JsonTree.tsx) | `src/shared/` |
| localStorage that never throws | `safeStorage` in [onboarding/store.ts](../../../src/features/onboarding/store.ts) | `src/shared/` |
| A button that opens a web page, with its link to copy beside it | [shared/OpenLink.tsx](../../../src/shared/OpenLink.tsx) | same |
| An inline web link; any other element that opens a page gets `externalHref(url)` so right-click can copy it | [shared/ExtLink.tsx](../../../src/shared/ExtLink.tsx), [shared/external-href.ts](../../../src/shared/external-href.ts) | same |
| Query bar of Logs and Search | [features/query/](../../../src/features/query/) | same |
| Running a program in Rust | [run.rs](../../../src-tauri/src/run.rs) | same |
| Masking personal data in Rust | [redact.rs](../../../src-tauri/src/redact.rs) | same |
| Finding a tool's binary | [paths.rs](../../../src-tauri/src/paths.rs), `tools::program` | same |

## How to search

```sh
ls src/ui src/domain
grep -rn "role=\"progressbar\"" src --include=*.tsx
grep -rln "export function <Name>" src
```

## Rule of two

- **One use:** keep it where it is used.
- **Second use:** extract it before you write the second copy. A presentational part goes to `ui/`, a part that
  knows data to `shared/` (**Target**, today the feature that owns it), a rule to `domain/`.
- Never copy a component and edit the copy. Add a prop or a variant instead.
- When you find an existing copy (a hand-made progress bar, a tab list), replace it with the shared one in the same
  PR if it is small, or note it in the PR.

## Do not reinvent

- Not a new modal: `Dialog`. Not a new collapse: `Collapse` or `Disclosure`. Not a new loader: `Skeleton`.
- Not a new fetch layer: the store (**Today**) or `api.ts` with TanStack Query (**Target**).
- Not a tool's own feature: rule 1 says the CLI gets it, the app calls it.
