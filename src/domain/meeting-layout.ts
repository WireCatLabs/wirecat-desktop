import { dayOf, parse, shift } from "./days"

// Where meetings sit in a week's time grid and a month's cells. Pure: minutes and fractions in, minutes and fractions
// out; the grids multiply them by their own sizes. Times are the computer's zone, from `Date`, never a library.

const DAY_MINUTES = 1_440

/** One meeting as the grids see it: its real instants, and whether the calendar files it under days. */
export type MeetingTime = { key: string; start: Date; end: Date; allDay: boolean }

/** A meeting's part inside one local day, in minutes from that day's midnight. */
export type DaySegment = {
  key: string
  startMin: number
  endMin: number
  /** It started on an earlier day, or goes on into the next. */
  fromBefore: boolean
  goesOn: boolean
}

export type Placed =
  | { type: "event"; key: string; startMin: number; endMin: number; left: number; width: number }
  | { type: "more"; startMin: number; endMin: number; keys: string[]; left: number; width: number }

/** An all-day or multi-day meeting across one week row, by day index 0–6, clipped to the row. */
export type RowSpan = { key: string; from: number; to: number; fromBefore: boolean; goesOn: boolean }
export type Lane = RowSpan & { lane: number }

/** The days a window shows and the instants memo reads it by: local midnight to local midnight. */
export type DayWindow = { days: string[]; from: Date; to: Date }

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60

/** The week holding `day`, starting on the language's first weekday. Seven calendar days, so a DST week ends at midnight. */
export function weekWindow(day: string, firstDay: number): DayWindow {
  const back = (parse(day).getDay() - firstDay + 7) % 7
  const first = shift(day, -back)
  const days = Array.from({ length: 7 }, (_, i) => shift(first, i))
  return { days, from: parse(first), to: parse(shift(first, 7)) }
}

/** Six whole weeks from the week holding the month's 1st, so a month never changes the grid's height. */
export function monthWindow(day: string, firstDay: number): DayWindow {
  const first = `${day.slice(0, 7)}-01`
  const start = weekWindow(first, firstDay).days[0] as string
  const days = Array.from({ length: 42 }, (_, i) => shift(start, i))
  return { days, from: parse(start), to: parse(shift(start, 42)) }
}

/** An instant with the computer's offset, as memo takes a window's ends (`2026-11-09T00:00:00+01:00`). */
export function localInstant(d: Date): string {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? "+" : "-"
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0")
  return `${dayOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`
}

/** Whether the calendar files it under days: memo says all-day, or it covers a whole local day from midnight to midnight. */
export function isDayLong(m: MeetingTime): boolean {
  if (m.allDay) return true
  const day = dayOf(m.start)
  const first = m.start.getTime() === parse(day).getTime() ? day : shift(day, 1)
  return parse(shift(first, 1)).getTime() <= m.end.getTime()
}

/** The days, by index in `days`, a day-long meeting covers; an all-day end is exclusive, as calendars write it. */
export function daySpan(m: MeetingTime, days: readonly string[]): RowSpan | null {
  const first = dayOf(m.start)
  const lastInstant = new Date(Math.max(m.start.getTime(), m.end.getTime() - 1))
  const last = dayOf(lastInstant)
  const from = days.findIndex((d) => d >= first)
  const to = days.findLastIndex((d) => d <= last)
  if (from === -1 || to === -1 || from > to) return null
  return { key: m.key, from, to, fromBefore: first < (days[from] as string), goesOn: last > (days[to] as string) }
}

/**
 * A timed meeting cut at each local midnight it crosses. Minutes are wall-clock; when the clock falls back and the
 * wall-clock end comes before the start, the end is the start plus the real time, so a block is never upside down.
 */
export function splitByDay(m: MeetingTime, days: readonly string[]): Map<string, DaySegment> {
  const out = new Map<string, DaySegment>()
  for (const day of days) {
    const midnight = parse(day)
    const next = parse(shift(day, 1))
    const from = Math.max(m.start.getTime(), midnight.getTime())
    const to = Math.min(m.end.getTime(), next.getTime())
    // A meeting with no length still gets its start day, and only that one.
    if (from > to || from >= next.getTime() || (from === to && m.start.getTime() !== m.end.getTime())) continue
    const startMin = from === midnight.getTime() ? 0 : minutesOf(new Date(from))
    let endMin = to === next.getTime() ? DAY_MINUTES : minutesOf(new Date(to))
    if (endMin < startMin) endMin = Math.min(DAY_MINUTES, startMin + (to - from) / 60_000)
    out.set(day, {
      key: m.key,
      startMin,
      endMin,
      fromBefore: m.start.getTime() < midnight.getTime(),
      goesOn: m.end.getTime() > next.getTime(),
    })
  }
  return out
}

type Item = { key: string; startMin: number; endMin: number }
type Box = Item & { left: number; right: number }

const EPS = 1e-9

/** How wide, as fractions of a day's width, a block must be to read, and the strip a covered block keeps. */
export type Room = { block: number; indent: number }

/**
 * Overlapping meetings as Google Calendar draws them. Meetings that start within a title's height (`minMinutes`) of
 * the one before sit side by side; a meeting that starts later is drawn over the earlier ones, shifted right so each
 * keeps its title above and a strip (`room.indent`) at its left edge. A meeting with no span at least `room.block`
 * wide is counted in a "+N", drawn small where it leaves the others their strips. Overlap is judged on the drawn
 * height, so two short calls a minute apart never draw over each other. The result is in paint order: a later block
 * covers an earlier one.
 */
export function layoutDay(segments: readonly DaySegment[], room: Room, minMinutes: number): Placed[] {
  const items = segments
    .map((s) => {
      const startMin = Math.min(s.startMin, DAY_MINUTES - minMinutes)
      return { key: s.key, startMin, endMin: Math.min(DAY_MINUTES, Math.max(s.endMin, startMin + minMinutes)) }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  const placed: Placed[] = []
  let cluster: Item[] = []
  let clusterEnd = -1
  const close = () => {
    if (cluster.length) for (const p of placeCluster(cluster, room, minMinutes)) placed.push(p)
    cluster = []
  }
  for (const item of items) {
    if (item.startMin >= clusterEnd) close()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  close()
  return placed
}

const overlaps = (a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) =>
  a.startMin < b.endMin && b.startMin < a.endMin

function placeCluster(items: Item[], room: Room, title: number): Placed[] {
  const block = Math.min(1, room.block)
  const indent = Math.min(block, room.indent)
  const marker = Math.min(block, 2 * indent)
  const out: Placed[] = []
  // What a later block must leave its strip to: every block and "+N" drawn so far.
  const drawn: Box[] = []
  // A group with no span at all: into a "+N" already drawn at its start, else a narrow one of its own where it
  // leaves the others their strips, else at the right edge.
  const narrow = Math.min(marker, 0.2)
  const orphan = (group: Item[]) => {
    for (const m of markers(group)) {
      const near = out.find(
        (p): p is Extract<Placed, { type: "more" }> =>
          p.type === "more" && p.startMin <= m.startMin && m.startMin < p.endMin,
      )
      if (near) {
        for (const k of m.keys) near.keys.push(k)
        continue
      }
      const spot = freeSpot(
        drawn.filter((p) => overlaps(p, m)),
        indent,
        narrow,
      )
      const left = spot ? spot.right - narrow : 1 - narrow
      drawn.push({ key: "", startMin: m.startMin, endMin: m.endMin, left, right: left + narrow })
      out.push({ ...m, left, width: narrow })
    }
  }
  for (let i = 0; i < items.length; ) {
    const group = [items[i] as Item]
    while (i + group.length < items.length) {
      const next = items[i + group.length] as Item
      if (next.startMin >= (group.at(-1) as Item).startMin + title) break
      group.push(next)
    }
    i += group.length
    const spot = freeSpot(
      drawn.filter((p) => group.some((g) => overlaps(p, g))),
      indent,
      block,
    )
    if (!spot) {
      orphan(group)
      continue
    }
    const span = spot.right - spot.left
    const all = Math.floor(span / block + EPS) >= group.length
    // A group that does not fit keeps the right of its span for its own "+N", beside at least one it shows.
    const own = all ? 0 : Math.max(span * 0.2, Math.min(marker, span - block))
    const fit = all ? group.length : Math.max(1, Math.floor((span - own) / block + EPS))
    const width = (span - own) / fit
    group.slice(0, fit).forEach((g, n) => {
      const box = { ...g, left: spot.left + n * width, right: spot.left + (n + 1) * width }
      drawn.push(box)
      out.push(event(box))
    })
    const rest = group.slice(fit)
    if (rest.length > 0) {
      const more = {
        type: "more" as const,
        startMin: rest.reduce((n, g) => Math.min(n, g.startMin), DAY_MINUTES),
        endMin: rest.reduce((n, g) => Math.max(n, g.endMin), 0),
        keys: rest.map((g) => g.key),
        left: spot.right - own,
        width: own,
      }
      drawn.push({ key: "", startMin: more.startMin, endMin: more.endMin, left: more.left, right: spot.right })
      out.push(more)
    }
  }
  return out
}

/**
 * The widest span at least `min` wide, leftmost on a tie, that leaves every block under it its left strip: a new block
 * either covers a block from past its strip, or stops at its left edge.
 */
function freeSpot(under: readonly Box[], indent: number, min: number): { left: number; right: number } | null {
  let best: { left: number; right: number } | null = null
  const lefts = [...new Set([0, ...under.map((p) => p.left + indent)])].sort((a, b) => a - b)
  for (const left of lefts) {
    const ahead = under.filter((p) => p.left + indent > left + EPS)
    if (ahead.some((p) => p.left < left - EPS)) continue
    const right = ahead.reduce((r, p) => Math.min(r, p.left), 1)
    if (right - left >= min - EPS && (!best || right - left > best.right - best.left + EPS)) best = { left, right }
  }
  return best
}

const event = (b: Box): Placed => ({
  type: "event",
  key: b.key,
  startMin: b.startMin,
  endMin: b.endMin,
  left: b.left,
  width: b.right - b.left,
})

/** One "+N" per run of hidden meetings whose times overlap, counting every one of them. */
function markers(hidden: Item[]): Omit<Extract<Placed, { type: "more" }>, "left" | "width">[] {
  const sorted = [...hidden].sort((a, b) => a.startMin - b.startMin)
  const runs: { type: "more"; startMin: number; endMin: number; keys: string[] }[] = []
  for (const s of sorted) {
    const last = runs.at(-1)
    if (last && s.startMin < last.endMin) {
      last.endMin = Math.max(last.endMin, s.endMin)
      last.keys.push(s.key)
    } else runs.push({ type: "more", startMin: s.startMin, endMin: s.endMin, keys: [s.key] })
  }
  return runs
}

/**
 * Day-long meetings of one week row in lanes: by first day, longer first, then key, each in the lowest lane free over
 * all its days. Lanes from `maxLanes` on are hidden; `hidden[i]` counts the hidden ones covering day `i`.
 */
export function layoutWeekRow(
  spans: readonly RowSpan[],
  maxLanes = Number.POSITIVE_INFINITY,
): { lanes: Lane[]; hidden: number[] } {
  const sorted = [...spans].sort(
    (a, b) => a.from - b.from || b.to - b.from - (a.to - a.from) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
  const taken: number[][] = []
  const lanes: Lane[] = []
  const hidden = Array.from({ length: 7 }, () => 0)
  for (const s of sorted) {
    let lane = taken.findIndex((ends) => ends.every((d) => d < s.from || d > s.to))
    if (lane === -1) lane = taken.push([]) - 1
    for (let d = s.from; d <= s.to; d++) taken[lane]?.push(d)
    if (lane < maxLanes) lanes.push({ ...s, lane })
    else for (let d = s.from; d <= s.to; d++) hidden[d] = (hidden[d] ?? 0) + 1
  }
  return { lanes, hidden }
}

/** Real time between two instants, never the drawn height: a DST day's 01:30–03:30 is one hour. */
export const realMinutes = (m: MeetingTime) => Math.max(0, Math.round((m.end.getTime() - m.start.getTime()) / 60_000))

/** What `timeOf` needs of a memo meeting row. */
export type TimedRow = {
  ref: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  allDay: boolean
}

/** A calendar writes an all-day day as `YYYY-MM-DD`: the computer's midnight, never UTC's, which moves it a day. */
/** memo's instant, or an all-day bare date read as local midnight (`new Date` would read it as UTC). */
export const instantOf = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? parse(s) : new Date(s))

/** A row's instants; a row with no start has no place on a calendar. A missing end is the start plus its duration. */
export function timeOf(row: TimedRow): MeetingTime | null {
  if (!row.startedAt) return null
  const start = instantOf(row.startedAt)
  if (Number.isNaN(start.getTime())) return null
  const ended = row.endedAt ? instantOf(row.endedAt) : null
  const end =
    ended && !Number.isNaN(ended.getTime()) && ended >= start
      ? ended
      : new Date(start.getTime() + (row.durationMs ?? 0) + (row.allDay && !ended ? 86_400_000 : 0))
  return { key: row.ref, start, end, allDay: row.allDay }
}

/** A window's meetings as the grids draw them: timed parts per day, and day-long ones as spans of each week row. */
export function placeWindow(times: readonly MeetingTime[], days: readonly string[]) {
  const segments = new Map<string, DaySegment[]>()
  const rows: RowSpan[][] = Array.from({ length: Math.ceil(days.length / 7) }, () => [])
  for (const t of times) {
    if (isDayLong(t)) {
      rows.forEach((row, w) => {
        const span = daySpan(t, days.slice(w * 7, w * 7 + 7))
        if (span) row.push(span)
      })
      continue
    }
    for (const [day, seg] of splitByDay(t, days)) segments.set(day, [...(segments.get(day) ?? []), seg])
  }
  return { segments, rows }
}
