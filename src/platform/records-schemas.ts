import * as v from "valibot"

export const RecordColumnSchema = v.looseObject({
  name: v.string(),
  kind: v.string(),
  required: v.boolean(),
  shape: v.string(),
  description: v.string(),
  values: v.optional(v.array(v.string())),
  targets: v.optional(v.array(v.string())),
  many: v.optional(v.boolean()),
})
export type RecordColumn = v.InferOutput<typeof RecordColumnSchema>

export const RecordTypesSchema = v.array(v.looseObject({ type: v.string(), columns: v.array(RecordColumnSchema) }))
export type RecordType = v.InferOutput<typeof RecordTypesSchema>[number]

const PlaceSchema = v.optional(v.object({ line: v.number(), column: v.optional(v.string()) }))
/** One line of the receipt the page lists: what memo said, and where in the file. */
const LineSchema = v.looseObject({
  key: v.optional(v.string()),
  message: v.optional(v.string()),
  code: v.optional(v.string()),
  reason: v.optional(v.string()),
  missing: v.optional(v.array(v.string())),
  place: PlaceSchema,
})
export type ReceiptLine = v.InferOutput<typeof LineSchema>

export const ReceiptSchema = v.looseObject({
  created: v.number(),
  updated: v.number(),
  unchanged: v.number(),
  deleted: v.number(),
  refused: v.number(),
  proposed: v.array(v.string()),
  errors: v.array(LineSchema),
  waiting: v.array(LineSchema),
  flagged: v.array(LineSchema),
  unmatched: v.array(LineSchema),
  ignored: v.array(LineSchema),
  truncated: v.optional(v.boolean()),
})
export type Receipt = v.InferOutput<typeof ReceiptSchema>

export const ImportOutcomeSchema = v.variant("kind", [
  v.object({ kind: v.literal("receipt"), receipt: ReceiptSchema }),
  v.object({ kind: v.literal("failed"), message: v.string() }),
])
export type ImportOutcome = v.InferOutput<typeof ImportOutcomeSchema>

/** memo's answer when the installed memo has no `records template`. */
export const RECORDS_TOO_OLD = "records.too-old"
