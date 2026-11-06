# Windows signing: the owner's setup

What is left before a release tag signs the Windows installer with Certum SimplySign. The design and its reasons are
in [the first-release plan](2026-10-29-first-release.md#windows-certum) and
[the signing flow and decisions](2026-11-06-windows-signing-flow.md); the security review of the signing tool is
[ssign review](../research/2026-11-05-ssign-review.md).

**Order (decisions D1 and D3).** The seed goes in only after two things have landed: the split of build and signing
(done, see section 1) and all six hardening patches in our ssign fork, with the `--rev` in `release.yml` moved to the
patched commit (`c7a3b2a`). Both are on `main` since 2026-11-06.
The Certum login and a real signature were checked on 2026-11-07 with `bin/test-windows-signing`.

## 1. Already done

- **Our fork of ssign**: [WireCatLabs/ssign](https://github.com/WireCatLabs/ssign), at
  `b5bfd4a13dcf81927d0864308b015d030d9b9dde`: upstream v0.1.10 (`44335a7`), which carries our patches P1-P6 since
  [Le-Syl21/ssign#20](https://github.com/Le-Syl21/ssign/pull/20), plus `FORK.md` and `deny.toml`.
  - Actions are disabled, so none of upstream's CI jobs (crates.io publish, Certum signing) can run there.
  - [Ruleset 26654540](https://github.com/WireCatLabs/ssign/settings/rules/26654540) protects `main`: no deletion, no
    force push, changes only through a pull request with squash merge.
  - [Ruleset 26654542](https://github.com/WireCatLabs/ssign/settings/rules/26654542) protects every tag from deletion
    and update.
  - Issues, wiki and projects are off.
- **The `release` environment** of wirecat-desktop ([Settings → Environments](https://github.com/WireCatLabs/wirecat-desktop/settings/environments))
  admits only `v*` tags (deployment policy 65676080). A branch or a pull request cannot read its secrets. It has no
  required reviewers yet, and administrators can bypass it.
- **The workflow** ([`release.yml`](../../../.github/workflows/release.yml)):
  - The `build` job compiles the app with no secret and no environment. Every npm and Rust build script runs there.
  - The `sign` job, the only one in the `release` environment, takes that compiled app and runs `tauri bundle`. It
    installs only the Tauri CLI and, on Windows, ssign; it never runs `pnpm install` or our dependencies' scripts.
  - ssign is built from our fork at the full commit hash, with `cargo install --locked`.
  - After signing, it unpacks the installer and checks the installer and every `.exe` inside it: the signature is
    `Valid`, it has a timestamp, and the signer's certificate thumbprint equals `WINDOWS_SIGNER_SHA1` (#131).
  - The `updater` job checks every updater `.sig` against the public key in `src-tauri/tauri.conf.json` with
    minisign before it writes `latest.json`.
  - **Fail closed (D4), automatic:** while none of `CERTUM_EMAIL`, `CERTUM_OTP` and `WINDOWS_SIGNER_SHA1` exists,
    Windows ships unsigned with a notice. Once any of them exists (step 5 sets all three), a missing one or any
    signing or check failure stops the release, and it stays a private draft.
- **The setup script** [`bin/setup-windows-signing`](../../../bin/setup-windows-signing) reads the seed straight from
  the QR image (`--qr`) and sets the thumbprint variable (`--thumbprint-from`). It never prints the seed.
- **Not done:** no `CERTUM_*` secret and no `WINDOWS_SIGNER_SHA1` variable exist yet. Nothing has been signed.

## 2. What the seed is

The SimplySign phone app shows a 6-digit code that changes every 30 seconds. It computes the code from a **seed**, a
secret inside the QR code that activated the app (an `otpauth://` link). GitHub needs that seed and your Certum login
e-mail to sign. There is no PIN: **the seed and the e-mail are the whole credential.** Whoever has them can sign
programs as WireCat until Certum resets the seed.

So the seed goes from the QR image straight into GitHub. It is not shown on screen, not saved in a file on disk, and
not kept anywhere else. If it is ever needed again, Certum's help line resets it (section 6).

## 3. Your steps

Steps 1 to 8 store the seed, after step A. Run them in one sitting: the QR page must stay open from step 3 to step 7.

**Step 0. Use the setup copy of the repository.** The shared checkout at `/home/leemour/Projects/AI/visage` may be on
an old branch, and other sessions use it, so do not switch it. A separate copy on `main` is at
`/home/leemour/Projects/AI/visage/.claude/worktrees/signing-setup`. If it is missing, create it:

```sh
git -C /home/leemour/Projects/AI/visage worktree add --detach .claude/worktrees/signing-setup origin/main
```

If it exists, bring it up to date with `main` (it may predate the scripts below):

```sh
git -C /home/leemour/Projects/AI/visage/.claude/worktrees/signing-setup pull -q --ff-only origin main
```

**Step A. Move the signing secrets into the `release` environment** (any time; it does not need the seed). The updater
key and the five Apple secrets are repository secrets today, which any branch's workflow can read. GitHub cannot copy a
secret, so the script reads each value again:

```sh
/home/leemour/Projects/AI/visage/.claude/worktrees/signing-setup/bin/move-signing-secrets
```

- The updater key and its password come from your keyring; the `.p12` from
  `/home/leemour/.config/wirecat-signing/developer-id.p12` and its password from the keyring. `--help` lists the
  options for other files.
- It asks for your Apple ID and the app-specific password. Apple never shows that password again: if you do not have
  it, make a new one at [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific
  Passwords first.
- Then it lists the secrets the environment now holds and asks before it deletes their repository copies. If you say
  no, run it later with `--delete-only`.
- After this, the `macOS signing check` workflow cannot read the Apple secrets any more; it is listed in `CLEANUP.md`.

**Step 1. Install the QR reader** (Ubuntu package `zbar-tools`):

```sh
sudo apt install zbar-tools
```

**Step 2. Get the certificate file and open the QR page.**

- The certificate (public, not secret): download it from your Certum account as a PEM file, for example to
  `/home/leemour/Downloads/wirecat-certum.pem`. If Certum gives a binary `.cer`, convert it:
  `openssl x509 -inform der -in /home/leemour/Downloads/wirecat-certum.cer -out /home/leemour/Downloads/wirecat-certum.pem`.
  I have not seen Certum's download page, so the file name and format are a guess.
- Then the QR code, one of two cases:
  - **A. The phone app is not activated yet.** Open the activation link from Certum's e-mail and enter the activation
    code from the second e-mail. A QR code appears on the page
    ([Certum: activating SimplySign](https://support.certum.eu/en/how-to-activate-access-to-simply-sign-application/)).
  - **B. The phone app is already activated.** That QR code is gone and cannot be shown again. Call Certum's help line
    and ask for a SimplySign reset. Certum's iOS manual, section 6.3, describes a 6-digit secret plus a link sent by
    e-mail, valid for 24 hours
    ([SimplySign iOS manual](https://files.certum.eu/documents/manual_en/SimplySign-Instruction-manual-iOS-6-1-2.pdf)).
    I expect the link and the secret to lead to a new QR code like case A; this was not tried. The reset makes the
    old phone setup stop working, so step 4 re-scans it.

**Step 3. Save the QR image to memory, not to disk.** `/dev/shm` is a folder held in RAM; it is gone after a
reboot. Right-click the QR code → "Save image as…" → `/dev/shm/simplysign-qr.png`. Do not save it to Downloads or
Pictures, and do not copy it to the clipboard: those keep a copy. If the browser cannot save it and you use the
built-in screenshot (Shift+PrtSc), Ubuntu also saves it to `/home/leemour/Pictures/Screenshots` and copies it to the
clipboard: in step 6, shred that file too, and copy some other text to replace the clipboard.

**Step 4. Scan the same QR code with the SimplySign phone app**, as Certum's guide says. Keep the page open. The
script in step 5 asks for the code the app shows, so the app must already work.

**Step 5. Give the seed and the thumbprint to GitHub:**

```sh
/home/leemour/Projects/AI/visage/.claude/worktrees/signing-setup/bin/setup-windows-signing --qr /dev/shm/simplysign-qr.png --thumbprint-from /home/leemour/Downloads/wirecat-certum.pem
```

- It asks for your SimplySign login e-mail and the 6-digit code the phone shows now.
- It reads the seed from the image and checks on this computer that it makes the same code. Nothing is sent for the
  check, and the seed is never printed.
- It stores `CERTUM_EMAIL` and `CERTUM_OTP` as secrets in the `release` environment and `WINDOWS_SIGNER_SHA1` as a
  variable there. It prints the certificate's subject, its end date and its thumbprint; these are public.
- The printed subject must name you or WireCat, not a Certum CA. If it names Certum, the PEM file starts with the CA
  certificate of a chain: save only your own certificate block to a file and run `--thumbprint-from` on that.
- If it says the code does not match, wait for the next code and run it again.

**Step 6. Delete the image:**

```sh
shred -u /dev/shm/simplysign-qr.png
```

**Step 7. Close the QR page.**

**Step 8. Turn off the administrator bypass.** [Settings → Environments → release](https://github.com/WireCatLabs/wirecat-desktop/settings/environments):
untick "Allow administrators to bypass configured protection rules", then save. The script never sends this setting,
so a re-run does not tick it again.

**Step 9 (not now, D2 B).** You chose no manual approval for now. If you change your mind: on the same page, add
yourself as a required reviewer. Then each release waits for your click before the `sign` jobs can read the seed. A re-run of the script keeps reviewers: once the environment
is limited to tags, the script does not change its settings at all.

## 4. How to check each step

Each command prints names or public values only. GitHub never shows a secret's value.

```sh
gh secret list --env release --repo WireCatLabs/wirecat-desktop
```

After step A: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and the five `APPLE_*` names. After
step 5, also `CERTUM_EMAIL` and `CERTUM_OTP` with today's date.

```sh
gh secret list --repo WireCatLabs/wirecat-desktop
```

After step A, with the deletion confirmed: none of those names.

```sh
gh variable list --env release --repo WireCatLabs/wirecat-desktop
```

Shows `WINDOWS_SIGNER_SHA1` with the 40-character thumbprint the script printed.

```sh
gh api repos/WireCatLabs/wirecat-desktop/environments/release --jq '{can_admins_bypass, rules: [.protection_rules[].type]}'
```

After step 8: `"can_admins_bypass": false`. After step 9, `rules` also lists `required_reviewers`.

```sh
gh api repos/WireCatLabs/wirecat-desktop/environments/release/deployment-branch-policies --jq '.branch_policies[] | "\(.type) \(.name)"'
```

Prints only `tag v*`.

## 5. The first signed release

Release as usual with `bin/tag-release`. In [Actions](https://github.com/WireCatLabs/wirecat-desktop/actions), open the
Release run, then the `sign (windows-latest, …)` job (the `build` job before it has no secret):

1. The `cargo install … https://github.com/WireCatLabs/ssign --rev <commit>` step builds ssign (a few minutes).
2. The `tauri bundle` step logs "Signing NSIS plugins" and then the installer. Each file is one Certum signature.
3. The last step prints one line per file, for the installer and each `.exe` inside it:
   `<file>: Valid, signer CN=…WireCat…, thumbprint <the same 40 characters>`, then
   `timestamp by CN=…Certum…`. Any `::error::` line there fails the build and the release stays a draft.

Then the **Install check** run should show `Signature: Valid` on Windows.

What can fail the first time, and what it means:

- "Not set in the release environment: WINDOWS_SIGNER_SHA1": step 5 ran without `--thumbprint-from`. Run the script
  with only `--thumbprint-from <pem>`.
- "signer thumbprint X, expected Y": the PEM was not the certificate Certum's cloud signs with. Check that the
  account has only one certificate.
- A failure inside the `tauri bundle` step on an NSIS plugin DLL: ssign refuses a file that is already signed (review
  RISK-3). This needs a small patch in our fork.
- A login failure that names another host: Certum redirected the login away from its own servers, and the patched
  ssign (P2) refuses that. Do not work around it; find out why Certum redirects first.
- A signing failure about the key type or size: the patched ssign (P5) refuses a key that is not RSA or is smaller
  than 2048 bits.
  Ask Certum which key the certificate has.
- A login failure at Certum: do not re-run many times in a row; repeated bad codes can lock the account. Check the
  e-mail and run the script again.

A failed run leaves a private draft: delete it and the tag, fix, tag again (the first-release plan, "If the first run
fails").

## 6. If the seed leaks, or the certificate changes

**The seed leaked** (a screenshot, a chat, a log, a lost laptop with the image on disk):

1. Stop CI from using it: `gh secret delete CERTUM_OTP --env release --repo WireCatLabs/wirecat-desktop`. The next
   release then stops at the Windows `sign` job instead of shipping unsigned (fail closed, D4), until a new seed is
   stored.
2. Call Certum's help line and reset SimplySign. Until then, anyone with the seed and your e-mail can sign as WireCat.
3. If you think someone signed something with it, ask Certum to revoke the certificate and issue a new one.
4. Do section 3 again from step 2, case B.

**The certificate is reissued** (Certum code-signing certificates last at most 459 days; a renewal or a revocation
gives a new one): the thumbprint changes, and the next release fails the check after signing. Update only the
variable; the seed stays:

```sh
/home/leemour/Projects/AI/visage/bin/setup-windows-signing --thumbprint-from /home/leemour/Downloads/wirecat-certum-new.pem
```

## 7. Risks

Details and evidence: [ssign review](../research/2026-11-05-ssign-review.md).

- **Closed: the app build no longer sees the seed** (review SEC-1). The `build` job has no secret. The code that sees
  `CERTUM_OTP` is the Tauri CLI, the NSIS tools it downloads, ssign and its crates. A poisoned dependency can still put
  code into the app that we then sign; only lockfiles and dependency review stop that.
- **ssign trusts Certum's replies more than it should** (SEC-2, SEC-3, SEC-5, SEC-6): it follows any link Certum's
  server names and does not check the timestamp reply or the cloud signature. Only someone controlling Certum's API
  responses can use this. The CI check catches a bad signature or a missing timestamp before release.
- **ssign is unofficial.** Certum can change its cloud API and break it. The release then stops at the Windows
  `sign` job until ssign is fixed.
- **The seed is a single factor.** Once it is in GitHub, the phone no longer protects signing.

## 8. Follow-ups

- **Hardening patches P1-P6 in our fork**: done (D1 B), pinned at `c7a3b2a`, then at `b5bfd4a` (upstream v0.1.10 with the patches merged, 2026-11-07). A later fork change lands as a
  squash-merged pull request there, then the `--rev` in `release.yml` moves to that commit.
- **Monthly check of upstream ssign** ([Le-Syl21/ssign](https://github.com/Le-Syl21/ssign)): read new commits and
  advisories (`cargo audit` on its lockfile), and move the fork only after reading the diff.
- **Certificate end date**: put a reminder a month before the date the script printed in step 5.
