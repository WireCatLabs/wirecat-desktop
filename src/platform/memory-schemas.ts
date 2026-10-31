import * as v from "valibot"

// Owned by the Memory feature: the shapes `memory.rs` builds from memo's memories, facts, actions and agents lists.
// `status` stays a string: a newer memo may add one, and the page shows it under All rather than failing to read.

const text = v.nullable(v.string())

export const MemoryEntrySchema = v.object({
  ref: v.string(),
  type: v.picklist(["memory", "fact", "action"]),
  kind: v.string(),
  text,
  status: v.string(),
  subject: text,
  subjectName: text,
  subjectIsOwner: v.boolean(),
  author: v.nullable(v.object({ type: v.string(), name: text })),
  scope: text,
  project: text,
  supersedes: text,
  links: v.number(),
  reason: text,
  account: text,
  target: text,
  createdAt: v.string(),
  updatedAt: text,
})

export const AgentCallSchema = v.object({
  id: v.string(),
  agent: text,
  tool: v.string(),
  tier: text,
  status: v.string(),
  error: text,
  at: v.string(),
})

export const MemoryReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: text, need: v.string() }),
  v.object({
    kind: v.literal("ready"),
    entries: v.array(MemoryEntrySchema),
    more: v.boolean(),
    activity: v.nullable(v.array(AgentCallSchema)),
    activityError: text,
  }),
])

export const MemorySourceSchema = v.object({
  ref: text,
  kind: v.string(),
  title: text,
  sender: text,
  at: text,
  excerpt: text,
  tool: text,
  missing: v.boolean(),
})

export const ForgotSchema = v.object({ ref: v.string(), links: v.number() })

export type MemoryEntry = v.InferOutput<typeof MemoryEntrySchema>
export type AgentCall = v.InferOutput<typeof AgentCallSchema>
export type MemoryRead = v.InferOutput<typeof MemoryReadSchema>
export type MemorySource = v.InferOutput<typeof MemorySourceSchema>
export type Forgot = v.InferOutput<typeof ForgotSchema>
