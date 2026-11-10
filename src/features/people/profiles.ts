import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { PersonProfile } from "@/platform/person-profile-schemas"

export type ProfileRead =
  | { state: "loading" }
  | { state: "ready"; profile: PersonProfile }
  | { state: "failed"; error: string }

type ProfilesState = {
  profiles: Record<string, ProfileRead>
  load(ref: string): Promise<void>
  /** A closed dialog drops what it read: the next one reads people as they are after any join. */
  clear(): void
}

/**
 * The match dialog's profiles, apart from the People store: a decision there re-reads and drops the people it touched,
 * and the dialog keeps showing what the owner compared (rule 9).
 */
export const useProfiles = create<ProfilesState>((set, get) => {
  let generation = 0
  const put = (asked: number, ref: string, read: ProfileRead) => {
    if (asked === generation) set((s) => ({ profiles: { ...s.profiles, [ref]: read } }))
  }
  return {
    profiles: {},
    async load(ref) {
      const had = get().profiles[ref]
      if (had && had.state !== "failed") return
      const asked = generation
      put(asked, ref, { state: "loading" })
      try {
        put(asked, ref, { state: "ready", profile: await platform.peopleProfile(ref) })
      } catch (e) {
        put(asked, ref, { state: "failed", error: e instanceof Error ? e.message : String(e) })
      }
    },
    clear() {
      generation++
      set({ profiles: {} })
    },
  }
})
