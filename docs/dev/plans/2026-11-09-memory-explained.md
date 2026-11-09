# Memory that explains itself (UX-125)

Owner, 2026-11-09, after opening Memory on real data: "память — непонятно, что это и как с этим работать". This is a
proposal. Nothing here is built yet.

## What he saw

168 rows under "На проверку". Each one was a Google Drive document, "Связан с: Miloslava 2", the role "Владелец", the
status "Предложено", and under "Зачем" the raw JSON of a Drive revision. No agent proposed any of them. drive-cli
recorded the owner of each document, and the store showed those links as proposals (BUG-659). The fix is in cli-core:
a link that a source reports now gets the standing `reported`. This page also leaves out a document's reported owner
and never shows raw JSON as a reason.

The bug made the page look worse than it is, but it also shows three gaps that remain after the fix:

1. The page never says what a row is asking of him, or what each button changes.
2. A fact that a source reports, such as a CRM's or Drive's, shows as "Подтверждено" (confirmed). The owner never
   confirmed it (`relationship()` in `src-tauri/src/memory.rs` maps every standing other than proposed and ended to
   `confirmed`).
3. A bulk arrival (one source or one agent, many rows in one run) floods the review list one row at a time.

## Proposal

**UX-125.a · Say what review means, at the point of decision.** Under the tabs, one line per tab, in place of the
long intro paragraph:

- На проверку: "Agents suggested these. Until you approve, agents see each one marked as not yet approved."
- В работе: "What agents use as true: what you approved, and what your connected sources report."
- Отклонено: "What you rejected. Agents do not suggest it again."

Each button gets a tooltip that names its effect: Approve → "agents use it as true"; Reject → "hidden, and not
suggested again"; Edit → "your wording replaces the agent's". Before the copy ships, check each claim against Memo:
that a rejected relationship is never written again is cli-core's `syncReported` rule, and a memory may differ.

**UX-125.b · Rows read as sentences, not as fields.** A relationship becomes "Miloslava 2 is the owner of «Скрипт
собеседования Ruby Engineer»", with the role from the owner's role list in the sentence, in place of "Связан с" and a
role chip. "Зачем" shows words only. A row without a readable reason says "No reason given" and links its source.

**UX-125.c · Keep the source's facts apart from the owner's.** A new state, "From <source>" (Google Drive, Bitrix24),
with its own lamp, in place of "Подтверждено". A source's fact sits in В работе behind an "Only mine / With sources"
switch, which defaults to Only mine. A document's owner and editor stay on the document (Desktop already leaves them
out); a CRM's links stay, labelled.

**UX-125.d · Group a bulk arrival.** When more than 10 rows to review share an author (an agent or a source) and a
day, they fold into one card: "claude-code suggested 24 links between people and projects, 2 Nov". The card offers
Review, Approve all and Reject all. Approve all is the existing "approve shown" action, scoped to the group.

**UX-125.e · Empty and first-run states, one per cause.**

- Memo is missing: the existing install prompt.
- Memo is installed, nothing is stored yet: what memory is, in two sentences. One example row, drawn as an example.
  "Connect an agent", which opens the Agents page.
- Nothing to review: "Nothing waits for you", plus the date of the last decision and a link to В работе.
- A read failed: the error with Report, as now.

**UX-125.f · Layout from the shared table, not a new one.** The rack, the tabs and the pager move onto the shared
table, pager and segmented control that the table work (D-1 + D-2, branch `refactor/shared-table-clients-speed`)
puts into `src/ui/` (`DataTable`, `Pager`, `Segmented`). This work starts after that branch merges, and it adds
nothing to those files that the Clients and Tasks pages do not need too.

## What Memo must give the page

- `standing` and the reporting account on every relationship row. Both exist today (`relationships list`: `standing`,
  `account_id`).
- A readable reason, or none. BUG-659 changes drive-cli to write words. Desktop drops any JSON reason as a guard.
- For UX-125.d, the author of a source's fact. `account_id` gives it for a relationship. Memories and facts carry
  `author`.

## Open decisions

- **UX-125.c:** should a source's facts show in Memory at all, or only on the person's and the document's pages? The
  proposal shows them, labelled, behind a switch that is off by default.
- **UX-125.d:** is the group threshold of 10 rows per author per day right?
