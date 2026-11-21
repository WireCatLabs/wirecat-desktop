import { create } from "zustand"
import { type Refusal, refusalOf } from "@/domain/inbox"
import type { InboxAsk, InboxRun } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { queryClient } from "@/shared/query"
import { EMAIL, inboxKey } from "./api"

const TYPING_MS = 350

/** One account's Sort now, from waiting to its answer. */
export type RunState =
  | { phase: "waiting" }
  | { phase: "running" }
  | { phase: "done"; run: Extract<InboxRun, { result: "sorted" }> }
  | { phase: "failed"; refusal: Refusal; message: string; ask?: InboxAsk | null }

const runStateOf = (run: InboxRun): RunState =>
  run.result === "sorted"
    ? { phase: "done", run }
    : { phase: "failed", refusal: refusalOf(run), message: run.message, ask: run.ask }

type InboxState = {
  /** What the search field shows. */
  query: string
  /** What the list was asked with: the query once typing pauses, so each key is not a run of every account. */
  asked: string
  page: number
  pageSize: number
  /** The last Sort now, one line per account in the order it ran them; empty before the first. */
  runs: { profile: string; state: RunState }[]
  sorting: boolean
  type(query: string): void
  setQuery(query: string): void
  setPage(page: number): void
  setPageSize(size: number): void
  /** Sorts every account the page lists, one after another: they share one model and its rate limit. */
  sortNow(profiles: readonly string[]): Promise<void>
  /** Runs one account again with `--yes`, once the owner agreed to send its mail to a model outside this computer. */
  send(profile: string): Promise<void>
}

export const useInbox = create<InboxState>((set, get) => {
  let typing: ReturnType<typeof setTimeout> | undefined
  const put = (profile: string, state: RunState) =>
    set((s) => ({ runs: s.runs.map((r) => (r.profile === profile ? { profile, state } : r)) }))
  const runOne = async (profile: string, yes: boolean) => {
    put(profile, { phase: "running" })
    try {
      put(profile, runStateOf(await platform.mailInboxRun(EMAIL, profile, yes)))
    } catch (e) {
      put(profile, { phase: "failed", refusal: "other", message: errorText(e) })
    }
    await queryClient().invalidateQueries({ queryKey: inboxKey })
  }
  return {
    query: "",
    asked: "",
    page: 1,
    pageSize: 25,
    runs: [],
    sorting: false,
    type(query) {
      set({ query, page: 1 })
      clearTimeout(typing)
      typing = setTimeout(() => set({ asked: get().query }), TYPING_MS)
    },
    setQuery(query) {
      clearTimeout(typing)
      set({ query, asked: query, page: 1 })
    },
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    async sortNow(profiles) {
      if (get().sorting) return
      set({ sorting: true, runs: profiles.map((profile) => ({ profile, state: { phase: "waiting" } })) })
      try {
        for (const profile of profiles) await runOne(profile, false)
      } finally {
        set({ sorting: false })
      }
    },
    async send(profile) {
      if (get().sorting) return
      set({ sorting: true })
      try {
        await runOne(profile, true)
      } finally {
        set({ sorting: false })
      }
    },
  }
})
