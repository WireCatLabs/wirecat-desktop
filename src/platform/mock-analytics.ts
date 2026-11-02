import { addDays, PERIOD_DAYS, type Period, todayIn, weekOf } from "@/domain/analytics"
import type { AnalyticsPreview, CountRow, MessageCounts } from "./analytics-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// The Analytics page in the browser build. `?analytics=old` (Telegram too old to count), `?analytics=fail` (the work
// profile does not answer), `?analytics=empty` (nothing in any period). The preview stands in for what no tool counts
// yet (plan `docs/dev/plans/2026-11-02-analytics.md`); the real app answers null for it.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("analytics")

/** A repeatable noise from a string, so a day keeps its count across reloads and periods. */
function noise(seed: string): number {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

const SCALE: Record<string, number> = { "tg/personal": 120, "tg/work": 45, "max/personal": 22, "wa/personal": 64 }

/** Weekdays busier than weekends, a slow rise over the last months, and some days much louder than others. */
function dayCount(source: string, day: string): number {
  const base = SCALE[source] ?? 20
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  const weekend = weekday === 0 || weekday === 6 ? (source.startsWith("tg/work") ? 0.15 : 0.7) : 1
  const age = (Date.now() - Date.parse(`${day}T12:00:00Z`)) / 86_400_000
  const trend = Math.max(0.25, 1 - age / 900)
  const n = noise(`${source}${day}`)
  const spike = n > 0.94 ? 2.2 : 1
  return Math.round(base * weekend * trend * spike * (0.55 + n * 0.9))
}

const PEOPLE: Record<string, [string, string, number][]> = {
  tg: [
    ["101", "Lucía Fernández", 0.16],
    ["102", "Marco Bianchi", 0.11],
    ["103", "Anna Petrova", 0.09],
    ["104", "Design crit bot", 0.04],
    ["105", "Tom Okafor", 0.06],
    ["106", "Sofia Lind", 0.05],
    ["107", "Kenji Sato", 0.03],
  ],
  max: [
    ["201", "Ирина Волкова", 0.3],
    ["202", "Павел Смирнов", 0.18],
  ],
  wa: [
    ["301", "Mum", 0.22],
    ["302", "Diego Ruiz", 0.14],
    ["303", "Elena García", 0.08],
  ],
}

const CHATS: Record<string, [string, string, number][]> = {
  tg: [
    ["-1001", "Harbour launch", 0.24],
    ["-1002", "Design crit", 0.17],
    ["101", "Lucía Fernández", 0.12],
    ["-1003", "Valencia runners", 0.1],
    ["-1004", "Release notes", 0.06],
  ],
  max: [
    ["-2001", "Дача", 0.4],
    ["201", "Ирина Волкова", 0.3],
  ],
  wa: [
    ["-3001", "Family", 0.38],
    ["301", "Mum", 0.22],
    ["-3002", "Climbing Thursdays", 0.12],
  ],
}

function days(id: string, profile: string, period: Period, today: string): CountRow[] {
  const span = PERIOD_DAYS[period] ?? (scenario === "empty" ? 0 : 600)
  const rows: CountRow[] = []
  for (let i = span; i >= 0; i -= 1) {
    const day = addDays(today, -i)
    const count = scenario === "empty" ? 0 : dayCount(`${id}/${profile}`, day)
    if (count > 0) rows.push({ key: day, name: null, count })
  }
  return rows
}

function ranked(list: [string, string, number][], total: number, me: boolean): CountRow[] {
  const rows = list.map(([key, name, share]) => ({ key, name, count: Math.round(total * share) }))
  return (me ? [{ key: "me", name: null, count: Math.round(total * 0.31) }, ...rows] : rows).sort(
    (a, b) => b.count - a.count,
  )
}

export const analyticsMock = (
  base: Pick<Platform, "taskCounts">,
): Pick<Platform, "messageStats" | "analyticsPreview" | "taskCounts"> => ({
  async messageStats(id, profile, period, by, timezone): Promise<MessageCounts> {
    await delay(500 + noise(`${id}${profile}${by}`) * 900)
    if (scenario === "old" && id === "tg") return { kind: "old", message: "unknown command 'stats'" }
    if (scenario === "fail" && profile === "work")
      return { kind: "failed", message: "another process holds the store; try again in a minute" }
    const today = todayIn(timezone)
    const dayRows = days(id, profile, period, today)
    const total = dayRows.reduce((s, r) => s + r.count, 0)
    const share = profile === "work" ? 0.5 : 1
    const rows =
      by === "day"
        ? dayRows
        : total === 0
          ? []
          : ranked((by === "sender" ? PEOPLE : CHATS)[id] ?? [], total * share, by === "sender")
    return { kind: "ready", total, rows, more: false }
  },

  async analyticsPreview(period): Promise<AnalyticsPreview> {
    await delay(400)
    const today = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
    const weeks = Math.ceil((PERIOD_DAYS[period] ?? 182) / 7)
    const taskWeeks = Array.from({ length: weeks }, (_, i) => {
      const week = weekOf(addDays(today, -7 * (weeks - 1 - i)))
      const n = noise(`tasks${week}`)
      return { week, created: Math.round(4 + n * 9), closed: Math.round(3 + noise(`closed${week}`) * 9) }
    })
    const scale = (PERIOD_DAYS[period] ?? 365) / 30
    return {
      taskWeeks,
      projectMessages: {
        HRB: Math.round(412 * scale),
        OPS: Math.round(186 * scale),
        HOME: Math.round(73 * scale),
        WEB: Math.round(29 * scale),
      },
    }
  },

  // Only the Analytics page asks for closed tasks by a date range; the Tasks page never does.
  async taskCounts(query) {
    const range = /^closed:\[(\d{4}-\d{2}-\d{2}) TO (\d{4}-\d{2}-\d{2})\]$/.exec(query)
    if (!range) return base.taskCounts(query)
    const counts = await base.taskCounts("closed:>=1d")
    const [, from = "", to = ""] = range
    let total = 0
    for (let d = from; d <= to; d = addDays(d, 1)) total += Math.round(noise(`done${d}`) * 2.4)
    return { ...counts, total }
  },
})
