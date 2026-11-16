import * as v from "valibot"

// What `person_profile.rs` builds from memo's `context` and the person's `people check` row, for the match dialog
// and the person's card.

const text = v.nullable(v.string())

export const PersonProfileSchema = v.object({
  phones: v.array(v.string()),
  emails: v.array(v.string()),
  organizations: v.array(v.object({ name: text, role: text })),
  lastContact: text,
  /** `null` when memo's row for the person was not found: the count is then unknown, not zero. */
  messagesFrom: v.nullable(v.number()),
  tasks: v.nullable(v.number()),
  /** `tasks` counts only what the context read, and memo has more. */
  tasksMore: v.boolean(),
  deals: v.number(),
  recent: v.array(
    v.object({
      kind: v.string(),
      at: text,
      text: v.string(),
      outgoing: v.nullable(v.boolean()),
      provider: text,
      chat: text,
      locator: text,
    }),
  ),
  /** Their calls and recorded meetings; `null` from a memo before cli-core 0.650.0, which reads none. */
  meetings: v.nullable(
    v.array(
      v.object({
        ref: v.string(),
        meetingId: v.number(),
        provider: v.string(),
        account: v.string(),
        tool: text,
        title: text,
        startedAt: text,
        durationMs: v.nullable(v.number()),
        hasTranscript: v.boolean(),
        direction: v.optional(text, null),
        manager: v.optional(text, null),
        clientPhone: v.optional(text, null),
      }),
    ),
  ),
})

export type PersonProfile = v.InferOutput<typeof PersonProfileSchema>

/** What `organization_card.rs` builds from memo's `organizations context`, for a company's card. */
export const OrganizationCardSchema = v.object({
  reference: v.string(),
  name: text,
  people: v.array(v.object({ reference: v.string(), name: text, role: text })),
  peopleTotal: v.number(),
  deals: v.array(
    v.object({ reference: v.string(), kind: text, title: text, stage: text, amount: text, currency: text }),
  ),
  dealsTotal: v.number(),
  meetings: v.nullable(v.number()),
})

export type OrganizationCard = v.InferOutput<typeof OrganizationCardSchema>
