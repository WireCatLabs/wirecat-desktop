import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { withBaseMove, withMapping } from "@/domain/base-stages"
import { type Kind, withMove } from "@/domain/clients"
import type { CrmAccount, CrmBaseEdit, CrmBaseRef, CrmRead } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"
import { useClients } from "./store"

export type Ready = Extract<CrmRead, { kind: "ready" }>
export type Based = Extract<CrmRead, { kind: "base" }>

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const clientKeys = {
  all: ["clients"] as const,
  board: (kind: Kind, pipeline: string | null) => ["clients", kind, pipeline] as const,
  scope: (account: CrmAccount) => ["clients", "scope", account.provider, account.account] as const,
}

export const useBoard = (kind: Kind, pipeline: string | null) =>
  // Another pipeline or kind keeps the board on screen until its own answer comes, never a skeleton of other columns.
  useQuery({
    queryKey: clientKeys.board(kind, pipeline),
    queryFn: () => platform.clientsRead(kind, pipeline),
    placeholderData: keepPreviousData,
  })

/** Every board the page read, so a move or a new scope is read again from memo. */
export const readAgain = () => queryClient().invalidateQueries({ queryKey: clientKeys.all })

/**
 * The card moves at once; memo (and, once it can, the CRM's own tool) writes it. A refusal puts it back and says why on
 * the card. Counts and sums are read again either way: they are memo's, never the page's.
 */
export function useMove(kind: Kind, pipeline: string | null) {
  const key = clientKeys.board(kind, pipeline)
  return useMutation({
    mutationFn: ({ ref, stage }: { ref: string; stage: string }) => platform.clientsMove(kind, ref, stage),
    onMutate: async ({ ref, stage }) => {
      useClients.getState().fail(ref, null)
      useClients.getState().refuse(ref, null)
      await queryClient().cancelQueries({ queryKey: key })
      const before = queryClient().getQueryData<CrmRead>(key)
      if (before?.kind === "ready") queryClient().setQueryData<Ready>(key, withMove(before, ref, stage))
      if (before?.kind === "base") queryClient().setQueryData<Based>(key, withBaseMove(before, ref, stage))
      return { before }
    },
    onError: (e, { ref }, context) => {
      if (context?.before) queryClient().setQueryData(key, context.before)
      useClients.getState().fail(ref, message(e))
    },
    onSettled: () => queryClient().invalidateQueries({ queryKey: key }),
  })
}

export const useScope = (account: CrmAccount | null) =>
  useQuery({
    queryKey: account ? clientKeys.scope(account) : ["clients", "scope", "own"],
    queryFn: () => (account ? platform.clientsScope(account) : null),
    enabled: account !== null,
  })

export function useScopeSet(account: CrmAccount | null) {
  return useMutation({
    mutationFn: (scope: "mine" | "all") =>
      account ? platform.clientsScopeSet(account, scope) : Promise.reject(new Error("no CRM account")),
    // The saved scope and the sync it starts change what memo holds: the board and the applied scope are read again.
    onSettled: () => readAgain(),
  })
}

/** A pipeline's stage onto a base stage; it moves at once and goes back if memo refuses. */
export function useMapSet(kind: Kind, pipeline: string | null) {
  const key = clientKeys.board(kind, pipeline)
  return useMutation({
    mutationFn: ({ stage, base }: { stage: string; base: CrmBaseRef }) => platform.clientsMapSet(stage, base.ref),
    onMutate: async ({ stage, base }) => {
      await queryClient().cancelQueries({ queryKey: key })
      const before = queryClient().getQueryData<CrmRead>(key)
      if (before?.kind === "base") {
        queryClient().setQueryData<Based>(key, { ...before, mapping: withMapping(before.mapping, stage, base) })
      }
      return { before }
    },
    onError: (_e, _v, context) => {
      if (context?.before) queryClient().setQueryData(key, context.before)
    },
    // Counts per base column change with the mapping: memo counts them again.
    onSettled: () => queryClient().invalidateQueries({ queryKey: key }),
  })
}

export function useConfirm(kind: Kind, pipeline: string | null) {
  return useMutation({
    mutationFn: (pipeline: string | null) => platform.clientsMapConfirm(kind, pipeline),
    onSettled: () => queryClient().invalidateQueries({ queryKey: clientKeys.board(kind, pipeline) }),
  })
}

export function useBaseEdit(kind: Kind, pipeline: string | null) {
  return useMutation({
    mutationFn: (edit: CrmBaseEdit) => platform.clientsBaseEdit(kind, edit),
    onSettled: () => queryClient().invalidateQueries({ queryKey: clientKeys.board(kind, pipeline) }),
  })
}
