import * as v from "valibot"

// Owned by the People page: the shapes `people.rs` builds from memo's `people` and `review` commands. Methods, scopes
// and providers stay strings: a newer memo may add one, and the page shows it as memo names it.

const text = v.nullable(v.string())

export const MatchSchema = v.object({
  id: v.string(),
  persons: v.array(v.string()),
  summary: text,
  reason: text,
  evidence: v.array(v.string()),
  proposedBy: text,
  createdAt: text,
})

export const PeopleReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: text, need: v.string() }),
  v.object({
    kind: v.literal("ready"),
    people: v.array(v.object({ ref: v.string(), name: text, owner: v.boolean(), tasks: v.number() })),
    matches: v.array(MatchSchema),
  }),
])

export const PersonDetailSchema = v.object({
  ref: v.string(),
  name: text,
  mergedInto: text,
  identities: v.array(
    v.object({
      identity: v.string(),
      provider: v.string(),
      name: text,
      username: text,
      seenIn: v.array(v.object({ account: v.string(), scope: text })),
      method: text,
      linkedBy: text,
      linkedAt: text,
    }),
  ),
  merges: v.array(
    v.object({
      id: v.string(),
      from: v.string(),
      identities: v.array(v.object({ identity: v.string(), name: text })),
      method: text,
      by: text,
      at: text,
    }),
  ),
  matches: v.array(MatchSchema),
})

export const UnlinkedSchema = v.object({ person: PersonDetailSchema, movedTo: v.string() })

export type Match = v.InferOutput<typeof MatchSchema>
export type PeopleRead = v.InferOutput<typeof PeopleReadSchema>
export type Listed = Extract<PeopleRead, { kind: "ready" }>["people"][number]
export type PersonDetail = v.InferOutput<typeof PersonDetailSchema>
export type Identity = PersonDetail["identities"][number]
export type Merge = PersonDetail["merges"][number]
export type Unlinked = v.InferOutput<typeof UnlinkedSchema>
export type MatchAnswer = "confirm" | "reject"
