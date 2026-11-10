import { memo } from "../lib.mjs"

/** An agent's link waits for the owner as a match; the same link again answers the proposal it already made. */
export default function matches(ctx) {
  const pairs = ctx.data("matches.json")
  for (const m of pairs) memo(["people", "link", m.identity, m.other, "--reason", m.reason], { agent: true })
  return `${pairs.length} match suggestions in place`
}
