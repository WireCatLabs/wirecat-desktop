import * as v from "valibot"

const num = v.nullable(v.number())

/** What `config repair` did: fixed the file after a backup, or refused because no fix was provably safe. */
export const RepairSchema = v.variant("state", [
  v.object({
    state: v.literal("repaired"),
    file: v.nullable(v.string()),
    backup: v.nullable(v.string()),
    changes: v.array(v.object({ line: num, column: num, what: v.string() })),
  }),
  v.object({ state: v.literal("refused"), message: v.string(), file: v.nullable(v.string()), line: num }),
])

export type Repair = v.InferOutput<typeof RepairSchema>
