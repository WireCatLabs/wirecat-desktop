import { describe, expect, it } from "vitest"
import { combine, shown } from "./store"

const ready = (rows: { key: string; name: string | null; count: number }[], more = false) =>
  ({ kind: "ready", total: rows.reduce((s, r) => s + r.count, 0), rows, more }) as const

describe("combine", () => {
  it("adds every profile up and names the one that failed", () => {
    const c = combine([
      { profile: "personal", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 3 }]) },
      { profile: "work", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 2 }]) },
      { profile: "personal", by: "sender", answer: ready([{ key: "me", name: null, count: 4 }]) },
      { profile: "work", by: "sender", answer: { kind: "failed", message: "locked" } },
    ])
    expect(c).toMatchObject({
      state: "ready",
      profiles: ["personal"],
      failed: [{ profile: "work", message: "locked" }],
      days: [{ key: "2026-11-01", count: 5 }],
      senders: [{ key: "me", count: 4 }],
    })
  })

  it("says the tool is too old when no profile could count", () => {
    expect(combine([{ profile: "p", by: "day", answer: { kind: "old", message: "unknown command" } }])).toEqual({
      state: "old",
      message: "unknown command",
    })
    expect(combine([])).toEqual({ state: "noProfiles" })
  })
})

describe("shown", () => {
  const all = combine([
    { profile: "personal", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 3 }]) },
    { profile: "work", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 2 }]) },
  ])

  it("adds up only the chosen profiles and leaves out messengers not chosen", () => {
    const s = shown({ tg: all, wa: { state: "missing" } }, ["tg"], ["work"])
    expect(Object.keys(s)).toEqual(["tg"])
    expect(s.tg).toMatchObject({ state: "ready", profiles: ["work"], days: [{ key: "2026-11-01", count: 2 }] })
  })

  it("shows everything when nothing is chosen", () => {
    expect(shown({ tg: all }, [], []).tg).toBe(all)
  })
})
