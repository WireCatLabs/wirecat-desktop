#!/usr/bin/env bash
# `pnpm dev --port 1493`, then `capture.sh <out dir>`. Captures of Add to memory, the source review and Settings' reader choice, light and dark, 1280 and 960 wide.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
out=${1:?out dir}
H='const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const setVal=(el,v)=>{const p=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}))};
const btn=(t)=>[...document.querySelectorAll("button")].find(b=>b.textContent.trim().startsWith(t));
const top=(el)=>el&&el.scrollIntoView({block:"start"});
const panel=()=>document.querySelector("section[aria-labelledby=add-to-memory-title]");'
SAVE='setVal(document.querySelector("textarea"),"Call with Lena Ortiz. Northbridge Bench moves the eval set to 120 queries, and delivery is on the 28th.");await wait(100);(btn("Save")||btn("Сохранить")).click();await wait(1600);'
SUGGEST='[...panel().querySelectorAll("label")].find(l=>l.textContent.includes("Lena Ortiz")).click();await wait(100);btn("Suggest facts").click();await wait(3200);'
KEEP='btn("Keep").click();await wait(1200);'
shot() { # name query eval [width]
  for theme in light dark; do
    local d=""; [ "$theme" = dark ] && d="--dark"
    node "$repo/scripts/capture.mjs" "$out/$1-$theme.png" "$2" --port 1493 --width "${4:-1280}" --height 900 --wait 600 --lang "${5:-en}" $d --eval "$H $3"
  done
}
Q='?section=memory&onboarding=off'
shot closed "$Q" 'await wait(10)'
shot source "$Q&add=open" 'await wait(10)'
shot source-link "$Q&add=open" 'btn("Link")||0;[...document.querySelectorAll("label")].find(l=>l.textContent.startsWith("Link")).click();await wait(300);'
shot saved "$Q&add=open" "$SAVE top(panel())"
shot facts "$Q&add=open" "$SAVE $SUGGEST top(panel())"
shot facts-narrow "$Q&add=open" "$SAVE $SUGGEST top(panel())" 960
shot done "$Q&add=open" "$SAVE $SUGGEST $KEEP top(panel())"
shot no-reader "$Q&add=open&readers=unchosen" "$SAVE top(panel())"
shot link-fail "$Q&add=open&add-fail=link" '[...document.querySelectorAll("label")].find(l=>l.textContent.startsWith("Link")).click();await wait(200);setVal(document.querySelector("input[type=url]"),"https://example.org/gone");await wait(100);btn("Save").click();await wait(1800);'
R='[...document.querySelectorAll("[data-row]")].find(r=>r.textContent.includes("Project Harbour this week")).querySelector("[aria-expanded]").click();await wait(1200);top(document.querySelector("section[aria-labelledby$=-review]")?.closest("[data-row]"));'
shot review "$Q&memory=changed&onboarding=off" "$R"
shot review-narrow "$Q&memory=changed&onboarding=off" "$R" 960
shot review-deleted "$Q&memory=changed&onboarding=off" '[...document.querySelectorAll("[data-row]")].find(r=>r.textContent.includes("Both pilot clinics sign")).querySelector("[aria-expanded]").click();await wait(1200);top(document.querySelector("section[aria-labelledby$=-review]")?.closest("[data-row]"));'
shot settings "?section=settings&onboarding=off" 'await wait(800);top([...document.querySelectorAll("h3")].find(h=>h.textContent==="Reading for facts"));'
shot settings-ru "?section=settings&onboarding=off" 'await wait(800);top([...document.querySelectorAll("h3")].find(h=>h.textContent==="Чтение фактов"));' 1280 ru
shot facts-ru "$Q&add=open" "setVal(document.querySelector(\"textarea\"),\"Звонок с Lena Ortiz. Northbridge Bench: 120 запросов, поставка 28-го.\");await wait(100);btn(\"Сохранить\").click();await wait(1600);[...panel().querySelectorAll(\"label\")].find(l=>l.textContent.includes(\"Lena Ortiz\")).click();await wait(100);btn(\"Предложить факты\").click();await wait(3200);top(panel())" 960 ru
