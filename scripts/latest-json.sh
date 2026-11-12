#!/usr/bin/env bash
# Writes latest.json from the files the release sign jobs made, after checking each updater signature with minisign
# against the public key every installed copy trusts (docs/dev/updater-api.md).
#   scripts/latest-json.sh <folder holding release-<os> folders> <tauri.conf.json> <version> <output file>
# RELEASE_ID set: each file must also be the asset on that draft, byte for byte, and its URL is the asset's API URL
# (the form tauri-action wrote, which the updater downloads). DRY_RUN=true: each folder brings its own throwaway key.
set -euo pipefail

files="$1"
conf="$2"
version="$3"
output="$4"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
platforms='{}'
failed=0

# The keys tauri-action wrote for 0.4.1: an installed copy looks up "<os>-<arch>-<bundle>" first, so a .deb copy
# updates only through linux-x86_64-deb.
add() {
  local folder="$files/$1" pattern="$2" key name url digest
  shift 2
  # shellcheck disable=SC2206 # the pattern is a glob on purpose
  local matches=("$folder"/$pattern)
  if [ "${#matches[@]}" -ne 1 ] || [ ! -f "${matches[0]}" ] || [ ! -f "${matches[0]}.sig" ]; then
    echo "::error::Expected one $pattern and its .sig in $folder."
    failed=1
    return
  fi
  local file="${matches[0]}"
  name="$(basename "$file")"
  if [ "${DRY_RUN:-false}" = true ]; then
    base64 -d "$folder/dry-run.pub" >"$work/key.pub"
  else
    jq -r .plugins.updater.pubkey "$conf" | base64 -d >"$work/key.pub"
  fi
  base64 -d "$file.sig" >"$work/sig"
  if ! minisign -V -q -p "$work/key.pub" -m "$file" -x "$work/sig"; then
    echo "::error::$name: its updater signature does not match the public key, so no installed copy would update."
    failed=1
    return
  fi
  echo "$name: updater signature verified"
  if [ -n "${RELEASE_ID:-}" ]; then
    read -r url digest <<<"$(gh api "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID/assets" --paginate \
      --jq ".[] | select(.name == \"$name\") | \"\(.url) \(.digest)\"")" || true
    if [ "${digest:-}" != "sha256:$(sha256sum "$file" | cut -d' ' -f1)" ]; then
      echo "::error::$name on the draft is missing or differs from the verified file. Re-run this job;" \
      "if it fails again, re-run the sign job of that system."
      failed=1
      return
    fi
  else
    url="https://example.invalid/dry-run/$name"
  fi
  for key in "$@"; do
    platforms="$(jq --arg k "$key" --arg u "$url" --rawfile s "$file.sig" '.[$k] = {signature: $s, url: $u}' \
      <<<"$platforms")"
  done
}

add release-windows-latest '*_x64-setup.exe' windows-x86_64 windows-x86_64-nsis
add release-macos-latest '*_universal.app.tar.gz' darwin-aarch64 darwin-x86_64 darwin-universal \
  darwin-aarch64-app darwin-x86_64-app darwin-universal-app
add release-ubuntu-22.04 '*.AppImage' linux-x86_64 linux-x86_64-appimage
add release-ubuntu-22.04 '*.deb' linux-x86_64-deb
add release-ubuntu-22.04 '*.rpm' linux-x86_64-rpm
[ "$failed" = 0 ] || exit 1

jq -n --arg v "$version" --arg d "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" --argjson p "$platforms" \
  '{version: $v, notes: "", pub_date: $d, platforms: $p}' >"$output"
