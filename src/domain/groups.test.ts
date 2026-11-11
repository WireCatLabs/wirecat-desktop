import { describe, expect, it } from "vitest"
import { ALL, applyChange, changeOf, columnsOf, type Group, isDuplicate, nameProblem, profileParts } from "./groups"

const tgWork = { source: "telegram:2", provider: "telegram", profiles: ["tg work"], alsoIn: [], scope: null }
const tgHome = { source: "telegram:1", provider: "telegram", profiles: ["tg personal"], alsoIn: [], scope: null }
const b24 = { source: "bitrix24:acme.example", provider: "bitrix24", profiles: ["b24 work"], alsoIn: [], scope: null }

const groups: Group[] = [
  { name: "work", members: [tgWork], suggested: [b24.source] },
  { name: "personal", members: [tgHome], suggested: [] },
  { name: ALL, members: [b24, tgHome, tgWork], suggested: [] },
]

const members = (gs: Group[], name: string) => gs.find((g) => g.name === name)?.members.map((m) => m.source)

describe("account groups", () => {
  it("puts all first and keeps Memo's order for the saved groups", () => {
    expect(columnsOf(groups).map((g) => g.name)).toEqual([ALL, "work", "personal"])
  })

  it("turns a drop into Memo's change: a move between saved groups, a copy as an add", () => {
    expect(changeOf(groups, tgHome.source, "personal", "work", false)).toEqual({
      kind: "move",
      source: tgHome.source,
      from: "personal",
      to: "work",
    })
    expect(changeOf(groups, tgHome.source, "personal", "work", true)).toEqual({
      kind: "add",
      group: "work",
      source: tgHome.source,
    })
  })

  it("copies out of all whatever the modifier, and never drops into all", () => {
    expect(changeOf(groups, b24.source, ALL, "work", false)).toEqual({ kind: "add", group: "work", source: b24.source })
    expect(changeOf(groups, tgWork.source, "work", ALL, false)).toBeNull()
    expect(changeOf(groups, tgWork.source, "work", "work", false)).toBeNull()
  })

  it("only takes a card out when it moves into a group that already holds it", () => {
    const both = applyChange(groups, { kind: "add", group: "personal", source: tgWork.source })
    expect(changeOf(both, tgWork.source, "work", "personal", false)).toEqual({
      kind: "remove",
      group: "work",
      source: tgWork.source,
    })
    expect(changeOf(both, tgWork.source, "work", "personal", true)).toBeNull()
  })

  it("marks a copy as a duplicate in both saved groups and clears it once moved back", () => {
    const copied = applyChange(groups, { kind: "add", group: "personal", source: tgWork.source })
    const inWork = copied.find((g) => g.name === "work")?.members[0]
    expect(inWork?.alsoIn).toEqual(["personal"])
    expect(inWork && isDuplicate("work", inWork)).toBe(true)
    const inAll = copied.find((g) => g.name === ALL)?.members.find((m) => m.source === tgWork.source)
    expect(inAll && isDuplicate(ALL, inAll)).toBe(false)
    const undone = applyChange(copied, { kind: "remove", group: "personal", source: tgWork.source })
    expect(undone.find((g) => g.name === "work")?.members[0]?.alsoIn).toEqual([])
  })

  it("moves in one step, makes a new group before all, and drops a suggestion once taken", () => {
    const moved = applyChange(groups, { kind: "move", source: tgHome.source, from: "personal", to: "work" })
    expect(members(moved, "work")).toEqual([tgWork.source, tgHome.source])
    expect(members(moved, "personal")).toEqual([])
    const made = applyChange(groups, { kind: "add", group: "clients", source: b24.source })
    expect(made.map((g) => g.name)).toEqual(["work", "personal", "clients", ALL])
    const taken = applyChange(groups, { kind: "add", group: "work", source: b24.source })
    expect(taken[0]?.suggested).toEqual([])
  })

  it("checks a new group's name as Memo would", () => {
    expect(nameProblem(" ", [])).toBe("empty")
    expect(nameProblem("All", [])).toBe("reserved")
    expect(nameProblem("my group", [])).toBe("chars")
    expect(nameProblem("work", ["work"])).toBe("taken")
    expect(nameProblem("client-acme_2", ["work"])).toBeNull()
  })

  it("splits a profile into its app and its name", () => {
    expect(profileParts("b24 work")).toEqual({ app: "b24", name: "work" })
    expect(profileParts("memo")).toEqual({ app: "memo", name: "" })
  })
})
