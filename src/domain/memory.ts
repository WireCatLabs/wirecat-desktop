import { freeWords, setField, valuesOf } from "./query-terms"

/** The parts of a Memory page record these rules read; the platform's `MemoryEntry` has them. */
type Entry = { type: string; kind: string; status: string; author: { type: string } | null }

type Subjected = {
  subject: string | null
  subjectName: string | null
  subjectIsOwner: boolean
  project: string | null
  projectName: string | null
}

export type Subject = { key: string; kind: "you" | "person" | "project" | "other"; name: string | null }

/**
 * What a record is about, project first: a fact or a findings batch belongs to a project, a memory names a person or
 * a project as its subject. `name` is null when Memo gave only a ref.
 */
export function subjectOf(e: Subjected): Subject | null {
  if (e.project) return { key: e.project, kind: "project", name: e.projectName }
  if (e.subjectIsOwner) return { key: "you", kind: "you", name: null }
  if (!e.subject) return null
  const kind = e.subject.startsWith("project:") ? "project" : e.subject.startsWith("person:") ? "person" : "other"
  return { key: e.subject, kind, name: e.subjectName }
}

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

/** A date filter: a range back from now, or one calendar day picked from a record (`YYYY-MM-DD`). */
export type Range = "any" | "today" | "7d" | "30d" | (string & {})
export const RANGES = ["any", "today", "7d", "30d"] as const

export function inRange(range: Range, iso: string, now = new Date()): boolean {
  if (range === "any") return true
  if (range === "today") return dayKey(iso) === dayKey(now.toISOString())
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30
    return new Date(iso).getTime() >= now.getTime() - days * 86_400_000
  }
  return dayKey(iso) === range
}

// ---- The search words ----

/** The words Memory's search reads. `kind`, `project`, `subject` and `scope` are memo's own; `by` and `when` are the page's. */
export const MEMORY_FIELDS = "subject|project|kind|scope|by|when"
export type MemoryField = "subject" | "project" | "kind" | "scope" | "by" | "when"

export type MemoryFilter = Record<Exclude<MemoryField, "when">, string[]> & { when: Range; words: string[] }

export function memoryFilter(q: string): MemoryFilter {
  return {
    subject: valuesOf(q, "subject"),
    project: valuesOf(q, "project"),
    kind: valuesOf(q, "kind"),
    scope: valuesOf(q, "scope"),
    by: valuesOf(q, "by"),
    when: valuesOf(q, "when").at(-1) ?? "any",
    words: freeWords(q, MEMORY_FIELDS),
  }
}

/** Writes one field's choices into Memory's search. The owner, as a writer, is `by:me`. */
export const setMemoryField = (q: string, field: MemoryField, values: readonly string[]) => setField(q, field, values)

type Searchable = Entry &
  Subjected & {
    text: string | null
    summary: string | null
    scope: string | null
    author: { type: string; name: string | null } | null
    createdAt: string
  }

const has = (label: string | null | undefined, value: string) =>
  !!label && label.toLocaleLowerCase().includes(value.toLocaleLowerCase())

/** The project a record belongs to, by name: its own, or a memory's subject when that is a project. */
export const projectNameOf = (e: Subjected) =>
  e.projectName ?? (e.subject?.startsWith("project:") ? e.subjectName : null)

/**
 * Whether a record passes the search: each field matches any of its values, every free word is found somewhere in
 * the record. A value matches a ref exactly or a name in part, so `subject:"person:7"` and `subject:kai` both work.
 */
export function matchesFilter(e: Searchable, f: MemoryFilter, now = new Date()): boolean {
  const any = (values: string[], test: (v: string) => boolean) => values.length === 0 || values.some(test)
  const project = projectNameOf(e)
  const author = byOwner(e) ? null : (e.author?.name ?? null)
  return (
    any(f.subject, (v) => (v === "me" ? e.subjectIsOwner : e.subject === v || has(e.subjectName, v))) &&
    any(f.scope, (v) => e.scope === v) &&
    any(f.project, (v) => e.project === v || has(project, v)) &&
    any(f.kind, (v) => e.kind.toLowerCase() === v.toLowerCase()) &&
    any(f.by, (v) => (v === "me" ? byOwner(e) : has(author, v))) &&
    inRange(f.when, e.createdAt, now) &&
    f.words.every((w) => [e.text, e.summary, e.subjectName, project, author, e.kind].some((label) => has(label, w)))
  )
}
