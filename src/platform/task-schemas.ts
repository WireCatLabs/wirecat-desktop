import * as v from "valibot"

export const TaskStateSchema = v.picklist(["open", "todo", "in_progress", "done", "dismissed"])
export const PriorityLabelSchema = v.picklist(["low", "medium", "high", "critical"])

export const TaskSchema = v.object({
  key: v.string(),
  project: v.string(),
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
])

export const PersonSchema = v.object({ ref: v.string(), name: v.nullable(v.string()), owner: v.boolean() })
export const ProjectSchema = v.object({ key: v.string(), name: v.string() })

export type TaskState = v.InferOutput<typeof TaskStateSchema>
export type PriorityLabel = v.InferOutput<typeof PriorityLabelSchema>
export type Task = v.InferOutput<typeof TaskSchema>
export type TaskRead = v.InferOutput<typeof TaskReadSchema>
export type TaskCounts = v.InferOutput<typeof TaskCountsSchema>
export type TaskEvent = v.InferOutput<typeof TaskEventSchema>
export type TaskWrite = v.InferOutput<typeof TaskWriteSchema>
export type Person = v.InferOutput<typeof PersonSchema>
export type Project = v.InferOutput<typeof ProjectSchema>

/** What one edit changes; `none` clears the priority, the due date or the agent. */
export type TaskEdit = {
  title?: string
  description?: string
  priority?: PriorityLabel | "none"
  /** `YYYY-MM-DD`, read by Memo as local midnight. */
  due?: string
  agent?: string
  state?: TaskState
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
