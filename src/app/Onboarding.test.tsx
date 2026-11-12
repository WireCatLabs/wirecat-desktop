import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor, within } from "@/testing/render"
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

    await user.click(await screen.findByRole("button", { name: "Fix" }))
    const panel = await screen.findByRole("region", { name: "Fix with an AI agent" })
    await user.click(await within(panel).findByRole("button", { name: "Open Claude Code" }))
    expect(fix.mock.calls[0]?.[0]).toBe("claude")
    expect(fix.mock.calls[0]?.[1]).toMatch(/failed while installing Google Drive/)
    expect(await within(panel).findByText("Could not start Claude Code.")).toBeInTheDocument()
    expect(fix.mock.calls[0]?.[1]).toMatch(/Error:\n```\nThere is not enough free space/)
    expect(within(panel).getByText(/Paste this into any AI agent/)).toBeInTheDocument()
    vi.restoreAllMocks()
    useTools.setState({ sessions: {} })
  })

  it("installs the chosen tool, then lands on Tools and is not shown again", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to WireCat" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Get started" }))
    expect(await screen.findByText("Ready to install WireCat tools.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(4))
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
    expect(await within(progress).findByText("0.30.0")).toBeInTheDocument()
    expect(await screen.findByText(/see the new tools only after you restart them/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    const signIn = screen.getByRole("list", { name: "Tools to sign in to" })
    expect(await within(signIn).findByText("Google Drive")).toBeInTheDocument()
    const telegram = await within(signIn).findByRole("list", { name: "Telegram accounts" })
    const personal = within(telegram).getByRole("listitem", { name: "Telegram account personal" })
    expect(within(personal).getByText("signed in")).toBeInTheDocument()
    await user.click(within(telegram).getByRole("button", { name: "Reconnect" }))
    const dialog = await screen.findByRole("dialog", { name: "Sign in to Telegram" })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sign in to Telegram" })).toBeNull())
    const driveAccounts = await within(signIn).findByRole("list", { name: "Google Drive accounts" })
    const driveSignIn = driveAccounts.closest("li") as HTMLElement
    await user.click(within(driveSignIn).getByRole("button", { name: "Add another account" }))
    expect(within(driveSignIn).getByRole("textbox", { name: "Account name, Google Drive" })).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Open Tools" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    expect(stored()).toBe("done")
    expect(screen.queryByRole("button", { name: "Finish setup" })).not.toBeInTheDocument()
  })

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
    expect(await screen.findByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
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

    const first = await screen.findByRole("dialog", { name: "Tools" })
    expect(within(first).getByRole("button", { name: "Next" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog", { name: "Status lamps" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(help).toHaveFocus()
  })
})
