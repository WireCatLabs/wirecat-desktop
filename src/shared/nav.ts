import { create } from "zustand"
import { safeStorage } from "@/shared/safe-storage"

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
const PAGE_KEY = "wirecat.page"

// A restart or the next launch opens the page the owner was on; without storage (a private window) the app opens Tools.
const savedPage = () => safeStorage.getItem(PAGE_KEY)

const firstPage = () => {
  if (typeof window === "undefined") return HOME_SECTION
  if (new URLSearchParams(window.location.search).has("add")) return "memory"
  return savedPage() ?? HOME_SECTION
}

export const useNav = create<Nav>((set) => ({
  active: firstPage(),
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

// A page a link opened shows that one link; the next launch opens where the owner was before it.
const PASSING = new Set(["open", "conversation"])

useNav.subscribe((s, before) => {
  if (s.active === before.active || PASSING.has(s.active)) return
  safeStorage.setItem(PAGE_KEY, s.active)
})

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
