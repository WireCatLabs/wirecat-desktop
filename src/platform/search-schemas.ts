import * as v from "valibot"

// Owned by the Search feature: `search_store`'s answer (`src-tauri/src/search.rs`). A hit is whatever the tool
// printed for it; `src/domain/search.ts` picks what the table shows.
const SpanSchema = v.object({ start: v.number(), end: v.number() })

export const SearchHitSchema = v.record(v.string(), v.unknown())

export const SearchAnswerSchema = v.variant("kind", [
  v.object({
    kind: v.literal("hits"),
    hits: v.array(SearchHitSchema),
    hasMore: v.boolean(),
    paged: v.boolean(),
    notes: v.array(v.string()),
    total: v.nullable(v.object({ value: v.number(), relation: v.picklist(["eq", "gte"]) })),
  }),
  v.object({
    kind: v.literal("queryError"),
    reason: v.string(),
    message: v.string(),
    span: v.nullable(SpanSchema),
  }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({
    kind: v.literal("failed"),
    message: v.string(),
    candidates: v.optional(
      v.array(
        v.object({ id: v.string(), label: v.nullable(v.string()), field: v.nullable(v.picklist(["chat", "from"])) }),
      ),
      [],
    ),
  }),
])

export type SearchHit = v.InferOutput<typeof SearchHitSchema>
export type SearchAnswer = v.InferOutput<typeof SearchAnswerSchema>

export const ValueItemSchema = v.object({
  value: v.string(),
  label: v.nullable(v.string()),
  detail: v.nullable(v.string()),
})
export type ValueItem = v.InferOutput<typeof ValueItemSchema>

// `search_context`'s answer: the tool's JSON as printed; `src/domain/search-context.ts` picks what the page shows.
export const SearchContextSchema = v.variant("kind", [
  v.object({ kind: v.literal("found"), body: v.unknown() }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string() }),
])
export type SearchContext = v.InferOutput<typeof SearchContextSchema>

/** Who turned the owner's words into a query, in the order WireCat tries them (docs/dev/plans/2026-11-01-search.md). */
export const QueryWriterSchema = v.picklist(["claude-code", "chatgpt", "codex", "key"])
export type QueryWriter = v.InferOutput<typeof QueryWriterSchema>

export const QueryDraftSchema = v.variant("kind", [
  v.object({ kind: v.literal("query"), query: v.string(), by: QueryWriterSchema }),
  /** Nothing on this computer can write one: no signed-in Claude Code or Codex, no ChatGPT plan, no key. */
  v.object({ kind: v.literal("none") }),
  v.object({ kind: v.literal("failed"), message: v.string(), by: QueryWriterSchema }),
])
export type QueryDraft = v.InferOutput<typeof QueryDraftSchema>
