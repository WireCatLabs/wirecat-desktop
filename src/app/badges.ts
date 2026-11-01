import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeStorage } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"

type Seen = { seen: string[]; see(section: string): void }

/** Sections whose one-time badge the owner has already opened. Never shown again, whatever they did there. */
export const useSeen = create<Seen>()(
  persist(
    (set) => ({
      seen: [],
      see: (section) => set((s) => (s.seen.includes(section) ? s : { seen: [...s.seen, section] })),
    }),
    { name: "wirecat.badges", storage: createJSONStorage(() => safeStorage) },
  ),
)

/**
 * Which sidebar sections carry a dot. Few on purpose, so a dot still means something; the rules and the ones left out
 * are in docs/dev/plans/2026-11-01-notifications.md.
 */
export function useBadges(active: string): Partial<Record<string, true>> {
  const agentsSeen = useSeen((s) => s.seen.includes("agents"))
  const hasTools = useTools((s) => Object.values(s.installs).some((copies) => copies.length > 0))
  const badges: Partial<Record<string, true>> = {}
  if (hasTools && !agentsSeen) badges.agents = true

  const showing = Object.keys(badges).join()
  useEffect(() => {
    if (showing.split(",").includes(active)) useSeen.getState().see(active)
  }, [active, showing])
  return badges
}
