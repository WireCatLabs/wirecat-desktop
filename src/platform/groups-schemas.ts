import * as v from "valibot"

// The shapes `groups.rs` builds from memo's `groups list`, `add`, `remove` and `move`; each write answers every group.

export const GroupMemberSchema = v.object({
  source: v.string(),
  provider: v.string(),
  profiles: v.array(v.string()),
  alsoIn: v.array(v.string()),
})

export const AccountGroupSchema = v.object({
  name: v.string(),
  members: v.array(GroupMemberSchema),
  suggested: v.array(v.string()),
})

export const GroupsReadSchema = v.variant("kind", [
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("old"), version: v.nullable(v.string()) }),
  v.object({ kind: v.literal("ready"), groups: v.array(AccountGroupSchema), unresolved: v.array(v.string()) }),
])

export type GroupsRead = v.InferOutput<typeof GroupsReadSchema>
export type AccountGroup = v.InferOutput<typeof AccountGroupSchema>
