import { create } from "zustand"

/**
 * `update` names an own tool already added: the dialog reads npm for its new version straight away. Only an installed
 * one may skip the review, when the new version asks for nothing new.
 */
type OwnDialog = { open: boolean; update: { pkg: string; name: string; installed: boolean } | null }

export const useOwnDialog = create<OwnDialog & { show(update?: OwnDialog["update"]): void; close(): void }>((set) => ({
  open: false,
  update: null,
  show: (update = null) => set({ open: true, update }),
  close: () => set({ open: false }),
}))
