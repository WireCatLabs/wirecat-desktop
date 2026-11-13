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
| [FullCalendar](https://fullcalendar.io/docs) | Side-by-side columns for overlapping events in the time grid and a cap on them: [`eventMaxStack`](https://fullcalendar.io/docs/eventMaxStack) replaces the hidden ones with a "+more" link that opens a popover. Month cells cap their events the same way: [`dayMaxEvents`](https://fullcalendar.io/docs/dayMaxEvents) (the "+more" link is not counted). Time zones: the docs describe `local` (the browser's zone) as the default and say a named zone needs Temporal ([`timeZone`](https://fullcalendar.io/docs/timeZone)). | Its plugin system, drag-to-create and resize: this page creates and moves nothing. |
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
- **`memo meetings show <ref> --json --no-record`**: the participants, the transcript (`lines[]`: `at_ms`, `speaker`,
  `text`), the summary, the findings waiting for a decision with what a decision needs, the calendar event (its
  zone, its organiser, its join links), and the linked documents (`ref`, `title`, `url`).

Filters are words of the query, as on Tasks and Search, so chips and typed words are one state (`FilterBar`):
`kind:meeting|call|event`, `source:<id>`, `with:<person ref>`, `has:transcript`. Titles, names and transcript text
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
   `actions confirm <id> <finding ids…> --fingerprint <hash>` on the Memory page.
7. **The person ref on a participant**, so a name links to Contacts; without it the name is plain text.

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
│ [Kind: all ▾] [Source: all ▾] [Person ▾] [☐ Only with a transcript]                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Today** jumps to the week or month holding today and scrolls the time grid to now. Shown as a plain secondary
  button even when today is on screen; it then only scrolls (a button that does nothing visible would be disabled,
  and rule 10 forbids disabling it for that).
- **‹ ›** step one week or one month (`aria-label` "Previous week" / "Next week" and so on).
- **The range title** is a button that opens `DatePopover` with `Calendar`, to jump to any date. The week reads
  "10 – 16 November 2026", "29 December 2026 – 4 January 2027" across years, "Ноябрь 2026" for a month; all through
  `Intl.DateTimeFormat` in the interface language.
- **Filters** are `FilterBar` chips: Kind (`FilterMenu`: all, meetings, calls, calendar events), Source (the sources
  present in the read), Person (a `Combobox` over Contacts), and "Only with a transcript" (`ToggleChip`). They change
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
- **Hours**: all 24, at `3rem` an hour (it grows with the interface size like everything else). The time gutter in
  mono (`09:00` in Russian and Spanish, `9 AM` in English, from `Intl`). The grid scrolls inside the page, which
  is `Page fill`, like the Tasks board. The first time it opens on a week, it scrolls to an hour before now on the
  current week and to 08:00 on others ([NEED-2351](#need-2351--hours-shown-in-the-week)); after that, ‹ › and
  re-reads keep the scroll where the owner left it.
- **The all-day row** holds all-day events and timed events of 24 hours or more, each as a bar across the days it
  covers, packed into lanes (see [Month layout](#month-and-all-day-layout)). At most two lanes show; a third becomes
  "+N" in the day it starts, opening the same day list as a month cell. The row grows only between the read and the
  first paint: once drawn, its height stays for that week.
- **The now-line**: a 2px `bad` line with a dot at the gutter edge across today's column, and a thin `bad` tick
  across the other days, moved once a minute (one timer, no read). Red is used here as Google and every calendar
  does, and as the one red that is not an error; it is never filled behind text.
- **Events** are blocks placed by the [overlap layout](#overlap-layout-in-the-time-grid). A block shorter than 15
  minutes is drawn 15 minutes tall, so a 3-minute call can still be clicked and read.

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
  resize, not per event); when more remain, the last line becomes "+N more" (`LinkButton`). The "+N" counts what is
  hidden, as in FullCalendar.
- **"+N more"** opens a popover anchored to the cell (the `DatePopover` frame, the panel shadow, outside every
  scroller) that lists all of that day's events, each a button that opens the details. Escape closes it and returns
  focus to the "+N" link.
- **A day number** is a button that opens Week on that day's week.

### Table

```text
┌──────────────────────┬──────────────────────────────────┬─────────┬─────────────────┬───────┬──────────┬─────┐
│ When                 │ Title                            │ From    │ People          │ Long  │ Has      │     │
├──────────────────────┼──────────────────────────────────┼─────────┼─────────────────┼───────┼──────────┼─────┤
│ Thu 13 Nov 12:00     │ ▣ Board review                   │ ⓜ ▤     │ Ana, Kai +4     │ 3:00  │ ✎ ≡ ●    │ ! 3 │
│ Thu 13 Nov 10:20     │ ☏ Kai Müller                     │ ☎       │ Kai Müller      │ 0:42  │ ✎        │     │
│ Wed 12 Nov 10:00     │ ▣ Review                         │ ⓩ ▤     │ —               │ 1:00  │          │     │
└──────────────────────┴──────────────────────────────────┴─────────┴─────────────────┴───────┴──────────┴─────┘
                                                        ‹ 1 2 3 … 9 ›   25 ▾ per page
```

- `DataTable`, `Pager` with `PAGE_SIZES`, pages read from memo (`--limit`, `--page`, `total`), never a whole list
  sliced in the app (rule 12; `TaskTable`'s app-side paging is the C15 shape this page must not copy).
- Columns: When (date and time in mono; a future row says "in 2 h" beside it in `ink-soft`), Title (kind icon, then
  the title; the row's button), From (`ServiceIcon` per source), People (first two names, "+N"), Long (duration in
  mono, `h:mm`), Has (transcript, summary, recording icons, each with its name for screen readers), and the findings
  count as a `warn` pill ("3 to confirm") when any wait.
- The row's title opens the details dialog, as a task's title does on Tasks. `below` is used only for a failed
  decision's error line under the row, as `TaskTable` does.

## The event block and the row

One component, `MeetingChip`, in three sizes: the week block, the month line and the table's title cell. It never
uses a per-calendar colour: state is said by shape, icon and the existing tokens ([NEED-2350](#need-2350--how-a-call-looks-beside-a-meeting)).

| | Meeting (`meeting`, `event`) | Call (`call`) |
| --- | --- | --- |
| Week block | `app-2` fill, `line-strong` hairline, a 3px `ink-soft` bar on the left | `app` fill, dashed `line-strong` hairline, no bar |
| Kind icon | lucide `Video` for a meeting, `CalendarDays` for a bare calendar event | `Phone`, or the messenger's `ServiceIcon` for a messenger call |
| Title | the meeting's title | the other side's name, else the number as memo prints it (mono) |

- **Lines by height** (week): under 30 minutes, one line "10:00 Title"; from 30 minutes, the title on the first
  line and the time and source icons on the second; from 90 minutes, a third line with the first participants.
- **Badges**, at the block's bottom right, icons only (named for screen readers, `useTip` on hover): transcript
  (`FileText`), summary (`AlignLeft`), recording (`Disc`). Findings waiting for the owner: a small `warn` lamp
  (`Lamp` `sm`) with the count beside it in the week and table; the lamp alone in a month line.
- **Time states**: a past event's text steps back to `ink-soft`; an event happening now carries the `doing` lamp; a
  cancelled calendar event (if memo says so) is struck through in `ink-dim`.
- **Selected** (its dialog is open): the global 2px `brand` outline, the same as focus, so there is one outline.
- **Hover** on a week block or a month line shows a `TipPanel` with the full title, the time, the sources and the
  participants, for blocks too narrow to read. Click and Enter open the details; the tip is never the only way to a
  fact.

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
│ Findings to confirm (3)                                  │ Participants (6)               │
│ ☑ Send the deck to Ana by Friday       task              │ Ana Ruiz          → Contacts   │
│ ☑ Budget is 40k                        fact              │ Kai Müller        → Contacts   │
│ ☐ Kai leaves in March                  fact              │ ana@example.com                │
│ [Save decisions]                                         │                                │
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
- **Findings to confirm**, first, because they are the one thing that waits for the owner: Memory's findings part
  (`Findings` in `src/features/memory/RowFindings.tsx`) moved to `shared/` and reused, with the same marks and one
  Save that sends them all, through the command memo names ([gap 6](#gaps-in-memo)). It is the dialog's one primary
  button while marks are unsaved. After the save the dialog reads the meeting again and the window list is
  invalidated, so the week's `warn` lamp goes away.
- **Summary**: memo's text as prose, `text-body`, max 70ch, selectable.
- **Participants**: a list; a name with a person ref is a `LinkButton` that opens the person on Contacts through the
  same target as the `person` deep link (`openTarget` in `src/features/links/open.ts`), and the dialog closes first.
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
  virtualising library, and Ctrl+F and find still see every line.

## States

| State | What shows |
| --- | --- |
| memo missing or older than the page's `minVersion` | `ToolNeeded` with the update, as on Tasks |
| First read | The grid itself (days, hours, today's line) at once; `Skeleton` blocks in three columns at plausible places, the first labelled "Reading meetings". Table: `DataTable` `placeholders`. Nothing moves when the rows land. |
| Next or previous window | The new dates draw at once; events of the old window are not shown under the new dates. The new window's events fade in (`.reveal`). A read that takes over 300 ms shows the skeletons. |
| Read failed | `PageError` with Try again and Report this; the header's Read again hides while it shows. |
| A window with nothing | The empty grid, and one line in the toolbar: "No meetings this week". Not an `EmptyState` box over the grid: an empty week is a normal week. |
| No meetings at all | `EmptyState` "No meetings yet" with what fills the page (a sync of Zoom or the calendar, a phone import) and the guide link. |
| Filters match nothing | `EmptyState` "Nothing matches" with Clear filters (secondary). |
| The window holds more than the cap | `NoticeChips` chip "Showing 500 of 812: narrow the filters or open Table" ([NEED-2347](#need-2347--how-much-a-window-reads)). |
| Details failed to read | `ErrorNotice` inside the dialog with Try again; the header line from the list row stays. |
| A decision refused | memo's reason through `errorText` under the findings, the marks kept. |

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
  the local wall-clock end minus start, at least 15 minutes. The grid always draws 24 hours.
- **DST in Europe/Madrid** (the owner's zone): on 28 March 2027 the clock jumps 02:00 → 03:00, so no local time
  02:00–02:59 exists; an event from 01:30 to 03:30 is one real hour and is drawn from the 01:30 line to the 03:30
  line, its header saying "1 h". On 31 October 2027 the clock falls back 03:00 → 02:00; an event from 01:30 to 02:30
  of the second pass is two real hours, drawn 01:30–02:30, and its header says "2 h". Durations always come from the
  instants, never from the drawing.
- **Crossing midnight**: a timed event under 24 hours that crosses midnight is split into one segment per day; the
  first ends at the bottom with a "continues" mark, the next starts at 00:00 with "from the day before". Both are one
  event (one tab stop, the first segment's).
- **All-day**: `all_day` from memo, or a timed event of 24 hours or more, goes to the all-day row. An all-day event's
  end is exclusive (the calendar's convention), so a one-day event on the 13th ends on the 14th and covers one cell.
- **Week start and formats** come from the interface language, not the system locale, as `Calendar` already does.

## Overlap layout in the time grid

A pure function in `src/domain/meeting-layout.ts`, with no React and no DOM:

```ts
layoutDay(events: DaySegment[], maxColumns: number): Placed[]
// DaySegment: { key, startMin, endMin }   minutes from local midnight, 0…1440, endMin > startMin
// Placed:     { key, column, columns, span, hidden }   or a "+N" marker per cluster
```

1. **Normalise.** `endMin = max(endMin, startMin + 15)`, so a short call takes the room it is drawn with; overlap is
   decided on the drawn size, or two stacked 3-minute calls would draw on top of each other.
2. **Sort** by `startMin`, then by longer first (`endMin` descending), then by `key`, so the same data always gives
   the same picture.
3. **Clusters.** Sweep in that order keeping the cluster's latest `endMin`; an event that starts at or after it
   (`startMin >= clusterEnd`) closes the cluster and opens a new one. Events touching end to start (10:00–11:00 and
   11:00–12:00) do not overlap.
4. **Columns.** Inside a cluster, give each event the lowest column whose last event ends at or before this one's
   start; keep each column's last `endMin` in an array, so this is O(n · c) with c the columns used. `columns` of
   every event in the cluster is the cluster's column count.
5. **Spread right.** An event spans further columns to its right while none of their events overlap it (`span`),
   so a long meeting beside a short call takes the free room once the call ends, as FullCalendar draws it. Its
   width is `span / columns` of the day, its left is `column / columns`.
6. **Cap.** `maxColumns` comes from the day column's width (`floor(width / 4.5rem)`, at least 1, at most 4), so a
   960 px window shows fewer side by side. Events whose column is at or past `maxColumns - 1` while the cluster needs
   more are `hidden`; the last visible column holds one "+N" marker per run of hidden events, spanning their time,
   that opens the same day list as a month cell. The marker says the count and is a button.
7. **Result**, all in fractions and minutes, so the component only multiplies by the hour height and day width.

Five meetings at 10:00 in a 960 px window: the day column is about 100 px, `maxColumns` is 1 (4.5rem ≈ 59 px at the
13 px root), so the first meeting draws full width and a "+4" marker sits at its right edge over its own time span,
opening the list of all five. At 1280 px with 2 columns: one meeting and "+4".

## Month and all-day layout

`layoutWeekRow(spans: DaySpan[]): Lane[]` in the same file: for one week row, each multi-day or all-day event is a span
of day indexes (0–6, clipped to the row, flagged when it continues from the previous row or into the next one).
Sort by start day, then longer first, then key; give each the lowest lane free over all its days (greedy interval
colouring). The month cell draws lanes first, then its timed events in start order, then "+N more"; the lanes a
cell cannot fit count into its own "+N". The week's all-day row uses the same function with a cap of two lanes.

## Performance

- **One read per window**: `useQuery` in `src/features/meetings/api.ts`, key
  `["tool", "memo", "meetings", from, to, query]`, `staleTime` one minute, no refetch on focus (the client's
  default: a read starts a memo process). ‹ › to a window read in the last minute shows at once. No prefetch of the
  next window: every read is a process the owner did not ask for.
- **The cap**: a window read asks `--limit 500`. A month of 200 meetings is one read; a month of 812 shows 500 and the
  chip, and Table pages through all of them.
- **The details**: key `["tool", "memo", "meeting", ref]`, read on open, kept five minutes. A decision invalidates it
  and the windows that hold it.
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
| `layoutDay`, `layoutWeekRow`, `splitByDay`, `weekWindow`, `monthWindow` | `src/domain/meeting-layout.ts` | new, pure, tested |
| `TimeGrid`: hour gutter, day columns, all-day row, now-line, scroll keeping; takes placed items and a render function | `src/ui/TimeGrid.tsx` | new |
| `MonthGrid`: six-week APG grid with roving focus, lanes, "+N more"; takes items and a render function | `src/ui/MonthGrid.tsx` | new; its key handling moves out of `Calendar.tsx` into a shared helper both use |
| `weekStart`, `dayOf` | `src/ui/Calendar.tsx` | reused, exported |
| `DatePopover`, `Calendar` | `src/ui/Calendar.tsx` | reused: the range title's picker and the "+N more" popover frame |
| `MeetingChip`, `MeetingDialog`, `TranscriptView`, `MeetingsTable`, `Toolbar`, `Filters`, store, api, messages | `src/features/meetings/` | new |
| Findings part | `src/features/memory/RowFindings.tsx` → `src/shared/` | moved and reused |
| Transcript line | `ContextLine` in `src/domain/search-context.ts` | reused; Search's `HitContext` and the dialog draw it the same way |
| `Page`, `PageHeader`, `Segmented`, `FilterBar`, `FilterMenu`, `ToggleChip`, `Combobox`, `DataTable`, `Pager`, `Dialog`, `Tabs`, `OpenLink`, `ExtLink`, `LinkButton`, `CopyRef`, `ServiceIcon`, `ToolIcon`, `Lamp`, `Pill`, `Skeleton`, `EmptyState`, `ErrorNotice`, `PageError`, `NoticeChips`, `ToolNeeded`, `RefreshButton`, `Crossfade`, `TipPanel` | as named | reused |
| Google Meet and Telemost logos | `src/assets/logos/` with their source in `SOURCES.md`, the entries in `ToolIcon.tsx` | new assets |

## Accessibility

- **One focus outline**: the global 2px `brand` outline at 2px offset; a selected block uses the same outline, so a
  block is never shown with two rings.
- **Week**: each day column is a `role="group"` named by its date ("Thursday 13 November, today, 4 meetings") holding
  a list of event buttons in start order; Tab moves through them in time order across the week, and the toolbar comes
  first. This is a judgment call, not what APG prescribes: a cell of the time grid is not something to act on, and
  Table is the full keyboard and screen-reader path to every meeting. Arrow keys inside a column move to the
  previous and next event of that day; Left and Right move to the nearest event in time on the next day.
- **Month**: an APG grid (`role="grid"`, `row`, `gridcell`, `columnheader`) with one tab stop. Arrows move by day,
  Home and End to the week's ends, Page Up and Page Down by a month (loading the next window), Ctrl+Home and Ctrl+End
  to the first and last cell. Enter on a day moves into its events; Escape returns to the cell.
- **An event button's name** says it all once: "Board review, Thursday 13 November 12:00 to 15:00, Google Meet,
  transcript, summary, 3 findings to confirm". Icons inside are `aria-hidden`.
- **Shortcuts** when focus is not in a field, listed in the guide and in `aria-keyshortcuts`, on Google's letters so
  they are familiar: `t` today, `j` or `n` next, `k` or `p` previous, `w` Week, `m` Month, `l` Table (list). Always
  on: a single letter does nothing else on this page.
- **Live region**: moving the window says the new range ("10 to 16 November 2026, 12 meetings") once the read lands.
- **Colour is never alone**: a call differs by its icon and its dashed edge, findings by a count and a lamp with a
  label. Past and future differ only by text colour, which is fine: the time beside each event already says it.
- **Contrast**: block text on `app-2` uses `ink`; past events use `ink-soft` (both pass 4.5:1 on `app-2` in both
  themes, as Tasks' rows do).

## Motion

Rule 9 through the shared pieces; every one instant under reduced motion.

- **View switch**: `Crossfade` (the old view fades out over the new in `exit`), the toolbar and filters stay still.
- **‹ ›**: the day columns slide by a fifth of their width in the move's direction and fade in `normal`; the time
  scroll does not move.
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
  five at the same start with `maxColumns` 1, 2 and 4 (the "+N" count and span); a long meeting beside two short
  calls (spread right); a 3-minute call next to another (minimum height decides the overlap); a chain A–B, B–C where
  A and C do not overlap (one cluster, two columns); 200 random events give no two visible blocks overlapping and the
  same result twice; split at midnight; an event of exactly 24 hours goes to the all-day row; lanes for three
  multi-day spans across a week row break; month and week windows across a year end.
- **DST**: with `TZ=Europe/Madrid`, the week of 28 March 2027 is 167 hours and ends at midnight; an event 01:30–03:30
  that day draws from the 01:30 line and says "1 h"; the week of 31 October 2027 is 169 hours, the second 01:30–02:30
  says "2 h". The test script sets `TZ`, as Node reads it at start.
- **`MeetingsPage.test.tsx`** on the mock (`src/platform/mock-meetings.ts`, synthetic data, `?section=meetings` with
  `?meetings=empty|fail|many|dst`): the view switch keeps filters; ‹ › reads the next window once; "Only with a
  transcript" adds `has:transcript` to the read; Table asks memo for page 2 and never slices; a block opens the dialog
  and Escape returns focus to it; month "+N more" lists all of the day; the details' participant opens Contacts; a
  findings save sends one command and the lamp goes.
- **`MonthGrid.test.tsx`**: roving focus, every key in the APG list, Page Down reads the next month.
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

- **Chosen: A, a window reads up to 500 rows, with a chip when more exist; Table pages on the server.** A calendar
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

## Out of scope

Creating, editing, moving or resizing meetings; reminders and notifications; a recording player; a day view; a time
zone switcher; editing the transcript or its speakers; colour per calendar.

<!-- cspell:words Fantastical Ruiz Müller ⓩ ⓜ ⓣ eventMaxStack dayMaxEvents jquense -->
