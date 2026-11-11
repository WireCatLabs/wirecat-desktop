import { type UseQueryResult, useQueries } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { findTool } from "@/domain/catalog"
import type { ValueOption } from "@/domain/search"
import { platform } from "@/platform/bridge"
import type { ValueItem } from "@/platform/search-schemas"

const NONE: Record<string, ValueItem[]> = {}

/**
 * The tool's own lists of values (`search.values` in the catalog), by list name. A list that fails stays empty and is
 * asked again the next time the page opens; nothing is asked while the tour's examples show.
 */
export function useSearchValues(args: {
  tool: string | null
  profile: string | null
  /** null for a tool without profiles: its lists need none. */
  profiles: unknown[] | null | undefined
  version: string | null
  demo: boolean
}): Record<string, ValueItem[]> {
  const { tool, profile, profiles, version, demo } = args
  const names = useMemo(() => (tool ? Object.keys(findTool(tool)?.search?.values ?? {}) : []), [tool])
  const asked = profiles === null ? null : profile
  const ready = tool !== null && !demo && (profiles === null || profile !== null)
  // A stable `combine` keeps the same object until an answer changes, so what is built from it is not rebuilt.
  const combine = useCallback(
    (results: UseQueryResult<ValueItem[]>[]) =>
      results.length === 0 ? NONE : Object.fromEntries(names.map((name, n) => [name, results[n]?.data ?? []])),
    [names],
  )
  return useQueries({
    queries: names.map((name) => ({
      queryKey: ["tool", tool, "values", asked, version, name],
      queryFn: () => platform.searchValues(tool as string, asked, name),
      enabled: ready,
    })),
    combine,
  })
}

const BY = ["sender", "chat"] as const
type Counted = Record<(typeof BY)[number], ValueOption[]>
const NO_COUNTS: Counted = { sender: [], chat: [] }

/**
 * How many messages each sender wrote and each chat holds, all time (the Analytics page's `stats messages show`), to
 * put the most used first. Messengers only; an old tool or a failed count leaves the lists in the tool's own order.
 */
export function useMessageCounts(args: {
  tool: string | null
  profile: string | null
  messages: boolean
  demo: boolean
}): Counted {
  const { tool, profile, messages, demo } = args
  const combine = useCallback(
    (results: UseQueryResult<ValueOption[]>[]) =>
      results.every((r) => !r.data) ? NO_COUNTS : { sender: results[0]?.data ?? [], chat: results[1]?.data ?? [] },
    [],
  )
  return useQueries({
    queries: BY.map((by) => ({
      queryKey: ["tool", tool, "searchCounts", profile, by],
      queryFn: async () => {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const answer = await platform.messageStats(
          tool as string,
          profile as string,
          { period: "all", by, only: "all", previous: false, full: true },
          zone,
        )
        if (answer.kind !== "ready") return []
        return answer.rows.filter((r) => r.key !== "me").map((r) => ({ value: r.key, label: r.name, count: r.count }))
      },
      enabled: tool !== null && profile !== null && messages && !demo,
      staleTime: 10 * 60_000,
    })),
    combine,
  })
}
