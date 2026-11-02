import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { Readiness } from "@/platform/schemas"

type SystemState = {
  readiness: Readiness | null
  error: string | null
  refresh(): Promise<void>
}

// The bar above every page and the Tools page both ask at startup; they share one answer.
let pending: Promise<void> | null = null

export const useSystem = create<SystemState>((set) => ({
  readiness: null,
  error: null,
  refresh() {
    pending ??= platform
      .readiness()
      .then(
        (readiness) => set({ readiness, error: null }),
        (e) => set({ error: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => {
        pending = null
      })
    return pending
  },
}))
