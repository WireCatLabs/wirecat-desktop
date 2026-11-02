// The Analytics page's numbers, shaped from what the tools answered. Plain data in, chart rows out; nothing here
// counts anything a tool did not count itself, it only adds up and buckets the tools' own answers.

import { agentName, agentOf, type Run } from "./runs"

export type Period = "7d" | "30d" | "90d" | "all"
export type Grain = "day" | "week" | "month"

export const PERIOD_DAYS: Record<Period, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null }

/** Days in a bar: one per day up to a month, weeks for a quarter, months for all time. */
export const grainOf = (period: Period): Grain => (period === "90d" ? "week" : period === "all" ? "month" : "day")

const DAY_MS = 86_400_000

/** Today in the owner's zone as `YYYY-MM-DD`, the form the tools key their days by. */
export function todayIn(zone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  )
}

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
const dayOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => dayOf(dayNumber(day) + n)

/** The Monday a day's week starts on. */
export function weekOf(day: string): string {
  const n = dayNumber(day)
  const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7
  return dayOf(n - weekday)
}

const monthOf = (day: string) => `${day.slice(0, 7)}-01`

export function bucketOf(day: string, grain: Grain): string {
  return grain === "day" ? day : grain === "week" ? weekOf(day) : monthOf(day)
}

/** Every bucket the period covers, oldest first, ending with the one today is in. `first` starts "all". */
export function bucketsFor(
  period: Period,
  today: string,
  first: string | null = null,
  grain: Grain = grainOf(period),
): string[] {
  const days = PERIOD_DAYS[period]
  const start = days === null ? (first ?? today) : addDays(today, -(days - 1))
  const keys: string[] = []
  let key = bucketOf(start, grain)
  const last = bucketOf(today, grain)
  while (key <= last && keys.length < 1000) {
    keys.push(key)
    key = grain === "day" ? addDays(key, 1) : grain === "week" ? addDays(key, 7) : `${nextMonth(key.slice(0, 7))}-01`
  }
  return keys
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

export type Bucket = { key: string; values: Record<string, number>; total: number }

/**
 * Day counts from several sources (each source's profiles already summed) in the period's bars. Days before the
 * period's first bar are left out: `date>=7d` reaches into an eighth calendar day.
 */
export function bucketDays(
  bySource: Readonly<Record<string, readonly { key: string; count: number }[]>>,
  period: Period,
  today: string,
): Bucket[] {
  const grain = grainOf(period)
  const days = Object.values(bySource).flatMap((rows) => rows.map((r) => r.key))
  const first = days.length ? ([...days].sort()[0] ?? null) : null
  const keys = bucketsFor(period, today, first)
  const at = new Map(keys.map((k) => [k, { key: k, values: {} as Record<string, number>, total: 0 }]))
  for (const [source, rows] of Object.entries(bySource)) {
    for (const r of rows) {
      const b = at.get(bucketOf(r.key, grain))
      if (!b) continue
      b.values[source] = (b.values[source] ?? 0) + r.count
      b.total += r.count
    }
  }
  return keys.map((k) => at.get(k) as Bucket)
}

/** Adds one source's profiles up, by key; `name` is the first one a profile gave. */
export function sumRows(
  lists: readonly (readonly { key: string; name: string | null; count: number }[])[],
): { key: string; name: string | null; count: number }[] {
  const by = new Map<string, { key: string; name: string | null; count: number }>()
  for (const rows of lists)
    for (const r of rows) {
      const had = by.get(r.key)
      by.set(r.key, { key: r.key, name: had?.name ?? r.name, count: (had?.count ?? 0) + r.count })
    }
  return [...by.values()]
}

export type Ranked = { id: string; source: string; name: string | null; count: number }

/**
 * The busiest senders or chats across sources, the owner left out (`me` is how the tools key the owner's own
 * messages). A person in two messengers stays two rows: the tools give no way to tell it is one person.
 */
export function topRows(
  bySource: Readonly<Record<string, readonly { key: string; name: string | null; count: number }[]>>,
  limit = 10,
): Ranked[] {
  return Object.entries(bySource)
    .flatMap(([source, rows]) =>
      rows
        .filter((r) => r.key !== "me")
        .map((r) => ({ id: `${source}:${r.key}`, source, name: r.name, count: r.count })),
    )
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit)
}

/** The owner's own messages in sender counts, which the tools key as `me`. */
export const sentByMe = (rows: readonly { key: string; count: number }[]) =>
  rows.filter((r) => r.key === "me").reduce((s, r) => s + r.count, 0)

/** Initials for a name when the owner hides names on screen: "Ana Ruiz" → "A. R." */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 3)
  return parts.map((p) => `${[...p][0]?.toLocaleUpperCase() ?? ""}.`).join(" ")
}

/** Bars of closed tasks: each is one `tasks counts` run, so a month is counted by week, not by day. */
export const taskGrain = (period: Period): Grain => (period === "7d" ? "day" : "week")

/** `closed:[a TO b]` per bar, for memo's own `tasks counts`; the last bar ends today. */
export function closedRanges(period: Period, today: string): { key: string; query: string }[] {
  if (period === "all") return []
  const grain = taskGrain(period)
  const start = addDays(today, -((PERIOD_DAYS[period] ?? 0) - 1))
  return bucketsFor(period, today, null, grain).map((key) => {
    const from = [key, start].sort()[1] ?? key
    const end = grain === "day" ? key : addDays(key, 6)
    const to = end > today ? today : end
    return { key, query: `closed:[${from} TO ${to}]` }
  })
}

/** The period as memo's `closed:` reads it; all time names every closed task. */
export const closedTerm = (period: Period) =>
  period === "all" ? "state:(done OR dismissed)" : `closed:>=${PERIOD_DAYS[period]}d`

type Entry = { type: string; status: string; createdAt: string; project: string | null; projectName: string | null }

/** Status counts of memories and of facts, in a fixed order so the colours never move. */
export const MEMORY_STATUSES = ["confirmed", "proposed", "stale", "superseded"] as const
export const FACT_STATUSES = ["accepted", "proposed", "rejected", "reversed", "superseded"] as const

export function statusCounts(entries: readonly Entry[], type: "memory" | "fact"): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) if (e.type === type) out[e.status] = (out[e.status] ?? 0) + 1
  return out
}

const inPeriod = (at: string, period: Period, today: string) => {
  const days = PERIOD_DAYS[period]
  return days === null || at.slice(0, 10) >= addDays(today, -(days - 1))
}

/** New memories and facts per bar, by when they were written. Dates are UTC, as memo writes them. */
export function entryBuckets(entries: readonly Entry[], period: Period, today: string): Bucket[] {
  const rows: Record<string, { key: string; count: number }[]> = { memory: [], fact: [] }
  for (const e of entries) {
    if (e.type !== "memory" && e.type !== "fact") continue
    if (!inPeriod(e.createdAt, period, today)) continue
    rows[e.type]?.push({ key: e.createdAt.slice(0, 10), count: 1 })
  }
  return bucketDays(rows, period, today)
}

export type ProjectRow = {
  key: string
  name: string | null
  open: number
  overdue: number
  closed: number
  memories: number
  messages: number | null
}

type Facet = { value: string; name: string | null; count: number }

/**
 * One row per project anything was counted for: open and overdue tasks now, tasks closed in the period, and the
 * memories and facts written about it in the period. Busiest first.
 */
export function projectRows(
  open: readonly Facet[],
  overdue: readonly Facet[],
  closed: readonly Facet[],
  entries: readonly Entry[],
  period: Period,
  today: string,
  messages: Readonly<Record<string, number>> | null = null,
  /** memo names a record's project by its ref (`project:3`) or its key; tasks always by key. */
  keyOf: (project: string) => string = (p) => p,
): ProjectRow[] {
  const rows = new Map<string, ProjectRow>()
  const row = (key: string, name: string | null) => {
    const had = rows.get(key)
    if (had) {
      had.name ??= name
      return had
    }
    const made = {
      key,
      name,
      open: 0,
      overdue: 0,
      closed: 0,
      memories: 0,
      messages: messages ? (messages[key] ?? 0) : null,
    }
    rows.set(key, made)
    return made
  }
  for (const f of open) if (f.count > 0) row(f.value, f.name).open = f.count
  for (const f of overdue) if (f.count > 0) row(f.value, f.name).overdue = f.count
  for (const f of closed) if (f.count > 0) row(f.value, f.name).closed = f.count
  for (const e of entries) {
    if (!e.project || (e.type !== "memory" && e.type !== "fact") || !inPeriod(e.createdAt, period, today)) continue
    row(keyOf(e.project), e.projectName).memories += 1
  }
  const weight = (r: ProjectRow) => r.open + r.closed + r.memories + (r.messages ?? 0)
  return [...rows.values()]
    .filter((r) => weight(r) > 0)
    .sort((a, b) => weight(b) - weight(a) || a.key.localeCompare(b.key))
}

export type Helped = {
  /** Runs an agent made, any way it reached the tool. */
  agentRuns: number
  /** Of them, calls through an MCP server (an AI app or an agent's MCP connection). */
  mcpCalls: number
  /** Runs a person typed in a terminal. */
  yourRuns: number
  /** Per agent or app, busiest first. */
  byAgent: { name: string; count: number }[]
  /** Per tool, busiest first. */
  byTool: { tool: string; count: number }[]
  /** The oldest run read; older runs exist when a tool had more than were read. */
  since: string | null
}

const isMcp = (run: Run) => {
  const via = typeof run.via === "string" ? run.via : ""
  return via.startsWith("mcp") || (run.mcp !== undefined && run.mcp !== null)
}

const mcpApp = (run: Run): string | undefined => {
  const client = (run.agent as { client?: { name?: unknown } } | undefined)?.client
  return typeof client?.name === "string" ? client.name : undefined
}

/** What agents did with the tools in the period, from the runs the tools recorded; the app's own runs are left out. */
export function helped(runs: readonly Run[], period: Period, today: string): Helped {
  const agents = new Map<string, number>()
  const tools = new Map<string, number>()
  let agentRuns = 0
  let mcpCalls = 0
  let yourRuns = 0
  let since: string | null = null
  for (const run of runs) {
    if (run.via === "desktop") continue
    if (since === null || run.started_at < since) since = run.started_at
    if (!inPeriod(run.started_at, period, today)) continue
    const agent = agentOf(run)
    if (!agent) {
      if (Array.isArray(run.argv)) yourRuns += 1
      continue
    }
    agentRuns += 1
    if (isMcp(run)) mcpCalls += 1
    const name = agentName(agent.kind, mcpApp(run))
    agents.set(name, (agents.get(name) ?? 0) + 1)
    tools.set(run.tool, (tools.get(run.tool) ?? 0) + 1)
  }
  const sorted = <K extends string>(m: Map<string, number>, k: K) =>
    [...m]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([v, count]) => ({ [k]: v, count }) as Record<K, string> & { count: number })
  return { agentRuns, mcpCalls, yourRuns, byAgent: sorted(agents, "name"), byTool: sorted(tools, "tool"), since }
}
