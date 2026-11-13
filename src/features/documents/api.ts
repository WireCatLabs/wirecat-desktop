import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"
import { platform } from "@/platform/bridge"
import { queryClient } from "@/shared/query"

const keys = {
  all: ["tool", "memo", "documents"] as const,
  tree: ["tool", "memo", "documents", "tree"] as const,
  list: (query: string, page: number, size: number) =>
    ["tool", "memo", "documents", "list", query, page, size] as const,
  one: (ref: string) => ["tool", "memo", "documents", "one", ref] as const,
}

/** The accounts and folders, and whether memo can list documents at all. */
export const useDocumentsRead = () =>
  useQuery({ queryKey: keys.tree, queryFn: () => platform.documentsRead(), staleTime: 60_000 })

/** One page as memo cut it; the page on screen stays, dimmed, until the next one comes. */
export const useDocumentsPage = (query: string, page: number, size: number, enabled: boolean) =>
  useQuery({
    queryKey: keys.list(query, page, size),
    queryFn: () => platform.documentsList(query, page, size),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  })

/** A document, its text read part by part from where the last part ended. */
export const useDocument = (ref: string | null) =>
  useInfiniteQuery({
    queryKey: keys.one(ref ?? ""),
    queryFn: ({ pageParam }) => platform.documentsShow(ref ?? "", pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: ref !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })

export const useReveal = () => useMutation({ mutationFn: (ref: string) => platform.documentsReveal(ref) })

/** Read again: the tree and the list. An open document stays as read: each of its text parts is a memo process. */
export const readAgain = () =>
  queryClient().invalidateQueries({ queryKey: keys.all, predicate: (q) => q.queryKey[3] !== "one" })
