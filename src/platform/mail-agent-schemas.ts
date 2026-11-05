import * as v from "valibot"

/** The last run of memo's mail agent, without its output; `reason` is memo's words for a run it did not start. */
export const LastRunSchema = v.object({
  at: v.string(),
  exitCode: v.number(),
  reason: v.nullable(v.string()),
  failures: v.nullable(v.number()),
})

/** memo's `mail-triage` schedule; `harness` is whether the agent program it starts is installed. */
export const MailAgentSchema = v.variant("state", [
  v.object({ state: v.literal("noMemo") }),
  v.object({ state: v.literal("old"), version: v.nullable(v.string()), need: v.string() }),
  v.object({ state: v.literal("off"), harness: v.boolean() }),
  v.object({
    state: v.literal("on"),
    when: v.string(),
    last: v.nullable(LastRunSchema),
    spentTodayUsd: v.nullable(v.number()),
  }),
])

export const WaitingSchema = v.nullable(v.number())

export type MailAgent = v.InferOutput<typeof MailAgentSchema>
export type LastRun = v.InferOutput<typeof LastRunSchema>
