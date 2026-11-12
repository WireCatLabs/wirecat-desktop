# A release

A release is a tag `v<version>` on `main`. GitHub Actions builds, signs and publishes it with nobody in the loop.
What `latest.json` holds and how a copy reads it: [updater-api.md](../updater-api.md). How CI signs:
[signing.md](../signing.md#how-ci-signs). The owner's setup is in the same file.

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

## Why it is built this way

- **Linux on ubuntu-22.04.** An AppImage runs only where glibc is at least as new as the build machine's; 22.04
  reaches more systems than 24.04.
- **One universal macOS `.dmg`.** One download for every Mac, and one job fills both `darwin-aarch64` and
  `darwin-x86_64` in `latest.json`. Cost: a bigger file and a longer build.
- **Windows NSIS only.** NSIS installs per user, so neither the install nor an update asks for administrator rights
  (rule 6). ssign cannot sign an MSI anyway.

## Known risks

- **`latest.json` can lose a platform.** Each build adds its own platforms and uploads the file again, so two builds
  that finish together can overwrite each other. `publish` catches it; re-run the build whose platform is missing.
- **File names that differ only in case** break the Windows and macOS builds (their file systems ignore case), while
  Linux and the `web` job pass.
- **Download links in `latest.json` are GitHub API asset URLs** (tauri-action 1.0.0, #1315), rate-limited without a
  login (60 an hour per address). Updates are rare, so this should not matter.
- **Dependabot #6** (glib 0.18, GHSA-wrw7-89jp-8q8g) cannot be fixed by a bump: Tauri 2.12 needs gtk 0.18, which pins
  glib below 0.20 ([tauri#16264](https://github.com/tauri-apps/tauri/issues/16264)). The app does not call the
  affected iterator.
