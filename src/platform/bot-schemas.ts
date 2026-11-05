import * as v from "valibot"

/** `bot_sign_in`: what the tool said once it checked the token with the messenger. The token never comes back. */
export const BotResultSchema = v.variant("outcome", [
  v.object({ outcome: v.literal("connected"), name: v.nullable(v.string()), username: v.nullable(v.string()) }),
  v.object({
    outcome: v.literal("failed"),
    message: v.string(),
    code: v.nullable(v.string()),
    reason: v.nullable(v.string()),
  }),
])

/** `list_bots`: every name on this computer with a bot token, and where the token lives. */
export const BotProfilesSchema = v.array(v.object({ name: v.string(), source: v.nullable(v.string()) }))

export type BotResult = v.InferOutput<typeof BotResultSchema>
export type BotProfile = v.InferOutput<typeof BotProfilesSchema>[number]
