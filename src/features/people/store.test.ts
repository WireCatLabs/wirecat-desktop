import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Match, PersonDetail } from "@/platform/people-schemas"
import { usePeople } from "./store"

const person = (ref: string, over: Partial<PersonDetail> = {}): PersonDetail => ({
  ref,
  name: ref,
  mergedInto: null,
  identities: [],
  merges: [],
  matches: [],
  ...over,
})

const match = (id: string, persons: [string, string]): Match => ({
  id,
  persons,
  identity: null,
  with: null,
  joins: "person",
  signal: "phone",
  candidates: [],
  reason: null,
  evidence: [],
  proposer: null,
})

describe("the People store after a write", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
  })

  it("forgets every touched person, reads both lists again, and keeps the decided card in place", async () => {
    const ready = { state: "ready" as const, person: person("person:7") }
    usePeople.setState({
      read: "ready",
      matches: [match("1", ["person:9", "person:7"]), match("2", ["person:4", "person:5"])],
      details: { "person:9": ready, "person:7": ready, "person:4": ready },
    })
    vi.spyOn(platform, "peopleDecide").mockResolvedValue(person("person:7", { mergedInto: "person:7" }))
    vi.spyOn(platform, "peopleRead").mockResolvedValue({
      kind: "ready",
      people: [{ ref: "person:7", name: "Lena", owner: false }],
      peopleMore: false,
      matches: [match("3", ["person:7", "person:8"])],
      matchesMore: true,
    })
    await usePeople.getState().decide("person:9", "1", "confirm")
    const s = usePeople.getState()
    expect(Object.keys(s.details).sort()).toEqual(["person:4", "person:9"])
    expect(s.matches.map((m) => m.id)).toEqual(["3", "1"])
    expect(s.matchesMore).toBe(true)
    expect(s.people.map((p) => p.ref)).toEqual(["person:7"])
  })
})
