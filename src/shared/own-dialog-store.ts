import { create } from "zustand"

/**
 * `update` names an own tool already added: the dialog reads npm for its new version straight away. `read` is a name
 * to read on open as if typed, for the browser build's `?own-review=<package>`.
 */
type OwnDialog = { open: boolean; update: { pkg: string; name: string } | null; read: string | null }

export const useOwnDialog = create<
  OwnDialog & { show(update?: OwnDialog["update"], read?: string | null): void; close(): void }
>((set) => ({
  open: false,
  update: null,
  read: null,
  show: (update = null, read = null) => set({ open: true, update, read }),
  close: () => set({ open: false }),
}))
