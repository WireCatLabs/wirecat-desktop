import { create } from "zustand"

/** Which of the guides the owner's tools can run sits in "Start here": the first, or the one Next guide moved to. */
export const useGuideStart = create<{ shift: number; next(): void }>((set) => ({
  shift: 0,
  next: () => set((s) => ({ shift: s.shift + 1 })),
}))
