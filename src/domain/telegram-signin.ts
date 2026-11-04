/**
 * Why a Telegram sign-in failed, read from tg's own error line, and the way back. tg says Telegram's refusals as
 * "Telegram refused: API_ID_INVALID" (tg-cli `src/telegram/errors.ts`), a wait as "Telegram asks to wait 34 s before
 * the next request", and a login Telegram ended as "Telegram ended this login". A wrong code or two-step password is
 * asked again inside the same run; it reaches here only when Telegram gives up on it.
 */
export type TelegramFailureKind =
  | "apiIdInvalid"
  | "apiIdPublished"
  | "phoneInvalid"
  | "phoneBanned"
  | "codeInvalid"
  | "codeExpired"
  | "passwordInvalid"
  | "passwordNeeded"
  | "loginEnded"
  | "floodWait"
  | "network"
  | "telegramDown"

/** What the window offers next to the error. Every way back starts tg's sign-in again; `none` has no fix here. */
export type TelegramFix = "keys" | "phone" | "code" | "password" | "retry" | "wait" | "none"

export type TelegramFailure = {
  kind: TelegramFailureKind
  fix: TelegramFix
  /** Telegram's own name for the error, when the line carried one. */
  error: string | null
  /** `floodWait` only. */
  seconds?: number
}

const BY_NAME: Record<string, [TelegramFailureKind, TelegramFix]> = {
  API_ID_INVALID: ["apiIdInvalid", "keys"],
  API_ID_PUBLISHED_FLOOD: ["apiIdPublished", "keys"],
  PHONE_NUMBER_INVALID: ["phoneInvalid", "phone"],
  PHONE_NUMBER_BANNED: ["phoneBanned", "none"],
  PHONE_NUMBER_FLOOD: ["floodWait", "wait"],
  PHONE_CODE_INVALID: ["codeInvalid", "code"],
  PHONE_CODE_EMPTY: ["codeInvalid", "code"],
  PHONE_CODE_EXPIRED: ["codeExpired", "code"],
  PASSWORD_HASH_INVALID: ["passwordInvalid", "password"],
  SESSION_PASSWORD_NEEDED: ["passwordNeeded", "retry"],
  AUTH_KEY_UNREGISTERED: ["loginEnded", "retry"],
  SESSION_REVOKED: ["loginEnded", "retry"],
  SESSION_EXPIRED: ["loginEnded", "retry"],
}

/** tg's own words for refusals it explains instead of naming them. */
const BY_WORDS: [RegExp, string][] = [
  [/login code was wrong|Provided code was invalid/i, "PHONE_CODE_INVALID"],
  [/two-step verification password was wrong|Provided password was invalid/i, "PASSWORD_HASH_INVALID"],
  [/Telegram ended this login/i, "AUTH_KEY_UNREGISTERED"],
]

const NETWORK =
  /did not answer in time|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|socket hang up|fetch failed|network|could not connect|connection (?:closed|lost|refused)/i

export function telegramFailure(message: string, code: string | null): TelegramFailure | null {
  const wait = /wait (\d+) ?s\b|FLOOD_WAIT_(\d+)|FLOOD_PREMIUM_WAIT_(\d+)/i.exec(message)
  if (wait) {
    const seconds = Number(wait[1] ?? wait[2] ?? wait[3])
    return { kind: "floodWait", fix: "wait", error: "FLOOD_WAIT", seconds }
  }
  for (const [name] of message.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)) {
    const known = BY_NAME[name]
    if (known) return { kind: known[0], fix: known[1], error: name }
  }
  for (const [pattern, name] of BY_WORDS) {
    const known = BY_NAME[name]
    if (pattern.test(message) && known) return { kind: known[0], fix: known[1], error: null }
  }
  if (code === "timeout" || NETWORK.test(message)) return { kind: "network", fix: "retry", error: null }
  if (code === "provider_unavailable" && /^Telegram failed/.test(message))
    return { kind: "telegramDown", fix: "retry", error: /: (\S+)$/.exec(message)?.[1] ?? null }
  return null
}

/** When a wait ends, as hours, minutes and seconds to show; the clock time is the window's to format. */
export function waitParts(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
