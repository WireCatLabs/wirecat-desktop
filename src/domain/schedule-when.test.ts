import { describe, expect, it } from "vitest"
import { parseWhen } from "./schedule-when"

describe("parseWhen", () => {
  it("reads cli-core's three forms", () => {
    expect(parseWhen("every 30m")).toEqual({ kind: "every", minutes: 30 })
    expect(parseWhen("every 2h")).toEqual({ kind: "every", minutes: 120 })
    expect(parseWhen("every 1d")).toEqual({ kind: "every", minutes: 1440 })
    expect(parseWhen("daily at 09:00")).toEqual({ kind: "daily", at: "09:00" })
    expect(parseWhen("once at 2026-11-10T09:00:00.000Z")).toEqual({ kind: "once", at: "2026-11-10T09:00:00.000Z" })
  })

  it("keeps anything else as written", () => {
    expect(parseWhen("every 0m")).toEqual({ kind: "other", text: "every 0m" })
    expect(parseWhen("weekdays at 9")).toEqual({ kind: "other", text: "weekdays at 9" })
    expect(parseWhen("once at soon")).toEqual({ kind: "other", text: "once at soon" })
  })
})
