import { expect, it } from "vitest"
import type { Match } from "@/platform/people-schemas"
import { groupMatches } from "./groups"

const match = (id: string, persons: [string, string], over: Partial<Match> = {}): Match => ({
  id,
  persons,
  identity: null,
  with: null,
  joins: "person",
  signal: "email",
  candidates: [],
  reason: null,
  evidence: [],
  proposer: null,
  score: null,
  shared: null,
  mailbox: null,
  ...over,
})

it("keeps memo's order, a card where its highest pair is, and the pairs of one shared mailbox on one card", () => {
  const info = { shared: "role", mailbox: "info@acme.example" }
  const groups = groupMatches(
    [
      match("1", ["person:1", "person:2"], { ...info, score: 0.9 }),
      match("2", ["person:5", "person:6"], { score: 0.8 }),
      match("3", ["person:1", "person:3"], { ...info, score: 0.5 }),
      match("4", ["person:2", "person:3"], { ...info, score: 0.4 }),
    ],
    {},
  )
  expect(groups.map((g) => g.matches.map((m) => m.id))).toEqual([["1", "3", "4"], ["2"]])
  expect(groups[0]?.people).toEqual(["person:1", "person:2", "person:3"])
  expect(groups.map((g) => g.mailbox)).toEqual(["info@acme.example", null])
})
