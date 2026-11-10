import { describe, expect, it } from "vitest"
import { amountRange, matches, ownersOf } from "./clients"

const card = (ref: string, stage: string, more = {}) => ({
  ref,
  title: `Example ${ref}`,
  pipeline: "pipeline:2",
  stage,
  status: "open",
  amount: "1200.00",
  organization: "Acme Corp",
  people: [{ name: "Bob Lee", role: "owner" }],
  ...more,
})
describe("the Clients board's rules", () => {
  it("keeps a card for the responsible person, the stage, the amount and plain words", () => {
    const c = card("deal:1", "Call")
    expect(matches(c, 'owner:"Bob Lee" stage:Call acme')).toBe(true)
    expect(matches(c, "owner:none")).toBe(false)
    expect(matches(card("deal:9", "Call", { people: [] }), "owner:none")).toBe(true)
    expect(matches(c, "amount:>=1000")).toBe(true)
    expect(matches(c, "amount:[2000 TO 5000]")).toBe(false)
    expect(matches(card("deal:8", "Call", { amount: null }), "amount:>10")).toBe(false)
    expect(matches(c, "northstar")).toBe(false)
  })

  it("reads amount bounds and lists nobody last among the responsible", () => {
    expect(amountRange("amount:<500")).toEqual({ min: null, max: 500 })
    expect(amountRange("amount:[10 TO 20]")).toEqual({ min: 10, max: 20 })
    expect(ownersOf([card("a", "Call", { people: [] }), card("b", "Call")])).toEqual(["Bob Lee", "none"])
  })
})
