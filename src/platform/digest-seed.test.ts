import * as v from "valibot"
import { expect, it } from "vitest"
import seed from "../../scripts/sandbox-seed/data/digests.json"
import { ReportSchema } from "./digest-schemas"

// One unknown section kind or item type turns a whole digest into plain text, so a schema change fails here first.
it.each(seed.days.map((day) => [day.days_ago, day]))("the seed digest of %i days ago reads as a report", (_, day) => {
  const result = v.safeParse(ReportSchema, { ...day.report, date: "2026-11-10" })
  expect(result.issues ?? []).toEqual([])
})

it("reads a source or channel kind it has no words for as none, not the whole report as text", () => {
  const day = seed.days[0]
  if (!day) throw new Error("no seed day")
  const report = structuredClone(day.report) as Record<string, unknown> & {
    sections: { items: { channel?: string | null }[] }[]
    scope?: Record<string, unknown> | null
  }
  const item = report.sections.find((s) => s.items.length > 0)?.items[0]
  if (item) item.channel = "drive"
  report.scope = {
    from: "2026-11-09T07:00:00Z",
    to: "2026-11-10T07:00:00Z",
    sources: [
      { kind: "telegram", accounts: 1 },
      { kind: "crm", accounts: 1 },
    ],
    counts: { chats: 1, mail: 0, tasks: 0, meetings: 0 },
  }
  const result = v.safeParse(ReportSchema, { ...report, date: "2026-11-10" })
  expect(result.issues ?? []).toEqual([])
  if (!result.success) return
  expect(result.output.sections.flatMap((s) => s.items).some((i) => i.channel === null)).toBe(true)
  expect(result.output.scope?.sources.map((s) => s.kind)).toEqual(["telegram"])
})
