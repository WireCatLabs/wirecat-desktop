import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { LastRun, MailAgent as State } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { agentsFixture } from "@/platform/mock-background-agent"
import { useBackgroundAgents } from "@/shared/background-agent-store"
import { MailAgent } from "./MailAgent"

const email = findTool("email") as NonNullable<ReturnType<typeof findTool>>
const ran: LastRun = {
  at: new Date(Date.now() - 12 * 60_000).toISOString(),
  exitCode: 0,
  reason: null,
  failures: null,
  skipped: null,
}
const on: Extract<State, { state: "on" }> = {
  state: "on",
  when: "every 30m",
  every: "30m",
  last: ran,
  spentTodayUsd: 0.84,
  maxCostUsd: 1,
  maxCostPerDayUsd: 5,
  agent: "claude",
  trouble: null,
}
const agents = agentsFixture

beforeEach(() => {
  vi.restoreAllMocks()
  useBackgroundAgents.setState({ agents: null, error: null, busy: false, chooseError: null })
  vi.spyOn(platform, "mailAgentWaiting").mockResolvedValue(17)
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude"]))
})

it("is offered only for Email, which names memo's schedule", () => {
  expect(email.mailAgent).toEqual({
    via: "memo",
    name: "mail-triage",
    every: "30m",
    choices: ["5m", "15m", "30m", "1h"],
  })
  expect(findTool("tg")?.mailAgent).toBeNull()
})

it("turns the schedule on through memo and then shows its status and the day's spend", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue(on)
  render(<MailAgent tool={email} />)

  const toggle = await screen.findByRole("switch", { name: "Run on a schedule" })
  expect(toggle).toHaveAttribute("aria-checked", "false")
  fireEvent.click(toggle)

  await vi.waitFor(() => expect(set).toHaveBeenCalledWith("email", true, "30m", "claude"))
  expect(await screen.findByText(/Last run .* · finished/)).toBeInTheDocument()
  expect(screen.getByText("Spent today: $0.84 of $5.00")).toBeInTheDocument()
  expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByText("17 proposals wait for you")).toBeInTheDocument()
})

it("turns it off with memo's remove", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue(on)
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ state: "off", harness: true })
  render(<MailAgent tool={email} />)

  fireEvent.click(await screen.findByRole("switch", { name: "Run on a schedule" }))

  expect(set).toHaveBeenCalledWith("email", false, undefined, undefined)
  await vi.waitFor(() =>
    expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "false"),
  )
})

it("says it could not turn on, keeps the tool's words under Details, and leaves the switch off", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  vi.spyOn(platform, "mailAgentSet").mockRejectedValue(new Error("systemctl --user enable failed"))
  render(<MailAgent tool={email} />)

  fireEvent.click(await screen.findByRole("switch", { name: "Run on a schedule" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not turn the mail agent on.")
  fireEvent.click(screen.getByRole("button", { name: "Details" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("systemctl --user enable failed")
  expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "false")
})

it("keeps the switch off and says why when no agent is ready", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: false })
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents([]))
  render(<MailAgent tool={email} />)

  expect(await screen.findByRole("switch", { name: "Run on a schedule" })).toBeDisabled()
  expect(screen.getByText(/No agent on this computer can run it/)).toBeInTheDocument()
})

it("asks which agent to run in when both are installed and none is chosen, and never picks one", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "gemini"]))
  const choose = vi.spyOn(platform, "backgroundAgentChoose").mockResolvedValue(agents(["claude", "gemini"], "gemini"))
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ ...on, agent: "gemini" })
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  const agent = await screen.findByRole("combobox", { name: "Agent for background jobs" })
  expect(agent).toHaveTextContent("Not chosen")
  await user.click(screen.getByRole("switch", { name: "Run on a schedule" }))
  expect(set).not.toHaveBeenCalled()
  expect(screen.getByText("Choose the agent it runs in first.")).toHaveClass("text-warn-ink")

  await user.click(agent)
  await user.click(screen.getByRole("option", { name: /^Gemini CLI/ }))
  await user.click(screen.getByRole("button", { name: "Use this agent" }))
  expect(choose).toHaveBeenCalledWith("gemini")
  await user.click(screen.getByRole("switch", { name: "Run on a schedule" }))
  expect(set).toHaveBeenCalledWith("email", true, "30m", "gemini")
})

it("names the agent with no credit, keeps its words under Details and offers the other one", async () => {
  const failed = { ...ran, exitCode: 1, reason: "exit 1", failures: 2 }
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "gemini"], "claude"))
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    last: failed,
    trouble: { agent: "claude", kind: "noCredit", line: "Credit balance is too low" },
  })
  const choose = vi.spyOn(platform, "backgroundAgentChoose").mockResolvedValue(agents(["claude", "gemini"], "gemini"))
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({
    ...on,
    agent: "gemini",
    last: failed,
    spentTodayUsd: 0,
    trouble: { agent: "claude", kind: "noCredit", line: "Credit balance is too low" },
  })
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  expect(await screen.findByText("Claude Code has no credit left, so the run failed.")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Details" }))
  expect(screen.getByText("Credit balance is too low")).toBeInTheDocument()
  expect(set).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Switch to Gemini CLI" }))
  expect(set).toHaveBeenCalledWith("email", true, "30m", "gemini")
  await vi.waitFor(() => expect(choose).toHaveBeenCalledWith("gemini"))
  // The failed run was Claude's: once the job runs in Gemini CLI it is history, and Gemini CLI reports no cost.
  expect(await screen.findByText(/runs in Gemini CLI/)).toBeInTheDocument()
  expect(screen.queryByText(/has no credit left/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/Spent today/)).not.toBeInTheDocument()
})

it("offers no other agent when only the failing one is installed", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    last: { ...ran, exitCode: 1 },
    trouble: { agent: "claude", kind: "limit", line: "You've hit your session limit · resets 3:45pm" },
  })
  render(<MailAgent tool={email} />)

  expect(await screen.findByText("Claude Code reached its usage limit, so the run failed.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument()
})

it("switches to Codex only through its warning, and asks no more once confirmed", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "codex"], "claude"))
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    last: { ...ran, exitCode: 1 },
    trouble: { agent: "claude", kind: "noCredit", line: "Credit balance is too low" },
  })
  const ack = vi
    .spyOn(platform, "backgroundAgentAcknowledge")
    .mockResolvedValue(agents(["claude", "codex"], "claude", true, true))
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ ...on, agent: "codex", spentTodayUsd: 0 })
  vi.spyOn(platform, "backgroundAgentChoose").mockResolvedValue(agents(["claude", "codex"], "codex", true, true))
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  await user.click(await screen.findByRole("button", { name: "Switch to Codex" }))
  const warning = await screen.findByRole("dialog", { name: "Run background jobs in Codex?" })
  expect(set).not.toHaveBeenCalled()
  await user.click(within(warning).getByRole("button", { name: "I understand, use Codex" }))
  expect(ack).toHaveBeenCalledWith("codex")
  await vi.waitFor(() => expect(set).toHaveBeenCalledWith("email", true, "30m", "codex"))
})

it("saves a schedule memo stopped again as it is, with its own agent and interval, and chooses nothing", async () => {
  vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agents(["claude", "gemini"], "gemini"))
  const why =
    "schedule mail-triage does not run: it was saved by an older version, which kept no agent to rebuild its start from; save it again to run it"
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    every: "15m",
    last: { ...ran, skipped: { at: new Date().toISOString(), why, reason: "agent.refused" } },
  })
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ ...on, every: "15m" })
  const choose = vi.spyOn(platform, "backgroundAgentChoose")
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  expect(
    await screen.findByText(/does not run until it is saved again\. It is saved as it is: in Claude Code/),
  ).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Save again" }))
  expect(set).toHaveBeenCalledWith("email", true, "15m", "claude")
  expect(choose).not.toHaveBeenCalled()
  expect(await screen.findByText(/Last run/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Save again" })).not.toBeInTheDocument()
})

it("offers Memo instead of a switch when memo is not installed", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "noMemo" })
  render(<MailAgent tool={email} />)

  expect(await screen.findByRole("button", { name: "Open Memo" })).toBeInTheDocument()
  expect(screen.queryByRole("switch")).not.toBeInTheDocument()
})

it("says when a run was skipped at the day's cost cap, in memo's words", async () => {
  const why = "today's runs cost $5.02, the $5.00 a day allowed; it runs again tomorrow"
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    spentTodayUsd: 5.02,
    last: { ...ran, skipped: { at: new Date().toISOString(), why, reason: null } },
  })
  render(<MailAgent tool={email} />)

  expect(await screen.findByText(`Last start skipped just now: ${why}`)).toBeInTheDocument()
  expect(screen.getByText("Spent today: $5.02 of $5.00")).toBeInTheDocument()
})

it("translates a skip by its reason id and shows memo's sentence for an id it does not know", async () => {
  const skipped = (reason: string) => ({ at: new Date().toISOString(), why: "memo's english", reason })
  const status = vi.spyOn(platform, "mailAgentStatus")
  status.mockResolvedValue({ ...on, last: { ...ran, skipped: skipped("mail.none-new") } })
  const { unmount } = render(<MailAgent tool={email} />)
  expect(await screen.findByText("Last start skipped just now: no new mail since the last check")).toBeInTheDocument()
  unmount()

  status.mockResolvedValue({ ...on, last: { ...ran, skipped: skipped("mail.below-threshold") } })
  const second = render(<MailAgent tool={email} />)
  expect(await screen.findByText(/some mail is waiting, but not enough/)).toBeInTheDocument()
  second.unmount()

  status.mockResolvedValue({ ...on, last: { ...ran, skipped: skipped("schedule.unheard-of") } })
  render(<MailAgent tool={email} />)
  expect(await screen.findByText("Last start skipped just now: memo's english")).toBeInTheDocument()
})

it("leaves the cap out when there is none or memo is too old to report it", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ ...on, maxCostPerDayUsd: 0 })
  const { unmount } = render(<MailAgent tool={email} />)
  expect(await screen.findByText("Spent today: $0.84")).toBeInTheDocument()
  unmount()

  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ ...on, maxCostUsd: null, maxCostPerDayUsd: null })
  render(<MailAgent tool={email} />)
  expect(await screen.findByText("Spent today: $0.84")).toBeInTheDocument()
})

it("shows the schedule's own interval and changes it through memo, never falling back to 5 minutes", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue(on)
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ ...on, when: "every 1h", every: "1h" })
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  const how = await screen.findByRole("combobox", { name: "How often" })
  await vi.waitFor(() => expect(how).toHaveTextContent("30 min"))
  expect(screen.getByText(/Checks for new mail every 30 min/)).toBeInTheDocument()
  await user.click(how)
  await user.click(screen.getByRole("option", { name: "hour" }))
  expect(set).toHaveBeenCalledWith("email", true, "1h", "claude")
  await vi.waitFor(() => expect(how).toHaveTextContent("hour"))
})

it("turns on at the interval chosen while it was off", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ ...on, when: "every 15m", every: "15m" })
  const user = userEvent.setup()
  render(<MailAgent tool={email} />)

  const how = await screen.findByRole("combobox", { name: "How often" })
  expect(how).toHaveTextContent("30 min")
  await user.click(how)
  await user.click(screen.getByRole("option", { name: "15 min" }))
  expect(set).not.toHaveBeenCalled()
  await user.click(screen.getByRole("switch", { name: "Run on a schedule" }))
  await vi.waitFor(() => expect(set).toHaveBeenCalledWith("email", true, "15m", "claude"))
  expect(within(document.body).queryByText(/every 5 min/)).not.toBeInTheDocument()
})
