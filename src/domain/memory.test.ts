import { describe, expect, it } from "vitest"
import { byDay, can, inTab, tabOf, toneOf } from "./memory"

const entry = (type: string, kind: string, status: string) => ({ type, kind, status, author: { type: "bot" } })

describe("memory records", () => {
  it("files every status under one tab, and an unknown one under All only", () => {
    expect(
      ["proposed", "confirmed", "accepted", "approved", "failed", "stale", "superseded", "rejected"].map(tabOf),
    ).toEqual(["review", "inuse", "inuse", "inuse", "inuse", "discarded", "discarded", "discarded"])
    expect(tabOf("archived")).toBeNull()
    expect(inTab("all", "archived")).toBe(true)
    expect(toneOf("failed")).toBe("bad")
  })

  it("offers only what memo 0.128.0 does with each record", () => {
    expect(can(entry("memory", "summary", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: true,
      forget: true,
    })
    expect(can(entry("memory", "summary", "superseded")).correct).toBe(false)
    expect(can(entry("fact", "decision", "accepted"))).toMatchObject({ discard: true, correct: true })
    expect(can(entry("fact", "promise", "accepted"))).toMatchObject({ discard: false, correct: false, forget: true })
    expect(can(entry("fact", "decision", "proposed"))).toMatchObject({ confirm: true, discard: true, correct: false })
    expect(can(entry("action", "reply", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: false,
      forget: false,
    })
    expect(can(entry("action", "reply", "approved")).discard).toBe(false)
  })

  it("groups a newest-first list into runs of one local day", () => {
    const at = (d: number, h: number) => ({ createdAt: new Date(2026, 9, d, h).toISOString() })
    const groups = byDay([at(31, 23), at(31, 1), at(30, 22), at(28, 9)])
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1, 1])
    expect(groups[0]?.day).toBe("2026-10-31")
  })
})
