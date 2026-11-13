// The Storage tab's import in the browser build. `?records=` picks a state: old (memo has no templates), errors (the
// file has refused lines), fail (memo cannot read the file).
import { delay } from "./mock-delay"
import type { ImportOutcome, Receipt, RecordColumn, RecordType } from "./records-schemas"
import { RECORDS_TOO_OLD } from "./records-schemas"
import type { Platform } from "./types"

const column = (name: string, rest: Partial<RecordColumn> = {}): RecordColumn => ({
  name,
  kind: name.includes(".") ? "item" : "field",
  required: false,
  shape: "text",
  description: "",
  ...rest,
})
const id = column("external_id", { kind: "id", required: true, description: "The record's id in your system" })

const TYPES: RecordType[] = [
  {
    type: "invoice",
    columns: [
      id,
      column("direction", { required: true, values: ["in", "out"] }),
      column("number"),
      column("currency", { shape: "currency", required: true }),
      column("issue_date", { shape: "day" }),
      column("total", { shape: "decimal" }),
      column("counterparty", { kind: "role", targets: ["person", "organization"] }),
      column("lines.description"),
      column("lines.amount", { shape: "decimal" }),
    ],
  },
  {
    type: "payment",
    columns: [
      id,
      column("amount", { shape: "decimal", required: true }),
      column("currency", { shape: "currency", required: true }),
      column("paid_at", { shape: "day" }),
      column("invoice", { kind: "role", targets: ["invoice"] }),
    ],
  },
  {
    type: "transaction",
    columns: [
      id,
      column("direction", { required: true, values: ["in", "out"] }),
      column("amount", { shape: "decimal", required: true }),
      column("date", { shape: "day", required: true }),
      column("wallet", { kind: "role", targets: ["wallet"], required: true }),
    ],
  },
  { type: "organization", columns: [id, column("name", { required: true }), column("vat_id")] },
]

const receipt = (given: Partial<Receipt>): Receipt => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  deleted: 0,
  refused: 0,
  proposed: [],
  errors: [],
  waiting: [],
  flagged: [],
  unmatched: [],
  ignored: [],
  truncated: false,
  ...given,
})

export function recordsMock(params: URLSearchParams) {
  const state = params.get("records")
  let picked: string | null = null
  const run = async (dryRun: boolean): Promise<ImportOutcome> => {
    await delay(dryRun ? 500 : 900)
    if (state === "fail") return { kind: "failed", message: "This file is not CSV or JSON: open it and save it again" }
    if (state === "errors")
      return {
        kind: "receipt",
        receipt: receipt({
          dry_run: dryRun,
          created: 11,
          refused: 2,
          errors: [
            {
              code: "field.shape",
              message: "total is a decimal number: 12,5,0",
              key: "invoice:INV-7",
              place: { line: 8, column: "total" },
            },
            {
              code: "field.required",
              message: "currency is required",
              key: "invoice:INV-9",
              place: { line: 10, column: "currency" },
            },
          ],
        }),
      }
    return {
      kind: "receipt",
      receipt: receipt({
        dry_run: dryRun,
        created: 12,
        updated: 1,
        proposed: dryRun ? [] : ["proposal:31"],
        waiting: [{ key: "invoice:INV-4", missing: ["counterparty"], place: { line: 5, column: "counterparty" } }],
      }),
    }
  }
  return {
    async recordTypes() {
      await delay(300)
      if (state === "old") throw new Error(RECORDS_TOO_OLD)
      return TYPES
    },
    async recordTemplateSave(kind, format) {
      await delay(400)
      return `/home/owner/Downloads/${kind}-template.${format}`
    },
    async recordPickFile() {
      await delay(300)
      picked = "/home/owner/Downloads/invoices-2026.csv"
      return picked
    },
    async recordRun(_kind, _account, dryRun) {
      if (!picked) throw new Error("Choose a file first")
      return run(dryRun)
    },
  } satisfies Pick<Platform, "recordTypes" | "recordTemplateSave" | "recordPickFile" | "recordRun">
}
