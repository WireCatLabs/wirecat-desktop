# Funnel helper: a public address with no administrator password

TASK-89 (journal `docs/journal/2026-11-03-funnel-helper.md`). Built on the research
`docs/dev/research/2026-10-27-tailscale-without-password.md` and phase 3 of `docs/dev/plans/2026-10-27-one-mcp-entry.md`.

Owner's answers (2026-11-03):

- **NEED-73 = A.** A helper on Tailscale's Go library `tsnet`: one binary, its own node, state and logs in a WireCat
  folder, no system daemon.
- **NEED-75 = A.** Its own npm package with prebuilt binaries per platform; Desktop installs it from the catalog.
- **NEED-76 = A.** Tailscale's log upload is off, and the site's terms and privacy pages and Desktop say so.
- **NEED-74 = A.** One login with an ephemeral test node, run by the owner (section 8).

Decisions I made myself are marked **(mine)**.

## 1. Package and repository

- Repository `WireCatLabs/funnel-cli`, private while it is built **(mine)**. It must be public before the first release,
  because npm provenance, which Desktop's `provenance.rs` checks, I think refuses a private source repository.
- npm package `@wirecat/funnel` (free on npm, `npm view` gave E404 on 2026-11-03), bin `wirecat-funnel` **(mine)**: a
  bare `funnel` is too generic a command name.
- Go, `tailscale.com` v1.104.5 (latest, 2026-11-02), Go 1.27.3 as its `go.mod` asks. Nothing else beyond the standard
  library.
- The main package is a small Node launcher, `bin/wirecat-funnel.js`. It finds `@wirecat/funnel-<os>-<arch>` with
  `require.resolve` and runs its binary with the same arguments, stdio inherited, exit code passed on. Six platform
  packages (`darwin|linux|win32` × `x64|arm64`) are `optionalDependencies`, each with `os` and `cpu`, so npm installs
  only the matching one. This is whatsapp-cli's engine pattern (`scripts/engine-packages.mjs`), copied, not invented.
- Licence: Apache-2.0 for our code **(mine)**, and a `THIRD_PARTY_NOTICES` with Tailscale's BSD-3-Clause and every
  linked module, generated and checked in CI like wa's.

## 2. Commands

Every command prints one JSON object with `--json`, and a short human line without it.

| Command | What it does |
| --- | --- |
| `wirecat-funnel start [--hostname <name>]` | starts the background process if none runs, waits up to 20 s until it is `running` or needs the owner, prints the status |
| `wirecat-funnel stop` | asks the background process to stop through its control endpoint, waits until it has, prints the status |
| `wirecat-funnel status` | prints the status; never starts anything |
| `wirecat-funnel route add <path> <port>` | sends `https://<node><path>…` to `http://127.0.0.1:<port><path>…`; prints the routes |
| `wirecat-funnel route remove <path>` | removes one route; prints the routes |
| `wirecat-funnel route list` | prints the routes |
| `wirecat-funnel run [--hostname <name>] [--ephemeral]` | the process itself, in the foreground: what `start` launches, and what a terminal user or a `systemd --user` unit runs |
| `wirecat-funnel --version` | the version |

No `logout` in the first version **(mine)**: Desktop does not need it yet, and the node can be removed in Tailscale's
admin console. It is a small addition when Desktop gets a "Sign out" button.

### Status

```json
{
  "state": "running",
  "pid": 41231,
  "url": "https://wirecat.tail1234.ts.net",
  "action_url": null,
  "error": null,
  "routes": [{ "path": "/tg", "port": 8765 }],
  "dir": "/home/me/.local/share/wirecat-funnel",
  "version": "0.1.0"
}
```

`state` is one of:

| State | Meaning | What Desktop shows |
| --- | --- | --- |
| `stopped` | no process | Start |
| `starting` | the process runs, Tailscale is not up yet | progress |
| `needs-login` | open `action_url` and sign in to Tailscale | the link, opened once in the browser |
| `needs-approval` | the tailnet's device approval is on: an admin approves the node at `action_url` | the link |
| `needs-funnel` | the node may not use Funnel; `action_url` turns it on (Tailscale's own `QueryFeature("funnel")`) | the link |
| `running` | Funnel is on; `url` is the public address | the address |
| `error` | `error` says why, in plain words | the text |

All keys are always present, `null` when empty **(mine)**: one valibot schema in Desktop, no optional fields. One
`action_url` rather than one field per kind of link **(mine)**: `state` already says what the page is for. A failed
command prints `{"error": "…"}` and exits 1. The node key and anything else in Tailscale's state never appear in the
status or the logs.

**Control endpoint (mine).** The running process answers `GET /status` and `POST /stop` on `127.0.0.1:<random>`,
behind a random token; port, token and PID are in `control.json` (mode 600). `status` and `stop` talk to it, so no
command sends a signal to a PID that may by now be another program, and `stop` is a clean stop on Windows too.
`status` with no answer is `stopped`.

### The login link

`run` starts tsnet with no auth key. tsnet asks the control server for a login and the link appears in the backend's
status (`AuthURL`). The process reads it every second while the state is `NeedsLogin` and publishes it as `action_url`.
`start` returns as soon as the state is `needs-login`, so Desktop gets the link at once and polls `status` every 2 s
until `running`. Once logged in, the node stays logged in across restarts (state on disk) until its key expires
(180 days by default, research section 5).

### The public address

When the node is `Running`, the process calls `ListenFunnel("tcp", ":443")`. The address is
`https://<CertDomains[0]>` with no port **(mine: always 443)**: the helper's node is its own device, so 443 is free
even when the system Tailscale uses it (research section 4). No HTTPS in the tailnet → `error` with Tailscale's
"enable HTTPS" link. No `funnel` attribute → `needs-funnel`; the process retries every 5 s, so approving it in the
browser is enough.

The listener also answers inside the tailnet (tsnet's default, not `FunnelOnly`) **(mine)**: on a computer that also
runs Tailscale, MagicDNS sends Desktop's own address check over the tailnet, and it must still reach the server.

### Routes

- Kept in `routes.json` in the state folder, written by `route add|remove`. The process re-reads it when its
  modification time changes, on the next request. No restart, no file watcher.
- A path starts with `/`, has no `..`, `?` or `#`. A port is 1–65535. The target is always `127.0.0.1`; there is no
  way to name another host.
- A request goes to the longest route that equals its path or is a prefix of it followed by `/`. No match → 404.
- The proxy behaves like `tailscale serve` (`ipn/ipnlocal/serve.go` at v1.104.5): the full path is kept, `Host` stays
  the public one (cli-core's server checks it, `cli-core/src/mcp/http/serve.ts:129`), it sets `X-Forwarded-Host`,
  `X-Forwarded-Proto: https` and `X-Forwarded-For`, and it removes any incoming `Tailscale-*` header. Event streams
  (`text/event-stream`) are flushed as they come.
- Desktop adds the three paths per tool it adds today with `tailscale funnel --set-path` (`tailscale.rs`, `mounts`):
  `/tg`, `/.well-known/oauth-authorization-server/tg`, `/.well-known/oauth-protected-resource/tg`.

## 3. Where its state lives

cli-base's layout (`cli-base/src/paths.ts`), for app name `wirecat-funnel`:

- Linux and macOS: `$XDG_DATA_HOME/wirecat-funnel`, else `~/.local/share/wirecat-funnel`.
- Windows: `%LOCALAPPDATA%\wirecat-funnel\Data`.
- `WIRECAT_FUNNEL_STATE_DIR` overrides it.

Folder mode 700. Inside: `tailscaled.state` (the node's keys: a secret, mode 600, written by tsnet), certificates,
`routes.json`, `control.json`, `run.log` (what `start`'s background process printed), and Tailscale's own `tailscaled.log.conf` and `tailscaled.log*.txt` (section 4).
Nothing outside this folder. The catalog's `storage` entry names the folder and prefix, so `storage.rs` lists it and
deletes it only after the helper is uninstalled, unchanged.

The node key stays in a file, not the system keyring **(mine)**: Tailscale itself keeps it in a file of mode 600, and
tsnet's file store is the tested path.

## 4. Logging off

Verified by reading v1.104.5:

- tsnet's `startLogger` (`tsnet/tsnet.go:1100-1137`) always creates the uploader; it never reads
  `TS_NO_LOGS_NO_SUPPORT` itself.
- The uploader's HTTP transport comes from `logpolicy.NewLogtailTransport`, which returns a transport that sends
  nothing when `envknob.NoLogsNoSupport()` is true (`logpolicy/logpolicy.go:894-897`).
- `logtail.Disable()` (`logtail/logtail.go:736`) drops every entry before it is buffered or sent (`:768`).

So the helper, first thing in `main`, calls `envknob.SetNoLogsNoSupport()` and `logtail.Disable()` **(mine: both)**.
There is no flag to turn upload back on. The knob also tells the control server that this node opted out
(`hostinfo/hostinfo.go:67`, `NoLogsNoSupport`) and turns off network flow logs (`feature/netlog/netlog.go:76`).

What stays:

- tsnet still writes `tailscaled.log.conf` (a random private log id) and empty buffer files in the state folder. They
  never leave the computer.
- A tailnet that requires flow logs refuses such a node (`ipn/ipnlocal/local.go:2063`): the process reports `error`
  with "This tailnet requires Tailscale logging, which WireCat keeps off."
- `go test` cannot verify any of this: tsnet skips the logger under `testenv.InTest()`. The check runs on the built
  binary (section 9).

## 5. How Desktop calls it

Desktop work is a later PR; this is its shape.

- **Catalog.** An entry `funnel`, package `@wirecat/funnel`, bin `wirecat-funnel`, `repo`
  `https://github.com/WireCatLabs/funnel-cli`, `storage` `{ folder: "wirecat-funnel", prefix: "WIRECAT_FUNNEL" }`, and
  a flag that keeps it off the Tools grid. It installs and updates like any tool, with the same provenance check.
- **Rust.** `funnel.rs`, fixed commands only (rule 2): `start --json`, `status --json`, `stop --json`,
  `route add <path> <port> --json` and `route remove <path> --json`. Paths come from `tailscale.rs`'s `mounts(tool)`, the
  port from `mcp_server::validate_port`. The answer is parsed with one schema.
- **The guide.** At the Tailscale step: "No Tailscale on this computer? WireCat can join your tailnet by itself, no
  password." Install, then `start`. `needs-login`: open `action_url` once and show "Signing in to Tailscale…", polling
  `status`. `needs-funnel` and `needs-approval`: the same with `action_url`. `running`: add the routes, then
  `mcp server start --public-url <url>/<tool>`, as with the system Tailscale.
- **Stopping.** The MCP server's Stop removes its three routes. When no route is left, Desktop runs `stop`. Desktop
  quitting leaves the helper running, like the MCP servers it started.
- **Hostname.** Default `wirecat` **(mine)**. The certificate puts the full name in public Certificate Transparency
  logs ([Tailscale: HTTPS](https://tailscale.com/kb/1153/enabling-https): "the machine names are still published in
  the public ledger"), so the default carries neither the computer's nor the owner's name. A second computer gets
  `wirecat-1` from Tailscale.
- **Stop on Windows.** Windows has no signal to ask a process to finish, so `stop` goes through the control endpoint
  on every system. A process killed anyway leaves Funnel's flag in the state, but nothing listens, and tsnet's `Up`
  clears the serve settings on the next start.

## 6. Release pipeline

The shape of whatsapp-cli's engine release, no Node build in between:

- **PR / main CI** (`ci.yml`): `gofmt`, `go vet`, `go test`; cross-build all six targets with `CGO_ENABLED=0`,
  `-trimpath`; `THIRD_PARTY_NOTICES` check; launcher test with Node; `npm pack --dry-run` of each package.
- **Release** (`release.yml`, `workflow_dispatch` only, environment `npm`, `id-token: write`): build the six
  packages, pack, publish the six platform packages, then `@wirecat/funnel`, each `--provenance --access public`,
  then tag `v<version>`. Desktop's `provenance.rs` then sees every package built by `funnel-cli`'s `release.yml`.
- Nothing is released in this task.
- Each Tailscale security release means a helper release **(risk, research section 5)**. A monthly job that opens a
  PR bumping `tailscale.com` is a later addition.

## 7. Privacy texts

The owner: "also mention this in site terms, privacy, and wherever needed (including privacy in desktop)". One
short statement, same facts everywhere, in en, ru and es:

- Funnel makes the MCP server on this computer reachable from the internet through Tailscale's network, only while
  the owner keeps it on.
- WireCat turns off Tailscale's own log upload and support data.
- Tailscale still sees: the node in the owner's tailnet (its name, OS, versions), connection metadata (addresses,
  times, sizes). The content is encrypted end to end, and TLS ends on the owner's computer
  ([Tailscale: Funnel](https://tailscale.com/kb/1223/funnel): relays "do not decrypt the traffic").
- The address appears in public certificate logs.

Where: cli-docs `privacy` and `terms` pages, and Desktop's own privacy text. Two draft PRs, not merged until the
helper ships.

## 8. NEED-74: the live check

`bin/live-check` in funnel-cli. The owner runs it once:

1. Builds the binary for this computer.
2. Starts a dummy MCP endpoint on `127.0.0.1:<random>` (answers `initialize`).
3. Starts the helper with `--ephemeral`: in-memory state, `Ephemeral: true`, logging off, a temporary folder for
   certificates, hostname `wirecat-check`, listener `FunnelOnly`, so a success can only come through Funnel.
4. Prints the login link; the owner signs in in the browser. The script never signs in.
5. Waits for `running`, then calls `https://<name>/mcp` at an address from public DNS (`dig @1.1.1.1`, then
   `curl --resolve`), so the request does not take the tailnet path of the system Tailscale. Retries up to 10 min
   while public DNS catches up. (DNS over HTTPS to 1.1.1.1 was refused on this machine; plain DNS answered.)
   It also counts the helper's lookups of `log.tailscale.com` while logged in, which should be 0.
6. Prints pass or fail, stops the helper by its PID, removes its temporary folder. The ephemeral node is removed by
   Tailscale 30–60 min later ([kb/1111](https://tailscale.com/kb/1111/ephemeral-nodes)); on failure the script says
   where to remove it by hand.

Unknown until it runs: whether a tsnet `Ephemeral` node accepts an interactive login (research section 3).

## 9. What gets checked here, without a login

- Unit tests: route matching, path checks, the proxy's headers and path, an event stream through the proxy, status
  JSON, state folder resolution.
- The built binary to `needs-login` with a scratch folder, no login: the status JSON, the link present, the files in
  the folder, and that no connection goes to `log.tailscale.com` (DNS lookups traced with `GODEBUG=netdns=go+2`).
  Never run without the log switch: that would upload real logs.
- Binary size for linux-x64 (result to cli-testing).

## Risks

- **RISK-96 · A tsnet ephemeral node may not take an interactive login.** Then the live check needs an ephemeral
  auth key, which the owner makes in the admin console, and the script takes it from a file of mode 600.
- Key expiry after 180 days and Tailscale updates (research section 5) stay as they are.

## Built (2026-11-05)

Repository https://github.com/WireCatLabs/funnel-cli (private), PR #1. The owner's check:
`/home/leemour/Projects/AI/funnel-cli/bin/live-check`. Measured on this Linux machine, no login: the binary reaches
`needs-login` in 1.3 s, the only name it looks up in 30 s is `controlplane.tailscale.com`, its log buffers stay at 0
bytes; linux-x64 binary 22.4 MB (8.9 MB packed).
