import * as v from "valibot"
import { expect, it } from "vitest"
import seed from "../../scripts/sandbox-seed/data/digests.json"
import { ReportSchema } from "./digest-schemas"

// One unknown section kind or item type turns a whole digest into plain text, so a schema change fails here first.
it.each(seed.days.map((day) => [day.days_ago, day]))("the seed digest of %i days ago reads as a report", (_, day) => {
  const result = v.safeParse(ReportSchema, { ...day.report, date: "2026-11-10" })
  expect(result.issues ?? []).toEqual([])
})
