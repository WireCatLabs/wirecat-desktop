import { type UseQueryResult, useQueries, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { addDays, type Period, weekOf } from "@/domain/analytics"
import type { Aggregate, CountRow, MessageCounts, Which } from "@/platform/analytics-schemas"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"
import { useTools } from "@/shared/tools-store"
import type { Spec } from "./store"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** At most `n` tool processes at once: every one is a Node.js start, and the page asks a dozen. */
export function limiter(n: number) {
  let running = 0
  const waiting: (() => void)[] = []
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>((go) => waiting.push(go))
    running += 1
    try {
      return await job()
    } finally {
      running -= 1
      waiting.shift()?.()
    }
  }
}

const run = limiter(3)

/** Each profile's rows; a profile that failed or is too old has none. */
export type ExtraAnswers = { profile: string; rows: CountRow[] }[]

type Asked = { period: Period; zone: string; profiles: string[] }

// Kept for the page's visit, so a period seen once comes back at once; `load()` resets every key under "analytics".
const SESSION = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY }

export const analyticsKeys = {
  all: ["analytics"] as const,
  extra: (id: string, spec: Omit<Spec, "period">, { period, zone, profiles }: Asked) =>
    ["analytics", "extra", id, period, zone, spec.by, spec.only, spec.previous, profiles] as const,
  aggregate: (which: Which, id: string, { period, zone, profiles }: Asked) =>
    ["analytics", "aggregate", which, id, period, zone, profiles] as const,
}

export const installed = (id: string) => {
  const installs = useTools.getState().installs[id]
  return installs === undefined ? null : installs.length > 0
}

/** A messenger's answer to the spec in any period already read, shown dimmed while the asked period loads. */
export function earlierAnswer(id: string, { by, only, previous }: Omit<Spec, "period">) {
  const found = queryClient().getQueriesData<ExtraAnswers>({
    queryKey: ["analytics", "extra", id],
    predicate: (q) => q.queryKey[5] === by && q.queryKey[6] === only && q.queryKey[7] === previous,
  })
  return found.find(([, data]) => data !== undefined)?.[1]
}

/**
 * One spec's rows for each messenger whose profiles are known. The page's own day count is written into the same key
 * by its load, so `own` only reads it.
 */
export function useExtraQueries(
  ids: readonly string[],
  spec: Omit<Spec, "period">,
  asked: { period: Period; zone: string; profilesOf: Record<string, string[]> },
  options: { enabled: boolean; own: boolean },
) {
  const { by, only, previous } = spec
  const combine = useCallback((results: UseQueryResult<ExtraAnswers>[]) => results.map((r) => r.data), [])
  return useQueries({
    queries: ids.map((id) => {
      const profiles = asked.profilesOf[id] ?? []
      return {
        queryKey: analyticsKeys.extra(id, { by, only, previous }, { ...asked, profiles }),
        queryFn: async (): Promise<ExtraAnswers> => {
          const parts = await Promise.all(
            profiles.map(async (profile) => {
              const answer = await run(() =>
                platform.messageStats(id, profile, { by, only, previous, period: asked.period }, asked.zone),
              ).catch((): MessageCounts => ({ kind: "failed", message: "" }))
              return answer.kind === "ready" ? [{ profile, rows: answer.rows }] : []
            }),
          )
          return parts.flat()
        },
        enabled: options.enabled && !options.own,
        ...SESSION,
      }
    }),
    combine,
  })
}

/** Each profile's answer to one of the tool's aggregates; a profile that fails answers `failed`, never the query. */
export function useAggregateQuery(which: Which, id: string, asked: Asked | null, enabled: boolean) {
  const profiles = asked?.profiles ?? []
  return useQuery({
    queryKey: analyticsKeys.aggregate(which, id, asked ?? { period: "30d", zone: "", profiles }),
    queryFn: () => {
      const { period, zone } = asked as Asked
      const ask: (string | null)[] = profiles.length ? profiles : [null]
      return Promise.all(
        ask.map(async (profile) => ({
          profile,
          answer: await run(() => platform.analyticsAggregate(id, which, profile, period, zone)).catch(
            (e): Aggregate => ({ kind: "failed", message: message(e) }),
          ),
        })),
      )
    },
    enabled: enabled && asked !== null,
    ...SESSION,
  })
}

/** Closed tasks this week and on the same days last week, from memo's own counts; null until both answer or if not. */
export function useClosedWeeks(today: string) {
  const q = useQuery({
    queryKey: ["analytics", "closedWeeks", today],
    queryFn: async () => {
      const monday = weekOf(today)
      const range = (from: string, to: string) => `state:(done OR dismissed) closed:[${from} TO ${to}]`
      const [now, last] = await Promise.all([
        platform.taskCounts(range(monday, today)),
        platform.taskCounts(range(addDays(monday, -7), addDays(today, -7))),
      ])
      return { now: now.total, last: last.total }
    },
    ...SESSION,
  })
  return q.data ?? null
}
