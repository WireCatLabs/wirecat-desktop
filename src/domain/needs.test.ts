import { describe, expect, it } from "vitest"
import { gapFromRead, gapOf, type ToolFacts } from "./needs"

const facts =
  (known: Record<string, { version: string | null | undefined; profiles?: string[] | null }>): ToolFacts =>
  (id) =>
    known[id] ?? { version: null }

describe("what a page still needs", () => {
  it("says nothing until the tools are found, then names the first missing one and the others that would do", () => {
    const need = { anyOf: ["bitrix", "amo"], signedIn: true }
    expect(gapOf(need, facts({ bitrix: { version: undefined } }))).toBe("unknown")
    expect(gapOf(need, facts({}))).toEqual({ kind: "missing", tool: "bitrix", others: ["amo"] })
  })

  it("asks for an update below the minimum version, and is met at it", () => {
    const need = { anyOf: ["memo"], minVersion: "0.131.14" }
    expect(gapOf(need, facts({ memo: { version: "0.131.9" } }))).toEqual({
      kind: "old",
      tool: "memo",
      version: "0.131.9",
      need: "0.131.14",
    })
    expect(gapOf(need, facts({ memo: { version: "0.131.14" } }))).toBeNull()
  })

  it("asks for a sign-in only once the profiles are read, and one signed-in tool of several is enough", () => {
    const need = { anyOf: ["bitrix", "amo"], signedIn: true }
    expect(gapOf(need, facts({ bitrix: { version: "1.0.0" } }))).toBe("unknown")
    expect(gapOf(need, facts({ bitrix: { version: "1.0.0", profiles: [] } }))).toEqual({
      kind: "signedOut",
      tool: "bitrix",
    })
    expect(
      gapOf(need, facts({ bitrix: { version: "1.0.0", profiles: [] }, amo: { version: "2.0.0", profiles: ["work"] } })),
    ).toBeNull()
  })

  it("reads a page's own missing or old answer as the same gap", () => {
    expect(gapFromRead({ kind: "missing" })).toEqual({ kind: "missing", tool: "memo", others: [] })
    expect(gapFromRead({ kind: "old", version: null, need: "0.131.72" })).toEqual({
      kind: "old",
      tool: "memo",
      version: null,
      need: "0.131.72",
    })
    expect(gapFromRead({ kind: "ready" })).toBeNull()
  })
})
