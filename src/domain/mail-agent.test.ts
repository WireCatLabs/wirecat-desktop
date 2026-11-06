import { describe, expect, it } from "vitest"
import { dailyCap, formatUsd, runOutcome } from "./mail-agent"

describe("runOutcome", () => {
  it("is ok for a run that exited cleanly", () => {
    expect(runOutcome({ exitCode: 0, skipped: null })).toBe("ok")
  })

  it("is skipped when memo noted a start it left out after the last run", () => {
    const skipped = { at: "2026-11-05T22:04:36Z", why: "today's runs cost $5.02" }
    expect(runOutcome({ exitCode: 0, skipped })).toBe("skipped")
    expect(runOutcome({ exitCode: 1, skipped })).toBe("skipped")
  })

  it("is failed when the run exited with an error", () => {
    expect(runOutcome({ exitCode: 1, skipped: null })).toBe("failed")
  })
})

describe("dailyCap", () => {
  it("is none when memo says 0 or does not say", () => {
    expect(dailyCap(5)).toBe(5)
    expect(dailyCap(0)).toBeNull()
    expect(dailyCap(null)).toBeNull()
  })
})

describe("formatUsd", () => {
  it("shows cents in the owner's language", () => {
    expect(formatUsd(0.84, "en")).toBe("$0.84")
    expect(formatUsd(5, "en")).toBe("$5.00")
  })
})
