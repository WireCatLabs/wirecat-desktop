import { byOwner, type Subject, stateOf, subjectOf, tabOf } from "@/domain/memory"
import type { AgentCall, MemoryEntry } from "@/platform/memory-schemas"

const RUN_MS = 30 * 60_000

export type Run = { key: string; agent: string; at: string; entries: MemoryEntry[] }

/** Proposals by one author less than half an hour apart read as one agent run, the unit the owner reviews. */
export function runsOf(entries: readonly MemoryEntry[]): Run[] {
  const runs: Run[] = []
  const waiting = entries.filter((e) => e.status === "proposed")
  for (const e of [...waiting].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const agent = byOwner(e) ? "you" : (e.author?.name ?? "agent")
    const last = runs.at(-1)
    const lastAt = last?.entries.at(-1)?.createdAt
    if (last && last.agent === agent && lastAt && Date.parse(lastAt) - Date.parse(e.createdAt) < RUN_MS)
      last.entries.push(e)
    else runs.push({ key: e.ref, agent, at: e.createdAt, entries: [e] })
  }
  return runs
}

/** "findings" counts the facts and tasks of a batch, so "4 findings and 1 fact" says what the run holds. */
export function runCounts(run: Run): [string, number][] {
  const counts = new Map<string, number>()
  for (const e of run.entries) {
    const word = e.findings ? "findings" : e.type
    counts.set(word, (counts.get(word) ?? 0) + (e.findings?.length ?? 1))
  }
  return [...counts]
}

export type SubjectGroup = {
  key: string
  subject: Subject | null
  name: string
  entries: MemoryEntry[]
  waiting: number
  kept: number
  last: string
}

export function subjectsOf(entries: readonly MemoryEntry[], you: string, nobody: string): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>()
  for (const e of entries) {
    const subject = subjectOf(e)
    const key = subject?.key ?? "none"
    const name = subject?.kind === "you" ? you : (subject?.name ?? subject?.key ?? nobody)
    const g = groups.get(key) ?? { key, subject, name, entries: [], waiting: 0, kept: 0, last: e.createdAt }
    g.entries.push(e)
    if (tabOf(e.status) === "review") g.waiting++
    if (tabOf(e.status) === "inuse") g.kept++
    if (e.createdAt > g.last) g.last = e.createdAt
    groups.set(key, g)
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.waiting > 0) - Number(a.waiting > 0) ||
      Number(a.key === "none") - Number(b.key === "none") ||
      b.last.localeCompare(a.last),
  )
}

export type Event =
  | { kind: "record"; key: string; at: string; entry: MemoryEntry; verb: "proposed" | "confirmed" | "discarded" }
  | { kind: "call"; key: string; at: string; call: AgentCall }

export function eventsOf(entries: readonly MemoryEntry[], calls: readonly AgentCall[]): Event[] {
  const events: Event[] = []
  for (const e of entries) {
    if (!byOwner(e)) events.push({ kind: "record", key: `${e.ref}:p`, at: e.createdAt, entry: e, verb: "proposed" })
    const state = stateOf(e.status)
    const decidedAt = e.updatedAt && e.updatedAt !== e.createdAt ? e.updatedAt : byOwner(e) ? e.createdAt : null
    if (decidedAt && state !== "review")
      events.push({
        kind: "record",
        key: `${e.ref}:d`,
        at: decidedAt,
        entry: e,
        verb: tabOf(e.status) === "inuse" ? "confirmed" : "discarded",
      })
  }
  for (const c of calls) events.push({ kind: "call", key: `call:${c.id}`, at: c.at, call: c })
  return events.sort((a, b) => b.at.localeCompare(a.at))
}
