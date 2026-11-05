import { type UseQueryResult, useQueries } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { findTool } from "@/domain/catalog"
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
