import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { agentsFixture } from "@/platform/mock-background-agent"
import { useBackgroundAgents } from "@/shared/background-agent-store"
import { BackgroundAgentSetting } from "./BackgroundAgentSetting"

const agents = agentsFixture

beforeEach(() => {
  vi.restoreAllMocks()
  useBackgroundAgents.setState({ agents: null, error: null, busy: false, chooseError: null })
})

it("lists both agents, chooses none for the owner and says why the button did nothing", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "gemini"]))
  const choose = vi.spyOn(platform, "backgroundAgentChoose")
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  const list = await screen.findByRole("combobox", { name: "Agent for background jobs" })
  expect(list).toHaveTextContent("Not chosen")
  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  expect(choose).not.toHaveBeenCalled()
  expect(screen.getByText("Choose an agent first.")).toBeInTheDocument()
  expect(screen.queryByText(/Digests are written by Claude Code/)).not.toBeInTheDocument()
})

it("says the only ready agent runs the jobs, and greys the others with the reason instead of hiding them", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["gemini"]))
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText("Only Gemini CLI is ready, so background jobs run in it.")).toBeInTheDocument()
  expect(screen.getByText(/Gemini CLI does not report what a run costs/)).toBeInTheDocument()
  await user.click(screen.getByRole("combobox", { name: "Agent for background jobs" }))
  expect(screen.getByRole("option", { name: "Claude Code · Not installed" })).toHaveAttribute("aria-disabled", "true")
  expect(screen.getByRole("option", { name: "Cursor · Cannot run on a schedule yet" })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
  expect(screen.getByText(/Greyed agents cannot run background jobs/)).toBeInTheDocument()
})

it("greys an agent memo cannot limit, with memo's reason, and never offers it", async () => {
  const kimi = {
    id: "kimi",
    name: "Kimi CLI",
    state: "unrestricted" as const,
    signedIn: null,
    reportsCost: false,
    reason: "approves every command in print mode",
  }
  const fixture = agents(["claude"])
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue({ ...fixture, agents: [...fixture.agents, kimi] })
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText("Kimi CLI: approves every command in print mode")).toBeInTheDocument()
  expect(screen.getByText("Only Claude Code is ready, so background jobs run in it.")).toBeInTheDocument()
  await user.click(screen.getByRole("combobox", { name: "Agent for background jobs" }))
  expect(screen.getByRole("option", { name: "Kimi CLI · Its commands cannot be limited" })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
})

it("greys Codex with memo's reason when memo refuses it, and never offers it", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude"]))
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText(/^Codex: cannot be held to read-only commands/)).toBeInTheDocument()
  expect(screen.getByText("Only Claude Code is ready, so background jobs run in it.")).toBeInTheDocument()
  await user.click(screen.getByRole("combobox", { name: "Agent for background jobs" }))
  expect(screen.getByRole("option", { name: "Codex · Its commands cannot be limited" })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
})

it("on a memo that cannot list its agents, keeps Claude Code, greys Codex and points to the Memo update", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude"], "claude", false))
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText(/This Memo knows only Claude Code and Codex/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open Memo" })).toBeInTheDocument()
  expect(screen.getByText("Digests are written by Claude Code until you update Memo.")).toBeInTheDocument()
})
