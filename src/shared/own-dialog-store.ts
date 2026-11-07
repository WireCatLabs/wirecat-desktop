import { create } from "zustand"

/** `update` names an own tool already added: the dialog reads npm for its new version straight away. */
type OwnDialog = { open: boolean; update: { pkg: string; name: string } | null }

export const useOwnDialog = create<OwnDialog & { show(update?: OwnDialog["update"]): void; close(): void }>((set) => ({
  open: false,
  update: null,
  show: (update = null) => set({ open: true, update }),
  close: () => set({ open: false }),
}))
