# Install and onboarding feedback: everything asked, and where it stands

Written 2026-11-05 from Slava's notes since 2026-11-04 and the two session journals
([2026-11-04](journal/2026-11-04-smooth-install.md), [2026-11-05](journal/2026-11-05-desktop-install.md)).
"Done" means merged into main (PR #93) or into PR #96 (open, `feat/install-polish`), with tests. "Seen" means Slava saw it
in a test run. Nothing here was checked on a real Mac or Windows machine.

Status: **done** · **running** (a worker is on it now) · **open** (not started) · **partly** (some of it done).

## 1. Open now

| # | Note | Status | What is left |
|---|---|---|---|
| A1 | "picking agent does not difference" (guide's Your agent picker) | **open** | The picker changes nothing: the prompt depends only on language and messenger (`GuidesPage.tsx:394`). "Open in <agent>" shows only for Claude Code, Codex or Gemini when found, and the test run finds none. Fix: per agent, the paste hint says where to paste ("Cursor: open the chat with Ctrl+L, paste"), and the prompt's first line names the agent's skill usage if it differs; or remove the picker. Recommend: keep it and make each choice change the hint and the action visibly. |
| A2 | Install steps "at least twice slower", a small animation | **done** | Worker `motion-2`: rows hold 1.2 s, a check-mark animation, a gentle "All set". |
| A3 | Screens and dialogs open "a bit smoother" | **done** | `motion-2`: longer section and step transitions, dialog scale and fade. |
| A4 | Telegram sign-in text "still too small" | **done** | `motion-2`. |
| A5 | QR ↔ phone switch "too fast still" | **done** | `motion-2`: slower cross-fade, "Switching…" readable for at least 0.7 s. |
| A6 | Tour: 1–2 more stops on Search, Memory, Tasks showing what you can do | **done** | Worker `tour-2`, with example data. |
| A7 | 10 s of silence after scanning the QR | **partly** (tg 0.116.0 released) | The dialog shows "Waiting for Telegram…" with a counter. The real fix (tg prints "scan accepted") is merged in tg-cli but **tg 0.116.0 is not on npm**: its release crashes on macOS. A worker is finding the cause. |
| A8 | Step indicator "as circles at the top" | **partly** | Built into the sidebar's numbered circles (line, checks, "done") instead of a second row at the top. Say if you still want it at the top. |
| A9 | Two purple buttons on the last tour stop ("Try this guide" and "Copy prompt") | **open** | Breaks the one-primary-button rule. Small fix. |
| A10 | Community CLIs "picked up by desktop" | **partly** | App side merged into #96 (signed list, off by default). cli-docs #546 merged; its first signed deploy is running. Then check `https://wirecat.dev/registry/v1/desktop-tools.json`. No community tool is listed yet. |
| A11 | `bot list` without the dummy word | **partly** | Released in cli-core 0.567.0 and wa 0.29.0. Waits for tg 0.116.0 and a max-cli bump before the app drops the word. |
| A12 | "Two CLI versions installed" on Windows (FIND-198) | **open** | Never reproduced. Needs a Windows test run; the Tools panel shows both paths. |
| A13 | Skill errors "path is not there" text (NEED-2185) | **open** | You couldn't recall it. Replaced by one grouped notice with Fix; check on the next Windows run. |

## 2. Done in PR #96, waiting for your test run

| Note | What was built |
|---|---|
| Blank screen at start | Boot loader with the mark and a slogan, fades into the app. |
| Flash after "Add to PATH", no progress there | Cause fixed (old "no Node.js" answer on screen during the re-check); one bar through the whole Node.js setup, "Step 1 of 2 / 2 of 2". |
| Sign-in dialog too small, no scroll | 62 rem wide, 1 rem text, scrolls between fixed title and buttons (A4 makes the text larger still). |
| Button jumps when sending app keys | Stable layout, steps cross-fade, standard buttons. |
| Validate api_id and api_hash | Trimmed, digits only for the id, 32 hex for the hash, swapped keys caught; format hints after a refusal only when the keys look wrong. |
| Try again shows the QR for a second | Fixed. |
| "Use phone number instead" goes back | Works: tg restarts and asked for the keys again. Now sent by themselves, explicit heading and steps per method, "Switching…", the reason on failure. |
| Phone number check | Digits and a leading + only, paste cleaned, international format, shown back before sending. |
| X closes with a lag | Closes at once; tg stops in the background. |
| QR instructions per phone | Android and iPhone tabs, Android screenshot. |
| 2FA note not seen | Now a boxed note at normal size. |
| "Signed in" screen with no next step | Sign-in goes straight to "You are set up". |
| Done step leads to MCP | "Show me around" tour; ChatGPT link is secondary; tour ends on the first guide with next steps. |
| Tour Agents stop stays on Tools | Every stop opens its page. |
| Memory and Tasks in the tour with demo data | Example rows, in memory only, gone after the tour (A6 adds more stops). |
| Help's first item opens Telegram docs | Help never had a docs item; it now starts with "WireCat documentation". |
| Bot sign-in for Telegram, MAX, WhatsApp | "Add a bot" on the Tools page, one dialog, token via stdin, Bot badge. Not tried with a real token. |
| Terminal opens sh instead of zsh | Runs your shell from your account. |
| Smooth changes across the app, not only setup | Motion tokens, page fade, Tools rows, Agents cells, skill install, dialogs, errors, button labels (A2/A3 slow them down). |
| npm and PATH bars not real | Bars move only on real signals; named verify steps from Rust; no fake percent. |
| Instruction text too small | Tool descriptions and instructions at 1 rem. |
| Prompt box shows a second square border on click | Fixed. |
| Script for install testing in main, with a skill | `bin/try-fresh-install` on main, skill `.claude/skills/try-fresh-install`. |

## 3. Done and merged to main (PR #93)

PATH added automatically and the restart note · one grouped "not on PATH" notice with Fix · Fix › starts an agent with a
prompt, or shows the prompt and why it couldn't · install wait screen with percent, estimate and tips · actionable install
errors (network, disk, proxy, long path, permissions) · Node.js gate with "I'll install it myself" · Node.js unpack
progress · per-tool bars matching the overview · installs visible on later steps and on Tools · "install others later" ·
skills step text, quiet Continue, purple Install, Install all · single Cursor column (columns were per skill folder) ·
Telegram app-key steps with pictures, copy link, calm keyring note, error causes with "Enter the keys again" · Advanced MCP
section only when there is something to remove · Fix PATH said "Added" with the error still there (bash read the wrong
file) · your real shell from the account, PATH in every shell you use, shell picker, manual line as last resort ·
regression tests for setup and install (3 bugs found) · setup reopens at the first step not done, or home · scrollbar
closer to the edge · architecture report, guides for AI, UI library comparison · Telegram docs with cleaned screenshots in
tg-cli and cli-docs.

## 4. Decided, not started

| What | Decision |
|---|---|
| Frontend refactor: tests first, `src/shared/`, React Aria Components with our Tailwind classes, TanStack Query, TypeScript types from Rust | NEED-2189 A, NEED-2191 A, NEED-2193 A. Separate PR after #96. Plan in [architecture-report.md](dev/architecture-report.md). |
| Rust: typed errors, an app log file, `lib.rs` split by feature | NEED-2192 A. Separate PR after the frontend refactor. |
| Release the desktop app | NEED-2186 B: wait for the planned release. |

## 5. Ideas found on the way, not asked for

Store backups never pruned (IDEA-24) · old managed Node.js versions never removed (IDEA-25) · five progress bars still
hand-drawn (Update, Logs, Sync, connect guide, Backup) · "Add a bot" not offered during setup · max-cli on the old cli-core.

## 6. Order I propose

1. A2–A6 land (running), plus A1 and A9; one merge into #96; rebuild the test run; your test run.
2. tg 0.116.0 published (A7), then the app drops the dummy `bot list` word once max is bumped (A11).
3. Merge #96 when your run is clean.
4. A Windows test run for A12 and A13 (install-check workflow or a real machine).
5. Frontend refactor PR, then the Rust PR.
