import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
import { furthest, STEPS, type StepId } from "@/domain/onboarding-flow"

export { STEPS, type StepId }

/** Absent on the first start; "later" when the owner postponed it, "done" once finished. */
type Status = "new" | "later" | "done"

type OnboardingState = {
  status: Status
  open: boolean
  step: StepId
  /** The furthest step opened, kept across starts as a hint for where to resume. */
  reached: StepId
  /** The setup is reading the computer to decide where to open; no step shows meanwhile. */
  resuming: boolean
  chosen: string[]
  go(step: StepId): void
  toggle(id: string): void
  later(): void
  finish(): void
  reopen(step?: StepId): void
  hide(): void
}

// Private windows, previews and some webviews refuse storage outright; the flow must still work for this session.
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {}
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  },
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      status: "new",
      open: true,
      step: "welcome",
      reached: "welcome",
      resuming: false,
      chosen: [],
      go: (step) => set((s) => ({ step, reached: furthest(s.reached, step), resuming: false })),
      toggle: (id) =>
        set((s) => ({ chosen: s.chosen.includes(id) ? s.chosen.filter((c) => c !== id) : [...s.chosen, id] })),
      later: () => set((s) => ({ status: s.status === "done" ? "done" : "later", open: false, resuming: false })),
      finish: () => set({ status: "done", open: false, resuming: false }),
      reopen: (step) =>
        set((s) => ({
          open: true,
          step: step ?? s.step,
          reached: furthest(s.reached, step ?? s.step),
          resuming: false,
        })),
      hide: () => set({ open: false, resuming: false }),
    }),
    {
      name: "wirecat.onboarding",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ status: s.status, reached: s.reached }),
      merge: (persisted, current) => {
        const saved = persisted as { status?: Status; reached?: StepId } | undefined
        const status = saved?.status ?? "new"
        const reached = STEPS.find((s) => s === saved?.reached) ?? "welcome"
        // A setup not finished opens where the computer stands, not where it was left (`resume.ts`).
        return { ...current, status, reached, open: status === "new", resuming: status === "new" }
      },
    },
  ),
)
