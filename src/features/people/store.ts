import { create } from "zustand"
import { looksLikeAccount, touched } from "@/domain/people"
import { platform } from "@/platform/bridge"
import type { Listed, Match, MatchAnswer, PeopleRead, PersonDetail } from "@/platform/people-schemas"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type Detail =
  | { state: "loading" }
  | { state: "ready"; person: PersonDetail }
  | { state: "failed"; error: string }
export type Op = MatchAnswer | "unlink" | "unmerge"
/** What the owner just did on a person, said where it happened until the page is read again (rule 9). */
export type Done =
  | { op: "confirm" | "reject"; with: string }
  | { op: "unlink"; movedTo: string; count: number }
  | { op: "unmerge"; from: string }
export type View = "people" | "matches"
/** What joining some of a group did: who was joined, in order, and why the rest were not, if a join failed. */
export type GroupDone = { joined: string[]; stopped: string | null }
export type Found =
  | { state: "looking" }
  | { state: "found"; ref: string }
  | { state: "none" }
  | { state: "failed"; error: string }

type PeopleState = {
  /** `missing` and `old` as memo answered; the lists live below. */
  read: PeopleRead["kind"] | null
  oldVersion: { version: string | null; need: string } | null
  people: Listed[]
  /** memo has more people than it gave: the page says so. */
  peopleMore: boolean
  /** The open matches, with any the owner decided since the last full read kept in place. */
  matches: Match[]
  matchesMore: boolean
  decided: Record<string, MatchAnswer>
  reading: boolean
  error: string | null
  view: View
  query: string
  withTasks: boolean
  named: boolean
  page: number
  pageSize: number
  matchPage: number
  /** The person whose account the search named, found by memo. */
  found: Found | null
  /** The person whose dialog is open. */
  open: string | null
  /** The match, or the group of matches (its key from `groupMatches`), whose Details dialog is open. */
  matchOpen: string | null
  joinedGroup: Record<string, GroupDone>
  details: Record<string, Detail>
  busy: Record<string, Op>
  failed: Record<string, string>
  done: Record<string, Done>
  splitting: string | null
  undoing: { ref: string; merge: string } | null
  load(): Promise<void>
  setView(view: View): void
  setQuery(query: string): void
  setFilter(filter: { withTasks?: boolean; named?: boolean }): void
  setPage(page: number): void
  setPageSize(size: number): void
  setMatchPage(page: number): void
  findAccount(): Promise<void>
  /** Opens a person's dialog, from a row, a search result or "now part of"; `null` closes it. */
  reveal(ref: string | null): void
  openMatch(id: string | null): void
  loadDetail(ref: string, again?: boolean): Promise<void>
  /** The people on screen: their details are read a few at a time, the first rows first. */
  want(refs: readonly string[]): void
  /** One more person to read, before the rows waiting: the owner just opened them. */
  need(ref: string): void
  /** `ref` is the person the owner decides from: the open one, or the first of the match's two. */
  decide(ref: string, id: string, answer: MatchAnswer, reason?: string): Promise<boolean>
  /** Joins the chosen people of a group into one; `ids` are the group's matches, kept in place as decided. */
  joinGroup(key: string, refs: string[], ids: string[]): Promise<boolean>
  /** Keeps every pair of a group apart, for one reason; stops at the first refusal. */
  rejectGroup(matches: Match[], reason: string): Promise<boolean>
  unlink(ref: string, identities: string[]): Promise<boolean>
  unmerge(ref: string, merge: string): Promise<boolean>
  askSplit(ref: string | null): void
  askUndo(undo: { ref: string; merge: string } | null): void
}

const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

/** memo's command server keeps two processes; more calls at once would each start memo anew. */
const AT_ONCE = 2

export const usePeople = create<PeopleState>((set, get) => {
  let seq = 0
  let wanted: string[] = []
  let running = 0

  const pump = () => {
    while (running < AT_ONCE) {
      const ref = wanted.find((r) => !get().details[r])
      if (!ref) return
      wanted = wanted.filter((r) => r !== ref)
      running++
      void get()
        .loadDetail(ref)
        .finally(() => {
          running--
          pump()
        })
    }
  }

  const run = async <T>(key: string, op: Op, f: () => Promise<T>): Promise<T | null> => {
    if (get().busy[key]) return null
    set((s) => ({ busy: { ...s.busy, [key]: op }, failed: without(s.failed, key), done: without(s.done, key) }))
    try {
      return await f()
    } catch (e) {
      set((s) => ({ failed: { ...s.failed, [key]: message(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, key) }))
    }
  }

  /**
   * After a write the people it touched may have new accounts, merges or matches, or be gone into another: their
   * cached details go, the person the answer describes is kept, and both lists are read again. A match the owner
   * decided stays in place until the next full read, and so do the `keep` ones a group decision just closed.
   */
  const settle = async (
    answer: PersonDetail,
    asked: string,
    others: (string | null | undefined)[],
    keep: readonly string[] = [],
  ): Promise<Set<string> | null> => {
    const gone = touched(asked, answer.ref, ...others)
    set((s) => {
      const details = { ...s.details }
      for (const ref of gone) delete details[ref]
      details[asked] = { state: "ready", person: answer }
      return { details }
    })
    try {
      const read = await platform.peopleRead()
      if (read.kind !== "ready") return null
      set((s) => ({
        people: read.people,
        peopleMore: read.peopleMore,
        matches: [
          ...read.matches,
          ...s.matches.filter(
            (m) => (s.decided[m.id] || keep.includes(m.id)) && !read.matches.some((r) => r.id === m.id),
          ),
        ],
        matchesMore: read.matchesMore,
      }))
      return new Set(read.matches.map((m) => m.id))
    } catch {
      // The person's own answer already shows; the lists catch up on the next read.
      return null
    } finally {
      const open = get().open
      if (open && !get().details[open]) void get().loadDetail(open)
    }
  }

  return {
    read: null,
    oldVersion: null,
    people: [],
    peopleMore: false,
    matches: [],
    matchesMore: false,
    decided: {},
    reading: false,
    error: null,
    view: "people",
    query: "",
    withTasks: false,
    named: false,
    page: 1,
    pageSize: 50,
    matchPage: 1,
    found: null,
    open: null,
    matchOpen: null,
    joinedGroup: {},
    details: {},
    busy: {},
    failed: {},
    done: {},
    splitting: null,
    undoing: null,

    async load() {
      const call = ++seq
      set({ reading: true, error: null })
      try {
        const read = await platform.peopleRead()
        if (call !== seq) return
        const ready = read.kind === "ready" ? read : null
        set({
          read: read.kind,
          oldVersion: read.kind === "old" ? { version: read.version, need: read.need } : null,
          people: ready?.people ?? [],
          peopleMore: ready?.peopleMore ?? false,
          matches: ready?.matches ?? [],
          matchesMore: ready?.matchesMore ?? false,
          decided: {},
          joinedGroup: {},
          reading: false,
          details: {},
          failed: {},
          done: {},
        })
        const open = get().open
        if (open) void get().loadDetail(open)
      } catch (e) {
        if (call !== seq) return
        set({ error: message(e), reading: false })
      }
    },
    setView: (view) => set({ view }),
    setQuery: (query) => set({ query, found: null, page: 1 }),
    setFilter: (filter) => set({ ...filter, page: 1 }),
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    setMatchPage: (matchPage) => set({ matchPage }),
    async findAccount() {
      const query = get().query.trim()
      if (!looksLikeAccount(query)) return
      set({ found: { state: "looking" } })
      try {
        const person = await platform.peopleFind(query)
        if (get().query.trim() !== query) return
        if (!person) return set({ found: { state: "none" } })
        set((s) => ({
          found: { state: "found", ref: person.ref },
          details: { ...s.details, [person.ref]: { state: "ready", person } },
        }))
      } catch (e) {
        set({ found: { state: "failed", error: message(e) } })
      }
    },
    reveal(ref) {
      set({ open: ref })
      if (ref) void get().loadDetail(ref)
    },
    openMatch: (matchOpen) => set({ matchOpen }),
    want(refs) {
      wanted = [...refs]
      pump()
    },
    need(ref) {
      wanted = [ref, ...wanted.filter((r) => r !== ref)]
      pump()
    },
    async loadDetail(ref, again = false) {
      const had = get().details[ref]
      if (!again && had && had.state !== "failed") return
      set((s) => ({ details: { ...s.details, [ref]: { state: "loading" } } }))
      try {
        const person = await platform.peopleShow(ref)
        set((s) => ({ details: { ...s.details, [ref]: { state: "ready", person } } }))
      } catch (e) {
        set((s) => ({ details: { ...s.details, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async decide(ref, id, answer, reason) {
      const match = get().matches.find((m) => m.id === id)
      const updated = await run(id, answer, () => platform.peopleDecide(ref, id, answer, reason))
      if (!updated) return false
      const other = match?.persons.find((p) => p !== ref) ?? ""
      set((s) => ({ decided: { ...s.decided, [id]: answer }, done: { ...s.done, [ref]: { op: answer, with: other } } }))
      await settle(updated, ref, match?.persons ?? [])
      return true
    },
    async joinGroup(key, refs, ids) {
      // The card stays busy until the lists are read again, so it never offers the pairs memo just folded away.
      const done = await run(key, "confirm", async () => {
        const result = await platform.peopleMerge(refs)
        const open = await settle(result.person, refs[0] ?? result.person.ref, refs, ids)
        return { result, open }
      })
      if (!done) return false
      const { result, open } = done
      set((s) => ({
        joinedGroup: { ...s.joinedGroup, [key]: { joined: result.joined, stopped: result.stopped } },
        decided: {
          ...s.decided,
          ...Object.fromEntries(ids.filter((id) => !open?.has(id)).map((id) => [id, "confirm" as const])),
        },
      }))
      return true
    },
    async rejectGroup(matches, reason) {
      for (const match of matches)
        if (!(await get().decide(match.persons[0] ?? "", match.id, "reject", reason))) return false
      return true
    },
    async unlink(ref, identities) {
      const result = await run(ref, "unlink", () => platform.peopleUnlink(ref, identities))
      set({ splitting: null })
      if (!result) return false
      set((s) => ({ done: { ...s.done, [ref]: { op: "unlink", movedTo: result.movedTo, count: identities.length } } }))
      await settle(result.person, ref, [result.movedTo])
      return true
    },
    async unmerge(ref, merge) {
      const d = get().details[ref]
      const from = d?.state === "ready" ? (d.person.merges.find((m) => m.id === merge)?.from ?? "") : ""
      const updated = await run(ref, "unmerge", () => platform.peopleUnmerge(ref, merge))
      set({ undoing: null })
      if (!updated) return false
      set((s) => ({ done: { ...s.done, [ref]: { op: "unmerge", from } } }))
      await settle(updated, ref, [from])
      return true
    },
    askSplit: (ref) => set({ splitting: ref }),
    askUndo: (undo) => set({ undoing: undo }),
  }
})
