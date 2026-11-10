import { create } from "zustand"

type PicksState = {
  /** Per group of matches, the people the owner unticked; a new person starts ticked. */
  unticked: Record<string, string[]>
  set(group: string, ref: string, on: boolean): void
}

/** Who of a group the owner ticks, shared by its card and its dialog so both join the same people. */
export const usePicks = create<PicksState>((set) => ({
  unticked: {},
  set: (group, ref, on) =>
    set((s) => {
      const now = s.unticked[group] ?? []
      return { unticked: { ...s.unticked, [group]: on ? now.filter((x) => x !== ref) : [...now, ref] } }
    }),
}))

const NONE: string[] = []
export const useUnticked = (group: string) => usePicks((s) => s.unticked[group] ?? NONE)
