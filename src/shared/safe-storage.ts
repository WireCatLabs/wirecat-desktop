import type { StateStorage } from "zustand/middleware"

// Private windows, previews and some webviews refuse storage outright; the flow must still work for this session.
export const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {}
  },
  removeItem: (name: string) => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  },
} satisfies StateStorage
