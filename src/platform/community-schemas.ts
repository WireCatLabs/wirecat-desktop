import * as v from "valibot"

/** The community tools Rust accepted, each as written, and a sentence for each entry it left out. */
export const ExtraToolsSchema = v.object({ tools: v.array(v.unknown()), rejected: v.array(v.string()) })

export type ExtraTools = v.InferOutput<typeof ExtraToolsSchema>
