import { describe, expect, it } from "vitest"
import {
  bySource,
  canSplit,
  cleanName,
  filterPeople,
  handleOf,
  looksLikeAccount,
  matchesFilter,
  personName,
  reasonOf,
  scopesOf,
  touched,
} from "./people"

const id = (identity: string, scopes: (string | null)[] = [], movable = true) => ({
  identity,
  movable,
  provider: identity.split(":")[0] ?? "",
  seenIn: scopes.map((scope, i) => ({ account: String(i), scope })),
})

describe("people", () => {
  it("groups a person's accounts by source in memo's order", () => {
    const groups = bySource([id("telegram:1"), id("email:a@x.org"), id("telegram:2")])
    expect(groups.map((g) => [g.provider, g.identities.length])).toEqual([
      ["telegram", 2],
      ["email", 1],
    ])
  })

  it("names each side of life that saw an account, once", () => {
    expect(scopesOf(id("email:a", ["work", "personal", "work", null]).seenIn)).toEqual(["personal", "work"])
    expect(scopesOf([])).toEqual([])
  })

  it("splits off some accounts, never none, all, or one the person does not have", () => {
    const all = [id("telegram:1"), id("email:a"), id("crm:2")]
    expect(canSplit(["crm:2"], all)).toBe(true)
    expect(canSplit([], all)).toBe(false)
    expect(canSplit(["telegram:1", "email:a", "crm:2"], all)).toBe(false)
    expect(canSplit(["max:9"], all)).toBe(false)
    expect(canSplit(["x:a b"], [...all, id("x:a b", [], false)])).toBe(false)
  })

  it("tells an account search from a name, and lists each touched person once", () => {
    expect(looksLikeAccount("telegram:4411")).toBe(true)
    expect(looksLikeAccount("lena@example.org")).toBe(true)
    expect(looksLikeAccount("Lena Ortiz")).toBe(false)
    expect(touched("person:7", null, "person:9", "person:7")).toEqual(["person:7", "person:9"])
  })

  it("filters by name or ref", () => {
    expect(matchesFilter({ name: "Lena Ortiz", ref: "person:7" }, "lena")).toBe(true)
    expect(matchesFilter({ name: null, ref: "person:7" }, "person:7")).toBe(true)
    expect(matchesFilter({ name: "Kai", ref: "person:4" }, "lena")).toBe(false)
  })

  it("cleans a name as a source typed it, and has none when no letter is left", () => {
    expect(cleanName('"CZECH AIRLINES "')).toBe("CZECH AIRLINES")
    expect(cleanName("  «Анна   Петрова» ")).toBe("Анна Петрова")
    expect(cleanName('ООО "Ромашка"')).toBe('ООО "Ромашка"')
    expect(cleanName("!$")).toBeNull()
    expect(cleanName(null)).toBeNull()
  })

  it("names a person by display name, then name, then contact, and never prints null or an id", () => {
    expect(personName({ displayName: "Lena Ortiz", name: "lena", contact: "+34600" })).toBe("Lena Ortiz")
    expect(personName({ displayName: null, name: "! null #97365", contact: "+34600111222" })).toBe("+34600111222")
    expect(personName({ name: "null #97365" })).toBeNull()
  })

  it("falls back to a handle, then to an account name with letters", () => {
    expect(
      handleOf([
        { name: "!", username: null },
        { name: "x", username: "kai_m" },
      ]),
    ).toBe("@kai_m")
    expect(
      handleOf([
        { name: "!", username: null },
        { name: " 'Kai' ", username: null },
      ]),
    ).toBe("Kai")
    expect(handleOf([{ name: "?", username: null }])).toBeNull()
  })

  it("narrows people to those with tasks or a usable name, the owner always named", () => {
    const people = [
      { ref: "person:1", name: null, owner: true, tasks: 0 },
      { ref: "person:2", name: "!", owner: false, tasks: 2 },
      { ref: "person:3", name: "Lena", owner: false, tasks: 0 },
    ]
    const refs = (f: Partial<Parameters<typeof filterPeople>[1]>) =>
      filterPeople(people, { query: "", withTasks: false, named: false, ...f }).map((p) => p.ref)
    expect(refs({})).toEqual(["person:1", "person:2", "person:3"])
    expect(refs({ withTasks: true })).toEqual(["person:2"])
    expect(refs({ named: true })).toEqual(["person:1", "person:3"])
    expect(refs({ query: "len" })).toEqual(["person:3"])
  })

  it("words memo's known refusals and leaves the rest in memo's words", () => {
    expect(reasonOf("identity.stale")).toBe("identity.stale")
    expect(reasonOf("the store is busy")).toBeNull()
  })
})

describe("cleanName and placeholders", () => {
  it("never shows a source's placeholder for a missing name", () => {
    expect(cleanName("Benjamin Baert null #5485")).toBe("Benjamin Baert")
    expect(cleanName("Harry null #40823")).toBe("Harry")
    expect(cleanName("! null #97365")).toBeNull()
  })
})
