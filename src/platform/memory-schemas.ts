import * as v from "valibot"

// Owned by the Memory feature: the shapes `memory.rs` builds from memo's memories, facts, actions and agents lists.
// `status` stays a string: a newer memo may add one, and the page shows it under All rather than failing to read.

const text = v.nullable(v.string())

/** One fact or task of an agent's findings batch; `outcome` is set once the batch is reviewed. */
export const FindingSchema = v.object({
  id: v.string(),
  kind: v.string(),
  text: v.string(),
  reason: text,
  evidence: v.array(v.string()),
  outcome: text,
})

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
  projectName: text,
  supersedes: text,
  links: v.number(),
  reason: text,
  account: text,
  target: text,
  createdAt: v.string(),
  updatedAt: text,
  findings: v.nullable(v.array(FindingSchema)),
  model: text,
  confidence: v.nullable(v.number()),
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

export const SourceContextSchema = v.variant("kind", [
  v.object({
    kind: v.literal("messages"),
    items: v.array(v.object({ ref: text, sender: text, at: text, text: v.string(), anchor: v.boolean() })),
  }),
  v.object({ kind: v.literal("note"), title: text, text: v.string(), file: v.boolean() }),
  v.object({ kind: v.literal("unsupported"), prefix: v.string() }),
])

export type SourceContext = v.InferOutput<typeof SourceContextSchema>
export type MemoryEntry = v.InferOutput<typeof MemoryEntrySchema>
export type AgentCall = v.InferOutput<typeof AgentCallSchema>
export type MemoryRead = v.InferOutput<typeof MemoryReadSchema>
export type MemorySource = v.InferOutput<typeof MemorySourceSchema>
export type Forgot = v.InferOutput<typeof ForgotSchema>
