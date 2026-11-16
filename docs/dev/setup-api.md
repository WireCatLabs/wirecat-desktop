# Setup flow API

<!-- cspell:ignore pbx -->

The contract between WireCat Desktop and a tool that describes its own connection flow: the WireCat setup format v1
(cli-core `src/setup/`, design in cli-private `plans/2026-11-15-setup-format.md`). The tool owns the steps, the texts
in each language, the inputs and the pictures; Desktop draws them in one way for every tool. Change cli-core's schema
first, copy its fixture here, then the renderer.

## The commands

Rust runs only these, as argument lists, with the profile the owner chose (`src-tauri/src/setup_flow.rs`):

```text
<bin> {profile} setup show --json                       the document, with the profile's current values
<bin> {profile} setup apply --dry-run --json            answers on stdin; the walk and its problems, nothing saved
<bin> {profile} setup run apply --json --answer-stdin   answers on stdin's first line; steps as a sign-in's
```

- **A tool from before the format** refuses `setup show` with "unknown command". The dialog keeps its hand-made form
  (`signIn.methods` in the catalog). So does a document that does not parse, or that needs a run action other than
  `apply`, `options_from`, or a feature in `requires` this renderer lacks.
- **The dry run** walks the answers from the start and stops at the first step with a problem, naming it in `at`. The
  dialog sends the answers up to the step on screen and marks only that step's inputs; a stop further on means the
  step passed.
- **The run** prints the steps of the [sign-in API](signin-api.md) on stderr and the usual envelope on stdout
  (`item.outcome: "ok"`), or the error object. A `needs` step is answered with `sign_in_answer`, as in a sign-in, and
  a setup run never runs beside a sign-in of the same tool.

## What Desktop trusts

Nothing in the document. The interface parses it with valibot (`src/domain/setup-flow.ts`) and keeps only what v1
draws; unknown keys, such as each setting's JSON Schema, are dropped.

- **Size:** at most 256 KB, 60 steps, groups and conditions each at most 8 deep, 100 moves per walk.
- **Style:** a block's `role` from a closed list per type, and the reserved `class` names, each mapped to a literal
  class of the app's design tokens. Any other name is ignored and never reaches CSS.
- **Text:** restricted Markdown. React escapes every string, so raw HTML stays text; an image in Markdown stays text.
- **Links:** `https` only, to `wirecat.dev`, `github.com/WireCatLabs` or a domain in the tool's catalog entry
  (`signIn.links`). No user, password or port. Any other link is drawn as text.
- **Images:** only from the tool's own package, read by Rust: the asset's path matches the format's pattern, stays
  inside the package once links are followed, is at most 2 MB and is a PNG, JPEG or WebP by its first bytes, never
  SVG. The interface draws only a `data:` URL of those three types.
- **Commands:** a `code` block is text to copy. Nothing in the document is ever run.
- **Secrets:** a `password` input stays outside the stores, reaches the tool only on stdin and is wiped once sent. A
  kept secret (`values` shows `{ "set": true }`) starts empty and is sent as absent, so the tool keeps it.
- **Paths:** a `file` or `folder` input has the system's own window (`setup_pick_path`); the tool's schema checks the
  path like a typed one.

## The fixture

`src/domain/setup-v1/` is a byte-for-byte copy of cli-core's `test/fixtures/setup-v1/`: the JSON Schema and three
examples. `source.json` records the cli-core commit and each file's sha256, and `setup-flow.test.ts` checks them. The
renderer draws every example in `SetupFlow.test.tsx`; the OAuth and Telegram examples run actions of their own, so the
dialog leaves them to the hand-made form.

## In the browser build

`?setup=pbx` makes pbx describe cli-core's example flow (`src/platform/mock-setup.ts`). `&setup-values=1` edits a
profile with a kept password; `&setup-step=<step>&setup-answers=cdr_source:mysql,phone_region:ES` opens on a step
(`check` goes on into the run); `?setup-fail=auth|network` fails the run.
