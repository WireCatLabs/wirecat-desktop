import { addDays, PERIOD_DAYS, todayIn, weekOf } from "@/domain/analytics"
import type { AnalyticsPreview, Ask, CountRow, MessageCounts, Only } from "./analytics-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// The Analytics page in the browser build. `?analytics=real` (no preview, as the real app), `?analytics=old` (Telegram too old to count), `?analytics=fail` (the work
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

/** How much of the traffic each kind is, so a kind's bars follow the whole but not in lockstep. */
const ONLY_SHARE: Record<Only, number> = {
  all: 1,
  sent: 0.31,
  photo: 0.09,
  voice: 0.05,
  video: 0.02,
  file: 0.03,
  link: 0.07,
  private: 0.46,
  group: 0.41,
  channel: 0.13,
}

function days(id: string, profile: string, ask: Ask, today: string): CountRow[] {
  const span = PERIOD_DAYS[ask.period] ?? (scenario === "empty" ? 0 : 600)
  const end = ask.previous ? -span : 0
  const rows: CountRow[] = []
  for (let i = span; i >= 0; i -= 1) {
    const day = addDays(today, end - i)
    const whole = scenario === "empty" ? 0 : dayCount(`${id}/${profile}`, day)
    const share = ONLY_SHARE[ask.only] * (0.7 + noise(`${ask.only}${day}`) * 0.6)
    const count = ask.only === "all" ? whole : Math.round(whole * Math.min(1, share))
    if (count > 0) rows.push({ key: day, name: null, count })
  }
  return rows
}

/** A day's messages spread over its hours: quiet nights, a morning and an evening peak, a later start at weekends. */
function hours(rows: CountRow[]): CountRow[] {
  const out: CountRow[] = []
  for (const r of rows) {
    const weekend = [0, 6].includes(new Date(`${r.key}T12:00:00Z`).getUTCDay())
    const weights = Array.from({ length: 24 }, (_, h) => {
      const morning = Math.exp(-((h - (weekend ? 12 : 10)) ** 2) / 8)
      const evening = Math.exp(-((h - 20) ** 2) / 6) * (weekend ? 1.3 : 0.9)
      return h < 7 ? 0.03 : morning + evening + 0.15
    })
    const sum = weights.reduce((a, b) => a + b, 0)
    weights.forEach((w, h) => {
      const count = Math.round((r.count * w) / sum)
      if (count > 0) out.push({ key: `${r.key}T${String(h).padStart(2, "0")}`, name: null, count })
    })
  }
  return out
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
  async messageStats(id, profile, ask, timezone): Promise<MessageCounts> {
    const { by } = ask
    await delay(300 + noise(`${id}${profile}${by}${ask.only}`) * 700)
    if (scenario === "old" && id === "tg") return { kind: "old", message: "unknown command 'stats'" }
    if (scenario === "fail" && profile === "work")
      return { kind: "failed", message: "another process holds the store; try again in a minute" }
    const today = todayIn(timezone)
    const dayRows = days(id, profile, ask, today)
    const total = dayRows.reduce((s, r) => s + r.count, 0)
    const share = profile === "work" ? 0.5 : 1
    // The period before: people and chats shift a little, and one person goes quiet, so the comparison has a story.
    const drift = (list: [string, string, number][]) =>
      ask.previous
        ? list.map(([k, n, w], i): [string, string, number] => [k, n, i === 1 ? w * 3.2 : w * (0.6 + noise(k) * 0.7)])
        : list
    const rows =
      by === "day"
        ? dayRows
        : by === "hour"
          ? hours(dayRows)
          : total === 0
            ? []
            : ranked(drift((by === "sender" ? PEOPLE : CHATS)[id] ?? []), total * share, by === "sender")
    return { kind: "ready", total, rows, more: false }
  },

  async analyticsPreview(period): Promise<AnalyticsPreview | null> {
    await delay(400)
    if (scenario === "real") return null
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
    const range = /closed:\[(\d{4}-\d{2}-\d{2}) TO (\d{4}-\d{2}-\d{2})\]$/.exec(query)
    if (!range) return base.taskCounts(query)
    const counts = await base.taskCounts("closed:>=1d")
    const [, from = "", to = ""] = range
    let total = 0
    for (let d = from; d <= to; d = addDays(d, 1)) total += Math.round(noise(`done${d}`) * 2.4)
    return { ...counts, total }
  },
})
