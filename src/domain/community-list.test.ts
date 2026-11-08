import { describe, expect, it } from "vitest"
import { listBlocksInstalls, listNotice } from "./community-list"

const now = Date.parse("2026-11-08T12:00:00Z")
const at = (days: number) => new Date(now + days * 86_400_000).toISOString()

describe("listNotice", () => {
  it("rounds the days left up, never to zero", () => {
    expect(listNotice({ show: true, state: "expiring", expiresAt: at(6.2) }, now)).toMatchObject({ days: 7 })
    expect(listNotice({ show: true, state: "expiring", expiresAt: at(0.1) }, now)).toMatchObject({ days: 1 })
  })

  it("says nothing for a fresh list, a list never fetched, or with community tools off", () => {
    expect(listNotice({ show: true, state: "fresh", expiresAt: at(20) }, now)).toBeNull()
    expect(listNotice({ show: true, state: "neverFetched", expiresAt: null }, now)).toBeNull()
    expect(listNotice({ show: false, state: "expired", expiresAt: at(-1) }, now)).toBeNull()
  })

  it("blocks installs as Rust does: expired or no list kept", () => {
    expect(listBlocksInstalls({ show: true, state: "expired", expiresAt: at(-1) })).toBe(true)
    expect(listBlocksInstalls({ show: true, state: "neverFetched", expiresAt: null })).toBe(true)
    expect(listBlocksInstalls({ show: true, state: "expiring", expiresAt: at(2) })).toBe(false)
    expect(listBlocksInstalls(null)).toBe(false)
  })
})
