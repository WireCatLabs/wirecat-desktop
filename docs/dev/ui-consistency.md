# UI consistency: one component per job

The owner saw the same job look different from page to page (Memory's filters and tabs, for one). This page names the
one component for each UI job, lists every place that still does the job by hand, and says what replaces it. Audited
on 2026-11-10. A row is removed once its fix is merged; a row half done lists only what is left.

## The canonical components

| Job | Use | Not |
|---|---|---|
| Page frame and header: title, β badge, a live status beside the title, intro with a guide link, actions on the right | `Page` and `PageHeader` (`src/shared/Page.tsx`; in `shared/` because the guide link opens through the platform and the β badge reads the section list) | a hand-written `h1` with the display classes |
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
| A short explanation on hover or focus: an "i", a badge with its reason, a card's details | `InfoTip` for a trigger of its own (`trigger` for a badge); `useTip` and `TipPanel` (`src/ui/Tooltip.tsx`) on an element that is already interactive, such as a board card. The panel goes outside every scrolling box | a `title` attribute, an absolutely placed box inside a scroller |
| Status word on a record | `Pill`, words from one state set per feature | two word sets for the same states |
| Status light | `Lamp` (39 files use it) | a coloured dot by hand |
| Buttons | `Button` (`primary` once per surface, `secondary`, `ghost`, `danger`; `sm` in headers and rows) | a styled `<button>` |
| Dialog | `Dialog` | — (checked: no `aria-modal` or `fixed inset-0` outside `ui/`; Bell and Calendar are popovers, not dialogs) |

## Findings

Ids are local to this page. "Owner" is who is editing that area now; "free" means nobody is.

| Id | Job | Where (on `82c0c839` and the owned-pages PR) | Fix | Owner |
|---|---|---|---|---|
| C2 | Page frame | `conversation/ConversationPage.tsx` and `links/LinkPage.tsx` repeat the frame classes (every other page uses `Page`) | `Page` | free |
| C11 | Empty states | the not-found boxes of `links/LinkPage.tsx` and `conversation/ConversationPage.tsx` (44rem wide, with their own actions) | `EmptyState` | free, with C2 |
| C7 | Check again inside a panel | `tools/Health.tsx` (two), `tools/Permissions.tsx`, `agents/AgentDetails.tsx` draw their own `RefreshCw` with `animate-spin`; Health and AgentDetails disable the button while it checks, so focus is lost | `RefreshButton` | free |
| C12 | Warning banners | 13 hand warn boxes, mostly in dialogs and Tools panels: `tools/ToolDetails.tsx`, `StorageFit.tsx`, `PreflightNotice.tsx`, `Permissions.tsx`, `OwnReview.tsx`, `ConnectReach.tsx`, `signin/BotSteps.tsx`, `signin/SignInDialog.tsx`, `agents/ConnectDialog.tsx`, `storage/BackupPassword.tsx`, `storage/ClearStorageDialog.tsx`, `system/NodeNotice.tsx`, `people/Matches.tsx` | `ErrorNotice tone="warn"` | free |
| C13 | Skeletons | page-local skeletons are fine (they draw the shape), but `RackSkeleton` (Memory) and `ListSkeleton` (People) draw the same rack | keep; share only when a third copy appears | — |
| C14 | Hand tables | `logs/RunsTable.tsx`, `storage/TablesExplorer.tsx`, `agents/AgentsMatrix.tsx`, `search/SearchPage.tsx` (an inline `<table>`) are record lists outside `DataTable`; analytics and storage facts are key–value or chart tables and may stay | `DataTable` (sorting, density, paging) | Logs and Storage next; Agents matrix is a grid of switches, kept |
| C15 | Paging rule (12) | Memory loads the whole list and slices it (`MemoryPage.tsx:54`); Logs runs, Digests' two tables (digests, other schedules), Storage tables and Agents' skills have no pager | server paging; Memory needs memo paging on its reads first | Memory: the coordinator routes it to the CLI side; the others are Desktop work |
| C19 | Text sizes | 562 uses of `text-[0.9rem]`, 291 of `text-[0.95rem]`, 58 of `text-body`; DESIGN.md says body copy is `text-body` | shared components use `text-body`; pages move as they are touched | debt, no sweep |
| C20 | Hand-styled buttons and links | Guides' jump list and the HelpMenu rows are raw buttons by design (menu items); external links now all go through `ExtLink` | `Button`, `ExtLink` | — |
| C21 | Count beside a label | Guides' jump list styles its number by hand | `Segmented`'s `count` where it is a switch; the jump list may keep it | later |
| C23 | Search field without chips | Guides has its own search input (2.6rem tall) next to FilterBar's (2.8rem) | `FilterBar` once it allows no chips | later |

## Where the owner's rules stand

- **A button is never disabled for a missing or wrong value** (CLAUDE.md rule 10): holds. A click says what is
  missing at the field through `useFieldError`; its `live` option keeps an error that follows the value as it is typed.
  Buttons stay disabled only while busy, or for what cannot be done at all (an older memo, no agent, nothing to undo).
- **Creation presets above lists** (rule 11): holds; Digests puts its templates above the table, and no other page
  creates from presets.
- **Every list pages on the server** (rule 12): see C15.
