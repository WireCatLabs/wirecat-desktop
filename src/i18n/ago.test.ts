import { describe, expect, it } from "vitest"
import { ago } from "./ago"

describe("ago", () => {
  const now = Date.parse("2026-10-27T12:00:00Z")

  it("says how long ago in plain words", () => {
    expect(ago("2026-10-27T11:59:30Z", now)).toBe("just now")
    expect(ago("2026-10-27T11:58:00Z", now)).toBe("2 min ago")
    expect(ago("2026-10-27T09:00:00Z", now)).toBe("3 h ago")
    expect(ago("2026-10-26T12:00:00Z", now)).toBe("yesterday")
    expect(ago("2026-10-24T12:00:00Z", now)).toBe("3 days ago")
  })

  it("takes a moment in milliseconds as well", () => {
    expect(ago(now - 5 * 60_000, now)).toBe("5 min ago")
  })

  it("speaks the language it is given", () => {
    expect(ago("2026-10-22T12:00:00Z", now, "ru")).toBe("5 дней назад")
    expect(ago("2026-10-27T11:00:00Z", now, "es")).toBe("hace 1 h")
  })
})
