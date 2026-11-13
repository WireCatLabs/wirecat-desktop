import { describe, expect, it } from "vitest"
import { formatWhen } from "./runs"

const now = new Date(2026, 10, 13, 18, 0, 0)
const at = (h: number, m: number, s: number, day = 13) => new Date(2026, 10, day, h, m, s).toISOString()

describe("formatWhen", () => {
  it("shows today's time without seconds", () => {
    expect(formatWhen(at(10, 5, 12), now, "en")).toBe("10:05")
  })

  it("keeps seconds where the run log asks for them", () => {
    expect(formatWhen(at(10, 5, 12), now, "en", { seconds: true })).toBe("10:05:12")
  })

  it("names yesterday in the language", () => {
    expect(formatWhen(at(22, 0, 0, 12), now, "ru")).toBe("Вчера 22:00")
  })
})
