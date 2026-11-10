# memo's people answers

Captured 2026-11-08 from cli-memo PR #748 (`feat(people)`, built against its author's local cli-core build), run on a
throwaway store seeded with made-up people (`MESSAGING_STORE` in a temp folder, `DBUS_SESSION_BUS_ADDRESS=disabled:`).
`list.json` is `memo people list --json` of the released 0.131.75 (2026-11-09, nine added people, one row of ten left out). `run_id` and `duration_ms` were removed. `refused.json` and `stale.json` are answers memo gave with exit code 2.

`review-split.json`, `links-check.json` and `split-confirm.json` are memo 0.131.79 on a throwaway store
(2026-11-10): an agent's `people unlink --reason` and `people unmerge --reason` (no terminal, `CLAUDECODE=1`) beside one
match from `review.json`; `people links check --json`; `people confirm 1 --from-app --json`. The second doubt in
`links-check.json` and every `moves` field are written by hand in the shape cli-core #2833 adds, one with an unknown
`op`.
