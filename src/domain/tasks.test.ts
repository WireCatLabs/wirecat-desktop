import { describe, expect, it } from "vitest"
import {
  anchorOf,
  BOARD_DEFAULT,
  boardQuery,
  daysUntil,
  dueOf,
  dueTone,
  labelOf,
  placeKey,
  setDue,
  setField,
  valuesOf,
} from "./tasks"

describe("the search words the filters write", () => {
  it("writes one field in place of what it said, and reads it back", () => {
    let q = setField("invoice", "project", ["HRB"])
    expect(q).toBe("invoice project:HRB")
    q = setField(q, "project", ["HRB", "OPS"])
    expect(q).toBe("invoice project:(HRB OR OPS)")
    expect(valuesOf(q, "project")).toEqual(["HRB", "OPS"])
    q = setField(q, "assignee", ["person:2", "none"])
    expect(q).toBe('invoice project:(HRB OR OPS) assignee:("person:2" OR none)')
    expect(valuesOf(q, "assignee")).toEqual(["person:2", "none"])
    expect(setField(q, "project", [])).toBe('invoice assignee:("person:2" OR none)')
  })

  it("keeps the owner's other words, a negated field included", () => {
    expect(setField("-project:OPS budget", "priority", ["high"])).toBe("-project:OPS budget priority:high")
    expect(setField("-project:OPS budget", "project", [])).toBe("budget")
  })

  it("writes the due choices memo understands, with the week as dates", () => {
    const today = new Date(2026, 10, 1)
    expect(setDue("x", "week", today)).toBe("x due:[today TO 2026-11-08]")
    expect(setDue("x due:[today TO 2026-11-08]", "overdue", today)).toBe("x overdue:true")
    expect(setDue("x overdue:true", "none", today)).toBe("x NOT due:*")
    expect(dueOf("x NOT due:*")).toBe("none")
    expect(setDue("x NOT due:*", null, today)).toBe("x")
  })

  it("adds open work and the last 14 days of closed tasks unless states are chosen", () => {
    expect(boardQuery("")).toBe(BOARD_DEFAULT)
    expect(boardQuery("budget")).toBe(`(budget) ${BOARD_DEFAULT}`)
    expect(boardQuery("state:done")).toBe("state:done")
    expect(boardQuery("closed:>=30d")).toBe("closed:>=30d")
  })
})

describe("priority, dates and order", () => {
  it("names each quarter", () => {
    expect([0, 0.25, 0.5, 0.749, 0.75, 1, null].map(labelOf)).toEqual([
      "low",
      "medium",
      "high",
      "high",
      "critical",
      "critical",
      null,
    ])
  })

  it("reads a due day in local time and says how close it is", () => {
    const today = new Date(2026, 10, 1, 9)
    const midnight = new Date(2026, 10, 1).toISOString()
    expect(daysUntil(midnight, today)).toBe(0)
    expect(dueTone(new Date(2026, 9, 30).toISOString(), "open", today)).toBe("late")
    expect(dueTone(new Date(2026, 9, 30).toISOString(), "done", today)).toBe("later")
    expect(dueTone(new Date(2026, 10, 3).toISOString(), "todo", today)).toBe("soon")
  })

  it("anchors a dropped card on its new neighbour", () => {
    expect(anchorOf(["A", "B", "C"], "X", 1)).toEqual({ before: "B" })
    expect(anchorOf(["A", "B"], "X", 2)).toEqual({ after: "B" })
    expect(anchorOf(["A", "X", "B"], "X", 0)).toEqual({ before: "A" })
    expect(anchorOf([], "X", 0)).toEqual({})
  })

  it("moves a key in the page's order", () => {
    expect(placeKey(["A", "B", "C"], "C", "A")).toEqual(["C", "A", "B"])
    expect(placeKey(["A", "B", "C"], "A", null)).toEqual(["B", "C", "A"])
  })
})
