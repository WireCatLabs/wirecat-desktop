import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Enrichment, SearchHarder } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import type { Background, BackgroundAction } from "@/platform/sync-schemas"
import type { HarderChoice } from "@/platform/types"
import { profilesQuery } from "@/shared/query"

export const toolKeys = {
  enrichment: (id: string) => ["tool", id, "enrichment"] as const,
  searchHarder: (id: string) => ["tool", id, "searchHarder"] as const,
  background: (id: string, profile: string) => ["tool", id, "background", profile] as const,
  permissions: (id: string, profile: string | null) => ["tool", id, "permissions", profile] as const,
}

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
    onSettled: () => client.invalidateQueries({ queryKey: ["tool", id, "permissions"] }),
  })
}

/** Whether memo has a hosted model rewrite records for search, and how far it got. */
export function useEnrichment(id: string) {
  return useQuery({ queryKey: toolKeys.enrichment(id), queryFn: () => platform.enrichmentStatus(id) })
}

export type EnrichmentChoice = { provider: string; model: string }

/** What turning it on sends and costs. A mutation, not a query: it runs only when the owner opens the consent step. */
export function useEnrichmentPreview(id: string) {
  return useMutation({ mutationFn: (c: EnrichmentChoice) => platform.enrichmentPreview(id, c.provider, c.model) })
}

/** `null` turns it off; a choice turns it on with that offer. */
export function useSetEnrichment(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (c: EnrichmentChoice | null) =>
      c ? platform.enrichmentOn(id, c.provider, c.model) : platform.enrichmentOff(id),
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
