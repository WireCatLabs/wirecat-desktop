import { addDays, PERIOD_DAYS, todayIn, weekOf } from "@/domain/analytics"
import type {
  Aggregate,
  AnalyticsPreview,
  Ask,
  CountRow,
  MessageCounts,
  Only,
  Period,
  Which,
} from "./analytics-schemas"
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

/** Commands no CLI has yet (plan, A1–A6): the real app shows "arrives with an update", and so do these scenarios. */
const PLANNED: readonly Which[] = ["responses", "waiting", "coverage", "mail"]
const showcaseOn = params.has("showcase")

const SERIES: [string, number, number][] = [
  ["Harbour weekly", 60, 7],
  ["1:1 Lucía", 30, 3.5],
  ["Design crit", 45, 3.5],
  ["Investor update", 50, 30],
  ["Ops standup", 15, 1.4],
]

function aggregateMock(id: string, which: Which, profile: string | null, period: Period, today: string): Aggregate {
  if (PLANNED.includes(which) && (scenario === "real" || showcaseOn))
    return { kind: "old", message: `unknown command '${which}'` }
  const span = PERIOD_DAYS[period] ?? 365
  const days = Array.from({ length: span }, (_, i) => addDays(today, -(span - 1 - i)))
  const scale = id === "tg" ? 1 : id === "wa" ? 0.6 : 0.3
  switch (which) {
    case "responses": {
      const rows = days.map((key) => {
        const r = noise(`resp${id}${profile}${key}`)
        return {
          key,
          replies: Math.round(4 + r * 12 * scale),
          median_ms: Math.round((8 + r * 40) * 60_000),
          p90_ms: Math.round((2 + r * 6) * 3_600_000),
        }
      })
      return {
        kind: "ready",
        body: {
          who: "me",
          replies: rows.reduce((s, r) => s + r.replies, 0),
          median_ms: Math.round((18 + scale * 9) * 60_000),
          p90_ms: Math.round((3.5 + scale) * 3_600_000),
          mean_ms: Math.round(52 * 60_000),
          rows,
        },
      }
    }
    case "waiting":
      return {
        kind: "ready",
        body: {
          chats: Math.round(2 + 5 * scale),
          messages: Math.round(5 + 14 * scale),
          oldest_at: new Date(Date.now() - (2 + scale * 3) * 86_400_000).toISOString(),
        },
      }
    case "coverage":
      return {
        kind: "ready",
        body: {
          chats: Math.round(1600 * scale),
          fetched: Math.round(1290 * scale),
          partial: Math.round(190 * scale),
          never: Math.round(120 * scale),
        },
      }
    case "mail": {
      const rows = days.map((key) => {
        const weekend = [0, 6].includes(new Date(`${key}T12:00:00Z`).getUTCDay())
        const r = noise(`mail${key}`)
        return {
          key,
          received: Math.round((weekend ? 4 : 22) * (0.6 + r)),
          sent: Math.round((weekend ? 0 : 6) * (0.4 + r)),
        }
      })
      return {
        kind: "ready",
        body: {
          by: "day",
          received: rows.reduce((s, r) => s + r.received, 0),
          sent: rows.reduce((s, r) => s + r.sent, 0),
          rows,
        },
      }
    }
    case "meetings": {
      const items = days.flatMap((day) =>
        SERIES.flatMap(([title, minutes, every], i) => {
          const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
          if (weekday === 0 || weekday === 6 || noise(`${title}${day}`) > 1 / every) return []
          const start = `${day}T${String(9 + i * 2).padStart(2, "0")}:00:00Z`
          return [
            {
              started_at: start,
              duration_ms: Math.round(minutes * (0.8 + noise(`d${title}${day}`) * 0.5)) * 60_000,
              title,
            },
          ]
        }),
      )
      return { kind: "ready", body: { items } }
    }
    case "taskSources": {
      const chats: [string, string, number, number][] = [
        ["chat:telegram/1/-1001", "Harbour launch", 6, 2],
        ["chat:telegram/1/101", "Lucía Fernández", 3, 0.5],
        ["chat:whatsapp/1/-3001", "Family", 2, 4],
        ["chat:email/1/t9", "Invoices", 4, 9],
        ["meeting:zoom/1/88", "Harbour weekly", 5, 3],
      ]
      const rows = chats.map(([chat, name, open, days]) => ({
        chat,
        name,
        open,
        oldest_open_at: new Date(Date.now() - days * 3 * 86_400_000).toISOString(),
        median_close_ms: Math.round(days * 86_400_000),
      }))
      return { kind: "ready", body: { items: [{ open: rows.reduce((s, r) => s + r.open, 0), rows }] } }
    }
  }
}

export const analyticsMock = (
  base: Pick<Platform, "taskCounts">,
): Pick<Platform, "messageStats" | "analyticsPreview" | "taskCounts" | "analyticsAggregate"> => ({
  async analyticsAggregate(id, which, profile, period, timezone): Promise<Aggregate> {
    await delay(350 + noise(`${id}${which}${profile}`) * 600)
    return aggregateMock(id, which, profile, period, todayIn(timezone))
  },

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
