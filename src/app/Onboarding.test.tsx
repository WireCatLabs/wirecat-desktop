import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAgents } from "@/features/agents/store"
import { useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const stored = () => JSON.parse(localStorage.getItem("wirecat.onboarding") ?? "{}").state?.status

describe("First start", () => {
  beforeEach(() => {
    localStorage.clear()
    useOnboarding.setState({ status: "new", open: true, step: "welcome", chosen: [] })
  })

  // Before the install test below: the mock keeps Google Drive installed from then on.
  it("speaks Russian when the language is switched", async () => {
    const user = userEvent.setup()
    useLanguage.setState({ choice: "ru" })
    useOnboarding.setState({ step: "choose" })
    render(<App />)

    expect(screen.getByRole("heading", { level: 1, name: "Выберите инструменты" })).toBeInTheDocument()
    await user.click(await screen.findByRole("checkbox", { name: /Google Drive/ }))
    expect(await screen.findByRole("button", { name: "Установить 1 инструмент" })).toBeInTheDocument()
  })

  it("offers an agent to fix a failed install, and the prompt to copy when the agent cannot start", async () => {
    vi.spyOn(platform, "install").mockImplementation(async (_id, onEvent) => {
      onEvent({ event: "failed", reason: "disk", message: "ENOSPC", hint: null })
    })
    const fix = vi.spyOn(platform, "runAgent").mockResolvedValue({
      started: false,
      agent: "claude",
      file: "",
      reason: "missing",
      message: null,
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Get started" }))
    await screen.findByText("Ready to install WireCat tools.")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(await screen.findByRole("checkbox", { name: /Google Drive/ }))
    await user.click(screen.getByRole("button", { name: "Install 1 tool" }))

    await user.click(await screen.findByRole("button", { name: "Fix" }, { timeout: 8000 }))
    const panel = await screen.findByRole("region", { name: "Fix with an AI agent" })
    await user.click(await within(panel).findByRole("button", { name: "Open Claude Code" }))
    expect(fix.mock.calls[0]?.[0]).toBe("claude")
    expect(fix.mock.calls[0]?.[1]).toMatch(/failed while installing Google Drive/)
    expect(await within(panel).findByText("Could not start Claude Code.")).toBeInTheDocument()
    expect(fix.mock.calls[0]?.[1]).toMatch(/Error: There is not enough free space/)
    expect(within(panel).getByText(/Paste this into any AI agent/)).toBeInTheDocument()
    vi.restoreAllMocks()
    useTools.setState({ sessions: {} })
  }, 20000)

  it("installs the chosen tool, then lands on Tools and is not shown again", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to WireCat" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Get started" }))
    expect(await screen.findByText("Ready to install WireCat tools.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1))
    const drive = screen.getByRole("checkbox", { name: /Google Drive/ })
    expect(drive).not.toBeChecked()
    await user.click(drive)
    await user.click(screen.getByRole("button", { name: "Install 1 tool" }))

    const progress = await screen.findByRole("list", { name: "Installing" })
    expect(screen.getByRole("progressbar", { name: "Progress of all installs" })).toBeInTheDocument()
    const tips = screen.getByRole("region", { name: "While you wait" })
    expect(within(tips).getByText("Your agent runs the tools for you")).toBeInTheDocument()
    await user.click(within(tips).getByRole("button", { name: "Next tip" }))
    expect(await within(tips).findByText("Your documents, as text")).toBeInTheDocument()
    expect(await within(progress).findByText("0.30.0", {}, { timeout: 8000 })).toBeInTheDocument()
    expect(await screen.findByText(/see the new tools only after you restart them/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    const signIn = screen.getByRole("list", { name: "Tools to sign in to" })
    expect(await within(signIn).findByText("Google Drive")).toBeInTheDocument()
    const telegram = await within(signIn).findByRole("list", { name: "Telegram accounts" })
    expect(within(telegram).getByText(/Signed in as profile/)).toHaveTextContent("Signed in as profile personal")
    await user.click(within(telegram).getByRole("button", { name: "Sign in" }))
    const dialog = await screen.findByRole("dialog", { name: "Sign in to Telegram" })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sign in to Telegram" })).toBeNull())
    const driveSignIn = within(signIn).getByRole("heading", { name: "Google Drive" }).closest("li") as HTMLElement
    await user.click(await within(driveSignIn).findByRole("button", { name: "Add another account" }))
    expect(within(driveSignIn).getByRole("textbox", { name: "Account name, Google Drive" })).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Open Tools" }))

    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    expect(stored()).toBe("done")
    expect(screen.queryByRole("button", { name: "Finish setup" })).not.toBeInTheDocument()
  }, 15000)

  it("names the chosen tools on the Agents step before the installed ones are found", () => {
    useOnboarding.setState({ step: "agents", chosen: ["tg"] })
    render(<App />)

    const table = screen.getByRole("table", { name: "Skills for agents" })
    expect(within(table).getByRole("rowheader", { name: /Telegram/ })).toBeInTheDocument()
  })

  it("can be put off and picked up again from the sidebar", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Set up later" }))
    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    expect(stored()).toBe("later")

    await user.click(screen.getByRole("button", { name: "Finish setup" }))
    expect(screen.getByRole("navigation", { name: "Setup steps" })).toBeInTheDocument()
  })
})

describe("Help", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows the welcome again without undoing a finished setup", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Help" }))
    await user.click(screen.getByRole("menuitem", { name: "Show the welcome again" }))
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to WireCat" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Set up later" }))

    expect(useOnboarding.getState().status).toBe("done")
    expect(screen.queryByRole("button", { name: "Finish setup" })).not.toBeInTheDocument()
  })

  it("walks through the window and closes with Escape", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("list", { name: "WireCat tools" })

    const help = screen.getByRole("button", { name: "Help" })
    await user.click(help)
    await user.click(screen.getByRole("menuitem", { name: "Take the tour" }))

    const first = await screen.findByRole("dialog", { name: "Status lamps" })
    expect(within(first).getByRole("button", { name: "Next" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog", { name: "One action per tool" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(help).toHaveFocus()
  })
})

describe("Connect agents step", () => {
  const copy = { path: "~/bin/tg", version: "1.0.0", manager: "npm", problem: null }
  const agent = (id: string, name: string, reads: ("claude" | "agents")[], found: boolean) => ({
    id,
    name,
    foundBy: found ? ("program" as const) : null,
    reads,
  })

  beforeEach(async () => {
    // An earlier test's skill check still answering would overwrite the answers spied on here.
    await waitFor(() => expect(useAgents.getState().refreshing).toBe(false), { timeout: 4000 })
    localStorage.clear()
    useOnboarding.setState({ status: "new", open: true, step: "agents", chosen: [] })
    useTools.setState({
      installs: { tg: [copy], max: [], wa: [], zm: [], drive: [], memo: [] },
      checked: true,
      refresh: async () => undefined,
    })
    useAgents.setState(useAgents.getInitialState(), true)
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
    useTools.setState(useTools.getInitialState(), true)
  })

  it("heads one column for Cursor when it is the only agent found, though it reads both folders", async () => {
    vi.spyOn(platform, "detectAgents").mockResolvedValue([
      agent("claude", "Claude Code", ["claude"], false),
      agent("cursor", "Cursor", ["agents", "claude"], true),
    ])
    render(<App />)
    const table = screen.getByRole("table", { name: "Skills for agents" })
    await waitFor(
      () =>
        expect(
          within(table)
            .getAllByRole("columnheader")
            .map((h) => h.textContent),
        ).toEqual(["Tool", "Cursor"]),
      { timeout: 4000 },
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

    const all = await screen.findByRole(
      "button",
      { name: "Install the Telegram skill for Claude Code and Codex" },
      { timeout: 4000 },
    )
    expect(screen.getByRole("button", { name: "Install the Telegram skill for Codex" })).toHaveAttribute(
      "data-variant",
      "primary",
    )
    await user.click(all)
    const dialog = await screen.findByRole("dialog", { name: "Install the Telegram skill for Claude Code and Codex?" })
    expect(dialog).toHaveTextContent("tg skill install --for claude")
    expect(dialog).toHaveTextContent("tg skill install --for agents")
    await user.click(within(dialog).getByRole("button", { name: "Install all" }))

    expect(await screen.findByText("EACCES: permission denied", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Telegram skill for Claude Code: Current" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Install the Telegram skill for Claude Code and Codex" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("data-variant", "primary")
  }, 15000)
})
