/** Add to Memory's rules: what the owner gave, whether it can be saved, and which reader reads it for facts. */

export type Way = "text" | "link" | "file"
export type Draft = { way: Way; text: string; title: string; url: string; path: string | null }
export type Given = { kind: "text"; text: string } | { kind: "file"; path: string } | { kind: "link"; url: string }

/** memo keeps at most this much text of a source by default; more pasted text would be cut without a word. */
export const MAX_TEXT = 200_000

export const emptyDraft = (way: Way = "text"): Draft => ({ way, text: "", title: "", url: "", path: null })

export const isLink = (url: string) => /^https?:\/\/\S+$/i.test(url.trim())

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path

/** What is still missing before Save turns on; `null` when the draft can be saved. */
export function missingOf(d: Draft): "text" | "tooLong" | "link" | "file" | null {
  if (d.way === "text") return !d.text.trim() ? "text" : d.text.length > MAX_TEXT ? "tooLong" : null
  if (d.way === "link") return isLink(d.url) ? null : "link"
  return d.path ? null : "file"
}

export function givenOf(d: Draft): Given | null {
  if (missingOf(d)) return null
  if (d.way === "text") return { kind: "text", text: d.text }
  if (d.way === "link") return { kind: "link", url: d.url.trim() }
  return d.path ? { kind: "file", path: d.path } : null
}

type ReaderLike = { id: string; available: boolean; chosen: boolean }

/** The reader the owner chose in Settings, if it still works here. Never a guess, even when only one exists. */
export const chosenReader = <R extends ReaderLike>(readers: readonly R[]): R | null =>
  readers.find((r) => r.chosen && r.available) ?? null

/** A suggested task needs the owner's own yes; a fact starts ticked, as the panel's design says. */
export const untickedAtFirst = (findings: readonly { id: string; kind: string }[]) =>
  findings.filter((f) => f.kind !== "fact").map((f) => f.id)

export const SOURCE_REASONS = [
  "source.unsupported",
  "source.no-text",
  "source.unreadable",
  "source.engine-missing",
  "source.too-large",
  "source.url-refused",
  "source.url-status",
  "source.url-timeout",
  "source.url-redirects",
  "source.url-unreachable",
  "source.needs-sign-in",
] as const

export const READER_REASONS = [
  "reader.none-chosen",
  "reader.not-signed-in",
  "reader.too-old",
  "reader.limit",
  "reader.key-rejected",
  "reader.no-credit",
  "reader.not-running",
  "reader.timeout",
  "reader.offline",
  "reader.unusable",
] as const

export type Reason = (typeof SOURCE_REASONS)[number] | (typeof READER_REASONS)[number]

/** memo's refusal as one of the reasons the panel words itself; anything else is shown in memo's own words. */
export const reasonOf = (error: string): Reason | null =>
  ([...SOURCE_REASONS, ...READER_REASONS] as readonly string[]).includes(error) ? (error as Reason) : null

/** A memo from before `sources` answers as commander does for any word it does not know. */
export const tooOldFor = (error: string) => /unknown (command|option)/.test(error)
