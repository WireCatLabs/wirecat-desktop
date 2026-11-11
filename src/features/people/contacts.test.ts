import { describe, expect, it } from "vitest"
import type { Match } from "@/platform/people-schemas"
import { matchFacts } from "./contacts"

const match = (over: Partial<Match>): Match => ({
  id: "1",
  persons: ["person:1", "person:2"],
  identity: null,
  with: null,
  joins: "person",
  signal: "name",
  candidates: [],
  reason: null,
  evidence: [],
  proposer: { kind: "rule", name: "rule" },
  score: null,
  shared: null,
  mailbox: null,
  ...over,
})
const of = (emails: string[], phones: string[] = []) => ({ emails, phones })

describe("what a match rests on", () => {
  it("names the shared name and company domain", () => {
    expect(matchFacts(match({}), ["Beeline", "beeline"], [of(["pro@beeline.ru"]), of(["b2b@Beeline.ru"])])).toEqual([
      { kind: "name", value: "Beeline" },
      { kind: "domain", value: "beeline.ru" },
    ])
  })

  it("does not take a public mailbox for a company", () => {
    expect(matchFacts(match({}), ["A", "A"], [of(["a@gmail.com"]), of(["b@gmail.com"])])).toEqual([
      { kind: "name", value: "A" },
    ])
  })

  it("prefers the same address over its domain, and matches one phone in two spellings", () => {
    const sides = [of(["a@x.org"], ["+7 912 555-01-47"]), of(["a@x.org"], ["8 (912) 555 01 47"])]
    expect(matchFacts(match({}), ["A", "A"], sides).map((f) => f.kind)).toEqual(["name", "phone", "email"])
  })

  it("says only a shared chat when memo pointed at one and the sides show nothing else", () => {
    expect(matchFacts(match({ evidence: ["chat:1"] }), ["A", "A"], [of([]), of([])]).at(-1)).toEqual({
      kind: "chat",
      value: null,
    })
  })

  it("leaves a phone match's value to the line above", () => {
    expect(matchFacts(match({ signal: "phone" }), ["A", "B"], [of([], ["1"]), of([], ["1"])])).toEqual([])
  })

  it("does not call two unnamed people the same name", () => {
    const none = { phones: [], emails: [] }
    const facts = matchFacts(match({ signal: "account" }), [null, null], [none, none])
    expect(facts.filter((f) => f.kind === "name")).toEqual([])
  })
})
