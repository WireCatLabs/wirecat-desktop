# Sign-in API

<!-- cspell:ignore gcal -->

The contract between WireCat Desktop (the client: `src-tauri/src/signin.rs` runs the tool, `signin_steps.rs` reads
its lines) and each tool's `session start` (the CLI: cli-core `src/terminal/sign-in-steps.ts` and
`src/terminal/login-qr.ts`, used by tg, max, wa, zm, drive, gcal and mail). Change it here first, then on both sides.

## Principles

- **The tool signs in; the app only draws.** The app never reimplements a sign-in. It runs the words of one
  `signIn.methods` entry in `catalog/tools.json`, with the profile the owner chose (`{profile}`).
- **Answers only on request.** A tool reads answers from stdin only with `--answer-stdin`. Without the flag, a tool
  with no terminal refuses, so an agent's shell never waits for an answer.
- **A secret never reaches a log.** A QR code, a pairing code and a sign-in link are login tokens while they are
  valid. They go to the window only. An answer is written to stdin and wiped; it is never logged, stored, put in a
  report or repeated in an error.

## The run

```text
<bin> {profile} session start [<method>] --json [--answer-stdin]
```

- **Flags:** `--json` always. `--answer-stdin` only on a method that can ask a question; wa's `qr` method leaves it
  out, so an older wa still signs in.
- **stderr:** one JSON object per line for each step (below), plus lines for people.
- **stdin:** one line per `needs` step: the answer, then a newline. One line only, no control characters.
- **stdout:** the final answer, one JSON envelope. There is no `done` step.
- **Stop:** `SIGTERM` to the run, then a kill after five seconds.

## Steps on stderr

| `event` | Fields | The app |
| --- | --- | --- |
| `qr` | `qr: { text, expires_at, scan }` | draws `text` (a half-block drawing) as a QR image; a new one replaces the old. `expires_at` may be null |
| `pairing_code` | `code`, `where`, `expires_at` | shows the code to type on the phone, and where |
| `open_url` | `url`, `purpose` | an "Open in browser" button. A URL that is not `https://` is dropped |
| `needs` | `field`, `secret`, `prompt`, `hint` | an input field. A missing `secret` counts as secret |
| `progress` | `step`, `message` | a line under a spinner |

```json
{"event":"needs","field":"password","secret":true,"prompt":"2FA password (not shown)","hint":"the cat"}
```

Fields that a `needs` step asks for: `phone`, `code`, `password`, `api_id`, `api_hash`, `token`, `redirect`,
`client_id`.

Lines that are not JSON:

- `Open <Provider> sign-in: https://…` is read as an `open_url` step when the tool printed no `open_url` before.
- A plain drawing of a code, a line that starts with `agents:`, the `scan` sentence, a line that repeats the link, and
  `logged in as …` are dropped.
- wa's `receiving history from the phone` and `still waiting for the phone's history` are `progress` steps
  `history` and `waiting`.
- Any other line is shown as a note, masked.

## The answer on stdout

Success:

```json
{ "item": { "already_linked": false, "received": { "chats": 12, "messages": 340, "people": 25 } } }
```

`already_logged_in` means the same as `already_linked`. `received` is optional. The app reads nothing else from the
item: the account's id and name stay in Rust.

Failure is the usual error envelope, `{ "error": { "message", "code", "reason" } }`. `reason` is cli-base's finer
name for the failure (`device.in-use`, `mail.app-password-required`). A message with `unknown command`, `unknown option`
or `too many arguments` means the tool is too old for these flags; the app then asks the owner to update it.
