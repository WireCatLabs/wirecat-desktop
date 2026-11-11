import * as v from "valibot"

export const AgentStateSchema = v.picklist([
  "ready",
  "notInstalled",
  "programMissing",
  "notSupported",
  "needsNewerMemo",
])

export const BackgroundAgentsSchema = v.object({
  agents: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      state: AgentStateSchema,
      signedIn: v.nullable(v.boolean()),
      reportsCost: v.boolean(),
      restricted: v.boolean(),
    }),
  ),
  chosen: v.nullable(v.string()),
  effective: v.nullable(v.string()),
  listed: v.boolean(),
})

export type BackgroundAgents = v.InferOutput<typeof BackgroundAgentsSchema>
export type BackgroundAgent = BackgroundAgents["agents"][number]
export type AgentState = v.InferOutput<typeof AgentStateSchema>
