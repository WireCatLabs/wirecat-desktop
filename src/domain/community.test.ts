import { describe, expect, it } from "vitest"
import { ACME } from "@/platform/mock-community"
import { addCommunityTools, findTool, isCommunity, isOwn, maker, tools } from "./catalog"

describe("community tools", () => {
  it("joins the catalog after the built-in tools, marked as community", () => {
    const before = tools.length
    expect(addCommunityTools([{ source: "community", entry: ACME }])).toEqual([])
    expect(tools).toHaveLength(before + 1)
    const acme = findTool("acme")
    expect(acme && isCommunity(acme)).toBe(true)
    expect(acme && maker(acme)).toBe("example")
    expect(tools.filter(isCommunity).map((t) => t.id)).toEqual(["acme"])
  })

  it("leaves out an entry that takes an id, uses our scope or is part of our package", () => {
    const rejected = addCommunityTools(
      [
        { ...ACME, id: "tg", package: "@example/tg" },
        { ...ACME, id: "evil", package: "@wirecat/evil" },
        { ...ACME, id: "part", package: "@example/part", partOf: "memo" },
        { ...ACME, id: "plain", community: undefined },
        "not a tool",
      ].map((entry) => ({ source: "community" as const, entry })),
    ).map((r) => r.text)
    expect(rejected).toHaveLength(5)
    expect(rejected[0]).toMatch(/^tg: the id is taken/)
    expect(rejected[1]).toMatch(/^evil: .*own npm scope/)
    expect(findTool("evil")).toBeUndefined()
    expect(findTool("tg")?.package).toBe("@wirecat/tg-cli")
  })

  it("keeps the source Rust gave, whatever the entry says", () => {
    addCommunityTools([{ source: "own", entry: { ...ACME, id: "mine", package: "@me/mine", source: "community" } }])
    const mine = findTool("mine")
    expect(mine && isOwn(mine)).toBe(true)
    expect(mine && maker(mine)).toBe("example")
    expect(maker({ ...(mine as NonNullable<typeof mine>), repo: null })).toBe("@me")
  })
})
