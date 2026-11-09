import { create } from "zustand"

/** Tools whose `store recover` last reported damage, so the Tools page can say so above the list. */
export const useStoreDamage = create<{ damaged: string[]; mark(tool: string, damaged: boolean): void }>((set) => ({
  damaged: [],
  mark: (tool, damaged) =>
    set((s) => ({ damaged: damaged ? [...new Set([...s.damaged, tool])] : s.damaged.filter((t) => t !== tool) })),
}))
