import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { platform } from "@/platform/bridge"
import type { Notification } from "@/platform/notifications-schemas"
import { safeStorage } from "../onboarding/store"

export const CHECK_EVERY_MS = 60 * 60 * 1000

type NotificationsState = {
  /** The last list the server sent, kept so the bell still works offline. */
  items: Notification[]
  read: string[]
  dismissed: string[]
  /** The server answered at least once since the app started. */
  checked: boolean
  failed: boolean
  open: boolean
  /** What was unread when the panel opened: it keeps its "new" look until the panel closes. */
  fresh: string[]
  check(): Promise<void>
  show(): void
  close(): void
  toggle(): void
  dismiss(id: string): void
}

export const visible = (s: Pick<NotificationsState, "items" | "dismissed">, now = Date.now()) =>
  s.items.filter((n) => !s.dismissed.includes(n.id) && (!n.expiresAt || Date.parse(n.expiresAt) > now))

export const unread = (s: Pick<NotificationsState, "items" | "dismissed" | "read">, now = Date.now()) =>
  visible(s, now).filter((n) => !s.read.includes(n.id))

let checking = false

export const useNotifications = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      read: [],
      dismissed: [],
      checked: false,
      failed: false,
      open: false,
      fresh: [],

      async check() {
        if (checking) return
        checking = true
        try {
          const items = await platform.notifications()
          // Ids the server no longer sends are forgotten, so the stored lists stay as short as the feed.
          const ids = new Set(items.map((n) => n.id))
          set((s) => ({
            items,
            read: s.read.filter((id) => ids.has(id)),
            dismissed: s.dismissed.filter((id) => ids.has(id)),
            checked: true,
            failed: false,
          }))
        } catch {
          // Offline or the server down: the bell keeps the last list and the next hourly check tries again.
          set({ failed: true })
        } finally {
          checking = false
        }
      },

      show() {
        const fresh = unread(get()).map((n) => n.id)
        set((s) => ({ open: true, fresh, read: [...new Set([...s.read, ...fresh])] }))
      },
      close: () => set({ open: false, fresh: [] }),
      toggle: () => (get().open ? get().close() : get().show()),
      dismiss: (id) => set((s) => ({ dismissed: [...new Set([...s.dismissed, id])] })),
    }),
    {
      name: "wirecat.notifications",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ items: s.items, read: s.read, dismissed: s.dismissed }),
    },
  ),
)
