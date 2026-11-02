import { describe, expect, it } from "vitest"
import {
  bucketDays,
  bucketsFor,
  closedRanges,
  closedTerm,
  helped,
  initials,
  ownersData,
  projectRows,
  sentByMe,
  sumRows,
  todayIn,
  topRows,
  weekOf,
} from "./analytics"

const TODAY = "2026-11-02" // a Monday

describe("buckets", () => {
  it("covers a week by day, a quarter by Monday-started weeks and all time by month", () => {
    expect(bucketsFor("7d", TODAY)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ])
    const weeks = bucketsFor("90d", TODAY)
    expect(weeks.at(-1)).toBe("2026-11-02")
    expect(weeks.every((w) => weekOf(w) === w)).toBe(true)
    expect(weeks).toHaveLength(14)
    expect(bucketsFor("all", TODAY, "2026-08-17")).toEqual(["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"])
  })

  it("crosses a year end by month", () => {
    expect(bucketsFor("all", "2027-01-05", "2026-11-30")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"])
  })

  it("adds sources into each bar and drops days before the period", () => {
    const bars = bucketDays(
      {
        telegram: [
          { key: "2026-10-26", count: 9 },
          { key: "2026-11-01", count: 3 },
        ],
        whatsapp: [{ key: "2026-11-01", count: 2 }],
      },
      "7d",
      TODAY,
    )
    expect(bars).toHaveLength(7)
    expect(bars.at(-2)).toEqual({ key: "2026-11-01", values: { telegram: 3, whatsapp: 2 }, total: 5 })
    expect(bars.reduce((s, b) => s + b.total, 0)).toBe(5)
  })

  it("starts all time at the oldest day any source counted", () => {
    const bars = bucketDays({ max: [{ key: "2026-09-14", count: 4 }] }, "all", TODAY)
    expect(bars.map((b) => b.key)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"])
    expect(bars[0]?.total).toBe(4)
  })

  it("reads today in the owner's zone", () => {
    expect(todayIn("Asia/Tokyo", new Date("2026-11-02T20:00:00Z"))).toBe("2026-11-03")
    expect(todayIn("America/New_York", new Date("2026-11-02T02:00:00Z"))).toBe("2026-11-01")
  })
})

describe("people and chats", () => {
  it("sums one source's profiles by key", () => {
    expect(
      sumRows([
        [{ key: "42", name: "Ana", count: 3 }],
        [
          { key: "42", name: null, count: 2 },
          { key: "7", name: "Bo", count: 1 },
        ],
      ]),
    ).toEqual([
      { key: "42", name: "Ana", count: 5 },
      { key: "7", name: "Bo", count: 1 },
    ])
  })

  it("ranks across sources without the owner, who is counted apart", () => {
    const rows = {
      telegram: [
        { key: "me", name: null, count: 50 },
        { key: "1", name: "Ana", count: 9 },
      ],
      whatsapp: [{ key: "1", name: "Mum", count: 12 }],
    }
    expect(topRows(rows).map((r) => [r.id, r.count])).toEqual([
      ["whatsapp:1", 12],
      ["telegram:1", 9],
    ])
    expect(sentByMe(rows.telegram)).toBe(50)
  })

  it("hides a name behind its initials", () => {
    expect(initials("Ana  Ruiz")).toBe("A. R.")
    expect(initials("Ёжик")).toBe("Ё.")
  })
})

describe("tasks", () => {
  it("asks memo for each bar's closed tasks, the first bar starting with the period", () => {
    const r = closedRanges("30d", TODAY)
    expect(r[0]).toEqual({ key: "2026-09-28", query: "state:(done OR dismissed) closed:[2026-10-04 TO 2026-10-04]" })
    expect(r).toHaveLength(6)
    expect(closedRanges("7d", TODAY)).toHaveLength(7)
    const weeks = closedRanges("90d", TODAY)
    expect(weeks[0]?.query).toBe("state:(done OR dismissed) closed:[2026-08-05 TO 2026-08-09]")
    expect(weeks.at(-1)?.query).toBe("state:(done OR dismissed) closed:[2026-11-02 TO 2026-11-02]")
    expect(closedRanges("all", TODAY)).toEqual([])
    expect(closedTerm("7d")).toBe("state:(done OR dismissed) closed:>=7d")
  })

  it("puts tasks, memories and messages per project, busiest first", () => {
    const rows = projectRows(
      [
        { value: "HRB", name: "Harbour", count: 4 },
        { value: "OLD", name: "Old", count: 0 },
      ],
      [{ value: "HRB", name: "Harbour", count: 1 }],
      [{ value: "WEB", name: "Website", count: 2 }],
      [
        { type: "memory", status: "confirmed", createdAt: "2026-11-01T10:00:00Z", project: "WEB", projectName: null },
        { type: "fact", status: "accepted", createdAt: "2025-01-01T10:00:00Z", project: "WEB", projectName: null },
        { type: "action", status: "proposed", createdAt: "2026-11-01T10:00:00Z", project: "WEB", projectName: null },
      ],
      "30d",
      TODAY,
    )
    expect(rows).toEqual([
      { key: "HRB", name: "Harbour", open: 4, overdue: 1, closed: 0, memories: 0, messages: null },
      { key: "WEB", name: "Website", open: 0, overdue: 0, closed: 2, memories: 1, messages: null },
    ])
  })
})

describe("how WireCat helps", () => {
  const run = (over: Record<string, unknown>) => ({
    tool: "tg",
    run_id: "r",
    command: "messages search",
    status: "success",
    started_at: "2026-11-01T09:00:00Z",
    ...over,
  })

  it("counts agents' runs and MCP calls, the owner's own and never the app's", () => {
    const h = helped(
      [
        run({ agent: { kind: "claude-code", session_id: "s" }, via: "cli" }),
        run({ agent: { kind: "mcp-client", client: { name: "claude-ai" } }, via: "mcp-http", mcp: { tool: "x" } }),
        run({ tool: "memo", agent: { kind: "codex" }, via: "mcp-stdio" }),
        run({ argv: ["search"] }),
        run({ via: "desktop", argv: [] }),
        run({ agent: { kind: "codex" }, started_at: "2026-01-01T00:00:00Z" }),
      ],
      "7d",
      TODAY,
    )
    expect(h.agentRuns).toBe(3)
    expect(h.mcpCalls).toBe(2)
    expect(h.yourRuns).toBe(1)
    expect(h.byAgent).toEqual([
      { name: "Claude Code", count: 1 },
      { name: "claude-ai", count: 1 },
      { name: "Codex", count: 1 },
    ])
    expect(h.byTool).toEqual([
      { tool: "tg", count: 2 },
      { tool: "memo", count: 1 },
    ])
    expect(h.since).toBe("2026-01-01T00:00:00Z")
  })
})

describe("test data", () => {
  const g = (provider: string, messages: number, chats: number) => ({
    provider,
    key: null as string | null,
    accounts: 1,
    chats,
    messages,
    emails: 0,
    documents: 0,
    meetings: 0,
  })

  it("leaves cli-core's test program out of every number", () => {
    const d = ownersData(
      { messages: 904, chats: 12, attachments: 3 },
      [g("chat", 4, 2), g("telegram", 900, 10)],
      [
        { ...g("chat", 4, 2), key: "2026" },
        { ...g("telegram", 900, 10), key: "2026" },
      ],
    )
    expect(d.rows).toEqual({ messages: 900, chats: 10, attachments: 3 })
    expect(d.providers.map((p) => p.provider)).toEqual(["telegram"])
    expect(d.years.map((p) => p.provider)).toEqual(["telegram"])
  })
})
