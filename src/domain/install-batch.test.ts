import { describe, expect, it } from "vitest"
import { batch, roughly, TYPICAL_INSTALL_MS, toolFraction } from "./install-batch"
import { startProgress } from "./install-progress"
import type { InstallSession } from "./status"

const T0 = 1_000_000
const session = (patch: Partial<InstallSession>): InstallSession => ({
  operation: "install",
  step: "queued",
  log: [],
  outcome: null,
  ...patch,
})
const done = (tookMs: number) =>
  session({
    step: "verify",
    began: { check: T0 },
    ended: T0 + tookMs,
    outcome: { event: "done", version: "1.0.0", path: "/x", shadowedBy: null },
  })

describe("one tool's share of its install", () => {
  it("moves through lookups and downloads, and counts a tool already installed as done", () => {
    expect(toolFraction({ session: undefined, installed: true })).toBe(1)
    expect(toolFraction({ session: session({}), installed: false })).toBe(0)
    const looking = session({ step: "install", progress: { ...startProgress(), phase: "resolve", looked: 150 } })
    expect(toolFraction({ session: looking, installed: false })).toBeCloseTo(0.225)
    const half = session({ step: "install", progress: { ...startProgress(), phase: "fetch", total: 60, done: 30 } })
    expect(toolFraction({ session: half, installed: false })).toBeCloseTo(0.625)
  })
})

describe("the batch", () => {
  it("averages tools and projects the rest from the running one", () => {
    const running = session({
      step: "install",
      began: { check: T0 },
      progress: { ...startProgress(), phase: "fetch", total: 60, done: 30 },
    })
    const b = batch(
      [
        { session: running, installed: false },
        { session: session({}), installed: false },
      ],
      T0 + 50_000,
    )
    expect(b).toMatchObject({ total: 2, finished: 0, current: 1 })
    expect(b.fraction).toBeCloseTo(0.3125)
    expect(b.remainingMs).toBeCloseTo(30_000 + TYPICAL_INSTALL_MS)
  })

  it("times waiting tools by the ones this batch already finished", () => {
    const b = batch(
      [
        { session: done(120_000), installed: true },
        { session: session({}), installed: false },
      ],
      T0,
    )
    expect(b.remainingMs).toBe(120_000)
    expect(b.current).toBeNull()
  })

  it("has no estimate once nothing runs or waits", () => {
    expect(batch([{ session: done(1000), installed: true }], T0).remainingMs).toBeNull()
  })
})

describe("a rough remaining time", () => {
  it("never counts seconds", () => {
    expect(roughly(5000)).toEqual({ kind: "almost" })
    expect(roughly(40_000)).toEqual({ kind: "underMinute" })
    expect(roughly(150_000)).toEqual({ kind: "minutes", n: 3 })
  })
})
