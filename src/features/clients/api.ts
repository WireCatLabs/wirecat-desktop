import { keepPreviousData, useIsMutating, useMutation, useQuery } from "@tanstack/react-query"
import { withBaseMove, withMapping } from "@/domain/base-stages"
import { crmToolOf, findTool } from "@/domain/catalog"
import { accountKey, type Kind, writerProfile } from "@/domain/clients"
import { useSync } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { CrmAccount, CrmBaseEdit, CrmBaseRef, CrmCard, CrmPipeline, CrmRead, CrmVia } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"
import { stageMessages } from "./messages-stages"
import { useClients } from "./store"

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
    queryFn: () => platform.clientsRead(kind),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

/**
 * A stage's name as shown. cli-core makes memo's default set once, in the language of the owner's messages; a base set
 * holding at least three default names of one language is taken for it, and its default names show in the interface's
 * language. An adopted set (its own names, perhaps a Won and a Lost) and a CRM's stage (`crm`) stay as they are.
 * Labels only: a move, a rename and a filter keep memo's own name.
 */
export function useStageName(kind: Kind) {
  const here = useMessages(stageMessages).defaults
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const { data } = useBoard(kind, pipeline)
  const sets = Object.values(stageMessages).map((w) => w.defaults)
  const base = data?.kind === "base" ? data.base.map((b) => b.name) : []
  const made = sets.find((set) => base.filter((name) => set[kind].includes(name)).length >= 3)
  return {
    stage: (name: string, crm = false) => {
      const at = crm || !made ? -1 : made[kind].indexOf(name)
      return at >= 0 ? (here[kind][at] ?? name) : name
    },
    pipeline: (name: string, crm = false) => (!crm && sets.some((set) => set.set === name) ? here.set : name),
  }
}

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
    mutationFn: (scope: "mine") =>
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
/** memo's store takes one write at a time: the map writes wait in line, and the owner never waits for the button. */
const MAP_WRITES = { id: "clients-map" }
const MAP_CONFIRM = "confirm"
const mapWritesLeft = () => queryClient().isMutating({ mutationKey: [MAP_WRITES.id] })
/** Every kind's board: the line of writes is shared, so the last write may be another kind's. */
const refreshAfterMapWrite = () =>
  mapWritesLeft() <= 1 ? queryClient().invalidateQueries({ queryKey: clientKeys.all }) : undefined

export function useMapSet(kind: Kind, pipeline: string | null) {
  const key = clientKeys.board(kind, pipeline)
  return useMutation({
    mutationKey: [MAP_WRITES.id],
    scope: MAP_WRITES,
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
    // Counts per base column change with the mapping: memo counts them again once the line is empty, so a read that
    // ends between two writes never puts back a stage the owner has already moved.
    onSettled: refreshAfterMapWrite,
  })
}

/** memo's suggestions confirmed pipeline by pipeline: one CRM's only, and one write at a time, as memo's store allows. */
export function useConfirm(kind: Kind) {
  return useMutation({
    mutationKey: [MAP_WRITES.id, MAP_CONFIRM],
    scope: MAP_WRITES,
    mutationFn: async (pipelines: readonly string[]) => {
      for (const p of pipelines) await platform.clientsMapConfirm(kind, p)
    },
    onSettled: refreshAfterMapWrite,
  })
}

/** Only on the owner's click: the AI model's places land as suggestions, which the owner then confirms or moves. */
export function useSuggest(kind: Kind) {
  return useMutation({
    mutationKey: [MAP_WRITES.id],
    scope: MAP_WRITES,
    mutationFn: () => platform.clientsMapSuggest(kind),
    onSettled: refreshAfterMapWrite,
  })
}

/** Confirming runs from the dialog and from the page's notice: either one makes the other wait. */
export const useConfirming = () => useIsMutating({ mutationKey: [MAP_WRITES.id, MAP_CONFIRM] }) > 0

export function useBaseEdit(kind: Kind, pipeline: string | null) {
  return useMutation({
    mutationFn: (edit: CrmBaseEdit) => platform.clientsBaseEdit(kind, edit),
    onSettled: () => queryClient().invalidateQueries({ queryKey: clientKeys.board(kind, pipeline) }),
  })
}
