import { describe, expect, it } from "vitest"
import type { CheckItem } from "@/domain/agents"
import { findTool } from "@/domain/catalog"
import { agentsMessages } from "./messages"
import { rowTone, statusWords } from "./SkillTable"
import type { AgentSkill, AgentView } from "./view"

const m = agentsMessages.en
const tg = findTool("tg")
if (!tg) throw new Error("no tg in the catalog")

const current: AgentSkill = {
  tool: tg,
  cell: { kind: "current", installed: "0.112.0", latest: "0.112.0" } as AgentSkill["cell"],
  target: "codex" as AgentSkill["target"],
  busy: false,
  failure: null,
  action: null,
  newer: null,
}

const view = (items: CheckItem[], tone: AgentView["tone"]): AgentView =>
  ({
    agent: { id: "codex", name: "Codex" },
    skills: [current],
    todo: [],
    items,
    tone,
    sessions: null,
    claims: [],
    signedOut: [],
  }) as unknown as AgentView

const notOnPath: CheckItem = { id: "tg:path", tone: "bad", title: "Telegram is not on a terminal's PATH", detail: "" }

describe("an agent whose skills are current", () => {
  it("is green and says so when nothing else stops it", () => {
    const ready = view([{ id: "tg:skill", tone: "ok", title: "", detail: "" }], "ok")
    expect(rowTone(ready)).toBe("ok")
    expect(statusWords(ready, m)).toEqual({ line: "Skills current", sentence: "Every skill it can see is current" })
  })

  it("is red, and says why, when it can run none of its tools", () => {
    const stuck = view([notOnPath], "bad")
    expect(rowTone(stuck)).toBe("bad")
    expect(statusWords(stuck, m).line).toBe("Cannot run its tools")
    expect(statusWords(stuck, m).sentence).toMatch(/^Its skills are current, but Codex cannot run any WireCat tool/)
  })

  it("is amber with a count when some things are left to fix", () => {
    const partly = view([{ ...notOnPath, tone: "bad" }], "warn")
    expect(rowTone(partly)).toBe("warn")
    expect(statusWords(partly, m)).toEqual({
      line: "1 thing to fix",
      sentence: "Its skills are current, but one more thing stops Codex: see Also to fix below.",
    })
  })
})
