import { create } from "zustand"

/**
 * `update` names an own tool already added: the dialog reads npm for its new version straight away. `read` is a name
 * to read on open as if typed, for the browser build's `?own-review=<package>`.
 */
type OwnDialog = {
  open: boolean
  update: { pkg: string; name: string } | null
  read: string | null
  /** The own tool just removed from WireCat: its row is gone, so the Tools page says what happened and what stays. */
  removed: { name: string; pkg: string; installed: boolean } | null
}

export const useOwnDialog = create<
  OwnDialog & {
    show(update?: OwnDialog["update"], read?: string | null): void
    close(): void
    removedOne(removed: OwnDialog["removed"]): void
  }
>((set) => ({
  open: false,
  update: null,
  read: null,
  removed: null,
  removedOne: (removed) => set({ removed }),
  show: (update = null, read = null) => set({ open: true, update, read }),
  close: () => set({ open: false }),
}))
