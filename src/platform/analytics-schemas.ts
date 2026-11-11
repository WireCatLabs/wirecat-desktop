import * as v from "valibot"

// Owned by the Analytics feature: the shapes `analytics.rs` builds from a messenger's `stats messages show`.

const count = v.pipe(v.number(), v.integer(), v.minValue(0))

export const PERIODS = ["7d", "30d", "90d", "all"] as const
export type Period = (typeof PERIODS)[number]
export type CountBy = "day" | "hour" | "sender" | "chat"
/** Which messages to count; each is a fixed term in Rust (`from:me`, `has:photo`, `kind:group`…). */
export type Only =
  | "all"
  | "sent"
  | "photo"
  | "voice"
  | "video"
  | "file"
  | "link"
  | "private"
  | "group"
  | "channel"
  | "close"
/**
 * One count: the period or, with `previous`, the same length just before it. `range` puts calendar days in its place;
 * `full` asks for every sender or chat up to the tool's 1000 rows, not the page's top 25.
 */
export type Ask = {
  period: Period
  by: CountBy
  only: Only
  previous: boolean
  range?: { from: string; to: string | null }
  full?: boolean
}

export const CountRowSchema = v.object({ key: v.string(), name: v.nullable(v.string()), count })

export const MessageCountsSchema = v.variant("kind", [
  v.object({
    kind: v.literal("ready"),
    total: count,
    rows: v.array(CountRowSchema),
    more: v.boolean(),
    privateOnly: v.optional(v.boolean()),
  }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string(), code: v.optional(v.nullable(v.string()), null) }),
])

/**
 * What no tool can count yet, filled only by the browser build so the page's design can be judged. The real app answers
 * null and the page shows each part as arriving with an update (plan `docs/dev/plans/2026-11-02-analytics.md`).
 */
export type AnalyticsPreview = {
  /** Tasks made and closed per week, oldest first; `week` is the Monday it starts on. */
  taskWeeks: { week: string; created: number; closed: number }[]
}

export type CountRow = v.InferOutput<typeof CountRowSchema>
export type MessageCounts = v.InferOutput<typeof MessageCountsSchema>

/** The Analytics page's aggregates by name, as in the catalog's `aggregates`. */
export type Which =
  | "responses"
  | "waiting"
  | "coverage"
  | "meetings"
  | "meetingsWeek"
  | "meetingsSeries"
  | "mail"
  | "taskSources"
  | "taskMeetings"
  | "projectActivity"

/** What a tool printed for one aggregate; `old` when the installed version does not have the command yet. */
export const AggregateSchema = v.variant("kind", [
  v.object({ kind: v.literal("ready"), body: v.unknown() }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string(), code: v.optional(v.nullable(v.string())) }),
])
export type Aggregate = v.InferOutput<typeof AggregateSchema>

const n = v.pipe(v.number(), v.minValue(0))
const ms = v.nullable(n)

const Buckets = v.looseObject({ under_5m: n, under_1h: n, under_1d: n, over_1d: n })

export const ResponsesSchema = v.looseObject({
  replies: n,
  median_ms: ms,
  p90_ms: ms,
  mean_ms: v.optional(ms, null),
  buckets: v.optional(v.nullable(Buckets), null),
  rows: v.optional(v.array(v.looseObject({ key: v.string(), replies: n, median_ms: ms, p90_ms: ms })), []),
})
export const WaitingSchema = v.looseObject({
  chats: n,
  messages: n,
  oldest_at: v.nullable(v.string()),
  by_kind: v.optional(v.nullable(v.looseObject({ private: n, group: n })), null),
})
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
/** zm's own meeting counts per day, week or series (`series:<id>` rows, and one `no-series` row). */
export const MeetingHistorySchema = v.looseObject({
  meetings: n,
  minutes: n,
  mean_minutes: v.nullable(n),
  rows: v.array(
    v.looseObject({ key: v.string(), name: v.optional(v.nullable(v.string()), null), meetings: n, minutes: n }),
  ),
})

/** memo's tasks per chat or meeting: open now, made and closed in the period, how long they take. */
export const TaskSourcesSchema = v.looseObject({
  open: n,
  created: n,
  closed: n,
  median_close_ms: ms,
  mean_open_age_ms: ms,
  rows: v.array(
    v.looseObject({
      key: v.string(),
      name: v.optional(v.nullable(v.string()), null),
      open: n,
      created: v.optional(n, 0),
      closed: v.optional(n, 0),
      oldest_open_at: v.nullable(v.string()),
      median_close_ms: ms,
    }),
  ),
})

/** `memo stats projects show`: each project's linked chats; a muted chat is listed, its messages not counted. */
export const ProjectActivitySchema = v.looseObject({
  items: v.array(
    v.looseObject({
      ref: v.string(),
      key: v.nullable(v.string()),
      name: v.nullable(v.string()),
      chats: n,
      muted: n,
      messages: n,
      sent: n,
      last_at: v.nullable(v.string()),
      top: v.array(v.looseObject({ ref: v.string(), title: v.nullable(v.string()), messages: n })),
      partial: v.optional(v.boolean(), false),
    }),
  ),
  page: v.optional(v.looseObject({ has_more: v.optional(v.boolean(), false) }), { has_more: false }),
})

export type ProjectActivity = v.InferOutput<typeof ProjectActivitySchema>["items"][number]
export type Responses = v.InferOutput<typeof ResponsesSchema>
export type Waiting = v.InferOutput<typeof WaitingSchema>
export type Coverage = v.InferOutput<typeof CoverageSchema>
export type MeetingsList = v.InferOutput<typeof MeetingsListSchema>
export type Mail = v.InferOutput<typeof MailSchema>
export type TaskSources = v.InferOutput<typeof TaskSourcesSchema>
export type MeetingHistory = v.InferOutput<typeof MeetingHistorySchema>
