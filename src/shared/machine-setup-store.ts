import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeStorage } from "@/shared/safe-storage"

export const NIGHTLY_TIME = "04:45"

export type MachineChoices = {
  /** WireCat opens when the owner logs in to this computer. */
  atLogin: boolean
  /** Each signed-in account syncs everything once a day at `time`, on the tool's own timer. */
  nightly: boolean
  time: string
  /** The messengers' own `serve` keeps running and starts at login, so new messages arrive at once. */
  live: boolean
}

type MachineSetupState = MachineChoices & {
  /**
   * The owner confirmed these, on the first setup screen or in Settings. Until then nothing is applied: a copy that
   * was set up before these questions existed must not get timers nobody asked for.
   */
  answered: boolean
  /** A choice on the first setup screen, applied once the owner goes on. */
  choose(patch: Partial<MachineChoices>): void
  /** A choice that is applied at once (Settings, the last setup step); the first one confirms what is shown. */
  settle(patch: Partial<MachineChoices>): void
  confirm(): void
}

// Serve stays off until asked: on a new computer the first screen comes before any messenger is chosen, so the
// question is often first seen in Settings, and a background connection is not something to start unseen.
const DEFAULTS: MachineChoices = { atLogin: true, nightly: true, time: NIGHTLY_TIME, live: false }

export const useMachineSetup = create<MachineSetupState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      answered: false,
      choose: (patch) => set(patch),
      settle: (patch) =>
        set((s) => ({ ...(s.answered ? {} : { nightly: false, live: false }), ...patch, answered: true })),
      confirm: () => set({ answered: true }),
    }),
    {
      name: "wirecat.machine-setup",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ atLogin, nightly, time, live, answered }) => ({ atLogin, nightly, time, live, answered }),
    },
  ),
)

/** What a page shows: before the owner answered, nothing runs on a timer or in the background. */
export const shownChoices = (s: MachineChoices & { answered: boolean }): MachineChoices =>
  s.answered ? s : { ...s, nightly: false, live: false }
