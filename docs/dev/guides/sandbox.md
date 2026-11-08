# Run the app in a sandbox

`bin/sandbox` starts the real app (the debug build) in a named sandbox, with data you choose. Your own tools,
settings, store, sign-ins and agents are not read and not changed. Use it to test a change by hand, to reproduce a
report, or to hand the owner a test run. Linux only.

```sh
pnpm tauri build --debug --no-bundle         # once per code change; check free -g and df -h ~ first
bin/sandbox demo --seed demo                 # tools, profiles and synthetic data
bin/sandbox fresh                            # a computer that has never seen WireCat (bin/try-fresh-install)
bin/sandbox demo --exec memo people list     # run any command inside the sandbox, no window
bin/sandbox --list                           # the sandboxes and their presets
bin/sandbox-check                            # proves that a sandbox keeps away from your own setup
```

The script runs the binary of the tree it sits in (`src-tauri/target/debug/wirecat-desktop`), so a worktree's script
runs that worktree's build. Hand the owner the absolute path, e.g.
`~/Projects/AI/wirecat-desktop/bin/sandbox demo --seed demo`.

## Presets

A sandbox is seeded once, on its first start. `--reset` empties it first; a different preset needs `--reset`.

| `--seed` | What the sandbox holds |
| --- | --- |
| `fresh` (default) | Nothing: no Node.js, no tools. The first-run setup, as a new user sees it. |
| `tools` | Node.js from nodejs.org (checksum checked) where WireCat keeps its own, every catalog tool installed from npm, and profiles `personal` and `work` made with each tool's `config set` (Telegram, MAX, WhatsApp, Email, Google Calendar), so Settings and the tool pages list them. Nobody is signed in. Drive makes a profile only at sign-in. |
| `demo` | `tools`, plus synthetic data through memo's own commands: two people, the project Harbour with three tasks, three notes in `~/Notes`. Every name is made up. |

No preset seeds messages: no tool takes messages from a file yet, and the store is never written with SQL from here.

`--from-store <path>` copies a store you name into the sandbox, for a bug that needs real data. It is a copy made with
SQLite's backup (the source is opened read-only and may stay open in a sync), never a link. It goes with `fresh` or
`tools`; `demo` makes a store of its own. The copy is your private data on disk under `~/.cache/wirecat-sandbox/<name>`: `--reset` deletes it.

```sh
bin/sandbox bug-123 --seed tools --from-store ~/.local/share/WireCat/wirecat.db
```

## What is separate, and what is shared

Everything lives in `${XDG_CACHE_HOME:-~/.cache}/wirecat-sandbox/<name>/`.

| Separate | Shared with your account |
| --- | --- |
| `HOME` and every `XDG_*_HOME` under `<name>/home`: app data, tool settings, credentials files, shell files | the Linux user, the network, the npm registry |
| `MESSAGING_STORE`: `<name>/home/.local/share/WireCat/wirecat.db` | the display |
| `PATH`: `<name>/bin`, `/usr/local/bin:/usr/bin:/bin`, and the sandbox's own Node.js for `tools` and `demo`; no nvm, no `~/.local/bin` | your browser and your terminal (below) |
| npm's global folder: inside the sandbox's Node.js (`bin/sandbox-check` checks it) | |
| keyring: off (`DBUS_SESSION_BUS_ADDRESS=disabled:`); tools say so and save sign-ins to a file in the sandbox | |

So agents (Claude Code, Codex) are not found, and the Agents pages show their "no agent" paths.

## Links and terminals

The app runs without a session bus, so it cannot reach your desktop by itself. Two wrappers in `<name>/bin`, written
on each start, hand the job to your own session:

- `xdg-open` (first on PATH) opens a link or folder with your real home and session bus: your default browser, with
  your profile. Without it, the sandbox sees only the browsers in `/usr/share/applications` (not snap or flatpak ones)
  and starts one in the empty home.
- `terminal` is `$TERMINAL`. The window is your default terminal (`xdg-terminal-exec`, the freedesktop launcher GNOME
  points to), with your profile. The command inside runs with the sandbox's environment: sandbox home, sandbox PATH,
  no keyring, and your login shell from `/etc/passwd`.

The shell in that window reads the sandbox's `~/.zshrc` or `~/.bashrc`, not yours: the app writes its PATH lines
there, and that is part of what a fresh-install test checks. So the prompt looks plain.

The wrappers are a convenience, not a security boundary: anything in the sandbox could call them.

## Checking it

`bin/sandbox-check` seeds a throwaway sandbox (`--seed tools|demo`), then fails if any path a tool's `doctor --json`
reports, npm's global folder or the store is outside it, if the keyring answers inside it, or if your own tool
settings, `~/.local/share/dev.wirecat.desktop`, your npm tools or your agents' skill folders changed. `--app` also
starts the build for 15 seconds and checks the app's own environment. It reads names, sizes and times only, never a
secret or the store. It cannot see a change your own background syncs make to the store, so the store is left out.

## What the sandbox cannot show

macOS and Windows (the install-check CI workflow covers them), and screens that need a state no preset makes: use the
browser build's scenarios for those (`pnpm dev`, the list in `CLAUDE.md`). `?open=fail` there shows the dialog for a
link the system cannot open.
