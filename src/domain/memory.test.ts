import { describe, expect, it } from "vitest"
import { byDay, can, inTab, matchesFilter, memoryFilter, setMemoryField, tabOf, toneOf } from "./memory"

const entry = (type: string, kind: string, status: string) => ({ type, kind, status, author: { type: "bot" } })

describe("memory records", () => {
  it("files every status under one tab, and an unknown one under All only", () => {
    expect(
      ["proposed", "confirmed", "accepted", "approved", "failed", "stale", "superseded", "rejected"].map(tabOf),
    ).toEqual(["review", "inuse", "inuse", "inuse", "inuse", "discarded", "discarded", "discarded"])
    expect(tabOf("archived")).toBeNull()
    expect(inTab("all", "archived")).toBe(true)
    expect(toneOf("failed")).toBe("bad")
  })

  it("offers only what memo 0.130.0 does with each record", () => {
    expect(can(entry("memory", "summary", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: true,
      forget: true,
    })
    expect(can(entry("memory", "summary", "superseded")).correct).toBe(false)
    expect(can(entry("fact", "decision", "accepted"))).toMatchObject({ discard: true, correct: true })
    expect(can(entry("fact", "promise", "accepted"))).toMatchObject({ discard: false, correct: true, forget: true })
    expect(can(entry("fact", "decision", "proposed"))).toMatchObject({ confirm: true, discard: true, correct: true })
    expect(can(entry("fact", "promise", "superseded")).correct).toBe(false)
    expect(can(entry("action", "reply", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: false,
      forget: false,
    })
    expect(can(entry("action", "reply", "approved")).discard).toBe(false)
  })

  it("groups a newest-first list into runs of one local day", () => {
    const at = (d: number, h: number) => ({ createdAt: new Date(2026, 9, d, h).toISOString() })
    const groups = byDay([at(31, 23), at(31, 1), at(30, 22), at(28, 9)])
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1, 1])
    expect(groups[0]?.day).toBe("2026-10-31")
  })
})

describe("Memory's search", () => {
  const entry = (over: Partial<Parameters<typeof matchesFilter>[0]> = {}) => ({
    type: "memory",
    kind: "preference",
    status: "confirmed",
    author: { type: "bot", name: "hermes" },
    subject: "person:7",
    subjectName: "James Mead",
    subjectIsOwner: false,
    project: null,
    projectName: null,
    text: "Prefers calls on Friday",
    summary: null,
    scope: "work",
    createdAt: new Date().toISOString(),
    ...over,
  })
  const hit = (q: string, e = entry()) => matchesFilter(e, memoryFilter(q))

  it("reads subject:me as the owner, never as a name containing the letters", () => {
    expect(hit("subject:me")).toBe(false)
    expect(hit("subject:me", entry({ subjectIsOwner: true, subjectName: null }))).toBe(true)
    expect(hit("subject:james")).toBe(true)
    expect(hit('subject:"person:7"')).toBe(true)
  })

  it("matches memo's kind and scope, the writer, and free words anywhere", () => {
    expect(hit("kind:preference scope:work by:hermes friday")).toBe(true)
    expect(hit("scope:personal")).toBe(false)
    expect(hit("by:me")).toBe(false)
    expect(hit("monday")).toBe(false)
  })

  it("chips write the same words a person types", () => {
    const q = setMemoryField("friday", "kind", ["decision", "preference"])
    expect(q).toBe("friday kind:(decision OR preference)")
    expect(memoryFilter(q)).toMatchObject({ kind: ["decision", "preference"], words: ["friday"] })
    expect(setMemoryField(q, "kind", [])).toBe("friday")
  })
})
