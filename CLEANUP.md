# Cleanup

- `bin/setup-mcp-registry-key` — one-off; remove once the MCP Registry key is set and CI publishes. 2026-10-25
- pnpm store: `pnpm store prune` fails with "Permission denied" on `/home/leemour/Projects/AI/arendamed/directus/data/database` (Docker-owned); fix the folder owner, then prune to drop the `wcat-fixture-*` test packages. 2026-10-30
- `/home/leemour/Projects/AI/cli-core-release-memo36` and `/home/leemour/Projects/AI/cli-memo-release-core0564` — release clones on main, files changed within the last 3 hours (another session may use them); remove after the releases. 2026-11-05
- `.claude/worktrees/store-check-gaps` (branch `fix/store-check-gaps`): worktree for the setup store check and the storage-line row shift; remove once its PR is merged. 2026-11-07
- `/home/leemour/Projects/AI/ssign/.claude/worktrees/upstream-held` (branch `upstream/windows-held-file`): source of Le-Syl21/ssign#21; remove after it merges or closes. 2026-11-07
- `.claude/worktrees/journal-2276` (branch `docs/journal-need-2276`): journal PR; remove once merged. 2026-11-07
- `.claude/worktrees/mcp-teardown` (branch `fix/mcpserver-teardown`): FIND-219 fix; remove once merged. 2026-11-07
- `.claude/worktrees/risk-110` (branch `fix/risk-110-batch-preflight`): worktree for RISK-110, the store check on each queued tool's turn; remove once its PR is merged. 2026-11-07
- `.claude/worktrees/journal-night` (branch `docs/journal-night-1107`): journal PR; remove once merged. 2026-11-07
- `/home/leemour/Projects/AI/visage/.claude/worktrees/ssign-0111` (branch `ci/ssign-0111-split-signing`): ssign v0.1.11 pin and NEED-2222 follow-up; remove once its PR is merged. 2026-11-07
- `/home/leemour/Projects/AI/ssign/.claude/worktrees/sync-0111` (branch `sync/upstream-0.1.11`, also on origin): fork alignment with upstream v0.1.11, merged as WireCatLabs/ssign#12; remove worktree and both branches. 2026-11-07
- `/home/leemour/Projects/AI/wirecat-desktop-wt-registry-notice` (branch `feat/registry-stale-notice`, 3.4 GB `src-tauri/target`; /home was at 100% during its build): NEED-2285 notice; remove the worktree once its PR is merged. 2026-11-08
- `src-tauri/src/signin.rs` Inputs.password and catalog `signIn.methods[].password`: no method sets it since mail asks the password on stdin (DEBT-32, TASK-132). 2026-11-07
- `.claude/worktrees/setup-cli-events` (branch `feat/setup-cli-events`): TASK-132 worktree; remove once its PR is merged. 2026-11-07
- `.claude/worktrees/memo-setup-progress` (branch `feat/memo-setup-progress`): memo part of TASK-132, already cherry-picked into `feat/setup-cli-events`; remove now. 2026-11-07
- `docs/images/own-review-noprov-{light,dark}.webp`, `docs/images/own-confirm-{light,dark}.webp`: no longer shown in the README after the review redesign (TASK-138); the risky review and the AI check replaced them. 2026-11-08
- `/home/leemour/Projects/AI/wirecat-desktop-wt-review-v2` (branch `feat/own-tool-review-v2`, its own `src-tauri/target`): TASK-138 worktree; remove once its PR is merged. 2026-11-08
- `src/features/tools/messages-own.tsx` keys `syncs` and `noSync` (en, ru, es): unused since the review shows the sync under "What it says it does" (TASK-138). 2026-11-08
- `~/.cache/wirecat-fresh-install` (the throwaway home of the old `bin/try-fresh-install`; it now uses `~/.cache/wirecat-sandbox/fresh`); remove once the owner no longer needs that run's state. Also the test sandboxes `probe`, `demo1`, `storecopy` and `fresh` under `~/.cache/wirecat-sandbox/` made while building `bin/sandbox` (about 300 MB each with tools). 2026-11-08
- `/home/leemour/Projects/AI/wirecat-desktop-wt-people` (branch `feat/people-page`): People page worktree; its Rust builds used `/home/leemour/Projects/AI/wirecat-desktop-wt-memory-add/src-tauri/target`. Remove once its PR is merged. 2026-11-08
- `src-tauri/src/people.rs` `call_at`, `words`, `decision`, `text`, `number`, `strings`, `decided`: copies of helpers that PR #219 makes shared in `memory.rs`; use those once both are merged. 2026-11-08
- `/home/leemour/Projects/AI/cli-memo-wt-capture-710` and `/home/leemour/Projects/AI/cli-memo-wt-capture-711` (detached worktrees of the cli-memo checkout, with cli-core 0.615.0 added locally and never committed): tried to build memo #710/#711 to capture real answers for #219; neither builds on a published cli-core. Remove with `git worktree remove`. 2026-11-08
- `/home/leemour/Projects/AI/wirecat-desktop-wt-memory-add` (branch `feat/memory-add-source-review`, its own `src-tauri/target`, 5.7 GB): Add to memory and source-review worktree; remove once PR #219 is merged. 2026-11-08
- `refs/remotes/pr/710` and `refs/remotes/pr/711` in the cli-memo checkout `/home/leemour/Projects/AI/cli-memo`: fetched to read those PRs' JSON; delete with `git update-ref -d` once both are merged. 2026-11-08
- `const message = (e: unknown) => …` copies in `src/features/{digests,config,logs}/store.ts`, `src/features/agents/{connect,path-fix}.ts`, `src/features/tools/{TailscaleGuide,DriveFoldersSettings,CloudflareGuide,FunnelHelperGuide}.tsx`: replace with `errorText` from `src/shared/errors.ts` (PR #219 review, DEBT-9). 2026-11-08
- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-cli-messaging/79f5a4a1-d409-40cc-b7c0-7067c3614345/scratchpad/wd-main` (detached worktree of origin/main 7f6301d9, its `node_modules` is a symlink to this worktree's): made to check whether the onboarding tour test fails on main; remove with `git worktree remove`. 2026-11-09
- `/home/leemour/Projects/AI/wirecat-desktop-wt-merge-219`, `-wt-merge-221`, `-wt-r221` and branches `merge/memory-add`, `merge/people-page`, `rebase/people-page`: older attempts to land #219 and #221, stale since #229 landed them (2026-11-09)
- `/home/leemour/Projects/AI/wirecat-desktop-wt-people` (branch `feat/people-table`) and the remote branch `screenshots/people-table` (the PR's screenshots only): remove once the People table PR is merged and its screenshots are no longer needed. 2026-11-09
- `/home/leemour/Projects/AI/wirecat-desktop-wt-ai-model` (worktree) and branch `feat/ai-model-setting`: PR #262 is merged, the contract follow-up reuses the worktree on `feat/ai-model-contract`. Remove both after the follow-up merges. 2026-11-10
- `/home/leemour/Projects/AI/wirecat-desktop-wt-one-key` (worktree) and branch `feat/one-ai-key`: one AI key in Settings (NEED-2497 A). Remove both after the PR merges. 2026-11-10
- `/home/leemour/Projects/AI/wirecat-desktop-wt-people-pills` (worktree) and branch `fix/people-scope-pills`: People cards mark only work accounts. Remove both after the PR merges. 2026-11-10
- `/home/leemour/Projects/AI/wirecat-desktop-wt-search-analytics` (branch `fix/search-analytics-feedback`): worktree for the Search and Analytics feedback, remove after its PR merges. 2026-11-11
- `/home/leemour/Projects/AI/cli-core-wt-participants-count` (branch `feat/participants-count-query`): worktree for the query field Analytics asks for, remove after cli-core PR #2854 merges. 2026-11-11
- `/home/leemour/Projects/AI/wirecat-desktop-wt-settings-model` (worktree) and branch `fix/settings-model-feedback`: Settings feedback for 0.6.0. Remove both after the PR merges. 2026-11-11
- `task_chats` (Rust command in `src-tauri/src/commands/tasks.rs` and `task_board.rs`, `taskChats` in `src/platform/bridge.ts`, `types.ts`, `ChatTasksSchema`, the mock's `taskChats`): the Tasks page no longer calls it, memo now lists found tasks with `tasks list`. 2026-11-11
- `/home/leemour/Projects/AI/wirecat-desktop-wt-found-task-fields` (branch `feat/found-task-fields`): worktree for found-task fields on the board, remove after its PR merges. 2026-11-11
- `/home/leemour/Projects/AI/wirecat-desktop-wt-inapp-docs` (branch `docs/inapp-help`): worktree for the landing-shot audit and in-app help proposal; keep for stage 2, remove after that lands. 2026-11-11
- Vite dev server on port 1437 started from that worktree for captures; stop by its PID (`ss -ltnp | grep 1437`) when stage 1 is reviewed. 2026-11-11
- `/home/leemour/Projects/AI/wirecat-desktop/.claude/worktrees/dock-badge` (worktree) and branch `feat/dock-badge-dbus`: the dock badge (TASK-155). Remove both after the PR merges. 2026-11-13
- `/home/leemour/.cache/wirecat-sandbox/dockbadge`: sandbox used to check that the interface reaches `dock_badge`. Remove when no longer needed. 2026-11-13
- `/home/leemour/Projects/AI/wirecat-desktop/.claude/worktrees/meet-transcripts` (branch `feat/meet-transcripts`): worktree for the Meeting transcripts step; remove after its PR merges. Its Rust build went to the session scratchpad (`CARGO_TARGET_DIR`), nothing under `src-tauri/target`. 2026-11-13
- `/home/leemour/Projects/AI/wirecat-desktop/.claude/worktrees/nav` (branch `feat/navigation-tabs`): worktree for the navigation tabs (TASK-156); remove both after its PR merges. Its before/after screenshots and an export of `origin/main` are in `/var/tmp/claude/claude-1000/nav/`, remove with it. 2026-11-13
- `/home/leemour/Projects/AI/wirecat-desktop/.claude/worktrees/knip-links` (worktree) and branch `chore/knip-and-link-fixture`: knip and link fixture (DEBT-17, FIND-13). Remove both after the PR merges. 2026-11-13
- `/home/leemour/Projects/AI/wirecat-desktop-wt-setup-renderer` (worktree, with a 5.7 GB `src-tauri/target` copied from the pbx-signin-hang worktree) and branch `feat/setup-renderer`: the setup format v1 renderer. Remove both after its PR merges. 2026-11-16
- Branch `pr-assets/setup-renderer` on GitHub: holds only the screenshots the setup renderer's PR body links. Remove after the PR merges. 2026-11-16
- `/home/leemour/Projects/AI/wirecat-desktop-wt-ydisk` (branch `feat/ydisk`): Yandex Disk in the catalog; remove the worktree once its PR is merged. 2026-11-17
- `/home/leemour/Projects/AI/wirecat-desktop-wt-hubspot` (branch `feat/hubspot`): HubSpot in the catalog; remove the worktree and the branch once its PR is merged. 2026-11-18
- `/home/leemour/Projects/AI/wirecat-desktop-wt-install-heal` (worktree) and branch `fix/install-heal`: install healing for the app's pnpm. Remove both after the PR merges. 2026-11-27
- Local branch `bench/gemma-local` in cli-core (85d5e116): 7 commits never pushed, no merged PR; worktree
  `cli-core-wt-gemma-bench` already removed. Delete only after the owner says the Gemma benchmark commits can go.
  2026-11-08, updated 2026-11-28
- Local branch `feat/gemma-default` in cli-memo (8ab7f59): 1 commit not on any remote, no merged PR; worktree
  `cli-memo-wt-gemma-release` already removed. Delete after confirming a37d308 in feat/crm-landing carries it.
  2026-11-08, updated 2026-11-28
- Local branch `docs/people-clients-digests-plan` in wirecat-desktop (df76e877): 7 commits not on any remote and not in
  PR #248; worktree and remote branch already removed. Delete after the owner checks those plan commits. 2026-11-09,
  updated 2026-11-28
- Local branch `feat/clients-stage-confirm` in wirecat-desktop (b4b69f48): 3 commits never pushed, no merged PR (taken
  by bitrix24-cli-92 into feat/deal-stage-edit); worktree already removed. 2026-11-09, updated 2026-11-28
- Local branch `refactor/segmented-switches` in wirecat-desktop (6f139994): 2 commits not on any remote and not in PR
  #281; worktree wd-ui2 and remote branch already removed. 2026-11-10, updated 2026-11-28
- `~/.cache/wirecat-sandbox/seedwork`, `~/.cache/wirecat-sandbox/seedtest`: throwaway sandboxes used to probe and test
  the seed set loader (feat/sandbox-seed-set); `seedtest` holds seed version 2 from the update test, so it cannot load
  version 1 again. Remove with `rm -rf`. 2026-11-10
- `src/features/digests/messages-schedule.ts` `otherLine` and `src/features/digests/messages-book.ts` `notScheduled`:
  message strings no code reads (already unused before UX-159..162); drop them in a later change. 2026-11-10
- info/exclude of the shared repository: six lines '.bug717-*.mjs' from BUG-717, remove with the worktree — 2026-11-11
- src/assets/logos/zoom.png: replaced by zoom.svg (sharp, rounded) in fix/approvals-analytics-feedback; nothing imports
  the PNG any more. 2026-11-11
- bin/zoom-sync-facts (git-excluded): read-only check for the Zoom tile, remove after the owner has run it. 2026-11-11
