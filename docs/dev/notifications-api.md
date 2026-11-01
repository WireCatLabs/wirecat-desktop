# Notifications API

The contract between WireCat Desktop (the client, `src-tauri/src/notifications.rs`) and `WireCatLabs/wirecat-api` (the
server, `V1::NotificationsController`). Change it here first, then on both sides.

Base URL: `https://api.wirecat.dev`, or `WIRECAT_API_URL` as for bug reports.

## Principles

- **The request says nothing about the owner.** It carries the app's version and OS, the same for every copy of that
  build. Every language comes back at once, so the app never sends its own. No cookie, no id, nothing stored.
- **Read state stays on the computer.** Which notifications were read or removed lives in the interface's storage
  (`wirecat.notifications`) and is never sent.
- **Plain text only.** The app shows the text as text; no Markdown, no HTML. A link is a separate field and must be
  `https://`; the client drops any other.
- **No write endpoint.** The owner publishes with `bin/notify` in wirecat-api (README there).

## `GET /v1/notifications?version=<semver>&platform=<linux|macos|windows>`

Both parameters are optional. Without `version` only notifications with no version range match; without `platform`
only those for every platform. An unknown platform or a version that is not `x.y.z[-pre]` answers `422` with the
usual error envelope.

```json
{
  "notifications": [
    {
      "id": "174325ab-a252-4651-ba6f-af0c6092dba4",
      "severity": "info",
      "title": { "en": "…", "ru": "…", "es": "…" },
      "body": { "en": "Paragraphs split by a blank line." },
      "link": { "url": "https://wirecat.dev", "label": { "en": "Visit wirecat.dev" } },
      "published_at": "2026-11-01T13:28:32.474Z",
      "expires_at": "2026-11-15T00:00:00.000Z"
    }
  ]
}
```

- Only published, unexpired notifications whose inclusive `min_version`..`max_version` range and `platforms` match;
  newest first, at most 20.
- `severity`: `info`, `update` or `security`. The client reads anything else as `info`.
- `en` is always present; `ru` and `es` may be missing, and the client falls back to English.
- `link` is `null` or `{ url, label }`.
- `Cache-Control: public, max-age=300`. The app asks on start and once an hour; the per-IP limit for `/v1` is 60 a
  minute.
