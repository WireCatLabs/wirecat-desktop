import { describe, expect, it } from "vitest"
import { amountRange, canDrop, columnsOf, matches, ownersOf, withMove } from "./clients"

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
const stages = [
  { name: "Call", outcome: "open", items: 1, amounts: [] },
  { name: "Won", outcome: "won", items: 0, amounts: [] },
]

describe("the Clients board's rules", () => {
  it("puts each card in its stage's column and leaves out a stage the pipeline no longer lists", () => {
    const columns = columnsOf(stages, [card("deal:1", "Call"), card("deal:2", "Gone"), card("deal:3", "Call")])
    expect(columns.get("Call")).toEqual(["deal:1", "deal:3"])
    expect(columns.get("Won")).toEqual([])
    expect([...columns.values()].flat()).not.toContain("deal:2")
  })

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

  it("refuses a drop into another pipeline or a stage its pipeline does not have", () => {
    const c = card("deal:1", "Call")
    expect(canDrop(c, "pipeline:2", stages, "Won")).toBe(true)
    expect(canDrop(c, "pipeline:7", stages, "Won")).toBe(false)
    expect(canDrop(c, "pipeline:2", stages, "Deal won")).toBe(false)
    expect(canDrop(undefined, "pipeline:2", stages, "Won")).toBe(false)
  })

  it("moves a card to a won stage as won, leaving the others as they were", () => {
    const read = { stages, cards: [card("deal:1", "Call"), card("deal:2", "Call")] }
    const moved = withMove(read, "deal:1", "Won")
    expect(moved.cards[0]).toMatchObject({ stage: "Won", status: "won" })
    expect(moved.cards[1]).toEqual(read.cards[1])
  })
})
