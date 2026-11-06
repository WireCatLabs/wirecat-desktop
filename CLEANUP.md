# Cleanup

- `bin/update-memo` — one-off to bring memo to 0.103.0 (FIND-9); memo is at 0.131.41 now, remove. 2026-10-25
- `bin/setup-mcp-registry-key` — one-off; remove once the MCP Registry key is set and CI publishes. 2026-10-25
- `bin/free-build-space` — one-off disk cleanup helper; remove now that old worktrees are gone. 2026-10-25
- `bin/fix-hermes-path` — one-off for this machine; remove after it ran. 2026-10-26
- `mcp_add` / `mcp_check` (`src-tauri/src/mcp.rs`, `lib.rs`), `platform.mcpAdd` / `mcpCheck`, their mocks and `McpHealthSchema` — still in the code; the interface no longer adds or probes MCP servers. Code change, not a deletion pass. 2026-10-25
- `src/features/agents/AgentsMatrix.tsx` non-compact mode (folder paths, "Not installed: …" line, the `compact` prop) — only onboarding uses the matrix, always compact. Code change. 2026-10-25
- `/home/leemour/Projects/AI/visage/.claude/worktrees/agent-a359c23afa0cf771c` (branch `worktree-agent-a359c23afa0cf771c`, Agents variants A/B/C) — variant C is the real page, but its commit is not in main and has no PR; owner to confirm it can go. 2026-10-25
- `/home/leemour/Projects/AI/visage/.claude/worktrees/{i18n-signin,i18n-tools}` and their branches — said to be cherry-picked into feat/desktop-mvp, but 3 and 1 commits are not in main by patch and there is no PR; owner to confirm. 2026-10-29
- `/home/leemour/Projects/AI/visage/.claude/worktrees/cloudflare-live` (branch `test/cloudflare-live`, not pushed) — TASK-32 live-run harness, has an uncommitted edit in `src-tauri/src/cloudflare.rs`; keep only if the macOS/Windows run will reuse it. 2026-10-27
- `/home/leemour/Projects/AI/visage/.claude/worktrees/apple-cert` (branch `feat/apple-cert-linux`, PR #17 merged) — uncommitted edit in `docs/dev/signing-macos-by-hand.md`; check it, then remove. 2026-11-04
- `.claude/worktrees/{onboarding-polish,tg-signin-polish,bot-signin}` and branches `feat/onboarding-polish`, `feat/tg-signin-polish`, `feat/bot-signin` — polish PR #96 merged, but these commits are not in main by SHA, were never pushed and have no PR; owner to confirm they went into #96. 2026-11-05
- `~/.cache/wirecat-fresh-install` — throwaway home of `bin/try-fresh-install` (PR #93); touched 2026-11-05 04:12, remove after that. 2026-11-04
- pnpm store: `pnpm store prune` fails with "Permission denied" on `/home/leemour/Projects/AI/arendamed/directus/data/database` (Docker-owned); fix the folder owner, then prune to drop the `wcat-fixture-*` test packages. 2026-10-30
- `/home/leemour/Projects/AI/max-cli/docs_ai/.worktrees/wa-0.29-report` (branch `docs/wa-0.29-report`) — cli-private PR #555 is still open; remove after it merges. 2026-11-05
- `/home/leemour/Projects/AI/cli-core-release-memo36` and `/home/leemour/Projects/AI/cli-memo-release-core0564` — release clones on main, files changed within the last 3 hours (another session may use them); remove after the releases. 2026-11-05
- Release clones `cli-core-release`, `tg-release`, `wa-release` in `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-wirecat-desktop/1843f46d-831c-4149-8277-335fa93ea262/scratchpad/` — clean and pushed; remove after the whatsapp release and cli-private#555. 2026-11-05
