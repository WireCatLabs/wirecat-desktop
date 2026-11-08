import { describe, expect, it } from "vitest"
import { accountsMessages } from "./messages-accounts"
import { busyHolder, keptReason, signInLine } from "./removal-words"

const ru = accountsMessages.ru.remove

describe("removal words", () => {
  it("says a known kept reason in the interface language", () => {
    expect(keptReason("the record of what was sent for this account", ru)).toEqual({
      text: ru.reasons.sends,
      fromTool: false,
    })
  })

  it("falls back to the tool's sentence for a reason it does not know", () => {
    expect(keptReason("a thing only this tool keeps", ru)).toEqual({
      text: "a thing only this tool keeps",
      fromTool: true,
    })
  })

  it("describes the sign-in by tool and by the revoked flag", () => {
    expect(signInLine("tg", "Telegram", null, ru)).toBe(ru.signInSession("Telegram"))
    expect(signInLine("drive", "Drive", null, ru)).toBe(ru.signInRevokes)
    expect(signInLine("drive", "Drive", true, ru)).toBe(ru.signInRevoked)
    expect(signInLine("drive", "Drive", false, ru)).toBe(ru.signInKept)
    expect(signInLine("zm", "Zoom", null, ru)).toBeNull()
  })

  it("names what holds the account from the tool's busy message", () => {
    expect(busyHolder("`tg serve` is running for personal — stop it first")).toBe("tg serve")
    expect(busyHolder("tg-serve-personal.service is running for personal — stop it")).toBe("tg-serve-personal.service")
    expect(busyHolder("something odd")).toBeNull()
  })
})
