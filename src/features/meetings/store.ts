import { create } from "zustand"
import { dayOf } from "@/domain/days"
import { safeStorage } from "@/shared/safe-storage"
import { PAGE_SIZES } from "@/ui/Pager"

export type View = "table" | "week" | "month"

const VIEW_KEY = "wirecat.meetings.view"
const savedView = (): View => {
  const v = safeStorage.getItem(VIEW_KEY)
  return v === "table" || v === "month" ? v : "week"
}

/** How long typing pauses before the search reads memo: each read is a memo process. */
const TYPING_MS = 300

type State = {
  view: View
  /** A day of the week or month on screen; kept for the session, so Back returns to the same week. */
  anchor: string
  /** What the search field shows, and what memo was asked once typing paused. */
  query: string
  asked: string
  page: number
  size: number
  setView(view: View): void
  setAnchor(day: string): void
  type(query: string): void
  setQuery(query: string): void
  setPage(page: number): void
  setSize(size: number): void
}

let typing: ReturnType<typeof setTimeout> | undefined

export const useMeetings = create<State>()((set) => ({
  view: savedView(),
  anchor: dayOf(new Date()),
  query: "",
  asked: "",
  page: 1,
  size: PAGE_SIZES[0],
  setView(view) {
    safeStorage.setItem(VIEW_KEY, view)
    set({ view })
  },
  setAnchor: (anchor) => set({ anchor }),
  type(query) {
    set({ query })
    clearTimeout(typing)
    // A field still waiting for its value ("person:") would ask memo for nothing and empty the page meanwhile.
    if (/(^|\s)-?[a-z_]+:$/i.test(query.trim())) return
    typing = setTimeout(() => set({ asked: query.trim(), page: 1 }), TYPING_MS)
  },
  setQuery(query) {
    clearTimeout(typing)
    set({ query, asked: query.trim(), page: 1 })
  },
  setPage: (page) => set({ page }),
  setSize: (size) => set({ size, page: 1 }),
}))
