import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { MailAgent as State } from "@/platform/mail-agent-schemas"
import { MailAgent } from "./MailAgent"

const email = findTool("email") as NonNullable<ReturnType<typeof findTool>>
const on: State = {
  state: "on",
  when: "every 5m",
  last: { at: new Date(Date.now() - 12 * 60_000).toISOString(), exitCode: 0, reason: null, failures: null },
  spentTodayUsd: 0.84,
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(platform, "mailAgentWaiting").mockResolvedValue(17)
})

it("is offered only for Email, which names memo's schedule", () => {
  expect(email.mailAgent).toEqual({ via: "memo", name: "mail-triage" })
  expect(findTool("tg")?.mailAgent).toBeNull()
})

it("turns the schedule on through memo and then shows its status and the day's spend", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue(on)
  render(<MailAgent tool={email} />)

  const toggle = await screen.findByRole("switch", { name: "Run on a schedule" })
  expect(toggle).toHaveAttribute("aria-checked", "false")
  fireEvent.click(toggle)

  expect(set).toHaveBeenCalledWith("email", true)
  expect(await screen.findByText(/Last run .* · finished/)).toBeInTheDocument()
  expect(screen.getByText("Spent today: $0.84")).toBeInTheDocument()
  expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByText("17 proposals wait for you")).toBeInTheDocument()
})

it("turns it off with memo's remove", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue(on)
  const set = vi.spyOn(platform, "mailAgentSet").mockResolvedValue({ state: "off", harness: true })
  render(<MailAgent tool={email} />)

  fireEvent.click(await screen.findByRole("switch", { name: "Run on a schedule" }))

  expect(set).toHaveBeenCalledWith("email", false)
  await vi.waitFor(() =>
    expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "false"),
  )
})

it("shows memo's own words when the schedule cannot be turned on, and leaves the switch off", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: true })
  vi.spyOn(platform, "mailAgentSet").mockRejectedValue(new Error("systemctl --user enable failed"))
  render(<MailAgent tool={email} />)

  fireEvent.click(await screen.findByRole("switch", { name: "Run on a schedule" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("systemctl --user enable failed")
  expect(screen.getByRole("switch", { name: "Run on a schedule" })).toHaveAttribute("aria-checked", "false")
})

it("keeps the switch off and says why when Claude Code is missing", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "off", harness: false })
  render(<MailAgent tool={email} />)

  expect(await screen.findByRole("switch", { name: "Run on a schedule" })).toBeDisabled()
  expect(screen.getByText(/Claude Code is not installed/)).toBeInTheDocument()
})

it("offers Memo instead of a switch when memo is not installed", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({ state: "noMemo" })
  render(<MailAgent tool={email} />)

  expect(await screen.findByRole("button", { name: "Open Memo" })).toBeInTheDocument()
  expect(screen.queryByRole("switch")).not.toBeInTheDocument()
})

it("says when a run was skipped at the day's cost cap", async () => {
  vi.spyOn(platform, "mailAgentStatus").mockResolvedValue({
    ...on,
    last: { at: new Date().toISOString(), exitCode: 1, reason: "today's runs cost $5.02", failures: null },
  })
  render(<MailAgent tool={email} />)

  expect(await screen.findByText(/skipped: today's runs cost \$5\.02/)).toBeInTheDocument()
})
