import { describe, expect, it } from "vitest"
import { ACME, OWN } from "@/platform/mock-community"
import {
  addCommunityTools,
  entryProblem,
  findTool,
  isCommunity,
  isOwn,
  maker,
  replaceAddedTools,
  tools,
} from "./catalog"

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

  it("takes an own tool from the @wirecat scope that is not built in, never a listed one", () => {
    const beeline = { ...OWN, id: "beeline", package: "@wirecat/beeline-cli" }
    expect(entryProblem(beeline)).toBeNull()
    expect(addCommunityTools([{ source: "community", entry: beeline }])[0]?.text).toMatch(/own npm scope/)
    expect(addCommunityTools([{ source: "own", entry: beeline }])).toEqual([])
    expect(findTool("beeline")?.source).toBe("own")
    replaceAddedTools([])
  })

  it("keeps the source Rust gave, whatever the entry says", () => {
    addCommunityTools([{ source: "own", entry: { ...ACME, id: "mine", package: "@me/mine", source: "community" } }])
    const mine = findTool("mine")
    expect(mine && isOwn(mine)).toBe(true)
    expect(mine && maker(mine)).toBe("example")
    expect(maker({ ...(mine as NonNullable<typeof mine>), repo: null })).toBe("@me")
  })

  it("replaces the added tools when the catalog reloads, leaving the built-in ones", () => {
    const builtIn = tools.filter((t) => !isCommunity(t)).length
    expect(replaceAddedTools([{ source: "own", entry: OWN }])).toEqual([])
    expect(findTool("acmecrm")).toBeDefined()
    expect(replaceAddedTools([])).toEqual([])
    expect(findTool("acmecrm")).toBeUndefined()
    expect(tools).toHaveLength(builtIn)
  })

  it("takes a built-in tool's commands from its own description and returns to the catalog's without one", () => {
    const zm = findTool("zm")
    const doctor = zm?.doctor
    const sync = zm?.sync
    const described = { doctor: ["doctor", "--record", "--json"], sync: { ...sync, run: ["meetings", "sync"] } }
    expect(addCommunityTools([{ source: "official", entry: { id: "zm", described } }])).toEqual([])
    expect(findTool("zm")?.doctor).toEqual(["doctor", "--record", "--json"])
    expect(findTool("zm")?.sync?.run).toEqual(["meetings", "sync"])
    expect(findTool("zm")?.tagline).toBe(zm?.tagline)
    expect(replaceAddedTools([])).toEqual([])
    expect(findTool("zm")?.doctor).toEqual(doctor)
    expect(findTool("zm")?.sync).toEqual(sync)
  })

  it("refuses a description of a tool it does not have or of the wrong shape", () => {
    const rejected = addCommunityTools([
      { source: "official", entry: { id: "nosuch", described: {} } },
      { source: "official", entry: { id: "zm", described: { doctor: "doctor" } } },
    ])
    expect(rejected.map((r) => r.text)).toEqual(["nosuch: the app has no such tool", expect.stringMatching(/^zm: /)])
    replaceAddedTools([])
  })
})
