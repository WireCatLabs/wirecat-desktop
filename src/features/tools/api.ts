import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type { Enrichment, SearchHarder } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import type { Background, BackgroundAction } from "@/platform/sync-schemas"
import type { FunnelHelperStatus } from "@/platform/tailscale-schemas"
import type { EnrichmentChoice, HarderChoice } from "@/platform/types"
import { errorText } from "@/shared/errors"

export type { EnrichmentChoice }

import { profilesQuery, toolKeys } from "@/shared/query"

/** Re-reading is how the app learns that a sign-in finished: the terminal reports nothing back. */
export function useProfiles(id: string) {
  const q = useQuery(profilesQuery(id))
  return {
    /** undefined until the first answer; null for a tool without profiles. */
    profiles: q.data,
    error: q.error ? String(q.error) : null,
    loading: q.isFetching,
    reload: () => void q.refetch(),
  }
}

/**
 * Whether the tool's own `serve` runs for a profile; a failed check reads as "cannot say". It asks again when the window
 * regains focus, and every 5 s only while the server runs but has not reached the messenger yet.
 */
export function useBackground(id: string, profile: string) {
  const q = useQuery({
    queryKey: toolKeys.background(id, profile),
    queryFn: () => platform.backgroundStatus(id, profile),
    refetchInterval: (query) => {
      const s = query.state.data
      return s?.state === "running" && s.connected === false ? 5000 : false
    },
  })
  return {
    state: q.isError ? ({ state: "unknown" } satisfies Background) : (q.data ?? null),
    recheck: () => void q.refetch(),
  }
}

export function useRunBackground(id: string, profile: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: BackgroundAction) => platform.backgroundRun(id, profile, action),
    onSuccess: (outcome) => client.setQueryData(toolKeys.background(id, profile), outcome.state),
  })
}

/**
 * A profile's permissions, or the defaults when `profile` is null. A profile's own key hides the same key in the
 * defaults, so what removing it gives back is read separately. The last answer stays while another profile loads.
 */
export function usePermissions(id: string, profile: string | null) {
  return useQuery({
    queryKey: toolKeys.permissions(id, profile),
    queryFn: async () => {
      const [data, base] = await Promise.all([
        platform.permissionsShow(id, profile),
        profile === null ? null : platform.permissionsShow(id, null),
      ])
      return { data, defaults: base?.levels ?? null }
    },
    placeholderData: keepPreviousData,
  })
}

/** `level: null` removes the profile's (or the defaults') own key. */
export function useSetPermission(id: string, profile: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ key, level }: { key: string; level: string | null }) => {
      const setting = `permissions.${key}`
      return level === null
        ? platform.settingsUnset(id, profile, profile === null, setting)
        : platform.settingsSet(id, profile, profile === null, setting, level)
    },
    // The defaults show through in every profile, so each permissions answer of the tool is read again.
    onSettled: () => client.invalidateQueries({ queryKey: toolKeys.allPermissions(id) }),
  })
}

/** Whether memo has a hosted model rewrite records for search, and how far it got. */
export function useEnrichment(id: string) {
  return useQuery({ queryKey: toolKeys.enrichment(id), queryFn: () => platform.enrichmentStatus(id) })
}

/** What turning it on sends and costs. A mutation, not a query: it runs only when the owner opens the consent step. */
export function useEnrichmentPreview(id: string) {
  return useMutation({ mutationFn: (c: EnrichmentChoice) => platform.enrichmentPreview(id, c) })
}

/** `null` turns it off; a choice turns it on with that offer. */
export function useSetEnrichment(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (c: EnrichmentChoice | null) => (c ? platform.enrichmentOn(id, c) : platform.enrichmentOff(id)),
    onSuccess: (status) =>
      client.setQueryData(toolKeys.enrichment(id), { state: "ready", status } satisfies Enrichment),
  })
}

export type EnrichmentKeyChange = { provider: string; key: string } | { provider: string; remove: true }

/** Saves or removes the provider key through memo; the key is in the request only, never kept here. */
export function useEnrichmentKey(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (change: EnrichmentKeyChange) =>
      "key" in change
        ? platform.enrichmentKeySet(id, change.provider, change.key)
        : platform.enrichmentKeyRemove(id, change.provider),
    onSuccess: (status) => {
      client.setQueryData(toolKeys.enrichment(id), { state: "ready", status } satisfies Enrichment)
      // The same key serves search harder.
      client.invalidateQueries({ queryKey: toolKeys.searchHarder(id) })
    },
  })
}

/** Whether memo may have a hosted model reorder one search's first hits, and which model. */
export function useSearchHarder(id: string, enabled = true) {
  return useQuery({
    queryKey: toolKeys.searchHarder(id),
    queryFn: () => platform.searchHarderStatus(id),
    enabled,
  })
}

/** Where allowing it sends a search and what it sends. A mutation: it runs only while the consent step is open. */
export function useSearchHarderPreview(id: string) {
  return useMutation({ mutationFn: (c: HarderChoice) => platform.searchHarderPreview(id, c) })
}

/** `null` revokes; a choice allows it with that provider, model and address. */
export function useSetSearchHarder(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (c: HarderChoice | null) => (c ? platform.searchHarderOn(id, c) : platform.searchHarderOff(id)),
    onSuccess: (status) =>
      client.setQueryData(toolKeys.searchHarder(id), { state: "ready", status } satisfies SearchHarder),
  })
}

const statusKeys = {
  tailscale: ["status", "tailscale"] as const,
  cloudflare: ["status", "cloudflare"] as const,
  funnelHelper: ["status", "funnelHelper"] as const,
}

/**
 * A guide's view of a program on this computer, read while `active`, again when the window regains focus (the owner
 * installs, logs in or approves in another window), and every `every` ms while given. A read still running is shared,
 * so a Check or a poll never starts a second run of the program.
 */
function useStatus<T>(queryKey: readonly string[], read: () => Promise<T>, active: boolean, every: number | false) {
  const q = useQuery({
    queryKey,
    queryFn: read,
    enabled: active,
    refetchOnWindowFocus: true,
    refetchInterval: every,
    // A poll that starts reads at once only when the last answer is older than one round; a read started now could
    // land after the answer the owner's own action just set.
    staleTime: every || 0,
  })
  const { refetch } = q
  const check = useCallback(async () => {
    await refetch({ cancelRefetch: false })
  }, [refetch])
  return { q, check }
}

export function useTailscale(active: boolean, every: number | false = false) {
  const { q, check } = useStatus(statusKeys.tailscale, () => platform.tailscaleStatus(), active, every)
  return { status: q.data ?? null, error: q.error ? errorText(q.error) : null, checking: q.isFetching, check }
}

export function useCloudflare(active: boolean, every: number | false = false) {
  const { q, check } = useStatus(statusKeys.cloudflare, () => platform.cloudflareStatus(), active, every)
  return { status: q.data ?? null, error: q.error ? errorText(q.error) : null, checking: q.isFetching, check }
}

/** WireCat's own Tailscale connection; a failed read shows as not known rather than as an error. */
export function useFunnelHelper(active: boolean, every: number | false = false) {
  const client = useQueryClient()
  const { q, check } = useStatus(statusKeys.funnelHelper, () => platform.funnelHelperStatus(), active, every)
  return {
    status: q.isError ? null : (q.data ?? null),
    check,
    setStatus: (s: FunnelHelperStatus) => client.setQueryData(statusKeys.funnelHelper, s),
  }
}

export type Helper = ReturnType<typeof useFunnelHelper>
