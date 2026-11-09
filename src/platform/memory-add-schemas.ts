import * as v from "valibot"
import { MemoryEntrySchema } from "./memory-schemas"

// Owned by Add to Memory: the shapes `memory_add.rs` builds from memo's `sources` commands. Kinds and reasons stay
// strings: a newer memo may add one, and the panel falls back to memo's own words.

const text = v.nullable(v.string())

export const AddedSourceSchema = v.object({
  ref: v.string(),
  created: v.boolean(),
  duplicateOf: text,
  title: text,
  kind: v.string(),
  mime: text,
  bytes: v.nullable(v.number()),
  chars: v.number(),
  truncated: v.nullable(v.boolean()),
  /** `extracted`, or `no-text`: a picture or a scan, found by its title and subjects only. */
  read: v.string(),
  url: text,
  /** `text` or `copy`; `null` for a duplicate. The panel says "File kept" only for `copy`. */
  kept: text,
  searchableWords: v.boolean(),
  searchableMeaning: v.boolean(),
  subjects: v.array(v.string()),
})

export const StoredSourceSchema = v.object({
  ref: v.string(),
  title: text,
  kind: text,
  url: text,
  fileName: text,
  kept: text,
  chars: v.number(),
  text: v.string(),
  textTruncated: v.boolean(),
  subjects: v.array(v.object({ ref: v.string(), confirmed: v.boolean() })),
})

export const MentionsSchema = v.object({
  items: v.array(v.object({ ref: v.string(), type: v.string(), name: text, foundAs: v.array(v.string()) })),
  partial: v.boolean(),
})

export const ReaderSchema = v.object({
  id: v.string(),
  available: v.boolean(),
  signedIn: v.nullable(v.boolean()),
  model: text,
  provider: text,
  leavesComputer: v.boolean(),
  readsFiles: v.boolean(),
  chosen: v.boolean(),
})

export const KeySavedSchema = v.object({ provider: v.string(), source: text })

export const SuggestedSchema = v.object({ batch: MemoryEntrySchema, reused: v.boolean() })

/** The picked file looked at before it is added: a picture's thumbnail as a `data:` address, a text file's first words. */
export const FilePreviewSchema = v.object({
  name: v.string(),
  bytes: v.number(),
  mime: text,
  image: text,
  excerpt: text,
})

/** A web page as memo read it without keeping it; `null` from a memo that cannot yet. */
export const LinkPreviewSchema = v.object({
  url: v.string(),
  title: text,
  site: text,
  description: text,
  excerpt: text,
  kind: text,
  chars: v.nullable(v.number()),
})

export type GivenSource =
  | { kind: "text"; text: string }
  | { kind: "file"; path: string }
  | { kind: "link"; url: string }
export type AddSource = { given: GivenSource; title: string | null; subjects: string[] }
export type AddedSource = v.InferOutput<typeof AddedSourceSchema>
export type StoredSource = v.InferOutput<typeof StoredSourceSchema>
export type Mentions = v.InferOutput<typeof MentionsSchema>
export type Mention = Mentions["items"][number]
export type Reader = v.InferOutput<typeof ReaderSchema>
export type KeySaved = v.InferOutput<typeof KeySavedSchema>
export type Suggested = v.InferOutput<typeof SuggestedSchema>
export type FilePreview = v.InferOutput<typeof FilePreviewSchema>
export type LinkPreview = v.InferOutput<typeof LinkPreviewSchema>
