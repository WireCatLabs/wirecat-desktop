/** Add to Memory's rules: what the owner gave, whether it can be saved, and which reader reads it for facts. */

import { modelOnThisComputer } from "./ai-model"
import { knownReason } from "./reasons"

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

type ReaderLike = {
  id: string
  available: boolean
  chosen: boolean
  signedIn?: boolean | null
  problem?: string | null
}

/** memo cannot read with it now: not found, signed out, or, for `ai-model`, no model or key in «AI model». */
export const readerOff = (r: ReaderLike) => !r.available || r.signedIn === false || (r.problem ?? null) !== null

/** The reader the owner chose in Settings, if it still works here. Never a guess, even when only one exists. */
export const chosenReader = <R extends ReaderLike>(readers: readonly R[]): R | null =>
  readers.find((r) => r.chosen && r.available && (r.problem ?? null) === null) ?? null

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
  "reader.no-key",
  "reader.ai-not-set",
  "reader.no-credit",
  "reader.not-running",
  "reader.timeout",
  "reader.offline",
  "reader.unusable",
] as const

/** Rust's id for a refusal of a run fed on stdin whose reason the panel does not know: memo's words may quote it. */
export const REFUSED = "memo.refused"

export type Reason = (typeof SOURCE_REASONS)[number] | (typeof READER_REASONS)[number] | typeof REFUSED

/** memo's refusal as one of the reasons the panel words itself; anything else is shown in memo's own words. */
export const reasonOf = (error: string): Reason | null =>
  knownReason<Reason>([...SOURCE_REASONS, ...READER_REASONS, REFUSED], error)

/** A memo from before `sources` answers as commander does for any word it does not know. */
export const tooOldFor = (error: string) => /unknown (command|option)/.test(error)

/** Why a picture would be kept by its name only, from what Settings holds; `null` when the AI model will read it. */
export function imageReasonBefore(
  model: {
    provider: string | null
    baseUrl: string | null
    origin: string | null
    images: boolean
    key: { stored: boolean }
  } | null,
): "ai.not-set" | "ai.images-not-allowed" | "ai.key-missing" | null {
  if (!model?.provider) return "ai.not-set"
  if (!model.images) return "ai.images-not-allowed"
  return !modelOnThisComputer(model) && !model.key.stored ? "ai.key-missing" : null
}

/** The reasons a trip to Settings, "AI model", can mend. */
export const MENDED_IN_SETTINGS = [
  "ai.not-set",
  "ai.images-not-allowed",
  "ai.key-missing",
  "ai.failed",
  "ai.setting-invalid",
  "ai.empty-answer",
]
