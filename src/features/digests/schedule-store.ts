import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Backfill, DigestSchedules } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { safeStorage } from "@/shared/safe-storage"
import { useDigests } from "./store"

/** What the schedule had when the page last read it; memo forgets it on `schedule remove`, so on brings it back. */
export type Remembered = { time: string; routes: string[]; maxCostUsd: number; maxCostPerDayUsd: number }

/** The caps of the morning digest memo's skill was set up with: one run, then one day. */
export const DEFAULT_SETTINGS: Remembered = { time: "08:30", routes: [], maxCostUsd: 0.5, maxCostPerDayUsd: 1 }

export type Busy = "save" | "remove" | "run" | null

type State = {
  status: DigestSchedules | null
  error: string | null
  busy: Busy
  /** Why the last change failed, in memo's words. */
  failed: { what: Exclude<Busy, null>; message: string } | null
  remembered: Remembered | null
  /** Whether this memo has `digest backfill`; null until asked. */
  backfill: "yes" | "no" | null
  load(): Promise<void>
  save(settings: Remembered): Promise<void>
  remove(): Promise<void>
  runNow(): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const rememberedOf = (status: DigestSchedules): Remembered | null => {
  if (status.state !== "ready" || !status.digest?.time) return null
  const d = status.digest
  return {
    time: d.time ?? DEFAULT_SETTINGS.time,
    routes: d.routes.map((r) => r.value),
    maxCostUsd: d.maxCostUsd ?? DEFAULT_SETTINGS.maxCostUsd,
    maxCostPerDayUsd: d.maxCostPerDayUsd ?? DEFAULT_SETTINGS.maxCostPerDayUsd,
  }
}

/** The local day `days` before today, `2026-11-07`. */
export function dayBefore(days: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** The `n` days up to yesterday: today's digest is the schedule's to write. */
export const backfillRange = (n: number, now = new Date()) => ({ from: dayBefore(n, now), to: dayBefore(1, now) })

export const useDigestSchedule = create<State>()(
  persist(
    (set, get) => {
      const take = (status: DigestSchedules) =>
        set((s) => ({ status, error: null, remembered: rememberedOf(status) ?? s.remembered }))
      const change = async (what: Exclude<Busy, null>, call: () => Promise<DigestSchedules>) => {
        set({ busy: what, failed: null })
        try {
          take(await call())
        } catch (e) {
          set({ failed: { what, message: message(e) } })
        } finally {
          set({ busy: null })
        }
      }
      return {
        status: null,
        error: null,
        busy: null,
        failed: null,
        remembered: null,
        backfill: null,
        async load() {
          try {
            take(await platform.digestSchedule())
          } catch (e) {
            set({ error: message(e) })
          }
          if (get().backfill !== null) return
          // Pricing is free and builds nothing: it only tells whether this memo has the command.
          const { from, to } = backfillRange(7)
          platform.digestBackfill(from, to, false).then(
            (b: Backfill) => set({ backfill: b.state === "unsupported" ? "no" : "yes" }),
            () => set({ backfill: "yes" }),
          )
        },
        save: (s) =>
          change("save", () => platform.digestScheduleSave(s.time, s.routes, s.maxCostUsd, s.maxCostPerDayUsd)),
        remove: () => change("remove", () => platform.digestScheduleRemove()),
        async runNow() {
          await change("run", () => platform.digestScheduleRun())
          void useDigests.getState().load()
        },
      }
    },
    {
      name: "wirecat.digest-schedule",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ remembered: s.remembered }),
    },
  ),
)
