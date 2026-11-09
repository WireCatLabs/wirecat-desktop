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

/** A listed person as a memo older than kinds gives it. */
const older = { displayName: null, kind: null, contact: null, messagesFrom: null, lastContact: null }

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
      people: [{ ref: "person:7", name: "Lena", owner: false, tasks: 0, ...older }],
      peopleMore: false,
      matches: [match("3", ["person:7", "person:8"])],
      matchesMore: true,
      kinded: false,
    })
    await usePeople.getState().decide("person:9", "1", "confirm")
    const s = usePeople.getState()
    expect(Object.keys(s.details).sort()).toEqual(["person:4", "person:9"])
    expect(s.matches.map((m) => m.id)).toEqual(["3", "1"])
    expect(s.matchesMore).toBe(true)
    expect(s.people.map((p) => p.ref)).toEqual(["person:7"])
  })

  it("still knows the owner and their tasks on a tab that does not list them", async () => {
    const row = (ref: string, owner: boolean, tasks: number) => ({ ref, name: ref, owner, tasks, ...older })
    vi.spyOn(platform, "peopleKinds").mockResolvedValue({})
    vi.spyOn(platform, "peopleRead").mockImplementation(async (kind) => ({
      kind: "ready",
      people: kind === "person" ? [row("person:1", true, 4)] : [row("person:23", false, 0)],
      peopleMore: false,
      matches: [],
      matchesMore: false,
      kinded: true,
    }))
    await usePeople.getState().load()
    usePeople.getState().setKind("organization")
    await vi.waitFor(() => expect(usePeople.getState().people.map((p) => p.ref)).toEqual(["person:23"]))
    expect(usePeople.getState().seen["person:1"]).toEqual({ owner: true, tasks: 4 })
  })

  it("reads the people on screen two at a time, in order, and drops those scrolled away", async () => {
    const waits: { ref: string; done: () => void }[] = []
    vi.spyOn(platform, "peopleShow").mockImplementation(
      (ref) => new Promise((resolve) => waits.push({ ref, done: () => resolve(person(ref)) })),
    )
    usePeople.getState().want(["person:1", "person:2", "person:3", "person:4"])
    expect(waits.map((w) => w.ref)).toEqual(["person:1", "person:2"])
    usePeople.getState().want(["person:9"])
    waits[0]?.done()
    await vi.waitFor(() => expect(waits.map((w) => w.ref)).toEqual(["person:1", "person:2", "person:9"]))
    waits[1]?.done()
    waits[2]?.done()
    await vi.waitFor(() => expect(usePeople.getState().details["person:9"]?.state).toBe("ready"))
    expect(waits).toHaveLength(3)
  })
})
