// The Tasks page's plain logic: the search words the filters write, priority labels, due dates and board order.
// memo answers the query; nothing here filters tasks itself.

import { dropFields, valuesOf as termValues, tidy, setField as writeField } from "./query-terms"

export const STATES = ["open", "todo", "in_progress", "done", "dismissed"] as const
export type State = (typeof STATES)[number]
export const LABELS = ["critical", "high", "medium", "low"] as const
export type Label = (typeof LABELS)[number]

export const closed = (s: State) => s === "done" || s === "dismissed"

/** memo's quarters: below 0.25 is low, from 0.75 critical. */
export function labelOf(priority: number | null): Label | null {
  if (priority === null) return null
  if (priority >= 0.75) return "critical"
  if (priority >= 0.5) return "high"
  if (priority >= 0.25) return "medium"
  return "low"
}

// ---- The search words ----

/** Open work and what was closed in the last 14 days; memo's own default hides closed tasks altogether. */
export const BOARD_DEFAULT = "(state:(open OR todo OR in_progress) OR closed:>=14d)"

/** Fields the filters own. `due` also owns `when:` and `NOT due:*`, which the Due filter writes, and `overdue:`. */
export type Field = "project" | "assignee" | "priority" | "state" | "agent" | "due" | "ready"

const owned: Record<Field, string> = {
  project: "project",
  assignee: "assignee",
  priority: "priority",
  state: "state",
  agent: "agent",
  due: "due|when|overdue",
  ready: "ready",
}

/** The query without any term of the field. */
export const dropField = (q: string, field: Field) => dropFields(q, owned[field])

/** The values the query asks for in a field, as written: `project:(HRB OR OPS)` gives HRB and OPS. */
export const valuesOf = (q: string, field: Exclude<Field, "due">) => termValues(q, field)

/** Writes one field's choices into the query, in place of what it said before. */
export const setField = (q: string, field: Exclude<Field, "due">, values: readonly string[]) =>
  writeField(q, field, values)

export type DueChoice = "overdue" | "today" | "tomorrow" | "week" | "none" | { from: string; to?: string }

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const addDays = (from: Date, n: number) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + n)
  return d
}

const DAY = String.raw`\d{4}-\d{2}-\d{2}`

/** memo's words for each choice. It reads `7d` as seven days ago, so the week's last day is written out. */
export function dueTerm(choice: DueChoice, today = new Date()): string {
  if (typeof choice === "object") {
    const [a, b] = choice.to && choice.to < choice.from ? [choice.to, choice.from] : [choice.from, choice.to]
    return b && b !== a ? `due:[${a} TO ${b}]` : `due:${a}`
  }
  if (choice === "overdue") return "when:overdue"
  if (choice === "today") return "due:today"
  if (choice === "tomorrow") return "due:tomorrow"
  if (choice === "none") return "when:none"
  return `due:[today TO ${isoDay(addDays(today, 7))}]`
}

export function dueOf(q: string, today = new Date()): DueChoice | null {
  if (/(^|\s)(when:overdue|overdue:true)\b/.test(q)) return "overdue"
  if (/(^|\s)((NOT\s+|-)due:\*|when:none\b)/.test(q)) return "none"
  if (/(^|\s)due:\[today TO /.test(q)) return "week"
  if (/(^|\s)(due|when):today(\s|$)/.test(q)) return "today"
  if (/(^|\s)due:tomorrow(\s|$)/.test(q)) return "tomorrow"
  const range = new RegExp(String.raw`(?:^|\s)due:\[(${DAY}) TO (${DAY})\]`).exec(q)
  if (range?.[1] && range[2]) return { from: range[1], to: range[2] }
  const day = new RegExp(String.raw`(?:^|\s)due:(${DAY})(?:\s|$)`).exec(q)?.[1]
  if (day) return day === isoDay(addDays(today, 1)) ? "tomorrow" : { from: day }
  return null
}

/** The search a `tasks/<filter>` link opens: the Due filter's own words, or the tasks opened since a moment. */
/** The Tasks page searched on one project, for a `project/<key>` link. */
export const projectQuery = (key: string) => writeField("", "project", [key])

/** The project a link names: by its key (`HRB`, any case) or by its store reference (`project:1`). */
export function projectNamed<P extends { key: string; ref: string | null }>(projects: readonly P[], name: string) {
  const wanted = name.toLowerCase()
  return projects.find((p) => p.key.toLowerCase() === wanted || p.ref === `project:${name}`) ?? null
}

export function taskQuery(
  link: { filter: "overdue" | "today" | "tomorrow" | "undated" } | { filter: "new"; since: string },
) {
  if (link.filter === "new") return `created:>="${link.since}"`
  return dueTerm(link.filter === "undated" ? "none" : link.filter)
}

export const setDue = (q: string, choice: DueChoice | null, today = new Date()) =>
  choice ? tidy(`${dropField(q, "due")} ${dueTerm(choice, today)}`) : dropField(q, "due")

/** What goes to memo: the owner's words, plus the board's default unless they chose states or closing dates. */
/** A task memo found in a chat, mail or note: no project holds it, and memo changes none of its board fields. */
export const fromMessages = (t: { account?: string | null | undefined }) => Boolean(t.account)

/**
 * The kind of a found task whose title is only `<kind> — <locator>`, memo's stand-in while the task keeps no message
 * text; null for a real title. cli-core later reads the message's first line instead, and then this never matches.
 */
export function bareTitleKind(t: { title: string; account?: string | null | undefined }): string | null {
  if (!fromMessages(t)) return null
  const bare = /^(\w+) — (msg|note|document|mail|email):\S+$/.exec(t.title.trim())
  return bare ? (bare[1] ?? null) : null
}

export function boardQuery(q: string): string {
  const words = q.trim()
  if (/(^|[\s(-])(state|closed):/.test(words)) return words
  return words ? `(${words}) ${BOARD_DEFAULT}` : BOARD_DEFAULT
}

// ---- Dates ----

/** A due date is a day: memo keeps local midnight of it, so the day is read back in local time. */
export const localDay = (iso: string) => isoDay(new Date(iso))

/** Days from today to the due day: negative when it is past. */
export function daysUntil(iso: string, today = new Date()): number {
  const due = new Date(iso)
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
  return Math.round((b - a) / 86_400_000)
}

export type DueTone = "late" | "soon" | "later"

export function dueTone(iso: string, state: State, today = new Date()): DueTone {
  if (closed(state)) return "later"
  const d = daysUntil(iso, today)
  return d < 0 ? "late" : d <= 3 ? "soon" : "later"
}

export { isoDay }

// ---- Board order ----

/**
 * Where a card lands among the cards shown in its new column, as memo's `move` wants it: above the card that now
 * follows it, or below the last one. A column with no other card needs no anchor.
 */
export function anchorOf(column: readonly string[], key: string, index: number): { before?: string; after?: string } {
  const others = column.filter((k) => k !== key)
  const next = others[index]
  if (next) return { before: next }
  const last = others.at(-1)
  return last ? { after: last } : {}
}

/** The page's order with one key moved to sit before `before`, or last when there is none. */
export function placeKey(order: readonly string[], key: string, before: string | null): string[] {
  const rest = order.filter((k) => k !== key)
  const at = before ? rest.indexOf(before) : -1
  return at < 0 ? [...rest, key] : [...rest.slice(0, at), key, ...rest.slice(at)]
}

/** A claim counts while it has not lapsed. */
export const claimActive = (until: string | null, now = Date.now()) => until !== null && Date.parse(until) > now

/**
 * The tasks of these people as the table counts them: every project and every state, since memo's search otherwise
 * leaves closed tasks out, and refuses `assignee:` without `project:`.
 */
export const tasksQuery = (refs: readonly string[]) =>
  `project:* ${setField("", "assignee", refs)} state:(${STATES.join(" OR ")})`

/**
 * The tasks of a deal, a lead or a company (`deal:7`, `lead:3`, `organization:4`) in every state: its project's, those
 * its CRM stages opened, and for a company those of its projects, deals and leads. No `project:`: from memo 0.131.83 a
 * list with it holds project tasks only.
 */
export const relatedTasksQuery = (ref: string) => `related:"${ref}" state:(${STATES.join(" OR ")})`
