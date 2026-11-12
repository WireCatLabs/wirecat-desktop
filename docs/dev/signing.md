# Signing WireCat Desktop: what to get, where it goes, how to keep it

This is the owner's guide. It lists every file, password and key that signing needs, where each one comes from, where
it goes, and how to keep it. [How CI signs](#how-ci-signs) has the technical details.

**A release needs nothing from you.** Everything below is set up (macOS since v0.5.0, Windows since 2026-11-07), and
every `v*` tag is signed in GitHub. The scripts here are for the rare case: a new or reissued certificate, a leak, a
new app-specific password, a lost key. They are not part of the release flow.

## Why sign

- **macOS.** A Mac shows a warning or refuses to open an app that Apple has not checked. A signed and notarized app
  opens with a normal double-click. Notarized means Apple scanned it and gave it a stamp.
- **Windows.** Windows shows "Windows protected your PC" for an unsigned installer, and Smart App Control blocks it.
  A signed installer shows "WireCat" as the publisher.
- **Updates** have their own key. It is already set up (see [The updater key](#the-updater-key-already-done)).

You do each part once. After that, every release tag is signed in GitHub without your help.

## What you will have at the end

| # | Item | Secret? | Keep a copy? |
| - | --- | --- | --- |
| 1 | Apple certificate file `developer-id.p12` | **Yes**: it can sign apps as you | **Yes**, in your password manager |
| 2 | Password of that `.p12` | **Yes** | **Yes**, in the same entry |
| 3 | Apple app-specific password | Yes | No: you can make a new one at any time |
| 4 | Certum SimplySign seed (the `otpauth://` link) | **Yes**: it can sign Windows apps as you | No: it goes from the QR image straight to GitHub; Certum's help line resets it |
| 5 | Certum login e-mail | No | It is your e-mail |
| 6 | Updater private key and its password | **Yes** | **Yes**: already in the keyring, not yet in your password manager |

Make one password-manager entry called **"WireCat signing"** and put items 1, 2 and 6 in it. GitHub keeps copies
too, but nobody can read a GitHub secret back, so GitHub is not your backup.

## Before you start

Run the scripts from a copy of the repository on the current `main`. The shared checkout may be on another branch and
other sessions use it, so use a separate copy. Make it once:

```sh
git -C /home/leemour/Projects/AI/wirecat-desktop worktree add --detach .claude/worktrees/signing-setup origin/main
```

Before each use, bring it up to date:

```sh
git -C /home/leemour/Projects/AI/wirecat-desktop/.claude/worktrees/signing-setup pull -q --ff-only origin main
```

The commands below start with `bin/`: run them from that folder.

You need `gh` logged in (`gh auth status`). The scripts never print a secret.

## macOS: the Apple certificate

To do it by hand and see every command, follow [signing-macos-by-hand.md](signing-macos-by-hand.md) instead of
steps 1 and 4 below.

You need the paid Apple Developer account (you have it) and its **Account Holder** login. Only the Account Holder can
make this kind of certificate.

### Step 1. Make the request file

```sh
bin/make-apple-certificate
```

- It asks for your Apple ID e-mail.
- **You get:** a private key and a request file in `~/.config/wirecat-signing/`. Only your user can open that folder.
  The script prints the path of the request file, `developer-id.certSigningRequest`.
- The key has no password yet. It stays on this computer and step 3 seals it, so do steps 2 and 3 on the same day.

### Step 2. Get the certificate from Apple

1. Open [Certificates, Identifiers & Profiles → Certificates → +](https://developer.apple.com/account/resources/certificates/add).
2. Under **Software**, select the last kind, **Developer ID Application**, then **Continue** at the top right. Not
   "Apple Distribution", "Mac App Distribution" (both App Store) or "Developer ID Installer" (`.pkg` installers);
   the script rejects other kinds.
3. If Apple asks for a profile type, I think the right one is **G2 Sub-CA**. I have not checked this.
4. Upload the request file from step 1, then **Continue**, then **Download**.

- **You get:** a file like `~/Downloads/developerID_application.cer`.
- It is public, not secret. You can download it again from the same page, so you do not need to keep it.
- I have not tested whether Apple accepts a request file made on Linux. If Apple rejects it, tell me the message.

### Step 3. Make the app-specific password

Notarization signs in to Apple as you. It cannot use your normal password, because of two-factor sign-in.

1. Open [account.apple.com](https://account.apple.com) and sign in.
2. Go to **Sign-In and Security → App-Specific Passwords → +**, and name it "WireCat notarization".

- **You get:** a password like `abcd-efgh-ijkl-mnop`. Apple shows it once.
- Keep it on screen for the next step. You don't need to save it: if it is lost, revoke it there and make a new one.

### Step 4. Make the .p12 and give everything to GitHub

```sh
bin/make-apple-certificate ~/Downloads/developerID_application.cer
```

What it does:

1. Checks that the certificate matches your key.
2. Adds Apple's intermediate certificate and seals everything in `~/.config/wirecat-signing/developer-id.p12` with a
   random 32-character password.
3. Saves that password in your keyring (service `wirecat`, account `apple-p12-password`).
4. Deletes the bare key and the other temporary files. From now on the key exists only inside the `.p12`.
5. Asks for your Apple ID and the app-specific password from step 3.
6. Saves five GitHub secrets in the `release` environment, which only release tags can open: `APPLE_CERTIFICATE`
   (the `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (the app-specific one) and
   `APPLE_TEAM_ID` (taken from the certificate).

### Step 5. Back up the .p12 and its password

1. Attach `~/.config/wirecat-signing/developer-id.p12` to the "WireCat signing" entry in your password manager.
2. Copy the password into the same entry:
   `secret-tool lookup service wirecat account apple-p12-password | wl-copy`. Paste it, then copy something else to
   clear the clipboard.

After that, you can leave the `.p12` on disk or delete it. It is safe in the password manager and in GitHub.

## Windows: the Certum seed

The certificate itself stays in Certum's cloud; there is no file to download. To sign, GitHub logs in to Certum with
your e-mail and the 6-digit code that the SimplySign phone app shows. The code comes from a **seed**, a secret inside
the QR code that activated the app (an `otpauth://` link). There is no PIN: **the seed and the e-mail are the whole
credential.** Whoever has them can sign programs as WireCat until Certum resets the seed. So the seed goes from the QR
image straight into GitHub: never on screen, never in a file on disk, never in a chat.

Do this only for a new seed (a leak, a lost phone) or a new certificate. Run steps 2 to 7 in one sitting: the QR page
must stay open from step 2 to step 6.

**Step 1. Install the QR reader** (Ubuntu package `zbar-tools`): `sudo apt install zbar-tools`.

**Step 2. Get the certificate file and open the QR page.**

- The certificate (public, not secret): download it from your Certum account as a PEM file, for example to
  `/home/leemour/Downloads/wirecat-certum.pem`. A binary `.cer` converts with
  `openssl x509 -inform der -in /home/leemour/Downloads/wirecat-certum.cer -out /home/leemour/Downloads/wirecat-certum.pem`.
- The QR code: the activated phone app's QR code is gone and cannot be shown again. Call Certum's help line and ask for
  a SimplySign reset. Certum's iOS manual, section 6.3, describes a 6-digit secret plus a link sent by e-mail, valid
  for 24 hours ([SimplySign iOS manual](https://files.certum.eu/documents/manual_en/SimplySign-Instruction-manual-iOS-6-1-2.pdf)).
  It leads to a new QR page, as on first activation
  ([Certum: activating SimplySign](https://support.certum.eu/en/how-to-activate-access-to-simply-sign-application/)).
  The reset stops the old phone setup, so step 4 scans again.

**Step 3. Save the QR image to memory, not to disk.** `/dev/shm` is a folder held in RAM, gone after a reboot.
Right-click the QR code → "Save image as…" → `/dev/shm/simplysign-qr.png`. Not to Downloads or Pictures, not to the
clipboard. Ubuntu's screenshot (Shift+PrtSc) also saves to `/home/leemour/Pictures/Screenshots` and the clipboard: if
you used it, shred that file in step 6 and copy some other text.

**Step 4. Scan the same QR code with the SimplySign phone app.** Keep the page open.

**Step 5. Give the seed and the thumbprint to GitHub:**

```sh
bin/setup-windows-signing --qr /dev/shm/simplysign-qr.png --thumbprint-from /home/leemour/Downloads/wirecat-certum.pem
```

- It asks for your SimplySign login e-mail and the 6-digit code the phone shows now, and checks on this computer that
  the seed makes the same code. Nothing is sent for the check; the seed is never printed.
- It stores `CERTUM_EMAIL` and `CERTUM_OTP` as secrets and `WINDOWS_SIGNER_SHA1` as a variable in the `release`
  environment, and prints the certificate's subject, end date and thumbprint (public).
- The subject must name you or WireCat, not a Certum CA. If it names Certum, the PEM starts with the CA certificate of
  a chain: save only your own certificate block and run `--thumbprint-from` on that.
- "The code does not match": wait for the next code and run it again.

**Step 6. Delete the image:** `shred -u /dev/shm/simplysign-qr.png`.

**Step 7. Close the QR page.**

## The updater key (already done)

Every installed WireCat trusts this key to accept an update. It was made on 2026-10-29 and is in your keyring and in
GitHub. **If it is lost, no copy already installed can ever update again.** So copy it into the password manager now:

```sh
secret-tool lookup service wirecat account updater-key | wl-copy
```

Paste it into the "WireCat signing" entry. Do the same for the password:

```sh
secret-tool lookup service wirecat account updater-key-password | wl-copy
```

## After setup

The next release tag is signed with no other change. To check:

- The **Install check** run after the release (GitHub → Actions → Install check) shows the result.
  - On macOS: an `Authority=Developer ID Application: …` line, and Gatekeeper reports the app as accepted.
  - On Windows: `Signature: Valid, signer CN=Open Source Developer Viacheslav Ptsarev, O=Open Source Developer,
    S=Valencia, C=ES` for the installer and for the installed app. Any other status or signer fails the check. That
    subject is the Certum certificate's (as the v0.5.0 release run printed it), kept in `WINDOWS_SIGNER` at the top
    of the workflow's Windows job; a new certificate with another subject needs that line changed too.
- On a Mac, the downloaded app opens with a double-click and no warning.

## If something is lost or leaked

| What happened | What to do |
| --- | --- |
| Laptop lost, password manager fine | Nothing urgent. GitHub still signs. Restore the files from the password manager when needed. |
| `.p12` or its password leaked | Revoke the certificate at [Certificates](https://developer.apple.com/account/resources/certificates/list), then repeat the macOS steps. Apple allows up to five such certificates. |
| App-specific password leaked | Revoke it at account.apple.com and make a new one. Run `bin/setup-apple-signing <the .p12 file>`; it asks for the `.p12` password (from the password manager) and the new app-specific password. |
| Certum seed leaked | See [The seed leaked](#the-seed-leaked). |
| Certum certificate reissued | See [A new certificate](#a-new-certificate). |
| Updater key lost | Installed copies can no longer update. Users have to download the next version by hand. Avoid this: keep the copy in the password manager. |

### The seed leaked

A screenshot, a chat, a log, a lost laptop with the image on disk:

1. Stop CI from using it: `gh secret delete CERTUM_OTP --env release --repo WireCatLabs/wirecat-desktop`. The next
   release then stops at the Windows `sign` job instead of shipping unsigned, until a new seed is stored.
2. Call Certum's help line and reset SimplySign. Until then, anyone with the seed and your e-mail can sign as WireCat.
3. If you think someone signed something with it, ask Certum to revoke the certificate and issue a new one.
4. Repeat [the Windows steps](#windows-the-certum-seed).

### A new certificate

Certum code-signing certificates last at most 459 days; a renewal or a revocation gives a new one. The thumbprint
changes and the next release fails the check after signing. Update only the variable; the seed stays:

```sh
bin/setup-windows-signing --thumbprint-from /home/leemour/Downloads/wirecat-certum-new.pem
```

If the new certificate has another subject, also change `WINDOWS_SIGNER` at the top of the Windows job in
[install-check.yml](../../.github/workflows/install-check.yml).

## How to check the setup

Each command prints names or public values only. GitHub never shows a secret's value.

- `gh secret list --env release --repo WireCatLabs/wirecat-desktop`: `TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, the five `APPLE_*` names, `CERTUM_EMAIL` and `CERTUM_OTP`.
- `gh secret list --repo WireCatLabs/wirecat-desktop`: none of them. Any branch's workflow can read a repository
  secret; `bin/move-signing-secrets` moved them into the environment once (2026-11-06) and is needed again only if
  one comes back there.
- `gh variable list --env release --repo WireCatLabs/wirecat-desktop`: `WINDOWS_SIGNER_SHA1`.
- `gh api repos/WireCatLabs/wirecat-desktop/environments/release --jq '{can_admins_bypass, rules: [.protection_rules[].type]}'`:
  `"can_admins_bypass": false`. Adding yourself as a required reviewer there (Settings → Environments → release) would
  make each release wait for your click before signing; the owner chose not to (D2 B).
- `gh api repos/WireCatLabs/wirecat-desktop/environments/release/deployment-branch-policies --jq '.branch_policies[] | "\(.type) \(.name)"'`:
  only `tag v*`.

## How CI signs

[release.yml](../../.github/workflows/release.yml) and its comments are the source; the security review of the
Windows tool is [ssign review](research/2026-11-05-ssign-review.md).

- **No secret in the build.** The `build` job compiles the app (`tauri build --no-bundle`) with no environment and no
  secret; every npm and Rust build script runs there. Only the `sign` job declares `environment: release`, and only
  jobs that declare an environment read its secrets
  ([GitHub: environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)).
  The environment admits only `v*` tags, so a branch or a pull request cannot read them, and a `dry_run` on a branch
  runs with none.
- **The `sign` job** takes the compiled app and runs `tauri bundle`. It installs only the Tauri CLI (with
  `--ignore-scripts`) and, on Windows, ssign; it never runs `pnpm install`. Tauri treats a variable that is set but
  empty as a certificate to import (`crates/tauri-bundler/src/bundle/macos/sign.rs`), so each secret is exported only
  when it is needed.
- **macOS.** Tauri signs and notarizes with the five `APPLE_*` secrets
  ([Tauri: macOS signing](https://v2.tauri.app/distribute/sign/macos/)). `APPLE_SIGNING_IDENTITY` is not needed:
  Tauri infers it from the certificate. `bin/make-apple-certificate` makes the key and the `.p12` without a Mac.
- **Windows.** Certum documents only signing on a PC with SimplySign Desktop
  ([signtool manual](https://www.files.certum.eu/documents/manual_en/Signing_with_the_use_of_jarsigner_tool_and_signtool.pdf)),
  nothing for CI. The owner chose the unofficial [ssign](https://github.com/Le-Syl21/ssign) in Actions (NEED-129 C)
  over a manual Windows PC (A) or a self-hosted runner (B). ssign speaks Certum's cloud API over HTTPS
  (`cloudsign.webnotarius.pl`, timestamps from `time.certum.pl`), computes the code from `CERTUM_OTP`, wipes the seed
  from memory and never writes it.
  - It is built from our fork [WireCatLabs/ssign](https://github.com/WireCatLabs/ssign) at the full commit in
    `release.yml` (`cargo install --locked --git … --rev`), before the step that reads the secrets, so its crates'
    build scripts never see the seed. The fork's Actions are off; rulesets protect its `main` and its tags.
  - `src-tauri/tauri.windows-sign.conf.json` sets `bundle.windows.signCommand`. Tauri runs it for the app `.exe`, the
    NSIS plugin DLLs, the uninstaller and the installer, then makes the updater `.sig`, so the update signature covers
    the signed file. ssign signs PE files only, so Windows ships NSIS, not MSI.
  - A last step unpacks the installer with 7-Zip and fails unless the installer and every `.exe` in it are `Valid`,
    timestamped, and signed by the certificate whose thumbprint is `WINDOWS_SIGNER_SHA1`.
- **Fail closed.** While none of `CERTUM_EMAIL`, `CERTUM_OTP` and `WINDOWS_SIGNER_SHA1` exists, Windows ships
  unsigned with a notice. Once any exists, a missing one or any signing or check failure stops the release, and it
  stays a private draft.
- **The `updater` job** checks every updater `.sig` against the public key in `src-tauri/tauri.conf.json` with
  minisign before it writes `latest.json` ([updater-api.md](updater-api.md)).

What a failed Windows `sign` job means:

- "Not set in the release environment: WINDOWS_SIGNER_SHA1": run `bin/setup-windows-signing --thumbprint-from <pem>`.
- "signer thumbprint X, expected Y": the certificate changed or the PEM was another one. See
  [A new certificate](#a-new-certificate).
- A login failure that names another host: Certum redirected the login away from its servers, and our patched ssign
  refuses that. Find out why before working around it.
- A failure about the key type or size: ssign refuses a key that is not RSA or is under 2048 bits. Ask Certum.
- A login failure at Certum: do not re-run many times in a row; repeated bad codes can lock the account
  ([RongxinAI#1266](https://github.com/rongxinzy/RongxinAI/pull/1266)).
- ssign is unofficial: Certum can change its API and break it. Then releases stop at this job until the fork is fixed.

## Upkeep

- **Upstream ssign, monthly.** Read new commits and advisories of [Le-Syl21/ssign](https://github.com/Le-Syl21/ssign)
  (`cargo audit` on its lockfile). Move the fork only after reading the diff, through a squash-merged pull request
  there, then move the `--rev` in `release.yml` to that commit.
- **Certificate end date.** `bin/setup-windows-signing` printed it; set a reminder a month before.
