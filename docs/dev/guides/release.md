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
   `package.json`), `build` (compiles on Linux, macOS and Windows with no secret), `sign` (bundles and signs that
   build in the `release` environment and uploads it to the draft), `updater` (checks every updater signature against
   the public key and writes `latest.json`), `notarize-dmg`, then `publish`. `publish` checks that `latest.json` has
   all four platforms and makes the release public and latest. To try a change to this workflow, run it on your
   branch with nothing published: `gh workflow run release.yml --ref <branch> -f dry_run=true`.
5. [install-check.yml](../../../.github/workflows/install-check.yml) then installs the published release on a clean
   runner of each OS and checks that the app starts. On Windows the installer and the installed app must be signed
   validly by our certificate ([signing.md](../signing.md#after-setup)). Then the installed app installs the
   WhatsApp tool with its own install code, the path the Tools page takes, and runs `wa --version` and
   `wa --wcat-describe`: first with Node.js hidden, so the app sets up its own, then with the runner's Node.js
   (Fedora has none, so only the first). The command, with no window:
   `WIRECAT_SELF_TEST=1 <app> --self-test install-tool whatsapp [--own-node]`
   ([self_test.rs](../../../src-tauri/src/self_test.rs), [bin/install-check-self-test](../../../bin/install-check-self-test)).
   It prints one JSON line (`ok`, `node.source` `own` or `system`, `tool`, `steps`, `failure`), kept as the run's
   `self-test-<os>` artifact. A release made before the self-test existed gets a notice for that part instead.
   Look at its result.

Installed copies update only after `publish`: the updater reads `latest.json` of the latest public release.

## If it fails

A failure stops before `publish`, and a draft is private. Fix the cause, then re-run the failed job, or delete the
draft and the tag (`git push origin :refs/tags/v<version>`) and run `bin/tag-release` again. A left draft is reused.

## Rules

- Never publish a release by hand from a local build: only CI has the updater and signing keys.
- Never move a published tag. Bump the version instead.
- A release with a missing platform in `latest.json` is not published. Re-run that system's build job.
- A catalog `minVersion` (`catalog/tools.json`) names only a CLI version already on npm. Set it in a Desktop PR after
  that CLI's release (owner's ruling, 2026-11-09).
