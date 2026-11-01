# Memory page: three versions

Owner, 2026-11-01, after using the page on his real data: "we need to considerable rethink how we display memory…
build 3 versions of Memory page, 1 is current improvement and 3 - completely rethought". Journal: TASK-48, UX-26 to
UX-31. The first plan is [2026-10-31-memory-page.md](2026-10-31-memory-page.md).

**Outcome (NEED-197 = B):** the owner picked version 2, with changes (UX-32 to UX-37, below). Versions 1 and 3 and
the `?memory-version` switch are gone from `src`; this note and their screenshots stay as the record. The three ran
side by side in the browser build behind `?memory-version=1|2|3`.
Screenshots, light and dark: [.impeccable/mocks/memory/v2/](../../../.impeccable/mocks/memory/v2/).

## What the owner hit, and where each version answers it

| Problem | Version 1 | Version 2 | Version 3 |
| --- | --- | --- | --- |
| UX-26 which project or person a row is about | First thing on every row: icon and name | The group heading | The subject is the page |
| UX-27 long text cut and never shown whole | One line collapsed, whole when opened | Same row as 1 | Whole text, always |
| UX-28 the "evidence findings" action was empty | Each finding with a tick, its reason and what it cites | Same row as 1 | Same, inline in the inbox |
| UX-29 the author too prominent | Only in the opened row | Same as 1 | A folded detail line |
| UX-30 the second focus rectangle in About | Fixed in `Combobox`, shared by all three | ← | ← |
| UX-31 Edit far from the text | Click the opened text, or the pencil beside it | Same as 1 | Pencil beside the text |

## The empty action was a data problem first

memo stages an agent's cited facts and tasks about one project as an action of kind `evidence_findings`
(cli-core `src/store/evidence-findings.ts`). Checked against memo 0.130.0 with a throwaway store:

- `memo actions list --json` carries the whole batch in `payload.findings[]`: each finding's `id`, `kind` (fact or
  task), `statement` or `title`, `reason`, `commitment` and cited `evidence[].reference`. The target is
  `project:<id>`. The page read only `payload.text` or `payload.title`, so the row was empty.
- `memo actions confirm` and `actions reject` refuse this kind (`evidence-findings.dedicated-review`). Approve and
  Discard on that row would have failed. It is decided with `memo projects actions confirm <project> <id>
  [finding ids…] --fingerprint <hash>` or `… reject <project> <id> --fingerprint <hash>`; the fingerprint comes from
  `memo projects actions list <project> --brief`.
- Rejecting every finding closes the batch with status `approved` and `result.accepted: []`.

What changed (shared by all versions): Rust reads the findings and the project; Approve sends only the ticked
finding ids, Discard rejects all; a batch closed with nothing accepted reads as rejected. Project names come from one
more call, `memo projects list`, in parallel with the others. The fingerprint lookup pages through
`projects actions list` (10 a page by default), so an older batch is still found.

The probe batch was written into the throwaway store by hand, following `stage()`'s payload shape, not through
`projects actions add` (that needs real cited messages). `projects actions reject` ran on it and closed it as
described; `projects actions confirm` refused it as stale, because its hand-made snapshot does not match. So the
confirm path is tested against a fake memo only.

### What memo is missing

1. **`project_name`** beside `project` on facts and on findings batches (as `subject_name` sits beside `subject`).
   Without it the app makes one extra call per read.
2. **Memories have no project.** A memory can name a project only as its `--subject`.
3. **`actions list` and `actions show` do not give the fingerprint** a batch is decided with, so the app makes two
   calls per decision (`actions show`, then `projects actions list`).
4. **Rejecting a whole batch reports `approved`.** The status should say rejected.
5. **Any other action keeps its content in a payload the page cannot know.** memo has no human-readable summary of
   an action (for example `payload_summary`); the page shows "Memo gives nothing else about this action" when there
   is no `text` or `title`.
6. **The excerpts a reviewer needs for findings** come only from `projects actions list` without `--brief`, one call
   per project. The opened batch shows the cited refs, not their text.

## Version 1: the current page, improved

The dated ledger stays: one rack, day headings, a lamp and one action per row.

- The row opens with what it is about (folder icon for a project, person icon for a person, "You"), then the kind.
  The author left the collapsed row.
- Collapsed text is one line. Opened, the same text shows whole where it stood (`AutoHeight`), and it becomes the
  place to correct it. A click on the text or on the pencil beside it turns it into a field of the same size; Enter
  saves, Escape puts it back, and focus returns to the row.
- A findings batch reads "2 facts and 2 tasks to review". Opened, it lists each finding with a tick, Fact or Task,
  the task's reason and the refs it cites. The note under it says what Approve creates in which project. After
  review the title says "Findings: 3 created, 1 rejected" and each finding has its own lamp.
- The detail column lists Project or About, Written by, Saved, Kind and State; Discard and Forget… stay there.

Cost: built, production quality. `MemoryPage.test.tsx` covers the subject line, the inline correction and the
findings; Rust tests cover the findings read, the rejected-batch status and the decide command line.

## Version 2: the same rack, cut by subject

Groups replace days. Each group is headed by its project or person with "2 waiting · 5 in all"; groups with
something waiting come first, then the most recently touched; "Not about anyone in particular" goes last. A heading
folds its group. Rows are version 1's rows with the day in place of the subject.

It answers "what does this relate to" with structure instead of a label, and it shows when one agent run filled one
project. It loses the "what happened today" reading, and a person and a project they belong to are two groups.

Cost: about 80 lines on top of version 1. Prototype grade: the fold is not remembered, and the About filter repeats
what the groups already show.

## Version 3: rethought around the subject

Today the page holds memories, facts, actions to approve and what agents did. Next come people and organizations,
projects, tasks from memo, notes, meeting findings, reminders, links into Search and live updates (the events
system, cli-core #2274). A feed or a ledger gets one more record type per release until it is a junk drawer. A
subject does not: each new kind is one more section on a person's or project's page and one more count in the
directory.

Three views on one surface (`src/features/memory/v3/`):

- **Inbox.** Everything waiting, grouped by agent run (one author within 30 minutes): "codex-nbb-evaluation proposed
  4 findings and 1 fact for Northbridge Bench · 01:12". The run is how the work arrives, so it is how it is
  reviewed. Keys: j/k to move, a to approve, e to correct, d to discard.
- **People & projects.** A directory: lamp, name, kind, "2 waiting · 5 kept", last touched. A row opens the
  subject's page in place: what waits, what memo knows by kind (decisions, promises, preferences, summaries), tasks
  created from findings, who wrote about it, and a link to search their messages.
- **Timeline.** Records and agents' calls by day. A "Live" lamp marks where pushed events land; `&live=1` slides a
  made-up event in after 6 seconds.

DESIGN.md rules it bends: none of the rack rules. It adds a second level of navigation inside one section (views,
then a subject page), which DESIGN.md does not cover.

Cost to make it real: high. It needs memo to list people and projects with counts (no list of people exists today;
the directory here is built from `subject_name`), a task list per project, and the events system for Live. Prototype
grade: no tests, Russian and Spanish reuse the English strings, the Search link does nothing, Forget is not reachable
from its rows.

## Recommendation

**Ship version 1 now; build toward version 3's subject page next, entering it from version 1.**

Version 1 answers all six complaints with the page model the owner already knows, and the data fixes under it
(findings, project names, the decide commands) are needed by every version anyway. Version 2 is a cheap
re-arrangement, but it only moves the subject from a label to a heading. Version 3 is the model that can absorb
people, tasks, notes and live events. It needs memo work first (gaps 1, 2 and a people list), so it should grow
in steps: make the subject name in a version 1 row a link to that subject's page, and let the page grow sections
as memo gains them.

## Not verified

- Approving a real findings batch end to end: memo refused the hand-made batch as stale, so only the command line is
  tested.
- `memo projects list` with many projects: with 3 it returned all 3 (`limit: 3`, `has_more: false`); it takes no
  `--limit`, and a store with hundreds was not tried.
- The real app (Tauri, WebKitGTK); all screenshots come from Chrome against the mock.
- Motion with animations on: every capture runs with reduced motion. Of version 3, only the inbox was checked at
  960 px.

## What shipped: version 2 with the owner's changes

Screenshots: `final-*` in [.impeccable/mocks/memory/v2/](../../../.impeccable/mocks/memory/v2/).

- **One word per meaning (UX-33).** Approve: anything waiting. Reject: anything waiting, or something in use that
  proved wrong (keeps a trail). Correct: replace the text (keeps a trail). Erase…: delete for good. The tab is
  Rejected. memo's own verbs underneath are unchanged (`confirm`, `invalidate`, `reject`, `reverse`, `remove`).
- **Row actions without opening (UX-34).** A waiting row shows Reject and a split button: Approve, and an arrow to
  the rest (Approve some… for findings, Correct, Erase…). Approve on a closed findings row creates all of them; an
  opened row creates the ticked ones. A row in use leads with Correct; its menu has Reject and Erase…. The menu is
  `src/ui/SplitButton.tsx` (WAI-ARIA menu button; it floats in a fixed layer placed by `popup-list.ts`, so the row
  never moves). Reject stays visible beside it: at 960 px the row still has room.
- **No time column (UX-35).** The row's label reads "Decision · Today 01:02".
- **More details, each a filter (UX-32).** The opened row lists project, about, kind, scope, author, model,
  confidence, saved, changed, source count, target, account, what it corrects and state. Project, about, kind, author
  and the saved day are links that set that filter. New filters: Project, Kind and Saved (any time, today, 7 days,
  30 days, or a day picked from a record).
- **Sources open in place (UX-36).** A source, or a ref a finding cites, unfolds what memo reads back:
  - `msg:` (messengers and mail): `memo messages show <ref> --before-n 3 --after-n 3`, the cited one marked;
  - `note:` and `document:`: `memo notes show <ref>`, with Open file when memo keeps the note as a file. Rust finds
    the file again from the ref and memo's `folders list`, opens it only inside memo's folders, with the opener
    plugin;
  - anything else says memo cannot show it yet.
- **Logs link (UX-37).** "All activity in Logs" opens Logs with
  `tool:memo command:"memories *" command:"facts *" command:"actions *" command:"projects actions *"` (one field
  repeated is OR in the Logs query), over all time.

### What memo cannot serve for opening sources

- **`meeting:<id>`**: memo has no command that shows a whole meeting. `memo meetings passage` reads around a
  transcript *cue* ref, which a memory's evidence does not carry.
- **`person:`, `chat:`, `task:` and other refs** a record may cite: no show command for them in this flow.
- **A message's neighbours are the nearest stored ones**, not necessarily the next sent (cli-core `around()`).
- **Notes stored inside memo (`source: internal`)** have no file to open.
- The messenger CLIs (`tg`, `max`, `wa`) were not needed: memo reads the same store.

### Not verified

- `messages show` and `notes show` against real stored messages and notes: their JSON was read from cli-memo and
  cli-core sources (`senderName` / `sender_name`, `timestamp`, `anchor`; note `source`, `path`, `folder_id`), and
  Rust accepts either spelling. The probe store holds no messages.
- Whether memo's MCP calls appear in Logs under these commands; the query matches CLI runs (`memo memories add` and
  the like).
