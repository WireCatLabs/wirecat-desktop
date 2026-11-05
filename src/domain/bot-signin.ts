import type { BotSource } from "./catalog"

export type TokenProblem = "empty" | "spaces" | "shape"

/** The same rules as `bots.rs`, so a wrong paste is caught before the tool runs; the tool still checks it with the messenger. */
export function tokenProblem(shape: BotSource["token"], typed: string): TokenProblem | null {
  const token = typed.trim()
  if (token === "") return "empty"
  if (token.length > 4096 || /[\s\p{Cc}]/u.test(token)) return "spaces"
  if (shape === "telegram") return /^\d+:[A-Za-z0-9_-]{30,}$/.test(token) ? null : "shape"
  return token.length >= 16 && /^[\x21-\x7e]+$/.test(token) ? null : "shape"
}

/** Meta's ids, the only bot settings so far: digits, which the tool keeps as a string. */
export function fieldProblem(typed: string): "empty" | "digits" | null {
  const value = typed.trim()
  if (value === "") return "empty"
  return /^\d{1,32}$/.test(value) ? null : "digits"
}

export type BotCause = "refused" | "settings" | "update" | "timeout" | "other"

/** What the tool's refusal means for the owner: a token to paste again, an id to fix, an update, or something else. */
export function botCause(failure: { code: string | null; reason: string | null }): BotCause {
  if (failure.code === "needs_update") return "update"
  if (failure.code === "timeout") return "timeout"
  if (failure.reason === "auth.failed" || failure.code === "authentication_error") return "refused"
  if (failure.code === "configuration_error" || failure.code === "not_found" || failure.reason === "config.invalid")
    return "settings"
  return "other"
}

/** How the bot is named on the success screen: its username when the messenger has one, else its name. */
export const botHandle = (bot: { name: string | null; username: string | null }) =>
  bot.username ? `@${bot.username}` : bot.name

/** The words the owner types to use the bot: `tg sales bot me`. */
export const botCommand = (bin: string, profile: string, ...rest: string[]) => [bin, profile, "bot", ...rest].join(" ")
