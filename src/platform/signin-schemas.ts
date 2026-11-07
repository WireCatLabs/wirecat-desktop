import * as v from "valibot"

export const SignInEventSchema = v.variant("event", [
  v.object({
    event: v.literal("qr"),
    /** The tool's half-block drawing of the code; a login token while it is valid, so it is never logged. */
    text: v.string(),
    expiresAt: v.nullable(v.string()),
    scan: v.nullable(v.string()),
  }),
  v.object({
    event: v.literal("pairingCode"),
    code: v.string(),
    place: v.nullable(v.string()),
    expiresAt: v.nullable(v.string()),
  }),
  v.object({ event: v.literal("openUrl"), url: v.pipe(v.string(), v.url()), purpose: v.nullable(v.string()) }),
  v.object({
    event: v.literal("needs"),
    field: v.string(),
    secret: v.boolean(),
    prompt: v.string(),
    hint: v.nullable(v.string()),
  }),
  v.object({ event: v.literal("note"), text: v.string() }),
  v.object({ event: v.literal("progress"), step: v.string(), message: v.nullable(v.string()) }),
  v.object({
    event: v.literal("done"),
    alreadyLinked: v.boolean(),
    received: v.nullable(v.object({ chats: v.number(), messages: v.number(), people: v.number() })),
  }),
  v.object({
    event: v.literal("failed"),
    message: v.string(),
    code: v.nullable(v.string()),
    reason: v.optional(v.nullable(v.string())),
  }),
  v.object({ event: v.literal("stopped") }),
])

export type SignInEvent = v.InferOutput<typeof SignInEventSchema>

/**
 * What the owner typed before the sign-in starts. Rust passes each only where the catalog's method names its flag;
 * the password goes in the variable the tool reads, never on the command line.
 */
export type SignInInputs = {
  address?: string
  password?: string
  /** The text of the owner's own OAuth client JSON, written to a private file for the one run. */
  clientFile?: string
}
