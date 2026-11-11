import * as v from "valibot"

export const BackgroundAgentsSchema = v.object({
  agents: v.array(v.object({ id: v.string(), installed: v.boolean(), signedIn: v.nullable(v.boolean()) })),
  chosen: v.nullable(v.string()),
  effective: v.nullable(v.string()),
})

export type BackgroundAgents = v.InferOutput<typeof BackgroundAgentsSchema>
