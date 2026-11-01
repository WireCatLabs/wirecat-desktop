#!/usr/bin/env bash
# Screenshots of the Guides prototype. Needs a Vite server of this worktree on PORT (default 1437, the review server).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT=${PORT:-1437}
OUT=.impeccable/mocks/guides/v4
shot() { # name query [extra capture args...]
  local name=$1 query=$2
  shift 2
  for theme in light dark; do
    local dark=()
    [[ $theme == dark ]] && dark=(--dark)
    nice -n 10 node scripts/capture.mjs "$OUT/$name-$theme.png" "$query" --port "$PORT" --width 1280 --height 840 \
      --wait "${WAIT:-9000}" "${dark[@]}" "$@"
    nice -n 10 node scripts/capture.mjs "$OUT/narrow-$name-$theme.png" "$query" --port "$PORT" --width 960 \
      --height 640 --wait "${WAIT:-9000}" "${dark[@]}" "$@"
  done
}

shot list "?state=mixed&onboarding=off&section=guides"
shot open "?state=mixed&onboarding=off&section=guides&guide=requests-to-tasks"
shot missing "?state=mixed&onboarding=off&section=guides&guide=drive-brief"
shot one "?state=one&onboarding=off&section=guides"
shot first "?state=one&onboarding=off&section=guides&guides=first"
shot offline "?state=one&onboarding=off&section=guides&guides=offline&guide=catch-up"
shot onboarding-done "?state=mixed&onboarding=done"
shot list-ru "?state=mixed&onboarding=off&section=guides&guide=meeting-prep" --lang ru
WAIT=300 shot checking "?state=mixed&onboarding=off&section=guides"
shot list-es "?state=mixed&onboarding=off&section=guides" --lang es
shot search "?state=mixed&onboarding=off&section=guides&q=call"
