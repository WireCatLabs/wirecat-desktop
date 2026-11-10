# UI consistency: one component per job

The owner saw the same job look different from page to page (Memory's filters and tabs, for one). This page names the
one component for each UI job, lists every place that still does the job by hand, and says what replaces it. Audited
on 2026-11-10. A row is removed once its fix is merged; a row half done lists only what is left.

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
| C1 | Page header | five pages still write the `h1` classes, the intro and the action row by hand: `memory/MemoryPage.tsx`, `people/PeoplePage.tsx`, `clients/ClientsPage.tsx`, `tasks/TasksPage.tsx`, `digests/DigestsPage.tsx` (Search, Tools, Storage, Analytics, Settings, Logs, Agents and Guides use `PageHeader`) | `PageHeader` | *wait* for the sessions editing those pages |
| C2 | Page frame | the same five pages and `conversation/ConversationPage.tsx`, `links/LinkPage.tsx` repeat the frame classes | `Page` | *wait* as C1; Conversation and Link pages free |
| C3 | Intro width and size | the five pages in C1 set the intro at 72ch and 0.95rem; DESIGN.md sets body copy to `text-body` at 70ch | `PageHeader` | with C1 |
| C5 | Guide link | Memory, People and Tasks each write the link with its icon (two `<a>`, one `<button>`); `ExtLink` (`shared/ExtLink.tsx`) is the one external link | `PageHeader`'s `guide` | with C1 |
| C6 | β badge | being added by hand inside each `h1` (Digests/Contacts session, `shared/BetaBadge`) | `PageHeader` reads `section` and shows the badge itself | that session; folded in after it merges |
| C7 | Read again | five copies left, with two spinner styles: Memory, People, Digests, Clients, Tasks | `RefreshButton` (stays enabled while busy, so focus stays) | with C1 |
| C8 | Status tabs | Memory's tabs are a hand `fieldset` 2.8rem tall (`MemoryPage.tsx:365`); Tasks, Clients and People use `Segmented size="md"` (2rem); People writes its counts into the label string | `Segmented` with a `count` per option and `icon` optional; the switch becomes 2rem tall, as on Tasks | *wait* (Memory page is being edited by two sessions) |
| C9 | Range switch | Logs' range is a hand `fieldset` copy of Segmented at 2.8rem (`Range` in `logs/LogsPage.tsx`) | `Segmented size="md"` | free |
| C10 | Toggle-button groups | three hand groups of `aria-pressed` buttons, a third look: `GroupFilter` in `storage/TablesExplorer.tsx`, the senders/chats switch in `analytics/sections.tsx`, "Break down by" in `storage/ArchiveSummary.tsx` | `Segmented size="md"` | free |
| C11 | Empty states | 12 hand boxes with five paddings (`py-4`, `py-5`, `py-[1.2rem]`, `py-[1.4rem]`, `py-[1.6rem]`); local `Empty` components in `search/SearchPage.tsx`, `logs/LogsPage.tsx` and `clients/ClientsPage.tsx` | `EmptyState` | free: Search, Logs, Agents; *wait*: Memory, Clients, People, Digests, Tasks |
| C12 | Warning banners | 20 hand warn boxes with four radii and three paddings, plus a local `Banner` in `config/ConfigPage.tsx` | `ErrorNotice tone="warn"` | free: Settings, Agents, Tools; dialogs later |
| C13 | Skeletons | page-local skeletons are fine (they draw the shape), but `RackSkeleton` (Memory) and `ListSkeleton` (People) draw the same rack | keep; share only when a third copy appears | — |
| C14 | Hand tables | `logs/RunsTable.tsx`, `storage/TablesExplorer.tsx`, `agents/AgentsMatrix.tsx`, `search/SearchPage.tsx` (an inline `<table>`) are record lists outside `DataTable`; analytics and storage facts are key–value or chart tables and may stay | `DataTable` (sorting, density, paging) | Logs and Storage next; Agents matrix is a grid of switches, kept |
| C15 | Paging rule (12) | Memory loads the whole list and slices it (`MemoryPage.tsx:51`); Logs runs, Digests table, Storage tables and Agents' skills have no pager | server paging; Memory needs memo paging on its reads first | Memory: the coordinator routes it to the CLI side; the others are Desktop work |
| C16 | Disabled-for-validation rule (10) | being fixed page by page by the Digests/Contacts session (`useFieldError`) | — | that session |
| C17 | Presets above lists rule (11) | Digests only today; being fixed by the Digests session | — | that session |
| C18 | Memory state words | tabs said «В работе», «На проверку» while row pills said «Используется», «Ждёт решения» (two sets in `memory/messages.ts` and `messages-explained.ts`) | one set per language | #272 (delete this row when it merges) |
| C19 | Text sizes | 562 uses of `text-[0.9rem]`, 291 of `text-[0.95rem]`, 58 of `text-body`; DESIGN.md says body copy is `text-body` | shared components use `text-body`; pages move as they are touched | debt, no sweep |
| C20 | Hand-styled buttons and links | Guides' jump list and the HelpMenu rows are raw buttons by design (menu items); external links now all go through `ExtLink` | `Button`, `ExtLink` | — |
| C21 | Count beside a label | Memory tabs, Guides' jump list and Storage's table groups each style the number (`font-mono text-[0.85rem] text-ink-dim`) by hand | `Segmented`'s `count` | with C8 and C10 |
| C23 | Search field without chips | Guides has its own search input (2.6rem tall) next to FilterBar's (2.8rem) | `FilterBar` once it allows no chips | later |

## Where the owner's rules stand

- **A button is never disabled for a missing or wrong value** (CLAUDE.md rule 10): the Digests/Contacts session is
  adding `useFieldError` and fixing pages one by one.
- **Creation presets above lists** (rule 11): Digests; no other page creates from presets today.
- **Every list pages on the server** (rule 12): see C15.
