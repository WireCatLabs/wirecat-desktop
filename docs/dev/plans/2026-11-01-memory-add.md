# Adding to memory by hand

Owner, 2026-11-01: "I'd allow to manually add memory via UI - upload a file, past a link to doc, html (we can
extract), image url or image itself, audio or just plain text and link it to other entities so AI would be able to
create facts from it - how we'd need to decide eg a few facts to suggest to user so it could pick them. I'd also
explain that the source will be stored in db and be searchable too".

This round is the plan and the design. Nothing is built in the app or in memo. It extends the Memory page
([first plan](2026-10-31-memory-page.md), [three versions](2026-11-01-memory-versions.md), PR #37; version 2 chosen).

## Why

Today memory fills only from what agents read: messages, mail, meetings, folders of notes. What the owner knows from
elsewhere (a PDF a colleague sent, a page on the web, a photo of a whiteboard, a voice memo, a call he remembers)
reaches memo only if he asks an agent in a terminal, or copies a file into a watched folder. The owner wants one place
to hand memo a source, say who or what it is about, and get a few facts from it to approve.

Two promises go with it, and the panel says both in plain words:

- **The source itself is kept.** "The source will be stored in Memo's database on this computer and be searchable
  too": in Search, and by agents when they look something up. Facts are extra, never instead of the source.
- **Nothing counts until the owner picks it.** Suggested facts arrive with tick boxes, like a findings batch on the
  Memory page today; only the ticked ones are kept.

## What memo offers today

Read from cli-memo `origin/main` (memo 0.131.3, on cli-core 0.513.0; cli-core main is 0.516.0) and `--help` of the
installed `memo` 0.131.3, run against a throwaway store (`MEMO_*_DIR`, `WIRECAT_*_DIR`, `HOME`, `XDG_*` in a temp
folder, `DBUS_SESSION_BUS_ADDRESS=disabled:`). Only help and read-only commands ran; the owner's store was not
touched. Paths below are in cli-memo unless they say cli-core, zoom-cli or drive-cli.

| Input | Today | Evidence |
| --- | --- | --- |
| **Plain text** | **Works.** `memo notes add --text-file - --title … --subject person:12 --subject project:3`. Subjects: `person:`, `project:`, `task:`, `organization:`, `msg:`, `note:`, `document:`, `meeting:`. Body up to 100,000 characters, title 500. The first subject is the note's own; the rest go to `links` as `about`. | `src/notes/command.ts:43-49`, `:169`, `:210`; cli-core `src/store/sqlite/notes.ts:184`, `:736-760`; `docs/notes.md` "Write your own notes" |
| **One file (PDF, Word, text…)** | **Folder only.** No command takes one file: `memo folders add <dir>` then `memo sync --only notes`. Reads `.md .txt .csv .tsv .pdf .docx .doc .xlsx .xls .odt .ods .pptx .epub`; up to 50 MiB a file; keeps 200,000 characters of text. **The file is not copied**: the store keeps its path, text, hash and how it was read, in `documents`. A scanned PDF has no text (`needs-agent`). | `src/notes/files.ts:4-19`, `src/notes/import.ts:30`, `:127`, `:168`, `:176-181`; cli-core `src/attachments/limits.ts:3`, `src/store/sqlite/notes.ts:596`; `docs/notes.md` "Files Memo can read" |
| **Readers** | PDF: unpdf. Word: mammoth. Old `.doc`: word-extractor. ODF, OOXML, EPUB: cli-core's own XML reader. | cli-core `src/readers/registry.ts:13`, `src/attachments/extract.ts:51-58` |
| **A link** | **Missing.** memo fetches nothing over HTTP except a domain-age lookup for mail. `tasks link` stores a URL without reading it. drive-cli syncs whole Drive **folders** (`drive folders add`), never one file. | `src/mail/domain-age.ts:96`; drive-cli `src/commands/folders.ts:19-30` |
| **HTML** | **Reader exists, unused here.** cli-core reads `.html/.htm/.xhtml` with linkedom and defuddle (main text, page data), but memo's folder import skips `.html`. Mail HTML is stripped with regular expressions instead. | cli-core `src/readers/html/index.ts:9`, `:35-39`, `:82`, `src/mail/parse.ts:62`; `src/notes/files.ts:4-19` |
| **Image** | **Missing.** The image reader answers `needs-agent`. Local OCR was declined on purpose (cli-core NEED-546). What exists elsewhere: OCR through OpenAI or Anthropic for messenger files, only with `--ocr` and `models.ocr.*` set; local picture search with `clip-b32` (`tg images embed`); the agent tool `attachments_show` hands the bytes to an agent. Images are stored only as message attachments (`attachments`). | cli-core `src/readers/image/index.ts:10`, `src/attachments/extract.ts:16-19`, `src/attachments/gateway-ocr.ts:27-32`, `src/images/picture/models.ts:31`, `src/mcp/tools/attachments.ts:13-23` |
| **Audio** | **Missing in memo; exists in cli-core.** `memo models list` shows only `e5-small` and `embeddinggemma`. cli-core has local speech models through sherpa-onnx (`parakeet-v3` default, `gigaam-v3`) and OpenAI transcription (`feat/openai-speech`, PR #2218, merged 2026-10-31, in cli-core ≥ 0.499.0), used today only by messenger voice messages (`<tool> messages transcribe`, whose `auto` mode "never sends audio off the machine"). zoom-cli transcribes recordings locally and attaches them to an existing meeting. | real `memo models list` output; cli-core `src/speech/transcribe.ts:15-17`, `src/speech/models.ts:161`, `src/speech/openai.ts:86`, `:115`, `:225`; zoom-cli `src/local-transcription-commands.ts:26-38` |
| **Links to people, projects, tasks** | **Works** at creation: `--subject` (repeatable) on `notes add`, `facts add`, `memories add`; `tasks link <task> document:3 --kind evidence`; `projects key-documents add <project> document:3 --reason`. All in the `links` table. `notes edit` has no `--subject`, so I think subjects cannot change later. | cli-core `migrations.generated.ts:40`; `--help` of each |
| **Search** | **Works for notes and documents.** Words: SQLite full-text tables (`note_words`, `document_words`, stems, trigrams). Meaning: local only, `e5-small` (384 dimensions) after `memo models download e5-small`, pieces in `chunks`, vectors in `embeddings`; covers hand notes and folder documents. `search all` leaves out memories and facts. | cli-core `migrations.generated.ts:223-232`, `src/embeddings/models.ts:40`, `src/services/notes-search.ts:181-199`, `src/store/sqlite/note-search.ts:519-521`; `docs/search.md:197-207` |

### Who makes facts today

- **memo calls a model in one place only**: `memo answers create --analyze`, configured by
  `MEMO_MODELS_ANALYSIS_PROVIDER`, `_MODEL`, `_BASE_URL` and the key in `MEMO_MODEL_API_KEY`. A remote address needs
  `--allow-remote`; `localhost` does not, so a model running on the computer works offline (`src/answers/command.ts:27-33`,
  `:139-160`). Nothing else in memo talks to a model.
- **Agents propose everything else.** Over MCP memo exposes `memo_tools_search`, `memo_read` and `memo_write`
  (`contracts/mcp-tools.json`); an agent runs `facts add`, `memories add` or `projects actions add` through
  `memo_write`. Facts an agent adds wait as `proposed`.
- **Findings batches** (`projects actions add <file.json>`, at most 64 KiB, 16 findings): each finding cites 1–8
  `msg:` or `document:` references with fingerprints from `projects evidence`. **A `note:` is not accepted**
  (cli-core `src/store/evidence-findings.ts:7-13`), and a batch belongs to **one project**. The owner decides with
  `projects actions confirm <project> <id> [finding ids] --fingerprint`, which creates the ticked facts and tasks
  as accepted, or `… reject`. Stored in `proposed_actions`, kind `evidence_findings`.
- **Who produces findings now**: outside agents run by hand, for example `codex-nbb-evaluation` with extractor
  `codex-nbb-evidence-review-2026-10-20` (max-cli `docs_ai/reports/2026-10-20-installed-project-workflow.md:93`).
- No command and no MCP prompt "suggest facts from this document" exists. memo's roadmap lists "optional AI analysis
  of a project's evidence" under Later (`docs/roadmap.md`).

## The gaps

1. **Add one file** with subjects, as a `document:`, with **a copy of the file** kept by memo (a file dropped from
   Downloads moves or disappears; a folder document only remembers its path).
2. **Read a link** once: fetch, pick the reader by content type, keep the text and the address.
3. **HTML** in the list of readable files (the reader exists).
4. **An image** kept as a file of its own, with its words read on request (NEED-3).
5. **Audio** turned into text by memo, with cli-core's local speech model.
6. **Suggest facts from one source**: nothing does it today (NEED-1).
7. **Findings about anyone**: a batch must name one project and cannot cite a `note:` (NEED-4).
8. **A model setting with a key in the keyring**: the analysis model is read from environment variables only, and
   the app cannot set those for memo safely.

## How "AI creates facts from it" should work (NEED-1)

| | A. memo calls the owner's model | B. a connected agent picks it up | C. the app starts an agent |
| --- | --- | --- | --- |
| What runs | `memo sources suggest document:42`: memo sends the text to the analysis model the owner set (the same setting `answers --analyze` uses), checks each quote exists in the source, and stages a findings batch | memo records a request (a task "suggest facts from document:42"); Hermes, OpenClaw or Claude Code finds it and runs `projects actions add` | a new `#[tauri::command]` runs `claude -p` or `codex exec` with memo's MCP server |
| New machinery | one command, a prompt, the batch writer; the model client already exists | a request queue, and every agent taught to poll it | an agent launcher per agent, its sign-in, its permissions |
| When facts arrive | seconds to a minute, while the panel is open | whenever an agent next runs: minutes or never | a minute or two |
| Cost | the owner's API tokens: a 4,000-word PDF is about 6,000 input tokens per run | the agent's own plan | the agent's own plan |
| Privacy | the text goes to the provider the owner chose, once, after he ticks "suggest facts"; with a model on `localhost`, nothing leaves | the text goes wherever that agent's model runs; the app cannot say where | same as B, and the app runs an agent with the owner's rights |
| Offline | yes, with a local model (Ollama, LM Studio) | only if the agent's model is local | only if the agent's model is local |
| Rule 1 (CLI first) | yes, all in memo | yes | partly: the app drives an agent, not a WireCat CLI |

**Recommendation: A.** It is the least new machinery (memo already has the model client and the review flow), it is
the only one that can show "reading it for facts…" honestly, and it is the only one where the panel can name the
place the text goes before it goes. B stays possible later: an agent can still stage findings for any `document:`
the owner added. The prototype draws A.

## The flow

On the Memory page, a quiet **Add to memory** button sits beside Read again (outlined; no purple on the page
header). It opens a panel **at the top of the rack**, in place, with `Collapse`, like a row's panel; no dialog,
because nothing here needs to block the page. One surface, four steps on the shared `Stepper`, each step slides in
(`.step-in` inside `AutoHeight`); the panel closes only when the owner says so.

1. **Source.** "What do you want Memo to keep?" and a text switch **File · Link · Text**.
   - *File*: a drop zone (drop anywhere on it, or "choose one"), the kinds it takes and the limit in mono. After a
     pick: a card with the name, size and what memo found ("PDF · 12 pages · text found on every page").
   - *Link*: an address field and **Read it**. Memo opens the link once, from this computer, and keeps the text as it
     is today. A page behind a sign-in cannot be read this way; the panel says to save it as a file instead.
   - *Text*: a title and a text box.
   - Under every choice, always: "The source will be stored in Memo's database on this computer and be searchable
     too: in Search, and by your agents when they look something up."
2. **About.** "Who or what is it about? Facts from it will be filed there. You can skip this."
   - A searchable picker over people, projects and tasks (one box, results grouped by kind, a tick for each choice,
     choices shown as removable chips). It is the same picker the Tasks plan asks for (`src/ui/Picker.tsx`).
   - **Named in it**: people and projects memo already knows whose names appear in the text, one click to add. Found
     by matching names on this computer; nothing leaves.
   - Then the choice that is also the consent: **Save it and suggest facts from it** ("Memo sends the text (4,210
     words) to the model you set in Settings, at OpenAI, with your key") or **Only save it** ("Nothing leaves this
     computer. It is still searchable, and you can ask for facts later"). Nothing is preselected for the model; with
     no model set, the first choice is off and the panel says where to set one.
3. **Facts.** The source is saved first ("runner-notes.pdf is saved and searchable"), so a failed suggestion never
   loses it. Then "The model at OpenAI is reading it for facts…" with placeholder rows; "You can leave this page: the
   suggestions will wait in Review under Northbridge Bench." Then the suggestions: the Memory page's findings list,
   with each fact's tick, Fact or Task, the text (a pencil corrects it in place) and **the words it rests on** with
   the page. Most are ticked; a task is unticked by default. **Keep 3** creates them; nothing ticked keeps the source
   only.
4. **Saved.** "Memo now knows 3 facts from runner-notes.pdf, about Northbridge Bench and Lena Ortiz. Your agents can
   use it from now on." What exists now: the source (searchable) and the facts (in use, citing the source). Next:
   **Find it in Search**, **Add another**, **Done**. Behind the panel the new source row appears in its group with a
   short wash.

What each step calls (after the CLI work below):

| Step | memo command |
| --- | --- |
| File | `memo sources add <path> --title … [--subject …]` → `document:42`, with what was read and why not |
| Link | `memo sources add <url> …` |
| Text | `memo notes add --text-file - --title … --subject …` (exists) — or `sources add -` so it can be cited (NEED-4) |
| Picker | `memo people list`, `memo projects list`, `memo tasks list` |
| Named in it | `memo sources mentions document:42` (names memo knows that appear in the text) |
| Suggest | `memo sources suggest document:42 [--subject …]` → a findings batch id |
| Keep | `memo projects actions confirm … [finding ids] --fingerprint …` (exists), or its widened form (NEED-4) |

## Where the source is stored, and how it becomes searchable

- **One row in `documents`**, the same table folder documents use, so word search, meaning search, `search notes`,
  `notes show document:42` and agents' `memo_read` find it with no new search code. Its `source` is a new kind
  (`added`), so `source:added` filters to what the owner added by hand.
- **The original file is copied** into memo's data folder (`~/.local/share/memo/sources/<hash>` or wherever
  `MEMO_STATE_DIR` points), named by its hash so the same file added twice is kept once (NEED-2). A link keeps the
  address and the fetched text; a text keeps only the text.
- **Searchable at once by words**; by meaning once the `e5-small` model is downloaded (memo embeds notes on this
  computer). The panel says "searchable" only after memo says the text was indexed.
- **Images**: the file, its size and dimensions, and its words if a model read them (NEED-3). Without words, it is
  found by its title and the subjects linked to it.
- **Audio**: the file and its transcript, kept like a document; the transcript is what search reads.

## Size limits

| Input | Limit | Why |
| --- | --- | --- |
| A file (documents, images) | 50 MiB | memo's folder limit today (cli-core `src/attachments/limits.ts:3`) |
| Text kept from a file or page | 200,000 characters | memo's limit today; the card says "only the first part is kept" past it |
| Pasted text | 100,000 characters | `notes add` limit today (cli-core `notes.ts:184`) |
| A link | 50 MiB, 30 s, at most 5 redirects, `http(s)` only | proposed |
| Audio | 50 MiB and 4 hours | proposed; cli-core's meeting limit is 1 GiB and 4 h, but a copy kept in memo should stay small |
| Text sent for suggestions | the first 60,000 characters, said on screen | proposed; keeps one run's cost bounded |
| A findings batch | 16 findings, 64 KiB | memo's limit today; the model is asked for at most 8 |

## Privacy

- **Saving sends nothing.** File, text and audio are read on this computer (PDF and Word readers, local speech
  model, local `e5-small`). "Only save it" is true as written.
- **A link is one GET from this computer** to that address: the site sees the owner's IP address, as in a browser.
  No cookies, no sign-in, no private addresses (`localhost`, `10.*`, `192.168.*`), so a link cannot be used to read
  the owner's own services.
- **Suggesting facts sends the source's text** (and for an image, the image) to the provider named on screen,
  once, after the owner picks "Save it and suggest facts". With a model on `localhost`, nothing leaves. The choice
  is per source, not a setting that stays on.
- **The key** lives in the system keyring through memo (`models keys set`), never in the app, never in a command
  line. The app never reads it (rule 4).
- **Rule 3**: the model is the one the owner set; the app never picks a provider, a model or a Drive profile.
- **Rule 2**: the app passes a path the owner chose in the file dialog or dropped, a URL checked to be `http(s)`, a
  title, subject references in memo's form and text on stdin. Rust maps each to a fixed `memo sources …` line;
  `--no-record` on every call, so the text never lands in memo's run log.
- **Logs and reports**: the source's text, file name and facts never go into a log, a bug report or a crash report;
  `ReportThis` here sends the error reason only.

## States

| State | What the owner sees | Scenario |
| --- | --- | --- |
| Closed | The Add to memory button beside Read again | `closed-*` |
| Source, nothing chosen | Drop zone, kinds and limit, the storage line; Next is off | `source-*` |
| A file, a link, a text, an image, a recording chosen | The card with what memo found | `file-*`, `link-*`, `text-*`, `image-*`, `audio-*` |
| Too big | The zone frame turns red; one line with the size and what to do | `too-big-*` |
| No text in it | A scanned PDF: it can be kept, found by title and subjects only | `unreadable-*` |
| The link failed | The answer (401, 404, timeout) and "save it as a file instead" | `link-fail-*` |
| About | Card, picker, chosen chips, names found in it, the suggest-or-save choice | `about-*` |
| No model set | "Suggest facts" off, a link to Settings; saving still works | `no-reader-*` |
| Reading for facts | The busy lamp, placeholder rows, "you can leave this page" | `extracting-*` |
| Suggestions | Ticks, quotes, the pencil, Keep n | `facts-*`, `narrow-facts-*` |
| Suggestion failed | The step turns red; the provider's reason; Try again, Keep without facts | `extract-fail-*` |
| Saved | What exists now and the next steps; the new row behind | `done-*` |
| Memo too old | Update Memo, the one primary button | `old-*` |
| Memo missing | The Memory page's own "Memo is not installed" state; no button | (Memory page) |

## Mock scenarios for the browser build

`?add=source|file|link|text|image|audio|about|extracting|facts|done|too-big|unreadable|link-fail|no-reader|extract-fail|old`.
Without `?add`, the panel is closed. In the real mock (`src/platform/mock.ts`), these become `?add=` on the Memory
page the same way. Made-up data only: projects Northbridge Bench and Harbour launch, people Kai Sample, Lena Ortiz and
Tom Becker.

The prototype is [prototype/AddToMemory.tsx](../../../.impeccable/mocks/memory/add/prototype/AddToMemory.tsx), outside
`src`, drawn with the app's own `Button`, `Collapse`, `AutoHeight`, `Stepper`, `Lamp`, `Pill` and `ErrorNotice`. The
page around it stands in for the Memory page of PR #37 (not on `main`), and its picker stands in for the `Picker` the
Tasks plan proposes. Its placeholder rows while facts load are plain blocks, because the capture script waits for
`.skeleton` to disappear; the real panel uses `Skeleton`. Screenshots, light and dark, 1280×840 and 960×640:
[.impeccable/mocks/memory/add/](../../../.impeccable/mocks/memory/add/).

## Build steps

Rule 1: memo first, released, then the app.

| # | Step | Where | Estimate |
| --- | --- | --- | --- |
| 1 | `memo sources add <path\|url\|-> --title --subject… --json`: one source into `documents` with `source: added`, the file copied by hash, the existing readers plus HTML; JSON says what was read, how much, and why not (`too-large`, `unsupported`, `no-text`) | cli-memo, cli-core store | 1.5–2 days |
| 2 | Links: `http(s)` GET, 50 MiB, 30 s, 5 redirects, no cookies, private addresses refused, reader by content type (HTML through the existing reader, PDF, plain text, an image) | cli-memo | 1 day |
| 3 | Audio through cli-core's local speech model; `memo models list` shows the speech models, `models download parakeet-v3` | cli-memo | 1 day |
| 4 | Images kept as sources; their words read by the analysis model on request (NEED-3) | cli-memo, cli-core | 0.5–1 day |
| 5 | The analysis model as a setting with its key in the keyring (`models keys set`, `config set models.analysis.*`), not only environment variables | cli-memo | 0.5 day |
| 6 | `memo sources suggest <ref> [--subject…]`: the prompt, at most 8 findings, each quote checked against the source, a findings batch with document fingerprints; `sources mentions <ref>` | cli-memo, cli-core findings | 2–3 days |
| 7 | Findings about a person, an organization, a task or nobody, and citing `note:` (NEED-4); confirm by batch id without a project | cli-core `evidence-findings.ts`, cli-memo | 1 day |
| 8 | Release memo; record the minimum version in the catalog | cli-memo, `catalog/tools.json` | 1 h |
| 9 | Rust: `memory_source_add` (a path from the file dialog or a drop, a URL, or text on stdin), `memory_source_suggest`, `memory_mentions`, decide through the Memory page's existing call; `--no-record`; tests with a fake `memo`. Drops come from Tauri's own drag-drop event, which gives paths (RISK-1) | `src-tauri/src/` | 1–1.5 days |
| 10 | Platform bridge, valibot schemas, mock scenarios above | `src/platform/` | 0.5 day |
| 11 | The panel on the Memory page, every state, en/ru/es; `Picker` from the Tasks plan if it landed, else here | `src/features/memory/` | 2 days |
| 12 | Checks: both themes and 960 width with the capture script, rule 9 (the panel opens without moving the rack), keyboard (the drop zone has "choose one"), reduced motion, `pnpm check` | — | 0.5 day |

About 12–14 working days, about 8–10 of them in memo and cli-core. Without images (NEED-3 B), about a day less.

## Open questions for the owner

- **NEED-1 · Who reads a source and suggests facts?** A memo calls the model the owner set (a provider with his key,
  or a model on this computer) and stages a findings batch (drawn) · B memo leaves a request that a connected agent
  picks up later · C the app starts Claude Code or Codex itself. I recommend **A**: the least new code, the only one
  that can say where the text goes before it goes, and the only one with an answer while the panel is open.
- **NEED-2 · Should memo keep a copy of an uploaded file?** A a copy in memo's data folder, by hash (drawn) · B only
  the path and the text, as for folder documents. I recommend **A**: a file dropped from Downloads is often deleted
  later, and "stored in db" should mean the owner can open it again. It costs disk space, shown on the Storage page.
- **NEED-3 · How should an image's words be read?** A by the same model, only when the owner asks for facts (the
  image leaves the computer) · B never: the image is kept and found by its title and subjects only · C local OCR
  (tesseract), which reverses cli-core NEED-546. I recommend **A**, with B as what happens when no model is set.
- **NEED-4 · Can suggested facts be about a person, or about nobody?** Findings batches today belong to one project
  and cannot cite a hand note. A widen them to any subject and to `note:` · B suggestions only when a project is
  chosen; otherwise "Only save it". I recommend **A**: half of what the owner adds is about people (a call with Lena),
  and B would hide the main feature behind picking a project.
- **NEED-5 · Should a Google Docs link be read through Drive?** A drive-cli learns to fetch one file, signed in as a
  profile the owner picks · B plain links only; a private doc is saved as a file first (drawn). I recommend **B** for
  the first version: it needs no new drive-cli work, and the panel already says what to do.
- **NEED-6 · Should kept facts count as the owner's at once?** A yes: the owner picked them, so they are accepted and
  agents use them (drawn) · B they stay proposed until confirmed on the Memory page. I recommend **A**: picking is
  the confirmation, and a second review of the same facts is busywork.

## Found on the way

- **FIND-1 · HTML can already be read, just not by memo.** cli-core's HTML reader (linkedom and defuddle) is
  complete, but memo's folder import does not list `.html`, and mail uses regular expressions instead.
- **FIND-2 · Local transcription exists but memo does not offer it.** cli-core has `parakeet-v3` and OpenAI speech
  (PR #2218); `memo models list` shows only the two embedding models.
- **FIND-3 · Hand notes cannot be cited by findings** (`evidence-findings.ts:7-13`), so pasted text cannot back a
  suggested fact until NEED-4 is decided.
- **FIND-4 · `notes edit` cannot change subjects**, so a wrong link made while adding cannot be fixed later.
- **FIND-5 · `search all` leaves out memories and facts**; facts kept from a source are found by `facts list`, the
  source by `search all`.
- **RISK-1 · Dropping a file in the webview.** HTML5 drop gives the page a `File` without its path. I think Tauri's
  own drag-drop event (on by default, `dragDropEnabled`) gives paths and swallows HTML5 drops on Windows (not checked
  here). The panel should take paths from Tauri's event and keep "choose one" as the keyboard path.
- **RISK-2 · An agent may decide project proposals alone.** By default an agent may confirm a findings batch with a
  reason (cli-memo `docs/mcp.md:47-48`). The panel's promise "nothing counts until you pick" holds only if the
  batches it creates are marked owner-only, as meeting findings are.
- **RISK-3 · The analysis key is read from an environment variable** (`MEMO_MODEL_API_KEY`). The app must not start
  memo with a secret in its environment; step 5 moves it to the keyring first.

## Not verified

- Nothing was added, synced or suggested, even in the throwaway store; every "works" above is from code and `--help`.
- Whether a hand note gets meaning-search pieces when it is added (the search reads them; not run).
- Whether OpenAI speech in cli-core works end to end, and whether a released tg ships it.
- drive-cli fetching one file: inferred absent from `folders add` refusing anything but a folder.
- Who else stages findings besides `codex-nbb-evaluation`: the owner's store was not read.
- Token cost per source: estimated from words (about 1.4 tokens a word), not measured.
- The prototype runs in Chrome against made-up data; captures use reduced motion, so no animation was checked.

<!-- cspell:words Northbridge Ortiz Becker parakeet gigaam linkedom defuddle unpdf mammoth sherpa Ollama OOXML onnx -->
