/** The parts of a Memory page record these rules read; the platform's `MemoryEntry` has them. */
type Entry = { type: string; kind: string; status: string; author: { type: string } | null }

export type Tab = "review" | "inuse" | "discarded" | "all"
export type Tone = "ok" | "warn" | "bad" | "idle"
/** What the page says about a record's status, in one short word each. */
export type State = "review" | "inuse" | "approved" | "done" | "failed" | "discarded" | "replaced" | "other"

const STATE: Record<string, State> = {
  proposed: "review",
  confirmed: "inuse",
  accepted: "inuse",
  approved: "approved",
  executed: "done",
  failed: "failed",
  stale: "discarded",
  reversed: "discarded",
  rejected: "discarded",
  superseded: "replaced",
}

export const stateOf = (status: string): State => STATE[status] ?? "other"

/** An unknown status from a newer memo shows under All only. */
export function tabOf(status: string): Exclude<Tab, "all"> | null {
  const s = stateOf(status)
  if (s === "review") return "review"
  if (s === "inuse" || s === "approved" || s === "done" || s === "failed") return "inuse"
  if (s === "discarded" || s === "replaced") return "discarded"
  return null
}

export const inTab = (tab: Tab, status: string) => tab === "all" || tabOf(status) === tab

export function toneOf(status: string): Tone {
  const s = stateOf(status)
  if (s === "review") return "warn"
  if (s === "inuse" || s === "approved" || s === "done") return "ok"
  if (s === "failed") return "bad"
  return "idle"
}

/** memo writes the owner's records as a person and an agent's as a bot; agents have names, the owner has none. */
export const byOwner = (e: Entry) => e.author?.type === "person"

export type Can = { confirm: boolean; discard: boolean; correct: boolean; forget: boolean }

/**
 * What memo 0.130.0 lets the owner do with each record. A proposed or accepted fact of any kind is corrected
 * (`facts add --supersedes`); an action is approved or discarded, never corrected or forgotten.
 */
export function can(e: Entry): Can {
  const s = e.status
  const decision = e.kind === "decision"
  if (e.type === "action")
    return { confirm: s === "proposed", discard: s === "proposed", correct: false, forget: false }
  if (e.type === "fact")
    return {
      confirm: s === "proposed",
      discard: s === "proposed" || (s === "accepted" && decision),
      correct: s === "proposed" || s === "accepted",
      forget: true,
    }
  return {
    confirm: s === "proposed",
    discard: s === "proposed" || s === "confirmed",
    correct: s !== "superseded",
    forget: true,
  }
}

/** The local calendar day, so a record saved at 23:30 reads as that evening and not as the next day in UTC. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Entries in the order given, cut into runs of one day each. */
export function byDay<T extends { createdAt: string }>(entries: readonly T[]): { day: string; entries: T[] }[] {
  const groups: { day: string; entries: T[] }[] = []
  for (const e of entries) {
    const day = dayKey(e.createdAt)
    const last = groups.at(-1)
    if (last?.day === day) last.entries.push(e)
    else groups.push({ day, entries: [e] })
  }
  return groups
}

/** A filter typed in a field: empty matches everything, anything else matches a label containing it. */
export const matchesText = (label: string, typed: string) =>
  typed.trim() === "" || label.toLocaleLowerCase().includes(typed.trim().toLocaleLowerCase())

/** Every distinct label, in the order first seen, without empty ones. */
export const distinct = (labels: readonly (string | null)[]) => [...new Set(labels.filter((l): l is string => !!l))]
