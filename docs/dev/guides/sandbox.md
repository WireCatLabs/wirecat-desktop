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

A sandboxed window says so: `bin/sandbox` sets `WIRECAT_SANDBOX=<name>`, so the window title reads
"WireCat — sandbox <name>", a banner that cannot be hidden sits across the top of every page, and every sign-in (in
the window or in a terminal) first warns that it brings a real account's messages into the copy, with Cancel
focused. The browser build shows the same with `?sandbox=<name>`.

The script runs the binary of the tree it sits in (`src-tauri/target/debug/wirecat-desktop`), so a worktree's script
runs that worktree's build. Hand the owner the absolute path, e.g.
`~/Projects/AI/wirecat-desktop/bin/sandbox demo --seed demo`.

## Presets

A sandbox is seeded on its first start. `--reset` empties it first. A different preset needs `--reset`, except that
`--seed demo` may be added to a `tools` sandbox.

| `--seed` | What the sandbox holds |
| --- | --- |
| `fresh` (default) | Nothing: no Node.js, no tools. The first-run setup, as a new user sees it. |
| `tools` | Node.js from nodejs.org (checksum checked) where WireCat keeps its own, every catalog tool installed from npm, and profiles `personal` and `work` made with each tool's `config set` (Telegram, MAX, WhatsApp, Email, Google Calendar), so Settings and the tool pages list them. Nobody is signed in. Drive makes a profile only at sign-in. |
| `demo` | `tools`, plus the seed set below. |

`--from-store <path>` copies a store you name into the sandbox, for a bug that needs real data. It is a copy made with
SQLite's backup (the source is opened read-only and may stay open in a sync), never a link. It goes with `fresh` or
`tools`; `demo` makes a store of its own. The copy is your private data on disk under `~/.cache/wirecat-sandbox/<name>`: `--reset` deletes it.

```sh
bin/sandbox bug-123 --seed tools --from-store ~/.local/share/WireCat/wirecat.db
```

## The demo seed set

The data lives in `scripts/sandbox-seed/data/`, one JSON file per subject; `scripts/sandbox-seed/load.mjs` loads it
inside the sandbox through the tools' own commands, one step per file in `scripts/sandbox-seed/steps/`. Every name,
address and number is made up: addresses are on `example.org` and `.test`, phones in the UK's drama range
`+44 7700 900xxx`.

| Page | What the seed set gives it | Loaded with |
| --- | --- | --- |
| People | 77 people, 5 companies, 6 automated senders, 5 strangers (mail from people you never answered), 12 match suggestions | `memo records import` (account `seed:demo`), mail, `memo people link` as an agent |
| Memory | 37 facts (accepted, proposed, rejected, reversed, superseded) and 18 memories (confirmed, proposed, stale) | `memo facts`, `memo memories`; a proposal is an agent's (`AI_AGENT`), a decision the owner's (`--from-app`) |
| Tasks | 4 projects, 57 project tasks in every state (38 to do), with owners, priorities and due dates; 4 tasks from SMS | `memo projects add`, `memo tasks add` and `update` |
| Clients | pipelines Sales (40 deals, 22 in Call) and Inbound (15 leads), your own, so the board moves them; their stages mapped onto the base stages | `memo pipelines`, `memo deals`, `memo leads`, `memo stages set` |
| Digests | a paused `morning-digest` and its last 5 days | `memo digest add`; the days are report files (below) |
| Search | Email: 97 messages in 60 threads on profile `personal`, two pages for `invoice`. memo: 57 notes in `~/Notes` | `mail personal messages import` of a Takeout mbox; `memo folders add`, `memo sync --only notes` |
| Analytics | Email by day, tasks by state and source | the data above |

Loading it again adds nothing. `bin/sandbox <name> --seed demo` on a demo sandbox loads the set again; a start
without `--seed` loads it when `data/seed.json` holds a newer `version` than the sandbox has. To change the set, edit
the data, raise `version`, and start the sandbox: what changed is updated, the rest is left.

- **How each step knows what is there.** People, companies and SMS carry the seed id as their
  `external_id` in a records envelope, which the store matches itself; the same file twice changes nothing, and a
  changed record needs the higher `version` as its revision. Tasks carry `seed:<id>` as their external id and are
  looked up before they are added. Pipelines, deals, facts and memories are known by name, title or text. Mail is
  deduplicated by its Gmail id, made from the thread's seed id; mail-cli only adds, so a changed mail stays as first
  loaded.
- **Dates count back from the day of the first load**, kept in `<name>/seed-anchor`: the data looks recent then, and
  a later load writes the same dates. A due date is set once, when the task is made.
- **The Email profile** is `owner@studio.example.org` with Gmail's IMAP host, because mail-cli reads a Takeout file
  only into a Gmail mailbox. Nobody signs in and nothing is sent.
- **Digest days** are files a digest run would leave (`~/.local/share/cli-memo/schedules/morning-digest/runs`, in the
  `wirecat.report/1` format), since making them otherwise is a paid model run; `src/platform/digest-seed.test.ts`
  holds them to the page's schema. `memo digest add` needs `claude` on PATH, so a stub that only fails is on PATH for
  that one call. The app does not see it, so the Digests page says no agent is set up.
- **Removing a row from the data does not remove it from a sandbox.** `--reset` starts over.
- A demo sandbox seeded before the seed set made its people by name only, so the set would add them again: `bin/sandbox`
  says so and asks for `--reset`.

What no command can load yet:

- **Telegram, MAX and WhatsApp messages.** No tool takes them from a file, and the store is never written with SQL from
  here, so Search and Analytics have nothing for those three. An SMS can be loaded (the envelope's `message` type, under
  the import-only `phone` provider), but no page reads SMS; they back the tasks from chats.
- **Unsorted people**: only a messenger contact can lack a readable name; a mail sender always has an address.

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
