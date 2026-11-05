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

/**
 * Whether a retry may send the app keys typed before without asking: Telegram did not refuse them. A failure this
 * file cannot read may be about the keys, so it asks again.
 */
export const keysStillGood = (failure: TelegramFailure | null) => failure !== null && failure.fix !== "keys"

export type KeyField = "api_id" | "api_hash"

/** Before sending: what is plainly not an app key. tg accepts 1 to 12 digits as api_id (`parseApiId`). */
export type KeyProblem =
  | { problem: "empty" }
  | { problem: "idNotDigits" }
  | { problem: "idTooLong"; length: number }
  | { problem: "idIsHash" }
  | { problem: "hashLength"; length: number }
  | { problem: "hashNotHex" }
  | { problem: "hashIsId" }

export type KeyCheck = { value: string; problem: null } | ({ value: string } & KeyProblem)

/** A value copied with its label from my.telegram.org or a note ("App api_id: 123"), or in quotes. */
const LABEL = /^["'`«“]*(?:app)?api[_-]?(?:id|hash)["'`»”]*[:=]?/i
const QUOTES = /^["'`«“]+|["'`»”,;]+$/g

/** Spaces anywhere, a label in front and quotes around are dropped: neither key ever contains them. */
export const cleanKey = (typed: string) => typed.replace(/\s+/g, "").replace(LABEL, "").replace(QUOTES, "")

const HASH = /^[0-9a-f]{32}$/i

export function checkKey(field: KeyField, typed: string): KeyCheck {
  const value = cleanKey(typed)
  const no = (p: KeyProblem): KeyCheck => ({ value, ...p })
  if (value === "") return no({ problem: "empty" })
  if (field === "api_id") {
    if (HASH.test(value) && !/^\d+$/.test(value)) return no({ problem: "idIsHash" })
    if (!/^\d+$/.test(value)) return no({ problem: "idNotDigits" })
    if (value.length > 12) return no({ problem: "idTooLong", length: value.length })
    return { value, problem: null }
  }
  if (/^\d{1,12}$/.test(value)) return no({ problem: "hashIsId" })
  if (!/^[0-9a-f]+$/i.test(value)) return no({ problem: "hashNotHex" })
  if (value.length !== 32) return no({ problem: "hashLength", length: value.length })
  return { value, problem: null }
}

/**
 * After Telegram refused the keys: what about them still looks off, though it passed `checkKey`. App ids made today
 * have 8 digits and few have fewer than 5 or more than 10; my.telegram.org shows the hash in small letters. Empty when nothing does.
 */
export type KeyHint = "idShort" | "idLong" | "hashCapitals"

export function keyHints(id: string, hash: string): KeyHint[] {
  const hints: KeyHint[] = []
  if (id !== "" && id.length < 5) hints.push("idShort")
  if (id.length > 10) hints.push("idLong")
  if (/[A-F]/.test(hash)) hints.push("hashCapitals")
  return hints
}

/** tg's lines during a phone login (tg-cli `src/telegram/login.ts`): where the code went, or that Telegram refused it. */
export type TelegramNote =
  | { kind: "codeSent"; via: "app" | "sms" | "call" | "other" }
  | { kind: "notAccepted"; what: "code" | "password" }

export function telegramNote(text: string): TelegramNote | null {
  const sent = /^Telegram sent a login code \(([a-z_]+)\)/i.exec(text)
  if (sent) {
    const type = sent[1]?.toLowerCase()
    const via = type === "app" || type === "sms" || type === "call" ? type : "other"
    return { kind: "codeSent", via }
  }
  const refused = /^that (code|password) was not accepted/i.exec(text)
  if (refused) return { kind: "notAccepted", what: refused[1]?.toLowerCase() === "password" ? "password" : "code" }
  return null
}
