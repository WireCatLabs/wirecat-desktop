import type { AccountsText } from "./messages-accounts"

type Remove = AccountsText["remove"]

/** cli-core's own kept reasons (`account-remove.ts`); the dialog says these in the interface language. */
const KNOWN_REASONS: Record<string, keyof Remove["reasons"]> = {
  "the record of what was sent for this account": "sends",
  "the store does not exist yet, so it holds nothing of this account": "storeEmpty",
  "this profile never recorded which account it is, so nothing in the store can be told apart as its": "storeUnknown",
  "a run with moved folders never removes the owner's sign-in": "movedRun",
}

/** The tools whose sign-in is a session the service ends on its side, and those whose access the provider takes back. */
const SESSION_TOOLS = new Set(["tg", "max", "wa"])
const PROVIDER_TOOLS = new Set(["drive", "gcal", "mail"])

export type Words = { text: string; fromTool: boolean }

/** The dialog's words for a kept reason, or the tool's own sentence when the dialog does not know it. */
export const keptReason = (reason: string, m: Remove): Words => {
  const key = KNOWN_REASONS[reason]
  return key ? { text: m.reasons[key], fromTool: false } : { text: reason, fromTool: true }
}

/** What the service does with the sign-in, by tool and the `revoked` flag (`null` while only planned). */
export const signInLine = (toolId: string, toolName: string, revoked: boolean | null, m: Remove): string | null => {
  if (SESSION_TOOLS.has(toolId)) return m.signInSession(toolName)
  if (!PROVIDER_TOOLS.has(toolId)) return null
  if (revoked === true) return m.signInRevoked
  if (revoked === false) return m.signInKept
  return m.signInRevokes
}

/** The tool's busy message names what holds the account first: "`tg serve` is running for personal — stop it…". */
export const busyHolder = (message: string): string | null => {
  const found = /^(`[^`]+`) is running for /.exec(message) ?? /^(\S+\.service) is running for /.exec(message)
  return found?.[1]?.replaceAll("`", "") ?? null
}
