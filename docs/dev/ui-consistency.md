# UI consistency: one component per job

The owner saw the same job look different from page to page (Memory's filters and tabs, for one). This page names the
one component for each UI job, lists every place that still does the job by hand, and says what replaces it. Audited
on 2026-11-10 and 2026-11-11. A row is removed once its fix is merged; a row half done lists only what is left.

## The canonical components

| Job | Use | Not |
|---|---|---|
| Page frame and header: title, one size on every page, β badge, a live status beside the title, intro with a guide link, Back (`back`), actions on the title's line | `Page` and `PageHeader` (`src/shared/Page.tsx`; in `shared/` because the guide link opens through the platform and the β badge reads the section list) | a hand-written `h1` or frame; `src/ui/one-way.test.ts` refuses both |
| Guide link at the end of an intro | `PageHeader`'s `guide` prop | an `<a>`/`<button>` with `ExternalLink` per page |
| A page with a board (Clients, Tasks) | `PageHeader compact` in every view (the same title, intro behind an "i", guide link beside it), `FilterBar inline`, and in board view `Page fill` with `Board fill`: the board takes the window's height left and its columns scroll inside | a column height guessed from the window (`calc(100dvh-…)`) |
| Read again / Check again | `RefreshButton` (`src/ui/RefreshButton.tsx`; `variant`, `iconOnly`) | a `Button` with its own `RefreshCw` and spinner |
| Search field with filter chips | `FilterBar`, `FilterMenu`, `ToggleChip` | — (all four pages already use it) |
| A one-of-few switch: view, status tab, range, "by people / by chats" | `Segmented` (`size="md"` with labels; `count` per option) | a hand `fieldset` of radios or `aria-pressed` buttons |
| Content tabs (panels under them) | `Tabs`/`TabList`/`Tab` (React Aria) | — |
| Table | `DataTable` | a `<table>` for a list of records (a key–value list or a chart legend may stay a table) |
| Pager | `Pager` with `PAGE_SIZES` (Memory's taller rows: `MEMORY_PAGE_SIZES`, 20 first), pages from the server | slicing a list loaded whole |
| Empty state and "nothing matches" | `EmptyState` (`src/ui/EmptyState.tsx`) | a bordered `div` per page |
| Loading | `Skeleton` in the shape of what comes; `PageSkeleton` for a page | a spinner where the shape is known |
| Error | `ErrorNotice`: a plain translated sentence, and the tool's own text in `raw`, folded under "Details" | a red box by hand; a raw error appended to the sentence |
| Several notices above a page's content (a tool to install, things to confirm, read only) | `NoticeChips` (`src/ui/NoticeChips.tsx`): one line of chips, a chip opens its full text and action under the line; Clients uses it | stacked `ErrorNotice` boxes that push the content down |
| A service's name in front of data ("Telegram @kai_m") | `ServiceIcon` (`src/shared/ServiceIcon.tsx`): the logo with the name on hover and for screen readers; beside a visible name, `ToolIcon` | the word repeated in every row; keep the word in headings, explanations and first-run |
| Warning or notice banner | `ErrorNotice` with a `tone` (`bad` by default, `warn`); `noticeBox(tone)` (`src/ui/notice.ts`) for a list, a form or several buttons | `border-warn/40 bg-warn/10` by hand; `src/ui/one-way.test.ts` refuses it |
| A short explanation on hover or focus: an "i", a badge with its reason, a card's details | `InfoTip` for a trigger of its own (`trigger` for a badge); `useTip` and `TipPanel` (`src/ui/Tooltip.tsx`) on an element that is already interactive, such as a board card. The panel goes outside every scrolling box | a `title` attribute, an absolutely placed box inside a scroller |
| Status word on a record | `Pill`, words from one state set per feature | two word sets for the same states |
| Status light | `Lamp` (39 files use it) | a coloured dot by hand |
| Buttons | `Button` (`primary` once per surface, `secondary` for Cancel and any row action, `ghost` for Back, Close, an icon alone, `danger`; `sm` in headers and rows); no ellipsis in a label | a styled `<button>`, a ghost as a row's only action |
| A link inside a sentence | `LinkButton` (`src/ui/LinkButton.tsx`) in the app, `ExtLink` to a web page | a `<button>` with `text-brand` |
| Heading of a block on a page | `SectionTitle` (`src/ui/SectionTitle.tsx`) | a size per page |
| Dialog | `Dialog` | — (checked: no `aria-modal` or `fixed inset-0` outside `ui/`; Bell and Calendar are popovers, not dialogs) |

## Findings

Ids are local to this page. "Owner" is who is editing that area now; "free" means nobody is.

| Id | Job | Where (on `82c0c839` and the owned-pages PR) | Fix | Owner |
|---|---|---|---|---|
| C13 | Skeletons | page-local skeletons are fine (they draw the shape). Contacts now draws its real table with `DataTable`'s `placeholders` instead of a rack of its own | keep; share only when a second rack copy appears | — |
| C14 | Hand tables | `logs/RunsTable.tsx`, `storage/TablesExplorer.tsx`, `agents/AgentsMatrix.tsx`, `search/SearchPage.tsx` (an inline `<table>`) are record lists outside `DataTable`; analytics and storage facts are key–value or chart tables and may stay | `DataTable` (sorting, density, paging) | Logs and Storage next; Agents matrix is a grid of switches, kept |
| C15 | Paging rule (12) | Memory loads the whole list and slices it (`MemoryPage.tsx:54`). Logs, Digests' two tables, Storage tables and Agents' skills have a pager, but page in the app: Logs reads 500 runs per tool with `runs list --limit --page` and pages the merged runs; `memo digest list`, the store's table list and the skills have no `--limit`/`--page` | server paging; Memory needs memo paging on its reads first | Memory: the coordinator routes it to the CLI side; the others need a paged read in their CLI |
| C19 | Text sizes | 562 uses of `text-[0.9rem]`, 291 of `text-[0.95rem]`, 58 of `text-body`; DESIGN.md says body copy is `text-body` | shared components use `text-body`; pages move as they are touched | debt, no sweep |
| C20 | Hand-styled buttons and links | Guides' jump list and the HelpMenu rows are raw buttons by design (menu items); external links now all go through `ExtLink` | `Button`, `ExtLink` | — |
| C21 | Count beside a label | Guides' jump list styles its number by hand | `Segmented`'s `count` where it is a switch; the jump list may keep it | later |
| C23 | Search field without chips | Guides keeps its own input, at FilterBar's 2.8rem: it searches plain words, so FilterBar's mono `field:value` look does not fit | keep | — |
| C24 | Page errors differ | Tasks and Clients say what failed with Try again; Memory, Contacts, Storage and Search have one line and Report this, with technical text in the open, not under «Подробнее» | one page-error shape with retry and a details fold; it adds behaviour | after 0.6.0 |
| C25 | Hand icon buttons | about 15 copies of `grid size-N place-items-center … hover:bg-app-3`, sizes 1.3rem to 2.2rem, and 21 icon-only ghost `Button`s | an `IconButton` in `ui/` | after 0.6.0 |
| C26 | Small panel labels | 0.85, 0.9 and 0.95rem in `ink-dim` across details panels | `SectionTitle`'s small size | after 0.6.0 |

## Where the owner's rules stand

- **A button is never disabled for a missing or wrong value** (CLAUDE.md rule 10): holds. A click says what is
  missing at the field through `useFieldError`; its `live` option keeps an error that follows the value as it is typed.
  Buttons stay disabled only while busy, or for what cannot be done at all (an older memo, no agent, nothing to undo).
  A field's error goes through `FieldError`; `src/ui/one-way.test.ts` refuses a red line a field points at by id
  outside it. Four live lines still write their own (QueryBar, QueryDraft, BackupPassword, ScheduleCard's day), listed
  in that test.
- **Creation presets above lists** (rule 11): holds; Digests puts its templates above the table, and no other page
  creates from presets.
- **Every list pages on the server** (rule 12): see C15.
