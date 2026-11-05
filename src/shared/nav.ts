import { create } from "zustand"

/** The page the app opens on and falls back to, such as after the setup. */
export const HOME_SECTION = "tools"

type Nav = {
  /** The section on screen, so one page can send the owner to another (Agents → Logs for a session). */
  active: string
  past: string[]
  next: string[]
  go(section: string): void
  back(): void
  forward(): void
}

// An in-memory stack, not window.history: the webview may map mouse buttons to its own history, and the mock's
// `?state=` query must stay as loaded.
export const useNav = create<Nav>((set) => ({
  active:
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add") ? "memory" : HOME_SECTION,
  past: [],
  next: [],
  go: (section) => set((s) => (section === s.active ? s : { active: section, past: [...s.past, s.active], next: [] })),
  back: () =>
    set((s) => {
      const to = s.past.at(-1)
      return to === undefined ? s : { active: to, past: s.past.slice(0, -1), next: [s.active, ...s.next] }
    }),
  forward: () =>
    set((s) => {
      const [to, ...rest] = s.next
      return to === undefined ? s : { active: to, past: [...s.past, s.active], next: rest }
    }),
}))

let surfaceName: () => string | null = () => null

/** A surface that covers the sections (the first-run setup) names itself here, so a report says where the owner was. */
export const nameCoveringSurface = (name: () => string | null) => {
  surfaceName = name
}

export function currentPageName() {
  const covering = surfaceName()
  if (covering) return covering
  const id = useNav.getState().active
  return id.charAt(0).toUpperCase() + id.slice(1)
}
