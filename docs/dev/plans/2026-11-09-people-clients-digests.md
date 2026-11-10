# People, Clients and Digests: tables, real people, duplicates

Status: **plan** (2026-11-09). Nothing is built. Journal:
[2026-11-09-people-clients-digests](../../journal/2026-11-09-people-clients-digests.md) (TASK-151).

**Desktop is not released for this work (owner's ruling).** Each Desktop PR merges to `main`; nobody runs
`bin/tag-release` until the owner says so. Desktop has tagged v0.5.0 before, so a release is one command away; the
pages that need a newer memo stay behind the existing "Memo too old" state until that memo is out.

## The owner's feedback

Translated from Russian, kept close to his words.

1. **People**: 5000 accordion rows, names like `!`, `!$`, `"CZECH AIRLINES "`, `OpenWeather Team` twice. "Must be a
   table like Tasks", with the usual page layout, filters and pages. A junk name shows cleaned: no wrapping quotes or
   spaces, and a name with no letter or digit falls back to the username, phone or email.
2. **Hide "background" people by default, in Desktop and in the CLI.** A person is real when they have a tie to the
   owner: a 1:1 chat, mail exchange, a meeting, a CRM record, a phone-book contact, or a shared group of at most 10
   members. Everyone else (seen only as an author in bigger groups) is hidden, and found with "Show all" in Desktop
   and `--all` in the CLI.
3. **Add person**: while typing, search existing people and likely duplicates, before creating.
4. **Duplicates**: find people who look the same, let the owner view and merge them, simply. Candidates have the same
   cleaned name (case, quotes and word order ignored) **and** a shared trace: a common chat, email, email domain
   (company) or phone. The owner decides every merge.
5. **Clients**: "opens very slowly and has no records". Replace the board with a table and a kanban by stage, like
   Tasks. An import button: a dropdown of configured CRMs, a plain button when there is one. An empty page explains
   and offers the import.
6. **Digests**: "nothing is clear". The usual layout: a list of digests with filters, time and schedule. Opening one
   shows its settings (prompt, template, schedule) and the preview, which stays. With no digests, offer a daily and a
   weekly one at once, through short forms in a dialog.

## What exists today

Read from `origin/main` of the three repositories on 2026-11-09: wirecat-desktop 14403716, cli-core (cli-messaging)
22b932cd9, cli-memo 3c43f44. No store was opened and no CLI was run against an account.

### People

- Desktop reads `memo people list --limit 5000` and `memo people review --limit 500` in parallel
  (`src-tauri/src/people.rs:14-15,184-185`), keeps all 5000 in the page and filters them in JavaScript; it draws the
  first 200 as accordion rows (`src/features/people/PeoplePage.tsx:22,136`). A row opens the person's identities,
  merges and matches (`PersonRow.tsx`), with Split and Undo merge dialogs.
- `memo people list` (cli-memo `src/people/command.ts:96-120`) returns `{ref, name, owner, tasks}` only: no username,
  phone or email, no paging past 5000. Its query is `TASK_PEOPLE` (cli-core `src/store/sqlite/task-board.ts:284-291`):
  every unmerged person, owner first, then by task count, then name. **Nothing filters real from background people.**
- A person's name is the first identity's name copied raw (cli-core `src/store/sqlite/identities.ts:137`), which is
  how `"CZECH AIRLINES "` arrives. Only a comparison fold exists (`foldName`, `src/resolve.ts:22`; `identities.name_folded`).
- Each identity starts as its own person (`ensurePerson`, `identities.ts:131-162`), so "OpenWeather Team" twice is two
  identities nobody joined.

### Signals for a tie (FIND-267)

None is stored as a flag. Where each one lives:

| Tie | Table | Index today |
| --- | --- | --- |
| 1:1 chat | `chats.kind = 'dialog'` + `chat_members` | `chat_members_by_identity_id` |
| Group of ≤ 10 | `chats.participants_count`, `member_counts.listed_count` | **none** on `chats.kind` or the count |
| Mail exchange | `emails.from_identity_id`, `emails.outgoing`, `email_recipients.identity_id` | `emails_by_from_identity_id`, `email_recipients_by_identity_id` |
| Meeting | `meeting_participants`, `calendar_entry_participants` | `*_by_identity_id` |
| CRM record | `records.entity_type = 'person'`, `entity_id` | `records_by_entity_type_entity_id` |
| Phone book | **no marker**: `contacts sync` saves the address book as ordinary identities (`src/services/people.ts:226-247` → `savePeople`) | — |

The phone-book tie therefore needs a marker written by `contacts sync` (a migration). cli-core's per-account
`contacts` list already means "shares a dialog with this account" (`identities.ts:308-374`), so every row there is
real by definition and it needs no filter.

### Duplicates

cli-core proposes identity links as `proposed_actions` rows of kind `identity_link` (`src/store/identity-links.ts`),
with signals `agent`, `phone`, `email`, `guest-email` (`src/store/sqlite/person-match-scan.ts`). `mergePerson`
(`person-links.ts:208`), undo merge and split (`person-merges.ts:79,111,140`), `ROLE_ADDRESS_WORDS` and
`isRoleAddress` (`src/domain/addresses.ts:8,67`) and the free-mail list `FREE_MAIL` (`src/mail/score.ts:62`) all
exist. memo exposes them as `people review|scan|link|unlink|unmerge` and `review confirm|reject`; Desktop already
shows proposals as `MatchCard` and decides them. **There is no name-based rule and no shared-chat rule.** The
scorers in `src/services/link-scorers/` (email domain, chat members, mail threads…) look similar but feed
`relationships scan`: they propose `related-to` and `member-of` links between different people, never a merge.

`memo people add <name>` creates a person; `memo search people` reads every identity of every account in JavaScript
per call (cli-memo `src/search/people.ts:46-95`), too slow for typing (PERF-6).

### Clients: why it is slow, and why it can be empty

The page makes one Tauri call, `clients_read` (`src/features/clients/api.ts:23-29`). In Rust
(`src-tauri/src/crm_board.rs:436`):

- `gate()` checks memo's version twice (cached for 10 minutes after the first look).
- With base stages (memo ≥ the catalog's `baseStagesMinVersion`) `read_base_with` (`:407`) starts **six memo
  processes one after another**: `pipelines list`, `stages show`, `stages list`, then `deals list` for `open` (up to
  500), `won` (20) and `lost` (20) (`:369-378`). Without base stages it is five. Each is a new Node process that opens
  the store, with a one-minute timeout.
- A CRM's CLI version is checked once per provider (`crm_board/writer.rs:57`).
- The React Query has no `staleTime` (`src/shared/query.ts:9`), so every visit waits for all six again behind a
  skeleton.

That is PERF-5. I did not time it: `src-tauri/src/page_loads.rs` replays other pages' calls and prints milliseconds,
and the first Clients PR adds a Clients case to it so the owner can measure on his machine. The six calls do not
depend on each other in the base mode, so running them at once (as `people.rs:183-186` already does) should cut the
wait to about the slowest one; I expect, not measured.

"No records" has several possible causes in the code (FIND-268), not checked against the owner's store:

1. memo has no pipeline of that kind yet: no CRM was synced. The page shows "No deals yet" (`messages.tsx:95`).
2. A CRM account's sync scope defaults to `mine`, so a sync brings only the owner's own deals (`writer.rs:160-174`).
3. The page opens on deals; the records may be leads.

The empty state below names all three, and the import button fixes the first.

The kanban is already shared: `src/ui/Board.tsx` serves `TaskBoard`, `ClientsBoard`, `BaseBoard`, `StageMap` and
`GroupsSetting`. "Replace the board" therefore means a table view beside the board, not a second kanban.

### CRM import

Importing from a CRM is that CRM tool's per-profile **sync** (Bitrix24: `catalog/tools.json:2132-2167`). The Tools
page runs it through `useSync.start(tool, profile)` (`src/features/tools/sync-store.ts:116`); Clients already calls
it (`clients/api.ts:122`). CRM tools are the catalog entries with a `crm` block (`crmToolOf`,
`src/domain/catalog.ts:348`); their profiles come from `useProfiles` (`tools/api.ts:14`).

### Digests

There is exactly one digest, hard-coded: schedule `morning-digest`, prompt "Run memo skill show morning-digest and
follow it." (`src-tauri/src/digest_schedule.rs:17-19`), template `report/morning-digest`
(`digest_editors.rs:14`), runs read from `schedules/morning-digest/runs` (`digests.rs`). The page stacks the
schedule, the brief, the templates and a list of days (`DigestsPage.tsx:65-69,111`). cli-core's `schedule` knows
`--every`, `--at HH:MM` (daily) and `--at-time` (once), but **no weekday** (`src/cli/schedule/schedule-command.ts:129-131`),
so a weekly digest at "Monday 09:00" cannot be made today (FIND-269).

### Shared parts the new pages lean on

| Need | Exists | Plan |
| --- | --- | --- |
| Table | `TaskTable.tsx`, tasks-only (rack, sticky header, sort header, sideways scroll) | extract `src/ui/DataTable.tsx`; Tasks, People and Clients use it (the rule of two in `docs/dev/guides/reuse.md`) |
| Pages of results | `SearchPage.tsx:440-460`, its own Previous/Next | extract `src/ui/Pager.tsx`; Search, People use it |
| Table · Board switch | `ViewSwitch` local to `TasksPage.tsx:211` | move to `src/ui/ViewSwitch.tsx` |
| Kanban | `src/ui/Board.tsx` | as is |
| Filters | `src/ui/FilterBar.tsx`, `FilterMenu`, `ToggleChip` | as is |
| Dialog forms | `src/ui/Dialog.tsx` | as is |
| Button with a menu | `src/ui/SplitButton.tsx` | the import dropdown |
| Page header | repeated by hand in 14 pages (DEBT-62) | not in this plan; new pages copy the Tasks header |

## Decisions in the CLI (rule 1: the CLIs stay first)

### One cleaned name, one key

cli-core gains two pure functions in `src/domain/person-names.ts`, used by the list, the duplicates rule and the
typeahead, so the three never disagree:

- `displayName(name, fallbacks)`: trims, removes wrapping quotes (`"…"`, `«…»`, `'…'`) and repeated spaces; a name
  with no letter or digit (`!`, `!$`) gives way to the username, then the phone, then the email.
- `nameKey(name)`: `displayName`, then `foldName`, punctuation removed, words sorted. `"Ivanov Ivan"` and
  `ivan IVANOV` give one key.

The stored `persons.name` never changes: the store is the owner's system of record. The JSON gives `name` (raw) and
`display_name` beside it.

### Real people: a query first, a stored table only if the numbers say so

Named constant `SMALL_GROUP_MEMBERS = 10` in `src/store/sqlite/person-ties.ts`. A person is real when any of their
identities (a merged person: the union of all of them) has:

- a member row in a `dialog` chat;
- a member row in a group whose size (`participants_count`, else `member_counts.listed_count`) is at most 10;
- mail exchange (NEED-2342 decides what counts);
- a meeting or calendar entry with the owner;
- a `records` row with `entity_type = 'person'`;
- the new phone-book marker.

**Also always real**: the owner, a person created by hand (`people add`, no identity at all), and anyone assigned a
task. Without this rule a person the owner just added would vanish (RISK-125).

Whether this is a query or a stored table is settled by a measurement, not by guessing:

1. **Query**: one `EXISTS` per tie, over indexes. Needs at least an index for the group size.
2. **Stored**: a `person_ties(person_id, ties, updated_at)` table kept by the same cursor `people.scan` already
   keeps (`person-match-scan.ts:289-314`), refreshed after each sync.

The first cli-core PR builds a synthetic temp store with about 51,000 identities and 5,000 chats (a few hundred
groups of ≤ 10, the rest large), and times `people list` real-only, first page and count, both ways. Result and
script go to cli-testing `performance/people/ties/README.md` (the CLI-projects rule). **Query if the first page and
the hidden count come back under 200 ms; stored table otherwise.** Either way a migration is needed (the phone-book
marker, the index); the next free number was 61 when this was written (cli-core `docs/dev/COORDINATION.md:7`) and is
reserved there in its own PR first.

RISK-126: some messengers leave `participants_count` empty. A group with no known size counts as large (hidden),
and the benchmark README says how many groups that was in the synthetic store; the real number is unknown.

### Every place that lists people hides the background ones

| Where | Default | Show all |
| --- | --- | --- |
| `memo people list` | `kind:person` (see the contract below) | `kind:all`; the other kinds as filters |
| `memo search people` | real first, then the rest marked `tie: none` (search must still find anyone) | — |
| Desktop People | real only, "N hidden · Show all" | a toggle chip |
| Desktop task assignee picker (`task_board.rs:392`) | real only | the picker's search finds the rest |
| `memo people review` | proposals touching a hidden person stay listed (a duplicate is worth fixing either way) | — |
| cli-core `contacts list` | unchanged: already dialogs only | — |

RISK-127 (closed by the contract below: `people list` has no `--all`, the vocabulary's `--all` means every page): memo's only `--all` today, on `answers`, means "every account". On `people list` it means "people with no
tie too". The help text says so; the owner asked for this word.

### The people list contract (memo M-1, the owner's feedback UX-133)

The owner, 2026-11-09: «не надо показывать всех попало… рассылки и уведомления в конец, левые имена вообще в
отдельный блок с неразобранным мусором. нужно писать сам контакт — тел, email, messenger handle… сортировал бы по
кол-ву коммуникаций от человека… отделить компании, можно в отдельный фильтр». So every person gets one **kind**,
and the list shows one kind at a time.

```sh
memo people list [kind:<kind>] [name:<text>] [--sort interactions|recent|name|tasks] [--limit <n>] [--page <n>] --json
```

- `kind:` is `person` (the default), `organization`, `automated`, `stranger`, `unsorted` or `all`.
- `--sort`: `interactions` (the default, most first), `recent` (newest `last_contact` first), `name`, `tasks`. The
  owner comes first in every order; equal rows go by name, then ref.
- `--limit` 500 by default, at most 5000; `--page` from 1. `page.total` is exact (`relation: "eq"`) for the kind and
  the `name:` asked. In a group (`MEMO_GROUP`) the page leaves `total` out, since the store's counts include people
  outside the group.

```json
{
  "items": [
    {
      "ref": "person:12",
      "name": "\"Kai Sample \"",
      "display_name": "Kai Sample",
      "kind": "person",
      "kind_signals": ["chat", "mail"],
      "owner": false,
      "tasks": 2,
      "contact": "+34600000001",
      "phone": "+34600000001",
      "email": "kai@example.com",
      "username": "kai",
      "messages_from": 314,
      "last_contact": "2026-11-08T10:12:00.000Z",
      "ties": ["chat", "mail"]
    }
  ],
  "page": { "mode": "page", "limit": 50, "has_more": true, "next_page": 2, "total": { "value": 1240, "relation": "eq" } }
}
```

- `display_name`: the name without wrapping quotes and extra spaces. A name with no letter or digit, or a
  placeholder a messenger writes for a missing name (`null`, `undefined`, `Без имени`, `Deleted Account`), gives way
  to `@username`, then the phone, then the email; `null` when there is none. `name` stays as stored. The `null` and
  `#97365` on today's People rows are Desktop printing a missing username and the id, not stored text, so the CLI
  strips no `#<digits>` from a real name.
- `contact`: the one to show beside the name: the phone, else the email, else `@username`; `null` when there is none.
  `phone`, `email` and `username` are the first of each across the person's accounts.
- `username_source`: the messenger the row's `username` belongs to (`telegram`, `max`, …), null when there is no
  username. When `contact` is `@name` (no phone or email), show it as «<Messenger> @name», e.g. «Telegram @name».
- `people show` identities also carry `phone` and `email` as each source gave them (null when absent).
- `messages_from`: the messages and the mail this person sent, every account together. `last_contact`: the newest of
  their messages, their mail and their one-to-one chat's last message; `null` when the store holds none.
- `ties`: as before (`chat`, `small-group`, `mail`, `meeting`, `crm`, `phone-book`, and `owner`, `added`, `task`).
- **Counts per kind for the filter tabs**: the list envelope is a closed schema (`items`, `page`, `next`, `missing`,
  `meta`), so there is no room for counts in `meta`. Desktop asks `memo people list kind:<k> --limit 1 --json` once per
  kind (five calls through `commands --serve`) and reads `page.total`; a `relation` other than `eq` shows as «N+». For an agent, the answer's `next` steps
  (`step: "people.kind"`) name each other kind that holds someone, with its count in `why` (`"120 organizations"`).
  An unknown `kind:` or `--sort` is refused (`validation_error`).

**The kind of a person**, the first rule that holds; `kind_signals` names what decided it:

| Order | Kind | When (`kind_signals`) |
| --- | --- | --- |
| 1 | `person` | the owner, a person added by hand, a task's assignee (`owner`, `added`, `task`): never hidden |
| 2 | `automated` | a messenger bot (`bot`); a no-reply address (`no-reply`); most of the mail from them, 3 letters at least, is in the bulk mailbox (`bulk-mail`); memo's sender score marked them `bulk_never_replied` (`bulk-never-replied`); a name such as «Notifications», «Newsletter», «No-reply», «Уведомления», «Рассылка» (`automated-name`) |
| 3 | `organization` | an identity an organization owns (`organization`); every address of theirs a shared role address such as `info@`, `sales@` (`role-address`); a legal form or a company word in the name: ООО, ИП, АО, LLC, Ltd, Inc, GmbH, Airlines, Bank, Hotel, Team, Support, Shop… (`company-name`) |
| 4 | `person` | a tie to the owner (the tie names) and a readable `display_name` |
| 5 | `stranger` | a readable `display_name` and no tie to the owner (`no-tie`): an author seen only in a big group |
| 6 | `unsorted` | everyone else: no name and no contact to show (`no-name`) |

Strangers are their own kind by the owner's decision NEED-2490 B (option B); the nameless stay in `unsorted`, the
owner's «левые имена… в отдельный блок». Every rule is a fixed signal from the store; nothing is
guessed by a model, and a wrong kind is fixed by the owner's own data (a tie, a CRM record, an organization link).

`memo people similar <name...> --json --limit 8` answers items of the same shape plus `same_name`.

### Duplicates: one new signal, the same review

`scanMatches` gains a `name` signal: two people with the same `nameKey` **and** one shared trace:

- a common chat (any size);
- the same email, or the same email domain when that domain is not in `FREE_MAIL` and the address is not a role
  address (`isRoleAddress`), so `info@` and `gmail.com` join nobody;
- the same phone.

It only **proposes** (`joins: person`, evidence lists the trace); it never joins on its own, so the owner decides
every merge through the existing `review confirm|reject`. Groups of more than `MOST_SHARING` (6) people with one key
are skipped as too common a name. The full pass computes keys in JavaScript over all persons (a few tens of thousands
of short strings) and asks SQL only about groups of two or more; the incremental pass only about groups touching new
identities.

### Search while typing

`memo people similar <name> --json --limit 8`: people whose `nameKey` or a word of it starts with what was typed,
plus the `name`-signal duplicates of that key, with `display_name`, contact and `tie`. The same migration adds
`persons.name_key` (kept by `add`, rename and merges) and an FTS5 table over its words, as `identities_fts` already
does for contacts, because a prefix of any word, not only the first, must hit the index. It never reads every
identity (PERF-6). The Add person form and, later, `memo search people` use it.

### Digests by name

Any number of digests, each keyed by name; `morning-digest` is the first one and its files do not change (owner,
2026-11-09, NEED-2343 B). memo's own help is the source of truth: the names below are those of cli-memo's
`digest-commands.ts` as its session wrote them on 2026-11-09, before release, and Desktop's `digest_book.rs` asks
exactly these (RISK-2237).

- `memo digest list --json` → `{items: [...]}`, `morning-digest` first. Each item: `name`, `title`, `times`
  (`["08:30", "18:00"]`, any number), `weekdays` (`[]` every day, or `["mon", "fri"]`), `sources` (`[]` every
  source, or from memo's `DIGEST_SOURCES`: `telegram`, `max`, `whatsapp`, `mail`, `meetings`, `tasks`), `routes`
  (`telegram-bot:<profile>/<chat>`, `email:<profile>/<address>`), `brief`, `scheduled`, `max_cost_usd`,
  `max_cost_per_day_usd`, `last` (`{at, ok, cost_usd, output}` or `null`), `next_at` (or `null`).
- `memo digest add <name> --title <t> --at <when> [--at <when> …] [--source <kind> …] [--deliver-to <r> …]
  [--text <brief>] [--max-cost <usd>] [--max-cost-per-day <usd>] [--paused] --from-app`. `<when>` is `HH:MM` every
  day or `mon,fri HH:MM` on those days, one `--at` per time.
- `memo digest edit <name>` takes the same options except `--paused`; each option given replaces what it set and the
  rest stays, so Desktop says an emptied list out loud: `--source all`, `--deliver-to none`. Desktop sends `--text`
  on add only: an open digest's brief is saved by `digest brief edit`, and a settings save must not write it back.
- `--max-cost` must be above 0.
- `memo digest edit` refuses a digest whose prompt was set by hand with `memo schedule agent`: an edit would replace
  that prompt without a word.
- `memo digest run <name> [--no-notify | --deliver-to <r> …] --from-app`: writes it now. Without a flag it sends to
  every route, as the timer does; `--no-notify` keeps it in the app only; `--deliver-to` sends to those of its routes
  only (NEED-2483, owner: "give a choice").
- `memo digest pause|resume <name> --from-app` take it off its timer and back, every setting kept; `memo digest
  remove <name> --from-app` removes the schedule and its settings, and keeps the past runs.
- `brief show|edit|reset [digest]`, `templates` (key `report/<name>`) and `backfill [digest]` take the name as an
  optional argument; without one they mean `morning-digest`, as today. Desktop passes a name only for a digest other
  than `morning-digest`, so an older memo keeps working.
- A weekday needs cli-core `schedule … --at HH:MM --on <weekday>` (systemd `OnCalendar=Mon 09:00`, launchd
  `Weekday`, Task Scheduler weekly trigger), FIND-269.

## The pages

All three follow `TasksPage`: the header (title, one line, guide link; on the right Read again, the view switch,
the one primary action), then `FilterBar`, then the table or board, then the pager. Rule 9 holds: an edited row stays
put, a toggle never resets the scroll, every open and close animates.

### Contacts (was People; UX-134)

- **Name**: the page is «Контакты» / Contacts / Contactos; its section id stays `people`, so links keep working, and
  the CLI command stays `memo people`.
- **Kind tabs**: Люди · Компании · Рассылки и уведомления · Посторонние · Неразобранное, each with its count (one
  `kind:<k> --limit 1` read per kind, at most two at a time, never holding the table back; a lower bound reads «N+»).
- **Table** (`DataTable`): Name (`personName` in `src/domain/people.ts`: `display_name`, else the cleaned name, else
  the contact, never «null #id»; the raw name in a tooltip when they differ) · Contact (phone, address or handle with
  its icon) · Messages from them · Last contact · Tasks; every column sorts, the most written first.
- **Filters**: the name search (an account such as `telegram:4411` is looked up exactly) and With tasks.
- **An older memo** (no kinds) refuses the kind word or `--sort`: the page reads the plain list, shows no tabs, hides
  the nameless until asked and takes the contact from the person's accounts.
- **Pages** of 50 through `Pager`.
- **A row opens the person in a dialog** (`Dialog wide scroll`), the way a task opens: identities, merges, matches,
  Split and Undo merge, moved from `PersonRow` without changing what they do.
- **Duplicates**: a second view on the same page, `People · Possible duplicates (12)` (`ViewSwitch`). It lists the
  open proposals as today's `MatchCard`s, newest first, with the same Same person / Not the same buttons. A decided
  card stays in place with its answer until Read again (as now).
- **Duplicate cards** (UX-131, BUG-669; direction from Linear's `DESIGN.md` in
  [awesome-design-md](https://github.com/VoltAgent/awesome-design-md): hairline cards, one accent, small 4px chips,
  dense rows, words moved into tooltips). The screen opens with what joining gives: one card per person with all
  their chats, mail, meetings and deals, which search and agents then see whole. A card's title is the people's names,
  a link that opens Details. One row says the tie, «Телефон [одинаковый] [3]», the details in each badge's tooltip;
  who found it is a small label («WireCat», or the agent's name) with the explanation in its tooltip. Each person shows
  their accounts by source with name and handle, scope, account and task counts. Buttons: Details, Same person
  (primary), Not the same.
- **Groups** (BUG-669): memo proposes one match per pair of people who share a phone or an address
  (`proposeEachPair` in cli-core), each carrying the whole set as `candidates`. The page shows the pairs of one set as
  one card, keyed by signal and `candidates`; the people shown come from the open pairs, because `candidates` is not
  rewritten after a join. The owner ticks two or all; `people_merge` confirms one open pair at a time and finds the
  next pair by its two people, not its id, since each confirm folds the remaining pairs into one. The unticked stay
  open; Not the same rejects the open pairs among the ticked people, with one reason. No CLI change was needed.
- **Pager** (UX-132, shared by People, Clients and Search): «‹ 1 2 … 9 10 ›», «51–100 из 1 234» in the owner's
  digits, a page-size select (25, 50, 100); a total that memo capped reads «5 000+». Search pages by cursor and keeps
  Previous and Next with the page number only.
- **Add person** (the primary button) opens a dialog: a Name field; under it, 300 ms after typing stops,
  "Already here" (existing people, each with Open) and "Might be the same" (the `name` signal's candidates). Create is
  plain until the first answer comes back, then the primary action. A stale answer for older text is dropped.

### Clients

- **Speed first** (PERF-5): the base read's six memo calls run at once in `std::thread::scope`; the React Query keeps
  its answer for 60 s (`staleTime`) and refreshes in the background, so a revisit draws at once; `page_loads.rs`
  gains a Clients case.
- **Views**: `Table · Board` (`ViewSwitch`), remembered per computer like Tasks. Board is today's `BaseBoard` (columns
  are the base stages, cards from every pipeline). Stages (today's `StageMap`) moves behind a "Stages" button, as a
  setting, not a view.
- **Table** (`DataTable`): Title · Stage · Amount · Pipeline (CRM icon) · Contact · Updated. Sort by Amount, Updated,
  Stage. Stage is a picker cell that moves the card through the same `clients_move`, with the same refusals.
- **Import**: one button per configured pair of CRM tool and profile (rule 3: never pick a profile). One pair: a plain
  button "Import from Bitrix24". Several: `SplitButton` with "Import from Bitrix24 · work", "… · personal". None: "Add
  a CRM", which opens Tools on the CRM tools. It runs `useSync.start(tool, profile)`; the button shows the sync's
  progress with `SyncStatus` and the page reads again when it ends.
- **Empty state**: "No deals yet". Three short lines: nothing is imported from a CRM yet (with the import button);
  only your own deals are imported while the CRM's scope is "Mine" (with the scope switch); leads are under Leads.

### Digests

The owner's words (2026-11-09, TASK-959): digests "should be a table, with the digest's name, so it is clear how
regular it is, where it sends data, where it pulls data from"; "two buttons" to get one now and to put it on a
schedule; "it can be twice a day"; "opening one shows its prompt and its time, and lets you set them up".

- **Header.** Title "Digests". The line under it starts "Manage regular notifications with a digest for the day, the
  week and so on" and says a digest can pull from any connected source and shows it neatly. On the right: Read again
  (ghost) and **Create digest** (primary, the standard size, the page's one purple action).
- **The table** (`DataTable`): Name (title, and its name in mono under it) · How often ("every day at 08:30", "twice a
  day: 08:30 and 18:00", "Mondays at 09:00") · Takes from (source icons, or "All sources") · Sends to (Telegram,
  Email, or "Only here") · Last run (lamp, date, cost) · Next run · On schedule (a `Switch` in the row; turning it
  does not open the row). A row click opens the digest.
- **One digest** opens in place of the table, with Back. Left: **Settings** (title, times — any number, added and
  removed — weekdays, sources, routes, cost caps; Save is the card's action), then `BriefCard` (the prompt: what to
  collect) and `TemplatesCard` (how it looks), both for this digest's name. Right: the latest report (`ReportView`)
  and the list of past days. In the digest's header two buttons:
  - **Get now**, a `SplitButton`. The main action writes it now and sends it to its routes, as the schedule does; the
    menu has "Only show here" and, with two or more routes, "Send only to <route>". The price of the last run is
    named first in a confirm dialog worded for the choice.
  - **Put on schedule** / **Take off schedule**, the same thing the row's switch does.
  - **Build past days…** stays a secondary action in the digest's header: past days are built for reading in the
    app and never sent, so Telegram and mail are not flooded with old news. Remove digest is in the same menu.
- **None yet:** two ready templates, "Daily digest: every morning, what came in and what waits for you" (08:30, every
  day) and "Weekly digest: Monday morning, the week in one page" (09:00, Mondays), each with Set up, plus **Create
  your own**. Each opens the same `Dialog` form, prefilled: title, times, weekdays, sources, routes, the prompt, the
  cost caps. A weekday is required when "On days" is chosen. Save runs `digest add` and the row appears.
- **Without Claude Code** on PATH the forms say so and link to Agents, as `ScheduleCard` does today; Save is off.
- **An older memo** (no `digest list`): the page reads `memo schedule list --json` and shows the morning digest as one
  row, so it works with today's memo. What that memo cannot do is off with a "needs a Memo update" hint: a second
  digest, more than one time, weekdays, sources, "Only show here". Its switch is `schedule agent` / `schedule remove`,
  Get now is `schedule run`. The catalog's memo minimum rises only once memo with `digest list` is released.
- memo's other schedules (mail triage and the like) stay under the table, read only.

## Texts (en · ru · es)

New keys only; each lives in its feature's `messages` file and `i18n/catalogs.test.ts` checks all three.

| Key | en | ru | es |
| --- | --- | --- | --- |
| `people.showAll` | Show all | Показать всех | Mostrar todos |
| `people.hidden(n)` | {n} hidden: no chat, mail, meeting, CRM or small group with you | Скрыто {n}: нет ни переписки, ни писем, ни встреч, ни CRM, ни общей небольшой группы | {n} ocultos: sin chat, correo, reunión, CRM ni grupo pequeño en común |
| `people.tie.*` | Chat · Mail · Meeting · CRM · Phone book · Small group | Чат · Почта · Встреча · CRM · Телефонная книга · Небольшая группа | Chat · Correo · Reunión · CRM · Agenda · Grupo pequeño |
| `people.duplicates(n)` | Possible duplicates ({n}) | Возможные дубли ({n}) | Posibles duplicados ({n}) |
| `people.add` | Add person | Добавить человека | Añadir persona |
| `people.alreadyHere` | Already here | Уже есть | Ya está |
| `people.mightBeSame` | Might be the same person | Возможно, тот же человек | Puede ser la misma persona |
| `clients.view.table` / `.board` | Table · Board | Таблица · Доска | Tabla · Tablero |
| `clients.import(crm)` | Import from {crm} | Импорт из {crm} | Importar de {crm} |
| `clients.addCrm` | Add a CRM | Подключить CRM | Añadir un CRM |
| `clients.emptyScope` | Only your own deals are imported while the scope is "Mine". | Пока выбран охват «Мои», импортируются только ваши сделки. | Con el alcance «Míos» solo se importan tus tratos. |
| `digests.intro` | Manage regular notifications with a digest for the day, the week and so on. A digest can pull from any connected source: chats, mail, meetings, tasks, and shows it in one neat page. | Управляйте регулярными уведомлениями со сводкой за день, неделю и т.п. Сводка может брать данные из любых подключённых источников: чатов, почты, встреч, задач, и показывает их на одной аккуратной странице. | Gestiona notificaciones periódicas con un resumen del día, la semana, etc. Un resumen puede tomar datos de cualquier fuente conectada: chats, correo, reuniones, tareas, y los muestra en una página ordenada. |
| `digests.create` | Create digest | Создать сводку | Crear resumen |
| `digests.daily` / `.weekly` | Daily digest · Weekly digest | Ежедневная сводка · Еженедельная сводка | Resumen diario · Resumen semanal |
| `digests.when` | every day at {t} · twice a day: {t1} and {t2} · {days} at {t} | каждый день в {t} · дважды в день: {t1} и {t2} · по понедельникам в {t} | cada día a las {t} · dos veces al día: {t1} y {t2} · los lunes a las {t} |
| `digests.getNow` / `.onlyHere` | Get now · Only show here | Получить сейчас · Только показать здесь | Obtener ahora · Solo mostrar aquí |
| `digests.schedule` | Put on schedule · Take off schedule | Поставить в расписание · Снять с расписания | Programar · Quitar de la programación |
| `digests.backfill` | Build past days… | Собрать прошлые дни… | Crear días pasados… |
| `digests.empty` | No digests yet. Start from a template; you can change everything later. | Сводок пока нет. Начните с шаблона, всё можно поменять потом. | Aún no hay resúmenes. Empieza con una plantilla; todo se puede cambiar después. |

Weekday names come from `Intl.DateTimeFormat`; the "by Mondays" phrasing for one weekday is a short table per
language (ru «по понедельникам», es «los lunes»), since `Intl` has no such case.

## Pull requests, in merge order

Small PRs, but each cli-core PR runs the full parity build (tg-cli, max-cli, whatsapp-cli, cli-template), and
Actions is shared and queued. So cli-core work is three PRs, not six, and one release carries all of it; memo the
same. Desktop PRs D-1 to D-3 need no CLI change and can start at once.

| # | Repo | PR | Needs | Tests |
| --- | --- | --- | --- | --- |
| CC-1 | cli-core | `docs(coordination): reserve migration <n> for people ties` | — | docs check |
| CC-2 | cli-core | `feat(people): display names, ties to the owner, a paged people list`: `person-names.ts`, `person-ties.ts` with `SMALL_GROUP_MEMBERS`, the phone-book marker written by `contacts sync`, `persons.name_key`, the indexes, `people.list({query, all, cursor, sort})` with `hidden`; benchmark in cli-testing decides query vs `person_ties` table | CC-1 | `person-names.test.ts` (quotes, `!`, `!$`, trailing spaces, fallbacks, word order); `person-ties.test.ts`, one temp store per tie (dialog, group of 10 vs 11, unknown size, mail, meeting, CRM, phone book, hand-added, task assignee, merged person's union); migration up test; `contacts.test.ts` marks the book |
| CC-3 | cli-core | `feat(people): propose a match for the same name and a shared trace` + `people.similar`; and `feat(schedule): --on <weekday>` for a weekly `--at` | CC-2 | `person-match-scan.test.ts`: same key + chat → proposal; same key, no trace → none; gmail.com and `info@` → none; 7 sharers → skipped; never joins; `schedule.test.ts`: `--on mon --at 09:00` on linux, macOS, windows units; `--on` without `--at` refused |
| — | cli-core | release (batched with whatever else is merged) | CC-3 | — |
| M-1 | memo | `feat(people): real people by default, --all, pages, display names, people similar`; `search people` real first; bump cli-core | cli-core release | `command.test.ts` with temp `MESSAGING_STORE`, `MEMO_CONFIG_DIR`, `MEMO_STATE_DIR`: default hides, `--all` shows, `hidden` count, cursor paging, `similar` |
| M-2 | memo | `feat(digest): digests by name, daily and weekly`: `digest list|add`, name on `brief`, `templates`, `backfill`; `morning-digest` unchanged | cli-core release | `digest/command.test.ts`: add daily, add weekly (`--on`), list shows both, old `morning-digest` still read, brief per name |
| — | memo | release; catalog minimums follow in D-4 and D-6 | M-1, M-2 | — |
| D-1 | desktop | `refactor(ui): DataTable, Pager and ViewSwitch shared` from TaskTable, SearchPage, TasksPage; no visible change | — | `DataTable.test.tsx` (sort header `aria-pressed`, sticky lead, row slot), `Pager.test.tsx`; `TasksPage.test.tsx` and Search tests unchanged and green |
| D-2 | desktop | `perf(clients): read the board's memo calls at once and keep the answer` + Clients in `page_loads.rs` | — | Rust: `read_base_with` with a fake `Call` records all six calls and joins the same `CrmRead`; a failing call still fails the read; `ClientsPage.test.tsx`: a revisit within 60 s shows cards with no skeleton |
| D-3 | desktop | `feat(clients): table view, import button, an empty page that explains` | D-1 | `ClientsPage.test.tsx`: Table/Board switch remembered; table sort; stage cell moves and a refusal stays on the row; import: 0 pairs → Add a CRM, 1 → button, 2 → menu, never runs without a chosen profile; empty state lines |
| D-4 | desktop | `feat(people): a table of real people, Show all, pages, duplicates view`; Rust `people_list(query, all, cursor, sort)`; person dialog from `PersonRow`; catalog memo minimum | D-1, M-1 released | `people.rs` fixtures from memo's new JSON; `PeoplePage.test.tsx`: hidden count, Show all, Tie filter, pager, row opens dialog, Split and Undo still work, duplicates view decides a MatchCard, memo too old state |
| D-5 | desktop | `feat(people): Add person searches while you type` | D-4 | dialog: debounce, stale answer dropped, Already here / Might be the same, Open goes to the person, Create calls `people add` once |
| D-6 | desktop | `feat(digests): a table of digests, one digest's settings and preview, Get now and schedule`; Rust `digest_book` (new memo: `digest list`; older: `schedule list` as one row), `digest_save`, `digest_run`, `digest_set_scheduled`, `digest_remove`, name on brief, templates, backfill and the days; merges when it degrades cleanly on the older memo, catalog minimum later | D-1 | `DigestsPage.test.tsx`: empty → templates, create saves, twice a day, weekly needs a weekday, row opens settings, Get now and its menu, schedule switch, no Claude Code, older memo as one row; Rust: name, times, weekdays, sources, routes, brief and caps checked before memo runs; the run's delivery flags |

Every Desktop PR: mock scenarios in `src/platform/mock-*.ts` (`?people=hidden|dupes|add`, `?clients=table|import-none|import-two`,
`?digests=list|weekly`), both themes and 960 px with `scripts/capture.mjs`, keyboard, reduced motion, `pnpm check`.
Rule 9 check with `scripts/scroll-hold.mjs` on the People table's Show all and the Clients stage cell.

## Risks

- **RISK-125 · A person added by hand would be hidden.** They have no identity and so no tie. Counted as real by the
  rule above; tested in CC-2.
- **RISK-126 · Group size can be unknown.** Counted as large; the share in a real store is unknown until the owner
  runs the new list.
- **RISK-127 · `--all` means two things in memo.** "Every account" on `answers`, "people with no tie too" on
  `people list`. Help text says which.
- **PERF-7 · A spawn per keystroke.** Each `people similar` starts Node. Debounced to 300 ms and stale answers
  dropped; if it still feels slow, the same command later goes through memo's MCP server, which stays running.
- **Phone-book ties start empty.** The marker is written by the next `contacts sync` of each account; until then
  phone-book-only people stay hidden. The release notes of memo say to sync contacts once.

## Open questions for the owner

- **NEED-2342 · What counts as "mail exchange" for a real person?** A the owner wrote to them at least once
  (an outgoing mail with them as recipient) · B any mail from them, including newsletters and notifications. I
  recommend **A**: B makes every shop and service that ever mailed the owner a real person, which is most of the 51k.
- **NEED-2343 · Daily and weekly only, or any number of digests?** Answered 2026-11-09: any number (the owner's
  "create a new one", "twice a day"). Was: A two kinds, at most one of each · B any number,
  each named, with its own brief and template. I recommend **B in memo, A in the first Desktop forms**: memo keyed by
  name costs the same either way, and the page can open "New digest" for more later without another memo change.
- **NEED-2344 · Should the one-pipeline board go?** Today a memo without base stages shows `ClientsBoard`, one
  pipeline's own stages. A raise the catalog's memo minimum to base stages and drop that board · B keep it. I
  recommend **A**: two boards with different columns is part of why the page is hard to read, and the table covers
  looking at one pipeline (filter by Pipeline). The removal goes to `CLEANUP.md` until the owner confirms.

## Found on the way

- **FIND-267 · No tie is stored**, and the phone book leaves no trace at all once saved (table above).
- **FIND-268 · Three reasons Clients can be empty** without anything being broken (above).
- **FIND-269 · `schedule` has no weekday**: a weekly job at a set time cannot be made.
- **FIND-270 · `memo people list` gives no contact fields**, so the People page cannot show a fallback name or
  anything to tell two "OpenWeather Team" apart. CC-2 and M-1 add `display_name` and the first username, phone, email.
- **PERF-5 · Clients waits for six memo processes in a row** on every visit.
- **PERF-6 · `memo search people` reads every identity per call.**
- **DEBT-63 · Two free-mail lists in cli-core**: `FREE_MAIL` (`src/mail/score.ts:62`) and a shorter `FREE` in
  `src/services/link-scorers/email-domain.ts`. CC-3 uses `FREE_MAIL`; the scorer should too.
- **DEBT-62 · The page header is copied into 14 pages.** Left as is here; a `PageHeader` in `src/ui` is its own
  small PR whenever someone touches three of them.

<!-- cspell:words Bitrix whatsapp linux -->
