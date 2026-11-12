# What code reviews have learned

Read this before a review of this repository. A finding listed under "Ложные находки" is not reported again. A fix
listed under "Советы, которые навредили" is not suggested again. When the owner rejects a finding of a review, the
reason goes here.

Entry format: what was flagged (or advised), why it is fine (or what the advice broke), the date, the review it came
from.

## Ложные находки

None yet.

## Советы, которые навредили

- **SEC-3 · Pass cloudflared's tunnel secret by `--credentials-file` instead of its environment.** Rejected.
  cloudflared outlives the app, so the file would stay on disk, outside the keyring, for the tunnel's whole life, and
  backups and file sync would copy it. The environment variable `TUNNEL_CRED_CONTENTS` is readable only by the same
  user (`/proc/<pid>/environ`), like a 0600 file. The variable stays, with a comment that says why
  (`src-tauri/src/cloudflare.rs`, commit 67523393 "fix(rust): refuse an npm package address…"). 2026-11-12,
  [review 2026-11-12](review-2026-11-12.md).
