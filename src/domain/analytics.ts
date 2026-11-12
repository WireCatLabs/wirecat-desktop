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

function bucketOf(day: string, grain: Grain): string {
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
  grain: Grain = grainOf(period),
): Bucket[] {
  const days = Object.values(bySource).flatMap((rows) => rows.map((r) => r.key))
  const first = days.length ? ([...days].sort()[0] ?? null) : null
  const keys = bucketsFor(period, today, first, grain)
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
    return { key, query: `${CLOSED} closed:[${from} TO ${to}]` }
  })
}

/**
 * memo adds `state:(open OR todo OR in_progress)` to a query that names no `state:` (cli-base `defaults`), which would
 * leave every closed task out of a `closed:` count, so each count names the closed states itself.
 */
const CLOSED = "state:(done OR dismissed)"

/** The period as memo's `closed:` reads it; all time names every closed task. */
export const closedTerm = (period: Period) => (period === "all" ? CLOSED : `${CLOSED} closed:>=${PERIOD_DAYS[period]}d`)

/** Every state, since memo's `tasks counts` reads only open tasks unless told otherwise. */
export const EVERY_STATE = "state:(open OR todo OR in_progress OR done OR dismissed)"

/** The period as memo's `created:` reads it, over tasks in any state. */
export const createdTerm = (period: Period) =>
  period === "all" ? EVERY_STATE : `${EVERY_STATE} created:>=${PERIOD_DAYS[period]}d`

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
export function entryBuckets(
  entries: readonly Entry[],
  period: Period,
  today: string,
  grain: Grain = grainOf(period),
): Bucket[] {
  const rows: Record<string, { key: string; count: number }[]> = { memory: [], fact: [] }
  for (const e of entries) {
    if (e.type !== "memory" && e.type !== "fact") continue
    if (!inPeriod(e.createdAt, period, today)) continue
    rows[e.type]?.push({ key: e.createdAt.slice(0, 10), count: 1 })
  }
  return bucketDays(rows, period, today, grain)
}

export type ProjectRow = {
  key: string
  name: string | null
  open: number
  overdue: number
  closed: number
  memories: number
  /** From the project's linked chats; null while memo cannot count them. */
  chats: number | null
  messages: number | null
  lastAt: string | null
  top: { title: string | null; messages: number }[]
  /** Some sub-projects were too deep or too many for memo to read. */
  partial: boolean
}

type Activity = {
  ref: string
  key: string | null
  name: string | null
  chats: number
  messages: number
  last_at: string | null
  top: readonly { title: string | null; messages: number }[]
  partial?: boolean
}

type Facet = { value: string; name: string | null; count: number }

/**
 * One row per project anything was counted for: open and overdue tasks now, tasks closed in the period, the memories
 * and facts written about it in the period, and its linked chats. Busiest first.
 */
export function projectRows(
  open: readonly Facet[],
  overdue: readonly Facet[],
  closed: readonly Facet[],
  entries: readonly Entry[],
  period: Period,
  today: string,
  activity: readonly Activity[] | null = null,
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
      chats: activity ? 0 : null,
      messages: activity ? 0 : null,
      lastAt: null,
      top: [],
      partial: false,
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
  for (const a of activity ?? []) {
    if (a.chats === 0) continue
    const r = row(a.key ?? a.ref, a.name)
    Object.assign(r, {
      chats: a.chats,
      messages: a.messages,
      lastAt: a.last_at,
      top: a.top.filter((t) => t.messages),
      partial: a.partial ?? false,
    })
  }
  const weight = (r: ProjectRow) => r.open + r.closed + r.memories + (r.messages ?? 0)
  return [...rows.values()]
    .filter((r) => weight(r) > 0 || (r.chats ?? 0) > 0)
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

/**
 * Sources that are not the owner's data: `chat` is cli-core's own test program (account 500), which a developer's
 * store may hold. Storage names it "Test data"; Analytics leaves it out of every number.
 */
const TEST_PROVIDERS: readonly string[] = ["chat"]

type Group = { provider: string; chats: number; messages: number; emails: number; documents: number; meetings: number }

/** Store totals and groups without the test sources: their rows come off the totals the store reports. */
export function ownersData<G extends Group>(
  rows: Readonly<Record<string, number>>,
  providers: readonly G[],
  years: readonly G[],
): { rows: Record<string, number>; providers: G[]; years: G[] } {
  const test = providers.filter((p) => TEST_PROVIDERS.includes(p.provider))
  const out = { ...rows }
  for (const k of ["chats", "messages", "emails", "documents", "meetings"] as const)
    if (k in out) out[k] = Math.max(0, (out[k] ?? 0) - test.reduce((s, p) => s + p[k], 0))
  const mine = (g: G) => !TEST_PROVIDERS.includes(g.provider)
  return { rows: out, providers: providers.filter(mine), years: years.filter(mine) }
}

/** Weekday rows (Monday first) by 24 hours, from hour keys `2026-11-02T14` in the owner's zone. */
export function weekHours(rows: readonly { key: string; count: number }[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const r of rows) {
    const hour = Number(r.key.slice(11, 13))
    if (!Number.isInteger(hour) || hour > 23) continue
    const day = (new Date(`${r.key.slice(0, 10)}T12:00:00Z`).getUTCDay() + 6) % 7
    const row = grid[day]
    if (row) row[hour] = (row[hour] ?? 0) + r.count
  }
  return grid
}

export type Change = { id: string; source: string; name: string | null; before: number; now: number }

/**
 * Who wrote much less, and which chats grew most, against the same length of time just before. A row needs `least`
 * messages in the busier of the two windows, so one message more or less is not news.
 */
export function changes(
  now: Readonly<Record<string, readonly { key: string; name: string | null; count: number }[]>>,
  before: Readonly<Record<string, readonly { key: string; name: string | null; count: number }[]>>,
  least = 10,
): { quieter: Change[]; busier: Change[] } {
  const all = new Map<string, Change>()
  const add = (rows: typeof now, side: "now" | "before") => {
    for (const [source, list] of Object.entries(rows))
      for (const r of list) {
        if (r.key === "me") continue
        const id = `${source}:${r.key}`
        const c = all.get(id) ?? { id, source, name: r.name, before: 0, now: 0 }
        c.name ??= r.name
        c[side] += r.count
        all.set(id, c)
      }
  }
  add(now, "now")
  add(before, "before")
  const rows = [...all.values()].filter((c) => Math.max(c.before, c.now) >= least)
  return {
    quieter: rows
      .filter((c) => c.now <= c.before / 2)
      .sort((a, b) => b.before - b.now - (a.before - a.now))
      .slice(0, 6),
    busier: rows
      .filter((c) => c.now >= c.before * 1.5)
      .sort((a, b) => b.now - b.before - (a.now - a.before))
      .slice(0, 6),
  }
}

export const MEDIA = ["images", "audio", "video", "files"] as const
export type Media = (typeof MEDIA)[number] | "other"

const MEDIA_OF: Record<string, Media> = {
  photo: "images",
  image: "images",
  sticker: "images",
  voice: "audio",
  audio: "audio",
  video: "video",
  video_note: "video",
  animation: "video",
  gif: "video",
  document: "files",
  file: "files",
}

/** Attachments by what a person would call them, from the store's own kinds; a kind not listed counts as other. */
export function mediaTotals(
  kinds: readonly { kind: string; count: number; bytes: number }[],
): Record<Media, { count: number; bytes: number }> {
  const out = Object.fromEntries([...MEDIA, "other"].map((m) => [m, { count: 0, bytes: 0 }])) as Record<
    Media,
    { count: number; bytes: number }
  >
  for (const k of kinds) {
    const m = MEDIA_OF[k.kind.toLowerCase()] ?? "other"
    out[m].count += k.count
    out[m].bytes += k.bytes
  }
  return out
}

/** Rows of the store's own tables that hold transcripts and links; null when the store has none of them. */
export function tableRows(tables: readonly { name: string; rows: number | null }[], names: readonly string[]) {
  const found = tables.filter((t) => names.includes(t.name) && t.rows !== null)
  return found.length ? found.reduce((s, t) => s + (t.rows ?? 0), 0) : null
}

/** Working hours for the after-hours share: Monday to Friday, 9:00 to 18:00 in the owner's zone. */
const WORK_HOURS = { from: 9, to: 18 } as const

/** Shares of messages written after working hours on weekdays, and at weekends, from a weekday-by-hour grid. */
export function offHours(grid: readonly (readonly number[])[]): { total: number; evenings: number; weekends: number } {
  let total = 0
  let evenings = 0
  let weekends = 0
  for (const [day, row] of grid.entries())
    for (const [hour, n] of row.entries()) {
      total += n
      if (day >= 5) weekends += n
      else if (hour < WORK_HOURS.from || hour >= WORK_HOURS.to) evenings += n
    }
  return { total, evenings, weekends }
}

/** Today's count and this week's (from Monday), from day rows keyed in the owner's zone. */
export function todayAndWeek(rows: readonly { key: string; count: number }[], today: string) {
  const monday = weekOf(today)
  let day = 0
  let week = 0
  for (const r of rows) {
    if (r.key === today) day += r.count
    if (r.key >= monday && r.key <= today) week += r.count
  }
  return { today: day, week }
}

/** Days far above the rest: more than the mean plus two standard deviations, busiest first. */
export function spikes(buckets: readonly Bucket[]): Bucket[] {
  if (buckets.length < 7) return []
  const mean = buckets.reduce((s, b) => s + b.total, 0) / buckets.length
  const sd = Math.sqrt(buckets.reduce((s, b) => s + (b.total - mean) ** 2, 0) / buckets.length)
  return buckets.filter((b) => sd > 0 && b.total > mean + 2 * sd).sort((a, b) => b.total - a.total)
}

type Meeting = { started_at: string | null; duration_ms: number | null; title: string | null }

/**
 * Meetings in the period from a tool's own list: how many, their minutes, per week, and the titles that take the most
 * time. A title stands for a series: the list names no series yet (plan, A2).
 */
/** A meeting two signed-in Zoom accounts both have is stored once per account, each with its own id. */
function uniqueMeetings<T extends Meeting>(items: readonly T[]): T[] {
  const seen = new Map<string, T>()
  for (const m of items) {
    const key = `${m.started_at}|${m.title?.trim() ?? ""}`
    const had = seen.get(key)
    if (!had || (had.duration_ms ?? 0) < (m.duration_ms ?? 0)) seen.set(key, m)
  }
  return [...seen.values()]
}

export function meetingStats(items: readonly Meeting[], period: Period, today: string, zone: string) {
  const days = PERIOD_DAYS[period]
  const from = days === null ? "" : addDays(today, -(days - 1))
  const dayOfStart = (at: string) => todayIn(zone, new Date(at))
  const inside = uniqueMeetings(items).filter((m) => m.started_at && dayOfStart(m.started_at) >= from)
  const minutes = (m: Meeting) => Math.round((m.duration_ms ?? 0) / 60_000)
  const timed = inside.filter((m) => m.duration_ms !== null && m.duration_ms > 0)
  const rows = inside.map((m) => ({ key: dayOfStart(m.started_at ?? ""), count: 1 }))
  const minuteRows = timed.map((m) => ({ key: dayOfStart(m.started_at ?? ""), count: minutes(m) }))
  const untimedRows = inside
    .filter((m) => !timed.includes(m))
    .map((m) => ({ key: dayOfStart(m.started_at ?? ""), count: 1 }))
  const series = new Map<string, { title: string; count: number; minutes: number }>()
  for (const m of inside) {
    const title = m.title?.trim() || ""
    if (!title) continue
    const s = series.get(title) ?? { title, count: 0, minutes: 0 }
    s.count += 1
    s.minutes += minutes(m)
    series.set(title, s)
  }
  const total = timed.reduce((s, m) => s + minutes(m), 0)
  return {
    count: inside.length,
    minutes: total,
    meanMinutes: timed.length ? Math.round(total / timed.length) : null,
    rows,
    minuteRows,
    untimedRows,
    series: [...series.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count).slice(0, 6),
  }
}

/** Entries of one type per bar by when they were written, split by what became of each (its status now). */
export function statusBuckets(
  entries: readonly Entry[],
  type: "memory" | "fact",
  period: Period,
  today: string,
  grain: Grain,
): Bucket[] {
  const rows: Record<string, { key: string; count: number }[]> = {}
  for (const e of entries) {
    if (e.type !== type || !inPeriod(e.createdAt, period, today)) continue
    const list = rows[e.status] ?? []
    list.push({ key: e.createdAt.slice(0, 10), count: 1 })
    rows[e.status] = list
  }
  return bucketDays(rows, period, today, grain)
}

/**
 * Meeting minutes per weekday (Monday first, keys "0" to "6"), split by the titles that take the most time; the rest
 * is `other`.
 */
export function meetingWeekdays(
  items: readonly { started_at: string | null; duration_ms: number | null; title: string | null }[],
  period: Period,
  today: string,
  zone: string,
  top = 4,
): { buckets: Bucket[]; series: string[] } {
  const days = PERIOD_DAYS[period]
  const from = days === null ? "" : addDays(today, -(days - 1))
  const inside = uniqueMeetings(items).filter(
    (m) => m.started_at && (m.duration_ms ?? 0) > 0 && todayIn(zone, new Date(m.started_at)) >= from,
  )
  const byTitle = new Map<string, number>()
  for (const m of inside) {
    const t = m.title?.trim() || "other"
    byTitle.set(t, (byTitle.get(t) ?? 0) + (m.duration_ms ?? 0))
  }
  const series = [...byTitle]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter((t) => t !== "other")
    .slice(0, top)
  const buckets: Bucket[] = Array.from({ length: 7 }, (_, d) => ({ key: String(d), values: {}, total: 0 }))
  for (const m of inside) {
    const day = (new Date(`${todayIn(zone, new Date(m.started_at ?? ""))}T12:00:00Z`).getUTCDay() + 6) % 7
    const title = m.title?.trim() ?? ""
    const id = series.includes(title) ? title : "other"
    const minutes = Math.round((m.duration_ms ?? 0) / 60_000)
    const b = buckets[day]
    if (!b) continue
    b.values[id] = (b.values[id] ?? 0) + minutes
    b.total += minutes
  }
  return { buckets, series: buckets.some((b) => (b.values.other ?? 0) > 0) ? [...series, "other"] : series }
}
