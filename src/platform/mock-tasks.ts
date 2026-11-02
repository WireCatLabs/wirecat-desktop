// cspell:words hermes
// The Tasks page in the browser build: made-up tasks and people, and a small reading of memo's query language, so a
// filter shows what memo would answer. `?tasks=` picks a state: none, nomatch, missing, old, fail, write-fail,
// conflict (HRB-12 was changed by hermes), many (400 tasks), blocked (a chain of three), loading. HRB-12 has a comment
// thread; OPS-3 has a subtask, OPS-5, so moving OPS-3 to another project is refused with OPS-5 named, and moving
// OPS-5 offers to take it out of OPS-3 first.
import {
  claimActive,
  closed,
  daysUntil,
  dropField,
  type Field,
  isoDay,
  LABELS,
  labelOf,
  localDay,
} from "@/domain/tasks"
import { delay } from "./mock-delay"
import type {
  Creator,
  NewTask,
  Person,
  Project,
  Task,
  TaskComment,
  TaskCounts,
  TaskEdit,
  TaskEvent,
  TaskPlace,
  TaskState,
  TaskWrite,
} from "./task-schemas"
import type { Platform } from "./types"

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = () => params.get("tasks") ?? "default"

export const MOCK_NOMATCH_QUERY = 'project:HOME assignee:"person:3" state:done'

const PROJECTS: Project[] = [
  { ref: "project:1", key: "HRB", name: "Harbour launch" },
  { ref: "project:2", key: "OPS", name: "Operations" },
  { ref: "project:3", key: "HOME", name: "Home" },
]
const OWNER: Creator = { type: "person", name: null, owner: true }
const HERMES: Creator = { type: "bot", name: "hermes", owner: false }
const PEOPLE: Person[] = [
  { ref: "person:1", name: null, owner: true },
  { ref: "person:2", name: "Ana Ruiz", owner: false },
  { ref: "person:3", name: "Kai Moreno", owner: false },
]

const now = new Date()
const day = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toISOString()
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

type Seed = Partial<Task> & Pick<Task, "key" | "title" | "state">

function make(seed: Seed): Task {
  const priority = seed.priority ?? null
  const project = seed.key.split("-")[0] ?? "HRB"
  return {
    project,
    projectName: PROJECT_SET().find((p) => p.key === project)?.name ?? null,
    createdBy: OWNER,
    description: null,
    kind: "chore",
    priorityLabel: labelOf(priority),
    agent: null,
    revision: 3,
    parent: null,
    dueAt: null,
    closedAt: closed(seed.state) ? ago(60 * 26) : null,
    claimedBy: null,
    claimedUntil: null,
    assignees: [],
    ready: true,
    blockedBy: [],
    createdAt: ago(60 * 24 * 4),
    updatedAt: ago(90),
    ...seed,
    priority,
  }
}

function seeds(): Task[] {
  const base: Seed[] = [
    {
      key: "HRB-12",
      title: "Send Kai the pricing table with the clinic discount",
      state: "in_progress",
      priority: 0.7,
      assignees: ["person:1"],
      dueAt: day(3),
      description: "Second tab of the pricing sheet. Kai asked for the clinic discount **spelled out per seat**.",
      kind: "feature",
    },
    {
      key: "HRB-14",
      title: "Book the two pilot clinics for February",
      state: "todo",
      priority: 0.86,
      assignees: ["person:2"],
      dueAt: day(-1),
    },
    {
      key: "HRB-15",
      title: "Draft the launch announcement for 2 March",
      state: "todo",
      priority: 0.4,
      assignees: ["person:1"],
      agent: "claude-code",
      claimedBy: "claude-code",
      claimedUntil: new Date(now.getTime() + 40 * 60_000).toISOString(),
      dueAt: day(19),
      ready: false,
      blockedBy: [{ key: "HRB-14", state: "todo" }],
      description: "Waits until both pilot clinics have said yes.",
      createdBy: HERMES,
    },
    {
      key: "HRB-9",
      title: "Agenda for the Monday call with Kai",
      state: "dismissed",
      priority: 0.4,
      assignees: ["person:3"],
    },
    {
      key: "OPS-3",
      title: "Renew the domain and check the DNS records",
      state: "open",
      priority: 0.62,
      assignees: ["person:1"],
      dueAt: day(1),
    },
    {
      key: "OPS-5",
      title: "Compare the two registrars' renewal prices",
      state: "in_progress",
      priority: 0.58,
      parent: "OPS-3",
      assignees: ["person:1"],
    },
    {
      key: "OPS-4",
      title: "Summarise last week's support chats",
      state: "in_progress",
      priority: 0.2,
      agent: "hermes",
      claimedBy: "hermes",
      claimedUntil: new Date(now.getTime() + 25 * 60_000).toISOString(),
    },
    {
      key: "HOME-2",
      title: "Call the landlord about the boiler",
      state: "open",
      priority: null,
      assignees: ["person:1"],
    },
    {
      key: "HRB-8",
      title: "Send the signed NDA back to Kai",
      state: "done",
      priority: 0.65,
      assignees: ["person:1"],
      dueAt: day(-2),
    },
    { key: "OPS-2", title: "Move the backups to the new disk", state: "done", priority: 0.3, assignees: ["person:1"] },
  ]
  if (scenario() === "blocked") {
    base.push(
      { key: "OPS-7", title: "Pick the new backup disk", state: "open", priority: 0.55 },
      {
        key: "OPS-8",
        title: "Order the disk",
        state: "open",
        priority: 0.54,
        ready: false,
        blockedBy: [{ key: "OPS-7", state: "open" }],
      },
      {
        key: "OPS-9",
        title: "Copy the archive onto it",
        state: "open",
        priority: 0.53,
        ready: false,
        blockedBy: [{ key: "OPS-8", state: "open" }],
      },
    )
  }
  if (scenario() === "many") {
    const verbs = ["Check", "Send", "Draft", "Review", "Book", "Fix", "Plan", "Call", "Write", "Move"]
    const things = ["the invoice", "the slides", "the contract", "the backup", "the agenda", "the budget", "the notes"]
    const keys = ["HRB", "OPS", "HOME", "WEB", "FIN", "TRIP"]
    for (let i = 0; i < 400; i++) {
      const state = (["open", "todo", "in_progress", "todo", "open", "done", "dismissed"] as const)[i % 7] ?? "open"
      base.push({
        key: `${keys[i % keys.length]}-${100 + i}`,
        title: `${verbs[i % verbs.length]} ${things[i % things.length]} (${i + 1})`,
        state,
        priority: ((i * 37) % 100) / 100,
        assignees: i % 3 === 0 ? [] : [`person:${(i % 3) + 1}`],
        dueAt: i % 4 === 0 ? null : day((i % 30) - 10),
      })
    }
  }
  return base.map(make)
}

function PROJECT_SET(): Project[] {
  return scenario() === "many"
    ? [
        ...PROJECTS,
        { ref: "project:4", key: "WEB", name: "Website" },
        { ref: "project:5", key: "FIN", name: "Finance" },
        { ref: "project:6", key: "TRIP", name: "Trip" },
      ]
    : PROJECTS
}

// ---- A small reading of memo's query language: fields, OR, NOT, groups, ranges and plain words ----

type Node =
  | { op: "and" | "or"; parts: Node[] }
  | { op: "not"; part: Node }
  | { op: "field"; field: string; value: string }
  | { op: "word"; value: string }

function tokens(q: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < q.length) {
    const c = q[i] ?? ""
    if (/\s/.test(c)) {
      i++
    } else if (c === "(" || c === ")") {
      out.push(c)
      i++
    } else if (c === '"') {
      const end = q.indexOf('"', i + 1)
      out.push(q.slice(i, end < 0 ? q.length : end + 1))
      i = end < 0 ? q.length : end + 1
    } else {
      let j = i
      while (j < q.length && !/[\s()]/.test(q[j] ?? "")) {
        if (q[j] === ":" && (q[j + 1] === "(" || q[j + 1] === "[" || q[j + 1] === '"')) {
          const close = { "(": ")", "[": "]", '"': '"' }[q[j + 1] as "(" | "[" | '"']
          const end = q.indexOf(close, j + 2)
          j = end < 0 ? q.length : end + 1
          break
        }
        j++
      }
      out.push(q.slice(i, j))
      i = j
    }
  }
  return out
}

class BadQuery extends Error {}

function parse(q: string): Node {
  const ts = tokens(q)
  let at = 0
  const expr = (): Node => {
    const parts = [and()]
    while (ts[at] === "OR") {
      at++
      parts.push(and())
    }
    return parts.length === 1 ? (parts[0] as Node) : { op: "or", parts }
  }
  const and = (): Node => {
    const parts: Node[] = []
    while (at < ts.length && ts[at] !== ")" && ts[at] !== "OR") {
      if (ts[at] === "AND") {
        at++
        continue
      }
      parts.push(unary())
    }
    if (parts.length === 0) throw new BadQuery(`query.invalid-syntax at position ${at + 1}`)
    return parts.length === 1 ? (parts[0] as Node) : { op: "and", parts }
  }
  const unary = (): Node => {
    const t = ts[at] ?? ""
    if (t === "NOT") {
      at++
      return { op: "not", part: unary() }
    }
    if (t.startsWith("-") && t.length > 1) {
      ts[at] = t.slice(1)
      return { op: "not", part: unary() }
    }
    if (t === "(") {
      at++
      const inner = expr()
      if (ts[at] !== ")") throw new BadQuery(`query.invalid-syntax at position ${at + 1}`)
      at++
      return inner
    }
    at++
    const m = /^(\w+):(.*)$/.exec(t)
    if (m) {
      const [, field = "", value = ""] = m
      if (value.startsWith("(")) {
        const parts = value
          .slice(1, -1)
          .split(/\s+OR\s+/)
          .map((v) => ({ op: "field" as const, field, value: v.trim().replace(/^"|"$/g, "") }))
        return { op: "or", parts }
      }
      return { op: "field", field, value: value.replace(/^"|"$/g, "") }
    }
    return { op: "word", value: t.replace(/^"|"$/g, "") }
  }
  const node = expr()
  if (at < ts.length) throw new BadQuery(`query.invalid-syntax at position ${at + 1}`)
  return node
}

const rank = (l: string) => LABELS.indexOf(l as (typeof LABELS)[number])

function fieldMatch(t: Task, field: string, value: string): boolean {
  const v = value.toLowerCase()
  const range = /^\[(.+) TO (.+)\]$/.exec(value)
  switch (field) {
    case "project":
      return v === "*" || t.project.toLowerCase() === v
    case "state":
      return v === "*" || t.state === v
    case "assignee":
      return v === "*" ? t.assignees.length > 0 : v === "none" ? t.assignees.length === 0 : t.assignees.includes(v)
    case "priority":
      if (v === "*") return t.priority !== null
      if (v === "none") return t.priority === null
      if (range) {
        const r = rank(t.priorityLabel ?? "")
        const a = rank(range[1] ?? "")
        const b = rank(range[2] ?? "")
        return r >= 0 && r <= Math.max(a, b) && r >= Math.min(a, b)
      }
      return t.priorityLabel === v
    case "agent":
      return v === "*" ? t.agent !== null : t.agent === v
    case "due": {
      if (v === "*") return t.dueAt !== null
      if (!t.dueAt) return false
      const day = localDay(t.dueAt)
      const read = (w: string) => (w.toLowerCase() === "today" ? isoDay(now) : w)
      if (range) return day >= read(range[1] ?? "") && day <= read(range[2] ?? "")
      if (v.startsWith("<")) return day < read(v.slice(1))
      if (v === "tomorrow") return day === isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
      return day === read(v)
    }
    case "when":
      return whenOf(t) === v
    case "overdue":
      return v === "true" && t.dueAt !== null && daysUntil(t.dueAt) < 0 && !closed(t.state)
    case "closed": {
      const days = Number(/(\d+)d/.exec(v)?.[1] ?? 14)
      return t.closedAt !== null && Date.parse(t.closedAt) >= now.getTime() - days * 86_400_000
    }
    case "ready":
      return (v === "true") === (t.ready ?? true)
    case "text":
      return `${t.title} ${t.description ?? ""}`.toLowerCase().includes(v)
    default:
      throw new BadQuery(`unknown field ${field}`)
  }
}

function matches(t: Task, n: Node): boolean {
  switch (n.op) {
    case "and":
      return n.parts.every((p) => matches(t, p))
    case "or":
      return n.parts.some((p) => matches(t, p))
    case "not":
      return !matches(t, n.part)
    case "field":
      return fieldMatch(t, n.field, n.value)
    case "word":
      return `${t.key} ${t.title} ${t.description ?? ""}`.toLowerCase().includes(n.value.toLowerCase())
  }
}

/** memo's `when:` buckets: overdue excludes today, upcoming is the next 7 days. */
function whenOf(t: Task): string {
  if (!t.dueAt) return "none"
  const d = daysUntil(t.dueAt)
  if (d < 0) return closed(t.state) ? "later" : "overdue"
  if (d === 0) return "today"
  return d <= 7 ? "upcoming" : "later"
}

// memo's default: without a state term, closed tasks stay out.
const DEFAULT_OPEN = "state:(open OR todo OR in_progress)"
const filter = (all: Task[], q: string) => {
  const query = /(^|[\s(-])state:/.test(q) ? q : `(${q || "project:*"}) ${DEFAULT_OPEN}`
  const node = parse(query)
  return all.filter((t) => matches(t, node))
}

// ---- The mock itself ----

type TaskApi = Pick<
  Platform,
  | "taskList"
  | "taskCounts"
  | "taskShow"
  | "taskHistory"
  | "taskCreate"
  | "taskUpdate"
  | "taskMove"
  | "taskAssign"
  | "taskComments"
  | "taskCommentAdd"
  | "peopleList"
  | "personAdd"
  | "projectList"
>

const STATE_ORDER: TaskState[] = ["open", "todo", "in_progress", "done", "dismissed"]

export function tasksMock(): TaskApi {
  let tasks = seeds()
  let people = [...PEOPLE]
  const history = new Map<string, TaskEvent[]>()
  const comments = new Map<string, TaskComment[]>([
    [
      "HRB-12",
      [
        {
          ref: "note:31",
          text: "Kai wants the per-seat price for 20 and for 50 seats.",
          author: HERMES,
          at: ago(60 * 26),
        },
        { ref: "note:32", text: "Using the clinic tier from the October sheet.", author: OWNER, at: ago(60 * 3) },
      ],
    ],
  ])
  let noteId = 40
  const you = { ref: "person:1", name: null, owner: true }
  let conflictLeft = scenario() === "conflict"
  const aliases = new Map<string, string>()
  const find = (key: string) => {
    const t = tasks.find((x) => x.key === (aliases.get(key) ?? key))
    if (!t) throw new Error(`no task ${key}`)
    return t
  }
  const record = (key: string, changes: TaskEvent["changes"], kind: string, by: TaskEvent["by"] = you) => {
    history.set(key, [...(history.get(key) ?? []), { at: new Date().toISOString(), kind, by, changes }])
  }
  const put = (t: Task) => {
    tasks = tasks.map((x) => (x.key === t.key ? t : x))
    return t
  }
  const sorted = () =>
    [...tasks].sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1) || a.createdAt.localeCompare(b.createdAt))

  /** Every write: refused when the store is "busy", stale when the page's copy is old. */
  const write = async (
    key: string,
    revision: number,
    change: (t: Task) => Task,
    label?: TaskWrite,
  ): Promise<TaskWrite> => {
    await delay(260)
    if (scenario() === "write-fail") throw new Error("another memo process holds the store; try again in a minute")
    const t = find(key)
    if (conflictLeft && key === "HRB-12") {
      conflictLeft = false
      const hermes = { ref: "bot:4", name: "hermes", owner: false }
      const current = put({ ...t, state: "todo", revision: t.revision + 1, updatedAt: new Date().toISOString() })
      record(key, [{ field: "status", from: t.state, to: "todo" }], "status", hermes)
      return { kind: "stale", current, last: history.get(key)?.at(-1) ?? null }
    }
    if (t.revision !== revision) return { kind: "stale", current: t, last: history.get(key)?.at(-1) ?? null }
    const next = put({ ...change(t), revision: t.revision + 1, updatedAt: new Date().toISOString() })
    return label
      ? { ...(label as Extract<TaskWrite, { kind: "saved" }>), task: next }
      : { kind: "saved", task: next, label: null, renumbered: [] }
  }

  const setState = (t: Task, state: TaskState): Task => {
    if (t.state !== state) record(t.key, [{ field: "status", from: t.state, to: state }], "status")
    return { ...t, state, closedAt: closed(state) ? (closed(t.state) ? t.closedAt : new Date().toISOString()) : null }
  }

  return {
    async taskList(query) {
      const s = scenario()
      await delay(s === "loading" ? 60_000 : s === "many" ? 500 : 350)
      if (s === "missing") return { kind: "missing" }
      if (s === "old") return { kind: "old", version: "0.131.4", need: "0.131.11" }
      if (s === "fail") throw new Error("another memo process holds the store; try again in a minute")
      if (s === "none") return { kind: "ready", tasks: [], total: 0, more: false }
      try {
        const found = filter(sorted(), query)
        return { kind: "ready", tasks: found.slice(0, 500), total: found.length, more: found.length > 500 }
      } catch (e) {
        if (e instanceof BadQuery) return { kind: "badQuery", message: `tasks list: ${e.message}` }
        throw e
      }
    },
    async taskCounts(query): Promise<TaskCounts> {
      await delay(420)
      if (scenario() === "none")
        return { total: 0, project: [], assignee: [], priority: [], state: [], due: [], agent: [] }
      const without = (field: Field) => {
        try {
          return filter(tasks, dropField(query, field))
        } catch {
          return []
        }
      }
      const facet = (field: Field, values: { value: string; name: string | null }[], of: (t: Task) => string[]) => {
        const pool = without(field)
        return values.map((v) => ({ ...v, count: pool.filter((t) => of(t).includes(v.value)).length }))
      }
      return {
        total: (() => {
          try {
            return filter(tasks, query).length
          } catch {
            return 0
          }
        })(),
        project: facet(
          "project",
          PROJECT_SET().map((p) => ({ value: p.key, name: p.name })),
          (t) => [t.project],
        ),
        assignee: facet(
          "assignee",
          [{ value: "none", name: null }, ...people.map((p) => ({ value: p.ref, name: p.name }))],
          (t) => (t.assignees.length ? t.assignees : ["none"]),
        ),
        priority: facet(
          "priority",
          [...LABELS, "none"].map((value) => ({ value, name: null })),
          (t) => [t.priorityLabel ?? "none"],
        ),
        state: facet(
          "state",
          STATE_ORDER.map((value) => ({ value, name: null })),
          (t) => [t.state],
        ),
        due: facet(
          "due",
          ["overdue", "today", "upcoming", "later", "none"].map((value) => ({ value, name: null })),
          (t) => [whenOf(t)],
        ),
        agent: facet(
          "agent",
          [
            { value: "none", name: null },
            ...[...new Set(tasks.flatMap((t) => t.agent ?? []))].map((value) => ({ value, name: null })),
          ],
          (t) => [t.agent ?? "none"],
        ),
      }
    },
    async taskShow(key) {
      await delay(200)
      return { ...find(key), ready: null }
    },
    async taskHistory(key) {
      await delay(300)
      const t = find(key)
      const by = t.createdBy?.owner === false ? { ref: "bot:4", name: t.createdBy.name, owner: false } : you
      const made: TaskEvent = { at: t.createdAt, kind: "created", by, changes: [] }
      const claim: TaskEvent[] =
        t.claimedBy && claimActive(t.claimedUntil)
          ? [
              {
                at: ago(20),
                kind: "agent",
                by: { ref: "bot:4", name: t.claimedBy, owner: false },
                changes: [{ field: "agent", from: null, to: t.claimedBy }],
              },
            ]
          : []
      return [made, ...claim, ...(history.get(key) ?? [])]
    },
    async taskCreate(n: NewTask) {
      await delay(300)
      if (scenario() === "write-fail") throw new Error("another memo process holds the store; try again in a minute")
      const number =
        tasks.filter((t) => t.project === n.project).reduce((m, t) => Math.max(m, Number(t.key.split("-")[1])), 0) + 1
      const mid = { critical: 0.875, high: 0.625, medium: 0.375, low: 0.125 }
      const task = make({
        key: `${n.project}-${number}`,
        title: n.title,
        state: n.state ?? "open",
        priority: n.priority ? mid[n.priority] : null,
        assignees: n.assignee ? [n.assignee] : [],
        dueAt: n.due ? new Date(`${n.due}T00:00:00`).toISOString() : null,
        createdAt: new Date().toISOString(),
        revision: 1,
      })
      tasks = [task, ...tasks]
      return { kind: "saved", task, label: null, renumbered: [] }
    },
    async taskUpdate(key, revision, edit: TaskEdit) {
      const to = edit.project
      if (to !== undefined && to !== find(key).project) {
        const subtasks = tasks.filter((t) => t.parent === key).map((t) => t.key)
        const parent = find(key).parent
        if (find(key).revision === revision && (subtasks.length > 0 || (parent && !edit.detach))) {
          await delay(260)
          return parent && !edit.detach ? { kind: "isSubtask", parent } : { kind: "hasSubtasks", subtasks }
        }
      }
      const out = await write(key, revision, (t) => {
        let next = { ...t }
        if (edit.title !== undefined) next.title = edit.title
        if (edit.description !== undefined) next.description = edit.description || null
        if (edit.detach) {
          record(key, [{ field: "parent", from: t.parent, to: null }], "parent")
          next.parent = null
        }
        if (edit.kind !== undefined) {
          record(key, [{ field: "type", from: t.kind, to: edit.kind }], "type")
          next.kind = edit.kind
        }
        if (edit.priority !== undefined) {
          const mid = { critical: 0.875, high: 0.625, medium: 0.375, low: 0.125, none: null }
          next.priority = mid[edit.priority]
          next.priorityLabel = labelOf(next.priority)
          record(key, [{ field: "priority", from: t.priority, to: next.priority }], "priority")
        }
        if (edit.due !== undefined) {
          next.dueAt = edit.due === "none" ? null : new Date(`${edit.due}T00:00:00`).toISOString()
          record(key, [{ field: "due_at", from: t.dueAt, to: next.dueAt }], "due")
        }
        if (edit.agent !== undefined) {
          next.agent = edit.agent === "none" ? null : edit.agent
          record(key, [{ field: "agent", from: t.agent, to: next.agent }], "agent")
        }
        if (edit.state !== undefined) next = setState(next, edit.state)
        return next
      })
      if (out.kind !== "saved" || to === undefined || to === key.split("-")[0]) return out
      // memo gives the task the next key in its new project; the old key still finds it there.
      const number =
        tasks.filter((t) => t.project === to).reduce((m, t) => Math.max(m, Number(t.key.split("-")[1])), 0) + 1
      const moved: Task = {
        ...out.task,
        key: `${to}-${number}`,
        project: to,
        projectName: PROJECT_SET().find((p) => p.key === to)?.name ?? null,
        parent: null,
      }
      tasks = tasks.map((t) => (t.key === key ? moved : t))
      aliases.set(key, moved.key)
      const from = PROJECT_SET().find((p) => p.key === key.split("-")[0])?.ref ?? null
      history.set(moved.key, [
        ...(history.get(key) ?? []),
        {
          at: new Date().toISOString(),
          kind: "project",
          by: you,
          changes: [
            { field: "project", from, to: PROJECT_SET().find((p) => p.key === to)?.ref ?? null },
            { field: "key", from: key, to: moved.key },
          ],
        },
      ])
      comments.set(moved.key, comments.get(key) ?? [])
      return { ...out, task: moved }
    },
    async taskMove(key, revision, place: TaskPlace) {
      const t = find(key)
      const state = place.state ?? t.state
      const column = sorted().filter((x) => x.state === state && x.key !== key)
      const anchor = place.before ?? place.after
      const at = anchor ? column.findIndex((x) => x.key === anchor) + (place.after ? 1 : 0) : 0
      const above = column[at - 1]?.priority ?? 1
      const below = column[at]?.priority ?? 0
      const priority = (above + below) / 2
      const from = t.priorityLabel
      const to = labelOf(priority)
      return write(
        key,
        revision,
        (x) => {
          record(key, [{ field: "priority", from: x.priority, to: priority }], "priority")
          return { ...setState(x, state), priority, priorityLabel: to }
        },
        { kind: "saved", task: t, label: from !== to ? { from, to } : null, renumbered: [] },
      )
    },
    taskAssign(key, revision, person) {
      return write(key, revision, (t) => {
        record(key, [{ field: "assignee", from: t.assignees[0] ?? null, to: person }], "assigned")
        return { ...t, assignees: person ? [person] : [] }
      })
    },
    async taskComments(key) {
      await delay(280)
      find(key)
      return comments.get(key) ?? []
    },
    async taskCommentAdd(key, text) {
      await delay(260)
      if (scenario() === "write-fail") throw new Error("another memo process holds the store; try again in a minute")
      const said: TaskComment = { ref: `note:${noteId++}`, text, author: OWNER, at: new Date().toISOString() }
      comments.set(key, [...(comments.get(key) ?? []), said])
      return said
    },
    async peopleList() {
      await delay(250)
      return people
    },
    async personAdd(name) {
      await delay(260)
      if (scenario() === "write-fail") throw new Error("another memo process holds the store; try again in a minute")
      const added: Person = { ref: `person:${people.length + 1}`, name: name.trim(), owner: false }
      people = [...people, added]
      return added
    },
    async projectList() {
      await delay(250)
      return PROJECT_SET()
    },
  }
}
