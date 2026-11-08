import { describe, expect, it } from "vitest"
import {
  emojiOf,
  entityOf,
  isOverdue,
  orderedSections,
  staleHealth,
  targetOfRefs,
  targetsOfRefs,
  taskGroups,
  windowOf,
} from "./digest"

const now = Date.parse("2026-11-08T09:00:00")
const item = (over: Partial<Parameters<typeof emojiOf>[0]> = {}) =>
  ({ type: "task", priority: "normal", amount: null, due: null, ...over }) as Parameters<typeof emojiOf>[0]

describe("a digest laid out as cli-core's renderer lays it out", () => {
  it("marks a task, a payment or a risk past its due day as overdue, and only those", () => {
    expect(isOverdue(item({ due: "2026-11-06" }), now)).toBe(true)
    expect(isOverdue(item({ due: "2026-11-08" }), now)).toBe(false)
    expect(isOverdue(item({ type: "reply", due: "2026-11-06" }), now)).toBe(false)
    expect(emojiOf(item(), true)).toBe("⏰")
    expect(emojiOf(item({ type: "risk", priority: "high" }), false)).toBe("🔴")
    expect(emojiOf(item({ type: "money", amount: { direction: "in" } }), false)).toBe("📥")
  })

  it("keeps the fixed section order, merges parts of one kind and drops empty ones", () => {
    const sections = orderedSections([
      { kind: "money", items: [1], more: 0 },
      { kind: "today", items: [2], more: 1 },
      { kind: "mail", items: [], more: 3 },
      { kind: "today", items: [3], more: 2 },
    ])
    expect(sections).toEqual([
      { kind: "today", items: [2, 3], more: 3 },
      { kind: "money", items: [1], more: 0 },
    ])
  })

  it("links each task group, and no group whose time the link grammar refuses", () => {
    const groups = taskGroups({ overdue: 5, today: 0, tomorrow: 2, new: 4, new_since: "2026-11-07T08:00:00+03:00" })
    expect(groups.map((g) => [g.filter, g.count])).toEqual([
      ["overdue", 5],
      ["tomorrow", 2],
      ["new", 4],
    ])
    expect(groups[2]?.target).toEqual({ type: "tasks", filter: "new", since: "2026-11-07T08:00:00+03:00" })
    expect(taskGroups({ overdue: 0, today: 0, tomorrow: 0, new: 1, new_since: "yesterday" })[0]?.target).toBeNull()
  })

  it("opens an item by the first ref a link can name", () => {
    expect(targetOfRefs(["person:7", "task:80"])).toEqual({ type: "task", id: "80" })
    expect(targetOfRefs(["account:max/1"])).toBeNull()
    expect(targetOfRefs(["project:north-wind"])).toBeNull()
  })

  it("links an item's person and project only when its refs name exactly one", () => {
    expect(entityOf(["msg:max/1/2/3", "person:77"], "person")).toEqual({ type: "person", id: "77" })
    expect(entityOf(["person:77", "person:78"], "person")).toBeNull()
    expect(entityOf(["project:north-wind", "project:north-wind"], "project")).toEqual({
      type: "project",
      key: "north-wind",
    })
    expect(targetsOfRefs(["task:80", "plain", "task:80", "proposal:17070"])).toEqual([
      { type: "task", id: "80" },
      { type: "proposal", id: "17070" },
    ])
  })

  it("names a day's window in hours and longer ones in days, and keeps only sync lines worth saying", () => {
    expect(windowOf("2026-11-07T08:00:00Z", "2026-11-08T08:00:00Z", "en")).toBe("24 hr")
    expect(windowOf("2026-11-05T08:00:00Z", "2026-11-08T08:00:00Z", "ru")).toBe("3 дня")
    const lines = [
      { reason: null, stale_hours: 3 },
      { reason: null, stale_hours: 50 },
      { reason: "no-schedule", stale_hours: 0 },
    ]
    expect(staleHealth(lines)).toHaveLength(2)
  })
})
