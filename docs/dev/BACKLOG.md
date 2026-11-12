# Backlog

Work that is not built yet. Each item says where it starts: **Desktop**, or the tool that needs a change first. A
group links the plan it came from, as it stood before the plan was deleted.

## Updates and releases

- **Desktop.** `scripts/latest-json.sh` writes `"notes": ""`, so the update dialog likely shows no release notes.
  Check it on the next release.
- **Desktop.** An owner's approval before each release is published
  ([signing flow, D2][2026-11-06-windows-signing-flow]).

## Search

- **Desktop.** `QueryWriterSchema` (`src/platform/search-schemas.ts`) allows the writers `chatgpt` and `key`, which
  Rust never sends.

## Memory

Plans: [memory page][2026-10-31-memory-page], [Add to memory][2026-11-01-memory-add],
[memory explained][2026-11-09-memory-explained].

- **Desktop.** A memory's sources link to Search.
- **Desktop.** Add to memory: the "keep a copy" choice (`--keep-copy`).
- **Desktop.** Add to memory: drop a file on the panel.
- **Desktop.** Add to memory: pickers for people, projects and tasks as subjects.
- **Needs drive first.** Add a Google Doc through drive.
- **Needs memo first.** Add an image's text, or an audio recording.
- **Needs memo first.** `memo sources preview <url>`; the app shows no preview without it.
- **Desktop.** A source's facts shown apart from the owner's, and a bulk arrival folded into one card (UX-125.c,
  UX-125.d).

## Sidebar ([notifications][2026-11-01-notifications])

- **Desktop.** A badge for Memory (only Agents has one).

## Analytics ([analytics][2026-11-02-analytics])

- **Needs memo first.** Tasks made per week (the page shows a preview only).
- **Needs memo first.** Notes per day; counts of memories, facts and agents.
- **Needs zm first.** Meetings with a transcript (`has:transcript`).
- **Desktop.** Time saved.

## Sync ([desktop sync][2026-10-27-desktop-sync])

- **Needs drive first.** Progress lines during a sync.
- **Needs zm first.** Progress lines and a `finished_at` time.
- **Needs wa first.** A one-shot sync; what it should do is still an open product decision.

## Public address ([Cloudflare fallback][2026-10-27-cloudflare-fallback], [funnel helper][2026-11-03-funnel-helper])

- **Desktop.** One end-to-end run against a real Cloudflare account.
- **Desktop.** Delete the Cloudflare tunnel from the app.
- **Desktop.** Update cloudflared after its first download.
- **Needs wirecat-funnel first.** `logout`, for a Sign out button.
- **Needs wirecat-funnel first.** A monthly job that bumps its Tailscale version.

## Sign-in and MCP ([MCP full commands][2026-10-26-mcp-full-commands])

- **Needs wa first.** Sign in by phone number (whatsapp-cli PR #346).
- **Needs mail first.** Sign in from the app (mail-cli PR #128).
- **Needs wa first.** Its skill says `chats delete|clear` are not offered over MCP; they are (FIND-34).
- **Needs cli-core first.** Decide whether every tool offers `session end` over MCP, or none (NEED-57).

## Agents

Plans: [OpenClaw and Hermes][2026-10-25-agents-openclaw-hermes], [round 2][2026-10-25-round-2],
[guides][2026-11-01-guides].

- **Needs cli-docs first.** Listing in the official MCP Registry, if MCP stays a product option (NEED-42).
- **Needs cli-docs first.** A pull request to make our skills a trusted Hermes source.
- **Needs cli-docs first.** `/.well-known/skills/index.json` on wirecat.dev; not confirmed built.
- **Needs cli-core first.** `store jobs list --json`, for background jobs on the Storage page.
- **Needs memo first.** `memo jobs status --json`.
- **Desktop.** "Open in Claude Code" from a guide.

## Own tools ([own tool review v2][2026-11-08-own-tool-review-v2])

- **Needs cli-base first.** The review words each data field a tool touches.

## Contacts, Clients and Digests ([people, clients and digests][2026-11-09-people-clients-digests])

- **Desktop.** Move `ViewSwitch` into `src/ui`.
- **Needs memo first.** Decide what counts as mail exchange with a real person (NEED-2342).
- **Needs cli-core first.** One free-mail list instead of two (`FREE_MAIL` and `FREE`, DEBT-63).

[2026-11-06-windows-signing-flow]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-06-windows-signing-flow.md
[2026-10-31-memory-page]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-31-memory-page.md
[2026-11-01-memory-add]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-01-memory-add.md
[2026-11-09-memory-explained]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-09-memory-explained.md
[2026-11-01-notifications]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-01-notifications.md
[2026-11-02-analytics]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-02-analytics.md
[2026-10-27-desktop-sync]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-27-desktop-sync.md
[2026-10-27-cloudflare-fallback]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-27-cloudflare-fallback.md
[2026-11-03-funnel-helper]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-03-funnel-helper.md
[2026-10-26-mcp-full-commands]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-26-mcp-full-commands.md
[2026-10-25-agents-openclaw-hermes]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-25-agents-openclaw-hermes.md
[2026-10-25-round-2]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-10-25-round-2.md
[2026-11-01-guides]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-01-guides.md
[2026-11-08-own-tool-review-v2]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-08-own-tool-review-v2.md
[2026-11-09-people-clients-digests]: https://github.com/WireCatLabs/wirecat-desktop/blob/26045692f61336fef71a1a4bba0a09c79e24beb8/docs/dev/plans/2026-11-09-people-clients-digests.md
