import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import type { Agent } from "@/platform/agents-schemas"
import { useAgents } from "@/shared/agents-store"
import { render, screen } from "@/testing/render"
import { AgentLaunch, useAgentChoice } from "./AgentLaunch"
import { AgentRunNote } from "./run-agent"

const AGENTS: Agent[] = [
  { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
  { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
  { id: "gemini", name: "Gemini CLI", foundBy: null, reads: ["agents"] },
]

beforeEach(() => {
  useAgents.setState({ agents: AGENTS })
  useAgentChoice.setState({ id: null })
})

const launch = (onOpen = vi.fn()) =>
  render(<AgentLaunch label={(n) => `Open in ${n}`} openingLabel="Opening…" opening={null} onOpen={onOpen} />)

it("opens the first agent found, and lists every startable agent with how to get the missing one", async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  launch(onOpen)
  await user.click(screen.getByRole("button", { name: "Open in Claude Code" }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "claude" }))

  await user.click(screen.getByRole("button", { name: "Choose the agent" }))
  const items = screen.getAllByRole("menuitem")
  expect(items.map((i) => i.textContent)).toEqual([
    "Claude Code",
    "Codex",
    ...["Gemini CLI", "Cursor", "OpenCode", "Hermes Agent", "OpenClaw"].map((name) =>
      expect.stringMatching(new RegExp(`^${name}Not found on this computer`)),
    ),
  ])
  await user.click(items[2] as HTMLElement)
  expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: "gemini", found: false }))
  expect(useAgentChoice.getState().id).toBe("claude")
})

it("remembers the agent picked from the menu and opens it next time", async () => {
  const user = userEvent.setup()
  const { unmount } = launch()
  await user.click(screen.getByRole("button", { name: "Choose the agent" }))
  await user.click(screen.getByRole("menuitem", { name: "Codex" }))
  expect(useAgentChoice.getState().id).toBe("codex")
  expect(JSON.parse(localStorage.getItem("wirecat.agent-choice") ?? "{}").state).toEqual({ id: "codex" })
  unmount()
  launch()
  expect(screen.getByRole("button", { name: "Open in Codex" })).toBeInTheDocument()
})

it("points an agent without an npm package to its install page", () => {
  const run = { started: false, agent: "cursor", file: "", reason: "missing", message: null } as const
  render(<AgentRunNote run={run} name="Cursor" started="" />)
  expect(
    screen.getByText(/run cursor-agent: .* follow the steps on https:\/\/cursor\.com\/docs\/cli\/installation/),
  ).toBeInTheDocument()
})
