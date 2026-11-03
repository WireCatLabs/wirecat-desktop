import * as v from "valibot"
import { type Aggregate, TaskSourcesSchema } from "@/platform/analytics-schemas"
import type { analyticsMessages } from "./messages"
import { type AggState, useAggregate } from "./store"

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

/** When the oldest open task came in, from memo's own per-chat counts; undefined while they are read. */
export function useOldestOpen(): string | undefined {
  const r = readParts([["memo", useAggregate("taskSources", "memo")]], TaskSourcesSchema)
  return r.ready
    .flatMap((p) => p.body.items.flatMap((i) => i.rows.map((row) => row.oldest_open_at)))
    .filter((x): x is string => x !== null)
    .sort()[0]
}
