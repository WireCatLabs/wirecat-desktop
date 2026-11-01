import * as v from "valibot"

export const TaskStateSchema = v.picklist(["open", "todo", "in_progress", "done", "dismissed"])
export const PriorityLabelSchema = v.picklist(["low", "medium", "high", "critical"])
export const TaskKindSchema = v.picklist(["bug", "feature", "chore"])

/** Who made a task or wrote a comment: the owner, another person, or an agent (`type` "bot"). */
export const CreatorSchema = v.object({ type: v.string(), name: v.nullable(v.string()), owner: v.boolean() })

export const TaskSchema = v.object({
  key: v.string(),
  /** The project's key. A task moved to another project takes a new key there; the old one still finds it. */
  project: v.string(),
  projectName: v.nullable(v.string()),
  createdBy: v.nullable(CreatorSchema),
  title: v.string(),
  description: v.nullable(v.string()),
  kind: v.nullable(v.string()),
  state: TaskStateSchema,
  /** 0 to 1; it also orders a board column, highest first. */
  priority: v.nullable(v.number()),
  priorityLabel: v.nullable(PriorityLabelSchema),
  agent: v.nullable(v.string()),
  revision: v.number(),
  parent: v.nullable(v.string()),
  dueAt: v.nullable(v.string()),
  closedAt: v.nullable(v.string()),
  claimedBy: v.nullable(v.string()),
  claimedUntil: v.nullable(v.string()),
  /** `person:<id>`; names come from `peopleList`. */
  assignees: v.array(v.string()),
  /** Null from `taskShow`, which does not work it out. */
  ready: v.nullable(v.boolean()),
  blockedBy: v.array(v.object({ key: v.string(), state: v.string() })),
  createdAt: v.string(),
  updatedAt: v.nullable(v.string()),
})

export const TaskReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: v.nullable(v.string()), need: v.string() }),
  v.object({ kind: v.literal("badQuery"), message: v.string() }),
  v.object({ kind: v.literal("ready"), tasks: v.array(TaskSchema), total: v.number(), more: v.boolean() }),
])

const FacetSchema = v.array(v.object({ value: v.string(), name: v.nullable(v.string()), count: v.number() }))

export const TaskCountsSchema = v.object({
  total: v.number(),
  project: FacetSchema,
  assignee: FacetSchema,
  priority: FacetSchema,
  state: FacetSchema,
  /** overdue, today, upcoming, later and none, as memo's `when:` reads them. */
  due: FacetSchema,
  agent: FacetSchema,
})

export const TaskEventSchema = v.object({
  at: v.string(),
  kind: v.string(),
  by: v.nullable(v.object({ ref: v.nullable(v.string()), name: v.nullable(v.string()), owner: v.boolean() })),
  changes: v.array(v.object({ field: v.string(), from: v.unknown(), to: v.unknown() })),
})

export const TaskWriteSchema = v.variant("kind", [
  v.object({
    kind: v.literal("saved"),
    task: TaskSchema,
    label: v.nullable(v.object({ from: v.nullable(v.string()), to: v.nullable(v.string()) })),
    renumbered: v.array(v.string()),
  }),
  v.object({ kind: v.literal("stale"), current: TaskSchema, last: v.nullable(TaskEventSchema) }),
  /** memo moves a task to another project only once it has no subtasks; these are the ones it has. */
  v.object({ kind: v.literal("hasSubtasks"), subtasks: v.array(v.object({ key: v.string(), title: v.string() })) }),
])

export const TaskCommentSchema = v.object({
  ref: v.nullable(v.string()),
  text: v.string(),
  author: v.nullable(CreatorSchema),
  at: v.string(),
})

export const PersonSchema = v.object({ ref: v.string(), name: v.nullable(v.string()), owner: v.boolean() })
export const ProjectSchema = v.object({ ref: v.nullable(v.string()), key: v.string(), name: v.string() })

export type TaskState = v.InferOutput<typeof TaskStateSchema>
export type PriorityLabel = v.InferOutput<typeof PriorityLabelSchema>
export type Task = v.InferOutput<typeof TaskSchema>
export type TaskKind = v.InferOutput<typeof TaskKindSchema>
export type Creator = v.InferOutput<typeof CreatorSchema>
export type TaskComment = v.InferOutput<typeof TaskCommentSchema>
export type TaskRead = v.InferOutput<typeof TaskReadSchema>
export type TaskCounts = v.InferOutput<typeof TaskCountsSchema>
export type TaskEvent = v.InferOutput<typeof TaskEventSchema>
export type TaskWrite = v.InferOutput<typeof TaskWriteSchema>
export type Person = v.InferOutput<typeof PersonSchema>
export type Project = v.InferOutput<typeof ProjectSchema>

/** What one edit changes; `none` clears the priority, the due date or the agent. */
export type TaskEdit = {
  title?: string
  /** Empty clears the notes. */
  description?: string
  priority?: PriorityLabel | "none"
  /** `YYYY-MM-DD`, read by Memo as local midnight. */
  due?: string
  agent?: string
  state?: TaskState
  /** Another project's key; the answer's task has its new key there. */
  project?: string
  kind?: TaskKind
}

export type TaskPlace = { state?: TaskState; before?: string; after?: string }

export type NewTask = {
  project: string
  title: string
  priority?: PriorityLabel
  assignee?: string
  due?: string
  state?: TaskState
}
