import { create } from "zustand"
import { boardQuery, type DueChoice, placeKey, type State, setDue } from "@/domain/tasks"
import { platform } from "@/platform/bridge"
import type {
  NewTask,
  Person,
  Project,
  Task,
  TaskCounts,
  TaskEdit,
  TaskEvent,
  TaskWrite,
} from "@/platform/task-schemas"

export type View = "table" | "board"
export type Unusable = { kind: "missing" } | { kind: "old"; version: string | null; need: string }
export type History = { state: "loading" } | { state: "ready"; events: TaskEvent[] } | { state: "failed" }
/** A write Memo refused because the task changed after the page read it. */
export type Stale = { key: string; last: TaskEvent | null }
/** A line under the board or table that says what a write did beyond what the owner saw: "HRB-3 is now High". */
export type Note = { key: string; label: string | null; column: State | null }

type TasksState = {
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
  projects: Project[]
  open: string | null
  busy: Record<string, true>
  failed: Record<string, string>
  stale: Stale | null
  note: Note | null
  history: Record<string, History>
  creating: boolean
  load(quiet?: boolean): Promise<void>
  type(query: string): void
  setQuery(query: string): void
  setDue(choice: DueChoice | null): void
  setView(view: View): void
  toggle(key: string | null): void
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
  startCreate(on: boolean): void
  dismissStale(): void
}

const VIEW_KEY = "wirecat.tasks.view"

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table"
  } catch {
    return "table"
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

const TYPING_MS = 350

export const useTasks = create<TasksState>((set, get) => {
  let seq = 0
  let typing: ReturnType<typeof setTimeout> | undefined

  const replace = (task: Task) =>
    set((s) => ({
      tasks: s.tasks.some((t) => t.key === task.key)
        ? s.tasks.map((t) =>
            t.key === task.key ? { ...task, ready: task.ready ?? t.ready, blockedBy: t.blockedBy } : t,
          )
        : [task, ...s.tasks],
      history: without(s.history, task.key),
    }))

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
    const fresh = await Promise.all(keys.map((k) => platform.taskShow(k).catch(() => null)))
    for (const t of fresh) if (t) replace(t)
  }

  /** Applies a write's answer; `undo` puts back what the page showed before it. */
  const settle = async (key: string, write: () => Promise<TaskWrite>, undo?: () => void): Promise<TaskWrite | null> => {
    set((s) => ({ busy: { ...s.busy, [key]: true }, failed: without(s.failed, key), stale: null, note: null }))
    try {
      const out = await write()
      if (out.kind === "stale") {
        undo?.()
        replace(out.current)
        set({ stale: { key, last: out.last } })
      } else {
        replace(out.task)
        void refresh(out.renumbered)
      }
      if (get().open === key) void get().loadHistory(key)
      void recount()
      return out
    } catch (e) {
      undo?.()
      set((s) => ({ failed: { ...s.failed, [key]: message(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, key) }))
    }
  }

  const find = (key: string) => get().tasks.find((t) => t.key === key)

  return {
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
    projects: [],
    open: null,
    busy: {},
    failed: {},
    stale: null,
    note: null,
    history: {},
    creating: false,

    async load(quiet = false) {
      const mine = ++seq
      const q = boardQuery(get().query)
      set({ reading: true, ...(quiet ? {} : { error: null }) })
      const counts = platform.taskCounts(q).catch(() => null)
      const people = platform.peopleList().catch(() => null)
      const projects = platform.projectList().catch(() => null)
      try {
        const read = await platform.taskList(q)
        if (mine !== seq) return
        if (read.kind === "missing" || read.kind === "old") {
          set({ unusable: read, loaded: true, reading: false })
          return
        }
        if (read.kind === "badQuery") {
          set({ unusable: null, badQuery: read.message, loaded: true, reading: false })
          return
        }
        set({
          unusable: null,
          badQuery: null,
          error: null,
          tasks: read.tasks,
          order: read.tasks.map((t) => t.key),
          total: read.total,
          more: read.more,
          failed: {},
          stale: null,
          loaded: true,
          reading: false,
        })
      } catch (e) {
        if (mine === seq) set({ error: message(e), loaded: true, reading: false })
        return
      }
      const [c, p, j] = await Promise.all([counts, people, projects])
      if (mine !== seq) return
      set((s) => ({ counts: c, people: p ?? s.people, projects: j ?? s.projects }))
    },

    type(query) {
      set({ query })
      clearTimeout(typing)
      typing = setTimeout(() => void get().load(), TYPING_MS)
    },

    setQuery(query) {
      clearTimeout(typing)
      set({ query })
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
      set((s) => ({ open: key === null || s.open === key ? null : key }))
      if (key && get().open === key && !get().history[key]) void get().loadHistory(key)
    },

    async update(key, edit) {
      const t = find(key)
      if (!t) return false
      const out = await settle(key, () => platform.taskUpdate(key, t.revision, edit))
      return out?.kind === "saved"
    },

    async assign(key, person) {
      const t = find(key)
      if (!t) return
      await settle(key, () => platform.taskAssign(key, t.revision, person))
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
      const out = await settle(key, () => platform.taskMove(key, t.revision, place), undo)
      if (out?.kind === "saved" && (out.label || state !== before.state)) {
        set({ note: { key, label: out.label?.to ?? null, column: state !== before.state ? state : null } })
      }
    },

    async create(task) {
      set((s) => ({ busy: { ...s.busy, new: true }, failed: without(s.failed, "new") }))
      try {
        const out = await platform.taskCreate(task)
        const made = out.kind === "saved" ? out.task : out.current
        set((s) => ({
          tasks: [made, ...s.tasks.filter((t) => t.key !== made.key)],
          order: [made.key, ...s.order.filter((k) => k !== made.key)],
          total: s.total + 1,
          creating: false,
        }))
        void recount()
        void platform
          .peopleList()
          .then((people) => set({ people }))
          .catch(() => undefined)
        return true
      } catch (e) {
        set((s) => ({ failed: { ...s.failed, new: message(e) } }))
        return false
      } finally {
        set((s) => ({ busy: without(s.busy, "new") }))
      }
    },

    async loadHistory(key) {
      set((s) => ({ history: { ...s.history, [key]: { state: "loading" } } }))
      try {
        const events = await platform.taskHistory(key)
        set((s) => ({ history: { ...s.history, [key]: { state: "ready", events } } }))
      } catch {
        set((s) => ({ history: { ...s.history, [key]: { state: "failed" } } }))
      }
    },

    startCreate(on) {
      set({ creating: on })
    },

    dismissStale() {
      set({ stale: null })
    },
  }
})
