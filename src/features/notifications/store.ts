import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { platform } from "@/platform/bridge"
import type { Notification } from "@/platform/notifications-schemas"
import { safeStorage } from "@/shared/safe-storage"

export const CHECK_EVERY_MS = 60 * 60 * 1000

/** A digest that arrived on this computer: its Open reads it (owner, NEED-32 A). Never sent by the server. */
export type DigestNotice = { id: string; severity: "digest"; date: string; title: string; body: string; at: string }

const KEEP_DIGESTS = 10

type NotificationsState = {
  /** The last list the server sent, kept so the bell still works offline. */
  items: Notification[]
  /** The last digests that arrived, newest first. */
  digests: DigestNotice[]
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
  /** `stamp` is memo's run stamp, one per digest written; `at` is when WireCat saw it arrive. */
  addDigest(notice: { date: string; stamp: string; title: string; body: string }): void
}

export const visible = (s: Pick<NotificationsState, "items" | "dismissed">, now = Date.now()) =>
  s.items.filter((n) => !s.dismissed.includes(n.id) && (!n.expiresAt || Date.parse(n.expiresAt) > now))

export const visibleDigests = (s: Pick<NotificationsState, "dismissed"> & { digests?: DigestNotice[] }) =>
  (s.digests ?? []).filter((n) => !s.dismissed.includes(n.id))

export const unread = (
  s: Pick<NotificationsState, "items" | "dismissed" | "read"> & { digests?: DigestNotice[] },
  now = Date.now(),
): (Notification | DigestNotice)[] => [...visibleDigests(s), ...visible(s, now)].filter((n) => !s.read.includes(n.id))

let checking = false

export const useNotifications = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      digests: [],
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
          // Ids the server no longer sends are forgotten, so the stored lists stay as short as the feed; a digest's
          // id is this computer's own and stays while the digest is kept.
          const ids = new Set([...items.map((n) => n.id), ...get().digests.map((n) => n.id)])
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
      addDigest: ({ date, stamp, title, body }) =>
        set((s) => {
          const id = `digest:${stamp}`
          if (s.digests.some((n) => n.id === id)) return s
          const notice: DigestNotice = { id, severity: "digest", date, title, body, at: new Date().toISOString() }
          const digests = [notice, ...s.digests].slice(0, KEEP_DIGESTS)
          const kept = new Set([...s.items.map((n) => n.id), ...digests.map((n) => n.id)])
          return { digests, read: s.read.filter((x) => kept.has(x)), dismissed: s.dismissed.filter((x) => kept.has(x)) }
        }),
    }),
    {
      name: "wirecat.notifications",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ items: s.items, digests: s.digests, read: s.read, dismissed: s.dismissed }),
    },
  ),
)

/** Keeps the dock's badge on the app icon equal to the bell's unread count; returns the function that stops it. */
export function followDockBadge() {
  let sent: number | undefined
  const send = (s: NotificationsState) => {
    const count = unread(s).length
    if (count === sent) return
    sent = count
    // A dock that cannot be told only misses a number; Rust logs why.
    platform.dockBadge(count).catch(() => {})
  }
  send(useNotifications.getState())
  return useNotifications.subscribe(send)
}
