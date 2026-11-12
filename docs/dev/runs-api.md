# Runs API

The contract between WireCat Desktop (the client: `src-tauri/src/runs.rs`, the schemas in
`src/platform/runs-schemas.ts`, the fields in `src/domain/runs.ts`) and each tool's run log (the CLI: cli-core
`src/runs/run.ts`, `events.ts` and `run-context.ts`). Change it here first, then on both sides.

## Principles

- **The tool keeps the log; the app only reads it.** The app runs `runs list` and `runs show` and never opens a run
  file itself.
- **Every run is kept,** successes too, unless the config says `record: false` or the command says `--no-record`.
  The app's own reads pass `--no-record`; what the owner starts passes `--record`.
- **The tool masks first.** Secrets and phone numbers are already hidden in a record, so the Logs page shows it as
  kept. Anything sent away is filtered again (`report.rs`, [Bug report API](report-api.md)).
- **Read field by field.** Older runs lack fields and newer ones add more, so every schema is loose.

## Commands

From the catalog's `runs` block, with no profile word:

```text
runs list {query} --limit {limit} --page {page} --no-record --json
runs show {run} --no-record --json
```

- `{query}` is one argument of at most 500 characters, never starting with `-`. With no query the slot is dropped.
- `{limit}` is 1 to 1000; `{page}` starts at 1.
- `{run}` is at most 200 characters of `A-Za-z0-9-_.`, never starting with `-`.
- A tool too old for `runs` answers `unknown command`; the Logs page then says its logs arrive with its next update.

## `runs list`

`{ "items": [<run>], "page": { "has_more": false } }`

## `runs show`

`{ "item": { <run>, "event_count": 12, "events": [<event>] } }`

## A run

```json
{
  "run_id": "…",
  "command": "chats list",
  "cli_command": "tg chats list",
  "argv": ["personal", "chats", "list"],
  "profile": "personal",
  "status": "success",
  "started_at": "2026-11-12T09:00:00.000Z",
  "completed_at": "2026-11-12T09:00:01.200Z",
  "duration_ms": 1200,
  "requests": 3,
  "operations": ["chats.list"],
  "codes": [],
  "trace_id": "…",
  "via": "cli",
  "agent": {
    "kind": "claude-code",
    "session_id": "…",
    "client": { "name": "claude-ai", "version": "1.2", "id": "h:3f9a1c2e" }
  },
  "mcp": { "connection_id": "…" }
}
```

Required: `run_id`, `started_at`, `status`. The rest is optional.

| Field | Rules |
| --- | --- |
| `command` | without the tool's name, except when no command was recognised: then the bare name |
| `argv` | the words as the tool kept them, already masked |
| `via` | `cli`, `desktop` (`WIRECAT_CALLER=desktop`), `mcp-stdio` or `mcp-http` |
| `agent.kind` | `claude-code`, `codex`, `gemini-cli`, `cursor`, `opencode`, `hermes-agent`, `openclaw`, `mcp-client` |
| `agent.client` | the MCP app as it named itself; `id` is a hash of its login, never the login |
| `error` | `{ class, code, message, operation, http: { method, endpoint_template, status }, provider: { key, code }, causes: [{ class, message }], stack: [] }` |

The app groups runs into conversations by the first of these that exists: `agent.kind` with `agent.session_id`, then
`mcp.connection_id`, then `trace_id`. Runs with none of them but with `via` or `agent.client.id` are grouped by agent
kind, client and `via`, and cut where 30 minutes pass with no run.

## An event

| `event` | Read |
| --- | --- |
| `provider.request`, `provider.response` | `operation`, else `method` and `endpoint_template`; `level` (`operation` or `wire`), `transport` (`http`, `mtproto`, `max-ws`, `wa-engine`), `attempt` (2 and up is a retry), `wait_ms` (a flood wait or `Retry-After` before this attempt), `counts` (`{ "messages": 3 }`) |
| `events.dropped` | `dropped`: how many events the tool counted but did not keep |

Any other event is shown by its name. Events carry no bodies, no URLs as sent and no query strings.
