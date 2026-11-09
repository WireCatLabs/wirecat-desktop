import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Refusal } from "@/domain/base-stages"
import { accountKey, type Kind } from "@/domain/clients"
import type { CrmAccount } from "@/platform/bindings"
import { safeStorage } from "@/shared/safe-storage"

export type View = "board" | "stages"

/** A drop onto a base column that holds several stages of the card's pipeline: the owner picks one. */
export type Picking = { ref: string; pipeline: string; base: string; stages: string[] }

/** memo names no profile of the CRM's CLI for the account: the owner picks one, then the waiting move runs. */
export type Asking = {
  account: CrmAccount
  profiles: string[]
  why: string | null
  /** `sent` is the stage's CRM id when memo lists it. */
  move: { ref: string; stage: string; sent: string | null } | null
}

type ClientsState = {
  kind: Kind
  /** The base board, or the mapping of every pipeline's stages onto the base set. */
  view: View
  /** The pipeline last chosen for each kind; memo's first when none was. */
  pipeline: Partial<Record<Kind, string>>
  /** The filter words; the page narrows the read it holds, memo is not asked again. */
  query: string
  /** The card whose details are open. */
  open: string | null
  /** Why memo or the CRM refused a move, by card, until the next move of that card. */
  failed: Record<string, string>
  /** Why a drop was refused on the base board, by card, until the card moves. */
  refused: Record<string, Refusal>
  /** The base board's narrowing: these pipelines and accounts only; empty shows every one. */
  pipelines: string[]
  accounts: string[]
  /** The stage last picked for a pipeline and base stage (`choiceKey`), for this session only. */
  chosen: Record<string, string>
  picking: Picking | null
  /** The profile of a CRM's CLI the owner chose, by `accountKey`, for this session only. */
  writers: Record<string, string>
  asking: Asking | null
  ask(asking: Asking | null): void
  write(account: CrmAccount, profile: string): void
  setKind(kind: Kind): void
  setView(view: View): void
  setPipelines(pipelines: string[]): void
  setAccounts(accounts: string[]): void
  refuse(ref: string, why: Refusal | null): void
  pick(picking: Picking | null): void
  remember(key: string, stage: string): void
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
      view: "board",
      refused: {},
      pipelines: [],
      accounts: [],
      chosen: {},
      picking: null,
      writers: {},
      asking: null,
      ask: (asking) => set({ asking }),
      write: (account, profile) => set((s) => ({ writers: { ...s.writers, [accountKey(account)]: profile } })),
      setKind: (kind) => set({ kind, query: "", pipelines: [], accounts: [], refused: {} }),
      setView: (view) => set({ view }),
      setPipelines: (pipelines) => set({ pipelines }),
      setAccounts: (accounts) => set({ accounts }),
      refuse: (ref, why) =>
        set((s) => {
          const { [ref]: _, ...rest } = s.refused
          return { refused: why === null ? rest : { ...rest, [ref]: why } }
        }),
      pick: (picking) => set({ picking }),
      remember: (key, stage) => set((s) => ({ chosen: { ...s.chosen, [key]: stage } })),
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
      partialize: (s) => ({ kind: s.kind, pipeline: s.pipeline, view: s.view }),
    },
  ),
)
