import * as v from "valibot"

const num = v.nullable(v.number())

/** What `config repair` did: mended the file after a backup, found nothing to do, or refused (`config.unrepairable`). */
export const RepairSchema = v.variant("state", [
  v.object({
    state: v.literal("repaired"),
    file: v.nullable(v.string()),
    backup: v.nullable(v.string()),
    changes: v.array(v.object({ line: num, kind: v.string() })),
  }),
  v.object({ state: v.literal("unchanged"), reason: v.string() }),
  v.object({
    state: v.literal("refused"),
    message: v.nullable(v.string()),
    file: v.nullable(v.string()),
    line: num,
    column: num,
  }),
])

export type Repair = v.InferOutput<typeof RepairSchema>
