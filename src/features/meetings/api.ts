import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { type DayWindow, localInstant } from "@/domain/meeting-layout"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"

/** A calendar window reads this many rows at most, oldest first; the days past the cut say "Not read" (NEED-34 A). */
const WINDOW_CAP = 500

const keys = {
  all: ["tool", "memo", "meetings"] as const,
  window: (from: string, to: string, query: string) => ["tool", "memo", "meetings", "window", from, to, query] as const,
  page: (query: string, page: number, size: number) => ["tool", "memo", "meetings", "page", query, page, size] as const,
  one: (ref: string) => ["tool", "memo", "meetings", "one", ref] as const,
}

/** Every meeting the days on screen overlap, up to the cap; a window read in the last minute shows at once. */
export const useMeetingsWindow = (window: DayWindow, query: string, enabled: boolean) => {
  const from = localInstant(window.from)
  const to = localInstant(window.to)
  return useQuery({
    queryKey: keys.window(from, to, query),
    queryFn: () => platform.meetingsList(query, { from, to }, 1, WINDOW_CAP),
    staleTime: 60_000,
    enabled,
  })
}

/** One page of all meetings, newest first, as memo cut it; the page on screen stays until the next one comes. */
export const useMeetingsPage = (query: string, page: number, size: number, enabled: boolean) =>
  useQuery({
    queryKey: keys.page(query, page, size),
    queryFn: () => platform.meetingsList(query, null, page, size),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  })

/** A meeting, its transcript read part by part from the line the last part ended at. */
export const useMeeting = (ref: string | null) =>
  useInfiniteQuery({
    queryKey: keys.one(ref ?? ""),
    queryFn: ({ pageParam }) => platform.meetingsShow(ref ?? "", pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.transcript?.hasMore ? last.transcript.offset + last.transcript.lines.length : undefined,
    enabled: ref !== null,
    staleTime: 5 * 60_000,
  })

export const readAgain = () => queryClient().invalidateQueries({ queryKey: keys.all })
