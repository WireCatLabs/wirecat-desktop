# A release

A release is a tag `v<version>` on `main`. GitHub Actions builds, signs and publishes it with nobody in the loop.
The full plan and its reasons are in [the first release plan](../plans/2026-10-29-first-release.md). Signing setup is
in [signing.md](../signing.md).

## Steps

1. Merge everything for the release into `main`. CI green.
2. Bump the version to the same number in `package.json` and `src-tauri/Cargo.toml` (and `Cargo.lock`), in a PR.
   `tauri.conf.json` reads `package.json`.
3. On `main`, clean and equal to `origin/main`, run `bin/tag-release` from the repository root. It refuses when the branch is not `main`, the tree
   has changes, `main` differs from `origin/main`, the two versions differ, the updater key is missing, or the tag
   exists. Then it pushes the tag.
4. [release.yml](../../../.github/workflows/release.yml) runs: `security`, `draft` (refuses a tag that differs from
   `package.json`), `build` on Linux, macOS and Windows into the draft, `notarize-dmg`, then `publish`. `publish`
   checks that `latest.json` has all four platforms and makes the release public and latest.
5. [install-check.yml](../../../.github/workflows/install-check.yml) then installs the published release on a clean
   runner of each OS and checks that the app starts. Look at its result.

Installed copies update only after `publish`: the updater reads `latest.json` of the latest public release.

## If it fails

A failure stops before `publish`, and a draft is private. Fix the cause, then re-run the failed job, or delete the
draft and the tag (`git push origin :refs/tags/v<version>`) and run `bin/tag-release` again. A left draft is reused.

## Rules

- Never publish a release by hand from a local build: only CI has the updater and signing keys.
- Never move a published tag. Bump the version instead.
- A release with a missing platform in `latest.json` is not published. Re-run that system's build job.
