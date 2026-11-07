# Setup flows: the plan

Goal: every tool installs, signs in and starts working inside WireCat, step by step, the way Telegram already does.
The owner should never need a terminal or another program for the normal path. The audit behind this plan is TASK-128
(journal `docs/journal/2026-11-06-polish-after-040.md`).

Order (owner's decisions NEED-2266 B, NEED-2267 A, NEED-2268 A): desktop fixes first, released with the next normal
version (no 0.4.2 for this alone); then the CLI changes, one repository at a time; Email after mail-cli has its sign-in
steps.

## Phase 1: desktop fixes (TASK-129, TASK-130, TASK-131)

| Area | Change | Task |
| --- | --- | --- |
| All tools | One sign-in wizard: intro with what to have at hand, step list with progress, each CLI step in the window, finish step | TASK-129 |
| All tools | Known failures mapped to a plain message, the cause, one action and a fallback; the tool's text under Details | TASK-129 |
| All tools with sync | "Sync now" after sign-in | TASK-129 |
| max | Token method (`session start token --json --answer-stdin`, max-cli 0.80+) as the fallback to the QR code | TASK-129 |
| zm | In-window checklist for the Zoom app, values to copy; transcript files (`source files`) as the way without an app | TASK-129 |
| Onboarding | Copy no longer says each tool signs in in a terminal (FIND-89) | TASK-129 |
| Tool details | Background services panel (wa `server`, memo jobs) | TASK-131 |
| memo | First-run card and folder dialog | TASK-130 |
| memo, drive | A system folder window (NEED-2269) | open |

## Phase 2: CLI changes, per repository

| Repository | Change | Why |
| --- | --- | --- |
| zoom-cli | A `needs` step for `client_id`; a stable `reason` for a missing Client ID; a `zm app` helper that prints the redirect, scopes and manifest | The window matches "zoom.client_id" in the error text today (`zoomNeedsClientId`) |
| whatsapp-cli | `--answer-stdin` for the phone pairing; `expires_at` and a link on each QR code; a progress event for the history wait | Phone pairing needs a terminal; the window reads the history wait from note text (DEBT-2) |
| drive-cli | `folders browse` lists remote folders | The window cannot offer a folder picker without it |
| max-cli | A `failed` reason for an expired QR code (`qr.expired`) | The window reads "expired" from the text |
| cli-core | A stable `reason` on every sign-in failure, sent with `code` | `signin-failure.ts` falls back to text matching |

## Phase 3: Email after mail-cli (BUG-85)

The Email entry still uses memo commands removed in memo 0.131.25. Fix: a mail-cli entry, after mail-cli has
`session start --json --answer-stdin` (address, the app password as a secret question, the provider's app-password
hint and link, `open_url` for OAuth). Until then the Email row stays as it is.

gcal 0.19 signs in only with the owner's own Google client file; it needs a bundled Google app first.
