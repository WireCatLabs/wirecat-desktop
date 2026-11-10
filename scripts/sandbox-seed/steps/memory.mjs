import { memo, memoAll } from "../lib.mjs"
import { smsRef } from "./phone.mjs"

// Facts and memories have no seed id in the store, so each is known by its text. A state is reached the way it is
// in use: the owner's add is accepted at once, an agent's waits as proposed, and the owner's decision moves it on.
// A row found in another state (a load stopped between the add and the decision) is moved the same way.
const FACT_STATES = ["proposed", "accepted", "superseded", "reversed", "rejected"]
const MEMORY_STATES = ["proposed", "confirmed", "stale", "superseded"]
const OWNER = ["--from-app"]
const REASON = ["--reason", "seed: shows this state"]

const FACT_MOVES = {
  "proposed>rejected": (ref) => ["facts", "reject", ref, ...OWNER, ...REASON],
  "accepted>reversed": (ref) => ["facts", "reverse", ref, ...OWNER, ...REASON],
  "proposed>accepted": (ref) => ["facts", "confirm", ref, ...OWNER],
}
const MEMORY_MOVES = {
  "confirmed>stale": (ref) => ["memories", "invalidate", ref, ...OWNER, ...REASON],
  "proposed>confirmed": (ref) => ["memories", "confirm", ref, ...OWNER],
}

/** Text → ref and state, one list per state: these lists take no OR. */
const byText = (group, states) =>
  new Map(states.flatMap((s) => memoAll([group, "list", "--", `status:${s}`]).map((r) => [r.text, { ...r, state: s }])))

function moveTo(moves, ref, from, to) {
  const move = moves[`${from}>${to}`]
  if (move) memo(move(ref))
  return Boolean(move)
}

function evidenceOf(ctx, item) {
  if (item.subject) return ctx.refs.get(item.subject)
  return smsRef(ctx.data("phone.json").messages[0])
}

const agentAdds = (state) => state === "proposed" || state === "rejected"

function addFact(ctx, f, refs) {
  const agent = agentAdds(f.state)
  const args = [
    "facts",
    "add",
    f.text,
    "--kind",
    f.kind,
    ...(f.project ? ["--project", f.project] : []),
    ...(f.subject ? ["--subject", ctx.refs.get(f.subject)] : []),
    ...(f.supersedes ? ["--supersedes", refs.get(f.supersedes)] : []),
    ...(agent ? ["--evidence", evidenceOf(ctx, f)] : OWNER),
  ]
  return { ref: memo(args, { agent }).item.ref, state: agent ? "proposed" : "accepted" }
}

function addMemory(ctx, m) {
  const agent = m.state === "proposed"
  const args = ["memories", "add", m.text, "--kind", m.kind, "--scope", "work", "--evidence", evidenceOf(ctx, m)]
  return { ref: memo([...args, ...(agent ? [] : OWNER)], { agent }).item.ref, state: agent ? "proposed" : "confirmed" }
}

export default function memory(ctx) {
  const { facts, memories } = ctx.data("memory.json")
  const refs = new Map()
  const counts = { facts: 0, memories: 0, moved: 0 }

  const haveFacts = byText("facts", FACT_STATES)
  for (const f of facts) {
    let row = haveFacts.get(f.text)
    if (!row) {
      row = addFact(ctx, f, refs)
      counts.facts++
    }
    if (moveTo(FACT_MOVES, row.ref, row.state, f.state)) counts.moved++
    refs.set(f.id, row.ref)
  }

  const haveMemories = byText("memories", MEMORY_STATES)
  for (const m of memories) {
    let row = haveMemories.get(m.text)
    if (!row) {
      row = addMemory(ctx, m)
      counts.memories++
    }
    if (moveTo(MEMORY_MOVES, row.ref, row.state, m.state)) counts.moved++
  }
  return `${counts.facts} facts added, ${counts.memories} memories added, ${counts.moved} moved to their state`
}
