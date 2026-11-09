import { useQueries } from "@tanstack/react-query"
import { useEffect } from "react"
import { tools } from "@/domain/catalog"
import { type Gap, gapOf, type Need } from "@/domain/needs"
import { profilesQuery } from "@/shared/query"
import { useTools } from "@/shared/tools-store"

/** Any CRM the catalog knows, signed in: Clients imports deals from whichever the owner uses. */
export const crmNeed = (): Need => ({ anyOf: tools.filter((t) => t.crm).map((t) => t.id), signedIn: true })

/** What a page still needs from the tools on this computer; null while that is not known yet, or nothing is missing. */
export function useNeed(need: Need): Gap | null {
  const checked = useTools((s) => s.checked)
  const refreshing = useTools((s) => s.refreshing)
  // The tools are found when the Tools page opens; a page opened first asks for them itself, as Search does.
  useEffect(() => {
    if (!checked && !refreshing) void useTools.getState().refresh()
  }, [checked, refreshing])
  const installs = useTools((s) => s.installs)
  const installed = (id: string) => (installs[id]?.length ?? 0) > 0
  const profiles = useQueries({
    queries: need.signedIn ? need.anyOf.filter(installed).map((id) => profilesQuery(id)) : [],
  })
  const read = new Map(
    need.signedIn
      ? need.anyOf.filter(installed).map((id, i) => [id, profiles[i]?.isError ? null : profiles[i]?.data] as const)
      : [],
  )
  const gap = gapOf(need, (id) => ({
    version: checked ? (installs[id]?.[0]?.version ?? (installed(id) ? "" : null)) : undefined,
    profiles: read.has(id)
      ? (read
          .get(id)
          ?.filter((p) => p.signedIn !== false)
          .map((p) => p.name) ?? null)
      : undefined,
  }))
  return gap === "unknown" ? null : gap
}
