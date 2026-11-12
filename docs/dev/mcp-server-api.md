# MCP server API

The contract between WireCat Desktop (the client: `src-tauri/src/mcp_server.rs`, with `tailscale.rs` and
`cloudflare.rs` for the public address) and each tool's HTTP MCP server (the CLI: cli-core
`src/cli/mcp-server-command.ts` and `src/cli/messenger/mcp-command.ts`, also used by drive and memo). Change it here
first, then on both sides.

## Principles

- **The tool runs its own server.** The app runs only the words in the catalog's `mcpServer` block. It never starts
  `mcp --http` itself and never kills a process it did not identify.
- **One server per tool, every profile.** Each call names its profile. There is no switch to serve fewer profiles.
- **One public address for all tools.** Each tool takes its own path on one hostname. No WireCat process routes
  between tools.
- **No secret over MCP.** Sign-in happens in the app or in a terminal ([Sign-in API](signin-api.md)), never through
  an MCP call.
- **The login code, the address and the apps' names leave Rust as they are.** The owner needs them. They are never
  logged and never put in a report.

## Commands

From the catalog's `mcpServer` block, for example tg:

| Key | Words |
| --- | --- |
| `port` | `8765` (each tool has its own) |
| `start` | `mcp server start --port {port} --public-url {url} --profiles all --json` |
| `stop` | `mcp server stop --profiles all --json` |
| `status` | `mcp server status --profiles all --no-record --json` |
| `revoke` | `mcp revoke --profiles all --json` |
| `config` | `mcp config --profiles all --no-record --json` (tg, max, wa only) |

- `{port}` is 1024 or above.
- `{url}` is `https://<host>[:<port>]` or `http://localhost` / `http://127.0.0.1`, with at most one plain path segment
  (`https://name.ts.net/tg`). No login, no query.
- A tool that refuses `--profiles` (`unknown option '--profiles'`) gets the same call again without it.
- A tool that answers `unknown command 'revoke'` gets `mcp --revoke --json` instead.
- A tool that answers `unknown command`, `unknown option`, `too many arguments`, `name a profile` or
  `no profiles here yet` to `mcp server` is too old; the app says the server arrives with its next update.

## `status`

The answer may be bare or wrapped in `item`.

```json
{
  "item": {
    "running": true,
    "listening": true,
    "by": "server",
    "started_at": "2026-11-12T09:00:00.000Z",
    "port": 8765,
    "connector_url": "https://name.ts.net/tg/mcp",
    "login_code": { "code": "AB12-CD34", "expires_at": "2026-11-12T09:10:00.000Z" },
    "outdated": false,
    "clients": [
      {
        "claimed_name": "claude-ai",
        "last_login_at": "2026-11-12T09:01:00.000Z",
        "last_request_at": "2026-11-12T09:05:00.000Z",
        "last_tool": "tg_read",
        "last_tool_at": "2026-11-12T09:05:00.000Z",
        "tool_calls_today": 3
      }
    ]
  }
}
```

| Field | Rules |
| --- | --- |
| `running` | required. Without it the app treats the tool as too old |
| `by` | `"server"` when `mcp server start` started it. Anything else was started by hand, and `stop` leaves it |
| `port`, `started_at`, `connector_url`, `login_code` | read only while `running` |
| `connector_url` | the address the browser app adds; without its `/mcp` end it must pass the `{url}` rule above |
| `login_code.code` | 9 characters, `XXXX-XXXX`, capital letters and digits. Any other shape is ignored |
| `clients[]` | an entry without `last_login_at` is dropped. `claimed_name` is any name the app gave itself: the app removes control and bidirectional characters and keeps 100 characters. `last_tool` must be 1–64 of `A-Za-z0-9_.-` |

Text fields are at most 300 characters with no control characters; times at most 40.

## `config`

`{ "item": { "config": { "mcpServers": { … } } } }`. The app copies the `config` object as pretty JSON for desktop
apps. It holds full paths and no credentials.

## Login settings

The app reads `http://127.0.0.1:<port>/.well-known/oauth-authorization-server` from the running server, not through
the tunnel. It keeps `issuer`, `authorization_endpoint`, `token_endpoint` and `registration_endpoint` only when each
is on the origin of `connector_url`.

## The public address

One hostname (`<name>.ts.net` for Tailscale Funnel, a name on the owner's domain for Cloudflare). Each tool takes three
paths, sent to its own local port with the path kept:

```text
/<tool>                                       -> http://127.0.0.1:<port>/<tool>
/.well-known/oauth-authorization-server/<tool> -> http://127.0.0.1:<port>/.well-known/oauth-authorization-server/<tool>
/.well-known/oauth-protected-resource/<tool>   -> http://127.0.0.1:<port>/.well-known/oauth-protected-resource/<tool>
anything else                                  -> 404
```

`<tool>` is the catalog `id`. The two `.well-known` paths are where RFC 8414 and RFC 9728 put the login settings of
an issuer under a path. The server is started with `--public-url https://<host>/<tool>`, and `connector_url` is that
address plus `/mcp`.

- **Tailscale:** `tailscale funnel --bg --https=<public port> --set-path <path> http://127.0.0.1:<port><path>`, one
  call per path. Turning off removes those paths only, never a whole port, and never `funnel reset`.
- **Cloudflare:** each path is an ingress rule, matched as a regular expression (`^/<tool>(/|$)`), with a last
  catch-all rule `http_status:404`.
- **Responses stream as server-sent events.** Do not switch the server to plain JSON responses: through a Cloudflare
  tunnel a call that sends no response headers for 125 seconds ends with error 524.
