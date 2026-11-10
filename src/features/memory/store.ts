import { create } from "zustand"
import {
  can,
  entryInTab,
  inTab,
  type MemoryField,
  matchesFilter,
  memoryFilter,
  setMemoryField,
  subjectOf,
  type Tab,
  tabOf,
  withCleanNames,
} from "@/domain/memory"
import { useTasks } from "@/features/tasks"
import { messagesOf } from "@/i18n"
import { platform } from "@/platform/bridge"
import type {
  MemoryChange,
  MemoryEntry,
  MemoryRead,
  MemorySource,
  ReviewAnswer,
  Role,
  SourceContext,
  SourceReview,
} from "@/platform/memory-schemas"
import { fresh } from "@/shared/fresh"
import { useNav } from "@/shared/nav"
import { memoryMessages } from "./messages"
import { reviewMessages } from "./messages-review"

export type Context =
  | { state: "loading" }
  | { state: "ready"; context: SourceContext }
  | { state: "failed"; error: string }
export type Op = "confirm" | "discard" | "correct" | "forget" | "open" | "remove" | ReviewAnswer
export type Review =
  | { state: "loading" }
  | { state: "ready"; review: SourceReview }
  | { state: "failed"; error: string }
export type Sources =
  | { state: "loading" }
  | { state: "ready"; sources: MemorySource[] }
  | { state: "failed"; error: string }

type MemoryState = {
  /** The tour's example rows are on screen (onboarding/demo.ts): a read waits until they go. */
  demo: boolean
  /** null until the first read answers. */
  read: MemoryRead | null
  entries: MemoryEntry[]
  error: string | null
  reading: boolean
  /** When memo last answered; the page reads again only when it is older than a minute. */
  readAt: number | null
  tab: Tab
  /** The owner picked a tab: a later read no longer chooses one for them. */
  tabChosen: boolean
  /** The search: free words and `field:value` terms, which the filter chips write too. */
  query: string
  /** Cited sources read back in place, by ref. */
  contexts: Record<string, Context>
  open: string | null
  /**
   * Rows that changed state while shown keep their place under the tab they were in (rule 9): a confirmed row turns
   * green where it is and leaves Review only when the owner changes the tab or reads again.
   */
  held: string[]
  /** Rows on their way out (forgotten): they fold away before they leave the list. */
  leaving: string[]
  /** Rows just written (a correction): they unfold into place. */
  arriving: string[]
  sources: Record<string, Sources>
  busy: Record<string, Op>
  failed: Record<string, string>
  correcting: string | null
  /** The text a correction starts from when it is not the record's own: a wording an agent suggested. */
  draft: string | null
  forgetting: string | null
  /** Open source reviews read back in place, by the record's ref. */
  reviews: Record<string, Review>
  /** What the owner answered a review with, until the next read: the row says what happened. */
  reviewed: Record<string, ReviewAnswer>
  /** Findings the owner unticked, per batch: Approve creates the rest. */
  skipped: Record<string, string[]>
  /** Subject groups folded shut: their rows are not on screen, so the page-wide Approve leaves them. */
  closedGroups: string[]
  toggleGroup(key: string): void
  page: number
  pageSize: number
  /** The page of memo's lists on screen; the page above pages within it. Only this one is read. */
  memoPage: number
  /** Reads another page of memo's lists, and only that one. */
  turnMemoPage(page: number): void
  setPage(page: number): void
  setPageSize(size: number): void
  /** Approves these single rows one by one and says how many memo approved; a findings batch never is. */
  confirmMany(refs: string[]): Promise<number>
  /**
   * Approves or rejects every waiting record given: relationship proposals in one memo call, the rest one by one.
   * Answers how many memo decided and how many it refused.
   */
  decideMany(refs: string[], approve: boolean): Promise<{ done: number; failed: number }>
  /** Sets a relationship's role; a proposal is approved on the way. */
  editRelation(ref: string, role: string | null): Promise<boolean>
  /** Removes a link that holds, or rejects a proposal; the row folds away. */
  removeRelation(ref: string): Promise<void>
  load(): Promise<void>
  /** The page opened: a read unless the last one is under a minute old; what it shows stays while it runs. */
  visit(): void
  setTab(tab: Tab): void
  setQuery(query: string): void
  /** Narrows the search to one value of a field, as a value clicked in a record's details does. */
  filterBy(field: MemoryField, value: string): void
  loadContext(ref: string): Promise<void>
  toggle(ref: string): void
  loadSources(ref: string): Promise<void>
  confirm(ref: string): Promise<void>
  discard(ref: string): Promise<void>
  correct(ref: string, text: string, change?: MemoryChange): Promise<boolean>
  forget(ref: string): Promise<void>
  startCorrect(ref: string | null, draft?: string): void
  loadReview(ref: string): Promise<void>
  /** The owner's answer to a record's source review; the record comes back with no review open. */
  answerReview(ref: string, answer: ReviewAnswer, reason?: string): Promise<boolean>
  askForget(ref: string | null): void
  skip(ref: string, finding: string, skipped: boolean): void
  /** Opens a record where it is, in its tab, with the search and its group made to show it; false when not read. */
  reveal(ref: string, from: string): boolean
  /** Opens on the Tasks page the task `from` became (`task:<id>`); an error stays on the `from` row. */
  openTask(from: string, task: string): Promise<void>
}

const REFUSALS = ["fact.not-accepted", "fact.owner-written", "fact.revoke-correction"] as const

/** memo's reasons for refusing `facts revoke` or a review decision arrive as they are and are worded here. */
const message = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e)
  const reason = REFUSALS.find((r) => r === text)
  return (
    (reason && messagesOf(memoryMessages).revokeRefused[reason]) || messagesOf(reviewMessages).refused[text] || text
  )
}

/** The installed memo takes back an agent's accepted fact. */
export const canRevoke = (s: { read: MemoryRead | null }) => s.read?.kind === "ready" && s.read.revoke

const NO_ROLES: Role[] = []
/** The owner's role lists, empty before a memo that has them. */
export const ownerRoles = (s: { read: MemoryRead | null }) =>
  (s.read?.kind === "ready" ? s.read.roles : undefined) ?? NO_ROLES
const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

export const LEAVE_MS = 320

export const useMemory = create<MemoryState>((set, get) => {
  let seq = 0

  const run = async <T>(ref: string, op: Op, f: () => Promise<T>): Promise<T | null> => {
    if (get().busy[ref]) return null
    set((s) => ({ busy: { ...s.busy, [ref]: op }, failed: without(s.failed, ref) }))
    try {
      return await f()
    } catch (e) {
      set((s) => ({ failed: { ...s.failed, [ref]: message(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, ref) }))
    }
  }

  const replace = (entry: MemoryEntry) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.ref === entry.ref ? withCleanNames(entry) : e)),
      held: s.held.includes(entry.ref) ? s.held : [...s.held, entry.ref],
    }))

  return {
    demo: false,
    read: null,
    entries: [],
    error: null,
    reading: false,
    readAt: null,
    tab: "review",
    tabChosen: false,
    query: "",
    contexts: {},
    open: null,
    held: [],
    leaving: [],
    arriving: [],
    sources: {},
    busy: {},
    failed: {},
    correcting: null,
    draft: null,
    forgetting: null,
    reviews: {},
    reviewed: {},
    skipped: {},
    closedGroups: [],
    page: 1,
    pageSize: 50,
    memoPage: 1,

    toggleGroup: (key) =>
      set((s) => ({
        closedGroups: s.closedGroups.includes(key) ? s.closedGroups.filter((k) => k !== key) : [...s.closedGroups, key],
      })),
    async confirmMany(refs) {
      // One at a time: memo holds a lock per write, and each row turns green as its own answer comes.
      let approved = 0
      for (const ref of refs) {
        const entry = get().entries.find((e) => e.ref === ref)
        if (!entry || entry.findings || !can(entry).confirm) continue
        await get().confirm(ref)
        if (get().entries.find((e) => e.ref === ref)?.status !== entry.status) approved++
      }
      return approved
    },

    async decideMany(refs, approve) {
      const waiting = get().entries.filter((e) => refs.includes(e.ref) && e.status === "proposed" && !e.findings)
      const proposals = waiting.filter((e) => e.type === "relationship").map((e) => e.ref)
      let done = 0
      let failed = 0
      if (proposals.length > 0) {
        set((s) => ({
          busy: { ...s.busy, ...Object.fromEntries(proposals.map((r) => [r, approve ? "confirm" : "discard"])) },
        }))
        try {
          const answers = await platform.memoryRelationsDecide(proposals, approve)
          set((s) => ({
            entries: s.entries.map((e) => {
              const a = answers.find((x) => x.ref === e.ref)
              return a?.status ? { ...e, status: a.status, standing: a.status } : e
            }),
            failed: {
              ...Object.fromEntries(Object.entries(s.failed).filter(([r]) => !proposals.includes(r))),
              ...Object.fromEntries(answers.filter((a) => a.error).map((a) => [a.ref, a.error ?? ""])),
            },
            held: [...s.held, ...proposals],
          }))
          done += answers.filter((a) => a.status).length
          failed += answers.filter((a) => !a.status).length
        } catch (e) {
          const why = message(e)
          set((s) => ({ failed: { ...s.failed, ...Object.fromEntries(proposals.map((r) => [r, why])) } }))
          failed += proposals.length
        } finally {
          set((s) => ({ busy: Object.fromEntries(Object.entries(s.busy).filter(([r]) => !proposals.includes(r))) }))
        }
      }
      // One at a time: memo holds a lock per write.
      for (const e of waiting.filter((x) => x.type !== "relationship")) {
        if (approve) await get().confirm(e.ref)
        else await get().discard(e.ref)
        if (get().entries.find((x) => x.ref === e.ref)?.status !== e.status) done++
        else failed++
      }
      return { done, failed }
    },
    async editRelation(ref, role) {
      const edited = await run(ref, "correct", () => platform.memoryRelationEdit(ref, role))
      if (!edited) return false
      set((s) => ({
        entries: s.entries.map((e) =>
          e.ref === ref ? { ...e, ref: edited.ref, role: edited.role, status: "confirmed", standing: "confirmed" } : e,
        ),
        held: [...s.held, edited.ref],
        open: s.open === ref ? edited.ref : s.open,
        correcting: edited.error ? edited.ref : null,
        failed: edited.error ? { ...s.failed, [edited.ref]: edited.error } : s.failed,
      }))
      return !edited.error
    },
    async removeRelation(ref) {
      const done = await run(ref, "remove", async () => {
        await platform.memoryRelationRemove(ref)
        return true
      })
      if (!done) return
      set((s) => ({ leaving: [...s.leaving, ref], open: s.open === ref ? null : s.open, correcting: null }))
      setTimeout(
        () =>
          set((s) => ({
            entries: s.entries.filter((e) => e.ref !== ref),
            leaving: s.leaving.filter((r) => r !== ref),
          })),
        LEAVE_MS,
      )
    },

    async load() {
      if (get().demo) return
      const call = ++seq
      set({ reading: true, error: null })
      try {
        const read = await platform.memoryRead(get().memoPage)
        if (call !== seq || get().demo) return
        const entries = read.kind === "ready" ? read.entries.map(withCleanNames) : []
        const tab = get().tabChosen
          ? get().tab
          : entries.some((e) => entryInTab("review", e)) || entries.length === 0
            ? "review"
            : "inuse"
        set({
          read,
          entries,
          tab,
          reading: false,
          readAt: Date.now(),
          held: [],
          arriving: [],
          sources: {},
          reviews: {},
          reviewed: {},
          failed: {},
          skipped: {},
        })
      } catch (e) {
        if (call !== seq || get().demo) return
        set({ error: message(e), reading: false })
      }
    },
    visit() {
      if (!get().demo && !fresh(get().readAt)) void get().load()
    },
    setTab: (tab) => set({ tab, tabChosen: true, held: [], arriving: [], page: 1 }),
    setQuery: (query) => set({ query, page: 1 }),
    filterBy: (field, value) => set((s) => ({ query: setMemoryField(s.query, field, [value]), page: 1 })),
    turnMemoPage(memoPage) {
      set({ memoPage, page: 1 })
      void get().load()
    },
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    async loadContext(ref) {
      const had = get().contexts[ref]
      if (had && had.state !== "failed") return
      set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "loading" } } }))
      try {
        const context = await platform.memorySourceContext(ref)
        set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "ready", context } } }))
      } catch (e) {
        set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    toggle(ref) {
      const opening = get().open !== ref
      set((s) => ({ open: opening ? ref : null, correcting: s.correcting === ref ? null : s.correcting }))
      if (opening && !get().sources[ref]) get().loadSources(ref)
      if (opening) get().loadReview(ref)
    },
    async loadReview(ref) {
      const id = get().entries.find((e) => e.ref === ref)?.sourceReview?.id
      const had = get().reviews[ref]
      if (!id || (had && had.state !== "failed")) return
      set((s) => ({ reviews: { ...s.reviews, [ref]: { state: "loading" } } }))
      try {
        const review = await platform.memoryReviewShow(ref, id)
        set((s) => ({ reviews: { ...s.reviews, [ref]: { state: "ready", review } } }))
      } catch (e) {
        set((s) => ({ reviews: { ...s.reviews, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async answerReview(ref, answer, reason) {
      const id = get().entries.find((e) => e.ref === ref)?.sourceReview?.id
      if (!id) return false
      const entry = await run(ref, answer, () => platform.memoryReviewDecide(ref, id, answer, reason))
      if (!entry) return false
      replace(entry)
      set((s) => ({ reviews: without(s.reviews, ref), reviewed: { ...s.reviewed, [ref]: answer } }))
      return true
    },
    async loadSources(ref) {
      const entry = get().entries.find((e) => e.ref === ref)
      // A plain action cites nothing; a findings batch's sources come with it from memo.
      if (!entry || entry.type === "relationship" || (entry.type === "action" && !entry.findings)) return
      set((s) => ({ sources: { ...s.sources, [ref]: { state: "loading" } } }))
      try {
        const sources = await platform.memorySources(ref)
        set((s) => ({ sources: { ...s.sources, [ref]: { state: "ready", sources } } }))
      } catch (e) {
        set((s) => ({ sources: { ...s.sources, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async confirm(ref) {
      const findings = get().entries.find((e) => e.ref === ref)?.findings
      // A batch is approved only as the owner sees it: opened, and only the findings still ticked (NEED-2166).
      if (findings && get().open !== ref) return
      const skipped = get().skipped[ref] ?? []
      const accept = findings ? findings.map((f) => f.id).filter((id) => !skipped.includes(id)) : undefined
      if (accept?.length === 0) return
      const entry = await run(ref, "confirm", () => platform.memoryConfirm(ref, accept))
      if (entry) replace(entry)
    },
    async discard(ref) {
      const entry = await run(ref, "discard", () => platform.memoryDiscard(ref))
      if (entry) replace(entry)
    },
    async correct(ref, text, change) {
      const added = await run(ref, "correct", () => platform.memoryCorrect(ref, text, change))
      if (!added) return false
      const old = await platform.memoryShow(ref).catch(() => null)
      set((s) => ({
        entries: [
          withCleanNames(added),
          ...s.entries.map((e) => (e.ref !== ref ? e : old ? withCleanNames(old) : { ...e, status: "superseded" })),
        ],
        reviews: without(s.reviews, ref),
        held: [...s.held, ref, added.ref],
        arriving: [...s.arriving, added.ref],
        correcting: null,
        draft: null,
      }))
      return true
    },
    async forget(ref) {
      set({ forgetting: null })
      const done = await run(ref, "forget", () => platform.memoryForget(ref))
      if (!done) return
      set((s) => ({ leaving: [...s.leaving, ref], open: s.open === ref ? null : s.open }))
      setTimeout(
        () =>
          set((s) => ({
            entries: s.entries.filter((e) => e.ref !== ref),
            leaving: s.leaving.filter((r) => r !== ref),
            sources: without(s.sources, ref),
          })),
        LEAVE_MS,
      )
    },
    startCorrect: (ref, draft) =>
      set((s) => ({ correcting: ref, draft: draft ?? null, failed: ref ? without(s.failed, ref) : s.failed })),
    askForget: (ref) => set({ forgetting: ref }),
    reveal(ref, from) {
      const entry = get().entries.find((e) => e.ref === ref)
      if (!entry) return false
      const group = subjectOf(entry)?.key
      const now = get().tab
      const tab = now === "all" || inTab(now, entry.status) ? now : (tabOf(entry.status) ?? "all")
      set((s) => ({
        // Rows held in this tab stay while the owner is sent within it (rule 9); a new tab starts fresh, as setTab does.
        ...(tab === now ? {} : { tab, tabChosen: true, held: [], arriving: [] }),
        open: ref,
        query: matchesFilter(entry, memoryFilter(s.query)) ? s.query : "",
        closedGroups: s.closedGroups.filter((k) => k !== group),
        failed: without(s.failed, from),
      }))
      if (!get().sources[ref]) get().loadSources(ref)
      return true
    },
    async openTask(from, task) {
      const shown = await run(from, "open", () => platform.taskShow(task.replace(/^task:/, "")))
      if (!shown) return
      useNav.getState().go("tasks")
      void useTasks.getState().openTask(shown.key)
    },
    skip: (ref, finding, skipped) =>
      set((s) => {
        const now = (s.skipped[ref] ?? []).filter((id) => id !== finding)
        return { skipped: { ...s.skipped, [ref]: skipped ? [...now, finding] : now } }
      }),
  }
})
