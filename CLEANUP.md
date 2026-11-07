# Cleanup

- `bin/setup-mcp-registry-key` — one-off; remove once the MCP Registry key is set and CI publishes. 2026-10-25
- `~/.cache/wirecat-fresh-install` — throwaway home of `bin/try-fresh-install` (PR #93); touched 2026-11-05 04:12, remove after that. 2026-11-04
- pnpm store: `pnpm store prune` fails with "Permission denied" on `/home/leemour/Projects/AI/arendamed/directus/data/database` (Docker-owned); fix the folder owner, then prune to drop the `wcat-fixture-*` test packages. 2026-10-30
- `/home/leemour/Projects/AI/max-cli/docs_ai/.worktrees/wa-0.29-report` (branch `docs/wa-0.29-report`) — cli-private PR #555 is still open; remove after it merges. 2026-11-05
- `/home/leemour/Projects/AI/cli-core-release-memo36` and `/home/leemour/Projects/AI/cli-memo-release-core0564` — release clones on main, files changed within the last 3 hours (another session may use them); remove after the releases. 2026-11-05
- Release clones `cli-core-release`, `tg-release`, `wa-release` in `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-wirecat-desktop/1843f46d-831c-4149-8277-335fa93ea262/scratchpad/` — clean and pushed; remove after the whatsapp release and cli-private#555. 2026-11-05
- `.claude/worktrees/store-check-gaps` (branch `fix/store-check-gaps`): worktree for the setup store check and the storage-line row shift; remove once its PR is merged. 2026-11-07
- `/home/leemour/Projects/AI/ssign/.claude/worktrees/upstream-held` (branch `upstream/windows-held-file`): source of Le-Syl21/ssign#21; remove after it merges or closes. 2026-11-07
- `.claude/worktrees/journal-2276` (branch `docs/journal-need-2276`): journal PR; remove once merged. 2026-11-07
- `.claude/worktrees/mcp-teardown` (branch `fix/mcpserver-teardown`): FIND-219 fix; remove once merged. 2026-11-07
- `.claude/worktrees/risk-110` (branch `fix/risk-110-batch-preflight`): worktree for RISK-110, the store check on each queued tool's turn; remove once its PR is merged. 2026-11-07
