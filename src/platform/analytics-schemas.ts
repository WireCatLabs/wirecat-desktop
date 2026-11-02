import * as v from "valibot"

// Owned by the Analytics feature: the shapes `analytics.rs` builds from a messenger's `stats messages show`.

const count = v.pipe(v.number(), v.integer(), v.minValue(0))

export const PERIODS = ["7d", "30d", "90d", "all"] as const
export type Period = (typeof PERIODS)[number]
export type CountBy = "day" | "sender" | "chat"

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
}

export type CountRow = v.InferOutput<typeof CountRowSchema>
export type MessageCounts = v.InferOutput<typeof MessageCountsSchema>
