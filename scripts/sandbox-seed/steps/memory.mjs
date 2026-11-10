import { memo, memoEach } from "../lib.mjs"
import { smsRef } from "./phone.mjs"

// Facts and memories have no seed id in the store, so each is known by its text. A state is reached the way it is
// in use: the owner's add is accepted at once, an agent's waits as proposed, and the owner's decision moves it on.
const FACT_STATES = ["proposed", "accepted", "superseded", "reversed", "rejected"]
const MEMORY_STATES = ["proposed", "confirmed", "stale", "superseded"]
const OWNER = ["--from-app"]
const REASON = ["--reason", "seed: shows this state"]

function evidenceOf(ctx, item) {
  if (item.subject) return ctx.refs.get(item.subject)
  return smsRef(ctx.data("phone.json").messages[0])
}

function addFact(ctx, f, refs) {
  const agent = f.state === "proposed" || f.state === "rejected"
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
  const ref = memo(args, { agent }).item.ref
  if (f.state === "rejected") memo(["facts", "reject", ref, ...OWNER, ...REASON])
  if (f.state === "reversed") memo(["facts", "reverse", ref, ...OWNER, ...REASON])
  return ref
}

function addMemory(ctx, m) {
  const agent = m.state === "proposed"
  const ref = memo(
    [
      "memories",
      "add",
      m.text,
      "--kind",
      m.kind,
      "--scope",
      "work",
      "--evidence",
      evidenceOf(ctx, m),
      ...(agent ? [] : OWNER),
    ],
    { agent },
  ).item.ref
  if (m.state === "stale") memo(["memories", "invalidate", ref, ...OWNER, ...REASON])
}

export default function memory(ctx) {
  const { facts, memories } = ctx.data("memory.json")
  const factRefs = new Map(memoEach(["facts", "list"], "status", FACT_STATES).map((f) => [f.text, f.ref]))
  const refs = new Map()
  let addedFacts = 0
  for (const f of facts) {
    let ref = factRefs.get(f.text)
    if (!ref) {
      ref = addFact(ctx, f, refs)
      addedFacts++
    }
    refs.set(f.id, ref)
  }
  const haveMemories = new Set(memoEach(["memories", "list"], "status", MEMORY_STATES).map((m) => m.text))
  const newMemories = memories.filter((m) => !haveMemories.has(m.text))
  for (const m of newMemories) addMemory(ctx, m)
  return `${addedFacts} facts added, ${newMemories.length} memories added`
}
