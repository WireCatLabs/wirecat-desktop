import { create } from "zustand"
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

type PeopleState = {
  /** `missing` and `old` as memo answered; `ready` keeps no lists, which live below. */
  read: PeopleRead["kind"] | null
  oldVersion: { version: string | null; need: string } | null
  people: Listed[]
  /** The matches as the last full read found them: a decided one stays in place until the next read. */
  matches: Match[]
  decided: Record<string, MatchAnswer>
  reading: boolean
  error: string | null
  query: string
  open: string | null
  details: Record<string, Detail>
  busy: Record<string, Op>
  failed: Record<string, string>
  done: Record<string, Done>
  /** The person whose accounts the split dialog is choosing from. */
  splitting: string | null
  /** The merge the undo dialog asks about, on its person. */
  undoing: { ref: string; merge: string } | null
  load(): Promise<void>
  setQuery(query: string): void
  toggle(ref: string): void
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

  const run = async <T>(ref: string, op: Op, f: () => Promise<T>): Promise<T | null> => {
    if (get().busy[ref]) return null
    set((s) => ({ busy: { ...s.busy, [ref]: op }, failed: without(s.failed, ref), done: without(s.done, ref) }))
    try {
      return await f()
    } catch (e) {
      set((s) => ({ failed: { ...s.failed, [ref]: message(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, ref) }))
    }
  }

  const shown = (person: PersonDetail) =>
    set((s) => ({ details: { ...s.details, [person.ref]: { state: "ready", person } } }))

  /** The list behind the open person changed too (a merge, a new person); read it again without closing anything. */
  const refreshList = async () => {
    try {
      const read = await platform.peopleRead()
      if (read.kind === "ready") set({ people: read.people })
    } catch {
      // The person's own answer already shows; the list catches up on the next read.
    }
  }

  return {
    read: null,
    oldVersion: null,
    people: [],
    matches: [],
    decided: {},
    reading: false,
    error: null,
    query: "",
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
        set({
          read: read.kind,
          oldVersion: read.kind === "old" ? { version: read.version, need: read.need } : null,
          people: read.kind === "ready" ? read.people : [],
          matches: read.kind === "ready" ? read.matches : [],
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
    setQuery: (query) => set({ query }),
    toggle(ref) {
      const opening = get().open !== ref
      set({ open: opening ? ref : null })
      if (opening) void get().loadDetail(ref)
    },
    async loadDetail(ref, again = false) {
      const had = get().details[ref]
      if (!again && had && had.state !== "failed") return
      set((s) => ({ details: { ...s.details, [ref]: { state: "loading" } } }))
      try {
        shown(await platform.peopleShow(ref))
      } catch (e) {
        set((s) => ({ details: { ...s.details, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async decide(ref, id, answer, reason) {
      const match = get().matches.find((m) => m.id === id)
      const updated = await run(id, answer, () => platform.peopleDecide(ref, id, answer, reason))
      if (!updated) return false
      shown(updated)
      const other = match?.persons.find((p) => p !== ref) ?? ""
      set((s) => ({ decided: { ...s.decided, [id]: answer }, done: { ...s.done, [ref]: { op: answer, with: other } } }))
      void refreshList()
      return true
    },
    async unlink(ref, identities) {
      const result = await run(ref, "unlink", () => platform.peopleUnlink(ref, identities))
      set({ splitting: null })
      if (!result) return false
      shown(result.person)
      set((s) => ({ done: { ...s.done, [ref]: { op: "unlink", movedTo: result.movedTo, count: identities.length } } }))
      void refreshList()
      return true
    },
    async unmerge(ref, merge) {
      const from = (() => {
        const d = get().details[ref]
        return d?.state === "ready" ? (d.person.merges.find((m) => m.id === merge)?.from ?? "") : ""
      })()
      const updated = await run(ref, "unmerge", () => platform.peopleUnmerge(ref, merge))
      set({ undoing: null })
      if (!updated) return false
      shown(updated)
      set((s) => ({ done: { ...s.done, [ref]: { op: "unmerge", from } } }))
      void refreshList()
      return true
    },
    askSplit: (ref) => set({ splitting: ref }),
    askUndo: (undo) => set({ undoing: undo }),
  }
})
