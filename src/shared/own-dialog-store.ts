import { create } from "zustand"

/**
 * `update` names an own tool already added: the dialog reads npm for its new version straight away. `read` is a name
 * to read on open as if typed, for the browser build's `?own-review=<package>`.
 */
type OwnDialog = {
  open: boolean
  update: { pkg: string; name: string } | null
  read: string | null
  /** "Allow tools WireCat has not checked" is off: a name outside @wirecat gets that setting's warning first. */
  allow: boolean
  /** The own tool just removed from WireCat: its row is gone, so the Tools page says what happened and what stays. */
  removed: { name: string; pkg: string; installed: boolean } | null
}

export const useOwnDialog = create<
  OwnDialog & {
    show(update?: OwnDialog["update"], read?: string | null, allow?: boolean): void
    close(): void
    removedOne(removed: OwnDialog["removed"]): void
  }
>((set) => ({
  open: false,
  update: null,
  read: null,
  allow: false,
  removed: null,
  removedOne: (removed) => set({ removed }),
  show: (update = null, read = null, allow = false) => set({ open: true, update, read, allow }),
  close: () => set({ open: false }),
}))
