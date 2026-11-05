import * as v from "valibot"

/** The community tools Rust accepted, each as written, and a sentence for each entry it left out. */
export const ExtraToolsSchema = v.object({ tools: v.array(v.unknown()), rejected: v.array(v.string()) })

export type ExtraTools = v.InferOutput<typeof ExtraToolsSchema>

/** "Show community tools": the owner's choice, whether this build has the list's key, and how many tools it added. */
export const CommunityStatusSchema = v.object({ show: v.boolean(), available: v.boolean(), listed: v.number() })

export type CommunityStatus = v.InferOutput<typeof CommunityStatusSchema>
