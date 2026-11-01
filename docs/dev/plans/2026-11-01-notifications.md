# Notifications and sidebar badges

The owner (2026-11-01): notifications we can show the user, such as important security updates, fetched from
wirecat-api on start and every hour; a bell next to the help icon with what is unread; and a badge in the sidebar for
things that need resolving, but not for everything, so the app does not create noise. Some things users just do not
have to do.

API contract: [`notifications-api.md`](../notifications-api.md). Server: WireCatLabs/wirecat-api#5.

## The bell

- Rust fetches (`notifications.rs`, the `notifications` command) when the app starts and every hour
  (`CHECK_EVERY_MS` in `src/features/notifications/store.ts`). Failure is silent: the last list stays, kept in
  `localStorage` (`wirecat.notifications`, like the theme and onboarding), so the bell still works offline. Expired
  items are hidden on the client too.
- No `since=` parameter: the client holds all state and the list is at most 20 items, so a cursor would only add a
  value the server could correlate.
- A dot on the bell while anything is unread: purple, red when an unread one is a security notice. No number: the type
  floor is 0.85rem, a number that size would outweigh the icon, and the count is in the button's accessible name.
- The panel is a popover like the Help menu. Opening marks everything in it read; what was unread keeps a "New" mark
  and a purple wash until the panel closes, so nothing changes under the owner's eyes. Security items keep a red wash
  and a shield whether read or not. Each item can be removed; it folds away in place and never returns.
- Text is plain. A blank line starts a paragraph. The link opens in the browser, `https://` only (checked in Rust and
  again in valibot).

## Sidebar badges: the rule

A dot in the sidebar means "there is something here you have not seen and probably want". It is never a to-do list:
the pages themselves show state (amber lamps, counts). A badge that cannot be acted on, or that would sit there for
weeks, is left out.

| Section | Appears when | Clears when | Comes back? | Built |
| --- | --- | --- | --- | --- |
| Agents | At least one tool is installed and the owner has never opened Agents since this rule shipped | The owner opens Agents, whatever they do there | Never (`wirecat.badges`) | Yes |
| Memory | Memories wait for review that arrived after the owner last opened Memory | The owner opens Memory | When new ones arrive | After the Memory page (PR #37) lands: one line in `src/app/badges.ts` |
| Bell (top bar) | A notification is unread | The panel is opened | With the next notification | Yes |
| Tools | — | — | — | No: the app opens on Tools, whose amber lamps already show every update, and the latest versions are read only when that page loads. A Tools dot would be cleared before anyone could see it. NEED-1 |
| Storage, Logs, Settings, Accounts | — | — | — | No: nothing there waits on the owner |

Notes:

- Existing users get the Agents dot once after updating to the version with this rule: the app cannot tell from the
  past whether they opened Agents. One click clears it.
- The onboarding's agents step does not count as opening Agents; the page does.
- Security news belongs on the bell, not in the sidebar: one place to look.
- Badges live in `src/app/badges.ts`, not in `sections.tsx`, so open PRs that add sections do not collide with them.

## Mocks

`?notifications=none|security|fail|open`; no parameter shows the welcome notification live on production. See
CLAUDE.md.
