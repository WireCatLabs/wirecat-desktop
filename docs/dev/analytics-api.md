# Analytics API

The contract between the Analytics page (the client: `src-tauri/src/analytics.rs`, read by
`src/platform/analytics-schemas.ts`) and the tools whose counts it shows (the CLIs: tg, max, wa, zm, memo and
Email's `mail`). The commands are templates in `catalog/tools.json`: `stats` and `aggregates`. Change it here
first, then on both sides.

## Principles

- **The tool counts, the page adds up.** Every number comes from a tool's own command. The page sums profiles and
  groups days into weeks or months. It counts nothing itself.
- **Local store only.** Every template reads the store on this computer: `--offline` where the tool has it, never
  `--sync-first`. Every template passes `--no-record` and `--json`.
- **Counts, not text.** No message text comes back. Sender, chat and meeting names do, and the page shows them. They
  are never logged or put in a report.
- **One profile per run.** The app runs a template once for each profile and adds the answers. It never picks a
  profile.
- **A tool too old says so.** A catalog `minVersion` is checked before anything runs. An answer of "unknown command"
  means the same: the card reads "arrives with an update".
- **Muted chats count nowhere.** A count of messages adds `muted:false` to its query. A copy that refuses the field
  (`query.unknown-field` with `muted`) is asked again without it, and the app remembers this per program.

## Message counts: `stats.messages`

tg, max and wa. The template:

```text
<bin> {profile} stats messages show --by {by} --timezone {timezone} --limit {limit} --offline --timeout 60s
  --no-record --json -- {query}
```

- `{by}` is `day`, `hour`, `sender` or `chat`. `{timezone}` is an IANA zone (`Europe/Madrid`).
- `{limit}` is at most 1000; the tool refuses more. Senders and chats ask for the top 25, or 1000 for the full list.
  A day or hour count longer than 1000 rows runs in stretches, newest first, and the rows are added up.
- `{query}` holds fixed terms only, never the owner's words: the period, the kind of message, and `muted:false`.
  With no term, `--` and `{query}` are left out.
  - The period: `date>=30d` for the newest stretch, `date:[60d TO 30d}` for one before it, or
    `date:[2026-11-02 TO 2026-11-08]` for calendar days.
  - The kind: `from:me`, `has:photo`, `has:voice`, `has:video`, `has:file`, `has:link`, `kind:private`,
    `kind:group`, `kind:channel`, or `(kind:private OR (kind:group participants_count<10))` for personal chats. A copy
    that refuses `participants_count` counts private chats alone, and the page says so.

The answer:

```json
{
  "item": {
    "by": "sender",
    "total": 412,
    "rows": [{ "key": "me", "name": null, "count": 96 }]
  },
  "meta": { "truncated": false }
}
```

- The body is `item`. An older envelope put it first in `items`; both are read.
- `key` is a day (`YYYY-MM-DD` in the zone), an hour, a sender's id or a chat's id. The owner's own row is `me`.
- `total` is optional; without it the page adds the rows.
- `meta.truncated: true` means the tool cut the list at `--limit`.

## Aggregates: `aggregates`

Each entry in a tool's `aggregates` is `{ args, date, minVersion }`. The app knows these names only:

| Name | Tool | Command | `date` | The page reads |
| --- | --- | --- | --- | --- |
| `responses` | tg, max, wa | `{profile} stats messages responses --who me --by day` | `date` | `replies`, `median_ms`, `p90_ms`, `buckets{under_5m, under_1h, under_1d, over_1d}`, `rows[{key, replies, median_ms, p90_ms}]` |
| `waiting` | tg, max, wa | `{profile} stats messages waiting` | — | `chats`, `messages`, `oldest_at`, `by_kind{private, group}` |
| `coverage` | tg, max, wa | `{profile} store chats status` | — | `chats`, `fetched`, `partial`, `never` |
| `meetings` | zm | `{profile} meetings list --limit 500` | `started_at` | `items[{started_at, duration_ms, title}]` |
| `meetingsWeek` | zm | `{profile} stats meetings history --by week --since-time {since}` | — | `meetings`, `minutes`, `rows[{key, name, meetings, minutes}]` |
| `meetingsSeries` | zm | `{profile} stats meetings history --by series --since-time {since}` | — | the same; keys `series:<id>` and one `no-series` |
| `mail` | Email (`mail`) | `{profile} stats messages show --by day` | `date` | `received`, `sent`, `rows[{key, received, sent}]` |
| `taskSources` | memo | `stats tasks show --by chat` | `created` | `open`, `created`, `closed`, `median_close_ms`, `mean_open_age_ms`, `rows[{key, name, open, created, closed, oldest_open_at, median_close_ms}]` |
| `taskMeetings` | memo | `stats tasks show --by meeting` | `created` | the same, a row per meeting |
| `projectActivity` | memo | `stats projects show --since-time {sinceOrAll} --limit 200` | — | `items[{ref, key, name, chats, muted, messages, sent, last_at, top[{ref, title, messages}], partial}]`, `page.has_more` |

Every command also takes the options of its template in the catalog: `--timezone {timezone}`, `--limit {limit}`,
`--offline` and `--timeout 60s` where the tool has them, `--no-record --json`. The exact words and each `minVersion`
are in `catalog/tools.json`.

- **The period.** With a `date` field, the term `<date>>=<N>d` (or `<date>:[<from> TO <to>]` for calendar days) goes
  after `--`. `{since}` becomes `<N>d`; for all time the option and its value are both left out. `{sinceOrAll}`
  becomes `<N>d` or `all`.
- **Rows.** `{limit}` is the period's days plus 7, at least 50, or 5000 for all time.
- **Muted chats.** `responses` and `waiting` add `muted:false`, with the same fallback as the message counts.
- **The answer.** The body is `item`, else the whole answer. The page reads the fields above and lets others pass. A
  JSON `error` or a non-zero exit is a failure, shown with its `error.message` and `error.code`.

## In the browser build only

`analyticsPreview` (tasks made and closed per week) is filled by the browser build and marked "Preview". The real
app answers `null`: no tool counts it yet.
