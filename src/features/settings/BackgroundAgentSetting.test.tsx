import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useBackgroundAgents } from "@/shared/background-agent-store"
import { BackgroundAgentSetting } from "./BackgroundAgentSetting"

const agents = (installed: string[], chosen: string | null = null) => ({
  agents: ["claude", "codex"].map((id) => ({ id, installed: installed.includes(id), signedIn: null })),
  chosen,
  effective: chosen ?? (installed.length === 1 ? (installed[0] ?? null) : null),
})

beforeEach(() => {
  vi.restoreAllMocks()
  useBackgroundAgents.setState({ agents: null, error: null, busy: false, chooseError: null })
})

it("lists both agents, chooses none for the owner and says why the button did nothing", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "codex"]))
  const choose = vi.spyOn(platform, "backgroundAgentChoose")
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  const list = await screen.findByRole("combobox", { name: "Agent for background jobs" })
  expect(list).toHaveTextContent("Not chosen")
  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  expect(choose).not.toHaveBeenCalled()
  expect(screen.getByText("Choose an agent first.")).toBeInTheDocument()
  expect(screen.getByText(/Digests are written by Claude Code for now/)).toBeInTheDocument()
})

it("says the only installed agent runs the jobs, and marks the missing one", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["codex"]))
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText("Only Codex is installed, so background jobs run in it.")).toBeInTheDocument()
  await user.click(screen.getByRole("combobox", { name: "Agent for background jobs" }))
  expect(screen.getByRole("option", { name: "Claude Code · Not installed" })).toBeInTheDocument()
})
