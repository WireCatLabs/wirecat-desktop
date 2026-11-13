import { valuesOf } from "@/domain/query-terms"
import type { DocumentAccount, DocumentDetails, DocumentPage, DocumentRow, DocumentSource } from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault, OLD_MEMO } from "./mock-memo"
import type { Platform } from "./types"

// memo's `documents tree|list|show` (`?section=documents`): a Drive account, a notes folder and an import, with
// folders two levels deep; one document has a text long enough to read in parts. `?documents=empty` has none,
// `many` 1 240 so the list pages, `capped` more than memo counts ("10 000+"), `fail` refuses every read, `old` and
// `missing` are a memo too old or not installed; `?documents-fail=show|reveal` refuses one document or its file.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("documents") ?? memoDefault({ missing: "missing", old: "old", failing: "fail" })
const failing = params.get("documents-fail")

const DAY = 86_400_000
const at = (days: number) => new Date(Date.UTC(2026, 10, 13, 9) - days * DAY).toISOString()

const DRIVE: DocumentAccount = {
  provider: "google-drive",
  account: "ana@example.org",
  source: "google-drive:ana@example.org",
  label: "Google Drive · ana@example.org",
}
const NOTES: DocumentAccount = { provider: "notes", account: "1", source: "notes:1", label: "Notes · Synthetic notes" }
const IMPORT: DocumentAccount = {
  provider: "import",
  account: "archive",
  source: "import:archive",
  label: "Import · archive",
}

type Seed = Omit<DocumentRow, "ref" | "mime" | "storedAt" | "path"> & { people?: string[]; meeting?: boolean }

const doc = (
  source: DocumentAccount,
  title: string,
  kind: string,
  folder: string | null,
  days: number,
  more: Partial<Seed> = {},
): Seed => ({
  title,
  fileName: null,
  kind,
  size: 18_000 + title.length * 1_300,
  source,
  folder,
  url: source === DRIVE ? `https://drive.google.com/file/d/${title.replace(/\W+/g, "-").toLowerCase()}` : null,
  local: source !== DRIVE,
  sourceModifiedAt: at(days),
  hasText: true,
  ...more,
})

const SEEDS: Seed[] = [
  doc(DRIVE, "Q4 plan", "doc", "Projects/Acme", 0.2, { people: ["person:7", "person:4"], meeting: true }),
  doc(DRIVE, "Budget 2027", "sheet", "Projects/Acme", 1),
  doc(DRIVE, "Board minutes, 12 November", "doc", "Board", 1.2, { meeting: true }),
  doc(DRIVE, "Pitch deck", "slides", "Projects/Acme", 3),
  doc(DRIVE, "Signed contract", "pdf", "Contracts", 5, { fileName: "contract-acme-2026.pdf" }),
  doc(DRIVE, "Offsite photos", "image", "Team", 6, { hasText: false }),
  doc(DRIVE, "Hiring scorecard", "sheet", "Team/Hiring", 8),
  doc(DRIVE, "Interview notes, Lena", "doc", "Team/Hiring", 9, { people: ["person:7"] }),
  doc(DRIVE, "Vendor list", "csv", null, 11, { fileName: "vendors.csv" }),
  doc(NOTES, "Weekly review", "md", "Reviews", 0.5, { fileName: "weekly-review.md" }),
  doc(NOTES, "Reading list", "md", null, 2, { fileName: "reading.md" }),
  doc(NOTES, "Kai, 1:1 notes", "md", "People", 4, { fileName: "kai.md", people: ["person:4"] }),
  doc(NOTES, "Trip to Lisbon", "txt", "Travel", 15, { fileName: "lisbon.txt" }),
  doc(IMPORT, "Call with the bank", "transcript", "Calls", 2.5, { fileName: "bank-call.vtt", meeting: true }),
  doc(IMPORT, "Lease agreement", "docx", null, 30, { fileName: "lease.docx" }),
  doc(IMPORT, "Scanned receipt", "pdf", "Receipts", 40, { fileName: "receipt-0042.pdf", hasText: false }),
]

const many = (): Seed[] =>
  Array.from({ length: 1_240 }, (_, i) =>
    doc(
      i % 3 === 0 ? NOTES : DRIVE,
      `Synthetic document ${i + 1}`,
      ["doc", "pdf", "md", "sheet"][i % 4] ?? "doc",
      ["Archive", "Archive/2025", null][i % 3] as string | null,
      i / 4,
    ),
  )

const seeds = () => (scenario === "empty" ? [] : scenario === "many" || scenario === "capped" ? many() : SEEDS)

const rows = (): (DocumentRow & Pick<Seed, "people" | "meeting">)[] =>
  seeds().map((s, i) => ({
    ...s,
    ref: `document:${40 + i}`,
    mime: null,
    path: s.folder ? `${s.folder}/${s.fileName ?? s.title}` : (s.fileName ?? s.title),
    storedAt: s.sourceModifiedAt,
  }))

function tree(): DocumentSource[] {
  const all = rows()
  return [DRIVE, NOTES, IMPORT].flatMap((account) => {
    const own = all.filter((r) => r.source.source === account.source)
    if (own.length === 0) return []
    const paths = [...new Set(own.flatMap((r) => (r.folder ? prefixes(r.folder) : [])))].sort()
    return [
      {
        ...account,
        name: account.label.split(" · ")[1] ?? null,
        count: own.length,
        loose: own.filter((r) => !r.folder).length,
        folders: paths.map((path) => ({
          path,
          name: path.split("/").pop() ?? path,
          depth: path.split("/").length,
          count: own.filter((r) => r.folder === path || r.folder?.startsWith(`${path}/`)).length,
        })),
      },
    ]
  })
}

const prefixes = (folder: string) => folder.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))

function matches(r: DocumentRow, query: string): boolean {
  const kinds = valuesOf(query, "kind")
  const sources = valuesOf(query, "source")
  const folders = valuesOf(query, "folder")
  const text = valuesOf(query, "has_text")
  const words = query
    .replace(/\S+:("[^"]*"|\([^)]*\)|\S+)/g, "")
    .split(/\s+/)
    .filter(Boolean)
  return (
    (kinds.length === 0 || kinds.includes(r.kind)) &&
    (sources.length === 0 || sources.some((s) => s === r.source.source || s === r.source.provider)) &&
    (folders.length === 0 || folders.some((f) => r.folder === f || r.folder?.startsWith(`${f}/`))) &&
    (text.length === 0 || text.includes(String(r.hasText))) &&
    words.every((w) => (r.title ?? "").toLowerCase().includes(w.toLowerCase()))
  )
}

const LONG = Array.from(
  { length: 60 },
  (_, i) =>
    `${i + 1}. The plan for the fourth quarter keeps the synthetic numbers of this example: revenue, hiring and the ` +
    "offsite, each with an owner and a date. Nothing here is a real company's figure.",
).join("\n\n")

const textOf = (r: DocumentRow) =>
  r.title === "Q4 plan"
    ? LONG
    : `${r.title}\n\nA short synthetic document for the Documents page. It names no real person or company.`

const PART = 2_000

function show(ref: string, cursor: number): DocumentDetails {
  const r = rows().find((d) => d.ref === ref)
  if (!r) throw new Error(`no document ${ref} in the store`)
  const whole = r.hasText ? textOf(r) : ""
  const text = r.hasText ? whole.slice(cursor, cursor + PART) : null
  const { people, meeting, ...document } = r
  return {
    document,
    text,
    textOffset: Math.min(cursor, whole.length),
    textLength: whole.length,
    hasMore: r.hasText && cursor + PART < whole.length,
    extractionError: r.hasText ? null : "no text layer: the file is a picture",
    language: r.hasText ? "en" : null,
    tags: r.title === "Q4 plan" ? ["plan", "acme"] : [],
    people: (people ?? []).map((p) => ({
      ref: p,
      name: p === "person:7" ? "Lena Ortiz" : "Kai Moreno",
      kind: "person",
    })),
    meetings: meeting
      ? [{ ref: "event:665", title: "Board review", at: "2026-11-12T11:00:00.000Z", role: "attachment" }]
      : [],
    events: [],
  }
}

const FAILED = "another memo sync holds the store; try again when it ends"

export function documentsMock(): Pick<
  Platform,
  "documentsRead" | "documentsList" | "documentsShow" | "documentsReveal"
> {
  return {
    async documentsRead() {
      await delay(400)
      if (scenario === "fail") throw new Error(FAILED)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: OLD_MEMO, need: "0.133.0" }
      return { kind: "ready", sources: tree() }
    },
    async documentsList(query, page, limit): Promise<DocumentPage> {
      await delay(500)
      if (scenario === "fail") throw new Error(FAILED)
      const found = rows().filter((r) => matches(r, query))
      const slice = found.slice((page - 1) * limit, page * limit).map(({ people, meeting, ...r }) => r)
      const capped = scenario === "capped"
      return {
        documents: slice,
        total: capped ? 10_000 : found.length,
        totalMore: capped,
        more: page * limit < found.length,
      }
    },
    async documentsShow(ref, cursor) {
      await delay(450)
      if (failing === "show") throw new Error(FAILED)
      return show(ref, cursor)
    },
    async documentsReveal() {
      await delay(200)
      if (failing === "reveal") throw new Error("The document's file is not on this computer any more.")
    },
  }
}
