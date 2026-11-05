import * as v from "valibot"
import { meetingStats, weekOf } from "@/domain/analytics"
import {
  type Aggregate,
  MeetingHistorySchema,
  MeetingsListSchema,
  TaskSourcesSchema,
} from "@/platform/analytics-schemas"
import type { analyticsMessages } from "./messages"
import { type AggState, useAggregate, useAnalytics } from "./store"

type M = typeof analyticsMessages.en

/** A span of time as people say it: minutes under an hour, hours under two days, then days. */
export function duration(ms: number, m: M, lang: string): string {
  const min = ms / 60_000
  if (min < 60) return m.minutes(Math.max(1, Math.round(min)))
  const h = min / 60
  if (h < 48) return m.hours(new Intl.NumberFormat(lang, { maximumFractionDigits: h < 10 ? 1 : 0 }).format(h))
  return m.days(Math.round(h / 24))
}

/** Each profile's parsed answer; `old` lists the tools still too old for the command. */
export function readParts<T>(states: [string, AggState][], schema: v.GenericSchema<unknown, T>) {
  const ready: { id: string; profile: string | null; body: T }[] = []
  const old: string[] = []
  const failed: string[] = []
  let loading = false
  for (const [id, s] of states) {
    if (s.state === "loading") loading = true
    if (s.state !== "ready") continue
    for (const p of s.parts) {
      const a: Aggregate = p.answer
      if (a.kind === "old") old.push(id)
      else if (a.kind === "failed") failed.push(a.message)
      else {
        const parsed = v.safeParse(schema, a.body)
        if (parsed.success) ready.push({ id, profile: p.profile, body: parsed.output })
        else failed.push(parsed.issues[0]?.message ?? "")
      }
    }
  }
  return { ready, old: [...new Set(old)], failed, loading }
}

/** Tasks per chat and per meeting, from memo's own counts, both read once. */
export function useTaskSources() {
  return readParts(
    [
      ["memo", useAggregate("taskSources", "memo")],
      ["memo", useAggregate("taskMeetings", "memo")],
    ],
    TaskSourcesSchema,
  )
}

/** When the oldest open task came in, from memo's own per-chat counts; undefined while they are read. */
export function useOldestOpen(): string | undefined {
  return useTaskSources()
    .ready.flatMap((p) => p.body.rows.map((row) => row.oldest_open_at))
    .filter((x): x is string => x !== null)
    .sort()[0]
}

export type MeetingNumbers = {
  count: number
  minutes: number
  meanMinutes: number | null
  /** One row per week, keyed by its Monday. */
  weeks: { key: string; count: number }[]
  series: { id: string; title: string | null; count: number; minutes: number }[]
  /** `history` when zm counted them itself, `list` when the page added its stored meetings up. */
  from: "history" | "list"
}

/**
 * Meetings in the period: zm's own `stats meetings history` when the installed version has it, otherwise the page
 * adds up `meetings list`, as before zm 0.67. `loading` until the answer that will be shown is in.
 */
export function useMeetingNumbers(): {
  numbers: MeetingNumbers | null
  loading: boolean
  missing: boolean
  old: string[]
  failed: string[]
} {
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const weekState = useAggregate("meetingsWeek", "zm")
  const seriesState = useAggregate("meetingsSeries", "zm")
  const week = readParts([["zm", weekState]], MeetingHistorySchema)
  const series = readParts([["zm", seriesState]], MeetingHistorySchema)
  const history = week.ready.length > 0 && !week.old.length
  const listState = useAggregate("meetings", "zm", !history && !week.loading)
  const list = readParts([["zm", listState]], MeetingsListSchema)
  if (weekState.state === "missing") return { numbers: null, loading: false, missing: true, old: [], failed: [] }
  if (history) {
    const parts = week.ready.map((p) => p.body)
    const count = parts.reduce((s, b) => s + b.meetings, 0)
    const minutes = parts.reduce((s, b) => s + b.minutes, 0)
    const byWeek = new Map<string, number>()
    for (const b of parts) for (const r of b.rows) byWeek.set(r.key, (byWeek.get(r.key) ?? 0) + r.meetings)
    const bySeries = new Map<string, MeetingNumbers["series"][number]>()
    for (const p of series.ready)
      for (const r of p.body.rows) {
        const had = bySeries.get(r.key)
        bySeries.set(r.key, {
          id: r.key,
          title: r.key === "no-series" ? null : (had?.title ?? r.name ?? null),
          count: (had?.count ?? 0) + r.meetings,
          minutes: (had?.minutes ?? 0) + r.minutes,
        })
      }
    return {
      numbers: {
        count,
        minutes,
        meanMinutes: count ? Math.round(minutes / count) : null,
        weeks: [...byWeek].map(([key, n]) => ({ key, count: n })),
        series: [...bySeries.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 6),
        from: "history",
      },
      loading: series.loading,
      missing: false,
      old: [],
      failed: [],
    }
  }
  if (week.loading || list.loading || listState.state === "loading")
    return { numbers: null, loading: true, missing: false, old: [], failed: [] }
  if (!list.ready.length) return { numbers: null, loading: false, missing: false, old: list.old, failed: list.failed }
  const s = meetingStats(
    list.ready.flatMap((p) => p.body.items),
    period,
    today,
    zone,
  )
  return {
    numbers: {
      count: s.count,
      minutes: s.minutes,
      meanMinutes: s.meanMinutes,
      weeks: s.rows.map((r) => ({ key: weekOf(r.key), count: r.count })),
      series: s.series.map((x) => ({ id: x.title, title: x.title, count: x.count, minutes: x.minutes })),
      from: "list",
    },
    loading: false,
    missing: false,
    old: [],
    failed: [],
  }
}
