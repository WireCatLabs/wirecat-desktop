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
  /** How sure memo is; memo lists the matches by it, highest first, and the page keeps that order. */
  score: v.nullable(v.number()),
  /** `role` or `line`: `mailbox` is shared, a company's or a family's, which WireCat never joins people by itself. */
  shared: text,
  mailbox: text,
})

/** Accounts an agent says are not this person: `unlink` moves them to one new person, `unmerge` undoes `merge`. */
export const SplitSchema = v.object({
  id: v.string(),
  person: v.string(),
  op: v.string(),
  identities: v.array(v.string()),
  merge: text,
  reason: text,
  evidence: v.array(v.string()),
  proposer: v.nullable(v.object({ kind: v.string(), name: text })),
})

/** A person whose accounts may be wrongly joined, with memo's moves that would set it right. */
const DoubtSchema = v.object({
  person: v.string(),
  name: text,
  owner: v.boolean(),
  reason: v.string(),
  identities: v.array(v.object({ identity: v.string(), name: text })),
  moves: v.array(
    v.variant("op", [
      v.object({ op: v.literal("unmerge"), merge: v.string() }),
      v.object({ op: v.literal("unlink"), identities: v.array(v.string()) }),
    ]),
  ),
})

/** `total` is null in a group, where memo cannot count. */
export const DoubtsSchema = v.object({ items: v.array(DoubtSchema), total: v.nullable(v.number()), more: v.boolean() })

/** A memo older than kinds of people (UX-133) gives only ref, name, owner and tasks: the rest arrives as null. */
const ListedSchema = v.object({
  ref: v.string(),
  name: text,
  owner: v.boolean(),
  tasks: v.number(),
  displayName: v.optional(text, null),
  kind: v.optional(text, null),
  contact: v.optional(text, null),
  phone: v.optional(text, null),
  email: v.optional(text, null),
  /** A messenger handle without its `@`. */
  username: v.optional(text, null),
  /** The messenger `username` is on; null before memo carries it. */
  usernameSource: v.optional(text, null),
  messagesFrom: v.optional(v.nullable(v.number()), null),
  lastContact: v.optional(text, null),
})

const KindCountSchema = v.object({ value: v.number(), more: v.boolean() })

/** One page of one kind, cut by memo; `total` is everyone of that kind (and name) the page is cut from. */
export const PeoplePageSchema = v.object({
  people: v.array(ListedSchema),
  total: v.nullable(KindCountSchema),
  more: v.boolean(),
})

export const PeopleReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: text, need: v.string() }),
  v.object({
    kind: v.literal("ready"),
    people: v.array(ListedSchema),
    peopleMore: v.boolean(),
    matches: v.array(MatchSchema),
    matchesMore: v.boolean(),
    splits: v.optional(v.array(SplitSchema), []),
    /** memo lists one kind of people at a time; false from a memo older than kinds, which lists everyone. */
    kinded: v.optional(v.boolean(), false),
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
      phone: v.optional(text, null),
      email: v.optional(text, null),
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

/** `joined` names the chosen people joined so far, in order, `confirmed` the matches memo confirmed; `stopped` says why the rest were not. */
export const MergedSchema = v.object({
  person: PersonDetailSchema,
  joined: v.array(v.string()),
  confirmed: v.array(v.string()),
  stopped: text,
})

export const ResolvedSchema = v.variant("kind", [
  v.object({ kind: v.literal("done"), organization: text, mailbox: text, person: PersonDetailSchema }),
  v.object({
    kind: v.literal("refused"),
    reason: v.string(),
    message: v.string(),
    organizations: v.array(v.object({ ref: v.string(), name: text })),
  }),
])

export type Match = v.InferOutput<typeof MatchSchema>
export type Resolved = v.InferOutput<typeof ResolvedSchema>
export type Split = v.InferOutput<typeof SplitSchema>
export type Doubts = v.InferOutput<typeof DoubtsSchema>
export type Doubt = Doubts["items"][number]
export type PeopleRead = v.InferOutput<typeof PeopleReadSchema>
export type PeoplePage = v.InferOutput<typeof PeoplePageSchema>
export type Listed = v.InferOutput<typeof ListedSchema>
export type PersonDetail = v.InferOutput<typeof PersonDetailSchema>
export type Identity = PersonDetail["identities"][number]
export type Merge = PersonDetail["merges"][number]
export type Unlinked = v.InferOutput<typeof UnlinkedSchema>
export type Merged = v.InferOutput<typeof MergedSchema>
export type MatchAnswer = "confirm" | "reject"

/** memo's kinds of people, in the order the page offers them. */
export const PERSON_KINDS = ["person", "organization", "automated", "stranger", "unsorted"] as const
export type PersonKind = (typeof PERSON_KINDS)[number]
export const PEOPLE_SORTS = ["interactions", "recent", "name", "tasks"] as const
export type PeopleSort = (typeof PEOPLE_SORTS)[number]

export const KindCountsSchema = v.record(v.string(), KindCountSchema)
export type KindCount = v.InferOutput<typeof KindCountsSchema>[string]
