import { describe, expect, it } from "vitest"
import {
  checkKey,
  cleanKey,
  keyHints,
  keysStillGood,
  telegramFailure,
  telegramNote,
  waitParts,
} from "./telegram-signin"

describe("telegramFailure", () => {
  it.each([
    ["Telegram refused: API_ID_INVALID", "provider_error", "apiIdInvalid", "keys"],
    ["Telegram refused: API_ID_PUBLISHED_FLOOD", "provider_error", "apiIdPublished", "keys"],
    ["Telegram refused: PHONE_NUMBER_INVALID", "provider_error", "phoneInvalid", "phone"],
    ["Telegram refused: PHONE_NUMBER_BANNED", "provider_error", "phoneBanned", "none"],
    ["Telegram refused: PHONE_CODE_INVALID", "provider_error", "codeInvalid", "code"],
    ["Telegram refused: PHONE_CODE_EXPIRED", "provider_error", "codeExpired", "code"],
    ["Telegram refused: PASSWORD_HASH_INVALID", "provider_error", "passwordInvalid", "password"],
    ["Telegram refused: SESSION_PASSWORD_NEEDED", "permission_error", "passwordNeeded", "retry"],
    ["Telegram refused: AUTH_KEY_UNREGISTERED", "authentication_error", "loginEnded", "retry"],
  ] as const)("%s → %s, %s", (message, code, kind, fix) => {
    const failure = telegramFailure(message, code)
    expect(failure).toMatchObject({ kind, fix })
    expect(failure?.error).toBe(message.split(": ")[1])
  })

  it("reads tg's own words for a code, a password and a login Telegram ended", () => {
    expect(telegramFailure("the login code was wrong", "validation_error")?.kind).toBe("codeInvalid")
    expect(telegramFailure("the two-step verification password was wrong", null)?.kind).toBe("passwordInvalid")
    expect(telegramFailure("Telegram ended this login — run `tg personal session start`", null)?.kind).toBe(
      "loginEnded",
    )
  })

  it("reads how long Telegram asks to wait, in tg's words and as Telegram's name", () => {
    expect(telegramFailure("Telegram asks to wait 420 s before the next request", "rate_limited")).toEqual({
      kind: "floodWait",
      fix: "wait",
      error: "FLOOD_WAIT",
      seconds: 420,
    })
    expect(telegramFailure("Telegram refused: FLOOD_WAIT_75", "rate_limited")?.seconds).toBe(75)
  })

  it("tells a network failure and Telegram's own outage apart", () => {
    expect(telegramFailure("Telegram did not answer in time", "timeout")?.kind).toBe("network")
    expect(telegramFailure("connect ECONNREFUSED 149.154.167.50:443", null)?.kind).toBe("network")
    expect(telegramFailure("Telegram failed: RPC_CALL_FAIL", "provider_unavailable")).toMatchObject({
      kind: "telegramDown",
      error: "RPC_CALL_FAIL",
    })
  })

  it("knows nothing about other refusals, so the window shows them as they came", () => {
    expect(telegramFailure("Telegram refused: SOMETHING_NEW", "provider_error")).toBeNull()
    expect(telegramFailure("tg stopped with exit code 1 and said nothing about the sign-in.", null)).toBeNull()
  })
})

describe("waitParts", () => {
  it("splits a wait into hours, minutes and seconds", () => {
    expect(waitParts(3725)).toEqual({ hours: 1, minutes: 2, seconds: 5 })
    expect(waitParts(-3)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })
})

const HASH = "0123456789abcdef0123456789abcdef"

describe("checkKey", () => {
  it.each([
    ["  12345678 ", "12345678"],
    ["App api_id: 12345678", "12345678"],
    ["api_id=12345678", "12345678"],
    ["1234 5678", "12345678"],
    ['"12345678",', "12345678"],
  ])("takes %j as the api_id %s", (typed, value) => {
    expect(checkKey("api_id", typed)).toEqual({ value, problem: null })
  })

  it("takes a hash with its label and quotes, in either case", () => {
    expect(checkKey("api_hash", `App api_hash: ${HASH}`)).toEqual({ value: HASH, problem: null })
    expect(checkKey("api_hash", `"api_hash": "${HASH}"`)).toEqual({ value: HASH, problem: null })
    expect(checkKey("api_hash", HASH.toUpperCase()).problem).toBeNull()
  })

  it.each([
    ["api_id", "   ", { problem: "empty" }],
    ["api_id", "12a45678", { problem: "idNotDigits" }],
    ["api_id", "1234567890123", { problem: "idTooLong", length: 13 }],
    ["api_id", HASH, { problem: "idIsHash" }],
    ["api_hash", HASH.slice(1), { problem: "hashLength", length: 31 }],
    ["api_hash", `${HASH}0`, { problem: "hashLength", length: 33 }],
    ["api_hash", `${HASH.slice(1)}g`, { problem: "hashNotHex" }],
    ["api_hash", "12345678", { problem: "hashIsId" }],
  ] as const)("refuses %s %j", (field, typed, problem) => {
    expect(checkKey(field, typed)).toMatchObject(problem)
  })

  it("never keeps the label it dropped", () => {
    expect(cleanKey("App api_hash (not shown): abc")).not.toMatch(/api/i)
  })
})

describe("keyHints", () => {
  it("is empty for keys that look like my.telegram.org's", () => {
    expect(keyHints("12345678", HASH)).toEqual([])
  })

  it("says what still looks off after Telegram refused them", () => {
    expect(keyHints("1234", HASH)).toEqual(["idShort"])
    expect(keyHints("12345678901", HASH.toUpperCase())).toEqual(["idLong", "hashCapitals"])
  })
})

describe("keysStillGood", () => {
  it("sends the keys again only after a refusal that was not about them", () => {
    expect(keysStillGood(telegramFailure("Telegram refused: PHONE_CODE_EXPIRED", "provider_error"))).toBe(true)
    expect(keysStillGood(telegramFailure("Telegram refused: API_ID_INVALID", "provider_error"))).toBe(false)
    expect(keysStillGood(telegramFailure("api_id is a number from my.telegram.org/apps", "validation_error"))).toBe(
      false,
    )
  })
})

describe("telegramNote", () => {
  it("reads where tg says the code went, and a refused code or password", () => {
    expect(telegramNote("Telegram sent a login code (app)")).toEqual({ kind: "codeSent", via: "app" })
    expect(telegramNote("Telegram sent a login code (sms)")).toEqual({ kind: "codeSent", via: "sms" })
    expect(telegramNote("Telegram sent a login code (fragment)")).toEqual({ kind: "codeSent", via: "other" })
    expect(telegramNote("that code was not accepted — try again")).toEqual({ kind: "notAccepted", what: "code" })
    expect(telegramNote("that password was not accepted — try again")).toEqual({
      kind: "notAccepted",
      what: "password",
    })
    expect(telegramNote("registered a new app on my.telegram.org")).toBeNull()
  })
})
