import type { Gap } from "@/domain/needs"
import { useTools } from "@/shared/tools-store"

/**
 * Whether memo is installed, and the gap to show when a finished detection (kept from the last run) found it missing.
 * Neither means unknown yet: Settings starts no scan of its own, so it does not use `useNeed`.
 */
export function useMemoGap(): { memo: boolean; gap: Gap | null } {
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  const known = useTools((s) => s.installs.memo !== undefined)
  return { memo, gap: known && !memo ? { kind: "missing", tool: "memo", others: [] } : null }
}
