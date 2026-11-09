import * as v from "valibot"

// Owned by the People page: the shapes `people.rs` builds from memo's `people` and `review` commands. Methods, scopes,
// signals and providers stay strings: a newer memo may add one, and the page shows it as memo names it.

const text = v.nullable(v.string())

export const MatchSchema = v.object({
  id: v.string(),
  /** The person `identity` is on, then the one it would join. */
  persons: v.array(v.string()),
  identity: text,
  with: text,
  /** `person` joins the two people; `identity` moves only `identity`. */
  joins: text,
  signal: text,
  candidates: v.array(v.string()),
  reason: text,
  evidence: v.array(v.string()),
  proposer: v.nullable(v.object({ kind: v.string(), name: text })),
})

const ListedSchema = v.object({ ref: v.string(), name: text, owner: v.boolean(), tasks: v.number() })

export const PeopleReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: text, need: v.string() }),
  v.object({
    kind: v.literal("ready"),
    people: v.array(ListedSchema),
    peopleMore: v.boolean(),
    matches: v.array(MatchSchema),
    matchesMore: v.boolean(),
  }),
])

export const PersonDetailSchema = v.object({
  ref: v.string(),
  name: text,
  /** The person asked for was merged into this one, whose ref `ref` is. */
  mergedInto: text,
  identities: v.array(
    v.object({
      identity: v.string(),
      provider: v.string(),
      name: text,
      username: text,
      seenIn: v.array(v.object({ account: v.string(), scope: text })),
      method: text,
      linkedAt: text,
      /** Its ref can go back to memo as one safe word; others are shown, never moved. */
      movable: v.boolean(),
    }),
  ),
  merges: v.array(
    v.object({ id: v.string(), from: v.string(), identities: v.array(v.string()), method: text, at: text }),
  ),
  matches: v.array(MatchSchema),
})

export const UnlinkedSchema = v.object({ person: PersonDetailSchema, movedTo: v.string() })

/** `joined` names the chosen people joined so far, in order; `stopped` says why the rest were not. */
export const MergedSchema = v.object({ person: PersonDetailSchema, joined: v.array(v.string()), stopped: text })

export type Match = v.InferOutput<typeof MatchSchema>
export type PeopleRead = v.InferOutput<typeof PeopleReadSchema>
export type Listed = v.InferOutput<typeof ListedSchema>
export type PersonDetail = v.InferOutput<typeof PersonDetailSchema>
export type Identity = PersonDetail["identities"][number]
export type Merge = PersonDetail["merges"][number]
export type Unlinked = v.InferOutput<typeof UnlinkedSchema>
export type Merged = v.InferOutput<typeof MergedSchema>
export type MatchAnswer = "confirm" | "reject"
