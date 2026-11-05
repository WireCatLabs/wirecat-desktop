# Analytics: what WireCat keeps and how it is used

The owner asked for it on 2026-11-02: "я бы сделал страницу с аналитикой и графики типа сообщений в день, самые
активные контакты, что-то по проектам (срезы), кол-во созданных/закрытых задач, память итп, чтоб можно было понять
какие-то ключевые метрики и объём данных итп и как инструмент помогает". In English: a page with charts of messages
per day, the most active contacts, slices by project, tasks created and closed, memory, the key numbers, how much data
there is, and how the tool helps.

Rule 1 holds: every number comes from a tool's own command. The page adds up and buckets the tools' answers. It does
not count anything itself. A number no tool gives is listed under "Gaps in the CLIs". The browser build shows it as
a sample marked "Preview". The real app does not show it.

## Where each number comes from

Checked against the installed tools on 2026-11-02 (tg 0.112.0, max 0.95.0, wa 0.26.0, memo 0.131.16): `--help` and
`commands info … outputSchema` only. No command that returns data was run against the owner's store.

| Metric | Source | State |
| --- | --- | --- |
| Data volume per source (messages, emails, documents, meetings), size on disk | `store info` (`by_provider`, `rows`, `bytes`), already read by the Storage page | existing |
| Growth by year | `store info` `by_year` (messages only) | existing |
| Messages per day, per messenger | `<tg\|max\|wa> <profile> stats messages show --by day --timezone <zone> --offline` | existing, new in the app |
| Messages you sent | the same with `--by sender`: the owner's row is keyed `me` | existing |
| Most active people | `stats messages show --by sender` (top 25 per profile, the owner left out) | existing |
| Most active chats | `stats messages show --by chat` | existing |
| Messages per day, Email and notes | none: memo has `stats tasks show` only | MISSING (1) |
| Open, overdue, closed tasks per project | memo `tasks counts` facets (`project`, `due`), with `overdue:true` and `closed:>=Nd` | existing |
| Tasks closed per day or week | memo `tasks counts closed:[a TO b]`, one run per bar (up to 14) | existing, slow |
| Tasks created per week | none: `tasks counts` has no `created` field | MISSING (2) |
| Memory and facts by status, new per week | `memories list`, `facts list` (the Memory page's read, 500 of each) | existing, capped |
| Messages per project | none | MISSING (3) |
| Agent runs, MCP calls, your own runs, by agent and tool | each tool's `runs list` (the Logs page's read, 500 per tool): `agent`, `via`, `mcp` | existing, capped |
| Agent tool calls in memo | `memo agents list` (no counts, 500 rows at most) | existing, capped (4) |
| Searches run | `<tg\|max\|wa> searches history` | existing, not used yet |
| Guides used | nothing records it | MISSING, not proposed |

## The page

Sidebar entry "Analytics", after Memory and before the system group. One header with the period (7 days, 30 days,
90 days, all time), a line naming the profiles the numbers add up, and "Hide names" for screen sharing. Then seven
panels, each naming the command its numbers come from:

1. **What WireCat keeps.** Totals, size on disk, where it comes from (one bar split by source), messages by year.
2. **Messages over time.** Messages in the period, how many you sent, a day on average, the busiest day, and stacked
   columns per messenger: days up to 30 days, weeks for 90, months for all time.
3. **Who you hear from.** The ten busiest people or chats across messengers. A person in two messengers stays two
   rows, because the tools give no way to tell it is one person.
4. **Projects.** Open, overdue and closed tasks and new memory per project.
5. **Tasks.** Open now, overdue, closed in the period, and closed per bar.
6. **Memory.** Memories and facts by status, and new ones per bar.
7. **How WireCat helps.** Agent runs, calls through MCP and your own terminal runs, by agent and by tool.

Each source keeps one hue whatever is missing or filtered: Telegram blue, MAX orange, WhatsApp aqua, Email yellow,
Google Drive pink, Zoom green, the rest grey. Purple stays the brand's and the lamp colours stay the lamps'. The order
was checked with a colour-blindness validator against the app's own panels (`#ffffff`, `#1b1a18`): adjacent pairs
pass the colour-blind checks in both themes. Three light hues are under 3:1 on white, so every chart has "Show the
numbers", a table of every value. Hover or the arrow keys pick a bar. A new period keeps the last charts, dimmed,
until it arrives.

## Second round (owner's review, 2026-11-02)

The owner: "What WireCat keeps — I'd add images, audio, transcripts. Also make the chart interactive to fit different
stuff, e.g. use dropdowns. Review analytics and improve, think what users may want to see here and what would help."

| Added | Source | State |
| --- | --- | --- |
| Images, voice and audio, video, files: count and size | `store info` `by_attachment_kind`, grouped (`mediaTotals`) | existing |
| Transcripts (voice messages and meetings as text) | `store tables list`: rows of `message_transcripts` and `meeting_transcripts` | existing |
| Links shared in messages | `store tables list`: rows of `message_links` | existing |
| One chart with dropdowns: measure, split, step | `stats messages show --by day` with a fixed term: `from:me`, `has:photo`, `has:voice`, `has:video`, `has:file`, `has:link`, `kind:private\|group\|channel`; tasks and memory from the reads above | existing |
| Received messages | every message less `from:me`, day by day | existing, derived |
| When you talk: weekday by hour | `stats messages show --by hour` | existing |
| What changed: who went quiet, which chats grew | `--by sender` and `--by chat` for the period and for `date:[2Nd TO Nd]` | existing |
| Is everything up to date: last sync per tool and profile | each tool's own last sync (`sync_last`, as on the Tools page) | existing |

The chart's choices: **Show** (messages, sent by you, received, photos, voice messages, videos, files, links, tasks
closed, memories and facts), **Split by** (source, profile, chat type for all messages, nothing) and **Step** (day,
week, month, as the period allows). Clicking a legend name hides that series in the bars and the numbers table; the
others keep their colours. Every count the chart asks for is kept for the session, so a choice seen once comes back at
once, and a new period keeps the last chart, dimmed, until its numbers arrive.

Each extra count is one `stats messages show` per profile, three at a time, asked only when its view is on screen.

### Missing for the next views

1. **How fast you reply, and chats waiting for you.** `tg stats contacts responses` (median and p90 reply time per
   person) and `tg stats messages unanswered` exist for the messengers; the page does not read them yet. Needed from
   the CLI: the owner's own reply time as one row (`--who me`), and a count of chats whose last message waits for the
   owner, so the page shows a number and not a list of names.
2. **Mail per day, per sender** (memo): gap 1 above. The chart then gains Email in Messages and a Mail measure.
3. **Meetings per day** (zm or memo): `store info` counts meetings, but no command counts them by day. Proposed:
   `zm <profile> stats meetings show --by day|week --json`, rows `{key, count, minutes}`.
4. **Voice transcriptions over time**: the store's tables give a total only. Proposed: `has:transcript` in the
   messages query language, so the chart's Show list gains it.
5. **Chats never fetched**: a sync's coverage per chat (how many chats have no history in the store). Proposed:
   `<tool> <profile> store coverage --json` with `{chats, fetched, never}`.
6. **Time saved by agents**: not built. No tool records how long a task would have taken by hand, and a guess would
   be a number the page cannot stand behind.

## Decided: layout A (NEED-256)

The owner looked at three layouts in the browser (`?layout=a|b|c`, removed again) and chose A: "use A, add 1 more chart
on memory and 1 more to meetings and that's it". The page now opens with this week against the same days of last week
(messages received, emails, meeting hours, tasks made and closed), then folding sections: Messages, Tasks, Meetings,
Agents, and Archive, folded at first. The period switch offers a week or a month; the archive keeps the longer view.

The two last charts, both on data the tools give today:

- **Facts by what became of them** (Tasks section, beside Memory): facts per week, by the week they were written and
  their status now (accepted, waiting, rejected, reversed, replaced), from `facts list`. memo does not record when a
  fact was approved, so "approved per week" is read as "written that week and accepted since" (proposal: an
  `accepted_at` field on facts).
- **Meeting time by weekday** (Meetings section): minutes per weekday, split by the four titles that take the most
  time and the rest, from `zm meetings list`.

No more cards in this round.

Last change before merging (NEED-257 A, NEED-258 A): "Open tasks" and "Tasks" showed the same open and overdue
counts, so Tasks is one card (open now, overdue, due today, oldest open, closed in the period, and the made-against-
closed chart); "Today and this week" repeated the top tiles and is gone.

## Round 3: what opens the page, and the layout

The owner, 2026-11-03: "Messages by year … seems useless - it duplicates our storage data and gives no insights to
user. I'd also not put Messages over time on top as it's not [something] that users wanna see every day first and [don't] make
the chart 100% width, only on small screens". Also: average response time, mail and meetings per day, meeting
duration, tasks per chat and meeting, time to resolve, age of open tasks, outliers; sections that fold.

Productivity tools that track people's own work (RescueTime, Clockwise, Microsoft Viva Insights, Slack's analytics,
Superhuman's email stats, Telegram's channel statistics) lead with a few numbers a person acts on today: how long
replies take, who waits for an answer, today's meeting and message load, work outside working hours, focus time
against meeting time. Totals of what is stored are a storage view, not an insight, so they move to the bottom.

**Order, top to bottom.** Each section folds (a chevron at the right edge of its heading; the choice is kept in
`localStorage`, `wirecat.analytics.closed`); a folded section asks its tools nothing.

1. **Today** (open): reply time (A3), waiting on you (A4), today's and this week's messages, emails (A1) and
   meetings, open tasks with their age, overdue and due today.
2. **Messages**: when you talk (weekday by hour, with the share after hours and at weekends), what changed and what
   stands out (outliers), who you hear from, messages over time (the chart with the dropdowns).
3. **Meetings**: meetings per week, hours per week, the average length, the series that take the most hours.
4. **Work**: projects, tasks (closed per week, tasks by chat with time to close), memory.
5. **Agents**: how WireCat helps.
6. **Storage and sync**: what WireCat keeps (totals, attachments, transcripts, links) and whether each tool is up to
   date.

**Moved down, not removed** (the owner, later the same night: reorder, do not delete). "Messages by year" and "Where
it comes from" are one panel in Storage and sync. The order itself waits for the owner's choice between layouts: it is
one list, `LAYOUT` in `src/features/analytics/layout.tsx` (sections, then cards by id from `CARDS`), so a new order is
an edit of that list only.

**Layout.** Inside a section, panels sit in a grid of two columns from 1024 px of window width (`lg`), one column
below it. No chart spans the page on a wide window. A panel keeps its height while it loads (skeletons of the final
size), so neither column moves when the other fills.

**Built from existing commands now:** meetings from `zm <profile> meetings list` (start, duration, title; up to 500
in the period); tasks by chat from `memo stats tasks show` (open, oldest open, median time to close); after-hours
and weekend shares from the hour counts; outliers from the day, chat and meeting counts already read (a day above the
mean by more than two standard deviations; the chat that grew most; the meeting title with the most hours). Reply
time, waiting on you, mail per day and chats never fetched show "arrives with a <tool> update" until A1, A3, A4 and
A6 exist; the browser build fills them with sample numbers marked "Preview".

## CLI aggregates wanted (specs for the CLI work, 2026-11-02, round 3)

Every command below is read-only, reads the local store only (`--offline` where the tool has it), accepts
`--no-record --json`, takes the period as a query term after `--` (`date>=30d`, `date:[60d TO 30d]`, nothing for all
time) and answers one `item`. Times are ISO 8601 UTC; day keys are `YYYY-MM-DD` in `--timezone`, week keys the Monday
`YYYY-MM-DD`. Counts only: no message text. Names appear only where a row is a chat, a sender or a meeting series; the
app shows them locally and never logs them. A tool without the command answers "unknown command", which the app shows
as "arrives with a <tool> update". The app's catalog block is `aggregates` (`catalog/tools.json`).

### A1 · Mail in and out per day (memo)

```text
memo stats mail show [--source email:<account>] --by day|week|sender --timezone <zone> --limit <n> --no-record --json -- [query]
```

```json
{ "item": { "by": "day", "received": 412, "sent": 96,
  "rows": [ { "key": "2026-11-01", "name": null, "received": 14, "sent": 3 } ] } }
```

`--by sender` keys a row by the sender's address id and gives `name`; `sent` is 0 there. Query fields as `search mail`.

### A2 · Meetings per day and week, duration, series (zm; memo for calendar events later)

```text
zm <profile> stats meetings show --by day|week|series --timezone <zone> --limit <n> --no-record --json -- [query]
```

```json
{ "item": { "by": "week", "meetings": 18, "minutes": 940, "mean_minutes": 52.2,
  "rows": [ { "key": "2026-10-26", "name": null, "meetings": 5, "minutes": 260, "mean_minutes": 52 } ] } }
```

`--by series` keys a row by the series id and gives its title as `name`, busiest (most minutes) first. A meeting with
no end counts in `meetings`, not in `minutes`.

### A3 · Response time, aggregate (tg, max, wa; cli-core)

```text
<bin> <profile> stats messages responses --who me|others --by day|total --timezone <zone> --no-record --json -- [query]
```

```json
{ "item": { "who": "me", "replies": 233, "median_ms": 1260000, "p90_ms": 15400000, "mean_ms": 4100000,
  "buckets": { "under_5m": 81, "under_1h": 74, "under_1d": 61, "over_1d": 17 },
  "rows": [ { "key": "2026-11-01", "replies": 9, "median_ms": 900000, "p90_ms": 7200000, "mean_ms": 2100000 } ] } }
```

`me`: how long the owner took to answer someone else's message in a one-to-one chat or a direct mention, measured from
the message to the owner's next message in that chat. `others`: the same for replies to the owner. No per-person rows
here; `stats contacts responses` keeps those.

### A4 · Waiting on you (tg, max, wa; cli-core)

```text
<bin> <profile> stats messages waiting --no-record --json -- [query]
```

```json
{ "item": { "chats": 7, "messages": 19, "oldest_at": "2026-10-28T09:12:00Z",
  "by_kind": { "private": 5, "group": 2 } } }
```

A chat waits when its last message is not the owner's and asks something of the owner (a question in a one-to-one
chat, or a mention). Counts only.

### A5 · Transcripts over time (cli-core query language)

`has:transcript` in the messages query language, so `stats messages show --by day -- has:transcript date>=30d`
counts voice messages that have a transcription. Meeting transcripts come from A2 with `has:transcript`.

### A6 · Chats never fetched (tg, max, wa; cli-core)

```text
<bin> <profile> store coverage --no-record --json
```

```json
{ "item": { "chats": 1611, "fetched": 1288, "partial": 201, "never": 122, "oldest_message_at": "2019-03-02T10:00:00Z" } }
```

### A7 · Tasks by where they came from, with resolve times (memo)

`memo stats tasks show` already gives per chat `open`, `oldest_open_at` and `median_close_ms`. Wanted on top:

```text
memo stats tasks show --by chat|meeting|project --timezone <zone> --no-record --json -- [query]
```

```json
{ "item": { "open": 31, "created": 44, "closed": 39, "median_close_ms": 172800000, "mean_open_age_ms": 518400000,
  "rows": [ { "key": "chat:telegram/1/-1001", "name": "Harbour launch", "open": 4, "created": 9, "closed": 7,
    "median_close_ms": 86400000, "mean_open_age_ms": 259200000 } ] } }
```

and a `created` time field in the task query language (`created>=30d`), so the period applies to `created` and
`closed`. `--by meeting` keys a row by the meeting the task was found in (`meeting:<account>/<id>`).

## Wired to the released commands (0.4.0, 2026-11-05)

The specs above shipped, with these names. Each card asks the tool's own command through `analytics_aggregate`; a
catalog `minVersion` says the tool is too old before anything runs, and "unknown command" from a tool without a
`minVersion` says the same, so the card reads "arrives with an update".

| Spec | Command the app runs | First version |
| --- | --- | --- |
| A1 mail in and out | `mail <profile> stats messages show --by day --timezone <z> --limit <n> -- date>=Nd` | mail-cli 0.15.0 |
| A2 meetings | `zm <profile> stats meetings history --by week\|series --timezone <z> --since-time Nd --limit <n>` | zm 0.67.0; an older zm keeps the cards on `zm meetings list` |
| A3 reply time | `<tg\|max\|wa> <profile> stats messages responses --who me --by day --timezone <z> -- date>=Nd` | tg 0.116.0, wa 0.29.0; max: next release |
| A4 waiting on you | `<tg\|max\|wa> <profile> stats messages waiting --timezone <z>` | the same |
| A6 chats never fetched | `<tg\|max\|wa> <profile> store chats status` | the same |
| A7 tasks by source | `memo stats tasks show --by chat\|meeting --timezone <z> -- created>=Nd` | memo 0.131.26 |

Reply time also shows how the replies split into under 5 minutes, under an hour, under a day and longer; waiting on
you splits one-to-one chats from groups; the Tasks card adds the tasks made in the period (A7 `created`, chats and
meetings together). The weekday chart and the week tiles still add up `zm meetings list`, which has each meeting's
start.

**Speed, measured (RISK).** A3, A4 and A6 had been checked on empty stores only. Timed once on the owner's store (about
6 GB) through the page's own command path, read only (`--offline --no-record`): every call answered in 0.3 to 0.65 s
for tg (4 profiles) and wa, 30 days and all time alike; max, still on 0.99.0, answered "too old" in 0.3 to 1.6 s. All
under the 2 s line, so the cards load with the page and need no lazy loading. Repeat with the ignored test
`real_reply_counts_timing` in `src-tauri/src/analytics.rs`.

## Decisions

- **One messenger, every profile.** Without `--source`, `stats messages show` counts the profile's own account
  (`prepareLucene` in cli-core, `src/services/messages-search.ts`), so the page runs it per profile and adds them up.
  The header names the profiles. No profile is picked for the owner.
- **Names stay local.** Sender and chat names leave Rust unmasked, the same exception to rule 4 as Search and Memory:
  they are shown on the page and never logged or put in a report. No error box on this page offers "Report this".
- **No chart library.** The charts are HTML and CSS boxes (`src/features/analytics/charts.tsx`, about 300 lines):
  columns, ranked bars, a split bar and figures. A library would add 50 to 150 KB for these four forms.
- **"All time" by month.** The tool keeps the oldest days when there are more rows than `--limit` (cli-core sorts
  days oldest first, then cuts), so "all" asks for up to 20,000 days and the page groups them by month.

## Gaps in the CLIs

Each is a CLI change. The app shows nothing in its place.

1. **Mail and notes per day** (memo). Proposed: `memo stats messages show [--source email:<account>|notes:<id>] --by
   day|sender --timezone <zone> --json -- <query>`, the same JSON as the messengers' (`{by, total, rows: [{key, name,
   count}]}`), so the page adds Email as one more series.
2. **Tasks created per bar** (memo, cli-core task store). Proposed: a `created` time field in the task query language
   (`created:[a TO b]`, `created:>=30d`), and `memo tasks counts --by day|week --timezone <zone>`. That returns
   `{rows: [{key, created, closed}]}`, so one run replaces the 14 the page makes now.
3. **Messages per project** (memo). Proposed: `memo projects stats <project>|--all --period 30d --json`. That returns
   `{items: [{project, key, messages, emails, documents, meetings}]}`, counted from the chats and mailboxes linked to
   each project (`relationships`).
4. **Counts without a list** (memo). `memories list`, `facts list` and `agents list` stop at 500 rows. Proposed:
   `memo memories counts`, `memo facts counts` (facets `status`, `project`, `--by week`) and `memo agents counts --by
   day|agent|tool`, in the shape of `tasks counts`.

## Risks

- **Not a risk: counting writes no search history.** cli-core's `messages.stats` calls `remember()`, which records
  the run in `searches history` unless history is off (`src/services/messages.ts`, around line 320). The messenger
  context sets that switch from the run's `record` setting, so `--no-record` turns history off as well
  (`src/cli/messenger/context.ts`, around line 792; since cli-core 0.467.0, 2026-10-27). Every template passes
  `--no-record`, and the installed tg and max carry cli-core 0.531.0 and 0.517.0. Read in the source, not seen in a
  live run. A tool on an older cli-core would write one line per count.
- **RISK: about a dozen tool processes per load.** At most three run at once. A slow store makes the page fill
  section by section; the skeletons hold the final size.

## Browser build

`?section=analytics` opens the page. `?analytics=real` (no Preview parts, as in the real app), `?analytics=old` (Telegram too old to count), `?analytics=fail` (the work
profile does not answer), `?analytics=empty` (no messages in any period). The preview fills gaps 2 and 3 with sample
numbers marked "Preview"; `analyticsPreview` answers null in the real app and in `?showcase` (the owner's choice,
2026-11-02: the website shows only what the tools count today).

## Test data

`chat` is cli-core's own test program (account 500). A developer's store may hold it; Storage names it "Test data".
Analytics leaves it out of every number: its rows come off the store's totals, and it is not a source in any chart
(`ownersData` in `src/domain/analytics.ts`).

## Decided

- The page stays after Memory in the sidebar (NEED-252, A).
- `?showcase` hides the "Preview" parts (NEED-253, B).
