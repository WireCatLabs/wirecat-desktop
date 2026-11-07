import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { platform } from "@/platform/bridge"
import type { Background, BackgroundAction } from "@/platform/sync-schemas"
import { profilesQuery } from "@/shared/query"

export const toolKeys = {
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
