import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useMemory } from "@/features/memory"
import { platform } from "@/platform/bridge"
import { combine, shown, useAnalytics } from "./store"

afterEach(() => vi.restoreAllMocks())

const ready = (rows: { key: string; name: string | null; count: number }[], more = false) =>
  ({ kind: "ready", total: rows.reduce((s, r) => s + r.count, 0), rows, more }) as const

describe("combine", () => {
  it("adds every profile up and names the one that failed", () => {
    const c = combine([
      { profile: "personal", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 3 }]) },
      { profile: "work", by: "day", answer: ready([{ key: "2026-11-01", name: null, count: 2 }]) },
      { profile: "personal", by: "sender", answer: ready([{ key: "me", name: null, count: 4 }]) },
      { profile: "work", by: "sender", answer: { kind: "failed", message: "locked", code: null } },
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

describe("the Analytics page opened again", () => {
  it("within a minute reads nothing; later it reads with the numbers still on screen", async () => {
    const info = vi.spyOn(platform, "storeInfo")
    useAnalytics.getState().load()
    await waitFor(() => expect(useAnalytics.getState().volume.state).toBe("ready"))
    useAnalytics.getState().load()
    expect(info).toHaveBeenCalledTimes(1)

    useAnalytics.setState({ readAt: Date.now() - 61_000 })
    useAnalytics.getState().load()
    expect(useAnalytics.getState().volume.state).toBe("ready")
    expect(info).toHaveBeenCalledTimes(2)
  })

  it("takes the Memory page's answer when it is under a minute old", async () => {
    const read = vi.spyOn(platform, "memoryRead")
    await useMemory.getState().load()
    useAnalytics.getState().load()
    await waitFor(() => expect(useAnalytics.getState().memory.state).toBe("ready"))
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe("the period switch", () => {
  it("counts every messenger again for the new period and replaces the numbers", async () => {
    useAnalytics.getState().load()
    await waitFor(() => expect(useAnalytics.getState().refreshing).toBe(false))
    const stats = vi
      .spyOn(platform, "messageStats")
      .mockImplementation(async (_id, _profile, ask) =>
        ready([{ key: "2026-11-09", name: null, count: ask.period === "7d" ? 7 : 30 }]),
      )
    useAnalytics.getState().setPeriod("7d")
    await waitFor(() => expect(useAnalytics.getState().refreshing).toBe(false))
    expect(stats.mock.calls.length).toBeGreaterThan(0)
    expect(stats.mock.calls.every(([, , ask]) => ask.period === "7d")).toBe(true)
    const tg = useAnalytics.getState().sources.tg
    if (tg?.state !== "ready") throw new Error(`tg is ${tg?.state}`)
    expect(tg.days).toEqual([{ key: "2026-11-09", name: null, count: 7 * tg.profiles.length }])
    useAnalytics.getState().setPeriod("30d")
  })
})
