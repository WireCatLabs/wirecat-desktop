# Architecture

WireCat Desktop is a thin window onto the WireCat CLIs. The interface is React in the system webview; Rust inspects
the machine and runs the tools. Nothing here duplicates what a CLI already does.

New here? Read [the architecture report](architecture-report.md) first. Rules per kind of change are in [guides/](guides/).

## The layers

```text
src/
  app/          shell: window frame, sidebar, sections, theme. May import everything below.
  features/     one folder per area (tools/, agents/, links/, conversation/, digests/, tasks/, clients/, system/, logs/, search/, query/ (the query bar Logs and Search share), memory/, analytics/, guides/, config/, settings/, storage/, onboarding/, report/, signin/, update/, notifications/).
  shared/       parts and stores two or more features use: ToolIcon, ReportThis, JsonTree, nav, and the stores of tools, agents, storage, system, signin and onboarding. Imports no feature (Biome rule).
  features/<name>/index.ts   a feature's public surface. Other features and the app import `@/features/<name>`, never a file inside it (Biome rule). The one exception is `@/features/<name>/page`, the lazy entry of a page: `app/sections.tsx` loads it with `import()` so a page's code does not enter the first chunk through the index; `main.tsx` imports `tools/community` directly because it must run before any page module loads. Feature folders never import each other in a cycle (`src/features/no-cycles.test.ts`).
  features/<name>/api.ts     the feature's requests to Rust as TanStack Query hooks: `useQuery` for reads, `useMutation` for writes, keys per tool and profile (`["tool", id, "permissions", profile]`). Its store keeps UI and live-event state, not a copy of an answer a query holds. Moved so far: tools (profiles, permissions, background), search (value lists), analytics (extra counts, aggregates, closed weeks); the rest still call `platform` from stores and components (step 6 note in architecture-report.md).
  shared/query.ts            the one QueryClient (no retries, no refetch on focus: a refetch starts a tool process) and the profiles query several features share. `app/App.tsx` and `testing/render.tsx` provide it; `resetStores` replaces it before each test.
  ui/           presentational parts: Button, Lamp, Stepper… Props in, events out.
  platform/     the only door to Rust. Has a browser mock. `bindings.ts` holds the types generated from the Rust
                structs (`src-tauri/src/bindings.rs`; `cargo test bindings` rewrites it and fails until it is
                committed). An answer typed there is trusted as is; valibot stays where the shape comes from a
                tool's JSON or from browser storage, and for the areas not moved yet (see the step 5 note in
                architecture-report.md).
  domain/       plain TypeScript: catalog, tool status, doctor summaries. No React, no Tauri.
catalog/
  tools.json    the tool list, read by both TypeScript and Rust.
src-tauri/src/
  lib.rs        start-up and the `invoke_handler` list naming every command.
  self_test.rs  `--self-test`, only with `WIRECAT_SELF_TEST=1`, before any window: install-check.yml's install of a
                catalog tool through `install::install` (and `node::set_up` with `--own-node`), one JSON line.
  commands/     Tauri commands, one file per feature: the whole native surface, one function each. A command
                fails with `error.rs`'s `{ kind, message }` (`unknown_tool`, `invalid_profile`, `not_installed`,
                `busy`, `internal`, `failed`); `platform/command-error.ts` turns it into an `Error` with that message.
                `update_kind`: whether this copy replaces itself (`self`) or is a Linux `deb` or `rpm`.
  log.rs        a daily log file in the app's log folder, last seven kept: each command's name, duration and result
                kind, and each program `run.rs` starts (file name, duration, exit). Every line goes through
                `redact.rs` first.
  catalog.rs    the same tools.json, compiled in; profile validation.
  community.rs  community tools (made outside WireCatLabs) added to that catalog at start, from the signed list's
                cached copy while "Enable community tools" is on (`registry.rs`), or from
                `<app data>/extra-tools.json` while `WIRECAT_EXTRA_TOOLS=1` is set; every word plain, no name or data
                folder of ours, no `@wirecat` package. `extra_tools` hands the accepted entries to the interface, which
                loads them before any page module (`src/main.tsx` imports `src/start.tsx` after). See
                [cli-registry.md](cli-registry.md).
  registry.rs   the signed community list: fetched from wirecat.dev at start and at most daily, kept only when
                minisign verifies it against `registry-key.pub`, it has not expired and is not older than the copy kept.
  own_tools.rs  "Add your own tool": reads npm and the tarball's manifest without running anything, builds the review,
                installs after two confirmations, saves the entry and reloads the catalog (`catalog::reload`), so the
                interface lists the tool at once (`src/shared/added-tools.ts`).
  own_scan.rs   what the tool's own JavaScript in the tarball says about the network; bundled libraries are skipped.
  own_risks.rs  the review's things to check: npm, the cli-base and cli-core versions, the scan, and GitHub
                (`own_tool_risks`, unauthenticated, cached); a check that cannot run says so, none refuses.
  system.rs     OS, Node.js, npm, npm's global folder and whether it is writable; the sandbox name (`WIRECAT_SANDBOX`).
  npm_prefix.rs where npm installs a tool: npm's own global folder, or the user's (`~/.local`, `%APPDATA%\npm`) when
                that one needs administrator rights; an update stays where its copy is. `bin/install-e2e` runs the
                real install and uninstall against a test package; CI runs it on all three systems.
  tools.rs      finding executables, versions, profiles, doctor runs.
  install.rs    install, update and uninstall with progress events, verification, failure reasons. The verify step
                says what it does (`check` events: `path`, `start`, `skills`), so the row names it instead of one long
                "Verifying"; `domain/install-batch.ts` turns npm's counts and these into each row's bar.
  provenance.rs before an install, `npm audit signatures` on a stub project plus the Sigstore certificate's
                workflow: the release must be built by its catalog `repo`'s release.yml, or nothing is installed.
  runs.rs       run logs, read through each tool's own `runs list` / `runs show`; shown unmasked, an exception
                to rule 4: the tool already hid secrets and phone numbers, and the ids and paths are the owner's
                to read (NEED-115). report.rs filters them again before anything is sent.
  search.rs     one tool's own Lucene search of its local store for one profile (`search` in the catalog); hits shown
                unmasked on the page, an exception to rule 4 like runs.rs: they are the owner's own data, and they are
                never logged or put in a report. `search_context` reads what surrounds one hit (`search.context` in the
                catalog) under the same rule: the ref is validated, the answer shown, never logged.
  analytics.rs  the Analytics page's message counts: a messenger's own `stats messages show` per profile, by day, hour,
                sender or chat, with one fixed term (`from:me`, `has:photo`, `kind:group`…) and the period or the one
                before it (`stats` in the catalog), local store only. `analytics_aggregate` runs one of a tool's
                `aggregates` (reply time, waiting on you, chat coverage, mail per day, `zm meetings list`, `memo stats
                tasks show`); "unknown command" is shown as the update that brings it. Names shown unmasked, an exception to rule 4 like
                search.rs: never logged or put in a report. Plan `docs/dev/plans/2026-11-02-analytics.md`.
  query_writer.rs the Search page's "Write the query": the owner's words, the tool's keys from the catalog and today's
                date go to his own Claude Code (`claude -p`, no tools, no settings, no session) or, when it is missing or
                signed out, Codex (`codex exec`, read-only, in an empty folder). One checked line comes back into the
                query box; nothing is searched until he presses Search. Never a message or a hit.
  account.rs    removing one account: cli-core's `account remove` (`accountRemove.remove`), dry run first, keeping or
                deleting its data; before a tool's version has it, its own `session end` (`accountRemove.signOut`).
                Refused while that profile syncs, its package installs or a sign-in runs. zm has no sign-out.
  settings.rs   tool settings: `config show`, and saving only through `config set` / `config unset`.
  storage.rs    each tool's data folders, their sizes and entries (names only); deleting them once unused.
  archive.rs    what the shared archive holds, from a tool's `store info`; the database is never opened.
  backup.rs     backing the shared store up into a zip, and clearing it, through the tool's own `store backup` / `store reset`.
  compat.rs     every installed tool's own `store info`, at once: which schema each reads and what its next run does.
  preflight.rs  before an install or update (Tools page and the setup's Install step): what the newest version does to
                the shared store, from npm (the version's `@wirecat/cli-core` and that one's `wirecat.store` in
                package.json), against `compat.rs`'s answers. Tools its run locks out whose newest version reads the store are updated in the same queue
                without a question; a version that cannot open the store, or tools with no such version yet, are shown
                in the install panel (or the setup's row) before anything runs. Offline or an older cli-core: no warning, and the check after
                the install (`checkAfterInstall`) stays the fallback. It reads `/<package>/latest`, which the registry's
                cache does not hold, and the install takes that version when `npm view` still shows an older one.
  skills.rs     agents found on this computer; each tool's skill through its own `skill status` / `install` / `show`.
  chats.rs      which chat apps drive Hermes and OpenClaw, by name only; the PATH Hermes's gateway starts from.
  mcp.rs        which WireCat MCP servers each agent has registered, and removing one.
  mcp_server.rs each tool's HTTP MCP server for browser apps: its own `mcp server start|stop|status` and `mcp --revoke`.
  tailscale.rs  Tailscale Funnel for an MCP server: its state, `tailscale login`, and Funnel on and off for ports the app set up.
  funnel_helper.rs WireCat's own Tailscale connection, `wirecat-funnel` (catalog entry `funnel`, a helper the pages do
                not list): `start`/`status`/`stop --json` and `route add|remove` of a tool's three paths, for a computer
                without the Tailscale app. Its funnels join `tailscale_funnels`, marked `via: wirecat`.
  tailscale_install.rs Tailscale's official installer or package, downloaded into Downloads and handed to the system.
  tailscale_linux.rs Tailscale's install commands for this Linux, from /etc/os-release and lists of known releases.
  cloudflare.rs  A Cloudflare tunnel on the owner's own domain: login, the tunnel and its DNS record, cloudflared run in the background.
  cloudflare_install.rs cloudflared's own release from GitHub into the app's folder, checked against GitHub's checksum.
  package_update.rs a .deb or .rpm copy's update: the updater plugin downloads it and checks its signature, it is
                saved in Downloads under the release's file name and opened by the system's installer when the
                default handler is a known one (otherwise shown in the file manager), with the `apt`/`dnf`/`zypper` line
                to copy or to open in the user's terminal (`terminal::open_line`), where they type the password.
                Never the plugin's own install, which asks for the password itself (rule 6).
  tasks.rs      task claims through the tool's own `tasks list` / `tasks release`, ids and holders only.
  memory.rs     the Memory page: memo's memories, facts, proposed actions, relationships and agents' calls; confirm, discard,
                correct and forget through memo's own commands, `--no-record` on every call (see "The Memory page").
  memo_cli.rs   running Memo for a page: one command, its JSON or Memo's error object (Tasks, account groups).
  memo_server.rs up to two long-running `memo` processes (memo's command server, argv in `SERVER_ARGV`) that answer
                the pages' memo commands one line at a time, so a call skips memo's start. Every memo command calls
                through it (`run_tool` picks it when the tool is memo), except calls fed on stdin, streamed runs, the
                doctor and `store recover`'s check; a command cli-core refuses in a server runs in its own process. A
                server whose ready line says `concurrent` takes that many requests at once, one reader thread handing
                each answer to its caller by `id`; one without it takes one at a time. A request of a command already
                running on its server waits up to a second, then starts its own process: memo 0.131.76's server parses
                requests on one shared program, so two of one command at once answered both with the second's options
                (the Contacts tabs read each other's counts). One
                server starts with the app (`warm`). A call that finds no server with room waits up to a second for
                one that is starting; past that, or for a memo without the server, it starts its own process. A
                timed-out or unreadable request retires its server once the other requests on it are answered;
                servers end on a new memo program, after ten minutes, and at app exit, and none runs during an install, update or removal, a store reset or repair.
                Syncs, sign-ins and installs never use it.
  groups.rs     account groups through Memo's own `groups list|add|remove|move`.
  conversation.rs a chat or mail thread a `chat/…` or `msg/…` link opens, read only: memo's `show` (title, where, the
                profile signed in to the account, or that the account is not here), memo's `messages show` with
                `--before-n`/`--after-n` (the linked message and its neighbours, and each further page), and for a
                messenger chat's newest messages the messenger's own `messages list --offline` with that profile. A mail
                thread opens from its first email (Gmail names a thread by it). Text unmasked, never logged, as search.rs.
  people.rs     the Contacts page: memo's `people list|review|show|unlink|unmerge|links resolve` and `review confirm|reject` for
                `identity_link` matches; every decision with `--from-app` (see "The Contacts page").
  person_profile.rs what a match's details compare about one person: memo's `context <ref> --limit 3 --trimmed` and the
                person's row from `people check -- <name words>`, slimmed to contacts, companies, counts and the latest
                messages (see "The Contacts page").
  memory_review.rs a memory or fact whose source changed: memo's source review read with `review show` and
                decided by the owner (Still true, Dismiss, No longer true), each with `--from-app`.
  memory_add.rs Add to Memory: `memo sources add|show|mentions|suggest`, the readers and the reader's key; pasted
                text and the key go on stdin, never on the command line (see "Adding to memory").
  ai_model.rs   Settings "AI model": memo's `models ai show|set|unset|check`, each with `--from-app`. `set` is one call: picture
                consent is per call (`--allow-remote`), so an unticked box simply omits it. The key goes on stdin, and
                memo's `ai.*` reasons come back as ids worded in `messages-ai-model.ts`. It needs a memo that has
                `models ai`: an older one answers like an unknown command and the section asks for an update. The model
                dropdown's lists that need no key (Ollama's, OpenRouter's) come from fixed addresses here.
  task_board.rs the Tasks page: memo's project tasks, counts, history and every edit, each with the revision it read.
  crm_board.rs  the Clients page: memo's deals and leads by the owner's base stages, the cards of every pipeline, and
                moving the owner's own through `<kind>s move`. A CRM's copy is changed by its own CLI (`writer`); a memo
                older than the catalog's `crmBoard.minVersion` (the first with base stages) is refused.
                `crm_board/base.rs` alone knows the base-stage commands' argv and JSON.
  paths.rs      the PATH a terminal would have; finding every copy of a binary.
  run.rs        running a process with a timeout; streaming lines; killing a whole process tree.
  host_open.rs  opening a web page or a folder with the system's own launcher (xdg-open, then gio, then kde-open), and
                the system's environment for every program the app starts: under an AppImage it drops the AppImage's
                libraries and GTK modules, which break the browser a launcher starts. A launcher that fails is an error
                the interface shows with the address to copy (`LinkFailure`).
  redact.rs     masking tokens, numbers, addresses and names in tool output.
  names.rs      the chat titles and contact names the messengers keep, read per profile with their own offline
                `chats list` / `contacts list`, held in memory only, so doctor output and reports mask them.
  terminal.rs   opening a tool's interactive setup in the user's terminal: the line runs in the user's own shell
                (`paths::user_shell`) as a new window starts it, quoted for POSIX or fish, then `exec`s that shell so
                the window stays open; a shell the app does not know runs the line in `/bin/sh` first.
  agent_run.rs  `run_agent`: Claude Code, Codex or Gemini CLI opened in a terminal with a prompt saved to a private file
                (Fix › under an error, Open in on a guide, a community tool's check); only those three programs,
                found on PATH. One `AgentLaunch` button (`features/fix`) opens the last one used and lists the rest.
  drive_folders.rs Drive's folders for one profile: `folders browse` and `add` (the picker), `folders list` with each
                name from `catalog show --offline` (none until a sync copied it), and `folders remove`, after which drive's
                next sync drops what it copied from there.
  signin.rs     signing in inside the window: the tool's own `session start`, its stdin open for the answers.
  signin_steps.rs the tool's sign-in lines read into steps: QR code, pairing code, page to open, question, progress.
  bots.rs       a bot beside the personal account: the catalog's `bot.fields` through `config set --bot`, then the
                token on the tool's stdin to its own `bot auth set`; `bot list` for the names. See "Connecting a bot".
  sync.rs       the tool's own sync per profile, stopped by its PID; counts and stages out, when it last synced
                (for tg and max, only a run whose argv has `--all`).
  background.rs whether a messenger's own `serve` keeps a profile current (`server status`), and starting it through
                its own `server install` (only when it has no unit) and `server start`. Never systemctl itself.
  enrichment.rs memo's search rewriting: its own `models consents show`, `set <provider> --model <m>` without `--yes`
                (what would be sent, to which host, how many records, the cost, whether a key is found; changes
                nothing), `set --yes` and `revoke`. The interface sends a provider and model; Rust runs `set` only for a
                pair memo's own `show` lists in `offered`. `--yes` runs only from the consent step, and turning it off
                deletes what the model wrote. A memo sync's `enrichment` (sent, failed, cost, why) rides on its summary.
                The provider key goes through memo's own `models keys set <provider>` on stdin (`run::stream_with_input`), never an
                argument, environment variable or log line, and is masked out of any refusal; memo keeps it in the
                system keyring or a private file. `models keys remove` forgets it. Whether this memo has the command is
                read from its own `models keys set --help`. Counts, hosts and whether a key exists only; never a record
                or a key. `bin/enrichment-e2e` runs these
                functions against a real memo in a throwaway home.
  search_harder.rs memo's "search harder": its own `models search-consents show`, `set <provider> [--model]
                [--base-url]` without `--yes` (where a search goes, what it sends, the price per million tokens, whether a
                key is found), `set --yes` from the consent step only, and `revoke`. memo offers no list here, so Rust
                checks the provider (anthropic, openai), the model's name and the address before they become arguments.
                The Search page's button runs `search all --only notes --harder --no-record` for the shown query (a recorded run keeps the query in memo's run log), first page
                only; memo's `order` entry under `missing` is the outcome (no entry: the model's order stands). Gated on
                `searchHarder.minVersion` in the catalog, null until a memo with it is on npm. Keys are enrichment's.
  mail_agent.rs Email's mail agent: memo's own `schedule agent` and `schedule remove` for `mail-triage`, its last run and
                the day's spend from `schedule list`, waiting proposals from `review status`. memo writes the timer.
                The interval is the owner's (`--every {every}`, one of the catalog's `choices`): the page shows the
                schedule's own and turns on at the one chosen, the catalog's `every` (30m) only when none is known.
  report.rs     bug reports: what this computer adds, masked, and sending to the WireCat API (docs/dev/report-api.md).
  deep_link.rs  `wirecat://open/v1/…` links (Tauri's deep-link plugin, with single-instance first so a click reaches the
                running window): parsed to the v1 grammar of cli-core's `links.ts`, checked against its shared fixture
                `src/domain/links-v1.fixture.json`; anything else reaches the interface as a refused link, its text
                dropped. One `Channel` (`deep_link_listen`) carries them, the link that started the app first. A link
                only opens a page (`src/features/links/open.ts`): a task, the task list on a filter, a proposal's row
                on Memory, a tool's sync, a day on Digests, a chat or message on Conversation, a project (`project/<key>`, by key
                or `project:<n>` reference) on Tasks searched by it; a person (`person/<id>`) and an unknown project
                have no page yet and say so, with the reference to copy.
  digests.rs    the Digests page's past days: a digest's runs, read from the files its schedule keeps
                (`<memo state>/schedules/<name>/runs/`; memo has no command that lists a schedule's runs), one
                day per date, its newest run: `<stamp>.report.json` (cli-core's checked `wirecat.report/1`) or, for an
                older run, its `.md` text. Shown unmasked, an exception to rule 4 like memory.rs, never logged.
                `digest_notify` shows a system notification (notify-rust: Tauri's plugin has no click on desktop); a click
                (Windows: its Open button) opens that day through `deep_link::open_target`. The interface polls the
                morning digest's `digest_list` every minute while it runs (`src/features/digests/watch.ts`) and
                announces a run newer than the last one it announced.
  digest_book.rs the Digests page's table: `memo digest list|add|edit|run|pause|resume|remove` (the contract in
                docs/dev/plans/2026-11-09-people-clients-digests.md, "Digests by name"), every write with `--from-app`.
                A memo without `digest list` has only `morning-digest`, kept as a schedule: the page reads it through
                digest_schedule.rs and refuses what that memo cannot do (a second digest, several times, weekdays,
                sources, a run that is not sent) before memo runs.
  digest_schedule.rs the older memo's morning digest: `schedule list` (its time, routes, last run with its cost, the
                day's spend and caps; memo's other schedules read only), `schedule agent morning-digest` to make it or
                change its time, `schedule remove` for off, `schedule run` for Get now; and `digest backfill [name]
                --since-time --until-time --json` (`--from --to` when memo 0.131.72 or older says the option is
                unknown), first without `--yes` for the price, then with it. Routes are checked to the two shapes
                `--deliver-to` documents; a memo without `digest backfill` answers "unknown command" and the page says
                it needs an update.
  digest_editors.rs the Digests page's two editors for one digest, both owner-only writes memo itself guards: What to
                collect is `digest brief show|edit --file -|edit --undo|reset [name]`, How it looks is
                `templates show|edit|preview|reset report/<name> --channel --locale`. Text goes on stdin; `templates`
                has no `--file -` yet, so it gets `/dev/stdin` (none on Windows: there a save says to use the
                terminal). A memo without either command answers "unknown command" and the card says it needs an
                update.
  sync_schedule.rs an account's sync on a timer: the tool's own `<bin> <profile> schedule command <bin>-<profile>
                --every <d> -- <catalog sync.schedule.args>`, `schedule list` and `schedule remove`. The tool writes the
                timer. Its latest run (and `failing_since`) shows under the account, and a failed sync from this window
                clears once a later run succeeded, timed or listed by `syncLast`.
  notifications.rs news from the WireCat API for this version and OS (docs/dev/notifications-api.md); only https links pass.
```

Biome enforces the arrows (`biome.json`, `noRestrictedImports`): `domain` imports nothing above it, `platform`
knows no UI, `ui` knows no data, and only `platform` imports `@tauri-apps/*`.

## How an install travels

1. `ToolRow` calls `useTools().install("drive")` (`src/features/tools/store.ts`). Installs queue; one runs at a time,
   because two global npm installs at once can corrupt each other.
   From the row, and from the setup's Install step, the install first asks `store_preflight` (`preflight.rs`) when its
   turn in the queue comes, so a batch's later tools are checked against the ones installed before them; a warning
   holds the session at step `preflight` in the row's panel (or its setup row) until the owner goes ahead, and the
   queue moves on without it.
2. `platform.install` opens a Tauri `Channel` and invokes `install_tool` with the tool **id** only.
3. Rust looks the id up in the compiled catalog, checks Node.js, picks a global folder it may write to without
   administrator rights (`npm_prefix.rs`), then runs `npm install --global <package>@<latest version>` there — or `pnpm add --global` when pnpm owns the copy that is already
   installed, so an update never leaves a second copy behind.
4. Each output line is masked and sent as a `log` event; steps arrive as `step` events.
5. Verification re-resolves PATH (npm's bin folder may be new), finds the binary and runs `--version`. If the app
   would still run another copy (one of the same or a newer version), the result says which. When npm installed into
   the user prefix (`~/.local`, `%APPDATA%\npm`) and a fresh terminal does not find the tool, its folder goes on the
   user's PATH (`terminal_path.rs`); the `done` event carries what changed as `pathFix`, or the line to add by hand.
   WireCat's own Node.js folder goes on PATH the same way right after its setup, on every OS. Open apps keep their old
   PATH, so the setup tells the owner to restart them; this is why an AI app opened before the install misses a tool.
   A network failure of `npm view` or of the install is retried once after 3 s; disk, proxy and certificate, and
   Windows long-path errors get their own reasons with the next step to take.
6. On an update, the tool's own `skill status`, then `skill install --for` each copy that is `stale`, each command
   line in the log (`skills::refresh`): a copy an older version wrote. A `missing` place stays empty, an `unversioned`
   file is somebody's own, and Hermes is left out (`--for hermes` changes Hermes's settings). What was rewritten, or
   why not, rides on the `done` event; a failure is a warning beside a working update. The Agents page then asks that
   tool again (`useAgents.recheck`).
7. Every event is parsed by `InstallEventSchema` before the store sees it.

## Finding tools

An app started from a desktop launcher does not get the PATH a terminal has: nvm, pnpm and Volta add theirs in
shell profiles. `paths.rs` merges the process PATH, the login shell's PATH (`$SHELL -lic`) and known folders
(nvm versions newest first, pnpm, Volta, Homebrew, `%APPDATA%\npm`). When a tool has several copies, the app runs the
newest one that starts (`tools::program`), and the Tools page lists that copy first, then the others to remove. PATH
order cannot pick it: a launcher's bare PATH makes the login shell order its folders unlike the owner's terminal
(a profile that adds pnpm only when it is missing puts it first there, after nvm in a terminal). Equal versions keep
PATH order. Versions come from running the binary, never from `npm ls`, because a tool may be installed by npm, pnpm
or both.

## Account rows

Every list of a tool's accounts (the Manage panel, the setup's Sign in step) is `AccountList` of `AccountRow`
(`src/features/tools/`): the name, signed in or not, when it last synced, Sync where the tool syncs per profile, and
"⋯" (`ui/SplitButton`, `compact`) with Check, Choose folders (drive), Settings (tools with per-profile settings: the
Settings page opens on that profile), Sign in again, and Remove account. A check opens under its own row
(`CheckResult.tsx`), folds away with its ×, and shows doctor output as `redact.rs` left it.

Remove account (`RemoveAccount.tsx`, `account.rs`) uses cli-core's shared `<profile> account remove` once the installed
version has it (`accountRemove.remove.minVersion` in the catalog; null means not released yet and counts as missing).
The owner chooses to keep or delete the account's data, `account_remove_plan` runs the `--dry-run` and the dialog
lists what goes and what stays, grouped by kind with paths under their folder; only the confirm runs `account_remove`
with `--yes`. Rust masks every target and message, drops the account id from the store entry, and maps cli-core's
`account-remove.*` reasons to `RemovalRefusal`; the app's own guard (a sync, an install or a sign-in for that account)
answers `busy` with the `RemovalHolder`. After it succeeds the row folds away and the list reloads. A tool without the
command falls back to `account_sign_out` (`session end`), whose dialog lists the catalog's `removes` and `keeps`, read
from each CLI's source, and says to update the tool.

## Uninstalling and storage

Uninstall removes **every** copy of a tool, each with the manager that installed it (`npm uninstall -g` with the npm
beside an nvm copy, `pnpm remove -g`, `bun remove -g`, `volta uninstall`), then checks that the binary is gone. It
never touches data.

**Remove this copy** (`remove_copy`, `install::remove_copy`) takes one unused copy away and leaves the one the app
runs. The interface names the copy by the path `detect_tools` gave; Rust refuses it unless it is still one of the
copies on PATH and not the one `tools::program` picks. Only npm and pnpm: npm runs with the copy's own folder as its
prefix (the npm beside an nvm copy when there is one), pnpm only when the copy sits in `PNPM_HOME`. Any other copy is
refused and the page shows the command to run by hand.

Data folders are not guessed from names: `storage.rs` mirrors cli-base's `resolvePaths` (`src/paths.ts` in
cli-base): `<PREFIX>_{CONFIG,STATE,CACHE}_DIR` first, then the XDG layout on Linux and macOS, `%APPDATA%` and
`%LOCALAPPDATA%` on Windows. The catalog records each tool's folder name and prefix (`storage`), plus the archive
every tool shares (`sharedStorage`: `WireCat`, `WIRECAT`). Keep `storage.rs` in step if cli-base changes.

Deleting is refused while a tool that uses the data is installed: a tool's own folders until it is uninstalled,
the shared archive until no tool is installed (emptying it while tools are installed goes through the tool's own
`store reset`, see "Backups and clearing storage"). Before `remove_dir_all`, each path must be absolute, at least four
components deep, not the home folder, and named for the tool. A store moved with `MESSAGING_STORE` and sign-in
tokens in the system keyring are never touched. After the last tool is uninstalled the app offers, once, to delete
everything that is left.

## Skills and the archive

Each tool writes its skill (`SKILL.md`) to `~/.claude/skills` and `~/.agents/skills` with its own
`skill install --for claude|agents`; the catalog's `skill` templates hold those commands, `skill status` and
`skill show`. The app never reads a `SKILL.md` file itself. A tool from before `skill status` answers "unknown command" and its cells show "unknown";
memo falls back to the skill list in `doctor --json`. Agents are found by program on PATH or by their settings
folder (`skills.rs`); which folder each agent reads comes from the agents' own docs. The skill table files each agent found under the
first folder it reads (`skillColumns`), so Cursor, which reads both, heads one column, not two.

Shared storage is described by `store info --json` (`storeInfo` in the catalog). `compat.rs` asks every installed
package at once, read-only, and the answer of the tool that reads the newest schema fills the Storage page; tables and
checks go to the first messenger in that ranking. A tool from before cli-core's shared `store info` (zm, drive, memo
before their release with WireCatLabs/cli-core#1973) answers "unknown command". `archive.rs` picks known fields by name,
because the generic masker would hide counts called `accounts` or `emails`. The breakdown is read only when the tool
prints `by_provider`, and the file facts (journal mode, pages, migrations, last backup) only when it prints
`migrations`. The same tool answers `storeTables` (every table with its kind and rows), `storeTableSizes` (the same with
sizes; it reads the whole file, so the page runs it on request) and `storeCheck` (the health check, also on request:
about 90 s on a 3 GB file). A tool that answers "unknown command" gets "arrives with the next update". Of a check only
counts leave Rust, never the chats it finds behind. The interface calls the shared database "storage" everywhere, never
"archive". Folder entries on the Storage page are names and sizes from `storage.rs`; what each one is lives in
`src/domain/files.ts`. `open_folder` opens a folder or one entry in it by name: Rust joins the name to the catalog's
folder after refusing anything but a plain child, opens a directory, and shows a file or a link in its folder instead of
opening it.

## Can each tool read storage

The store records a schema version and the oldest schema a tool must read to open it (`min_compatible`); each tool
reads up to the schema of its cli-core (`speaks`). `src/domain/compat.ts` turns the tools' answers into one state per
installed package: reads it, can't read it (and the update that fixes it), will move it on its next run past what other
installed tools read (from `schema.upgrade`), or can't say. A tool too old to say is placed from the store's own list of
the tools that opened it (`clients`, matched by command and version) or from a refusal it printed ("written by a newer
version (schema N, needs at least M"). The schema moves on a tool's first run after an update, not on install, so
the Tools page asks again right after an install and warns, with the other tools' updates to queue, before that run.

## Backups and clearing storage

**Back up now** runs `store backup <file>` (`storeBackup` in the catalog) of the tool `archive.rs` asks, the installed
one that reads the newest schema, never with a profile. The copy goes to a hidden `.<name>.db.partial` in
`~/WireCat backups`, is deflated into one `wirecat.db` entry of `wirecat-store-YYYY-MM-DD-HHMM.zip` (local time, `-2`
for a second in the same minute, mode 600 in a 700 folder), and is removed whatever happens. The home folder, not
Documents: macOS and Windows often sync Documents to a cloud drive, and the zip is every message, unencrypted. Before
it starts, the folder's disk needs one and a half times the store free. `VACUUM INTO` prints nothing, so copying
progress is the copy's size against the store's; compressing reports each percent. Cancel kills the tool's process
group and removes both partial files. Events travel on a `Channel` (`BackupEvent`).

**Clear storage** runs `store reset --no-backup --yes` (`storeReset`). The button stays off until the tool
answers `store reset --dry-run` with its `tables`; an older tool asks for a profile there, or does not know the option.
The dialog lists the store's files and every table with its rows from that preview, says what stays, warns when the
preview says a sync holds the file, and needs the word `clear` typed. "Back up first" is on by default and runs the
backup above; nothing is cleared unless the zip is finished. The CLI itself refuses while another process has the
store open, so a running sync or import is never cut off. Only one backup or clear runs at a time (`Running`).

## The Memory page

What agents concluded about the owner and the people around them, read from memo (plan
`docs/dev/plans/2026-10-31-memory-page.md`). memo 0.131.82 or newer (`memory.minVersion` in the catalog: 0.131.80 and 0.131.81 crash on
`relationships list include:ended`, which the page calls); an older one
answers "old" and the page offers its update. `memory_read` runs `memories list`, `facts list`, `actions list --brief`,
`actions list status:proposed --brief` (each `--limit 500`) and `agents list --limit 30` at once and returns one newest-first list.
`actions list` also holds People's `identity_link` and `identity_split` rows and every rejected `relationship`, and has no `kind:` field, so Rust drops them after the read, with any kind the page has no words for and no text of its own; one page reads up to four of memo's pages of what waits so they cannot push it back; a failed activity log still
shows the entries. memo names each record's project (`project_name`) and gives every action its parts: `verb`,
`target_name`, `chat_name`, the whole `text` and, for a findings batch, `counts`. The page writes the row's line from
them in the interface language; memo's English `summary` is the fallback for a verb the page has no words for. A findings batch's sources come from `actions show` when its row opens; a mail batch has none there, so each finding shows the emails it cites. Every write takes one validated ref (`memory:N`, `fact:N`, `action:N`; memo names actions by a bare
number) and runs a fixed command:

- **Confirm**: `memories confirm`, `facts confirm`; for an action `actions confirm`, which makes a task in the account
  that would act and sends nothing. A findings batch is decided by its id with the fingerprint `actions show` gives:
  `actions confirm <id> <finding ids…> --fingerprint <hash>`, or `actions reject` when none is ticked. A mail findings
  batch (`mail_findings`) is decided the same way without `--fingerprint`, which memo neither gives nor needs for it;
  `actions confirm <id>` with no finding named would accept every one.
- **Discard**: a memory `invalidate` (stale), a proposed fact `reject`, an accepted decision `reverse`, an action
  `reject`. Other facts can only be forgotten.
- **Correct**: Rust reads the old record with `show` and writes the owner's `add --supersedes` with the old kind,
  scope, project, subject and sources (the old record itself when none is left); the text goes after `--`. memo
  corrects facts only when they are accepted decisions.
- **Forget**: `memories remove` / `facts remove` erase the record, its links and its search entry. Actions have none.

The text is the owner's own, shown unmasked like the Search page's hits, and it never goes into a log or a report:
`--no-record` keeps a failed correction's text out of memo's run log. The app starts memo with no terminal, which memo
takes as nobody's run and refuses to let decide, so every confirm, discard, correct and forget also passes
`--from-app`: memo records it as the owner's. Reads (`list`, `show`) never pass it. It is the app's word that the owner
clicked, not a check memo can make; `run::command` also removes `AI_AGENT` and `CLAUDECODE`, so no run is an agent's.

**When a source changes.** memo marks a memory or fact whose cited source changed, went or was contradicted with
`source_review: {id, cause}` on its reads, and never changes its status. The row shows a badge and waits under Waiting for you (the `review` tab) as
well as under In use (`entryInTab` in `domain/memory.ts`). Opened, `memory_review_show` reads `review show <id>`, checked
to be a `memory_source_review` of that record, and shows each source as it was cited and as it is now. The answers:
Still true (`review confirm`), Dismiss (`review reject --reason=<the owner's words>`), Edit (the record's own
correction, which can start from an agent's suggested wording) and No longer true (the Discard mapping:
`memories invalidate`, or `facts reverse` for a decision; memo has none for other facts, and it is never a revoke).
After every answer the record is read back with `show` (`memory_show` after an Edit), so the page shows what memo
now holds rather than what it expects. `review confirm` and `reject` refuse with exit code 2 and their whole answer on
stdout; Rust reads it, so the page words memo's reason (`proposal.wrong-state`), and a success must list the id under
`decided`. Rust's tests use memo's real answers (`src-tauri/tests/fixtures/memory-review/` and `memory-add/`). A source review is never listed as an action: memo refuses `actions confirm` on it.

### Adding to memory

The Memory page's Add to memory panel (plan `docs/dev/plans/2026-11-01-memory-add.md`), four steps on one surface:

1. **Source**: pasted text (`memo sources add -`, the text on stdin), a link (`sources add <url>`, read once by memo
   from this computer) or a file chosen in the system's file window (`memory_pick_file`). Rust keeps the picked path
   and `memory_source_add` takes no other; a name that is not UTF-8 is refused there. Every add passes `--from-app`,
   so its subjects are the owner's. Values go as one word (`--title=`).
2. **Saved**: what memo kept in its own words (`kept: text | copy`, `read: no-text`, `truncated`, `duplicate_of`), the
   stored text from `sources show`, and the people and organizations named in it from `sources mentions`. The ticked
   ones become `--subject` of the suggestion.
3. **Facts**: `sources suggest <ref> --provider=<the owner's pick> --from-app` (`--rescan` to read it again) names the batch in `batch`; Rust reads it back with
   `actions show` and uses it only if every finding cites this document and it is proposed (or already decided, when
   memo says it reused an earlier reading; the panel then says so). The panel decides it like any findings batch:
   `actions confirm <id> <ticked> --fingerprint … --from-app`, or `reject` when nothing is ticked. Ticking is
   confirming.
4. **Done**: the source and what was kept, and as "About" only the subjects `sources show` says the source is linked
   to.

The reader is never picked by the app. Settings → "Reading for facts" lists `sources readers` (available, signed in,
model, whether the text leaves the computer, whether it reads files; an unknown answer counts as the riskier one) and
saves the owner's pick with `sources readers set <id> --from-app` only when he presses Use this reader, so arrow keys
through the radios save nothing. memo refuses Ollama and the API readers without a model (`needs_model`): the app
passes the model memo already lists for that reader, and with none it refuses the pick and asks the owner to choose
one in memo. memo lists its `ai-model` reader first: it reads with the model and the one key set in Settings → "AI
model" (`models ai set`), so it needs no model of its own and the page marks it recommended. While that setting has no
model or key, memo answers a `problem` for it; the page shows its own words and a button to "AI model", never memo's
text. A key reader without a key points there too: this section has no key field. Each command line is one constant in
`memory_add.rs`. memo's `source.*` and `reader.*` refusals come back as ids and are worded in `messages-add.ts`. A run
fed on stdin (pasted text) never returns memo's message, which can quote the input escaped or cut: an unknown refusal
comes back as `memo.refused`.

### Relationships

Relationships between people, organizations and projects are rows of the same page (CRM relations plan, PR 11).
`memory_read` also runs `relationships list confirmed:false` (an agent's proposals), `relationships list standing:confirmed --limit 500` and `standing:ended --limit 100` (the links, each with
its `standing`; `standing:` replaces `include:ended`, and sources report too many links to read them all, so **Reported** rows come only from a memo that does not know `standing:`, which falls back to `include:ended`, then the plain list) and `relationships roles
list` (the owner's role lists, from the memo with cli-core's role lists). A memo without one of them leaves its part out
and the rest of the page as it is; any other failure (a busy store) fails the read as a failed memories list does. A row sits under the end
it starts from (a person, an organization or a project), says the other end and the role, and carries a standing chip:
**Proposed** waits in Waiting for you, **Confirmed** (the owner's) and **Reported** (a source such as a CRM says so, nobody
confirmed it) are In use, **Ended** is with what no longer holds. A proposal is `relationship:<id>`, decided through
memo's own review as every other proposal kind: `review confirm <id> --from-app`, or `review reject <id> --reason
"rejected in WireCat Desktop" --from-app` (memo needs a reason). A link that holds is `link:<id>` and is not changed
here. Bulk approve leaves relationships out: each is approved in its row. A built-in role reads in memo's `labels` for
the interface language, else the app's words; the owner's own role shows the label the owner gave it. The role picker
offers the row's `role_list`; Add a role runs `relationships roles add <list> <id> --label <name> --from-app`
(`memory_role_add`), the id made from the name. A row whose end is a document shows that document's name, folder, last
change and Open (its web address only) from memo's `from_document`/`to_document`. The chip is `src/shared/StandingPill.tsx`,
its rule `src/domain/relationships.ts`, for any page that shows a relationship.

## The Contacts page

Who is who across sources, from memo (`people.minVersion` in the catalog; memo 0.131.75 is the first
with `memo people show|review|scan|link|unlink|unmerge` and the kinds). The page is «Contacts» (id `people` in
`src/app/sections.tsx`, so links to it still work); the CLI command stays `memo people`. The table never holds the
whole list: `people_page(kind, page, size, query, sort)` reads one page, `people list kind:<kind> [name:"…"] --sort
<sort> --limit <size> --page <n>`, and memo's exact `total` feeds the pager; turning a page, changing the order or
typing a name (after 300 ms) reads that page alone. `people_read(kind)` reads `people review --limit 500` for the
matches beside a one-row `people list kind:<kind> --limit 1` that tells a memo with kinds from one without, and runs
at the same time as the first page. A row's contact shows the phone and the email one under the other, else the
messenger handle (memo 0.131.76 does not say which messenger), else a dash. The kinds are tabs: people, companies,
newsletters and notifications, strangers (a real name, no tie with the owner), unsorted; `people_kinds` counts them
with one `kind:<k> --limit 1` read each, two at a time, never holding the table back; a count memo gives only as a
floor reads «N+». A memo older than kinds refuses the kind word (`query.unknown-field`) or `--sort` (`input.invalid`);
Rust then reads the plain `people list --limit 5000`, the page shows no tabs, hides people with no name by default and
takes each contact from the person's accounts. A memo that has kinds but not this one (0.131.75 has no `stranger`)
refuses it with `query.unknown-value`; that tab is empty. A row's name is `personName` in `src/domain/people.ts`: memo's
`display_name`, else the cleaned name, else the phone, address or handle, never «null #id»; any page that names a
person from a list row uses it. Opening a person runs `people show person:<uid>`: every account grouped by source,
with the scope (personal or work) of every account that saw it, the merges that joined others into this person
(`merge:<to>-<from>`), and the matches open on them. Asked about someone merged away, memo answers with the person they
are part of now (`merged_into`), and the page says so. memo has no profiles here, so nothing is picked for the owner:
every move names the person and the accounts he chose.

- **Matches** (`identity_link` proposals) carry memo's `joins` (`person`: join two people; `identity`: move one account),
  `signal` (agent, phone, email, guest email), the people a shared phone points at, and who suggested it (memo's own
  matching, an agent, or a person who may have no name). A match is decided with `review confirm|reject <id> --from-app`,
  a rejection with the owner's reason (`--reason=`), only if `people show <ref>` lists it open on that person now.
  memo answers a refused decision with exit code 2 and its whole answer on stdout; Rust reads that answer, so
  `identity.stale` and `proposal.wrong-state` are worded on the page. A decided card stays in place until the next read.
- **Match details** compare the people side by side, row by row: where each comes from (a Bitrix24 contact opens on
  its portal, `src/domain/source-link.ts`; a Telegram username on t.me), phones, addresses, handles and companies, last
  contact, messages from them, deals and tasks, and their latest messages, which open in WireCat's conversation view.
  `people_profile(ref)` reads them; memo's context lacks the message count, phone and address, so Rust also finds the
  person's own row (by ref) among `people check` of their name, at most 50 rows; the page's own list row, when it
  holds the person, wins for the counts, and a count neither knows shows «—». Companies are current memberships only. What they share is said in words and
  marked on each side: memo's evidence, else a phone or address two of them have; no ids. Merge and Not the same use the
  card's actions (`MatchActions.tsx`); the dialog keeps what was compared after a decision and says what happened.
- **Move accounts to a new person** runs `people unlink <identities…> --from person:<uid> --from-app` with only accounts
  the person's own read listed, each once, and never all of them: memo matches a name it does not know exactly to the
  nearest person, and `--from` makes memo refuse an account that sits on someone else.
  Every account is shown; one whose ref cannot go back as one safe word is never offered for moving.
- **Confirm a link** («Check links») runs `people links resolve <who> keep --from-app --json`: the owner says the
  person's accounts are right, and the doubt goes away. A memo too old to know the command is reported as "update".
- **Undo a join** runs `people unmerge merge:<to>-<from> --from-app`, only for a merge the person shows, behind a dialog
  that lists the accounts that go back.
- **Search** filters the list by name; an account (`telegram:4411`, an email address) is looked up with `people show
  <account>` (`people_find`), and the person is shown only if one of their accounts is exactly that one, never memo's
  nearest guess.

After each move Rust reads the person again; the page forgets every person the move touched and reads both lists again
without closing anything. The answers in Rust's tests are memo's real ones (`src-tauri/tests/fixtures/people/`). Names,
addresses and account ids are the owner's own data, shown unmasked like the Memory page and never logged.

## What agents do with the tools

The Agents page has one row per agent found. Each opens to what to fix, the tools (skill and MCP per profile), the
agent's recent sessions and the tasks it holds.

- **MCP.** The app no longer adds MCP servers; it lists the `<bin>-<profile>` ones an agent already has. No tool
  removes its server yet, so Disconnect runs the agent's own `claude mcp remove <name> --scope user` or `codex mcp remove
  <name>`, for a name `mcp.rs` builds from the catalog and a validated profile. What is registered is read from
  `codex mcp list --json`, and from the agents' settings files where no command lists without starting every server:
  `~/.claude.json` (`mcpServers`, user scope), `~/.cursor/mcp.json`, `~/.gemini/settings.json`,
  `~/.config/opencode/opencode.json` (`mcp`). Only names that look like a WireCat server leave Rust; commands,
  environment and headers never do. zm, drive and memo serve MCP but cannot register themselves yet. Not read yet: a
  Claude Code home moved with `CLAUDE_CONFIG_DIR`, OpenCode's `opencode.jsonc` (JSON with comments) and project-level
  servers. `run::command` drops the agents' own variables (`CLAUDECODE`, `CODEX_THREAD_ID`…), so the tools never
  record the app's calls as an agent session even when the app was started from an agent's terminal. It also sets
  `WIRECAT_CALLER=desktop`, so cli-core records the app's own calls as `via: "desktop"` and keeps only their failures;
  `mcp_server::start` removes it, because the server it starts outlives the call and serves agents and apps.
- **Sessions** come from the runs the Logs page already read: runs grouped by `agent.kind` and `agent.session_id`
  (`src/domain/agents.ts`). A run with `argv` and no agent was started by a person; one without either comes from a
  tool too old to record it.
- **Tasks.** `tasks list --json=id,key,claimed_by,claimed_until` for every profile of tg, max and wa, so no title reaches
  the app; the holder (`claude-code:<session>`, `codex:<thread>`, an agent's name) is matched to its agent.
  Release runs `tasks release <task> --holder owner`, because the app may itself run inside an agent's terminal.
- **Check** joins these with `paths::in_terminal` (is the tool on the PATH a terminal has, without the folders the
  app adds; one item for every tool it misses, whose Fix runs `fix_terminal_path` and then asks the tools and their
  skills again) and counts the commands each profile's permissions block
  (the Permissions block's `permissions_show`).
- **Skill preview** shows `skill show --json`, the SKILL.md the installed version ships, beside the installed copies'
  versions. The app does not read an installed SKILL.md, so what an update changes waits for a CLI that prints it.

- **Hermes and OpenClaw** (plan `docs/dev/plans/2026-10-25-agents-openclaw-hermes.md`). Found by program, or by
  their settings file (`~/.hermes/config.yaml` or `$HERMES_HOME`, `~/.openclaw/openclaw.json` or
  `$OPENCLAW_STATE_DIR`); a bare `skills` folder is left by other installers and does not count. OpenClaw reads
  `~/.agents/skills`. Hermes is its own target, `hermes`, which only a tool whose `skill status` lists it can write
  (cli-base's `--for hermes`); until then its cells say "needs a newer" tool and offer nothing. The app never writes
  either agent's settings. Their PATH is not a terminal's: Hermes runs commands in `bash -l` started from its gateway's
  PATH (read from its systemd unit, else the system PATH), and OpenClaw from its gateway's, fixed with
  `tools.exec.pathPrepend`; the check shows the shell-profile line or OpenClaw's own `config set` to copy, never runs it.
  `chats.rs` reads which chat apps drive them, by name only: Hermes's `gateway_state.json`, OpenClaw's
  `channels list --json`. **Connect** (any found agent) installs the chosen tools' skills, then for a chat-driven agent
  sets the profiles the owner ticks to read only (`config set permissions.<group> readonly` for each catalog group,
  then the tool's own count of what still writes), then checks that agent's PATH. Nothing is preselected; MCP is not
  part of it. No tool removes its skill yet, so **Disconnect** lists the folders to delete and who else reads them.

Every write on the page (skill install, MCP add or remove, task release) opens a dialog with the exact command.

## One package, several tools

A row can ship inside another tool's package (`partOf` in the catalog): the same `bin`, `package` and `storage`. No
row does today; Email was one over memo's package until it moved to mail-cli's own `mail`. Install, update, uninstall and cancel act on the owner's id in Rust (`catalog::owner`) and in the
interface (`ownerId`), so the package is installed once and the install queue never runs it twice. Detection and
update checks run once per package and report it for every part. Storage, bug reports and the Node.js removal check
count packages, not rows. A part has no skill of its own (`skill: null`) and stays out of the skills matrix. With
no interactive `setup` in the CLI, its `signIn.command` is shown to copy and never run. The owner's run logs are read once;
runs whose command starts with the part's `commandPrefix` are filed under the part on the Logs page.

## Searching what a tool stored

The Search page (`src/features/search/`) asks one installed tool, for one profile the owner picks, to search what it
keeps on this computer: `search_store(id, profile, query, limit, page)` runs the catalog's `search` template
(`search.rs`). Nothing is picked for the owner: the profile list starts empty, and memo, which has no profiles, gets
none. Each template reads the local store only, checked in cli-core: tg and max `search messages --offline --backend
archive` (`searchServer` returns before any server call for `archive`, and `--offline` makes the connection throw),
wa `search messages --offline` (it has no server search), zm `search all --only meetings --max-meetings all
--offline` (words only: meetings refuse fields, phrases and OR), drive `search --offline`, memo `search notes` (with `--exact` before drive 0.51.0 and memo 0.125.0, whose search by meaning ignored
field filters; `search.exactBelow` in the catalog, read against the installed version) and
Email mail's `search messages --offline --backend archive`. All pass `--no-record` and put the query after `--`, so
`-chat:x` is a NOT term and never a flag. A template without `{page}` would show its best results and no pager.

The query is the tool's to parse. A refusal comes back as `queryError` with the closed `query.*` reason and the
tool's span, drawn in the query bar until the text changes; memo and drive count the span one or two places past the
text, so it is kept inside the query. zm prints its refusal as a note beside an empty, incomplete answer, read the
same way. "unknown option" or "unknown command" means the tool is too old (remembered per program, like `runs.rs`),
and any other refusal is shown in the tool's words. The tool's notes (`missing[].why`, what it did not cover, and its
stderr lines) are shown as text; its suggested next steps are never run.

Values come from the tool's own read-only lists (`search_values`, `search.values` in the catalog, with
`--offline`): tg, max and wa `chats list`, `contacts list` and `tags list`. A chat or a person goes into the query by its
id, which names exactly one (`chat:"-1001762030832"`); the row shows the title and @username, and once picked the
name shows muted under the bar (`namesOf` in `QueryBar.tsx`). The bar itself always holds the text a terminal search
would take: nothing is drawn over a term. Every value is quoted by
the rule of cli-base's parser (`quoteValue` in `src/domain/search.ts`). A name that fits several chats or people is
refused with `details.candidates`, and one that fits nobody with `from:X — nobody matches "X"` or `no chat matches
"X"`. cli-core's `pickPerson` took only the exact names when there were any, so `from:"Ярослав"` listed only the
people called exactly that; from the cli-core release with name patterns (WireCatLabs/cli-core#2861) it also lists
those whose name contains it. The page (`nameChoices`) offers every person or chat whose name, @username or alias
contains the typed text, from the tool's candidates, its lists and the message counts below, most messages first, each as a
button that puts its id in place of that term. `scripts/search-fields-check.mjs` runs every field, value form and
date against the installed tools through the same Rust code (`cargo test real_batch`).

Which fields the bar suggests is static, in the catalog: `commands --json` gives `query.fields` for list commands
only, not for `search messages`, `search notes` or `search all`, and a refused field's `details.fields` lists the
whole parser's vocabulary, the same for every tool. The lists were checked against the installed tools' answers.
Before a tool is chosen, the bar offers the keys of every installed one. Their order is the owner's own use: each
search that comes back with an answer counts the keys it used (names only, never values) in `localStorage`
(`wirecat.search.keys`), and the most used five lead the list. Unused keys follow a fixed order per kind of data
(`POPULAR_FIELDS`), then by group. A messenger's `from:` and `chat:` values carry how many messages each person wrote
and each chat holds, all time (`message_stats` by sender and by chat, as the Analytics page counts). The most used
come first, and senders who write only in groups are added to the contact list.

"Write the query" (`QueryDraft.tsx`, `query_writer.rs`) needs the tool and the profile chosen. The agent's query is
tried once with `search_store(…, limit 1, page 1)` before it is offered. It is put in the bar with the count when the
tool accepts it, even when the count is 0. A refused parse is sent back to the agent once, with the parser's reason and
message only, and a second refusal puts nothing in the bar. A name that fits several people or nobody shows the same
choices as above. The agent writes part-of-value matches by default: a topic word by its start (`договор* аренд*`,
`subject:отчет*`, `content:акт*`), never `*word*`, which reads the whole word list; a person or chat as part of the
name (`from:*Мила*`, `chat:*Дизайн*`), a file name or mail folder the same way. Keys with listed values, ids, dates,
addresses and links stay exact, and so does `from:"Сергей Иванов"` for a full name. Keyless tools (Zoom) get plain
words. A tool on a cli-core older than name patterns refuses them with `query.unsupported-operator` (matched by the
reason, never the message); the query is then tried once more as `withoutPatterns` gives it (`from:Мила`), without
asking the agent again. Such a tool matches `from:Мила` as part of a name only when nobody is named exactly that, and
reads a bare `word*` in the message text only.

## Profiles and diagnostics

The CLIs differ: `tg`, `max`, `wa` list profiles with `account list --json`, `drive`, `gcal` and Email's `mail` with
`session list --json` (by name only: mail's address stays in Rust), `zm` in `doctor --json`, and `memo` has none. The catalog records each tool's command and the JSON shape to read.
Doctor output is masked in Rust and summarised in `src/domain/doctor.ts`; the raw (masked) JSON stays one click away.

Every command the app runs carries `WIRECAT_CALLER=desktop`, and cli-core keeps such a run only when it fails, unless the
command says `--record`. The reads the app makes on its own pass `--no-record`; what the owner starts (Check, sync, store
check, backup, reset) passes `--record`, so the Logs page shows it whether it worked or not
(`what_the_owner_starts_is_recorded` in `catalog.rs`).

## Signing in inside the window

Each tool with `signIn.methods` in the catalog signs in without a terminal (step 2 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`): tg (QR or phone), max (QR or a token from web.max.ru), wa (QR), zm, drive and gcal (the
browser), and Email (Microsoft in the browser, Gmail or another server with an app password). "Sign in here" opens a
dialog, and `sign_in(id, method, profile, inputs)` runs that method's words for the profile the owner named. With `--json` the tool prints each step as a JSON line on stderr, from cli-core's `signInSteps` (0.443) and
`loginQr`: `qr`, `pairing_code`, `open_url`, `needs` and `progress`. `signin_steps.rs` reads them, the tool's notes and
its stdout answer into steps on a `Channel`; `signin.rs` runs the tool with its stdin kept open
(`run::stream_stoppable`). A `needs` step draws a field, masked when `secret`; the answer goes through
`sign_in_answer(id, value)`, which writes it and a newline to that run's stdin and wipes it (`zeroize`). Only with
`--answer-stdin` does a tool read answers; without it a tool with no terminal refuses, so an agent's shell never waits.
A tool too old for the flag answers "unknown option", which becomes "update it on the Tools page"; "Open terminal" stays
the second choice.

What never leaves the window: a QR code, a pairing code and a sign-in link are login tokens while valid, so they travel
on the Channel only, and the plain copies the tool prints beside them (the code's drawing, the link's line, the agents'
note) are dropped. The account's id and name stay in Rust (max's "logged in as" line is dropped too). No step is logged
or put in a report, and an answer is never kept in the store or repeated in an error. The QR comes as a half-block
drawing, so `src/domain/qr.ts` turns it back into modules and the dialog draws an SVG, dark on white in both themes.
Zoom without its own app's Public Client ID asks for it as a `needs` step (`client_id`, zoom-cli PR #337), answered in
the window beside a checklist for making the app; zm keeps the ID only once the sign-in works. The checklist's values
come from `zm app --json` (`zoom_app_setup`, catalog `signIn.appSetup`), or from `wizard.ts` for an older zm. An older
zm fails instead (reason `zoom.client-id-missing`, or only the words `zoom.client_id`): the dialog then saves the ID with
zm's own `config set` and starts again. Transcript files (`source files`) are the way without an app.

From the open CLI PRs of TASK-132: wa links by number too (method `phone` with `--answer-stdin`, whatsapp-cli PR #346):
the number is a `needs` step, the code to type on the phone a `pairing_code`, the history wait `progress` events, and
QR codes carry `expires_at`, so the window counts down. The QR method passes no `--answer-stdin`, so a released wa
still signs in, and the text of its history wait is still read. Email runs `mail <profile> session start --json
--answer-stdin` (mail-cli PR #128): the server is asked only when discovery finds none, the app password is a secret
question whose hint names the provider's page, OAuth is `open_url` with a pasted `redirect` fallback. A wrong answer
ends the run; Try again goes back to the plan with the address kept, and non-secret answers (a server, a phone number)
refill their field, while a password, a token or a login code never does. mail's reasons (`mail.login-refused`,
`mail.app-password-required`, `mail.imap-disabled`, `mail.host-unreachable`) and drive's (`oauth.missing`,
`oauth.expired`, `provider.rate-limited`) have their own words and action in `signin-failure.ts`. After Drive signs in,
the done step shows a folder picker (`tools/DriveFolderPicker.tsx`, wrapped by `signin/DriveFolders.tsx` with the
sign-in's failure words): `drive_folders_browse(id, profile, parent)` runs `folders
browse [--parent <id>]` one level at a time, and `drive_folder_add` runs `folders add <id>` for each ticked folder
(catalog `folderPicker`; ids are checked in `drive_folders.rs`; Shared with me is a list, not a folder, and cannot be
added). The same picker opens later from an account row's "Choose folders" (`DriveFoldersSettings.tsx`), beside the
chosen folders with Remove each. A CLI too old for any of this answers "unknown option" or "unknown command", which the window reads as "update
it", with the terminal as the fallback.

Every sign-in is one wizard: `SignInPath.tsx` draws the method's steps from `wizard.ts` (before you start, the tool's
own steps, done) and lights the one on screen. A failure is read by `src/domain/signin-failure.ts` into a known reason
(too old, QR expired, login in use, Zoom app missing, browser never came back, declined, timeout, network, cancelled,
ended), a plain message and cause (`messages-wizard.ts`), one action and a fallback, the tool's own words under Details.
The order of work on setup flows, desktop first and the CLI changes after, is in [setup-flows.md](setup-flows.md). Cancel, Escape and Stop call `sign_in_stop`: SIGTERM to the tool alone, five seconds for it to
answer with what it kept (WhatsApp's history), then the whole group is killed. Switching method (tg's QR or phone)
stops the running sign-in first.

The dialog opens on the plan (`Plan.tsx`, text in `messages-plan.ts`): the steps, what will be asked, what access the
tool gets and what stays on this computer, each claim checked in the tool's source. Email's methods are its providers
(`signIn.pick`): the plan starts with that choice, and a failed try goes back to it. What the plan asks before the run
reaches the tool only where the method names it, checked in `signin.rs`: the address after the method's `address`
flag (mail's `--address`; mail finds the server itself, and asks the address in the window when the plan leaves it
empty), an app password in the variable a method's `password` names (no method uses it since mail asks the password on
stdin), and the owner's own Google client JSON as text, written for that
run to a 0600 file in a 0700 folder and passed with the method's `clientFile` flag (`--client-file`); the folder goes
when the run ends, as the tools keep the client with their sign-in. The JSON stays outside the store, beside
Telegram's keys. "Use my own app" is WC-SECR-25's override from the window: a client file for Google (drive,
gcal, Gmail), or for Microsoft the Application ID saved first as the method's `clientId` setting
(`microsoft_client_id`, for that profile). A mail without `--answer-stdin` (0.14) answers "unknown option" and is
sent to its update, with the terminal meanwhile; the parser still reads its `Open Microsoft sign-in: <url>` line. gcal before WireCat's Google app refuses
with "no Google OAuth client"; the dialog then goes back to the plan with the own-app choice open. Mock scenarios:
`?signin=email`, `?signin=gcal`, `?signin-fail=email`.

Gmail opens on two ways side by side: an app password (the default) or Google in the browser with the owner's own
client. That client is its JSON file or its ID and secret typed in the plan; typed, they become the same
`{"installed": {client_id, client_secret}}` JSON and take the client file's path above (0600 file, `--client-file`),
so the secret never reaches a command line. For providers whose steps the window knows (`src/domain/mail-signin.ts`:
Gmail, and from the address Yandex, Mail.ru and iCloud, the domains mail-cli's table lists), the plan has a second step
of its own: the provider's steps with buttons to its pages, and the password field. The password waits outside the
store, like Telegram's keys, and answers mail's `needs` password question when it comes (spaces dropped for Gmail). A
refusal of that password (`mail.app-password-required`, `mail.login-refused`) is a new run back on that step, the field
empty and focused, the reason above it. For any other provider mail asks in its own words: its prepare text
(`prepareText`, one note per line) is read back by `readMailNotes` into a numbered list with its links as buttons, the
server under Details, and its lines for maintainers (`Sources`, `All providers`) left out.

Telegram's first sign-in needs the owner's own app keys: tg opens my.telegram.org/apps and asks for App api_id and App
api_hash (its default `--app browser`; the app never passes `--app auto`). Beside those two questions the dialog shows
the steps on that site with two pictures of it (`src/assets/signin/`, the owner's screens with the app name, date and
api_id painted over). The keys typed in the dialog stay in a variable outside the store until the sign-in ends or the
dialog closes, so a try after Telegram refused them starts with them filled in; tg itself saves them only after
Telegram accepts them. `src/domain/telegram-signin.ts` reads tg's failure line into a cause, a fix and the way back
(enter the keys, the number, a new code or the password again, or wait); `src/domain/signin-notes.ts` turns cli-base's
keyring warning into a calm notice with the file's path. Mock scenarios: `?signin-fail=tg-apiid|tg-flood|tg-code`,
`?signin-keyring=file`.

## Connecting a bot

tg, max and wa each run a bot of the messenger's own Bot API beside the personal account (cli-core's `bot` group). Their
catalog entry has a `bot` block: `set` is `<profile> bot auth set --record --json`, `list` is `bot list`, `token` is
the shape the interface checks (`telegram` is `<digits>:<key>`; MAX and Meta document none, so `opaque` is one line
without spaces), `create` and `docs` are links, and `fields` are settings `auth set` needs first: WhatsApp's
`phone_number_id` and `waba_id`, digits that `config set --bot` takes as a JSON string. "Add a bot" under a tool's
accounts opens `BotSignInDialog`: a name the owner types (never a default), where to get the token, the fields and
the token, then the bot's name as the tool reported it. `bot_sign_in(id, profile, token, fields)` sets the fields,
then writes the token to the tool's stdin and closes it (`run::stream_with_input`); off a terminal `auth set` reads
stdin to its end, so no `--answer-stdin` is needed. The tool asks the messenger whose token it is before keeping it, so
a refused token never replaces a working one. The token is never an argument, never in the store (the form clears it
when it is sent), and masked in any message before `redact.rs` reads it; it is wiped in Rust once written. The bot's
name and username leave Rust unmasked: they are the bot's public identity, shown as "Bot @name is connected".

`bot list` names every bot on this computer but still wants a first word, so the catalog passes a fixed `wirecat`;
it acts on no profile. A bot-only name is not in `account list`, so the Tools page lists bots on their own with a
Bot badge. A WhatsApp bot's settings make `account list` show its name as a personal profile that is not signed in.
Each bot row shows its status from `check`, which is `bot list --check --no-record --json`: the tool asks the messenger
whether each saved token still works. A token that stopped working offers Reconnect, which opens the same dialog for
that name. Remove asks first, then runs `remove`, `<profile> bot auth remove --record --json`.
Mock scenarios: `?bot=<tool>`, `?bot-step=token`, `?bot-fail=<tool>|old|ids`, `?bots=none|stale|remove-fails`.

## The MCP server for browser apps

ChatGPT and Claude in the browser reach a tool through its HTTP MCP server behind the owner's tunnel (step 3 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`). The Manage panel has a "Connect an AI app" section, closed by
default because agents on this computer use the tools directly. One server serves every profile; the app names one in
each call. Zoom serves no HTTP MCP and Email is part of memo, so neither has the section.

**The guide** (`ConnectGuide.tsx`) aims at a working call from the app, not at a running server. Six steps in a rail,
on one surface that only Finish closes: choose the app (ChatGPT, Claude, another), the public address (Tailscale's own
steps, done ones as ticks, a Cloudflare tunnel on the owner's domain, or a tunnel the owner runs), start the server (Funnel, then `mcp server start`, with each
part's progress; nothing runs before the owner presses Start the server), check the address, add it in the app, and
test it. A failed start leaves Funnel on: turning it off and on again can drop the public name for minutes, and a retry
uses the same address.

**Check the address** (`public_address.rs`, `mcp_server_public`): the app reaches the server from its own servers, and
this computer cannot ask its own DNS, because MagicDNS answers the Tailscale name with the 100.x tailnet address. So Rust
asks public DNS-over-HTTPS (dns.google, then Cloudflare, then NextDNS), and with an address fetches the resource's
metadata from that public IP, the name kept for TLS. A missing name (NXDOMAIN) means Tailscale has not published it yet,
which takes up to 10 minutes: the step checks every 15 s with a progress bar and does not let the owner go on. A
published name is enough to go on, since a computer often cannot open its own public address; something else answering
(another status) is an error with "Go on anyway"; no DNS service answering (some networks block them all) lets the owner
go on with a warning. The step logic
is plain TypeScript (`connect-steps.ts`); what to click in each app is one table, `connect-apps.ts`, with the vendors'
pages it was read from, and takes the address and login code from `status`, so a different address shape changes no
instruction. The test reads `status` every 4 s while it is on screen: an app counts once it logs in, or reaches the
server, after the guide opened (an older login does not), and the guide ends at the first `tools/call`. From cli-core
0.453 `status` reports per app `last_request_at`, `last_tool`, `last_tool_at` and `tool_calls_today` (the tool keeps
names and times only); an older tool reports none, and the guide says to check the answer in the app. The step's
heading takes focus when the step changes; steps fade in (`.step-in`), instantly under reduced motion. "If ChatGPT
says it couldn't discover OAuth settings" shows the issuer and endpoints that `mcp_server_oauth` reads from the running
server on 127.0.0.1 (a computer often cannot reach its own Funnel address), keeping only addresses on the connector's
own origin. After setup the section lists the apps with their last call, and the tool's row on the Tools page shows the
latest one, read when the row appears and when its panel closes. "Server details" keeps the row described below.

Every action is the tool's own command from `mcpServer` in the catalog. `mcp server start` takes the tunnel's address
and a port, which `mcp_server.rs` checks first (https, or http on this computer; no path; a port of 1024 or above) and
only then puts in place of `{url}` and `{port}`. The tool runs `mcp --http` in the background with a marker in its
environment, and `stop` refuses a server it did not start (one started in a terminal: the row says to stop it there).
`status` gives the port, the address for the browser app, the login code with when it runs out (the row reads it again
then; the tool renews it), and the apps holding a login, each by the name it gave itself: the row says "calls itself",
since anyone may register any name, and Rust drops control and bidirectional characters from it. "Forget all logins"
runs `mcp --revoke` after a dialog. "Copy config for desktop apps" copies `mcp config` (tg, max, wa).

The login code, the address and the apps' names leave Rust unmasked, an exception to rule 4 like the sign-in QR: the
owner needs them as they are. They are never logged and never put in a report. A tool from before `mcp server`
(cli-core 0.445; memo and drive need their own release with it) answers "unknown command" or "too many arguments";
`status` then reports it unavailable, and the row says it arrives with the next update, with nothing to press.

## Tailscale Funnel for the MCP server

The guide's address step offers Tailscale Funnel, set up by the app, or a tunnel the owner runs (step 4 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`). Tailscale's part has three steps, each with Check (the fourth below,
a free public port, is checked there and done by the start step); the window re-checks when
it regains focus. All of it is `tailscale.rs` running the `tailscale` CLI found on PATH (or inside the Mac app with
`TAILSCALE_BE_CLI=1`, or in Program Files):

1. **Install.** macOS and Windows: `tailscale_install.rs` follows `Tailscale-latest-macos.pkg` or
   `tailscale-setup-latest.exe` on pkgs.tailscale.com to the versioned file, checks its `.sha256`, saves it in
   Downloads and opens it; the system's installer asks for the password. Linux (Debian and Fedora families): the newest
   package from Tailscale's apt `Packages` or yum `primary.xml`, checked against the checksum there, shown selected in
   the file manager (the opener plugin's `reveal_item_in_dir`, D-Bus `FileManager1.ShowItems`). The second option, or
   the only one where there is no package (openSUSE, Arch), is Tailscale's own commands for this release:
   `tailscale_linux.rs` reads `ID`, `VERSION_ID` and the codename from `/etc/os-release` and builds the lines of
   pkgs.tailscale.com/stable/#linux (Fedora 41+ in the dnf 5 form of Tailscale's `installer.sh`) only from releases on
   its lists, so os-release text never reaches the terminal. They add Tailscale's package source, so system updates
   keep it current; when Tailscale is installed and that source file is missing, the done step offers the commands.
   Where the lines start with `curl` (apt, `install.sh`) and `curl` is not on PATH, the first line installs it with the
   apt-get, dnf or zypper found on PATH.
   NixOS gets its configuration line; any other system gets `install.sh` and links. Every step links its section of
   wirecat.dev/en/docs/desktop/tailscale-funnel. On Linux the step also needs this user as
   Tailscale's operator (`tailscale debug prefs`, a hint only; a refused write says the same).
2. **Log in.** `tailscale login`, only while `BackendState` is `NeedsLogin`; the page it prints is opened when its host
   is login.tailscale.com or console.tailscale.com. The step polls until the state is `Running`.
3. **Allow Funnel.** The node's `CapMap` has `https` and `funnel`; otherwise the guide opens the admin console's DNS or
   Access controls page.
4. **Connect.** `tailscale funnel --bg --https=<public> http://127.0.0.1:<port>`, then `mcp server start` with the
   public address. The public port is one of the tailnet's Funnel ports (`funnel-ports` in `CapMap`; 443, 8443, 10000)
   that nothing in `funnel status --json` uses, the same as last time when free, so the address and the browser apps'
   logins survive. No `--yes`: a question about the owner's own settings fails instead of overwriting them.

What the app turned on is recorded in `<app local data>/dev.wirecat.desktop/tailscale-funnels.json`. Stop, and a server
that fails to start, turn off only that port (`tailscale funnel --https=<public> off`), and only while it still points
at the recorded local port; never `funnel reset`. The row says when a Funnel is still on with the server off.

The computer's Tailscale name, the Unix user name (for the operator line, shown to copy only: a terminal would run its
`sudo` at once) and the login and approval links leave Rust unmasked, an exception to rule 4 like the MCP login code;
they are never logged or put in a report. The raw `tailscale status` never leaves Rust.

## Cloudflare tunnel for the MCP server

The second choice in the guide's address step, for when Tailscale cannot give an address (plan
`docs/dev/plans/2026-10-27-cloudflare-fallback.md`). The choice's card says, before it is picked, that Cloudflare
decrypts the traffic and can read what the tools send back (NEED-102). The shape is Funnel's: one name on the owner's
domain, the three paths of each tool to its local port, everything else 404. `cloudflare.rs`:

1. **Download.** `cloudflare_install.rs` takes the standalone cloudflared for this OS and CPU from the latest GitHub
   release, checks the SHA-256 GitHub states for the file, and keeps it in `<app local data>/dev.wirecat.desktop/
   cloudflared/`. No installer, no service (rule 6).
2. **Account.** `cloudflared tunnel login` with a home folder of its own (login always writes `~/.cloudflared/
   cert.pem` and, with one there, exits 0 without logging in) and a PATH with no browser opener, so cloudflared prints
   the page and the app opens it, only on dash.cloudflare.com. The certificate goes into the OS keyring.
3. **Address.** The owner types a name under the domain picked at login. `tunnel create` and `tunnel route dns`; a
   name outside that domain comes back under it, which the app compares and explains. The tunnel's credentials go into
   the keyring and the certificate is deleted. The certificate and credentials touch the disk only for the length of
   these commands, owner-only, and are removed after.
4. **Run.** `config.yml` with the ingress rules, then `cloudflared tunnel --no-autoupdate --config … --metrics
   127.0.0.1:<free port> run <id>` with the credentials in `TUNNEL_CRED_CONTENTS`, in the background; the app waits
   for `/ready`. A tool added or removed restarts it. Stop takes the tool's paths off and stops cloudflared with the
   last one, by its recorded PID and only while that PID is still the app's cloudflared. An unknown tunnel ("Failed
   to get tunnel", which cloudflared retries for ever) ends the wait at once.

`tunnel.json` beside it records the name, tunnel id, routes, PID and metrics port, no secret. The owner's hostname
leaves Rust unmasked, an exception to rule 4 like the Tailscale name: the owner needs it as it is; it is never logged.
cloudflared's own output stays in Rust, except the last line of a failure. An error that names the hostname can still
reach a bug report the owner sends from it (RISK-32).

## Syncing from the app

Plan: `docs/dev/plans/2026-10-27-desktop-sync.md`. The catalog's `sync` block holds each tool's own words: tg and max
`<profile> messages sync --all`, zm `<profile> meetings sync`, drive `<profile> sync`, memo `sync` and Email `sync --only
mail` (one lock for both, so one running key). WhatsApp has none to start: it syncs while `wa <profile> serve` runs,
and its `note` says so. Every sync gets `--record`, so the tool's own `runs list` holds the run and answers "last
synced"; drive answers from `status` (`last_sync`, set only when nothing is pending, and `pending`). The messengers also
get `--timeout 120m` (max 0.82 refuses hours): without it cli-core gives every command 30 seconds. The app's own limit is three hours, so the
tool's limit ends the run first and keeps what came in (exit 9, shown as "Time limit reached").

`sync_run(id, profile)` runs the words with `run::stream_stoppable`, like sign-in; `sync_stop` sends SIGTERM to that
process alone and kills its group after five seconds. memo before 0.118.0 ignores the signal (BUG-17), so its Stop
takes the five seconds; from 0.118.0 it stops between batches of mail. One sync per package and profile, none while the package installs, and an install
refuses while one runs. A tool on a cli-core that prints `{"event":"progress","step":"sync","chats","chats_done","fetched"}` on stderr
gets a bar that counts chats ("Chat 4 of 40 · 1,240 new messages"); the others (DEBT-4) get a stage read from their
notes, from a fixed list, and an indeterminate bar. Only counts leave Rust: chat titles, chat keys in the notes and account names
stay behind. Of a failure only the tool's `code`, `reason` and failed run id leave (RISK-44: its message can name a
chat); the window's words are the app's own, and "Open the run on Logs" opens that run. The Manage panel has one control per profile (Accounts), or
one for a tool without profiles; the Tools row shows the running sync, its result, or the last sync of its only
profile, with a Sync or Stop button beside the name. A result stays until dismissed and says what to do next.

## memo's first run

`notes_setup.rs`, card `src/features/tools/MemoSetup.tsx` on memo's details, catalog key `notesSetup`. Three steps, each
one of memo's own commands: `folders add <path>` (listed with `folders list`), `sync --only notes`, and
a search model. The model step lists the catalog's `choices` (EmbeddingGemma, shown only as the best local model, its
word "model" linking to the `terms` memo gives; e5-small as the lighter one) as memo's `models list` reports them, plus
the model in use when it is neither. The model in use, not downloaded yet, gets `models download <id>` (memo asks no
terms to be accepted, so the card needs that memo, `minVersion`), and the card then runs the notes sync, since
memo embeds notes only then. Another model is downloaded if needed, then `models set <id>` (`notes_model_use`); memo
returns what it will embed again and an estimate, and the next syncs do it while search keeps working. Rust takes a
model id only when memo's own list shows it on the card. The folder comes from the system's window: `notes_pick_folder` opens it from Rust through tauri-plugin-dialog,
which has no capability for the webview, so the interface can only ask Rust "choose a folder" and send back what it
returned. `notes_folder_add` checks that path again (absolute, a real readable folder, never an option) before memo
sees it. Failures reach the interface as a closed list (`NotesProblem`: unreadable folder, disk full, offline, too old,
busy, other), never memo's message, which can name a folder. A memo that prints progress lines with `--json`
(`{"event":"progress","step":"notes"|"download","done","total","unit":"files"|"bytes","label"}`, redrawn with `\r`;
`counted_of` in `sync.rs` takes the last piece) gets determinate bars, as a `counted` event of the sync or the download;
an older memo prints none and the bars have no end. A label is kept only when it is a plain id, never a path. Stop kills
the download. Folders show with `~` for the home folder; folders another computer or Drive keeps are left out.
Removing a folder is `notes_folder_remove(id, folder, deleteNotes)`: `folders remove <id>` keeps that folder's notes
searchable; with the owner's confirmation in a dialog it adds `--allow-delete --yes` and deletes that folder's notes from
memo's store (never files on disk). The id is checked first (`checked_folder_id`); a memo without the command answers
"unknown command" and the card says it is too old.

## The Tasks page

Plan: `docs/dev/plans/2026-10-31-tasks-page.md`. memo's project tasks only (`project:*`); tasks made from messages stay
on the Agents page. `task_board.rs` runs memo's own `tasks list|counts|show|history|add|update|move|assign`,
`tasks comments list|add`, `people list|add` and `projects list`, with `--json --no-record` (a failed edit would otherwise keep the owner's notes in
memo's run log). The owner's search goes last, after `--`, since memo reads every word after it as the query; the page
adds the board's default (open work, and what was closed in the last 14 days) unless the search names `state:` or
`closed:`, and Rust narrows it to `project:*`. Text goes as `--title=<text>`, so a leading dash is never an option.
Titles, notes and names leave Rust unmasked, an exception to rule 4 like the Memory page: the owner's own data on the
owner's own page, never logged or put in a report.

Every write passes `--revision` with the revision the page read. memo refuses a stale one (`task.stale`, exit 3) and
Rust answers the task as it now is with its latest change, so the page says who changed what instead of overwriting
it. A revision moves only for changes a person could conflict with (from memo 0.131.4, cli-core 0.516.0); an agent
renewing its claim or setting a follow-up time does not. A dropped card calls `tasks move <key> [--status s] --before|--after <key>`: memo gives it a
priority between its neighbours, which is also its order in the column, and says when its label (low, medium, high,
critical, one per quarter) changed. Neighbours memo renumbered to make room are read again with `tasks show`.
`tasks add` sets the due date and state in the same write. A task is moved to another project with
`tasks update <key> --project <key>`: memo answers it with its new key there (the old one still finds it), and the
page carries everything it keeps by key over to the new one. memo refuses to move a task that has subtasks
(`task.has-subtasks`, their keys in `details.subtasks`), and a subtask that keeps its parent (`task.is-subtask`,
`details.parent`); the dialog then offers to move it on its own, the same write with `--parent none`. Comments are a thread of their own, oldest first; adding one moves no
revision. A comment's text and a new person's name go after `--`. The page's minimum memo is the catalog's
`taskBoard.minVersion`; the catalog's `tasks` key means something else, a source of agents' claims.

## Account groups

Settings has a block per memo account group (WC-ACCT-13): a column for `all`, then one per saved group, a card per
account with its profiles in each tool (`tg work`, `b24 work`), from `memo groups list`. `all` is every account; memo
computes it and never saves it, so its column takes no drop and its cards are only copied out (a move from it would be
an add anyway). `personal` is an ordinary saved group. An account in two saved groups is allowed and highlighted
(`also_in`); a profile named like a group is offered as a suggestion, never added by itself. Dragging a card moves it
(`groups move`, one write), Alt, Ctrl or ⌘ held at the drop copies it (`groups add`); each card's Change menu does the
same from the keyboard, and takes it out (`groups remove`). The board changes at once and slides back with memo's reason
when memo refuses (a saved entry such as a bare `email` that names more than one account). A new group is a draft
column until its first account: memo makes a group on its first `add`. A memo before `groups` answers "unknown
command", and the block says the groups arrive with its next update.

The member is the source memo prints, `telegram:102` or `email:me@work.example`: the owner's own account ids on the
owner's own page, an exception to rule 4 like the Tailscale name, needed to tell accounts apart and to name one back to
memo. It is shown only when no tool recorded a profile for the account, and never logged or put in a report.

The board is `src/ui/Board.tsx` (`useBoardDrag`, `useSlide`, `Board`, `DragCopy`, `cardClass`), shared with the Tasks
board: `canDrop` refuses the card's own column, and `all` with the reason the board then says; `copyable` makes Alt,
Ctrl or ⌘ at the drop a copy. A change is said once memo made it, a refusal by the board's `putBack`.

## Growing the app

A new area (accounts, memory, people…) is one entry in `src/app/sections.tsx` and one folder in `src/features/`.
The app's own Node.js (`node.rs`) is the nodejs.org LTS build, checked against `SHASUMS256.txt` and unpacked into
`<app local data>/dev.wirecat.desktop/node/v<version>`, outside the shared archive that Storage may delete.
`paths.rs` puts its `bin` first only when the user's own Node or npm cannot install tools, so `system.rs` and
`install.rs` pick it up by path and no caller changes. `profile.rs` owns the marked PATH block in shell profiles
and the user PATH in the Windows registry.

## Loading without layout shift

**Rule:** what the user sees first has the final shape. Data fills slots; it never adds rows, grows blocks or pushes
the page down. Only the user's own click may change the layout.

- **Render the real layout from what is known up front.** The catalog (`catalog/tools.json`) gives every tool's name,
  icon and order before any command runs, so a list of tools renders its real rows at once and only the values wait.
- **`<Skeleton chars={n} />`** (`src/ui/Skeleton.tsx`) stands in for a value inside a line: `n` characters wide, the
  line's own height. Size `n` to the usual value (`7` for `24.19.0`). Use it in a cell, next to a label, in a sentence.
- **`<Skeleton className="h-… w-…" />`** stands in for a block. Give it the block's final height, not a token one: a
  row of a list is one skeleton per expected row at that row's height, not one short bar.
- **`label`** goes on the first skeleton of a group only; it is announced as `role="status"`, the rest are silent.
- **`<StableText value variants />`** is a label that switches between known texts ("Check again" / "Checking…")
  and keeps the width of the widest.
- **A slot that may appear later** (a note, an error, a "Tasks held by others" box) reserves its room with
  `min-h-[…]` on the wrapper, or sits below everything that loads, where growing moves nothing.
- **Numbers** use `tabular-nums` (or the mono font), so a count changing from 9 to 10 does not move its neighbours.
- **`.reveal`** fades content in where its placeholder was. Under reduced motion it is instant.
- **Global:** `main` reserves the scrollbar's gutter, so a page growing past the window does not narrow and re-wrap,
  and `src/start.tsx` renders after the bundled fonts load, so the first frame is not laid out in a fallback font.

**How to check.** On the browser build:

```sh
pnpm build && pnpm preview --port 1478 --strictPort
node scripts/layout-shift.mjs tools agents --port 1478 --slow 3   # --port is required; use your own free port
```

It prints per page the Cumulative Layout Shift (`CLS`, how far things moved, 0 is best) and `grew`, how many pixels
the visible part of the page grew after its first frame, which CLS does not see. A page is done when both are under
the budget (`--budget 0.01`, `--grow 8`); the script exits 1 otherwise. `--shots 150,2000,4000` saves screenshots of
the loading stages; check them in light and dark (`--dark`). `?slow=3` on any browser-build URL stretches every
mock wait the same way.

## Design review

`.impeccable/` holds the approved mock-up (`mocks/decision/rack.png`), its measured spec and review captures.
`scripts/capture.mjs` screenshots the browser build with the mock platform for any state.
