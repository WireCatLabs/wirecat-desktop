import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useAgents } from "@/shared/agents-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

// Kept apart from Onboarding.test.tsx: a file gets its own platform mock, so no answer an earlier test is still
// waiting for can land here and replace the tools and agents these tests set up.
describe("Connect agents step", () => {
  const copy = { path: "~/bin/tg", version: "1.0.0", manager: "npm", problem: null }
  const agent = (id: string, name: string, reads: ("claude" | "agents")[], found: boolean) => ({
    id,
    name,
    foundBy: found ? ("program" as const) : null,
    reads,
  })

  beforeEach(() => {
    localStorage.clear()
    useOnboarding.setState({ status: "new", open: true, step: "agents", chosen: [] })
    useTools.setState({
      installs: { tg: [copy], max: [], wa: [], zm: [], drive: [], memo: [] },
      checked: true,
      refresh: async () => undefined,
    })
    vi.spyOn(platform, "skillStatus").mockResolvedValue({
      source: "status",
      targets: [
        { target: "claude", path: null, installed: null, state: "missing" },
        { target: "agents", path: null, installed: null, state: "missing" },
      ],
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("heads one column for Cursor when it is the only agent found, though it reads both folders", async () => {
    vi.spyOn(platform, "detectAgents").mockResolvedValue([
      agent("claude", "Claude Code", ["claude"], false),
      agent("cursor", "Cursor", ["agents", "claude"], true),
    ])
    render(<App />)
    const table = screen.getByRole("table", { name: "Skills for agents" })
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((h) => h.textContent),
      ).toEqual(["Tool", "Cursor"]),
    )
  })

  it("installs one tool's skill for every agent, shows each cell's result, and Continue leads once one is in", async () => {
    vi.spyOn(platform, "detectAgents").mockResolvedValue([
      agent("claude", "Claude Code", ["claude"], true),
      agent("codex", "Codex", ["agents"], true),
    ])
    vi.spyOn(platform, "skillInstall").mockImplementation(async (_id, target) => {
      if (target === "agents") throw new Error("EACCES: permission denied")
      return "1.0.0"
    })
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole("region", { name: "How a skill helps" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("data-variant", "secondary")

    // Cells stay "checking" until the skill check ends: acting before then asserts on a half-drawn table.
    await waitFor(() => expect(useAgents.getState().answered).toBe(true))
    const all = await screen.findByRole("button", { name: "Install the Telegram skill for Claude Code and Codex" })
    expect(screen.getByRole("button", { name: "Install the Telegram skill for Codex" })).toHaveAttribute(
      "data-variant",
      "primary",
    )
    await user.click(all)
    const dialog = await screen.findByRole("dialog", { name: "Install the Telegram skill for Claude Code and Codex?" })
    expect(dialog).toHaveTextContent("tg skill install --for claude")
    expect(dialog).toHaveTextContent("tg skill install --for agents")
    await user.click(within(dialog).getByRole("button", { name: "Install all" }))

    expect(await screen.findByText("EACCES: permission denied")).toBeInTheDocument()
    await act(() => useAgents.getState().load(["tg"]))
    expect(screen.getByText("EACCES: permission denied")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Telegram skill for Claude Code: Current" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Install the Telegram skill for Claude Code and Codex" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("data-variant", "primary")
  })
})
