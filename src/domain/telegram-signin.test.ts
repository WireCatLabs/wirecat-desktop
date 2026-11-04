import { describe, expect, it } from "vitest"
import { telegramFailure, waitParts } from "./telegram-signin"

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
