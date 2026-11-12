import * as v from "valibot"

// Owned by Settings "AI model": the shapes `ai_model.rs` builds from memo's `models ai` commands. The provider and the
// reasons stay strings: a newer memo may add one, and the page falls back to a plain line for what it does not know.

const text = v.nullable(v.string())

export const AiModelSchema = v.object({
  provider: text,
  model: text,
  baseUrl: text,
  origin: text,
  beta: v.boolean(),
  /** The owner agreed that pictures go to this model. */
  images: v.boolean(),
  key: v.object({ stored: v.boolean(), source: text }),
})

export const AiCheckedSchema = v.object({
  ok: v.boolean(),
  reason: v.string(),
  ms: v.nullable(v.number()),
  provider: text,
  model: text,
  origin: text,
})

export const AiOffSchema = v.object({ changed: v.boolean(), keyKept: v.boolean() })

export const AiModelListSchema = v.array(v.string())

/** `local_only.rs`: where each feature sends data now. `where` stays a string: a newer memo may add a place. */
export const LocalOnlyStatusSchema = v.object({
  on: v.boolean(),
  since: text,
  features: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      where: v.string(),
      address: text,
      refused: v.boolean(),
    }),
  ),
})

export const LocalOnlySchema = v.variant("state", [
  v.object({ state: v.literal("old"), version: text, need: text }),
  v.object({ state: v.literal("ready"), status: LocalOnlyStatusSchema }),
])

export type LocalOnlyStatus = v.InferOutput<typeof LocalOnlyStatusSchema>
export type LocalOnly = v.InferOutput<typeof LocalOnlySchema>
export type AiModel = v.InferOutput<typeof AiModelSchema>
export type AiChecked = v.InferOutput<typeof AiCheckedSchema>
export type AiOff = v.InferOutput<typeof AiOffSchema>
export type AiModelChoice = {
  provider: string
  model: string
  baseUrl: string | null
  /** Sent once on memo's stdin; `null` keeps the key memo already holds. */
  key: string | null
  images: boolean
}
