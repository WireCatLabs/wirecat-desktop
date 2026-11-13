import { describe, expect, it } from "vitest"
import { matchWords, ruleMaker } from "./mail-rules"

describe("mail rules in words", () => {
  it("names who made a rule, and keeps a source it does not know as written", () => {
    expect(ruleMaker(null)).toEqual({ by: "you" })
    expect(ruleMaker("owner")).toEqual({ by: "you" })
    expect(ruleMaker("preset:social")).toEqual({ by: "preset" })
    expect(ruleMaker("probe")).toEqual({ by: "agent" })
    expect(ruleMaker("gmail-filter")).toEqual({ by: "gmail" })
    expect(ruleMaker("import")).toEqual({ by: "other", source: "import" })
  })

  it("joins every condition, and words an unknown key from its name", () => {
    const words = { from: (v: string) => `from ${v}`, older_than_days: (v: string) => `older than ${v} days` }
    const join = (parts: string[]) => parts.join(" and ")
    expect(
      matchWords(
        [
          { key: "from", value: "news@shop.example" },
          { key: "older_than_days", value: "365" },
          { key: "score_band", value: "low" },
        ],
        words,
        join,
      ),
    ).toBe("from news@shop.example and older than 365 days and score band low")
  })
})
