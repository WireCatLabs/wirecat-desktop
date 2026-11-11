import { type UseQueryResult, useQueries, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import * as v from "valibot"
import { addDays, EVERY_STATE, type Period, weekOf } from "@/domain/analytics"
import {
  type Aggregate,
  type CountRow,
  type MessageCounts,
  TaskSourcesSchema,
  type Which,
} from "@/platform/analytics-schemas"
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

/** Each profile's rows; a profile that failed or is too old has none, and says why in `failed`. */
export type ExtraAnswers = {
  profile: string
  rows: CountRow[]
  privateOnly?: boolean | undefined
  failed?: { message: string; code: string | null; old: boolean }
}[]

type Asked = { period: Period; zone: string; profiles: string[] }

// Kept for the page's visit, so a period seen once comes back at once; `load()` marks every key under "analytics"
// stale, so a later visit reads again with the last answer on screen.
const SESSION = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY }

export const analyticsKeys = {
  all: ["analytics"] as const,
  extra: (id: string, spec: Omit<Spec, "period">, { period, zone, profiles }: Asked) =>
    [
      "analytics",
      "extra",
      id,
      period,
      zone,
      spec.by,
      spec.only,
      spec.previous,
      profiles,
      spec.range?.from ?? null,
      spec.range?.to ?? null,
      spec.full ?? false,
    ] as const,
  aggregate: (which: Which, id: string, { period, zone, profiles }: Asked) =>
    ["analytics", "aggregate", which, id, period, zone, profiles] as const,
}

export const installed = (id: string) => {
  const installs = useTools.getState().installs[id]
  return installs === undefined ? null : installs.length > 0
}

/** A messenger's answer to the spec in any period already read, shown dimmed while the asked period loads. */
export function earlierAnswer(id: string, { by, only, previous, range, full }: Omit<Spec, "period">) {
  const found = queryClient().getQueriesData<ExtraAnswers>({
    queryKey: ["analytics", "extra", id],
    predicate: (q) =>
      q.queryKey[5] === by &&
      q.queryKey[6] === only &&
      q.queryKey[7] === previous &&
      q.queryKey[9] === (range?.from ?? null) &&
      q.queryKey[11] === (full ?? false),
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
  const { by, only, previous, range, full } = spec
  const combine = useCallback((results: UseQueryResult<ExtraAnswers>[]) => results.map((r) => r.data), [])
  return useQueries({
    queries: ids.map((id) => {
      const profiles = asked.profilesOf[id] ?? []
      return {
        queryKey: analyticsKeys.extra(id, { by, only, previous, range, full }, { ...asked, profiles }),
        queryFn: async (): Promise<ExtraAnswers> =>
          Promise.all(
            profiles.map(async (profile) => {
              const ask = {
                by,
                only,
                previous,
                period: asked.period,
                ...(range ? { range } : {}),
                ...(full ? { full } : {}),
              }
              const answer = await run(() => platform.messageStats(id, profile, ask, asked.zone)).catch(
                (e): MessageCounts => ({ kind: "failed", message: message(e), code: null }),
              )
              if (answer.kind === "ready") return { profile, rows: answer.rows, privateOnly: answer.privateOnly }
              return {
                profile,
                rows: [],
                failed: {
                  message: answer.message,
                  code: answer.kind === "failed" ? answer.code : null,
                  old: answer.kind === "old",
                },
              }
            }),
          ),
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

/** memo's tasks found in chats and meetings over calendar days; null on a memo too old to count them. */
async function chatTasks(from: string, to: string, zone: string) {
  const answer = await platform
    .analyticsAggregate("memo", "taskSources", null, "30d", zone, { from, to })
    .catch(() => null)
  if (answer?.kind !== "ready") return null
  const parsed = v.safeParse(TaskSourcesSchema, answer.body)
  return parsed.success ? parsed.output : null
}

/** `tasks counts` reads project tasks only, so chat tasks are added from memo's own per-chat counts. */
async function tasksIn(from: string, to: string, zone: string) {
  const [closed, made, chats] = await Promise.all([
    platform.taskCounts(`state:(done OR dismissed) closed:[${from} TO ${to}]`),
    platform.taskCounts(`${EVERY_STATE} created:[${from} TO ${to}]`),
    chatTasks(from, to, zone),
  ])
  return { closed: closed.total + (chats?.closed ?? 0), created: chats ? made.total + chats.created : null }
}

/** Tasks made and closed this week and on the same days last week; null until they answer. */
export function useTaskWeeks(today: string, zone: string) {
  const q = useQuery({
    queryKey: ["analytics", "taskWeeks", today, zone],
    queryFn: async () => {
      const monday = weekOf(today)
      const [now, last] = await Promise.all([
        tasksIn(monday, today, zone),
        tasksIn(addDays(monday, -7), addDays(today, -7), zone),
      ])
      return { now, last }
    },
    ...SESSION,
  })
  return q.data ?? null
}
