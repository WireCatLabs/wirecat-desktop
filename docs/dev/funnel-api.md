# Funnel helper API

<!-- cspell:ignore tsnet -->

The contract between WireCat Desktop (the client, `src-tauri/src/funnel_helper.rs`) and `wirecat-funnel` (the helper,
`WireCatLabs/funnel-cli`, npm `@wirecat/funnel`). The helper is a tsnet program: it joins the owner's tailnet as its
own device and serves Tailscale Funnel with no Tailscale app and no administrator password. Change it here first,
then on both sides.

## Principles

- **Fixed commands only.** Desktop runs the five commands below and nothing else. Paths and ports are checked
  before they go on the command line.
- **One JSON object per command.** With `--json` the helper prints one object on stdout. A failed command prints
  `{"error": "<plain words>"}` with no `state`, and Desktop reads it as a failure whatever the exit code.
- **The helper owns its state.** Its node keys, certificates, routes and logs stay in its own folder. Desktop never
  reads them. Tailscale's log upload is off in the helper.
- **Desktop owns its record.** The helper reports no address while it is stopped, so Desktop keeps its own record of
  what it added.

## The catalog entry

`funnel` in `catalog/tools.json`: package `@wirecat/funnel`, bin `wirecat-funnel`, repo
`https://github.com/WireCatLabs/funnel-cli`, `storage` `{ "app": "wirecat-funnel", "env": "WIRECAT_FUNNEL" }`, and
`"helper": true`. A helper installs, updates and passes the provenance check like any tool, but no page lists it.

## Commands

| Command | What Desktop expects |
| --- | --- |
| `wirecat-funnel start --json` | Starts the background process if none runs. Returns once the state is `running` or needs the owner |
| `wirecat-funnel status --json` | The status. Never starts anything |
| `wirecat-funnel stop --json` | Stops the background process and returns the status |
| `wirecat-funnel route add <path> <port> --json` | Sends `https://<node><path>…` to `http://127.0.0.1:<port><path>…`. Returns the status |
| `wirecat-funnel route remove <path> --json` | Removes one route. Returns the status |

Desktop gives each call 40 s.

## Status

```json
{
  "state": "running",
  "pid": 41231,
  "url": "https://wirecat.tail1234.ts.net",
  "action_url": null,
  "error": null,
  "routes": [{ "path": "/tg", "port": 8765 }],
  "dir": "/home/me/.local/share/wirecat-funnel",
  "version": "0.1.1"
}
```

Every key is always present, `null` when empty. Desktop reads `state`, `url`, `action_url`, `error` and `routes`.

| `state` | Meaning | What Desktop does |
| --- | --- | --- |
| `stopped` | No process | During a start: fails with "stopped. Try again." |
| `starting` | The process runs; Tailscale is not up yet | Waits |
| `needs-login` | The owner signs in to Tailscale at `action_url` | Opens the link once, then waits |
| `needs-approval` | A tailnet admin approves the device at `action_url` | The same |
| `needs-funnel` | The node may not use Funnel; `action_url` turns it on | The same |
| `running` | Funnel is on; `url` is the public address | Adds the routes |
| `error` | `error` says why, in plain words | Shows the text |

- `url` is used only when it starts with `https://`.
- `action_url` is used only when its host is `login.tailscale.com` or `console.tailscale.com`. Anything else is
  dropped.
- An answer with `error` and no `state` is a failed command. Any other answer that is not this shape is "an answer
  the app cannot read".

## Starting

Desktop runs `start`, then `status` every 2 s until the state is `running`, `error` or `stopped`. It opens each new
`action_url` once. It gives up after 10 minutes without `running`.

## Routes

Each tool takes the three paths of [the public address](mcp-server-api.md#the-public-address), the same ones
`tailscale.rs` mounts (`mounts`), all to the tool's local MCP port. Desktop adds them only while the state is
`running`. If one `route add` fails, Desktop removes all three. The tool's public address for `mcp server start` is
`<url>/<tool>`.

On Stop, Desktop removes the tool's three paths. When the last `route remove` answers with no routes left, Desktop
runs `stop`. Quitting Desktop leaves the helper running.

A tool's funnel counts as live while the state is `running` and `routes` holds all three of its paths on its port.

## Desktop's record

`wirecat-funnel-routes.json` in the app's data folder: one entry per tool Desktop put on the helper.

```json
[{ "tool": "tg", "url": "https://wirecat.tail1234.ts.net/tg", "port": 8765 }]
```

Adding a tool replaces its entry. Stopping keeps it, so the next start shows the same address. These funnels join
the system Tailscale's in `tailscale_funnels`, marked `via: "wirecat"`.
