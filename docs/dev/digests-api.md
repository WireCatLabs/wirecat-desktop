# Digests API

The contract between the Digests page (the client: `src-tauri/src/digest_book.rs`) and memo's `digest` commands
(`WireCatLabs/cli-memo`). Change it here first, then on both sides.

The past days, the brief and the templates have their own commands: see `digests.rs`, `digest_schedule.rs` and
`digest_editors.rs` in [ARCHITECTURE.md](ARCHITECTURE.md).

## Principles

- **Digests by name.** memo keeps any number of digests, each keyed by a name. `morning-digest` is the first one.
- **The owner decides.** Every write passes `--from-app`. Every command passes `--json`.
- **Checked before memo runs.** Desktop checks every value below and refuses a bad one itself.
- **An option value goes as `--opt=value`,** so a title or brief that starts with a dash stays a value.
- **An older memo still works.** A memo without `digest list` has one digest, `morning-digest`, kept as a schedule.
  Desktop then uses `schedule list|agent|remove|run` (`digest_schedule.rs`) and refuses what that memo cannot do: a
  second digest, several times, weekdays, sources, and a run that is not sent.

## Commands

| Command | Use |
| --- | --- |
| `memo digest list --json` | The table. Asked at the same time as `memo schedule list --json` |
| `memo digest add <name> <options> [--text=<brief>] [--paused] --from-app --json` | Create |
| `memo digest edit <name> <options> --from-app --json` | Save settings |
| `memo digest run <name> [--no-notify \| --deliver-to=<route> …] --from-app --json` | Get now |
| `memo digest pause <name> --from-app --json` | Take off its schedule, settings kept |
| `memo digest resume <name> --from-app --json` | Put back on its schedule |
| `memo digest remove <name> --from-app --json` | Remove the digest and its schedule; past runs stay |

`<options>`:

- `--title=<title>`
- `--at=<HH:MM>` once per time, or `--at=<days> <HH:MM>` with days such as `mon,fri`.
- `--source=<source>` once per source, or `--source=all` for every source.
- `--deliver-to=<route>` once per route, or `--deliver-to=none` for none.
- `--model=<model>` (an empty value is the agent's own default).
- `--max-cost=<usd>` and `--max-cost-per-day=<usd>`, left out when the agent named does not report its cost.
- `--agent <id>`, and `--allow-dangerous` when the agent is one memo cannot limit and the owner gave consent on
  this digest.

An edit keeps what an option leaves out. So an empty list is sent as `--source=all` or `--deliver-to=none`. The brief
(`--text`) and `--paused` go on `add` only: an open digest's brief is saved by `digest brief edit`.

Without a flag, `digest run` sends to every route, as the timer does. `--no-notify` keeps it in the app.
`--deliver-to` sends only to the routes named.

## Values

| Value | Rule |
| --- | --- |
| Name | 1–40 characters: lower-case letters, digits and `-`, starting with a letter or digit |
| Title | 1–80 characters on one line |
| Times | 1–6 `HH:MM` times, sorted, each once |
| Weekdays | `mon` `tue` `wed` `thu` `fri` `sat` `sun`; none is every day |
| Sources | `telegram` `max` `whatsapp` `mail` `meetings` `tasks` `drive` `calendar` `crm`; none is every source |
| Routes | At most 4: `telegram-bot:<profile>/<chat id>` (digits, may start with `-` or `user:`) or `email:<profile>/<address>` |
| Brief | At most 4000 characters |
| Cost caps | A run: 0.01–50 USD. A day: 0 (no cap) or 0.01–50 USD. Rounded to cents |

## `digest list`

```json
{
  "items": [
    {
      "name": "morning-digest",
      "title": "Morning digest",
      "times": ["08:30", "18:00"],
      "weekdays": [],
      "sources": [],
      "routes": ["telegram-bot:personal/12345"],
      "brief": "…",
      "scheduled": true,
      "harness": "claude",
      "model": null,
      "max_cost_usd": 0.5,
      "max_cost_per_day_usd": 2,
      "spent_today_usd": 0.31,
      "last": { "at": "2026-11-12T07:30:00Z", "ok": true, "cost_usd": 0.29 },
      "next_at": "2026-11-12T17:00:00Z",
      "needs": null
    }
  ]
}
```

- An item whose `name` breaks the name rule is dropped. Times, weekdays and routes that break their rules are dropped.
- `harness` is the agent that writes it. `needs` says why its timer will not start it, with memo's command that fixes
  it.
- When `spent_today_usd` or `harness` is missing, Desktop takes it from the schedule of the same name in
  `schedule list`.
- `last.output` is not read: the page reads the day itself.

## Refusals and older copies

- `"unknown command '<verb>'"` in `error.message`: this memo has no `digest <verb>`. Desktop falls back to the
  schedule, or says it needs a newer memo.
- `"unknown option '--agent'"`: a memo from before `--agent`. A request for `claude` is sent again without
  `--agent`; any other agent needs an update.
- `digest.agent-unchosen`, `agent.cost-unknown` and `agent.unrestricted`: the window words these itself. Any other
  refusal is shown in memo's words.

## Versions

From `digests` on memo's entry in `catalog/tools.json`:

- `minVersion`: the version an older memo is told to update to. Desktop learns whether memo has digests by name
  from the answer to `digest list`, not from this number.
- `agent.minVersion`: `--model`.
- `moreSources.minVersion`: `drive`, `calendar` and `crm` as sources.
- `agentConsent.minVersion`: `--allow-dangerous`.

`brief`, `templates` (key `report/<name>`) and `backfill` take the digest's name as an optional argument. Desktop
passes it only for a digest other than `morning-digest`, so an older memo is asked exactly as before.
