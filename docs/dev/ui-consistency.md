# UI consistency: one component per job

The owner saw the same job look different from page to page (Memory's filters and tabs, for one). This page names the
one component for each UI job, lists every place that still does the job by hand, and says what replaces it. Audited
on 2026-11-10 against `main` at `3b43e392`. A row is removed from the table once its fix is merged.

## The canonical components

| Job | Use | Not |
|---|---|---|
| Page frame and header: title, β badge, a live status beside the title, intro with a guide link, actions on the right | `Page` and `PageHeader` (`src/shared/Page.tsx`; in `shared/` because the guide link opens through the platform and the β badge will read the section list) | a hand-written `h1` with the display classes |
| Guide link at the end of an intro | `PageHeader`'s `guide` prop | an `<a>`/`<button>` with `ExternalLink` per page |
| Read again / Check again | `RefreshButton` (`src/ui/RefreshButton.tsx`) | a `Button` with its own `RefreshCw` and spinner |
| Search field with filter chips | `FilterBar`, `FilterMenu`, `ToggleChip` | — (all four pages already use it) |
| A one-of-few switch: view, status tab, range, "by people / by chats" | `Segmented` (`size="md"` with labels; `count` per option) | a hand `fieldset` of radios or `aria-pressed` buttons |
| Content tabs (panels under them) | `Tabs`/`TabList`/`Tab` (React Aria) | — |
| Table | `DataTable` | a `<table>` for a list of records (a key–value list or a chart legend may stay a table) |
| Pager | `Pager` with `PAGE_SIZES`, pages from the server | slicing a list loaded whole |
| Empty state and "nothing matches" | `EmptyState` (`src/ui/EmptyState.tsx`) | a bordered `div` per page |
| Loading | `Skeleton` in the shape of what comes; `PageSkeleton` for a page | a spinner where the shape is known |
| Error | `ErrorNotice` | a red box by hand |
| Warning or notice banner | `ErrorNotice` with a `tone` (`bad` by default, `warn`), extended rather than a second component | `border-warn/40 bg-warn/10` by hand |
| Status word on a record | `Pill`, words from one state set per feature | two word sets for the same states |
| Status light | `Lamp` (39 files use it) | a coloured dot by hand |
| Buttons | `Button` (`primary` once per surface, `secondary`, `ghost`, `danger`; `sm` in headers and rows) | a styled `<button>` |
| Dialog | `Dialog` | — (checked: no `aria-modal` or `fixed inset-0` outside `ui/`; Bell and Calendar are popovers, not dialogs) |

## Findings

Ids are local to this page. "Owner" is who is editing that area now; rows marked *wait* are changed after their
work merges, to avoid conflicts.

| Id | Job | Where (file:line on `3b43e392`) | Fix | Owner |
|---|---|---|---|---|
| C1 | Page header | 14 pages repeat the `h1` classes, the intro paragraph and the action row: `memory/MemoryPage.tsx:69`, `people/PeoplePage.tsx:38`, `clients/ClientsPage.tsx:47`, `tasks/TasksPage.tsx:43`, `digests/DigestsPage.tsx:60`, `search/SearchPage.tsx:110`, `tools/ToolsPage.tsx:52`, `storage/StoragePage.tsx:52`, `analytics/AnalyticsPage.tsx:34`, `config/ConfigPage.tsx:86`, `logs/LogsPage.tsx:181`, `agents/PageParts.tsx:28`, `guides/GuidesPage.tsx:135` | `PageHeader` | done on Search, Tools, Storage, Analytics, Settings, Logs, Agents, Guides; *wait*: Memory, People, Clients, Tasks, Digests |
| C2 | Page frame | 16 roots repeat `flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]`; Guides uses `gap-[1.8rem] pb-[3rem]` | `Page` | as C1 |
| C3 | Intro width and size | intros are `max-w-[72ch]` on five pages and `max-w-[70ch]` on five, Guides `62ch` at 1.02rem; all at 0.95rem while DESIGN.md sets body to `text-body` (1rem) | `PageHeader`: 70ch, `text-body` | as C1 |
| C4 | Live status beside the title | Tools, Storage and Analytics each build "spinner + text" beside the `h1`; Guides puts plain text there | `PageHeader`'s `status` | free |
| C5 | Guide link | five copies: `MemoryPage.tsx:72`, `PeoplePage.tsx:41`, `TasksPage.tsx:46`, `SearchPage.tsx:113`, `LogsPage.tsx:184`; two are `<a>`, three `<button>` | `PageHeader`'s `guide` | as C1 |
| C6 | β badge | being added by hand inside each `h1` (Digests/Contacts session, `shared/BetaBadge`) | `PageHeader` reads `section` and shows the badge itself | that session; folded in after it merges |
| C7 | Read again | eight copies, three spinner styles (`animate-spin`, `motion-safe:animate-spin`, a swapped `LoaderCircle`): `MemoryPage.tsx:89`, `PeoplePage.tsx:58`, `DigestsPage.tsx:66`, `ClientsPage.tsx:52`, `TasksPage.tsx:62`, `LogsPage.tsx:222`, `agents/PageParts.tsx:32`, `tools/ToolsPage.tsx:66` (a raw `<button>`) | `RefreshButton` | free: Logs, Agents, Tools; *wait*: the rest |
| C8 | Status tabs | Memory's tabs are a hand `fieldset` 2.8rem tall (`MemoryPage.tsx:365`); Tasks, Clients and People use `Segmented size="md"` (2rem); People writes its counts into the label string | `Segmented` with a `count` per option and `icon` optional; the switch becomes 2rem tall, as on Tasks | *wait* (Memory page is being edited by two sessions) |
| C9 | Range switch | Logs' range is a hand `fieldset` copy of Segmented at 2.8rem (`LogsPage.tsx:496`) | `Segmented size="md"` | free |
| C10 | Toggle-button groups | three hand groups of `aria-pressed` buttons, a third look: `storage/TablesExplorer.tsx:208`, `analytics/sections.tsx:351`, `storage/ArchiveSummary.tsx:113` | `Segmented size="md"` | free |
| C11 | Empty states | 12 hand boxes with four paddings (`py-4`, `py-5`, `py-[1.2rem]`, `py-[1.4rem]`, `py-[1.6rem]`); two local `Empty` components (`SearchPage.tsx:651`, `LogsPage.tsx:549`) and one in `ClientsPage.tsx:228` | `EmptyState` (title, body, action) | free: Search, Logs, Agents; *wait*: Memory, Clients, People, Digests, Tasks |
| C12 | Warning banners | 20 hand warn boxes with four radii and three paddings, plus a local `Banner` (`config/ConfigPage.tsx:440`) | `ErrorNotice tone="warn"` | free: Settings, Agents, Tools; dialogs later |
| C13 | Skeletons | page-local skeletons are fine (they draw the shape), but `RackSkeleton` (Memory) and `ListSkeleton` (People) draw the same rack | keep; share only when a third copy appears | — |
| C14 | Hand tables | `logs/RunsTable.tsx`, `storage/TablesExplorer.tsx`, `agents/AgentsMatrix.tsx`, `search/SearchPage.tsx` (an inline `<table>`) are record lists outside `DataTable`; analytics and storage facts are key–value or chart tables and may stay | `DataTable` (sorting, density, paging) | Logs and Storage next; Agents matrix is a grid of switches, kept |
| C15 | Paging rule (12) | Memory loads the whole list and slices it (`MemoryPage.tsx:51`); Logs runs, Digests table, Storage tables and Agents' skills have no pager | server paging; Memory needs memo paging on its reads first | Memory: the coordinator routes it to the CLI side; the others are Desktop work |
| C16 | Disabled-for-validation rule (10) | being fixed page by page by the Digests/Contacts session (`useFieldError`) | — | that session |
| C17 | Presets above lists rule (11) | Digests only today; being fixed by the Digests session | — | that session |
| C18 | Memory state words | tabs said «В работе», «На проверку» while row pills said «Используется», «Ждёт решения» (two sets in `memory/messages.ts` and `messages-explained.ts`) | one set per language | #272 (delete this row when it merges) |
| C19 | Text sizes | 562 uses of `text-[0.9rem]`, 291 of `text-[0.95rem]`, 58 of `text-body`; DESIGN.md says body copy is `text-body` | shared components use `text-body`; pages move as they are touched | debt, no sweep |
| C20 | Hand-styled buttons | Tools' header actions were a raw `<button>` with its own classes; Guides' `SiteLink`, the Guides jump list and the HelpMenu rows are raw buttons by design (links and menu items) | `Button`; links and menu items stay | Tools done |
| C21 | Count beside a label | Memory tabs, Guides' jump list and Storage's table groups each style the number (`font-mono text-[0.85rem] text-ink-dim`) by hand | `Segmented`'s `count` | with C8 and C10 |
| C22 | Header button sizes | Logs used `md` secondary buttons in its header, every other page `sm` | `sm` in headers | done on Logs |
| C23 | Search field without chips | Guides has its own search input (2.6rem tall) next to FilterBar's (2.8rem) | `FilterBar` once it allows no chips | later |

## Where the owner's rules stand

- **A button is never disabled for a missing or wrong value** (CLAUDE.md rule 10): the Digests/Contacts session is
  adding `useFieldError` and fixing pages one by one.
- **Creation presets above lists** (rule 11): Digests; no other page creates from presets today.
- **Every list pages on the server** (rule 12): see C15.
