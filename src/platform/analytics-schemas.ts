import * as v from "valibot"

// Owned by the Analytics feature: the shapes `analytics.rs` builds from a messenger's `stats messages show`.

const count = v.pipe(v.number(), v.integer(), v.minValue(0))

export const PERIODS = ["7d", "30d", "90d", "all"] as const
export type Period = (typeof PERIODS)[number]
export type CountBy = "day" | "hour" | "sender" | "chat"
/** Which messages to count; each is a fixed term in Rust (`from:me`, `has:photo`, `kind:group`…). */
export type Only = "all" | "sent" | "photo" | "voice" | "video" | "file" | "link" | "private" | "group" | "channel"
/** One count: the period or, with `previous`, the same length just before it. */
export type Ask = { period: Period; by: CountBy; only: Only; previous: boolean }

export const CountRowSchema = v.object({ key: v.string(), name: v.nullable(v.string()), count })

export const MessageCountsSchema = v.variant("kind", [
  v.object({ kind: v.literal("ready"), total: count, rows: v.array(CountRowSchema), more: v.boolean() }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string() }),
])

/**
 * What no tool can count yet, filled only by the browser build so the page's design can be judged. The real app answers
 * null and the page shows each part as arriving with an update (plan `docs/dev/plans/2026-11-02-analytics.md`).
 */
export type AnalyticsPreview = {
  /** Tasks made and closed per week, oldest first; `week` is the Monday it starts on. */
  taskWeeks: { week: string; created: number; closed: number }[]
  /** Messages and mail linked to each project in the period, by project key. */
  projectMessages: Record<string, number>
  /** Meetings on the calendar for tomorrow: the stored meetings are past ones only (plan, A2). */
  meetingsTomorrow: number
}

export type CountRow = v.InferOutput<typeof CountRowSchema>
export type MessageCounts = v.InferOutput<typeof MessageCountsSchema>

/** The Analytics page's aggregates by name, as in the catalog's `aggregates`. */
export type Which = "responses" | "waiting" | "coverage" | "meetings" | "mail" | "taskSources"

/** What a tool printed for one aggregate; `old` when the installed version does not have the command yet. */
export const AggregateSchema = v.variant("kind", [
  v.object({ kind: v.literal("ready"), body: v.unknown() }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string() }),
])
export type Aggregate = v.InferOutput<typeof AggregateSchema>

const n = v.pipe(v.number(), v.minValue(0))
const ms = v.nullable(n)

export const ResponsesSchema = v.looseObject({
  replies: n,
  median_ms: ms,
  p90_ms: ms,
  mean_ms: v.optional(ms, null),
  rows: v.optional(v.array(v.looseObject({ key: v.string(), replies: n, median_ms: ms, p90_ms: ms })), []),
})
export const WaitingSchema = v.looseObject({ chats: n, messages: n, oldest_at: v.nullable(v.string()) })
export const CoverageSchema = v.looseObject({ chats: n, fetched: n, partial: v.optional(n, 0), never: n })
export const MeetingsListSchema = v.looseObject({
  items: v.array(
    v.looseObject({
      started_at: v.nullable(v.string()),
      duration_ms: v.optional(v.nullable(n), null),
      title: v.optional(v.nullable(v.string()), null),
    }),
  ),
})
export const MailSchema = v.looseObject({
  received: n,
  sent: n,
  rows: v.array(v.looseObject({ key: v.string(), received: n, sent: n })),
})
export const TaskSourcesSchema = v.looseObject({
  items: v.array(
    v.looseObject({
      open: n,
      rows: v.array(
        v.looseObject({
          chat: v.string(),
          name: v.optional(v.nullable(v.string()), null),
          open: n,
          oldest_open_at: v.nullable(v.string()),
          median_close_ms: ms,
        }),
      ),
    }),
  ),
})

export type Responses = v.InferOutput<typeof ResponsesSchema>
export type Waiting = v.InferOutput<typeof WaitingSchema>
export type Coverage = v.InferOutput<typeof CoverageSchema>
export type MeetingsList = v.InferOutput<typeof MeetingsListSchema>
export type Mail = v.InferOutput<typeof MailSchema>
export type TaskSources = v.InferOutput<typeof TaskSourcesSchema>
