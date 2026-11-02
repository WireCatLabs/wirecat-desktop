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
