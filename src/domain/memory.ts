import { personName } from "./people"
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

export type Subject = {
  key: string
  kind: "you" | "person" | "project" | "organization" | "document" | "other"
  name: string | null
}

/**
 * What a record is about, project first: a fact or a findings batch belongs to a project, a memory names a person or
 * a project as its subject. `name` is null when Memo gave only a ref.
 */
export function subjectOf(e: Subjected): Subject | null {
  if (e.project) return { key: e.project, kind: "project", name: e.projectName }
  if (e.subjectIsOwner) return { key: "you", kind: "you", name: null }
  if (!e.subject) return null
  const prefix = e.subject.slice(0, e.subject.indexOf(":"))
  const kind =
    prefix === "project" || prefix === "person" || prefix === "organization"
      ? prefix
      : prefix === "document" || prefix === "note"
        ? "document"
        : "other"
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

type Reviewed = { status: string; sourceReview?: { id: string; cause: string } | null }

/** A record whose source changed waits for the owner as well: it shows under Waiting for you too, never only where it was. */
export const entryInTab = (tab: Tab, e: Reviewed) => inTab(tab, e.status) || (tab === "review" && !!e.sourceReview)

/** The causes memo names, mildest first; a newer memo's unknown cause reads as a plain change. */
export const REVIEW_CAUSES = ["changed", "outdated", "deleted", "contradicted"] as const
export type ReviewCause = (typeof REVIEW_CAUSES)[number]
export const causeOf = (cause: string): ReviewCause =>
  (REVIEW_CAUSES as readonly string[]).includes(cause) ? (cause as ReviewCause) : "changed"

export type ReviewChoice = "stillTrue" | "dismiss" | "correct" | "withdraw"

/**
 * The owner's answers to a source review. Correct writes a new version; Withdraw is memo's own "no longer holds" for
 * a memory in use or an accepted decision; memo has none for other facts, which keep Erase.
 */
export function reviewChoices(e: Held, revoke = false): ReviewChoice[] {
  const undo = undoOf(e, revoke)
  return [
    "stillTrue",
    "dismiss",
    ...(can(e, revoke).correct ? (["correct"] as const) : []),
    ...(undo === "invalidate" || undo === "reverse" ? (["withdraw"] as const) : []),
  ]
}

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
 * How the owner takes back a record already in use, in memo's own words: a memory stops holding (`invalidate`), a
 * decision is reversed. An approved action is a task now, dismissed on the Tasks page; a reviewed findings batch
 * made facts and tasks, each erased or dismissed where it is. memo has no way back for any other accepted fact.
 */
export type Undo = "reject" | "invalidate" | "reverse" | "revoke" | "task" | "created" | "none" | null

type Held = Entry & {
  findings?: unknown
  supersedes?: string | null
  ref?: string
  standing?: string | null | undefined
}

/**
 * An agent's accepted fact goes back to proposed with `facts revoke` when the installed memo has it (`revoke`). memo
 * refuses it for the owner's own fact and for an accepted correction, so those keep only Edit and Erase.
 */
export function undoOf(e: Held, revoke = false): Undo {
  const s = e.status
  if (s === "proposed") return "reject"
  if (e.type === "relationship") return null
  if (e.type === "action") return s === "approved" ? (e.findings ? "created" : "task") : null
  if (e.type === "fact") {
    if (s !== "accepted") return null
    if (e.kind === "decision") return "reverse"
    return revoke && !byOwner(e) && !e.supersedes ? "revoke" : "none"
  }
  return s === "confirmed" ? "invalidate" : null
}

/**
 * What memo 0.130.0 lets the owner do with each record. A proposed or accepted fact of any kind is corrected
 * (`facts add --supersedes`); an action is approved or discarded, never corrected or forgotten.
 */
export function can(e: Held, revoke = false): Can {
  const s = e.status
  const decision = e.kind === "decision" || undoOf(e, revoke) === "revoke"
  if (e.type === "action")
    return { confirm: s === "proposed", discard: s === "proposed", correct: false, forget: false }
  // The owner changes a relationship's role; what a connected app reports stays as the app says it. A proposal approved
  // here keeps its proposal ref until the next read, and memo changes only a `link:`.
  if (e.type === "relationship")
    return {
      confirm: s === "proposed",
      discard: s === "proposed",
      correct: s === "proposed" || (s === "confirmed" && e.standing === "confirmed" && !!e.ref?.startsWith("link:")),
      forget: false,
    }
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

/** Line breaks become spaces: memo keeps a memory as one or two sentences, and Rust refuses control characters. */
export const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

/** Whether a correction says something new: not empty, not the text it replaces once both are on one line. */
export const isCorrection = (text: string, original: string | null) =>
  oneLine(text) !== "" && oneLine(text) !== oneLine(original ?? "")

type Finding = { id: string; kind: string; outcome?: string | null }

/** How many findings Approve would create: the ones the owner did not untick. */
export const tickedCount = (findings: readonly Finding[] | null, skipped: readonly string[] | undefined) =>
  findings ? findings.filter((f) => !skipped?.includes(f.id)).length : 0

/**
 * The two counts a findings batch is told by: once reviewed, the ones created and the ones left; before, its facts
 * and its tasks.
 */
export function findingsCounts(findings: readonly Finding[], status: string) {
  if (status !== "proposed") {
    const created = findings.filter((f) => f.outcome === "accepted").length
    return { reviewed: true, first: created, second: findings.length - created }
  }
  const facts = findings.filter((f) => f.kind === "fact").length
  return { reviewed: false, first: facts, second: findings.length - facts }
}

export type SourceKind = "meeting" | "mail" | "message" | "note"

/** Which icon a source gets; `msg` is memo's short ref prefix for a chat message. */
export function sourceKindOf(kind: string): SourceKind {
  if (kind === "meeting" || kind === "mail") return kind
  return kind === "message" || kind === "msg" ? "message" : "note"
}

/** The kind a ref names: `mail:123` is a mail. */
export const refKind = (ref: string) => ref.split(":")[0] ?? ""

/** What a finished finding made, when it can be opened: a fact is shown in the list, a task on the Tasks page. */
export function createdTarget(created: string | null | undefined): "task" | "fact" | null {
  if (!created) return null
  if (created.startsWith("task:")) return "task"
  return created.startsWith("fact:") ? "fact" : null
}

/** The record's own undo in the menu, or null when memo has none or the lead button takes it. */
export const undoMenuKey = (undo: Undo) =>
  undo === "reject" || undo === "invalidate" || undo === "reverse" || undo === "revoke" ? undo : null

export type ApproveMode = "approve" | "review" | "approveFindings"

/** A findings batch is approved from its opened row, so what Approve creates is on screen; closed, it opens. */
export const approveMode = (hasFindings: boolean, open: boolean): ApproveMode =>
  !hasFindings ? "approve" : open ? "approveFindings" : "review"

export type StateLine =
  | "review"
  | "reviewFindings"
  | "reviewAction"
  | "reviewed"
  | "approved"
  | "approvedOld"
  | { state: State }

type Stated = Entry & { findings?: unknown; task?: unknown }

/** Which sentence the details give for the record's state. */
export function stateLineOf(e: Stated): StateLine {
  if (e.status === "proposed") {
    if (e.findings) return "reviewFindings"
    return e.type === "action" ? "reviewAction" : "review"
  }
  if (e.findings && e.status === "approved") return "reviewed"
  if (e.type === "action" && e.status === "approved") return e.task ? "approved" : "approvedOld"
  return { state: stateOf(e.status) }
}

/** What an action acts on, by name: its target, or the chat it would write in. */
export const actionTargetOf = (e: { targetName?: string | null; chatName?: string | null }) =>
  e.targetName ?? e.chatName ?? null

/** "Reply to Kai Moreno: Here is the pricing table…"; each language's verb is written to take the name after it. */
export const actionSentence = (verb: string, target: string | null, text: string | null) =>
  `${verb}${target ? ` ${target}` : ""}${text ? `: ${text}` : ""}`

/** What a findings batch is about: a project, or the person or other subject it names. */
export const batchSubjectOf = (e: Subjected, fallback: string) =>
  e.projectName ?? e.subjectName ?? e.project ?? fallback

/** A source may have stored a missing name as "null #907"; only a person's name is cleaned, never a document's title. */
export function withCleanNames<
  T extends { subject: string | null; subjectName: string | null; target: string | null; targetName: string | null },
>(e: T): T {
  const clean = (ref: string | null, name: string | null) => (ref?.startsWith("person:") ? personName({ name }) : name)
  return { ...e, subjectName: clean(e.subject, e.subjectName), targetName: clean(e.target, e.targetName) }
}
