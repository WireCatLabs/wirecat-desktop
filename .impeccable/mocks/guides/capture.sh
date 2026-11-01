#!/usr/bin/env bash
# Screenshots of the Guides prototype. Needs the Vite server of this worktree on PORT (default 1441).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT=${PORT:-1441}
OUT=.impeccable/mocks/guides
shot() { # name query [extra capture args...]
  local name=$1 query=$2
  shift 2
  for theme in light dark; do
    local dark=()
    [[ $theme == dark ]] && dark=(--dark)
    nice -n 10 node scripts/capture.mjs "$OUT/$name-$theme.png" "$query" --port "$PORT" --width 1280 --height 840 \
      --wait "${WAIT:-1500}" "${dark[@]}" "$@"
    nice -n 10 node scripts/capture.mjs "$OUT/narrow-$name-$theme.png" "$query" --port "$PORT" --width 960 \
      --height 640 --wait "${WAIT:-1500}" "${dark[@]}" "$@"
  done
}

shot list "?state=mixed&onboarding=off&section=guides"
shot open "?state=mixed&onboarding=off&section=guides&guide=requests-to-tasks"
shot missing "?state=mixed&onboarding=off&section=guides&guide=drive-brief"
shot first "?state=one&onboarding=off&section=guides&guides=first"
shot offline "?state=one&onboarding=off&section=guides&guides=offline&guide=catch-up"
shot onboarding-done "?state=mixed&onboarding=done"
shot list-ru "?state=mixed&onboarding=off&section=guides&guide=meeting-prep" --lang ru
shot list-es "?state=mixed&onboarding=off&section=guides" --lang es
