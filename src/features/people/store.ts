import { create } from "zustand"
import { looksLikeAccount, touched } from "@/domain/people"
import { STATES, setField } from "@/domain/tasks"
import { platform } from "@/platform/bridge"
import type {
  Doubts,
  KindCount,
  Listed,
  Match,
  MatchAnswer,
  PeopleRead,
  PeopleSort,
  PersonDetail,
  PersonKind,
  Resolved,
  Split,
} from "@/platform/people-schemas"
import type { TaskRead } from "@/platform/task-schemas"
import { fresh } from "@/shared/fresh"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type TasksOf = { state: "loading" } | { state: "ready"; read: TaskRead } | { state: "failed"; error: string }

/**
 * A person's tasks as the table counts them: every project and every state, since memo's search otherwise leaves
 * closed tasks out, and refuses `assignee:` without `project:`.
 */
export const tasksQuery = (ref: string) => `project:* ${setField("", "assignee", [ref])} state:(${STATES.join(" OR ")})`

export type Detail =
  | { state: "loading" }
  | { state: "ready"; person: PersonDetail }
  | { state: "failed"; error: string }
export type Op = MatchAnswer | "unlink" | "unmerge" | "keep"
/** What the owner just did on a person, said where it happened until the page is read again (rule 9). */
export type Done =
  | { op: "confirm" | "reject"; with: string }
  | { op: "unlink"; movedTo: string; count: number }
  | { op: "unmerge"; from: string }
export type View = "people" | "matches"
export type MailboxRefusal = Extract<Resolved, { kind: "refused" }>
/** Where the owner gave a shared mailbox, and memo's refusal that stopped the rest of its pairs, if one did. */
export type MailboxDone = { organization: string | null; mailbox: string | null; refused: MailboxRefusal | null }
/** What joining some of a group did: who was joined, in order, and why the rest were not, if a join failed. */
export type GroupDone = { joined: string[]; stopped: string | null }
/** One page of `people links check`; kept on screen while the next page or a read again is on its way. */
export type DoubtsRead =
  | { state: "loading"; page: number; last: Doubts | null }
  | { state: "ready"; page: number; last: Doubts }
  | { state: "failed"; page: number; error: string; last: Doubts | null }
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
  /** Everyone of the kind (and name searched) that memo cuts the pages from; null from an older memo. */
  total: KindCount | null
  /** The order memo cuts the pages in. */
  sort: PeopleSort
  /** The kind of people the table lists; memo lists one kind at a time. */
  kind: PersonKind
  /** memo knows kinds; false for an older memo, whose one list is everyone. */
  kinded: boolean
  /** People of each kind, for the tabs; read apart from the list and empty until it comes. */
  kinds: Partial<Record<PersonKind, { value: number; more: boolean }>>
  /** Whether each person read so far is the owner, and their tasks: a match may name someone from another tab. */
  seen: Record<string, { owner: boolean; tasks: number }>
  /** The open matches, with any the owner decided since the last full read kept in place. */
  matches: Match[]
  matchesMore: boolean
  decided: Record<string, MatchAnswer>
  /** Splits an agent proposed, with any the owner decided since the last full read kept in place. */
  splits: Split[]
  splitDecided: Record<string, MatchAnswer>
  doubts: DoubtsRead | null
  /** The tasks assigned to each person opened, read when their card opens. */
  tasks: Record<string, TasksOf>
  reading: boolean
  /** When memo last answered; the page reads again only when it is older than a minute. */
  readAt: number | null
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
  /** By card: a shared mailbox given to a company, or memo's refusal before any pair of it was. */
  company: Record<string, MailboxDone>
  details: Record<string, Detail>
  busy: Record<string, Op>
  failed: Record<string, string>
  done: Record<string, Done>
  splitting: string | null
  /** The accounts the Move dialog opens with ticked, when a doubt named them. */
  splitPreset: string[]
  undoing: { ref: string; merge: string } | null
  /** `counts: false` keeps the tabs' counts: a tab switch does not change them. */
  load(counts?: boolean): Promise<void>
  /** The page opened: a read unless the last one is under a minute old; what it shows stays while it runs. */
  visit(): void
  setView(view: View): void
  setKind(kind: PersonKind): void
  setQuery(query: string): void
  setFilter(filter: { withTasks?: boolean; named?: boolean }): void
  setPage(page: number): void
  setPageSize(size: number): void
  setSort(sort: PeopleSort): void
  /** The rows on screen: one page of one kind, cut, sorted and searched by memo. */
  readPage(): Promise<void>
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
  /**
   * Gives the shared mailbox of a card to a company, one pair after another (memo has no call for the whole address
   * yet): the first pair finds or makes the organization, the rest go to that same one. Stops at memo's first refusal.
   */
  resolveMailbox(key: string, ids: readonly string[], to: { organization?: string; name?: string }): Promise<boolean>
  /** Joins the chosen people of a group into one; `ids` are the group's matches, kept in place as decided. */
  joinGroup(key: string, refs: string[], ids: string[]): Promise<boolean>
  /** Keeps the given pairs of a group apart, for one reason; stops at the first refusal. */
  rejectGroup(key: string, matches: Match[], reason: string): Promise<boolean>
  /** The owner's answer to a split an agent proposed; a turn-down carries the owner's reason. */
  decideSplit(id: string, answer: MatchAnswer, reason?: string): Promise<boolean>
  /** A page of the people whose accounts look wrongly joined; the page on screen when none is given. */
  readDoubts(page?: number): Promise<void>
  loadTasks(ref: string): Promise<void>
  /** The owner says this person's accounts in doubt are right; the failure lands in `failed` under the person. */
  keep(ref: string): Promise<boolean>
  unlink(ref: string, identities: string[]): Promise<boolean>
  unmerge(ref: string, merge: string): Promise<boolean>
  askSplit(ref: string | null, preset?: string[]): void
  askUndo(undo: { ref: string; merge: string } | null): void
}

const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

/** memo's command server keeps two processes; more calls at once would each start memo anew. */
const AT_ONCE = 2
/** Each doubt lists its accounts, so a page stays short. */
export const DOUBTS_PAGE = 5

export const usePeople = create<PeopleState>((set, get) => {
  let seq = 0
  let countSeq = 0
  let pageSeq = 0
  let typing: ReturnType<typeof setTimeout> | undefined
  let wanted: string[] = []
  // What a dialog needs now; the table's next list of rows must not drop it.
  let needed: string[] = []
  let doubtSeq = 0
  let running = 0

  const pump = () => {
    while (running < AT_ONCE) {
      const ref = [...needed, ...wanted].find((r) => !get().details[r])
      if (!ref) return
      needed = needed.filter((r) => r !== ref)
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
    const kind = get().kind
    try {
      const read = await platform.peopleRead(kind)
      if (read.kind !== "ready") return null
      // The owner may have switched tabs meanwhile: that tab's own read owns the list.
      if (read.kinded) void get().readPage()
      set((s) => ({
        ...(s.kind === kind && !read.kinded ? { people: read.people, peopleMore: read.peopleMore } : {}),
        seen: seenWith(s.seen, read.people),
        matches: [
          ...read.matches,
          ...s.matches.filter(
            (m) => (s.decided[m.id] || keep.includes(m.id)) && !read.matches.some((r) => r.id === m.id),
          ),
        ],
        matchesMore: read.matchesMore,
        // A decided split keeps its place; one memo lists for the first time goes after the rest.
        splits: [
          ...s.splits.flatMap((x) => {
            const fresh = read.splits.find((r) => r.id === x.id)
            return fresh ? [fresh] : s.splitDecided[x.id] ? [x] : []
          }),
          ...read.splits.filter((r) => !s.splits.some((x) => x.id === r.id)),
        ],
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
    total: null,
    sort: "interactions",
    kind: "person",
    kinded: false,
    kinds: {},
    seen: {},
    matches: [],
    matchesMore: false,
    decided: {},
    splits: [],
    splitDecided: {},
    doubts: null,
    tasks: {},
    reading: false,
    readAt: null,
    error: null,
    view: "people",
    query: "",
    withTasks: false,
    // An older memo lists the nameless with everyone; the page leaves them out until asked.
    named: true,
    page: 1,
    pageSize: 50,
    matchPage: 1,
    found: null,
    open: null,
    matchOpen: null,
    joinedGroup: {},
    company: {},
    details: {},
    busy: {},
    failed: {},
    done: {},
    splitting: null,
    splitPreset: [],
    undoing: null,

    async load(counts = true) {
      const call = ++seq
      const older = get().read === "ready" && !get().kinded
      set({ reading: true, error: null })
      // The tabs' counts take a call per kind; the table never waits for them.
      if (counts && !older) {
        // Apart from `seq`: a tab switch reads no counts, so it must not drop the ones on their way.
        const asked = ++countSeq
        platform
          .peopleKinds()
          .then((kinds) => {
            if (asked === countSeq) set({ kinds })
          })
          .catch(() => undefined)
      }
      // The page is read beside the matches, not after them: the rows paint as soon as memo cuts them.
      const paged = older ? null : get().readPage()
      try {
        const read = await platform.peopleRead(get().kind)
        // After the read, not beside it: memo's command server runs two calls at once and starts anew for a third.
        if (counts) void get().readDoubts()
        if (call !== seq) return
        const ready = read.kind === "ready" ? read : null
        const kinded = ready?.kinded ?? false
        if (kinded && !paged) void get().readPage()
        set((s) => ({
          seen: seenWith(s.seen, ready?.people ?? []),
          read: read.kind,
          oldVersion: read.kind === "old" ? { version: read.version, need: read.need } : null,
          ...(kinded
            ? {}
            : { people: ready?.people ?? [], peopleMore: ready?.peopleMore ?? false, total: null, error: null }),
          matches: ready?.matches ?? [],
          matchesMore: ready?.matchesMore ?? false,
          splits: ready?.splits ?? [],
          splitDecided: {},
          kinded,
          decided: {},
          joinedGroup: {},
          company: {},
          reading: kinded && s.reading,
          readAt: Date.now(),
          details: {},
          failed: {},
          done: {},
        }))
        const open = get().open
        if (open) void get().loadDetail(open)
      } catch (e) {
        if (call !== seq) return
        set({ error: message(e), reading: false })
      }
    },
    visit() {
      if (!fresh(get().readAt)) void get().load()
    },
    setView: (view) => set({ view }),
    setKind(kind) {
      clearTimeout(typing)
      set({ kind, page: 1, query: "", found: null })
      if (get().kinded) void get().readPage()
      else void get().load(false)
    },
    setQuery(query) {
      set({ query, found: null, page: 1 })
      if (!get().kinded) return
      clearTimeout(typing)
      // An account is found with Find account, not by name.
      if (looksLikeAccount(query)) return
      // Each key would be a read of memo: the search waits until the owner stops typing.
      typing = setTimeout(() => void get().readPage(), 300)
    },
    setFilter: (filter) => set({ ...filter, page: 1 }),
    setPage(page) {
      set({ page })
      if (get().kinded) void get().readPage()
    },
    setPageSize(pageSize) {
      set({ pageSize, page: 1 })
      if (get().kinded) void get().readPage()
    },
    setSort(sort) {
      set({ sort, page: 1 })
      void get().readPage()
    },
    async readPage() {
      clearTimeout(typing)
      const asked = ++pageSeq
      const { kind, page, pageSize, query, sort } = get()
      set({ reading: true })
      try {
        const got = await platform.peoplePage({ kind, page, size: pageSize, query: query.trim(), sort })
        if (asked !== pageSeq) return
        // A merge or a decision can shrink the kind under the page the owner is on: go to its new last page.
        const last = got.total ? Math.max(1, Math.ceil(got.total.value / pageSize)) : page
        if (got.people.length === 0 && page > last) {
          set({ page: last })
          return get().readPage()
        }
        set((s) => ({
          people: got.people,
          peopleMore: got.more,
          total: got.total,
          seen: seenWith(s.seen, got.people),
          reading: false,
          error: null,
        }))
      } catch (e) {
        if (asked !== pageSeq) return
        // Missing, too old or older than kinds: the page's own read says so, not this refusal.
        if (get().read !== null && !get().kinded) return set({ reading: false })
        set({ error: message(e), reading: false })
      }
    },
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
      needed = [ref, ...needed.filter((r) => r !== ref)]
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
    async resolveMailbox(key, ids, to) {
      const done = await run(key, "reject", async () => {
        const closed: string[] = []
        let last: PersonDetail | null = null
        let refused: MailboxRefusal | null = null
        let organization = to.organization ?? null
        let mailbox: string | null = null
        try {
          for (const id of ids) {
            const m = get().matches.find((x) => x.id === id)
            if (!m || get().decided[id]) continue
            const r = await platform.peopleResolve(m.persons[0] ?? "", id, organization ? { organization } : to)
            if (r.kind === "refused") {
              // A pair memo already closed, as the first one's answer may close the rest, is no reason to stop.
              if (r.reason === "proposal.wrong-state") continue
              refused = r
              break
            }
            closed.push(id)
            last = r.person
            organization = r.organization ?? organization
            mailbox = r.mailbox ?? mailbox
          }
        } finally {
          set((s) => ({
            decided: { ...s.decided, ...Object.fromEntries(closed.map((id) => [id, "reject" as const])) },
          }))
          const answer = last as PersonDetail | null
          if (answer) {
            const persons = get()
              .matches.filter((m) => ids.includes(m.id))
              .flatMap((m) => m.persons)
            await settle(answer, answer.ref, persons, ids)
          }
        }
        return { organization: closed.length ? organization : null, mailbox, refused }
      })
      if (!done) return false
      set((s) => ({ company: { ...s.company, [key]: done } }))
      return done.refused === null
    },
    async joinGroup(key, refs, ids) {
      // The card stays busy until the lists are read again, so it never offers the pairs memo just folded away.
      const done = await run(key, "confirm", async () => {
        const result = await platform.peopleMerge(refs)
        const open = await settle(result.person, result.person.ref, refs, ids)
        return { result, open }
      })
      if (!done) return false
      const { result, open } = done
      // Without a fresh read, only the matches memo said it confirmed are known to be closed.
      const closed = open ? ids.filter((id) => !open.has(id)) : result.confirmed
      set((s) => ({
        joinedGroup: { ...s.joinedGroup, [key]: { joined: result.joined, stopped: result.stopped } },
        decided: { ...s.decided, ...Object.fromEntries(closed.map((id) => [id, "confirm" as const])) },
      }))
      return true
    },
    async rejectGroup(key, matches, reason) {
      const kept: string[] = []
      let last: PersonDetail | null = null
      await run(key, "reject", async () => {
        try {
          for (const m of matches) {
            last = await platform.peopleDecide(m.persons[0] ?? "", m.id, "reject", reason)
            kept.push(m.id)
          }
        } finally {
          set((s) => ({ decided: { ...s.decided, ...Object.fromEntries(kept.map((id) => [id, "reject" as const])) } }))
          const answer = last as PersonDetail | null
          if (answer)
            await settle(
              answer,
              answer.ref,
              matches.flatMap((m) => m.persons),
              kept,
            )
        }
      })
      return kept.length === matches.length
    },
    async decideSplit(id, answer, reason) {
      const split = get().splits.find((x) => x.id === id)
      if (!split) return false
      const d = get().details[split.person]
      const merged = d?.state === "ready" ? d.person.merges.find((m) => m.id === split.merge) : undefined
      const from = answer === "confirm" && split.op === "unmerge" ? (merged?.from ?? "") : ""
      const updated = await run(id, answer, () => platform.peopleSplitDecide(split.person, id, answer, reason))
      if (!updated) return false
      set((s) => ({
        splitDecided: { ...s.splitDecided, [id]: answer },
        ...(from ? { done: { ...s.done, [split.person]: { op: "unmerge" as const, from } } } : {}),
      }))
      await settle(updated, split.person, from ? [from] : [])
      if (answer === "confirm") void get().readDoubts()
      return true
    },
    async loadTasks(ref) {
      set((s) => ({ tasks: { ...s.tasks, [ref]: { state: "loading" } } }))
      try {
        const read = await platform.taskList(tasksQuery(ref))
        set((s) => ({ tasks: { ...s.tasks, [ref]: { state: "ready", read } } }))
      } catch (e) {
        set((s) => ({ tasks: { ...s.tasks, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async readDoubts(page) {
      const asked = ++doubtSeq
      const had = get().doubts
      const at = page ?? had?.page ?? 1
      const last = had?.last ?? null
      set({ doubts: { state: "loading", page: at, last } })
      try {
        const got = await platform.peopleDoubts(at, DOUBTS_PAGE)
        if (asked !== doubtSeq) return
        // A fix can empty the page the owner is on: go back to the last page that still has someone.
        if (got.items.length === 0 && at > 1) return get().readDoubts(at - 1)
        set({ doubts: { state: "ready", page: at, last: got } })
      } catch (e) {
        if (asked !== doubtSeq) return
        set({ doubts: { state: "failed", page: at, error: message(e), last } })
      }
    },
    async keep(ref) {
      const asked = await run(ref, "keep", async () => {
        await platform.peopleKeep(ref)
        return true
      })
      if (!asked) return false
      await get().readDoubts()
      return true
    },
    async unlink(ref, identities) {
      const result = await run(ref, "unlink", () => platform.peopleUnlink(ref, identities))
      set({ splitting: null })
      if (!result) return false
      set((s) => ({ done: { ...s.done, [ref]: { op: "unlink", movedTo: result.movedTo, count: identities.length } } }))
      await settle(result.person, ref, [result.movedTo])
      void get().readDoubts()
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
      void get().readDoubts()
      return true
    },
    askSplit: (ref, preset = []) => set({ splitting: ref, splitPreset: ref ? preset : [] }),
    askUndo: (undo) => set({ undoing: undo }),
  }
})

const seenWith = (seen: PeopleState["seen"], people: readonly Listed[]) => ({
  ...seen,
  ...Object.fromEntries(people.map((p) => [p.ref, { owner: p.owner, tasks: p.tasks }])),
})
