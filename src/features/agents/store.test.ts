import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { SkillReport } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { useAgents } from "./store"

const report = (installed: string): SkillReport => ({
  source: "status",
  targets: [{ target: "claude", path: "~/.claude/skills/tg-cli/SKILL.md", installed, state: "current" }],
})

beforeEach(() => useAgents.setState(useAgents.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

it("keeps the last skill states while it asks again, and says when every tool has answered", async () => {
  useAgents.setState({ skills: { tg: { report: report("0.88.0"), error: null } } })
  let answer: (r: SkillReport) => void = () => undefined
  vi.spyOn(platform, "detectAgents").mockResolvedValue([])
  vi.spyOn(platform, "skillStatus").mockReturnValue(new Promise((r) => (answer = r)))

  const loading = useAgents.getState().load(["tg"])
  expect(useAgents.getState()).toMatchObject({ refreshing: true, answered: false })
  expect(useAgents.getState().skills.tg?.report).toEqual(report("0.88.0"))

  answer(report("0.89.0"))
  await loading
  expect(useAgents.getState()).toMatchObject({ refreshing: false, answered: true })
  expect(useAgents.getState().skills.tg?.report).toEqual(report("0.89.0"))
})

it("after the tool is updated, forgets what this session wrote for it and asks it again", async () => {
  useAgents.setState({ agents: [], written: { "tg:claude": "0.108.0", "wa:claude": "0.7.0" } })
  vi.spyOn(platform, "skillStatus").mockResolvedValue(report("0.112.0"))

  await useAgents.getState().recheck("tg")

  expect(useAgents.getState().written).toEqual({ "wa:claude": "0.7.0" })
  expect(useAgents.getState().skills.tg?.report).toEqual(report("0.112.0"))
})
