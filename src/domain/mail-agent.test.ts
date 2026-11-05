import { describe, expect, it } from "vitest"
import { formatUsd, runOutcome } from "./mail-agent"

describe("runOutcome", () => {
  it("is ok for a run that exited cleanly", () => {
    expect(runOutcome({ exitCode: 0, reason: null })).toBe("ok")
  })

  it("is skipped when memo gives a reason for not starting the run", () => {
    expect(runOutcome({ exitCode: 1, reason: "today's runs cost $5.02" })).toBe("skipped")
  })

  it("is failed when the run exited with an error and no reason", () => {
    expect(runOutcome({ exitCode: 1, reason: null })).toBe("failed")
  })
})

describe("formatUsd", () => {
  it("shows cents in the owner's language", () => {
    expect(formatUsd(0.84, "en")).toBe("$0.84")
    expect(formatUsd(5, "en")).toBe("$5.00")
  })
})
