import { create } from "zustand"
import { boardQuery, type DueChoice, placeKey, type State, setDue } from "@/domain/tasks"
import { platform } from "@/platform/bridge"
import type {
  NewTask,
  Person,
  Project,
  Task,
  TaskComment,
  TaskCounts,
  TaskEdit,
  TaskEvent,
  TaskWrite,
} from "@/platform/task-schemas"
import { errorText } from "@/shared/errors"
import { fresh } from "@/shared/fresh"
import { queryClient } from "@/shared/query"

export type View = "table" | "board"
export type Unusable = { kind: "missing" } | { kind: "old"; version: string | null; need: string }
export type History =
  | { state: "loading" }
  | { state: "ready"; events: TaskEvent[] }
  | { state: "failed"; message: string }
/** A comment on screen; `local` keeps its place while memo saves it and after, so the row never remounts. */
export type ShownComment = TaskComment & { local?: string; saving?: true }
export type Comments =
  | { state: "loading" }
  | { state: "ready"; items: ShownComment[] }
  | { state: "failed"; message: string }
/** A subtask memo would not move on its own: its parent, and the project the owner chose. */
export type Detach = { parent: string; project: string }
/** A write Memo refused because the task changed after the page read it. */
export type Stale = { key: string; last: TaskEvent | null }
/** A line under the board or table that says what a write did beyond what the owner saw: "HRB-3 is now High". */
export type Note = { key: string; label: string | null; column: State | null; text?: string }

type TasksState = {
  /** The tour's example rows are on screen (onboarding/demo.ts): a read waits until they go. */
  demo: boolean
  /** What the owner typed or the filters wrote; memo reads it, the page filters nothing itself. */
  query: string
  view: View
  /** null until the first read answers. */
  unusable: Unusable | null
  reading: boolean
  loaded: boolean
  error: string | null
  badQuery: string | null
  tasks: Task[]
  /**
   * The order on screen. It is fixed when the page reads, so an edited row or a dropped card stays where the owner
   * left it (rule 9) until the next read.
   */
  order: string[]
  total: number
  more: boolean
  counts: TaskCounts | null
  people: Person[]
  /** Who has a task on the page, as the rows' assignee choices; the full list is searched in the person finder. */
  assigned: string[]
  projects: Project[]
  /** When the tasks and the projects were last read; a page opened again within a minute reads nothing. */
  readAt: number | null
  projectsAt: number | null
  open: string | null
  /** Counts the tasks opened; the dialog's form lives for one, so a move that renames the open task keeps it. */
  opened: number
  /** Tasks opened through a "waits for" link that the current search leaves out; never shown in the list. */
  outside: Record<string, Task>
  busy: Record<string, true>
  failed: Record<string, string>
  stale: Stale | null
  note: Note | null
  history: Record<string, History>
  comments: Record<string, Comments>
  /** A comment memo refused, by task, waiting to go back into the box; kept here so a closed dialog keeps it too. */
  unsent: Record<string, string>
  /** The subtasks a move to another project took along, by the moved task's new key, so its dialog can say so. */
  moved: Record<string, { from: string; to: string }[]>
  /** A move memo refused because the task is a subtask; the page offers to move it out of its parent. */
  detach: Record<string, Detach>
  creating: boolean
  /** The table's page, from 1; a new search starts again at 1. */
  page: number
  pageSize: number
  setPage(page: number): void
  setPageSize(size: number): void
  load(quiet?: boolean): Promise<void>
  /** The page opened: a read unless the last one is under a minute old; the rows on screen stay while it runs. */
  visit(): void
  type(query: string): void
  setQuery(query: string): void
  setDue(choice: DueChoice | null): void
  setView(view: View): void
  toggle(key: string | null): void
  /** Opens a task in the dialog, reading it first when the list does not hold it. */
  openTask(key: string): Promise<void>
  update(key: string, edit: TaskEdit): Promise<boolean>
  assign(key: string, person: string | null): Promise<void>
  move(
    key: string,
    state: State,
    anchor: { before?: string; after?: string },
    beforeOnScreen: string | null,
  ): Promise<void>
  create(task: NewTask): Promise<boolean>
  loadHistory(key: string): Promise<void>
  loadComments(key: string): Promise<void>
  /**
   * Shows the owner's comment at once and has memo save it; a refusal takes it out, with the reason in `failed` and
   * the text in `unsent`.
   */
  comment(key: string, text: string): Promise<boolean>
  takeUnsent(key: string): string | null
  /** Adds a person by name and answers them, or null when memo refused. */
  addPerson(name: string): Promise<Person | null>
  /** Remembers a person the finder found, so the row shows their name rather than a reference. */
  know(person: Person): void
  startCreate(on: boolean): void
  dismissStale(): void
}

/** The finder's cached searches, shared by every row and the new task's form. */
export const PEOPLE_FOUND = ["tasks", "people", "found"] as const
export const FINDER_FRESH_MS = 5 * 60_000

const VIEW_KEY = "wirecat.tasks.view"

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table"
  } catch {
    return "table"
  }
}

/** A refused move is said on its card, apart from a refused edit, which the dialog and the table say. */
export const moveSlot = (key: string) => `move:${key}`

const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

const TYPING_MS = 350

/**
 * memo shows a found task only as its account and refuses without one, listing every account it stores. A task opened
 * from a link or a row a filter hides has no account on the page yet, so each listed account is tried in turn.
 */
const showAsAny = async (key: string, refusal: unknown) => {
  const text = errorText(refusal)
  if (!/\bgive --(source|account)\b/.test(text)) throw refusal
  for (const [, account] of text.matchAll(/--(?:source|account) ([\w-]+:[^\s;]+)/g)) {
    const task = await platform.taskShow(key, account).catch(() => null)
    if (task) return task
  }
  throw refusal
}

export const useTasks = create<TasksState>((set, get) => {
  let seq = 0
  let drafts = 0
  let typing: ReturnType<typeof setTimeout> | undefined
  const asking = new Set<string>()

  /** Adds or renames people; the owner keeps the mark only memo's list gives. */
  const learn = (found: Person[]) =>
    set((s) => {
      const owner = new Set(s.people.filter((p) => p.owner).map((p) => p.ref))
      const added = found.filter((f) => !owner.has(f.ref))
      return { people: [...s.people.filter((p) => !added.some((f) => f.ref === p.ref)), ...added] }
    })

  let naming: Promise<void> = Promise.resolve()

  /**
   * Names only the people on the page: memo's full list of people takes seconds. One ask at a time: memo 0.131.76's
   * command server mixes the options of two `people show` calls at once.
   */
  const name = (refs: string[]) => {
    const known = new Set(get().people.map((p) => p.ref))
    const missing = [...new Set(refs)].filter((r) => r.startsWith("person:") && !known.has(r) && !asking.has(r))
    if (missing.length === 0) return naming
    for (const r of missing) asking.add(r)
    naming = naming.then(async () => {
      const found = await platform.peopleNamed(missing).catch(() => null)
      for (const r of missing) asking.delete(r)
      if (found) learn(found)
    })
    return naming
  }

  /**
   * memo marks the owner only in its people list, which costs seconds on a large store whatever its limit; the
   * finder's first search is that list, so it is read once, after the page has its data, and the finder opens on it.
   */
  const findOwner = async () => {
    if (get().people.some((p) => p.owner)) return
    const found = await queryClient()
      .fetchQuery({
        queryKey: [...PEOPLE_FOUND, ""],
        queryFn: () => platform.peopleSearch(""),
        staleTime: FINDER_FRESH_MS,
      })
      .catch(() => null)
    if (found) learn(found)
  }

  /** The open task keeps its history on screen while it is read again; any other reads it when next opened. */
  const forget = (s: TasksState, key: string) => (s.open === key ? s.history : without(s.history, key))

  const replace = (task: Task) =>
    set((s) =>
      s.outside[task.key] && !s.tasks.some((t) => t.key === task.key)
        ? { outside: { ...s.outside, [task.key]: task }, history: forget(s, task.key) }
        : {
            tasks: s.tasks.some((t) => t.key === task.key)
              ? s.tasks.map((t) =>
                  t.key === task.key ? { ...task, ready: task.ready ?? t.ready, blockedBy: t.blockedBy } : t,
                )
              : [task, ...s.tasks],
            history: forget(s, task.key),
          },
    )

  const recount = async () => {
    try {
      const counts = await platform.taskCounts(boardQuery(get().query))
      set({ counts })
    } catch {
      // The counts are a guide; the list stays right without them.
    }
  }

  /** Neighbours memo renumbered to make room keep their place on screen and get their new revisions. */
  const refresh = async (keys: string[]) => {
    if (keys.length === 0) return
    const fresh = await Promise.all(keys.map((k) => platform.taskShow(k, find(k)?.account).catch(() => null)))
    for (const t of fresh) if (t) replace(t)
  }

  /** Applies a write's answer; `undo` puts back what the page showed before it. */
  const settle = async (
    key: string,
    write: () => Promise<TaskWrite>,
    undo?: () => void,
    slot = key,
  ): Promise<TaskWrite | null> => {
    set((s) => ({
      busy: { ...s.busy, [key]: true },
      failed: without(without(s.failed, key), moveSlot(key)),
      moved: without(s.moved, key),
      detach: without(s.detach, key),
      stale: null,
      note: null,
    }))
    try {
      const out = await write()
      let now = key
      if (out.kind === "stale") {
        undo?.()
        replace(out.current)
        set({ stale: { key, last: out.last } })
      } else if (out.kind === "isSubtask") {
        // `update` records the project the owner chose, which this answer does not carry.
      } else if (out.task.key !== key) {
        rename(key, out.task)
        now = out.task.key
        if (out.moved.length) {
          set((s) => ({ moved: { ...s.moved, [now]: out.moved } }))
          const carried = await Promise.all(out.moved.map((x) => platform.taskShow(x.to).catch(() => null)))
          out.moved.forEach((x, i) => {
            const t = carried[i]
            if (t) rename(x.from, t)
          })
        }
      } else {
        replace(out.task)
        void refresh(out.renumbered)
      }
      if (get().open === now) void get().loadHistory(now)
      void recount()
      return out
    } catch (e) {
      undo?.()
      set((s) => ({ failed: { ...s.failed, [slot]: errorText(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, key) }))
    }
  }

  const find = (key: string) => get().tasks.find((t) => t.key === key) ?? get().outside[key]

  /** A task moved to another project has a new key; everything the page keeps by key follows it. */
  const rename = (from: string, task: Task) =>
    set((s) => {
      const move = <T>(record: Record<string, T>) => {
        const { [from]: kept, ...rest } = record
        return kept === undefined ? rest : { ...rest, [task.key]: kept }
      }
      const inList = s.tasks.some((t) => t.key === from)
      return {
        tasks: s.tasks.map((t) => (t.key === from ? { ...task, ready: task.ready ?? t.ready } : t)),
        order: s.order.map((k) => (k === from ? task.key : k)),
        outside: inList ? s.outside : { ...without(s.outside, from), [task.key]: task },
        open: s.open === from ? task.key : s.open,
        history: s.open === from ? move(s.history) : without(s.history, from),
        comments: move(s.comments),
        unsent: move(s.unsent),
        moved: without(s.moved, from),
        detach: without(s.detach, from),
      }
    })

  return {
    demo: false,
    query: "",
    view: savedView(),
    unusable: null,
    reading: false,
    loaded: false,
    error: null,
    badQuery: null,
    tasks: [],
    order: [],
    total: 0,
    more: false,
    counts: null,
    people: [],
    assigned: [],
    projects: [],
    readAt: null,
    projectsAt: null,
    open: null,
    opened: 0,
    outside: {},
    busy: {},
    failed: {},
    stale: null,
    note: null,
    history: {},
    comments: {},
    unsent: {},
    moved: {},
    detach: {},
    creating: false,
    page: 1,
    pageSize: 50,

    async load(quiet = false) {
      if (get().demo) return
      const mine = ++seq
      const q = boardQuery(get().query)
      set({ reading: true, ...(quiet ? {} : { error: null }) })
      const counts = platform.taskCounts(q).catch(() => null)
      // A keystroke reads the tasks again, not the projects.
      const projects = fresh(get().projectsAt) ? Promise.resolve(null) : platform.projectList().catch(() => null)
      void counts.then((c) => {
        if (mine !== seq || get().demo) return
        set({ counts: c })
        if (!c) return
        // memo's counts carry each assignee's name, so only the rest are asked for.
        const known = new Set(get().people.map((p) => p.ref))
        learn(
          c.assignee
            .filter((f) => f.value.startsWith("person:") && f.name && !known.has(f.value))
            .map((f) => ({ ref: f.value, name: f.name, owner: false })),
        )
        void name(c.assignee.map((f) => f.value))
      })
      void projects.then((j) => {
        if (mine !== seq || get().demo || !j) return
        set({ projects: j, projectsAt: Date.now() })
      })
      try {
        const read = await platform.taskList(q)
        if (mine !== seq || get().demo) return
        if (read.kind === "missing" || read.kind === "old") {
          set({ unusable: read, loaded: true, reading: false })
          return
        }
        if (read.kind === "badQuery") {
          set({ unusable: null, badQuery: read.message, loaded: true, reading: false })
          return
        }
        const tasks = read.tasks
        set({
          unusable: null,
          badQuery: null,
          error: null,
          tasks,
          assigned: [...new Set(tasks.flatMap((t) => t.assignees))],
          order: tasks.map((t) => t.key),
          total: read.total,
          more: read.more,
          // The open task stays readable in its dialog when the new search leaves it out.
          outside: Object.fromEntries(
            [find(get().open ?? "")]
              .filter((t): t is Task => Boolean(t && !tasks.some((x) => x.key === t.key)))
              .map((t) => [t.key, t]),
          ),
          failed: {},
          stale: null,
          loaded: true,
          reading: false,
          readAt: Date.now(),
        })
        void name(get().assigned)
      } catch (e) {
        if (mine === seq && !get().demo) set({ error: errorText(e), loaded: true, reading: false })
        return
      }
      await Promise.all([counts, projects])
      if (mine === seq && !get().demo) void findOwner()
    },

    visit() {
      if (!get().demo && !fresh(get().readAt)) void get().load()
    },

    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),

    type(query) {
      set({ query, page: 1 })
      clearTimeout(typing)
      typing = setTimeout(() => void get().load(), TYPING_MS)
    },

    setQuery(query) {
      clearTimeout(typing)
      set({ query, page: 1 })
      void get().load()
    },

    setDue(choice) {
      get().setQuery(setDue(get().query, choice))
    },

    setView(view) {
      try {
        localStorage.setItem(VIEW_KEY, view)
      } catch {
        // A remembered view is a convenience; without storage the page opens on the table.
      }
      set({ view, open: null })
    },

    toggle(key) {
      set((s) => ({ open: key === null || s.open === key ? null : key, opened: s.opened + 1 }))
      if (key && get().open === key && !get().history[key]) void get().loadHistory(key)
      if (key && get().open === key && !get().comments[key]) void get().loadComments(key)
    },

    async openTask(key) {
      set((s) => ({
        open: key,
        opened: s.open === key ? s.opened : s.opened + 1,
        failed: find(key) ? s.failed : without(s.failed, key),
      }))
      if (!get().history[key]) void get().loadHistory(key)
      if (!get().comments[key]) void get().loadComments(key)
      if (find(key)) return
      try {
        const task = await platform.taskShow(key).catch((e: unknown) => showAsAny(key, e))
        // The list may have arrived meanwhile; the copy in it is the one rows and writes use.
        if (!find(key)) set((s) => ({ outside: { ...s.outside, [key]: task } }))
      } catch (e) {
        set((s) => ({ failed: { ...s.failed, [key]: errorText(e) } }))
      }
    },

    async update(key, edit) {
      const t = find(key)
      if (!t) return false
      const out = await settle(key, () =>
        platform.taskUpdate(key, t.revision, t.account ? { ...edit, account: t.account } : edit),
      )
      if (out?.kind === "isSubtask" && edit.project) {
        const detach = { parent: out.parent, project: edit.project }
        set((s) => ({ detach: { ...s.detach, [key]: detach } }))
      }
      return out?.kind === "saved"
    },

    async assign(key, person) {
      const t = find(key)
      if (!t) return
      if (person) set((s) => ({ assigned: s.assigned.includes(person) ? s.assigned : [...s.assigned, person] }))
      await settle(key, () => platform.taskAssign(key, t.revision, person, t.account))
    },

    async move(key, state, anchor, beforeOnScreen) {
      const t = find(key)
      if (!t) return
      const before = { order: get().order, state: t.state }
      // The card stays where it was dropped while memo writes; a refusal puts it back.
      set((s) => ({
        order: placeKey(s.order, key, beforeOnScreen),
        tasks: s.tasks.map((x) => (x.key === key ? { ...x, state } : x)),
      }))
      const undo = () =>
        set((s) => ({
          order: before.order,
          tasks: s.tasks.map((x) => (x.key === key ? { ...x, state: before.state } : x)),
        }))
      const place = { ...(state !== t.state ? { state } : {}), ...anchor }
      if (!place.state && !place.before && !place.after) return
      const out = await settle(key, () => platform.taskMove(key, t.revision, place, t.account), undo, moveSlot(key))
      if (out?.kind === "saved" && (out.label || state !== before.state)) {
        set({ note: { key, label: out.label?.to ?? null, column: state !== before.state ? state : null } })
      }
    },

    async create(task) {
      set((s) => ({ busy: { ...s.busy, new: true }, failed: without(s.failed, "new") }))
      try {
        const out = await platform.taskCreate(task)
        if (out.kind !== "saved") throw new Error("memo did not answer the new task")
        const made = out.task
        set((s) => ({
          tasks: [made, ...s.tasks.filter((t) => t.key !== made.key)],
          order: [made.key, ...s.order.filter((k) => k !== made.key)],
          page: 1,
          total: s.total + 1,
          creating: false,
        }))
        void recount()
        void name(made.assignees)
        return true
      } catch (e) {
        set((s) => ({ failed: { ...s.failed, new: errorText(e) } }))
        return false
      } finally {
        set((s) => ({ busy: without(s.busy, "new") }))
      }
    },

    async loadHistory(key) {
      const shown = () => get().history[key]?.state === "ready"
      if (!shown()) set((s) => ({ history: { ...s.history, [key]: { state: "loading" } } }))
      try {
        const events = await platform.taskHistory(key)
        set((s) => ({ history: { ...s.history, [key]: { state: "ready", events } } }))
      } catch (e) {
        if (!shown()) set((s) => ({ history: { ...s.history, [key]: { state: "failed", message: errorText(e) } } }))
      }
    },

    async loadComments(key) {
      set((s) => ({ comments: { ...s.comments, [key]: { state: "loading" } } }))
      try {
        const items = await platform.taskComments(key)
        set((s) => ({ comments: { ...s.comments, [key]: { state: "ready", items } } }))
      } catch (e) {
        set((s) => ({ comments: { ...s.comments, [key]: { state: "failed", message: errorText(e) } } }))
      }
    },

    async comment(key, text) {
      const slot = `comment:${key}`
      const local = `saving:${++drafts}`
      const items = (change: (items: ShownComment[]) => ShownComment[]) =>
        set((s) => {
          const had = s.comments[key]
          return {
            comments: {
              ...s.comments,
              [key]: { state: "ready", items: change(had?.state === "ready" ? had.items : []) },
            },
          }
        })
      const author = { type: "person", name: null, owner: true }
      set((s) => ({ failed: without(s.failed, slot) }))
      items((all) => [...all, { ref: null, text, author, at: new Date().toISOString(), local, saving: true }])
      try {
        const said = await platform.taskCommentAdd(key, text)
        items((all) => all.map((c) => (c.local === local ? { ...said, local } : c)))
        return true
      } catch (e) {
        items((all) => all.filter((c) => c.local !== local))
        set((s) => ({
          failed: { ...s.failed, [slot]: errorText(e) },
          unsent: { ...s.unsent, [key]: s.unsent[key] ? `${s.unsent[key]}\n\n${text}` : text },
        }))
        return false
      }
    },

    takeUnsent(key) {
      const text = get().unsent[key] ?? null
      if (text !== null) set((s) => ({ unsent: without(s.unsent, key) }))
      return text
    },

    async addPerson(name) {
      set((s) => ({ failed: without(s.failed, "person") }))
      try {
        const person = await platform.personAdd(name)
        set((s) => ({ people: [...s.people.filter((p) => p.ref !== person.ref), person] }))
        void queryClient().invalidateQueries({ queryKey: PEOPLE_FOUND })
        return person
      } catch (e) {
        set((s) => ({ failed: { ...s.failed, person: errorText(e) } }))
        return null
      }
    },

    know(person) {
      set((s) => (s.people.some((p) => p.ref === person.ref) ? s : { people: [...s.people, person] }))
    },

    startCreate(on) {
      set({ creating: on })
    },

    dismissStale() {
      set({ stale: null })
    },
  }
})
