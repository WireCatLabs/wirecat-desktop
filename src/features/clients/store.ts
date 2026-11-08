import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Kind } from "@/domain/clients"
import { safeStorage } from "@/shared/safe-storage"

type ClientsState = {
  kind: Kind
  /** The pipeline last chosen for each kind; memo's first when none was. */
  pipeline: Partial<Record<Kind, string>>
  /** The filter words; the page narrows the read it holds, memo is not asked again. */
  query: string
  /** The card whose details are open. */
  open: string | null
  /** Why memo or the CRM refused a move, by card, until the next move of that card. */
  failed: Record<string, string>
  setKind(kind: Kind): void
  choose(kind: Kind, pipeline: string): void
  setQuery(query: string): void
  setOpen(ref: string | null): void
  fail(ref: string, reason: string | null): void
}

export const useClients = create<ClientsState>()(
  persist(
    (set) => ({
      kind: "deal",
      pipeline: {},
      query: "",
      open: null,
      failed: {},
      setKind: (kind) => set({ kind, query: "" }),
      choose: (kind, pipeline) => set((s) => ({ pipeline: { ...s.pipeline, [kind]: pipeline }, query: "" })),
      setQuery: (query) => set({ query }),
      setOpen: (open) => set({ open }),
      fail: (ref, reason) =>
        set((s) => {
          const { [ref]: _, ...rest } = s.failed
          return { failed: reason === null ? rest : { ...rest, [ref]: reason } }
        }),
    }),
    {
      name: "wirecat.clients",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ kind: s.kind, pipeline: s.pipeline }),
    },
  ),
)
