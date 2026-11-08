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
  query: string
  /** The person whose account the search named, found by memo. */
  found: Found | null
  open: string | null
  details: Record<string, Detail>
  busy: Record<string, Op>
  failed: Record<string, string>
  done: Record<string, Done>
  splitting: string | null
  undoing: { ref: string; merge: string } | null
  load(): Promise<void>
  setQuery(query: string): void
  findAccount(): Promise<void>
  toggle(ref: string): void
  /** Opens a person from elsewhere on the page (a match, a search result, "now part of"). */
  reveal(ref: string): void
  loadDetail(ref: string, again?: boolean): Promise<void>
  /** `ref` is the person the owner decides from: the open one, or the first of the match's two. */
  decide(ref: string, id: string, answer: MatchAnswer, reason?: string): Promise<boolean>
  unlink(ref: string, identities: string[]): Promise<boolean>
  unmerge(ref: string, merge: string): Promise<boolean>
  askSplit(ref: string | null): void
  askUndo(undo: { ref: string; merge: string } | null): void
}

const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

export const usePeople = create<PeopleState>((set, get) => {
  let seq = 0

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
   * decided stays in place until the next full read.
   */
  const settle = async (answer: PersonDetail, asked: string, others: (string | null | undefined)[]) => {
    const gone = touched(asked, answer.ref, ...others)
    set((s) => {
      const details = { ...s.details }
      for (const ref of gone) delete details[ref]
      details[asked] = { state: "ready", person: answer }
      return { details }
    })
    try {
      const read = await platform.peopleRead()
      if (read.kind !== "ready") return
      set((s) => ({
        people: read.people,
        peopleMore: read.peopleMore,
        matches: [
          ...read.matches,
          ...s.matches.filter((m) => s.decided[m.id] && !read.matches.some((r) => r.id === m.id)),
        ],
        matchesMore: read.matchesMore,
      }))
    } catch {
      // The person's own answer already shows; the lists catch up on the next read.
    }
    const open = get().open
    if (open && !get().details[open]) void get().loadDetail(open)
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
    query: "",
    found: null,
    open: null,
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
    setQuery: (query) => set({ query, found: null }),
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
    toggle(ref) {
      const opening = get().open !== ref
      set({ open: opening ? ref : null })
      if (opening) void get().loadDetail(ref)
    },
    reveal(ref) {
      set({ open: ref, query: "", found: null })
      void get().loadDetail(ref)
      requestAnimationFrame(() =>
        document.querySelector(`[data-person="${ref}"]`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }),
      )
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
