# Sync API

The contract between WireCat Desktop (the client, `src-tauri/src/sync.rs`) and each tool's own sync command (the CLI:
cli-core `src/cli/messenger/backfill-command.ts` for tg and max, and the sync commands of zm, drive, memo and mail).
Change it here first, then on both sides.

## Principles

- **The tool syncs; the app only starts, stops and reads.** The app runs the words in the catalog's `sync` block for
  the profile the owner chose.
- **Only counts leave Rust.** Chat titles, chat keys, account names and a tool's error message stay behind. Of a
  failure the window gets the `code`, the `reason` and the failed run's id.
- **The tool's time limit ends the run first.** The app's own limit is three hours, longer than the tool's, so the
  tool stops cleanly and keeps what it fetched.

## The catalog block

```json
"sync": {
  "run": ["{profile}", "messages", "sync", "--all", "--timeout", "120m", "--record", "--json"],
  "last": ["runs", "list", "command:\"messages sync\" status:success", "--limit", "200", "--no-record", "--json"],
  "lastShape": "runs",
  "what": "messages",
  "note": null
}
```

- `run`: every sync passes `--record`, so the tool's `runs list` keeps the run. `null` means there is no sync to
  start (wa); `note` then says why.
- `last`: the words that answer "last synced". `lastShape` says how to read them: `runs` or `driveStatus`.
- `what`: which summary shape the answer has: `messages`, `files`, `meetings`, `mail`, `notes and mail` or
  `records` (a tool the owner added).
- Stop is `SIGTERM` to that process, then a kill of its group after five seconds.

## Progress on stderr

```json
{"event":"progress","step":"sync","chats":40,"chats_done":4,"fetched":1240}
```

`fetched` is required; `chats` and `chats_done` may be null. Any other field is dropped. memo also prints
`{"event":"progress","step":"notes","done","total","unit","label"}`, often redrawn on one line with `\r`: `unit` is
`files` or `bytes`, and `label` is kept only when it is an id (`26`, `e5-small`), not a path.

A tool without progress lines gets a stage from its plain notes: `messages so far`, a rate limit (`FloodWait`,
`rate limit`, `waiting`), `mail …`, `embedding` or `search by meaning`.

## Failure on stderr

`{ "error": { "code", "reason", "run_id", "retry": { "after_ms" } } }`. `details.retry_after_ms` is read when
`retry.after_ms` is missing. `code` and `reason` are kept only as plain identifiers of at most 64 characters. Exit 9
is the tool's time limit.

## The answer on stdout

`{ "item": … }`, read by `what`:

| `what` | New | Places | Failed | Left | Complete |
| --- | --- | --- | --- | --- | --- |
| `messages` | `fetched` | `items[]` with `fetched > 0` | `batch.failed`, else `items[]` with `error` | — | `complete`, default true |
| `files` | `saved` | — | `errors[]` length | `pending` | `pending == 0` |
| `mail` | `saved` | — | `unreadable` | `remaining` | `complete`, default `remaining == 0` |
| `meetings` | `meetings` | — | `warnings[]` length | — | no warnings |
| `notes and mail` | `mail[].saved` + `notes[].changed` | entries with a count above 0 | `failed[]` length | — | every `mail[].complete` |
| `records` | each number field, or `created + updated` of each object field | kinds above 0 | `refused` + `issues[]` length | — | `state` is not `partial` |

A shape the app does not know gives zeros, not an error.

## Last synced

- `runs`: the `items[]` of `runs list` (see [Runs API](runs-api.md)). The newest run of the chosen profile counts. A
  run with no `profile` counts for every profile. When `run` has `--all`, a run whose `argv` lacks `--all` (a
  one-chat sync) does not count. The time is `completed_at`.
- `driveStatus`: `item.last_sync` (set only when nothing is pending) and `item.pending`.
