import { describe, expect, it } from "vitest"
import { briefChars, localeFor } from "./digest-editors"

describe("the digest editors", () => {
  it("counts the brief as memo does, without the blank space around it", () => {
    expect(briefChars("  Only HRB.\n\n")).toBe(9)
    expect(briefChars("")).toBe(0)
  })

  it("opens the templates in the app's language when memo ships one, else in English", () => {
    expect(localeFor("ru")).toBe("ru")
    expect(localeFor("es")).toBe("en")
  })
})
