import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { filterOf } from "@/domain/inbox"
import type { SyncSchedule } from "@/platform/bindings"
import { platform } from "@/platform/bridge"

/** mail-cli, the one tool whose `inbox` the tab reads. */
export const EMAIL = "email"

/** Under the tool's key, so a change to Email's accounts reaches it too. */
export const inboxKey = ["tool", EMAIL, "inbox"] as const

/** One page of every account's sorted mail; the rows on screen stay while the next answer is read. */
export function useInboxPage(profiles: readonly string[] | undefined, asked: string, page: number, size: number) {
  return useQuery({
    queryKey: [...inboxKey, profiles, asked, page, size],
    queryFn: () => platform.mailInboxList(EMAIL, [...(profiles ?? [])], filterOf(asked), page, size),
    enabled: (profiles?.length ?? 0) > 0,
    placeholderData: keepPreviousData,
  })
}

export const scheduleKey = (profile: string) => [...inboxKey, "schedule", profile] as const

/** The account's sorting on a timer; read again now and then, so a run made while the tab shows appears. */
export function useInboxSchedule(profile: string) {
  return useQuery<SyncSchedule>({
    queryKey: scheduleKey(profile),
    queryFn: () => platform.mailInboxScheduleStatus(EMAIL, profile),
    refetchInterval: 2 * 60_000,
  })
}
