#!/usr/bin/env bash
# `pnpm dev --port 1494`, then `capture.sh <out dir>`. The People page, light and dark, 1280 and 960 wide.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
out=${1:?out dir}
H='const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const openP=async(ref)=>{document.querySelector(`[data-person="${ref}"] [aria-expanded]`).click();await wait(900)};
const btn=(t)=>[...document.querySelectorAll("button")].find(b=>b.textContent.trim().startsWith(t));'
shot() { # name query eval [width] [lang]
  for theme in light dark; do
    local d=""; [ "$theme" = dark ] && d="--dark"
    node "$repo/scripts/capture.mjs" "$out/$1-$theme.png" "$2" --port 1494 --width "${4:-1280}" --height 900 --wait 600 --lang "${5:-en}" $d --eval "$H $3"
  done
}
Q='?section=people&onboarding=off'
shot list "$Q" 'await wait(10)'
shot person "$Q" 'await openP("person:7");document.querySelector("[data-person=\"person:7\"]").scrollIntoView({block:"start"})'
shot person-narrow "$Q" 'await openP("person:7");document.querySelector("[data-person=\"person:7\"]").scrollIntoView({block:"start"})' 960
shot reject "$Q" 'btn("Not the same").click();await wait(300)'
shot split "$Q" 'await openP("person:7");btn("Move accounts").click();await wait(400)'
shot undo "$Q" 'await openP("person:7");btn("Undo").click();await wait(400)'
shot stale "$Q&people-fail=stale" 'btn("Same person").click();await wait(900)'
shot old "?section=people&onboarding=off&people=old" 'await wait(10)'
shot person-ru "$Q" 'await openP("person:7");document.querySelector("[data-person=\"person:7\"]").scrollIntoView({block:"start"})' 960 ru
