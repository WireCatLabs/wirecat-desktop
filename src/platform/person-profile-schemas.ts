import * as v from "valibot"

// What `person_profile.rs` builds from memo's `context` and the person's `people check` row, for the match dialog.

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
})

export type PersonProfile = v.InferOutput<typeof PersonProfileSchema>
