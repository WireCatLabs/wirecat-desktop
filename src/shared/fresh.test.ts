import { describe, expect, it } from "vitest"
import { fresh, markStale } from "./fresh"

describe("fresh", () => {
  it("holds an answer for a minute, and not past a change outside the page", () => {
    const now = Date.now()
    expect(fresh(now - 59_000, now)).toBe(true)
    expect(fresh(now - 61_000, now)).toBe(false)
    expect(fresh(null, now)).toBe(false)
    const read = Date.now() - 1
    markStale()
    expect(fresh(read)).toBe(false)
  })
})
