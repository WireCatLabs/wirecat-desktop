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
