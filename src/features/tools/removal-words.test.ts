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

  it("does not promise mail a revoke unless the plan shows Google OAuth", () => {
    const key = (target: string) => [{ kind: "keyring" as const, target }]
    expect(signInLine("mail", "Mail", null, ru, key("oauth:google:work"))).toBe(ru.signInRevokes)
    expect(signInLine("mail", "Mail", null, ru, key("oauth:microsoft:work"))).toBe(ru.signInLocal)
    expect(signInLine("mail", "Mail", null, ru, key("work"))).toBe(ru.signInAppPassword)
    expect(signInLine("mail", "Mail", true, ru)).toBe(ru.signInGoogleRevoked)
    expect(signInLine("mail", "Mail", false, ru)).toBe(ru.signInProviderKept)
  })

  it("names what holds the account from the tool's busy message", () => {
    expect(busyHolder("`tg serve` is running for personal — stop it first")).toBe("tg serve")
    expect(busyHolder("tg-serve-personal.service is running for personal — stop it")).toBe("tg-serve-personal.service")
    expect(busyHolder("something odd")).toBeNull()
  })
})
