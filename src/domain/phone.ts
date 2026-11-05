/**
 * A phone number typed for Telegram, in the international format (E.164): `+`, the country code and the number, 8 to
 * 15 digits in all. tg hands the text to Telegram as it is (tg-cli `src/telegram/login.ts`), so the window cleans it
 * first. No numbering plans: Telegram says itself when a well-formed number does not exist (PHONE_NUMBER_INVALID).
 */
export type PhoneProblem =
  | { problem: "empty" }
  | { problem: "noCountry" }
  | { problem: "zeroCountry" }
  | { problem: "short"; digits: number }
  | { problem: "long"; digits: number }

export type PhoneCheck = { value: string; problem: null } | ({ value: string } & PhoneProblem)

const MIN = 8
const MAX = 15

/** What the field keeps of what was typed or pasted: digits, and a `+` only before them ("Phone: +34 …"). */
export const phoneTyped = (raw: string) => `${/^\D*\+/.test(raw) ? "+" : ""}${raw.replace(/\D/g, "")}`

export function checkPhone(raw: string): PhoneCheck {
  const typed = phoneTyped(raw)
  // 00 is the international prefix dialled from most countries.
  const value = typed.startsWith("00") ? `+${typed.slice(2)}` : typed
  const digits = value.replace("+", "")
  if (digits.length === 0) return { value, problem: "empty" }
  if (!value.startsWith("+")) return { value, problem: "noCountry" }
  if (digits.startsWith("0")) return { value, problem: "zeroCountry" }
  if (digits.length < MIN) return { value, problem: "short", digits: digits.length }
  if (digits.length > MAX) return { value, problem: "long", digits: digits.length }
  return { value, problem: null }
}

/** Country codes are prefix-free: these are the one- and two-digit ones, every other code has three digits. */
const SHORT_CODES = new Set(
  "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98".split(
    " ",
  ),
)

/** `+34612345678` → `+34 612 345 678`: the country code apart, the rest in threes, so the owner can read it back. */
export function formatPhone(e164: string) {
  const digits = e164.replace(/\D/g, "")
  const length = SHORT_CODES.has(digits.slice(0, 1)) ? 1 : SHORT_CODES.has(digits.slice(0, 2)) ? 2 : 3
  const groups = digits.slice(length).match(/\d{1,3}/g) ?? []
  const last = groups.at(-1)
  if (groups.length > 1 && last?.length === 1) groups.splice(-2, 2, `${groups.at(-2)}${last}`)
  return [`+${digits.slice(0, length)}`, ...groups].join(" ")
}
