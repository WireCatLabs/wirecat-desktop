#!/usr/bin/env bash
# Screenshots of the "Add to memory" prototype, v2. Needs the Vite server of this worktree on PORT (default 1436).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT=${PORT:-1436}
OUT=.impeccable/mocks/memory/add/v2
shot() { # name query [extra capture args...]
  local name=$1 query=$2
  shift 2
  for theme in light dark; do
    local dark=()
    [[ $theme == dark ]] && dark=(--dark)
    nice -n 10 node scripts/capture.mjs "$OUT/$name-$theme.png" "$query" --port "$PORT" --width 1280 --height 840 \
      --wait "${WAIT:-2500}" "${dark[@]}" "$@"
    nice -n 10 node scripts/capture.mjs "$OUT/narrow-$name-$theme.png" "$query" --port "$PORT" --width 960 \
      --height 640 --wait "${WAIT:-2500}" "${dark[@]}" "$@"
  done
}

for s in closed source file link link-reading link-fail text image audio too-big unreadable about picker no-reader \
  extracting facts extract-fail done old; do
  shot "$s" "?onboarding=off&add=$s"
done

set_value='const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })) };'
pick_way='const way = (i) => document.querySelectorAll("#add-panel fieldset input[type=radio]")[i].click();'
wait='const wait = (ms) => new Promise((r) => setTimeout(r, ms));'

# Next turns on as soon as the text box has words, with no blur needed.
shot bug-next-text "?onboarding=off&add=source" --eval "$set_value $pick_way $wait way(2); await wait(400);
  set(document.querySelector('#add-panel textarea'), 'Lena prefers a short written summary after each call.')"
# A typed link: Read it, the page is read, then its title and an excerpt.
WAIT=100 shot bug-link-reading "?onboarding=off&add=source" --eval "$set_value $pick_way $wait way(1); await wait(2400);
  set(document.querySelector('#add-panel input[type=url]'), 'https://docs.example.com/northbridge/runbook');
  await wait(50); document.querySelector('#add-panel form button[type=submit]').click(); await wait(300)"
shot bug-link-read "?onboarding=off&add=source" --eval "$set_value $pick_way $wait way(1); await wait(400);
  set(document.querySelector('#add-panel input[type=url]'), 'https://docs.example.com/northbridge/runbook');
  await wait(50); document.querySelector('#add-panel form button[type=submit]').click(); await wait(2200)"
# A pasted link is read at once, with no button.
shot bug-link-paste "?onboarding=off&add=source" --eval "$pick_way $wait way(1); await wait(400);
  const dt = new DataTransfer(); dt.setData('text', 'https://docs.example.com/northbridge/runbook');
  document.querySelector('#add-panel input[type=url]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await wait(1800)"
# The picker by keyboard: type "le", Enter ticks Lena Ortiz and she becomes a chip.
shot picker-keys "?onboarding=off&add=about" --eval "$set_value $wait const f = document.querySelector('#add-panel [role=combobox]');
  f.focus(); set(f, ''); await wait(100);
  f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await wait(100);
  f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await wait(100);
  set(f, 'le'); await wait(100);
  f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(100);
  set(f, 'nor'); await wait(200)"
