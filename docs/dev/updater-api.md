# Updater API

<!-- cspell:ignore NSIS -->

The contract between the release workflow (the server side: [`release.yml`](../../.github/workflows/release.yml) and
[`scripts/latest-json.sh`](../../scripts/latest-json.sh)) and every installed copy (the client: `plugins.updater` in
[`tauri.conf.json`](../../src-tauri/tauri.conf.json), `checkUpdate` in
[`bridge.ts`](../../src/platform/bridge.ts) and [`package_update.rs`](../../src-tauri/src/package_update.rs)).
Change it here first, then on both sides. Installed copies cannot be changed after the fact: a shape they do not read
stops them from updating for good.

## Principles

- **One key, for good.** Each copy trusts only the public key it was built with (`plugins.updater.pubkey`). A file
  signed with another key is refused. If the private key is lost, no installed copy can update again.
- **Checked before it goes up.** `latest.json` is written only after each updater `.sig` passes `minisign -V` against
  that public key, and only from files that equal the assets on the draft, byte for byte.
- **Public only when whole.** The release stays a private draft until `latest.json` has `darwin-aarch64`,
  `darwin-x86_64`, `linux-x86_64` and `windows-x86_64`, each with `url` and `signature`.
- **Nothing installs without a click.** The app checks at start and every 6 hours (`CHECK_EVERY_MS`). It downloads
  nothing until the owner presses Install. No check runs while the update dialog is open or an install runs.

## `GET https://github.com/WireCatLabs/wirecat-desktop/releases/latest/download/latest.json`

The only endpoint (`plugins.updater.endpoints`). GitHub's "latest" is the newest release that is neither a draft nor a
prerelease, so a copy sees a release only after the `publish` job.

```json
{
  "version": "0.6.2",
  "notes": "",
  "pub_date": "2026-11-12T10:00:00.000Z",
  "platforms": {
    "windows-x86_64": { "signature": "<the .sig file, as is>", "url": "<asset API URL>" }
  }
}
```

- `version` is the tag without the `v`.
- `notes` is always empty. The release body is Markdown from `docs/releases/<version>.md`; `plainNotes`
  ([`update-notes.ts`](../../src/platform/update-notes.ts)) turns a body into plain text and drops `## All changes`.
- `url` is the GitHub API URL of the release asset (`/repos/…/releases/assets/<id>`), the form the updater downloads.
- `signature` is the content of the asset's `.sig` file.

### Platform keys

A copy looks up `<os>-<arch>-<bundle>` first, then `<os>-<arch>`. So a `.deb` copy finds only `linux-x86_64-deb`.

| Asset | Keys |
| --- | --- |
| `*_x64-setup.exe` (NSIS) | `windows-x86_64`, `windows-x86_64-nsis` |
| `*_universal.app.tar.gz` | `darwin-aarch64`, `darwin-x86_64`, `darwin-universal`, and each with `-app` |
| `*.AppImage` | `linux-x86_64`, `linux-x86_64-appimage` |
| `*.deb` | `linux-x86_64-deb` |
| `*.rpm` | `linux-x86_64-rpm` |

## How a copy takes the update

`update_kind` answers one of four values (`UpdateKind`):

| Kind | Copy | What Install does |
| --- | --- | --- |
| `self` | Windows, macOS, AppImage | The updater plugin replaces the app. Windows uses `installMode: passive`. |
| `deb`, `rpm` | Linux package | Downloads the package and hands it to the system (below). |
| `other` | A Linux build with no bundle type (`pnpm app`) | Nothing: the app cannot tell which file replaces it. |

A package copy never gets administrator rights from the app. `update_download_package` downloads the package of the
version the dialog named, which the updater plugin checks against the key. It saves it to Downloads as
`wirecat_<version>_<arch>.deb` or `wirecat-<version>-1.<arch>.rpm`. The owner then runs the `sudo` line the app shows,
in their own terminal.

## Version and tag

- The version lives in `package.json`; `tauri.conf.json` reads it. `src-tauri/Cargo.toml` holds the same number.
- The tag is `v<version>`. The `draft` job refuses a tag that differs from `package.json`, a version already
  published, and a missing or empty `docs/releases/<version>.md`. `bin/tag-release` checks the same before it pushes.
- A published tag never moves. A fix is a new version.

## Build config

`createUpdaterArtifacts` is on only in [`tauri.release.conf.json`](../../src-tauri/tauri.release.conf.json), which
the `sign` job passes to `tauri bundle` with `--config`. With it on and no private key, the Tauri CLI fails the build,
so local and CI builds leave it off.
