import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Refusal } from "@/domain/base-stages"
import { accountKey, type Kind } from "@/domain/clients"
import type { CrmAccount } from "@/platform/bindings"
import { safeStorage } from "@/shared/safe-storage"

export type View = "table" | "board"

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
  /** The CRM account (`accountKey`) the stage mapping dialog is open on; `""` opens it on the CRM that needs it most. */
  mapOn: string | null
  view: View
  /** The kind and CRM (`kind:accountKey`) whose stage dialog has opened by itself once; it never does so again. */
  prompted: string[]
  /** The table's page, from 1; a new filter or kind starts again at 1. */
  page: number
  pageSize: number
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
  openMap(account: string | null): void
  setView(view: View): void
  setPage(page: number): void
  setPageSize(size: number): void
  /** Marks these `kind:accountKey`s as prompted and opens the dialog on the first one's CRM. */
  prompt(keys: string[]): void
  setPipelines(pipelines: string[]): void
  setAccounts(accounts: string[]): void
  refuse(ref: string, why: Refusal | null): void
  pick(picking: Picking | null): void
  remember(key: string, stage: string): void
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
      mapOn: null,
      view: "table",
      page: 1,
      pageSize: 50,
      prompted: [],
      refused: {},
      pipelines: [],
      accounts: [],
      chosen: {},
      picking: null,
      writers: {},
      asking: null,
      ask: (asking) => set({ asking }),
      write: (account, profile) => set((s) => ({ writers: { ...s.writers, [accountKey(account)]: profile } })),
      setKind: (kind) => set({ kind, query: "", pipelines: [], accounts: [], refused: {}, page: 1 }),
      openMap: (mapOn) => set({ mapOn }),
      setView: (view) => set({ view }),
      setPage: (page) => set({ page }),
      setPageSize: (pageSize) => set({ pageSize, page: 1 }),
      prompt: (keys) =>
        set((st) => ({ prompted: [...st.prompted, ...keys], mapOn: keys[0]?.slice(keys[0].indexOf(":") + 1) ?? null })),
      setPipelines: (pipelines) => set({ pipelines, page: 1 }),
      setAccounts: (accounts) => set({ accounts, page: 1 }),
      refuse: (ref, why) =>
        set((s) => {
          const { [ref]: _, ...rest } = s.refused
          return { refused: why === null ? rest : { ...rest, [ref]: why } }
        }),
      pick: (picking) => set({ picking }),
      remember: (key, stage) => set((s) => ({ chosen: { ...s.chosen, [key]: stage } })),
      setQuery: (query) => set({ query, page: 1 }),
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
      partialize: (s) => ({
        kind: s.kind,
        pipeline: s.pipeline,
        view: s.view,
        pageSize: s.pageSize,
        prompted: s.prompted,
      }),
      // Version 0 remembered the board or the stage mapping view; the table came after, and the owner asked for it.
      version: 1,
      migrate: (kept) => ({ ...(kept as object), view: "table" }),
    },
  ),
)
