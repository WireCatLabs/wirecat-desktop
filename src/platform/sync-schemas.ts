import * as v from "valibot"

export const SyncSummarySchema = v.object({
  new: v.number(),
  places: v.number(),
  failed: v.number(),
  left: v.number(),
  complete: v.boolean(),
})

export const SyncEventSchema = v.variant("event", [
  v.object({ event: v.literal("stage"), stage: v.string() }),
  v.object({
    event: v.literal("progress"),
    chats: v.nullable(v.number()),
    chatsDone: v.nullable(v.number()),
    fetched: v.number(),
  }),
  v.object({ event: v.literal("done"), summary: SyncSummarySchema }),
  v.object({ event: v.literal("stopped") }),
  v.object({
    event: v.literal("failed"),
    message: v.string(),
    code: v.nullable(v.string()),
    reason: v.nullable(v.string()),
    /** The tool's failed run, to open on the Logs page; the tool's own message never reaches the window. */
    run: v.nullable(v.string()),
  }),
])

export const LastSyncSchema = v.object({
  at: v.nullable(v.string()),
  left: v.nullable(v.number()),
  known: v.boolean(),
})

/** Whether the tool's own `serve` runs for a profile; `unit` is whether its systemd unit or launchd agent exists. */
export const BackgroundSchema = v.variant("state", [
  v.object({ state: v.literal("running") }),
  v.object({ state: v.literal("stopped"), unit: v.nullable(v.boolean()) }),
  v.object({ state: v.literal("unknown") }),
])

export type SyncSummary = v.InferOutput<typeof SyncSummarySchema>
export type SyncEvent = v.InferOutput<typeof SyncEventSchema>
export type LastSync = v.InferOutput<typeof LastSyncSchema>
export type Background = v.InferOutput<typeof BackgroundSchema>
