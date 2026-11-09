import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { withBaseMove, withMapping } from "@/domain/base-stages"
import { crmToolOf, findTool } from "@/domain/catalog"
import { accountKey, type Kind, withMove, writerProfile } from "@/domain/clients"
import { useSync } from "@/features/tools"
import type { CrmAccount, CrmBaseEdit, CrmBaseRef, CrmCard, CrmPipeline, CrmRead, CrmVia } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"
import { useClients } from "./store"

export type Ready = Extract<CrmRead, { kind: "ready" }>
export type Based = Extract<CrmRead, { kind: "base" }>

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const clientKeys = {
  all: ["clients"] as const,
  board: (kind: Kind, pipeline: string | null) => ["clients", kind, pipeline] as const,
  scope: (account: CrmAccount, profile: string | null) =>
    ["clients", "scope", account.provider, account.account, profile] as const,
}

export const useBoard = (kind: Kind, pipeline: string | null) =>
  // Another pipeline or kind keeps the board on screen until its own answer comes, never a skeleton of other columns.
  // A read is six memo processes; a page opened again within a minute shows the last answer instead of waiting.
  useQuery({
    queryKey: clientKeys.board(kind, pipeline),
    queryFn: () => platform.clientsRead(kind, pipeline),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

/** Every board the page read, so a move or a new scope is read again from memo. */
export const readAgain = () => queryClient().invalidateQueries({ queryKey: clientKeys.all })

// A CRM's sync may end on the Tools page, while the board kept above is still fresh.
useSync.subscribe((s, before) => {
  const ended = Object.entries(s.runs).some(
    ([key, run]) =>
      run.phase === "done" && before.runs[key]?.phase !== "done" && findTool(key.split(":")[0] ?? "")?.crm,
  )
  if (ended) void readAgain()
})

/**
 * The card moves at once; memo writes the owner's own, the CRM's own CLI a CRM's copy. A refusal puts it back and says
 * why on the card. Counts and sums are read again either way: they are memo's, never the page's.
 */
export function useMove(kind: Kind, pipeline: string | null) {
  const key = clientKeys.board(kind, pipeline)
  return useMutation({
    // `stage` is the name the board shows; a CRM's CLI gets the stage's own id when memo lists it (`sent`).
    mutationFn: ({ ref, stage, sent, via }: { ref: string; stage: string; sent?: string | null; via: CrmVia | null }) =>
      platform.clientsMove(kind, ref, via ? (sent ?? stage) : stage, via),
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

/** The profile that writes this account's cards: memo's one, or the owner's choice of this session. */
export function useWriter(account: CrmAccount | null, pipelines: readonly CrmPipeline[]) {
  const chosen = useClients((s) => (account ? s.writers[accountKey(account)] : undefined))
  const writesWith =
    pipelines.find((p) => p.writesWith && account && accountKey(p.account) === accountKey(account))?.writesWith ?? null
  return { writesWith, profile: writerProfile(writesWith, chosen) }
}

/**
 * What a drop asks for: memo moves the owner's own card; a CRM's goes through its CLI as the profile memo names or
 * the owner chose. With neither, nothing is written: the card stays and the owner is asked which profile. `idOf`
 * gives a stage's CRM id, which the CLI matches before any name: names may repeat within a pipeline.
 */
export function useCardMove(
  kind: Kind,
  pipeline: string | null,
  pipelines: readonly CrmPipeline[],
  idOf: (pipeline: string, stage: string) => string | null,
) {
  const move = useMove(kind, pipeline)
  const run = (card: CrmCard, stage: string) => {
    const account = pipelines.find((p) => p.ref === card.pipeline)?.account ?? null
    if (!account) return move.mutate({ ref: card.ref, stage, via: null })
    const writesWith = pipelines.find((p) => p.ref === card.pipeline)?.writesWith ?? null
    const profile = writerProfile(writesWith, useClients.getState().writers[accountKey(account)])
    const sent = idOf(card.pipeline, stage)
    if (profile) return move.mutate({ ref: card.ref, stage, sent, via: { account, profile } })
    useClients.getState().ask({
      account,
      profiles: writesWith?.profiles ?? [],
      why: writesWith?.why ?? null,
      move: { ref: card.ref, stage, sent },
    })
  }
  /** The owner picked a profile: it is remembered for the account, and the move that waited for it runs. */
  const chosen = (profile: string) => {
    const asked = useClients.getState().asking
    useClients.getState().ask(null)
    if (!asked) return
    useClients.getState().write(asked.account, profile)
    if (asked.move) move.mutate({ ...asked.move, via: { account: asked.account, profile } })
  }
  return { run, chosen }
}

export const useScope = (account: CrmAccount | null, profile: string | null) =>
  useQuery({
    queryKey: account ? clientKeys.scope(account, profile) : ["clients", "scope", "own"],
    queryFn: () => (account ? platform.clientsScope(account, profile) : null),
    enabled: account !== null,
  })

/** Saves the scope, then starts the account's sync through the Tools page's own runner, which shows its progress. */
export function useScopeSet(account: CrmAccount | null, profile: string | null) {
  return useMutation({
    mutationFn: (scope: "mine" | "all") =>
      account && profile
        ? platform.clientsScopeSet(account, profile, scope)
        : Promise.reject(new Error("no CRM account or profile")),
    onSuccess: () => {
      const tool = account && crmToolOf(account.provider)
      if (tool && profile) useSync.getState().start(tool.id, profile)
    },
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
