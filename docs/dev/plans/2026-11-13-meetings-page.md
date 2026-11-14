# Meetings: a page of meetings and calls, as a table, a week and a month

Owner's request, 2026-11-13: a "Встречи" page for meetings and calls with their transcripts, in three views (table,
week, month), built on our own components rather than a calendar library, modelled on the best calendar interfaces.
This is the design; no code is written yet. Decisions are made here and listed as `NEED-n` under
[Decisions](#decisions), each with the chosen option and the alternatives, so the owner can overturn one without
reading the rest.

Rule 1 holds throughout: the page shows what `memo meetings list` and `memo meetings show` print and runs memo's own
commands for every change. The data side is being built in parallel in cli-memo; what this page needs from it and may
not get in the first version is under [Gaps in memo](#gaps-in-memo). Nothing here is built before memo prints it.

## Where the page sits

The owner is sketching a new sidebar (not final): Поиск, Задачи, **Встречи**, Документы, Клиенты, Контакты, Память,
Рецепты, Инструменты (tabs Инструменты | Агенты), Аналитика (tabs Данные | Хранилище). Meetings is one entry in
`src/app/sections.tsx` (`id: "meetings"`, the lucide `Video` icon) and one folder, `src/features/meetings/`. It goes
right after Tasks in today's order too, so it lands in the same place whichever sidebar ships first
([NEED-2352](#need-2352--the-pages-place-and-name)). Names: Meetings, Встречи, Reuniones.

The page links out to two neighbours and owns neither: a participant opens their card on Contacts (People), and a
linked document opens where Documents will show it (until then, the document's own link).

## References

What each reference does best, and what this page takes from it. Behaviour is quoted from each project's own docs
or source; a line marked "the docs describe" was not tried in the product itself.

| Reference | Take | Leave |
| --- | --- | --- |
| [FullCalendar](https://fullcalendar.io/docs) | Side-by-side columns for overlapping events in the time grid and a cap on them: [`eventMaxStack`](https://fullcalendar.io/docs/eventMaxStack) replaces the hidden ones with a "+more" link that opens a popover. Month cells cap their events the same way: [`dayMaxEvents`](https://fullcalendar.io/docs/dayMaxEvents) (the "+more" link is not counted). Time zones: the docs describe `local` (the browser's zone) as the default; a named zone works, and Temporal is needed only for a zone-aware date object ([`timeZone`](https://fullcalendar.io/docs/timeZone)). | Its plugin system, drag-to-create and resize: this page creates and moves nothing. |
| [react-big-calendar](https://github.com/jquense/react-big-calendar) | Two named layout strategies, `overlap` and `no-overlap` ([source](https://github.com/jquense/react-big-calendar/tree/master/src/utils/layout-algorithms)): the second gives each event the first free column among the events it collides with. | Its implementation: [`no-overlap.js`](https://github.com/jquense/react-big-calendar/blob/master/src/utils/layout-algorithms/no-overlap.js) builds a friends list in O(n²) and a fixed 100-slot bitmap. Ours is a sweep, below. |
| [Schedule-X](https://schedule-x.dev/docs/calendar) | Views as a small fixed set (month grid, week, day, month agenda) and a theme switched as a whole (`setTheme('dark')`); events carry a zone through Temporal. | Temporal and its polyfill: this page uses `Date` and `Intl` only, and shows times in the computer's zone. |
| [Google Calendar](https://support.google.com/calendar/answer/37034) | The toolbar shape every user already knows: Today, previous and next, the range as the title, the view switch on the right. Single-key shortcuts, off until turned on in its settings (the docs list `t` for today, `j` or `n` for the next range, `2` or `w` for week, `3` or `m` for month). A red now-line across today. Events of 24 hours or more sit in the all-day row. | The cascade layout where overlapping events cover each other: titles hide under their neighbours. The hover-free click popover with a second click to open details. |
| [Notion Calendar](https://www.notion.com/product/calendar) | Seen in the product, not in docs: density: a short event is one line, "10:00 Title"; the join button for the meeting's own service; a meeting's documents beside it. | Its own-calendar editing and scheduling links. |
| [WAI-ARIA APG grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/) | The month as a grid with one tab stop (roving tabindex): arrows move by day, Home and End to the week's ends, Ctrl+Home and Ctrl+End to the first and last cell, Page Up and Page Down by a page. | A grid role for the week's time columns: there a cell is not the thing the user acts on, so it is a list of event buttons per day (see [Accessibility](#accessibility)). |

## What the page reads

The shape the page expects from memo, from the parallel work's brief; field names are settled with that work and
written into a contract page (`docs/dev/meetings-api.md`, like [digests-api.md](../digests-api.md)) before code.

- **`memo meetings list [query] --from <instant> --to <instant> --limit <n> --page <n> --json --no-record`**: one row
  per real meeting (a calendar event and its Zoom, Meet or Telemost meeting joined by their join key) and one per
  call (a phone import, a messenger call). A row: `ref`, `kind` (`meeting` | `call` | `event`), `title`, `start`,
  `end` (or `duration_s` for a call), `all_day`, `sources[]` (`zoom`, `meet`, `telemost`, `calendar`, `phone`,
  `telegram`…), `participants[]` (`name`, `person` ref or null), `has_recording`, `has_transcript`, `has_summary`,
  `documents` (count), `pending_findings` (count). The answer also carries `total` and `more`.
- **`memo meetings show <ref> --json --no-record`**: the participants, the transcript in the shape `meetings transcript` already prints and Search
  already reads (`lines[]`: `position`, `offset_ms`, `speaker`, `text`; `src/domain/search-context.ts`), the summary, the findings waiting for a decision with what a decision needs, the calendar event (its
  zone, its organiser, its join links), and the linked documents (`ref`, `title`, `url`).

Filters are words of the query, as on Tasks and Search, so chips and typed words are one state (`FilterBar`):
`kind:meeting|call|event`, `source:<id>`, `with:<person ref>`, `has:transcript`.
The window reads ask for start order, oldest first (`--order start`), so a capped window is complete up to a day. Titles, names and transcript text
leave Rust unmasked, an exception to rule 4 like the Tasks and Memory pages: the owner's own data on the owner's own
page, never logged or put in a report.

### Gaps in memo

Each is a memo change; the page adds nothing in its place, and a missing field shows as "not known" or is left out.

1. **The window is overlap, not start.** `--from`/`--to` must return every row that overlaps the window
   (`start < to && end > from`), or a meeting that starts on Sunday 23:00 and runs into Monday vanishes from Monday.
2. **Server paging for the table** (rule 12): `--limit` and `--page` with `total`, newest first, with no window.
3. **A cap answer for the calendar windows**: `more: true` when the window holds more rows than `--limit`.
4. **`all_day`** from the calendar event, and the event's own zone (`time_zone`), shown in details when it differs
   from the computer's.
5. **Join links per source** (`links[]{source, url}`), so Open in Zoom, Meet or Telemost is one button each.
6. **Deciding a meeting's findings**: the command and what it needs (a batch id, a fingerprint), like
   `actions confirm <id> <finding ids…> --fingerprint <hash>` on the Memory page. Needed for deciding them inside
   the dialog ([NEED-2354](#need-2354--where-a-meetings-findings-are-decided)).
7. **The person ref on a participant**, so a name links to Contacts; without it the name is plain text.
8. **Start order for windows** (`--order start`, oldest first), so a capped window is whole up to its last day.
9. **The transcript inside `show`**, in `meetings transcript`'s line shape, so one read fills the dialog. Until
   then the Transcript tab reads `meetings transcript` when it opens.
10. **A review id for a meeting's findings**, so "3 to confirm" can open that batch on the Memory page
    ([NEED-2354](#need-2354--where-a-meetings-findings-are-decided)).

## The page

`PageHeader compact` (the title, the intro behind an "i", the guide link), its actions on the title's line:
Read again (`RefreshButton`) and the view switch (`Segmented`, Table | Week | Month). There is no primary button: the
page creates nothing, and Today is a secondary button.

Under the header, one toolbar line and one filter line. In Week and Month:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Встречи  (i) Guide                                    [↻ Read again]  [ Table | Week | Month ]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Today]  [‹] [›]   10 – 16 November 2026                                                     │
│ [ search: title, person, words…                                                           ]  │
│ [Kind: all ▾] [Source: all ▾] [☐ Only with a transcript]                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Today** jumps to the week or month holding today and scrolls the time grid to now. Shown as a plain secondary
  button even when today is on screen: it then scrolls the grid to now, so it always does something.
- **‹ ›** step one week or one month (`aria-label` "Previous week" / "Next week" and so on).
- **The range title** is a button that opens `DatePopover` with `Calendar`, to jump to any date. The week reads
  "10 – 16 November 2026", "29 December 2026 – 4 January 2027" across years, "Ноябрь 2026" for a month; all through
  `Intl.DateTimeFormat` in the interface language.
- **Filters** are `FilterBar` chips: Kind (`FilterMenu`: all, meetings, calls, calendar events), Source (the fixed
  list of meeting sources, so the menu does not change with the window), and "Only with a transcript"
  (`ToggleChip`). A person is filtered by typing `with:` in the search; a Person chip needs a people search that
  pages on the server, so it waits (`Combobox` takes a whole list, which rule 12 forbids here). They change
  the query, so they apply in every view, and the view switch keeps them.

In Table, the Today, ‹ › and range title are not shown: the table lists all time, newest first, paged on the server.
The search and the chips stay in the same place.

Rule 11 (presets above a list) does not apply: the page creates nothing from templates.

### Week

```text
          Mon 10       Tue 11       Wed 12       Thu 13 ●      Fri 14       Sat 15     Sun 16
all day │ ▭ Offsite ─────────────────────────────▭│            │            │          │
────────┼────────────┼────────────┼────────────┼────────────┼────────────┼──────────┼─────────
 09:00  │┌──────────┐│            │            │            │            │          │
        ││▣ Standup ││            │┌────┐┌────┐│            │            │          │
 10:00  ││ 09:30 ⓩ ✎││            ││▣ Rv││☏ Ka││┌──────────┐│            │          │
        │└──────────┘│            ││ ⓩ  ││    │││☏ Call    ││            │          │
 11:00  │            │            │└────┘└────┘││ Kai M 0:42││            │          │
        │            │            │  +2        │└──────────┘│            │          │
━━━━━━━━┿━━━━━━━━━━━━┿━━━━━━━━━━━━┿━━━━━━━━━━━━┿━●━━━━━━━━━━┿━━━━━━━━━━━━┿━━━━━━━━━━┿━━━━━━━━━ 11:47
 12:00  │            │┌──────────┐│            │            │┌──────────┐│          │
        │            ││▣ Board   ││            │            ││▣ 1:1 Ana ││          │
        │            ││ 12–15 ⓜ  ││            │            ││ ⓣ ✎ ! 3  ││          │
```

- **Columns**: seven days from the week start the interface language uses (`weekStart` in `src/ui/Calendar.tsx`:
  Sunday in English, Monday in Russian and Spanish). The header names the weekday and day; today's has a `brand`
  dot and semibold text. A day's header is a button that switches to Month on that day's month (there is no day
  view; [NEED-2346](#need-2346--three-views-and-which-one-opens)).
- **Hours**: all 24, at `4rem` an hour (it grows with the interface size like everything else). The time gutter in
  mono (`09:00` in Russian and Spanish, `9 AM` in English, from `Intl`). The grid scrolls inside the page, which
  is `Page fill`, like the Tasks board. The first time it opens on a week, it scrolls to an hour before now on the
  current week and to 08:00 on others ([NEED-2351](#need-2351--hours-shown-in-the-week)); after that, ‹ › and
  re-reads keep the scroll where the owner left it.
- **The all-day row** holds all-day events and timed events that cover a whole calendar day (see [Time](#time)),
  each as a bar across the days it covers, packed into lanes (see [Month layout](#month-and-all-day-layout)). It is
  always two lanes high, empty or not, so moving between weeks never moves the time grid. A third lane's event
  becomes "+N" on every day it covers, each opening that day's list.
- **The now-line**: a 2px `brand` line with a dot at the gutter edge across today's column, moved once a minute
  (one timer, no read). Not red as in Google: DESIGN.md keeps `bad` for faults, and purple already means "happening
  now" on the `busy` and `doing` lamps.
- **Events** are blocks placed by the [overlap layout](#overlap-layout-in-the-time-grid). A block is never drawn
  shorter than one line of text (1.5rem, which is 22.5 minutes at 4rem an hour), so a 3-minute call can still be
  read and clicked; the layout uses the same minimum, so short blocks never draw over each other.

### Month

```text
   Mon          Tue          Wed          Thu          Fri          Sat          Sun
┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
│ 26         │ 27         │ 28         │ 29         │ 30         │ 31         │ 1          │
│            │ ▣ 10:00 Sta│            │            │            │            │            │
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ 2          │ 3          │ 4          │ 5          │ 6          │ 7          │ 8          │
│ ▭ Offsite ──────────────────────────▭│ ☏ 09:12 Kai│ ▣ 14:00 1:1│            │            │
│ ▣ 10:00 Sta│ ▣ 10:00 Sta│ ▣ 11:00 Rev│ ▣ 15:00 Boa│            │            │            │
│ +3 more    │            │            │            │            │            │            │
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ …          │            │            │ 13 ●       │            │            │            │
```

- **Always six weeks**, from the week start on or before the 1st, so moving from a five-week month to a six-week one
  moves nothing (rule 9). Days of the other months are in `ink-dim`.
- **A cell** shows its day number, then the multi-day and all-day bars in their lanes, then one line per timed event:
  kind icon, start time in mono, title truncated. As many lines as the cell's height holds (measured once per
  resize, not per event); when more remain, the last line becomes "+N more", a small ghost `Button` (not a purple
  link: a month can hold dozens, and purple stays rare). The "+N" counts what is
  hidden, as in FullCalendar.
- **"+N more"** opens a popover anchored to the cell (the `DatePopover` frame, the panel shadow, outside every
  scroller) that lists all of that day's events, each a button that opens the details. Escape closes it and returns
  focus to the "+N" link.
- **A day number** is a button that opens Week on that day's week.

### Table

```text
┌──────────────────────┬──────────────────────────────────┬─────────┬─────────────────┬───────┬──────────┬─────┐
│ When                 │ Title                            │ From    │ People          │ Dur.  │ Has      │     │
├──────────────────────┼──────────────────────────────────┼─────────┼─────────────────┼───────┼──────────┼─────┤
│ Thu 13 Nov 12:00     │ ▣ Board review                   │ ⓜ ▤     │ Ana, Kai +4     │ 3:00  │ ✎ ≡ ●    │ ! 3 │
│ Thu 13 Nov 10:20     │ ☏ Kai Müller                     │ ☎       │ Kai Müller      │ 0:42  │ ✎        │     │
│ Wed 12 Nov 10:00     │ ▣ Review                         │ ⓩ ▤     │ —               │ 1:00  │          │     │
└──────────────────────┴──────────────────────────────────┴─────────┴─────────────────┴───────┴──────────┴─────┘
                                                        ‹ 1 2 3 … 9 ›   25 ▾ per page
```

- `DataTable`, `Pager` with `PAGE_SIZES`, pages read from memo (`--limit`, `--page`, `total`), never a whole list
  sliced in the app (rule 12; `TaskTable`'s app-side paging is the C15 shape this page must not copy).
- Columns: When (date and time in mono), Title (kind icon, then
  the title; the row's button), From (`ServiceIcon` per source), People (first two names, "+N"), Duration (in
  mono, `h:mm`), Has (transcript, summary, recording icons, each with its name for screen readers), and the findings
  count as a `warn` pill ("3 to confirm") when any wait.
- The row's title opens the details dialog, as a task's title does on Tasks.

## The event block and the row

One component, `MeetingChip`, in three sizes: the week block, the month line and the table's title cell. It never
uses a per-calendar colour: state is said by shape, icon and the existing tokens ([NEED-2350](#need-2350--how-a-call-looks-beside-a-meeting)).

| | Meeting (`meeting`, `event`) | Call (`call`) |
| --- | --- | --- |
| Week block | `app-2` fill, `line-strong` hairline, a 3px `ink-soft` bar on the left | `app` fill, dashed `line-strong` hairline, no bar |
| Kind icon | lucide `Video` for a meeting, `CalendarDays` for a bare calendar event | `Phone`, or the messenger's `ServiceIcon` for a messenger call |
| Title | the meeting's title | the other side's name, else the number as memo prints it (mono) |

- **Lines by height** (week): under 45 minutes, one line with the title alone (kind icon and badges beside it while
  they fit); from 45 minutes (3rem), the title on the first line and the time and badges on the second. A month line
  is the title alone too. The time is always in the block's name for screen readers, its tip and the details.
- **Badges**, at the block's bottom right, icons only (named for screen readers, `useTip` on hover): transcript
  (`FileText`), summary (`AlignLeft`), recording (`Disc`). Findings waiting for the owner: a small `warn` lamp
  (`Lamp` `sm`) with the count beside it in the week and table; the lamp alone in a month line.
- **Time states**: a past event's text steps back to `ink-soft`; an event happening now carries the `doing` lamp; a
  cancelled calendar event (if memo says so) is struck through in `ink-dim`.
- **Tip**: hover or keyboard focus on a week block or a month line shows a `TipPanel` with the full title and the
  start and end (`useTip` with `keyboardOnly`, as board cards do): at 960 px a day is about 100 px wide. Click and
  Enter open the details; the tip is never the only way to a fact.

## Details

A meeting opens in `Dialog wide="xl" scroll tall`, the shape Tasks and Contacts use for one record
([NEED-2345](#need-2345--where-a-meetings-details-open)). It reads `memo meetings show <ref>` when it opens.

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Board review                                                                   [⧉ ref] [×]│
│ Thu 13 November 2026, 12:00 – 15:00 (3 h) · ⓜ Google Meet · ▤ Calendar                     │
│ [Open in Google Meet ↗]  [Recording ↗]                                                    │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Overview | Transcript 1 240 lines ]                                                     │
│                                                                                           │
│ ● 3 findings wait for you   Confirm on Memory →          │ Participants (6)               │
│                                                          │ Ana Ruiz          → Contacts   │
│                                                          │ Kai Müller        → Contacts   │
│                                                          │ ana@example.com                │
│                                                          │                                │
│                                                          │ Documents (2)                  │
│ Summary                                                  │ Q4 plan ↗                      │
│ The board agreed on …                                    │ Minutes ↗                      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header**: the title; the date and time range in the computer's zone, with the event's own zone in brackets when
  it differs ("12:00 – 15:00, 06:00 – 09:00 New York"); `ToolIcon` and name per source (the names are visible here,
  so the icons are decoration); the ref through `CopyRef` in `titleAside`.
- **Open buttons**: one `OpenLink` per join link ("Open in Zoom", "Open in Google Meet", "Open in Telemost") and one
  for the recording, each with its copy beside it. None when memo gives no link; the reason is not guessed.
- **Tabs** (`Tabs`): Overview and Transcript. A call without a transcript shows Overview only.
- **Findings to confirm**, first, because they are the one thing that waits for the owner: one line with a `warn`
  lamp, the count, and "Confirm on Memory", a `LinkButton` that opens that batch on the Memory page through the
  existing `proposal` target (`openTarget` in `src/features/links/open.ts`), where findings are already decided.
  Deciding them inside this dialog is a later step: Memory's `Findings` part reads the Memory store and its
  messages, so reusing it is a refactor of its own, and memo has no meeting command for it yet
  ([gap 6](#gaps-in-memo), [NEED-2354](#need-2354--where-a-meetings-findings-are-decided)). Coming back from
  Memory reads the meeting again, so the count is current.
- **Summary**: memo's text as prose, `text-body`, max 70ch, selectable.
- **Participants**: a list; a name with a person ref is a `LinkButton` that opens the person on Contacts through the
  `person` target of `src/domain/links.ts`, and the dialog closes first. `openTarget` has no `person` case yet:
  adding it (open Contacts with that person's dialog) is part of this work, and it also makes `person` links work.
  A participant without a ref is plain text (an address or a number in mono). No participants: "No participants
  recorded", in `ink-soft`.
- **Documents**: title and `ExtLink` to the document's own URL; an internal link once the Documents page exists.

### Transcript

```text
│ [ find in transcript…                    ]  3 of 12  [↑] [↓]                                    │
│ 00:00:04  Ana Ruiz     Let's start with the numbers.                                            │
│ 00:00:11  Kai Müller   The [budget] is forty thousand…                                          │
│ 00:00:30  Ana Ruiz     And the [budget] for next year?                                          │
```

- Each line: the offset in mono (`mm:ss`, `h:mm:ss` past an hour), the speaker, the text, selectable. The line shape
  is `ContextLine` from `src/domain/search-context.ts`, which the Search page already reads a Zoom transcript into, so
  both pages draw a transcript line the same way.
- **Find**: a field above the lines. Matches are marked with `<mark>` (`brand-soft`), the count reads "3 of 12",
  Enter and Shift+Enter (and the two arrow buttons) move to the next and previous match, which is scrolled to the
  centre with `focusInPlace`. The search runs over the transcript already read: it is one document, not a list, so
  rule 12 is not in play. No match: "Not in this transcript", and the field gets `aria-invalid` only when the owner
  presses Enter on it.
- **Opened from Search**: a hit's offset opens the Transcript tab on that line, marked and centred, as Search does
  today.
- **Long transcripts**: a three-hour call is about 2 000–4 000 lines. Lines are rendered in blocks of 200 with
  `content-visibility: auto` and an intrinsic height, so the browser skips laying out what is off screen without a
  virtualising library, and the page's own find still sees every line. The minimum WebKitGTK the app supports is
  checked for `content-visibility` before code; where it is missing the lines still render, only slower.

## States

| State | What shows |
| --- | --- |
| memo missing or older than the page's `minVersion` | `ToolNeeded` with the update, as on Tasks |
| First read | The grid itself (days, hours, today's line) at once; `Skeleton` blocks in three columns at plausible places, the first labelled "Reading meetings". Table: `DataTable` `placeholders`. Nothing moves when the rows land. |
| Next or previous window | The new dates draw at once; events of the old window are not shown under the new dates. The new window's events fade in (`.reveal`). A read that takes over 300 ms shows the skeletons. |
| Read failed | `PageError` with Try again and Report this; the header's Read again hides while it shows. |
| Week or Month with nothing | The empty grid, and one line in the toolbar: "No meetings this week", or "Nothing matches this week" with Clear filters when a filter is on. Never an `EmptyState` over the grid: an empty week is a normal week, and telling "none at all" apart would cost another memo run. |
| Table with nothing | `EmptyState` "No meetings yet" with what fills the page (a sync of Zoom or the calendar, a phone import) and the guide link; with a filter on, "Nothing matches" and Clear filters (secondary). |
| The window holds more than the cap | Rows come oldest first, so the window is whole up to the last day read. Days after it show "Not read" in `ink-dim` instead of events, and a `NoticeChips` chip says "Read up to 18 November: narrow the filters or open Table" ([NEED-2347](#need-2347--how-much-a-window-reads)). |
| Details failed to read | `ErrorNotice` inside the dialog with Try again; the header line from the list row stays. |

## Navigation, state and links

The app has no URL router: `useNav` (`src/shared/nav.ts`) is an in-memory stack of sections, by design. The page's
own place is kept in its store:

- **View** is saved in `safeStorage` (`wirecat.meetings.view`), as Tasks saves `wirecat.tasks.view`. The first visit
  opens Week.
- **The shown date** (the anchor) lives in the store for the session: leaving for Contacts and coming back with
  Back returns to the same week and scroll. A new launch opens on today, as every calendar does.
- **Deep links** need cli-core first: the `wirecat://` grammar is cli-core's, and the desktop copies its fixture
  byte for byte (`src/domain/links.ts`). Wanted: `/v1/meeting/<ref>` (opens the dialog over Week on that meeting's
  week) and `/v1/meetings/<YYYY-MM-DD>`. Until then, Search's "Read the transcript" opens the dialog in-app
  ([NEED-2353](#need-2353--links-to-a-meeting)).

## Time

All on `Date` and `Intl`; no Temporal, no time-zone library ([NEED-2348](#need-2348--which-time-zone)).

- **The computer's zone, always.** memo gives instants with an offset; the page turns each into local wall-clock
  values with `Date`. The event's own zone is said in the details only.
- **Windows** are built from calendar days, never from milliseconds: a week is local midnight of its first day to
  local midnight seven days later (`setDate(d + 7)`), so a DST week is 167 or 169 hours and still ends at midnight.
  Both ends go to memo as instants with their offset.
- **Placing a block**: its top is the local wall-clock minutes since the day's midnight (`h * 60 + m`); its height is
  the local wall-clock end minus start, at least one line. When the clock falls back, the wall-clock end can be
  earlier than the start (02:40 summer time to 02:10 winter time); then the end is the start plus the real duration.
  The grid always draws 24 hours.
- **DST in Europe/Madrid** (the owner's zone): on 28 March 2027 the clock jumps 02:00 → 03:00, so no local time
  02:00–02:59 exists; an event from 01:30 to 03:30 is one real hour and is drawn from the 01:30 line to the 03:30
  line, its header saying "1 h". On 31 October 2027 the clock falls back 03:00 → 02:00, so 02:00–02:59 happens twice
  (01:30 only once); an event from 01:30 to 02:30 of the second pass is two real hours, drawn 01:30–02:30, and its
  header says "2 h". Durations always come from the
  instants, never from the drawing.
- **Crossing midnight**: a timed event that crosses midnight without covering a whole day is split into one segment
  per day; the first ends at the bottom with a "continues" mark, the next starts at 00:00 with "from the day before".
  Both are one event, and its focus stop is the first segment on screen.
- **All-day**: `all_day` from memo, or a timed event that covers at least one whole local calendar day (from a
  midnight to the next), goes to the all-day row. Decided by calendar days, not by 24 real hours, so a full day on
  a 23- or 25-hour DST day is filed the same way. An all-day event's
  end is exclusive (the calendar's convention), so a one-day event on the 13th ends on the 14th and covers one cell.
- **Week start and formats** come from the interface language, not the system locale, as `Calendar` already does.

## Overlap layout in the time grid

A pure function in `src/domain/meeting-layout.ts`, with no React and no DOM:

```ts
layoutDay(events: DaySegment[], maxColumns: number, minMinutes: number): Placed[]
// DaySegment: { key, startMin, endMin }   minutes from local midnight, 0…1440, endMin > startMin
// Placed:     { key, column, columns, span, width }   width as a fraction of the day,
//             or { more, startMin, endMin, keys }     one "+N" marker per run of hidden events
```

1. **Normalise.** `endMin = max(endMin, startMin + minMinutes)`, where `minMinutes` is the drawn minimum (one line,
   22.5 minutes at 4rem an hour). Overlap is decided on the drawn size, or two 3-minute calls a minute apart would
   draw on top of each other.
2. **Sort** by `startMin`, then by longer first (`endMin` descending), then by `key`, so the same data always gives
   the same picture.
3. **Clusters.** Sweep in that order keeping the cluster's latest `endMin`; an event that starts at or after it
   (`startMin >= clusterEnd`) closes the cluster and opens a new one. Events touching end to start (10:00–11:00 and
   11:00–12:00) do not overlap. A chain (A overlaps B, B overlaps C, A does not overlap C) is one cluster.
4. **Columns.** Inside a cluster, give each event the lowest column whose last event ends at or before this one's
   start; keep each column's last `endMin` in an array, so this is O(n · c) with c the columns used. Call the
   cluster's column count `need`.
5. **Cap.** `shown = min(need, maxColumns)`. When `need <= maxColumns`, nothing is hidden and every event's
   `columns` is `need`. When `need > maxColumns`:
   - with `maxColumns >= 2`, events in columns `0 … maxColumns - 2` are drawn; events in the remaining columns are
     hidden, and the last column (`maxColumns - 1`) holds the "+N" markers;
   - with `maxColumns = 1`, column 0's events are drawn at 80% of the day's width and the "+N" markers sit in the
     remaining 20%.
   A marker covers one run of hidden events whose times overlap, from the earliest start to the latest end, and N
   counts every hidden event in that run. It is a button and opens the day's list.
6. **Spread right.** A drawn event spans further visible columns to its right while no drawn event in them overlaps
   it for its whole time (`span`). A block has one width for its whole height, so this helps only an event whose
   right-hand columns are free from its start to its end: A 9:00–12:00, B 9:00–10:00, C 9:00–10:00 and
   D 10:30–11:00 take columns 0, 1, 2 and 1, and D spans columns 1 and 2. Width is `span / shown`, left is
   `column / shown`. With `maxColumns = 1` the 80% rule of step 5 replaces this width.
7. **Result**, all in fractions and minutes, so the component only multiplies by the hour height and the day width.

`maxColumns` comes from the day column's width: `floor(width / 4.5rem)`, at least 1, at most 4.

Five meetings at 10:00–11:00 (`need` 5):

- **At 960 px**, a day is about 100 px; 4.5rem is about 59 px at the 13 px root, so `maxColumns` is 1. The first
  meeting (by key) draws at 80% width and a "+4" marker fills the last 20% from 10:00 to 11:00.
- **At 1280 px**, a day is about 138 px and `maxColumns` is 2: the first meeting takes column 0 at half the width,
  and "+4" takes column 1.
- **At 1920 px or a wide window**, `maxColumns` 4: three meetings drawn, "+2" in the fourth column.

## Month and all-day layout

`layoutWeekRow(spans: DaySpan[]): Lane[]` in the same file: for one week row, each multi-day or all-day event is a span
of day indexes (0–6, clipped to the row, flagged when it continues from the previous row or into the next one).
Sort by start day, then longer first, then key; give each the lowest lane free over all its days (greedy interval
colouring). The month cell draws lanes first, then its timed events in start order, then "+N more"; the lanes a
cell cannot fit count into its own "+N". The week's all-day row uses the same function with a cap of two lanes, and
an event in a hidden lane counts into the "+N" of every day it covers.

## Performance

- **One read per window**: `useQuery` in `src/features/meetings/api.ts`, key
  `["tool", "memo", "meetings", from, to, query]`, `staleTime` one minute, no refetch on focus (the client's
  default: a read starts a memo process). ‹ › to a window read in the last minute shows at once. No prefetch of the
  next window: every read is a process the owner did not ask for.
- **The window is what is on screen**: Week reads its seven days; Month reads all six weeks it draws, so the dimmed
  days of the months around it show their meetings too.
- **The cap**: a window read asks `--limit 500`, oldest first. A month of 200 meetings is one read; a month of 812
  draws its days up to the 500th meeting's day and marks the rest "Not read", and Table pages through all of them.
- **The details**: key `["tool", "memo", "meeting", ref]`, read on open, kept five minutes; coming back from Memory
  after deciding findings reads it again, and the windows that hold it.
- **Layout** is computed per day with `useMemo` over that day's segments: sort plus sweep, O(n log n) per day, a few
  microseconds for 30 events. The month grid draws at most 42 cells and the lines that fit; the week at most a few
  hundred blocks. Neither needs virtualising.
- **Measuring**: one `ResizeObserver` on the grid gives the day width and the month cell height; nothing measures per
  event.
- **The now-line** is one interval per minute in one component; nothing else re-renders on time.

## Components

What is new and where, after the search `guides/reuse.md` asks for. Shared parts go in `ui/` only when they know
nothing about meetings.

| Part | Where | New or reused |
| --- | --- | --- |
| `meetings_list`, `meeting_show` (and `meeting_transcript` until `show` carries it): fixed memo commands with validated refs, instants and query, `--json --no-record`; titles, names and text unmasked under the rule 4 exception, never logged | `src-tauri/src/meetings.rs`, `src-tauri/src/commands/meetings.rs`, `bindings.rs` | new Rust commands ([guides/rust-command.md](../guides/rust-command.md)) |
| `layoutDay`, `layoutWeekRow`, `splitByDay`, `weekWindow`, `monthWindow` | `src/domain/meeting-layout.ts` | new, pure, tested |
| `TimeGrid`: hour gutter, day columns, all-day row, now-line, scroll keeping, roving focus; takes placed items and a render function | `src/ui/TimeGrid.tsx` | new |
| `MonthGrid`: six-week APG grid with roving focus, lanes, "+N more"; takes items and a render function | `src/ui/MonthGrid.tsx` | new; its key handling moves out of `Calendar.tsx` into a shared helper both use |
| `weekStart`, `dayOf` | `src/ui/Calendar.tsx` | reused, exported |
| `DatePopover`, `Calendar` | `src/ui/Calendar.tsx` | reused: the range title's picker and the "+N more" popover frame |
| `MeetingChip`, `MeetingDialog`, `TranscriptView`, `MeetingsTable`, `Toolbar`, `Filters`, store, api, messages, mock | `src/features/meetings/`, `src/platform/mock-meetings.ts` | new |
| A `person` case in `openTarget` | `src/features/links/open.ts` | new: opens Contacts on that person |
| Transcript line | `ContextLine` in `src/domain/search-context.ts` | reused; Search's `HitContext` and the dialog draw it the same way |
| `Page`, `PageHeader`, `Segmented`, `FilterBar`, `FilterMenu`, `ToggleChip`, `DataTable`, `Pager`, `Dialog`, `Tabs`, `OpenLink`, `ExtLink`, `LinkButton`, `CopyRef`, `ServiceIcon`, `ToolIcon`, `Lamp`, `Pill`, `Skeleton`, `EmptyState`, `ErrorNotice`, `PageError`, `NoticeChips`, `ToolNeeded`, `RefreshButton`, `Crossfade`, `TipPanel` | as named | reused |
| Google Meet and Telemost logos | `src/assets/logos/` with their source in `SOURCES.md`, the entries in `ToolIcon.tsx` | new assets, added when memo first prints `meet` or `telemost` as a source; until then the generic `Video` icon |

## Accessibility

- **One focus outline**: the global 2px `brand` outline at 2px offset, on blocks, cells and buttons alike.
- **Week**: the time grid is one tab stop with roving focus over its event buttons (the toolbar comes before it).
  Each day column is a `role="group"` named by its date ("Thursday 13 November, today, 4 meetings"). Up and Down
  move to the previous and next event of the day; Left and Right move to the event nearest in time on the previous
  or next day that has any, skipping empty days, and stay put at the week's edge; Home and End go to the week's
  first and last event. A meeting that crosses midnight is one stop, on its first segment on screen. Tab leaves the
  grid. This is a judgment call, not what APG prescribes: a cell of the time grid is not something to act on, and
  Table is the full keyboard and screen-reader path to every meeting.
- **Month**: an APG grid (`role="grid"`, `row`, `gridcell`, `columnheader`) with one tab stop, and the gridcell
  itself takes the roving focus. Arrows move by day, Home and End to the week's ends, Page Up and Page Down by a
  month (reading that window), Ctrl+Home and Ctrl+End to the first and last cell. Enter moves focus into the cell:
  its day number, its events and "+N more", in order, by Tab and Shift+Tab; Escape returns to the cell.
- **An event button's name** says it all once: "Board review, Thursday 13 November 12:00 to 15:00, Google Meet,
  transcript, summary, 3 findings to confirm". Icons inside are `aria-hidden`.
- **No single-letter shortcuts** in the first version: WCAG 2.1.4 asks for a way to turn them off, and the arrow
  keys and the toolbar already cover the moves.
- **Live region**: moving the window says the new range ("10 to 16 November 2026, 12 meetings") once the read lands.
- **Colour is never alone**: a call differs by its icon and its dashed edge, findings by a count and a lamp with a
  label. Past and future differ only by text colour, which is fine: the time beside each event already says it.
- **Contrast**: block text on `app-2` uses `ink`; past events use `ink-soft` (both pass 4.5:1 on `app-2` in both
  themes, as Tasks' rows do).

## Motion

Rule 9 through the shared pieces; every one instant under reduced motion.

- **View switch**: `Crossfade` (the old view fades out over the new in `exit`), the toolbar and filters stay still.
- **‹ ›**: the day columns slide by a fifth of their width in the move's direction and fade in `normal`; the time
  scroll does not move, and the all-day row keeps its height.
- **Details**: the `Dialog`'s own grow and fade. Closing returns focus to the block that opened it.
- **"+N more"**: the popover's own fade. The now-line moves without animation.
- **Data landing**: `.reveal` on blocks; no block slides into place.

## Text

Every string in `messages.ts` in English, Russian and Spanish, through `useMessages`. Plurals through the app's
plural helper ("3 встречи", "5 встреч"). Dates and times only through `Intl.DateTimeFormat` with the interface
language. Durations: "1 h 30 min", "1 ч 30 мин", "1 h 30 min".

## Tests

Most of the logic is in the pure layout file, so most tests are fast unit tests; the page gets a few integration tests
on the mock platform. No real waits: fake timers for the now-line.

- **`meeting-layout.test.ts`**: no overlap (one column); two overlapping; touching end to start (not overlapping);
  five at the same start with `maxColumns` 1, 2 and 4 (what is drawn, the "+N" count, width and span); spread right
  (A 9–12, B 9–10, C 9–10, D 10:30–11: D spans two columns); two 3-minute calls a minute apart (the drawn minimum
  decides the overlap); a chain A–B, B–C where A and C do not overlap (one cluster, two columns); 200 random events
  give no two drawn blocks overlapping and the same result twice; split at midnight; a timed event covering a whole
  calendar day goes to the all-day row; lanes for three multi-day spans across a week row break, with a hidden lane
  counted on every day; month and week windows across a year end.
- **DST**: with `TZ=Europe/Madrid`, the week of 28 March 2027 is 167 hours and ends at midnight; an event 01:30–03:30
  that day draws from the 01:30 line and says "1 h". The week of 31 October 2027 is 169 hours; an event from 01:30 to
  02:30 of the repeated hour says "2 h"; an event from 02:40 summer time to 02:10 winter time draws 30 minutes tall
  from 02:40. The test script sets `TZ`, as Node reads it at start.
- **`MeetingsPage.test.tsx`** on the mock (`src/platform/mock-meetings.ts`, synthetic data, `?section=meetings` with
  `?meetings=empty|fail|many|dst`): the view switch keeps filters; ‹ › reads the next window once; "Only with a
  transcript" adds `has:transcript` to the read; Table asks memo for page 2 and never slices; a capped month marks
  the days after the cut "Not read"; a block opens the dialog and Escape returns focus to it; month "+N more" lists
  all of the day; a participant opens Contacts on that person; "Confirm on Memory" opens the batch.
- **`MonthGrid.test.tsx`** and **`TimeGrid.test.tsx`**: roving focus, every key in the lists above, Page Down reads
  the next month.
- **`TranscriptView.test.tsx`**: find marks every match, Enter and Shift+Enter wrap, a hit offset opens centred.
- **Checks**: `scripts/layout-shift.mjs meetings` under the budget; `scripts/capture.mjs` in light and dark at 960 and
  1280 for each view; `scripts/scroll-hold.mjs` for the dialog's close.

## Decisions

Made without the owner, as asked; each can be overturned on its own.

### NEED-2345 · Where a meeting's details open

- **Chosen: A, a wide dialog** (`Dialog wide="xl" scroll tall`), as Tasks and Contacts open one record. DESIGN.md
  refuses a sidebar-plus-detail split (Agents is the owner's one exception), and the transcript needs the room.
- **B**, a side panel beside the calendar, as Notion Calendar does: the grid stays visible, but it is the split
  DESIGN.md refuses and it halves a week at 960 px.
- **C**, a popover at the event, as Google Calendar first shows: quick, but a second click to the real details, and
  no room for a transcript.

### NEED-2346 · Three views, and which one opens

- **Chosen: A, Table, Week and Month; Week first, then the last one used.** Week is where meetings are planned and
  reviewed; Month is for finding a day; Table is for searching and for the screen reader.
- **B**, add a Day view: one more grid for a view Week at a wide window already gives; later if asked.
- **C**, open on Table: the most accessible, but it hides the shape of a week, which is the reason for the page.

### NEED-2347 · How much a window reads

- **Chosen: A, a window reads up to 500 rows oldest first, marks the days after the cut "Not read" with a chip;
  Table pages on the server.** A calendar
  must draw every event of what it shows, so paging a week is meaningless; rule 12's aim (never load a whole list) is
  kept by the window and the cap, and Table is the paged path to everything.
- **B**, page the window too (load more as you scroll): a month would draw half its days.
- **C**, no cap: one odd month (a phone import of 3 000 calls) would freeze the page.

### NEED-2348 · Which time zone

- **Chosen: A, the computer's zone everywhere; the event's own zone in its details when it differs.** One zone keeps
  the grid true to the owner's day; no Temporal polyfill, no library.
- **B**, a zone switcher in the toolbar, as FullCalendar's named zones allow: needs Temporal or a zone database, and
  only matters when travelling.

### NEED-2349 · How overlapping events are drawn

- **Chosen: A, side by side in columns, spread right where free, capped by the column's width with "+N"**
  (FullCalendar's `eventMaxStack`, react-big-calendar's `no-overlap`). Every visible title is readable. Overlaps
  should be rare, because memo already joins a calendar event and its Zoom meeting into one row.
- **B**, Google's cascade, each later event drawn over the previous with an indent: more events visible at once in a
  narrow column, but titles hide under neighbours.

### NEED-2350 · How a call looks beside a meeting

- **Chosen: A, the same block in a lighter shape**: a meeting is filled with a left bar, a call is outlined with a
  dashed edge and a phone (or messenger) icon. No colour per kind or per calendar, as DESIGN.md keeps colour for state.
- **B**, a colour per kind or per source: quick to scan, but the grid becomes the colourful card wall the design
  refuses, and colour alone fails the a11y rule.
- **C**, calls in a lane of their own: clean, but a call during a meeting is the very thing worth seeing next to it.

### NEED-2351 · Hours shown in the week

- **Chosen: A, all 24 hours, scrolled to an hour before now (this week) or 08:00 (other weeks) on first open.** Calls
  happen at night too, and nothing is hidden.
- **B**, working hours only with a toggle: tidier, but a 23:00 call silently disappears, and it needs a setting.

### NEED-2352 · The page's place and name

- **Chosen: A, "Встречи" / Meetings / Reuniones, right after Tasks, icon `Video`, section id `meetings`,** which is
  where the owner's new sidebar puts it.
- **B**, "Звонки и встречи": more exact, but long for the sidebar; calls are named in the intro instead.

### NEED-2353 · Links to a meeting

- **Chosen: A, ask cli-core for `/v1/meeting/<ref>` and `/v1/meetings/<date>`; until then, in-app opening only, and
  the shown date is kept for the session, not across launches.**
- **B**, a desktop-only link format: it would drift from the grammar every CLI writes, which the backlog already
  calls out as a check to add.

### NEED-2354 · Where a meeting's findings are decided

The brief asks for findings to be confirmed in the meeting's details; the first version sends the owner to Memory.

- **Chosen: A, the count and "Confirm on Memory"**, which opens that batch on the Memory page through the existing
  `proposal` target. Memory already decides findings, and memo has no meeting command for them yet.
- **B**, decide them in the dialog with Memory's `Findings` part: needs memo's meeting command (gap 6) and that part
  freed from the Memory store, a refactor of its own.
- **C**, a small meetings-only findings list against memo's command, once it exists: a second way to decide the
  same thing, which the consistency guide argues against.

## Out of scope

Creating, editing, moving or resizing meetings; reminders and notifications; a recording player; a day view; a time
zone switcher; editing the transcript or its speakers; colour per calendar. Later steps, once their parts exist:
deciding findings inside the dialog (needs memo's meeting command and Memory's `Findings` freed from its store), a
Person filter chip (needs a paged people search), single-letter shortcuts with a setting to turn them off, and deep
links (cli-core first).

## Review

A fresh reviewer read this design against DESIGN.md, ui-consistency.md, CLAUDE.md's rules and the references above,
on 2026-11-13. Each finding and what changed:

| # | Finding | Done |
| --- | --- | --- |
| 1 | The cap hid every event when `maxColumns` was 1, and widths divided by the uncapped column count, contradicting the worked example | Step 5 rewritten: `shown = min(need, maxColumns)`, a separate rule for one column (80% plus the marker), N counts every hidden event of the run; example redone for 960, 1280 and wide |
| 2 | "Spread right" as written never applied (a block has one width; longer events sort first) | Step 6 rewritten with a case where it applies, and the test uses that case |
| 3 | At 3rem an hour a 15-minute block is about 10 px: unreadable and a tiny target; two lines did not fit at 30 minutes | 4rem an hour; the drawn minimum is one line (1.5rem), used by the layout too; two lines from 45 minutes; the third line cut |
| 4 | Always-on single-letter shortcuts fail WCAG 2.1.4 | Cut from the first version; listed under Out of scope |
| 5 | A capped window read newest first would draw the last days and leave the first empty; Month must read the six weeks it draws | Windows read oldest first, days past the cut say "Not read"; the window is what is on screen; gap 8 added |
| 6 | Reusing Memory's `Findings` is a store refactor, and memo has no command yet | Cut: the dialog shows the count and opens the batch on Memory through the existing `proposal` target; gap 10 added |
| 7 | `openTarget` has no `person` case | Listed as new work in Details and Components |
| 8 | Transcript fields did not match what Search already parses (`offset_ms`, `position`) | Contract uses memo's names; gap 9 says which command fills the Transcript tab |
| 9 | The Rust commands were missing | Added to Components with the rule 4 exception |
| 10 | DST: 01:30 happens once on 31 October; a fall-back event can end before it starts on the wall clock; "24 hours" misfiles a DST day | Wording fixed; end clamped to start plus real duration; all-day decided by calendar days |
| 11 | The all-day row changing height between weeks moves the grid; "+N" only on the start day hides it elsewhere | Fixed two-lane height; "+N" on every day covered |
| 12 | Tab through every event is a mixed model with up to 200 stops | One tab stop with roving focus; keys for empty days and the week's edges defined |
| 13 | Month: which element takes roving focus was unsaid | The gridcell; Enter goes inside, Escape returns |
| 14 | Calendar views cannot tell "no meetings at all" or "nothing matches" without another read | `EmptyState` only in Table; calendar views say it in the toolbar line |
| 15 | A red now-line uses `bad` outside its meaning | Drawn in `brand`, which already means "happening now" on lamps |
| 16 | A Person `Combobox` loads all of Contacts (rule 12); a Source menu from the read changes per window | Person chip deferred (typed `with:` works); Source is a fixed list |
| 17 | Ctrl+F is not a given in WebKitGTK; `content-visibility` support depends on its version | Ctrl+F claim dropped; the minimum WebKitGTK is checked before code, with a plain fallback |
| 18 | Selected outline never seen under the modal; "+N more" as a purple link; "Long"; FullCalendar zone claim | Selected cut; "+N more" a ghost button; "Duration"; the reference corrected |
| 19 | Scope to cut | Cut: findings decisions, shortcuts, Person chip, "in 2 h", the third line, Selected; logos only when memo sends those sources. Kept, against the advice: the hover tip on a cut-off title, because at 960 px a day is about 100 px and most titles are cut; it reuses `useTip` as board cards do |

<!-- cspell:words WCAG Fantastical Ruiz Müller ⓩ ⓜ ⓣ eventMaxStack dayMaxEvents jquense -->
