import { render, screen, within } from "@testing-library/react"
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
    needsAck: false,
    acknowledged: false,
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

it("offers Codex after a warning: Cancel keeps the choice, «I understand» confirms it once and chooses it", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "codex"]))
  const ack = vi
    .spyOn(platform, "backgroundAgentAcknowledge")
    .mockResolvedValue(agents(["claude", "codex"], null, true, true))
  const choose = vi
    .spyOn(platform, "backgroundAgentChoose")
    .mockResolvedValue(agents(["claude", "codex"], "codex", true, true))
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText(/^Codex: runs any program and reads your files/)).toBeInTheDocument()
  expect(screen.getByText("Only Claude Code is ready, so background jobs run in it.")).toBeInTheDocument()
  await user.click(screen.getByRole("combobox", { name: "Agent for background jobs" }))
  await user.click(screen.getByRole("option", { name: "Codex · Ready after a warning" }))
  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  let warning = await screen.findByRole("dialog", { name: "Run background jobs in Codex?" })
  expect(
    within(warning).getByText(/can still run any program on this computer and read your files/),
  ).toBeInTheDocument()
  expect(within(warning).getByText(/^Memo says: runs any program/)).toBeInTheDocument()
  await user.click(within(warning).getByRole("button", { name: "Cancel" }))
  expect(ack).not.toHaveBeenCalled()
  expect(choose).not.toHaveBeenCalled()

  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  warning = await screen.findByRole("dialog", { name: "Run background jobs in Codex?" })
  await user.click(within(warning).getByRole("button", { name: "I understand, use Codex" }))
  expect(ack).toHaveBeenCalledWith("codex")
  await vi.waitFor(() => expect(choose).toHaveBeenCalledWith("codex"))
})

it("keeps the warning open with the error when the confirmation is not saved, and chooses nothing", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "codex"]))
  vi.spyOn(platform, "backgroundAgentAcknowledge").mockRejectedValue(new Error("disk full"))
  const choose = vi.spyOn(platform, "backgroundAgentChoose")
  const user = userEvent.setup()
  render(<BackgroundAgentSetting />)

  await user.click(await screen.findByRole("combobox", { name: "Agent for background jobs" }))
  await user.click(screen.getByRole("option", { name: "Codex · Ready after a warning" }))
  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  const warning = await screen.findByRole("dialog", { name: "Run background jobs in Codex?" })
  await user.click(within(warning).getByRole("button", { name: "I understand, use Codex" }))
  expect(await within(warning).findByText("Your choice was not saved.")).toBeInTheDocument()
  expect(choose).not.toHaveBeenCalled()
})

it("on a memo that cannot list its agents, keeps Claude Code, greys Codex and points to the Memo update", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude"], "claude", false))
  render(<BackgroundAgentSetting />)

  expect(await screen.findByText(/This Memo knows only Claude Code and Codex/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open Memo" })).toBeInTheDocument()
  expect(screen.getByText("Digests are written by Claude Code until you update Memo.")).toBeInTheDocument()
})
