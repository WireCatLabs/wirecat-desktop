import { create } from "zustand"

/** Bumped when the tool list changes while the app runs, so pages that list tools render it again. */
export const useCatalog = create<{ version: number; changed(): void }>((set) => ({
  version: 0,
  changed: () => set((s) => ({ version: s.version + 1 })),
}))
