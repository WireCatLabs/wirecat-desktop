---
name: try-fresh-install
description: Run WireCat Desktop as on a computer that has never seen it (empty home, no Node.js, no keyring) to check first-run setup, installs, PATH and sign-in by hand. Use when asked to test or simulate a fresh install, re-check onboarding, or hand the owner a test run with a checklist.
---

# Fresh-install test run

`bin/try-fresh-install` is `bin/sandbox fresh`: the real app (debug build) in the sandbox named `fresh`. The owner's
own tools, settings, data and sign-ins are not read and not changed. What is separate and what is shared, the other
presets (`tools`, `demo`) and `bin/sandbox-check` are in [`docs/dev/guides/sandbox.md`](../../../docs/dev/guides/sandbox.md).

Consequences to tell the owner up front:

- Claude Code, Codex and other agents are not found, so the Agents step and Fix › show their "no agent" paths.
- Sign-in cannot use the keyring: tools fall back to a file and say so. That notice is expected here.
- Links open in his own browser and Open terminal in his own terminal, but the shell there reads the sandbox's rc
  files, so its prompt looks plain.
- Linux only. macOS and Windows go through the install-check CI workflow.

## Run it

1. Build once per code change (from the checkout or worktree that holds the change):
   `pnpm tauri build --debug --no-bundle`. Check `free -g` and `df -h ~` first; the build needs several GB.
   Use `CARGO_INCREMENTAL=0` when disk is short.
2. Start: `<repo>/bin/try-fresh-install`. Add `--reset` to empty the sandbox and start from nothing.
   Without `--reset` the same home is reused, which tests resuming setup after a restart.
3. Close the window to end the run.

Hand the owner the absolute path of the script in the tree that was built, e.g.
`~/Projects/AI/wirecat-desktop/bin/try-fresh-install --reset`.

Inspect afterwards, read-only: `~/.cache/wirecat-sandbox/fresh/home/.bashrc` (PATH blocks, one per file, no duplicate
folder), `~/.cache/wirecat-sandbox/fresh/home/.local/share/dev.wirecat.desktop/` (managed Node.js, prompts), or run a
command inside: `bin/sandbox fresh --exec <command>`.

## Checklist to hand the owner

Write it per change, in the order the owner meets the screens. The base list:

1. Start: a loader, never a blank window.
2. Your computer: Continue blocked with a reason until Node.js is set up or "I'll install it myself"; Node.js setup
   phases with progress; no flash after Add to PATH.
3. Choose tools: the count on the Install button.
4. Install: overall percent and each row agree and never go back; time estimate; tips; restart note; "install other
   tools later".
5. Leave mid-install: "Still installing" on later steps and on Tools.
6. Agents (skills): with no agents found here, the empty path reads well.
7. Sign in: steps, pictures, validation, errors with a way back, keyring notice, 2FA note.
8. Restart without `--reset`: setup opens at the first step not done, or home.
9. Both themes.

## What the sandbox cannot show: use the browser build

`pnpm dev`, then <http://localhost:1420> with the mock scenarios listed in `CLAUDE.md` (for example
`?fail=tg&fail-reason=disk`, `?agents=claude&agent-fail=terminal`, `?path-fail=always&path-shells=bash,zsh,fish`,
`?signin=tg&signin-fail=tg-apiid`). Agents found, failures on demand and the shell picker are only reachable there.

## Rules

- Never point the run at the owner's real home, and never remove `DBUS_SESSION_BUS_ADDRESS=disabled:`.
- Never sign in with the owner's real account from an agent; the owner does that by hand if he wants.
- `--reset` is the way to empty a sandbox; never delete another folder by hand.
