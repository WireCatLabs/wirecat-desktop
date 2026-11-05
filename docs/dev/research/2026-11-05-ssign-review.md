# ssign: security and supply-chain review

- Date: 2026-11-05
- Subject: [ssign](https://github.com/Le-Syl21/ssign), the tool [`release.yml`](../../../.github/workflows/release.yml) uses to sign the Windows installer with
  Certum SimplySign.
- Commits: the pinned commit `f7ba7b2360a3e40bb8aa062d244d95c62a743b90` (v0.1.8) and current HEAD
  `222cb903731d385ab75e37e88564bcf4cb100458` (v0.1.9).
- Read in a local scratch clone of upstream, not kept. File and line references below are to ssign at 222cb90 unless
  they name another repository.
- The ids below are local to this report. The journal has not allocated them.

## Verdict

**OK with patches.** Fork from **`222cb903731d385ab75e37e88564bcf4cb100458` (v0.1.9)**, not from f7ba7b2.

- Nothing in ssign sends the seed, the code, the email or the session token to a host other than Certum's. I found no
  telemetry, no shelling out, no `danger_accept_invalid_certs` and no custom root certificates.
- The weak points are defensive, not malicious:
  - ssign trusts whatever URL Certum's server names (SEC-2, SEC-3).
  - It does not check the timestamp reply against its request (SEC-5).
  - It does not check the cloud signature before it embeds it (SEC-6).
- f7ba7b2 builds a TLS library with five open advisories into the binary. 222cb90 fixes them, and the source code is
  byte-identical between the two (RISK-1).
- The largest exposure of the seed is our own workflow, not ssign (SEC-1).

**What blocks:** nothing in ssign blocks the fork. The one change to make before the next signed tag is moving the
pin from f7ba7b2 to 222cb90 (or to our fork of it). Patches P1-P6 and our three CI checks are hardening that can
follow: check every `.exe`, pin the certificate thumbprint, require a timestamp.

Pin our fork with `cargo install --locked --git https://github.com/WireCatLabs/ssign --rev <full SHA>`. Vendoring and
a prebuilt binary add work and protect almost nothing more (see "Pinning").

## What was verified, and how

| Check | How | Result |
| --- | --- | --- |
| Every line of the `ssign` binary's code path | Read all of `src/main.rs`, `ssign-core/src/{auth,client,card,sign,session,otp,timestamp,authenticode,asn1}.rs` | Findings below |
| Source change between the two commits | `git diff --quiet f7ba7b2 222cb90 -- src ssign-core ssign-pkcs11` | No source change. Only `Cargo.lock`, the version in `Cargo.toml`, and two action pins in `ci.yml` |
| Windows dependency tree | `cargo tree --locked -p ssign --target x86_64-pc-windows-msvc -e normal,build` | 163 packages: `ssign`, `ssign-core` and 161 third-party crates. All from crates.io, no git dependencies |
| Advisories | `cargo audit` 0.22.2 on both lockfiles. Advisory database at commit `26fd2d43f7280a1fb925a3743ec463017afe7119`, fetched 2026-11-05 | See "Dependencies" |
| Licences, sources, bans, advisories | `cargo deny` 0.20.2, Windows target, dev-deps excluded, config in scratch `deny.toml` | HEAD passes. f7ba7b2 fails on 5 rustls advisories |
| Build scripts and proc macros | Grepped all 17 build scripts and 10 proc macros for process, network and file calls. Read `aws-lc-sys` `builder/` | Only `rustc --version` probes, compiler or cmake or nasm probes, and writes into `OUT_DIR`. No downloads |
| reqwest redirect and proxy behaviour | Read reqwest 0.13.5, tower-http 0.6.11 and hyper-util 0.1.20 sources in the scratch `CARGO_HOME`. `cargo tree -e features` | See SEC-3 and SEC-11 |
| Tauri's signing calls | `crates/tauri-bundler/src/bundle/windows/{sign.rs,nsis/mod.rs}` at tag `tauri-cli-v2.12.4` | See RISK-3 |
| Repository history | `gh api repos/Le-Syl21/ssign/{activity,contributors,issues,releases,branches/main}`, `activity?activity_type=force_push`, `git log --format=%G?` | See RISK-2 |
| Build and unit tests | `cargo build`/`cargo test -p ssign -p ssign-core`, `-j 1`, `nice`, `TMPDIR` in scratch. No `--ignored`, no network test | Build OK in 1 min 50 s. 31 tests passed, 2 ignored (`selftest_assembles_verifiable_pe`, `msi_hash_matches_osslsigncode`) |
| Seed in `--help` | `CERTUM_OTP=<fake> ssign --help` on the built binary | **Prints the seed** (SEC-4) |

Not done:
- No run against Certum. No credentials exist and none were requested.
- No signing of a real PE file, and no Windows verification.
- No check of the Certum TSA over HTTPS.
- No check of whether Tauri's NSIS plugin DLLs arrive already signed (RISK-3).

## Where each secret lives

What is held: the seed (`CERTUM_OTP`), the 6-digit code computed from it, the email, and the session token.

| Place | What is there | Evidence |
| --- | --- | --- |
| Command line (argv) | Nothing secret. Our config passes `--name`, `--url` and the file path only | [`src-tauri/tauri.windows-sign.conf.json`](../../../src-tauri/tauri.windows-sign.conf.json) |
| Environment | The seed and email, for every process of the tauri-action step | SEC-1 |
| Memory | The seed is wiped in part; the decoded seed bytes and the token are not | SEC-8 |
| Disk | Only the session token, in `session.json`. The seed and the code are never written. The only writes are `write_private` and the PE temp files | `session.rs:225-263`, `main.rs:209-316`; SEC-9 |
| Verbose log | `-v` prints the email and the card serial only. Our config does not pass `-v` | `main.rs:149-168` |
| Debug output | `Cli` derives `Debug`, but nothing prints it. `Token` and `CloudSession` have no `Debug` | `main.rs:23`, `auth.rs:26`, `session.rs:35` |
| Panics | Only on bad `otpauth://` input; the message does not contain the seed | DEBT-1 |
| Error messages | No error text in `auth.rs` or `otp.rs` includes the rejected input. The exception is a network error on the token exchange | SEC-10 |
| Failed login | No retry, so a wrong code is sent once. The signed temp file is removed on error | `main.rs:154-162`, `main.rs:236-238` |

## Findings, by severity

Every source reference is at both commits: the source is identical. Paths are inside the ssign repository.

### SEC-1 · Medium · The seed is visible to the whole app build, and to anything that ran before it (our workflow)

**What happens.**
- [`release.yml`](../../../.github/workflows/release.yml) (main at review time, lines 159-166) puts `CERTUM_EMAIL` and `CERTUM_OTP` into the env of the tauri-action step.
- That step runs `pnpm build` and the whole Rust build of the app. Every npm script and every Rust build script in it
  can read the seed. The plan already says so ([the first-release plan](../plans/2026-10-29-first-release.md#windows-certum), "How the workflow uses
  it", point 4).
- Earlier steps on the same runner have no secrets, but they can still plant something for that step:
  - write `PATH` or proxy variables into `$GITHUB_ENV` or `$GITHUB_PATH`;
  - replace `~/.cargo/bin/ssign`.
  Those earlier steps are `pnpm install` and `cargo install ssign`.
- The ssign build adds 161 third-party crates, 17 build scripts and the aws-lc C build to that runner. It is a small part of the
  app's own tree, which already sees the seed directly.

**Why it matters for the fork.** Hardening ssign does not move this boundary. Prebuilding ssign elsewhere does not
move it either. The app build is the large exposure.

**Possible fix (not verified).**
1. Build without secrets: `tauri build --no-bundle`.
2. Then bundle in a separate step that has the secrets: `tauri bundle --bundles nsis`. That step runs no compiler and
   no npm scripts.

I have not checked that tauri-action supports this split, or how it interacts with the updater `.sig`. This is an
IDEA for later, not a blocker.

### SEC-2 · Low–medium · The bearer token follows any URL the server names, including plain HTTP

- `ssign-core/src/client.rs:37-45`: `abs()` uses any `atom:link` that starts with `http` as it is.
- `client.rs:89-92`: `run_task` then sends `GET <that URL>` with `bearer_auth(token)`.
- So a poll reply that names `http://elsewhere/` sends the session token there in clear text. The token can sign for
  about 30 minutes.
- Who can trigger it: only someone who controls Certum's API responses (Certum itself, or a TLS man-in-the-middle with
  a trusted certificate). The API client turns redirects off (`client.rs:28`), so plain 3xx redirects cannot do it.

**Patch P1:** accept a link only when it is root-relative or starts with `https://cloudsign.webnotarius.pl/`; fail
otherwise. Also set `.https_only(true)` on the client.

### SEC-3 · Low–medium · The login follows redirects to any host and scheme, and a 307/308 re-sends the email and code

- `ssign-core/src/auth.rs:35-42`: a custom redirect policy follows up to 20 redirects to any host and any scheme,
  with a cookie store.
- The login is a form POST with `username` (email) and `password` (the current 6-digit code), at `auth.rs:79-90`.
- tower-http 0.6.11 `src/follow_redirect/mod.rs:274-291`:
  - 301/302 turn a POST into a GET with an empty body;
  - 303 does the same;
  - 307/308 keep the method and re-send the cloned body.
- reqwest 0.13.5 `src/redirect.rs:239-252` removes `Authorization` and `Cookie` on a cross-host hop, but not the body.
- So a 307 from Certum's login page to another host would hand that host the email and a valid code. The code is
  single-use and valid about 30 s, and only someone who controls Certum's responses can do this, as in SEC-2.
- The redirect policy also allows `https → http`.

**Patch P2:** in the policy, stop (or fail) when the next URL is not `https` on `cloudsign.webnotarius.pl`. The code
already records every hop, so finding the `?code=` still works. Add `.https_only(true)`.

### SEC-4 · Low · `ssign --help` prints the seed

- `src/main.rs:33-44`: the email, seed and code arguments read `CERTUM_EMAIL`, `CERTUM_OTP` and `CERTUM_TOKEN`
  through clap's `env`, and nothing sets `hide_env_values`.
- **Verified:** with `CERTUM_OTP=JBSWY3DPEHPK3PXPFAKE` in the environment, `ssign --help` and `ssign -h` both print
  `[env: CERTUM_OTP=JBSWY3DPEHPK3PXPFAKE]`, and `--help` also prints the email. A missing-argument error does not print
  it. Built binary at 222cb90, run in the scratch folder with a fake seed.
- In GitHub Actions, the log masks secret values. So the risk is a local run, or a log outside Actions.

**Patch P3:** `hide_env_values = true` on those three arguments.

### SEC-5 · Low–medium · The timestamp is fetched over plain HTTP and not checked against the request

- `src/main.rs:51`: the default TSA is `http://time.certum.pl/`. Plain HTTP is normal for RFC 3161, because the reply
  is signed.
- `ssign-core/src/timestamp.rs:14-60`:
  - sends no nonce;
  - checks only that the reply status is 0 or 1;
  - checks only that the token is shaped like CMS SignedData (`timestamp.rs:62-80`).
- It does not check:
  - that the token's `messageImprint` equals `SHA-256(signature)`;
  - that the token is signed;
  - which TSA signed it.
- So someone on the network path can swap in a well-formed token from another signature.
- Inferred impact: Windows would then reject the timestamp. The signature may look valid today but stop being valid
  when the certificate expires. I have not tested how `Get-AuthenticodeSignature` reports this.
- The TSA client (`timestamp.rs:33-41`) uses reqwest's default redirect policy. It sends only a hash of the
  signature, so nothing secret is at stake.

**Patch P4:**
- Add a random nonce.
- Parse `TSTInfo` from the token's eContent.
- Require `messageImprint == SHA-256(signature)` and the same nonce.

**CI check (ours):** fail unless `$sig.TimeStamperCertificate` is not null. This proves only that a timestamp is
present, not that it matches the signature. I have not tested whether Windows rejects a token with the wrong hash.
P4 is the real fix.

### SEC-6 · Low · The signature from the cloud is not checked locally, and CI checks only the installer

- `ssign-core/src/authenticode.rs:248-325` (`finalize`) embeds whatever bytes Certum returned. It does not verify them
  against the certificate's public key.
- `sign.rs:116-135` checks only that the reply is for the digest that was asked for.
- Our CI step (`release.yml` lines 176-182) checks only `nsis/*-setup.exe`. Tauri also signs:
  - the app `.exe` (`bundle.rs:169`);
  - the NSIS plugin DLLs;
  - the uninstaller.
  Inferred: a bad signature on those would ship unnoticed and break later. Windows would show the installed app as
  unsigned or tampered.

**Patch P5:** before `embed`, verify the RSA PKCS#1 v1.5 signature over `signed_attrs_set` with the certificate's
key. aws-lc-rs is already in the tree, so it needs no new crate (`aws_lc_rs::signature::UnparsedPublicKey` with
`RSA_PKCS1_2048_8192_SHA256`).

**CI check (ours):** also run `Get-AuthenticodeSignature` on `src-tauri/target/release/*.exe`.

**Correction (2026-11-05):** that path does not work. Tauri 2.12.4 copies the unsigned app exe back over
`target/release` after each bundle (`crates/tauri-bundler/src/bundle.rs`, "Restore unsigned and unpatched binary"),
so the signed copy exists only inside the installer. `release.yml` unpacks the installer with 7-Zip and checks every
`.exe` in it instead.

### SEC-7 · Low · The certificate is not pinned

- `ssign-core/src/card.rs:34-43` uses the first card in the account, with whatever certificate the cloud returns.
- With a cached session, it uses the certificate stored in the cache file (`session.rs:157-164`).
- Nothing checks that it is WireCat's certificate.

**Fix (ours, no fork patch needed):** in the CI check, require
`$sig.SignerCertificate.Thumbprint -eq '<expected SHA-1 thumbprint>'`. Store the thumbprint in the workflow; it is
not secret.

### SEC-8 · Low · The seed and token are wiped from memory only in part

- Wiped: `src/main.rs:110-118` wipes clap's copies and keeps the seed in `Zeroizing<String>`.
- Not wiped:
  - the decoded seed bytes (`otp.rs:22`, `Totp.secret: Vec<u8>`);
  - the intermediate strings in `Totp::parse` (`otp.rs:32-79`);
  - the session token (`auth.rs:26` `Token(String)`, `session.rs:37`).
- Not wipeable at all: the `CERTUM_OTP` variable stays in the process environment and in every other process of that
  step. That is SEC-1 again, and it makes this finding minor.

**Patch P6 (cheap):**
- `Zeroizing<Vec<u8>>` for `Totp.secret`;
- `Zeroizing<String>` for `Token`.

### SEC-9 · Low · The session token sits on disk in plain text, without Windows-specific protection

**What ssign does.**
- `session.rs:175-185` writes `{email, token, expires_at, serial, cert_pem}` to `session.json`. The token is reused
  for 18 minutes (`session.rs:32`, `:154`).
- Path (`session.rs:204-211`):
  1. `$XDG_RUNTIME_DIR/ssign/session.json`;
  2. otherwise `$HOME/.cache/ssign/session.json`;
  3. on Windows, otherwise `%TEMP%\ssign\session.json`.

**On a Windows runner (inferred).**
- Where the file lands depends on whether `HOME` reaches Tauri's child process. Either way it is inside
  `C:\Users\runneradmin`. I did not check the runner image.
- The owner and permission checks (`session.rs:137-147`, `:232-242`, `:248-252`) are `cfg(unix)` only. On Windows the
  file inherits the profile folder's access rules.
- The file outlives the signing step. Later steps of the same job can read it: today that is only the check step.
  The VM is destroyed after the job.

**Why the cache is needed.** Tauri runs ssign once per file. Without the cache, the second run would log in again with
the same single-use code and fail.

**Fix (ours, optional):** delete the folder in a final `if: always()` step. A one-line PowerShell step that removes
both candidate paths is enough.

### SEC-10 · Info · Network errors can print the one-time OAuth code

- reqwest's error message includes the request URL. The token exchange puts `client_id`, `client_secret` and the
  authorization `code` in the query string (`auth.rs:108-119`).
- A connection error there would print them in the log. GitHub would not hide them, because they are not secrets.
- The client id and secret are SimplySign Desktop's public constants (`auth.rs:23-24`). The code is single-use and
  already being redeemed. No action needed.

### SEC-11 · Info · Proxy settings

- The env vars `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` and `NO_PROXY` are honoured, in upper and lower case
  (hyper-util 0.1.20 `src/client/proxy/matcher.rs:228-236`, used by reqwest `async_impl/client.rs:417-419`).
- The Windows registry proxy is not read: reqwest's `system-proxy` feature is off. I checked with
  `cargo tree -e features`; hyper-util has no `client-proxy-system`.
- TLS is checked against the Windows certificate store (rustls-platform-verifier 0.7.0
  `src/verification/windows.rs`). That code reads no env vars, so a proxy sees only host names.
- An attacker who can set env vars for that step can also replace `ssign` itself (SEC-1).
- Optional: `.no_proxy()` on the three clients.
- Other network traffic (inferred): Windows checks revocation of the TLS end certificate
  (rustls-platform-verifier `windows.rs:459-465`). So CryptoAPI may make OCSP, CRL or AIA requests to the CA that
  issued Certum's TLS certificate, plus DNS lookups. None of them carries a secret.

### RISK-1 · Medium for f7ba7b2, none for 222cb90 · Open TLS advisories in the pinned commit

On Windows, f7ba7b2 builds in `rustls 0.23.43` and `rustls-webpki 0.103.15`. Both are in the f7ba7b2 Windows tree
(`cargo tree` in a scratch worktree). cargo-deny fails on:

| Advisory | Crate | Title | Reachable in ssign? (inferred) |
| --- | --- | --- | --- |
| [RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285) | rustls | TLS 1.3 handshake messages accepted across encryption levels | Yes: generic client |
| [RUSTSEC-2026-0349](https://rustsec.org/advisories/RUSTSEC-2026-0349) | rustls | ServerHello can downgrade later connections to classical key exchange | Yes, low |
| [RUSTSEC-2026-0346](https://rustsec.org/advisories/RUSTSEC-2026-0346) | rustls | `Debug` of session values exposes TLS secrets | No: ssign never prints them |
| [RUSTSEC-2026-0348](https://rustsec.org/advisories/RUSTSEC-2026-0348) | rustls | Brotli certificate decompression memory | Probably not: no brotli feature |
| [RUSTSEC-2026-0382](https://rustsec.org/advisories/RUSTSEC-2026-0382) | rustls-webpki | May accept distrusted intermediates | Probably not on Windows: the chain is built by Windows |

222cb90 has `rustls 0.23.46`, `rustls-webpki 0.103.16` and `webpki-root-certs 1.0.10`. cargo-deny passes there.

### RISK-2 · Medium · One maintainer, unsigned history, and an unofficial protocol

**Maintainer and history.**
- Created 2026-07-10. 71 commits; 59 by `Le-Syl21` (the GitHub contributors API). Others: 5 by dependabot, and 1 or 2
  each by five outside contributors, all through pull requests.
- The owner pushes straight to `main`: most activity events are `push` by the owner, and `main` is not protected
  (`gh api repos/Le-Syl21/ssign/branches/main` gives `protected=false`).
- No force-push since the repository was created: `activity?activity_type=force_push` returns 0 events, and the
  activity log reaches back to 2026-07-10.
- Commits and tags are not signed:
  - `git log %G?` shows `N` for the owner's commits;
  - `verification.reason = unsigned` for f7ba7b2 and 222cb90.
- Tags are annotated, and `v0.1.8`/`v0.1.9` point at f7ba7b2/222cb90.
- 0 open issues and 0 open PRs. 19 stars, 6 forks.

**Release process.**
- `ci.yml` builds 5 targets.
- It signs the Windows binary with ssign itself, behind the `signing` environment.
- It notarises the macOS binary.
- It publishes to crates.io through OIDC trusted publishing.
- Releases carry no checksums or attestations. We don't use them anyway.
- Third-party actions are pinned by SHA. First-party ones (`actions/checkout@v7`) are pinned by tag.

**Protocol.**
- The protocol was reverse-engineered (`docs/` in the repo).
- It logs in with SimplySign Desktop's built-in OAuth client id and secret (`auth.rs:23-24`).
- Certum could change or block this at any time. That is a business risk the plan already lists, not a code risk.

**What owning a fork changes.** A fork removes availability and takeover risk. It does not remove the protocol risk.

### RISK-3 · Unknown · Tauri signs NSIS plugin DLLs without checking whether they are already signed

- Tauri 2.12.4 `nsis/mod.rs:688-699` calls `try_sign` on each of `NSISdl.dll`, `StartMenu.dll`, `System.dll`,
  `nsDialogs.dll` and `additional/nsis_tauri_utils.dll`. It does not call `should_sign` first. `should_sign` is used
  only for resources (`:854`).
- ssign refuses a file that already has a signature (`authenticode.rs:339-341`).
- If any of those DLLs ships with an Authenticode signature, the first signed build fails at bundling. It fails closed:
  nothing ships wrong.
- I did not check whether they are signed. If it happens, the smallest fix is a fork patch: exit 0 on an
  already-signed file when a flag such as `--skip-signed` is passed. I would not add it before seeing the failure.

### DEBT-1 · Low · Bad `otpauth://` input can make ssign panic

- `otp.rs:83` divides by `period`, so `period=0` panics.
- `otp.rs:103` computes `10u32.pow(digits)`, so a large `digits` overflows.
- The input is our own secret, and the panic message does not contain it.
- Part of **P6:** reject `period == 0` and `digits` outside 6..=8.

### FIND-1 · Info · Code quality

- **Unsafe:** three blocks in total.
  - `MoveFileExW` for the atomic replace (`src/main.rs:325-341`);
  - `geteuid` (`session.rs:269`);
  - the PKCS#11 C entry point in `ssign-pkcs11`, which `cargo install … ssign` does not build.
- **No shelling out** anywhere.
- **Temp files:** created with `create_new`, synced, then atomically renamed in the target folder
  (`src/main.rs:260-316`).
- **Parsing network data:** uses `get()` and `checked_add`, with no unwraps on reply data. DER and PE parsing have
  fuzz targets (`fuzz/fuzz_targets/parsers.rs`) and regression tests (`asn1.rs`, `authenticode.rs`). The only
  unwraps are on a mutex and on constants (`auth.rs:36`, `asn1.rs` `oid()`).
- **Signs what it was given:** it reads the exact path Tauri passes, writes a temp file next to it, and renames it
  over the same path. The `--name` and `--url` values come from our fixed config.
- **Workspace config:** the repository's `.cargo/config.toml` (`/FORCE:UNRESOLVED` for MSVC) does not apply to
  `cargo install --git`. `cargo help install` says local config discovery is ignored.
- **Authenticode hashing** matches osslsigncode on the fixture (`authenticode.rs` test `pe_hash_matches_osslsigncode`).
  It also covers:
  - the checksum and security-directory exclusions;
  - the 8-byte padding;
  - a certificate table inside the headers or outside the file.

## Dependencies

| | f7ba7b2 | 222cb90 |
| --- | --- | --- |
| Packages in `Cargo.lock` (whole workspace) | 291 | 291 |
| Built for `ssign` on Windows (normal + build) | 163 | 163 |
| Git dependencies | none | none |
| Build scripts / proc macros in that tree | 17 / 10 | 17 / 10 |
| `cargo deny` (advisories, licences, sources, bans) | **fails**: 5 rustls advisories | passes |
| `cargo audit`, crates actually built | 5 rustls advisories, plus tokio "unsound" warning | tokio "unsound" warning only |

What else `cargo audit` reports on the whole lockfile, and why it does not reach the binary:
- **quinn-proto 0.11.17**: RUSTSEC-2026-0338, -0340, -0343. **chacha20 0.10.1**: yanked. Both are in the lockfile only
  as optional reqwest features. `cargo tree --workspace --target all -i` prints nothing, so they are never built.
- **rsa 0.9.10**: RUSTSEC-2023-0071. It is a dev-dependency of `ssign-core`, used only by a self-test.
- **tokio 1.53.1**: RUSTSEC-2026-0386, "unsound", in `AsyncFd`. `AsyncFd` exists only under `cfg(all(unix, feature
  = "net"))` (tokio `src/macros/cfg.rs:374-380`, `src/io/mod.rs:255-260`). So it is not compiled into the Windows
  binary.

Build scripts and proc macros:
- **Build scripts:** anyhow, aws-lc-rs, aws-lc-sys, cookie, generic-array, httparse, icu_normalizer_data,
  icu_properties_data, libc, mime_guess, proc-macro2, quote, rustls, serde, serde_core, serde_json, zmij.
- **Proc macros:** clap_derive, der_derive, displaydoc, document-features, serde_derive, time-macros, yoke-derive,
  zerofrom-derive, zeroize_derive, zerovec-derive.
- All come from their usual upstream projects (dtolnay, serde, RustCrypto, icu4x, AWS, rustls, clap).
- `aws-lc-sys` compiles C through cmake or cc. Its `prebuilt-nasm` feature is on in this tree (`cargo tree -e
  features`). On Windows x86_64 without `nasm` installed, it links prebuilt NASM object files that ship inside the
  crate (`builder/main.rs:1186-1195`, `builder/prebuilt-nasm/`). Whether the runner has `nasm` I did not check. It probes for `cmake`, `nasm`, `clang-cl` and `bindgen`. It downloads nothing.
- FFI in the shipped binary: aws-lc (C), Windows CryptoAPI through rustls-platform-verifier, and `MoveFileExW`.

Every change since f7ba7b2, judged:

| Commit | Author | Change | Judgement |
| --- | --- | --- | --- |
| 02aa041 | dependabot | `Swatinem/rust-cache` v2.9.2→v2.9.3 and `crates-io-auth-action` v1.0.5→v1.0.6, SHA-pinned | Upstream CI only; we don't run it |
| 4b3f6c2 | dependabot | der 0.8.3, libc 0.2.191, serde_json 1.0.154, uuid 1.29.0, zeroize 1.9.1 | Routine patch releases, lockfile only |
| d367424 | dependabot | rustls 0.23.43→0.23.46 | Security fix (RISK-1) |
| 65552e0 | AkagiYui (outside contributor, PR #16) | rustls-webpki 0.103.16, webpki-root-certs 1.0.10 | Security fix. Lockfile only: the diff changes only versions and checksums of those crates |
| 222cb90 | Le-Syl21 | Version 0.1.9, release | No code |

This lockfile diff changes only registry versions and checksums: no new source, no git dependency. cargo-deny's
sources check (crates.io only) passes at HEAD. `--locked` makes Cargo check each downloaded `.crate` against the
checksum in the lockfile.

## Recommendation

### Which commit

Fork at **`222cb903731d385ab75e37e88564bcf4cb100458`** (tag `v0.1.9`). It has the same code as the f7ba7b2 we
reviewed, and the TLS fixes.

### Patches for our fork

Keep the set small, so rebasing on upstream stays easy. In order of value:

1. **P1** (`client.rs`): poll links only on `https://cloudsign.webnotarius.pl`; `.https_only(true)`. Fixes SEC-2.
2. **P2** (`auth.rs`): redirect policy stops outside `https://cloudsign.webnotarius.pl`; `.https_only(true)`. Fixes
   SEC-3.
3. **P5** (`authenticode.rs`/`session.rs`): verify the cloud signature with the certificate's key before embedding.
   Fixes SEC-6.
4. **P4** (`timestamp.rs`): nonce, plus a check of `messageImprint` and nonce in `TSTInfo`. Fixes SEC-5.
5. **P3** (`main.rs`): `hide_env_values = true`. Fixes SEC-4.
6. **P6** (`otp.rs`, `auth.rs`): `Zeroizing` for the decoded seed and the token; reject `period == 0` and odd
   `digits`. Fixes SEC-8 and DEBT-1.

Leave `ssign-pkcs11`, `msi.rs` and the docs alone. Deleting them only makes merges harder.

Settings for the fork (owner):
- **Disable Actions in the fork.** Upstream `ci.yml` has jobs that publish to crates.io and that sign with Certum
  secrets. They would only fail, but nothing should run there.
- **Protect `main`.**

Changes in our own `release.yml` (wirecat-desktop, not the fork):
- Point `--rev` at the fork's patched commit, with the full 40-character SHA.
- Extend the check step:
  - `src-tauri/target/release/*.exe` as well as the installer (SEC-6); corrected under SEC-6: the exes inside the
    installer;
  - `SignerCertificate.Thumbprint` equals the pinned value (SEC-7);
  - a timestamp is present: `TimeStamperCertificate` is not null (SEC-5; P4 is the real fix).
- Optional: remove the session cache in an `if: always()` step (SEC-9).

### Pinning in CI

**Recommended: `cargo install --locked --git https://github.com/WireCatLabs/ssign --rev <full SHA>`.** It is what CI
does today, with our URL.

**Why this is already a strong pin.**
- A full commit SHA fixes the source.
- `Cargo.lock` with `--locked` fixes every dependency to a crates.io checksum.
- `--git` and `--rev` need no `Cargo.lock` change in our repo.

**What the fork adds.**
- Availability: upstream can be deleted, or its owner account taken over.
- A place for patches.

**Options weighed:**

| Option | Gain | Cost | Decision |
| --- | --- | --- | --- |
| `--rev` on our fork | Availability and patches. Integrity as above | None beyond the fork | **Use** |
| `cargo vendor` into the fork | Survives a crates.io outage or a deleted crate | About 160 crate folders in the repo, and the same build scripts still run. Inferred: yanked versions still install with a lockfile | Not worth it |
| Prebuilt binary in our own release, with an attestation, checked in CI | ssign's 17 build scripts no longer run on the signing runner. Saves the ssign build time (I did not measure it on Windows) | A release workflow, attestation checks and a checksum to update. The app build on that runner is far larger (SEC-1) | Not now. Reconsider only if SEC-1's build split is done, because only then does it remove real exposure |
| Build from source on each release (today) | Simple, reproducible from the SHA | A few minutes per release | Keep |

The one thing that would reduce exposure much more is SEC-1's split: compile without secrets, then bundle and sign
with them. That is our workflow, not the fork.
