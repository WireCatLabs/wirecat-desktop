import { describe, expect, it } from "vitest"
import { isSenderBot, kindOfTab, tabCount, tabOf } from "./contact-tabs"

describe("contact tabs", () => {
  it("puts each kind on one tab, bots on Bots whichever memo lists them", () => {
    expect(tabOf("stranger", true)).toBe("people")
    expect(tabOf("automated", true)).toBe("people")
    expect(tabOf("automated", false)).toBe("bots")
    expect(tabOf("bot", true)).toBe("bots")
    expect(tabOf("organization", true)).toBe("organizations")
    expect(kindOfTab("bots", true)).toBe("bot")
    expect(kindOfTab("bots", false)).toBe("automated")
  })

  it("counts People without the incomplete rows, which are off by default", () => {
    const counts = {
      person: { value: 10, more: false },
      stranger: { value: 5, more: true },
      unsorted: { value: 900, more: false },
      bot: { value: 3, more: false },
    }
    expect(tabCount("people", counts, true)).toEqual({ value: 15, more: true })
    expect(tabCount("bots", counts, true)).toEqual({ value: 3, more: false })
    expect(tabCount("organizations", counts, true)).toBeNull()
  })

  it("knows a bot by memo's prefix only", () => {
    expect(isSenderBot("sender-bot:3")).toBe(true)
    expect(isSenderBot("bot:3")).toBe(false)
    expect(isSenderBot(null)).toBe(false)
  })
})
