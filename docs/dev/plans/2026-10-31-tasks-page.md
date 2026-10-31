# The Tasks page

Owner, 2026-10-31: "I think we need to also add Tasks page with table and kanban views and some filters (especially
projects, assignee, priority, dates etc as well as search) and allow editing them and switching statuses by dragging
etc".

This round is the plan and the design. Nothing is built in the app yet. It follows the shape of the
[Memory page plan](2026-10-31-memory-page.md) (PR #35).

## Why

Memo keeps tasks in projects (`HRB-12`): a title, notes, a priority, a due date, who is assigned, which task waits for
which. Agents connected to Memo read the same list, claim a task while they work on it, and add new ones. Today the
owner sees this list only in a terminal (`memo tasks list project:HRB`), one project at a time, with no way to see
the week at a glance or to move a task along without typing its key.

The page puts the list where the owner already is: a table to scan and edit many tasks, a board to move work from
"To do" to "Done" by dragging, and filters by project, person, priority and date on top of Memo's own search.

## What Memo offers today

Read from cli-memo `origin/main` (19b51af, memo 0.127.0, cli-core 0.501.0): `docs/tasks.md`, `src/tasks/*.ts`, and
`--help` of each `memo tasks` command. The commands were run against a throwaway store with
`DBUS_SESSION_BUS_ADDRESS=disabled:` and `--no-record`; the owner's store was not touched. The installed global
`memo` is 0.126.0.

| Part of the page | Command | What it gives | Status |
| --- | --- | --- | --- |
| The list | `memo tasks list project:HRB --json` | `items[]`: `ref`, `key`, `title`, `description` (Markdown), `kind` (bug, feature, chore), `state` (open, done, dismissed), `project` (`project:<id>`), `priority` (0–4 or null), `parent`, `due_at` (UTC ISO), `closed_at`, `reason`, `claimed_by`, `claimed_until`, `created_at`, `updated_at`; `page {limit, has_more}` | exists, **one project per call**, at most 500 rows, no paging, no sort option (priority, then oldest first) |
| Search and filters | `memo tasks list <query>` | fields `state`, `kind`, `project`, `ready`, `source` only (`src/tasks/list.ts` `TASKS_LIST_QUERY`); terms joined by AND | **CLI work**: no `assignee:`, `priority:`, `due:`, free text, OR or NOT. The store already has what they need: `find()` takes an assignee and a compiled query, and `task_words` is a word index over tasks |
| One task | `memo tasks show HRB-12 --json` | the list fields plus `assignments[]`, `links[]`, `linked_from[]`, `next_check_at` | exists; but the card says `status` and `type` where the list says `state` and `kind`, and the list has no `assignments` |
| Can it start | `memo tasks status HRB-12 --json`, `list project:HRB ready:true` | `{ ready, blockers[{task, state}] }`; only `blocked-by` links block, cleared when the blocker is done | exists, one call per task; the list items carry no `ready` |
| Edit | `memo tasks update HRB-12 --title --description --priority --due <ISO\|2d\|none> --parent` | the card | exists. **No `--status`** |
| Close | `memo tasks close HRB-12 --as done\|dismissed --reason` | the card | exists |
| Reopen, "in progress" | — | — | **CLI work**: three fixed states, no reopen command. The store accepts `status: "open"` and has an unused `started_at` column |
| Assign | `memo tasks assign HRB-12 person:<id> --role assignee\|reviewer\|watcher` | the card | exists; only adds. **CLI work**: `tasks unassign` |
| People to assign | `memo search people <name>` | at most 100, needs a name | **CLI work**: no list of people for a picker |
| Projects | `memo projects list --json` | `key`, `name`, `kind` (project, inbox) | exists; the page leaves out `kind:inbox` |
| Dependencies | `memo tasks link HRB-15 HRB-14 --kind blocked-by`, `unlink --kind`, `links --json` | `{id, from, to, kind}` | exists (the README calls it `relations`; the command is `links`) |
| History | — | `task_events` holds who changed what, before and after | **CLI work**: recorded, but no command reads it |
| Order inside a column | — | — | **CLI work**: no rank field (NEED-2) |
| Lost edits | — | — | **CLI work**: last write wins. Reminders and notes already take `--revision`; tasks do not (NEED-4) |
| Create | `memo tasks add --project HRB --title … --priority --assignee person:<id>` | the card | exists |
| Delete | — | — | none; a `deleted_at` column is unused. The page offers Drop (dismiss), never delete |
| Agents working on it | `claimed_by`, `claimed_until` in the list | `claude-code:<session>`, `hermes` | exists; the Agents page already reads claims for messenger tasks (`src-tauri/src/tasks.rs`) |
| Reminders | `memo reminders …` | — | messenger tasks only; project tasks have none. Not on this page |

Project tasks have no rules on moving between states: closing a done task again succeeds, and so does editing a closed
one. `update` records an agent as the author when `CLAUDECODE` or `AI_AGENT` is set (`authorOf(env)`); the app already
removes those variables from every command it runs (`src-tauri/src/run.rs`, `AGENT_ENV`), so the page writes as the
owner. `add`, `close` and `assign` always record the owner, even for an agent (FIND-3).

## What the page shows and does

In the patch-rack world of [DESIGN.md](../../../DESIGN.md). Drawn with the app's own components in
[.impeccable/mocks/tasks/](../../../.impeccable/mocks/tasks/), from
[prototype/TasksPage.tsx](../../../.impeccable/mocks/tasks/prototype/TasksPage.tsx) (outside `src`, not built).

- **Title row.** "Tasks", one line on what this is, a link to Memo's
  [tasks guide](https://github.com/WireCatLabs/cli-memo/blob/main/docs/tasks.md); on the right Read again, the view
  switch (Table · Board, a text segmented control) and **New task** (outlined; no purple, per the One Purple Action
  Rule). The view is remembered per computer in `localStorage`, beside the theme.
- **Search.** The shared query bar from `src/features/query/QueryBar.tsx` (PR #34): mono text, coloured terms,
  suggestions of fields and values, the same quoting rule. The whole query goes to `memo tasks list <query> --json`;
  the app filters nothing itself. The prototype has a look-alike box, because #34 is not on `main` yet.
- **Pickers write into the query.** Project, Assignee, Priority, Due, Status (table only; on the board the columns are
  the statuses) and a "Can start now" switch. Each picker is a button that opens a box to type in over a list with
  checkboxes and counts, styled like `Select`. Choosing writes `project:HRB`, `assignee:"Ana Ruiz"`, `priority:0`,
  `due:overdue`, `state:done`, `ready:true` into the query; clearing removes them; typing the words does the same
  as clicking. A chosen picker shows its value on a purple wash. One component, promoted to `src/ui/Picker.tsx`; it
  also edits cells.
- **Table view.** One rack, a sticky header row, columns Status · Task (key, mono) · Title · Project · Assignee ·
  Priority · Due. Sort by clicking Status, Task, Priority or Due (`aria-sort`). Priority is a three-bar mark with a word
  (Urgent, High, Normal, Low, Someday), red and amber only for 0 and 1. Due is a mono date, amber within three days,
  red with "late" when past. Under the title, quiet markers: "waits for HRB-14" (amber lock) and "claude-code is on
  it" (busy lamp) from the claim.
  - **Inline editing.** Status, Project, Assignee, Priority and Due are picker cells: they look like text, take a
    `app-3` wash on hover, and open the one-choice picker (Due offers Today, Tomorrow, Monday, In a week, No date, and a
    date field). The title row opens the task in place (`Collapse`): title and notes to edit with Save and Cancel; on
    the right "Depends on" with each blocker's lamp and "Add a task it waits for"; then History.
- **Board view.** Four columns side by side, each a rack frame with its lamp, name and count: **To do · Doing · Done ·
  Dropped**. Done and Dropped show the last 14 days. A card is a row in its column (hairline between, no shadow): key,
  priority mark, title (three lines at most), markers, assignee, due, and a "Move to…" picker. At the 960 minimum the
  four columns fit at 12rem each; below that the board scrolls sideways, never the page.
  - **Drag.** Pointer events, not HTML5 drag (RISK-1). A press becomes a drag only after 6 px, so text on a card still
    selects. The card leaves a dashed placeholder, a copy follows the pointer with the panel shadow (lifted out of a
    group, DESIGN.md's one use of depth) and a 1° tilt; the column under it takes a purple frame and a 2 px purple line
    shows where it lands. Escape puts it back. Dropping in another column changes the status: To do and Doing through
    `tasks update --status` (CLI work), Done and Dropped through `tasks close --as`.
  - **Keyboard.** Every card is focusable. Space lifts it (purple outline, panel shadow), ←/→ carry it between columns,
    ↑/↓ within one, Space or Enter drops, Escape puts it back. An `aria-live` line says each step: "Picked up HRB-14…",
    "Doing, place 2 of 4", "Dropped HRB-14 in Doing". The "Move to…" picker does the same without dragging.
  - **Reduced motion.** No tilt, no slide; the card appears in its new place at once. The placeholder and drop line
    stay, because they carry meaning.
- **Rule 9.**
  - A dropped card stays exactly where it was dropped (NEED-2 decides whether Memo remembers that place).
  - An edited table row stays in its place even when the new value would sort it elsewhere; the order is fixed when the
    owner sorts, not when a value changes.
  - A row edited out of the filter (Status set to Done under `state:open`) stays, with its new lamp, until the owner
    changes the query or reads again. Counts update at once.
  - Pickers open as popovers over the page and do not shift it. The details panel opens with `Collapse`.
- **New task** opens an empty row at the top of the table (or of To do on the board) with Title, Project (required
  by Memo), Priority, Assignee and Due; Enter saves through `memo tasks add`. Not drawn in this round.
- **Not in the first version.** Bulk changes (select rows, change all), subtasks shown as a tree, tags (Memo has them
  but shows them nowhere), messenger tasks (NEED-3), proposed actions (NEED-5).

| Screen | Light | Dark |
| --- | --- | --- |
| Table, one task open, 1280×840 | `table-light.png` | `table-dark.png` |
| Board | `board-light.png` | `board-dark.png` |
| Dragging HRB-14 into Doing | `drag-light.png` | — |
| Keyboard move: OPS-3 lifted into Doing | — | `keyboard-move-dark.png` |
| Project picker with one chosen | `picker-light.png` | `picker-dark.png` (board) |
| Editing a cell (Assignee) | `edit-cell-light.png` | — |
| The 960×640 minimum | `narrow-table-light.png` | `narrow-board-dark.png` |
| Empty · no match · Memo missing · too old · read failed · write failed · changed elsewhere | `state-empty-light.png`, `state-nomatch-light.png`, `state-missing-light.png`, `state-old-light.png`, `state-error-light.png`, `state-write-fail-light.png`, `state-conflict-light.png` | `state-missing-dark.png` |

## Privacy

- **Rule 4.** Task titles, notes and people's names are the owner's own data on the owner's own page, shown unmasked
  as on the Search and Memory pages. They never go into a log, a bug report or a crash report: Rust returns them to
  the page only, and `ReportThis` here sends the error reason, never the text.
- **`--no-record` on every call.** A failed `tasks update --description …` would otherwise keep the notes in Memo's run
  log.
- **Rule 3.** Project tasks have no profile; Memo has one store. Messenger tasks belong to a profile and are left out
  of the first version (NEED-3).
- **Rule 2.** Each action is a `#[tauri::command]` taking validated values: a task key (`^[A-Z0-9]{2,4}-\d+$`, the same
  plain-word check as `validate_task` in `src-tauri/src/tasks.rs`), a status from the fixed set, a priority 0–4, a date
  `YYYY-MM-DD` or none, a `person:<id>`, a project key, a title (1–500 characters, no control characters) and notes (at
  most 20,000, Memo's limit). The query is passed as one argument after `--`, never through a shell. Rust maps each to
  a fixed `memo tasks …` line.
- **Rule 5.** Nothing is deleted. Drop closes a task as dismissed and keeps it.

## States

| State | What the owner sees |
| --- | --- |
| Memo not installed | A quiet panel: tasks are kept by Memo; "Go to Tools". No filters, no rack. |
| Memo too old | The installed Memo lacks a command the page needs (`--status`, the new list fields). "Update Memo" is the one primary button. No read-only fallback in the first version. |
| Loading | Five skeleton rows (table) or skeleton cards in four column frames (board); the filters stay put. |
| Empty | "No tasks yet", with an example of asking an agent, and New task. |
| No match | One line in the rack: nothing matches; which filter hides open work; Clear. |
| Read failed | `ErrorNotice` with Memo's reason (`store.busy`) and Try again. |
| A write failed | The cell or card keeps its old value and a one-line error under the row names Memo's reason. A dragged card returns to its column with the same animation as Escape. |
| Changed elsewhere | An agent edited the task after the page read it: Memo refuses the stale write (NEED-4), the page says who changed what and offers Read again. |
| A blocker is done | "waits for" disappears on the next read; Memo works this out, the page does not. |

## Mock scenarios for the browser build

`?view=table|kanban`, and `?tasks=` with: `none` (empty), `nomatch`, `missing`, `old`, `fail` (read failed), `write-fail`
(every edit and drop fails), `conflict` (HRB-12 changed by hermes), `many` (400 tasks in 6 projects, for scrolling,
counts and the 500 cap), `blocked` (a chain of three). The default has nine tasks in three projects (Harbour launch,
Operations, Home), made-up people only (Kai Sample, Ana Ruiz), and two agents' claims. The prototype names the empty
state `empty` and the read failure `error`; the real mock uses the names above, matching the other pages.

## Build steps

Rule 1: the CLI work goes first, in cli-memo and cli-core, and the app waits for its release.

| # | Step | Where | Estimate |
| --- | --- | --- | --- |
| 1 | States: `in_progress` beside open, done, dismissed; `tasks update --status open\|in_progress` (reopen included, sets `started_at`); contract tests | cli-core store + cli-memo | 0.5–1 day |
| 2 | List query: `assignee:`, `priority:` (with ranges), `due:` (ranges, `overdue`, `none`), free text over `task_words`, OR within one field, all projects when `project:` is absent, `--sort`, a cursor past 500 | cli-memo `list.ts`, cli-core `work-tasks.ts` | 1.5 days |
| 3 | List items carry `assignments`, `ready` and `blocked_by`; the list and `show` use the same names (`status`/`state`, `type`/`kind`) | cli-memo | 0.5 day |
| 4 | `tasks unassign`; `--revision` on `update`, `close`, `assign`, `unassign`, the way reminders and notes have it; `tasks history <key> --json` over `task_events` | cli-memo + cli-core | 1 day |
| 5 | Order in a column: a `rank` and `tasks move <key> --status <s> --before\|--after <key>` (only if NEED-2 is A) | cli-core + cli-memo | 0.5–1 day |
| 6 | `memo people list --json` (id, name), for the assignee picker | cli-memo | 2–3 h |
| 7 | Fix: `update --parent none`, the author on `add`/`close`/`assign`, `has_more` at the 500 cap; README `relations` → `links` | cli-memo | 2–3 h |
| 8 | Release memo; record the minimum version in the catalog | cli-memo release, `catalog/tools.json` | 1 h |
| 9 | Rust: `task_list`, `task_show`, `task_create`, `task_update`, `task_move`, `task_assign`, `task_link`, `people_list`, `project_list`; validation; `--no-record`; tests with a fake `memo`. A new `src-tauri/src/task_board.rs`, since `tasks.rs` already holds the Agents page's claims | `src-tauri/src/` | 1 day |
| 10 | Platform bridge, valibot schemas, mock platform with the scenarios above | `src/platform/` | 0.5 day |
| 11 | `Picker` (searchable, one or many) in `src/ui/`, with tests; then the Memory page uses it too | `src/ui/` | 0.5 day |
| 12 | Page: table, board, pointer and keyboard drag, inline editing, details, New task, every state; messages in en, ru, es | `src/features/tasks/` | 2.5–3 days |
| 13 | Search: the shared `QueryBar` with Memo's task fields from `memo commands info tasks.list --json` | after PR #34 merges | 0.5 day |
| 14 | Checks: tests, both themes and 960 width with the capture script, rule 9 (`scripts/scroll-hold.mjs` extended to a drop and a cell edit), keyboard, reduced motion, `pnpm check` | — | 0.5 day |

About 11 working days in all, about 5 of them in cli-memo and cli-core. Without step 5 (NEED-2 B), about 10.

## Open questions for the owner

- **NEED-1 · Which columns should the board have?** A memo gains `in_progress` and a reopen: To do · Doing · Done ·
  Dropped, the same for every project (drawn) · B memo keeps a set of columns per project, which the owner edits · C
  Memo as it is: To do · Done · Dropped, no way back from Done. I recommend **A**: a board without "Doing" is a to-do
  list with extra steps, and per-project columns can come later without breaking A.
- **NEED-2 · Should a card stay where it is dropped inside a column?** A Memo keeps a rank, so the order survives a
  reload and agents see it (drawn) · B the column is sorted by priority, then due date; a drop changes the status only,
  and the card slides to its sorted place. I recommend **A**: dragging a card to the top is how people say "this
  next", and B moves a card somewhere the owner did not put it. B is a day cheaper if the order does not matter.
- **NEED-3 · Should tasks made from messages (per Telegram or MAX profile) appear here too?** A project tasks only in
  the first version · B both, with a profile picker that never chooses for the owner (rule 3). I recommend **A**:
  messenger tasks have their own reminders and claims and live on the Agents page today; mixing two kinds of task in
  one board needs a design of its own.
- **NEED-4 · Should Memo refuse an edit made on a stale copy?** A `--revision` on every task write, the page shows
  "changed elsewhere" (drawn as `state-conflict`) · B last write wins. I recommend **A**: agents edit the same tasks,
  and an inline edit could silently undo an agent's change, or the other way round.
- **NEED-5 · Should agents' proposed actions (`memo actions`) wait on this page?** The Memory plan (NEED-170 there)
  points them here. A not in the first version; an approved action becomes a task and appears like any other · B a
  "Proposed" column before To do. I recommend **A**: approving an action can send a message, which is not a task's
  life cycle, and the Memory page already has a place for review.
- **NEED-6 · Can a task be assigned to an agent?** A no, Memo assigns people; an agent shows as "hermes is on it" from
  its claim (drawn) · B Memo accepts an agent as an assignee. I recommend **A**: a claim expires when the agent stops,
  an assignment would not, and the page would show work nobody is doing.
- **NEED-7 · How should "Doing" look?** A a steady purple lamp, a sixth tone in DESIGN.md (drawn) · B the pulsing busy
  lamp. I recommend **A**: a page of pulsing rows is noise; the pulse stays for an agent working right now.

## Found on the way

- **FIND-1 · Two "tasks" in the app.** `src-tauri/src/tasks.rs` and the catalog's `tasks` entries already read agents'
  claims on messenger tasks for the Agents page. The board's Rust module gets its own name (`task_board.rs`).
- **FIND-2 · The list and the card disagree on names**: `state`/`kind` in `tasks list`, `status`/`type` in `tasks show`.
  The schemas map both until step 3.
- **FIND-3 · The author is recorded unevenly** (cli-memo `src/tasks/tasks.ts`): `update` records an agent when
  `CLAUDECODE` or `AI_AGENT` is set, `add`, `close` and `assign` always record the owner. History would credit the
  owner for an agent's close.
- **FIND-4 · `update --parent none` fails** with "no task none": the check looks for `null`, the shared option gives
  the word `none` (`command.ts:113`). A subtask can never be detached.
- **FIND-5 · Tasks have no MCP tools.** Agents reach tasks only through the CLI skill; an agent on Memo's MCP server
  alone cannot read or move them.
- **RISK-1 · HTML5 drag and drop in the webview.** I think Tauri's window option `dragDropEnabled` (on by default)
  intercepts drags for file drops, and on Windows that stops HTML5 drag events reaching the page (not checked in this
  repository). Pointer events avoid the question, work the same in WebKitGTK, WebKit and WebView2, and give the
  keyboard path the same code.
- **RISK-2 · `has_more` can be wrong at the 500 cap** (read from `list.ts:148-152` and `work-tasks.ts:454`, not run):
  the list asks for `limit+1` rows but the store returns at most 500.

<!-- cspell:words hermes -->
