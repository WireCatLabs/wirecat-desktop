import { describe, expect, it } from "vitest"
import { bySource, canSplit, matchesFilter, otherOf, reasonOf, scopesOf } from "./people"

const id = (identity: string, scopes: (string | null)[] = []) => ({
  identity,
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
  })

  it("finds the other person of a match, and filters by name or ref", () => {
    expect(otherOf(["person:7", "person:9"], "person:9")).toBe("person:7")
    expect(matchesFilter({ name: "Lena Ortiz", ref: "person:7" }, "lena")).toBe(true)
    expect(matchesFilter({ name: null, ref: "person:7" }, "person:7")).toBe(true)
    expect(matchesFilter({ name: "Kai", ref: "person:4" }, "lena")).toBe(false)
  })

  it("words memo's known refusals and leaves the rest in memo's words", () => {
    expect(reasonOf("identity.stale")).toBe("identity.stale")
    expect(reasonOf("the store is busy")).toBeNull()
  })
})
