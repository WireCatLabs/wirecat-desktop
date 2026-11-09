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
  /** What an accepted finding became, `fact:12` or `task:<id>`. */
  created: text,
})

export const MemoryEntrySchema = v.object({
  ref: v.string(),
  type: v.picklist(["memory", "fact", "action", "relationship"]),
  kind: v.string(),
  /** An action's whole text: what it would send, or the task it would make. */
  text,
  /** memo's English line for an action, used when the page has no words of its own for its verb. */
  summary: text,
  verb: text,
  targetName: text,
  chatName: text,
  counts: v.nullable(v.object({ facts: v.number(), tasks: v.number() })),
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
  /** The task an approved action became, `task:<id>`. */
  task: text,
  model: text,
  confidence: v.nullable(v.number()),
  /** A relationship's role id from the owner's role lists; null on every other record. */
  role: v.optional(text),
  /** A relationship's standing: proposed, confirmed, reported or ended. */
  standing: v.optional(text),
  /** The open review memo raised because a source changed, went or was contradicted; absent before memo had them. */
  sourceReview: v.optional(v.nullable(v.object({ id: v.string(), cause: v.string() })), null),
})

/** One role of the owner's role lists (`memo relationships roles list`): built in, or the owner's own with a label. */
export const RoleSchema = v.object({ list: v.string(), id: v.string(), label: text, builtIn: v.boolean() })

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
    linksError: v.optional(text, null),
    /** The installed memo takes back an agent's accepted fact (`facts revoke`, memo 0.131.28). */
    revoke: v.optional(v.boolean(), false),
    roles: v.optional(v.array(RoleSchema)),
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

const ReviewSourceSchema = v.object({
  ref: text,
  kind: text,
  cause: v.string(),
  replacement: text,
  quote: text,
  /** The source as the record cited it, and as it is now; `null` once it is gone. */
  cited: text,
  now: text,
})

export const SourceReviewSchema = v.object({
  id: v.string(),
  cause: v.string(),
  raisedAt: text,
  sources: v.array(ReviewSourceSchema),
  challenges: v.array(v.object({ evidence: v.array(v.string()), reason: v.string(), by: text, at: text })),
  suggestions: v.array(v.object({ author: text, body: v.string(), at: text })),
})

export type SourceReview = v.InferOutput<typeof SourceReviewSchema>
export type ReviewAnswer = "stillTrue" | "dismiss" | "withdraw"
export type SourceContext = v.InferOutput<typeof SourceContextSchema>
export type MemoryEntry = v.InferOutput<typeof MemoryEntrySchema>
export type Role = v.InferOutput<typeof RoleSchema>
export type AgentCall = v.InferOutput<typeof AgentCallSchema>
export type MemoryRead = v.InferOutput<typeof MemoryReadSchema>
export type MemorySource = v.InferOutput<typeof MemorySourceSchema>
export type Forgot = v.InferOutput<typeof ForgotSchema>

/** A relationship after the owner changed its role: a proposal confirmed on the way is now `link:<id>`. */
export const RelationEditedSchema = v.object({ ref: v.string(), role: text })

/** One relationship proposal decided in a group: memo's new status, or why it refused. */
export const RelationDecidedSchema = v.object({ ref: v.string(), status: text, error: text })

/** What the owner changed besides the text: the kind, and who it is about (`""` for nobody). */
export type MemoryChange = { kind?: string; subject?: string }
export type RelationEdited = v.InferOutput<typeof RelationEditedSchema>
export type RelationDecided = v.InferOutput<typeof RelationDecidedSchema>
