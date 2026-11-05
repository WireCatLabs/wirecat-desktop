import { render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { appMessages } from "@/app/messages"
import { HOME_SECTION } from "@/shared/nav"
import { agent, currentStep, endInstalls, installRow, m, rowBar, skillIn, startOnboarding } from "@/testing/onboarding"
import { useTools } from "../tools/store"
import { useOnboarding } from "./store"

vi.mock("@/platform/mock-delay", () => ({ delay: () => new Promise((r) => setTimeout(r, 0)) }))

afterEach(async () => {
  await endInstalls()
  vi.restoreAllMocks()
})

const am = appMessages.en
const claude = agent("claude-code", "Claude Code")
const setupNav = () => screen.queryByRole("navigation", { name: m.flow.stepsNav })
const homeLink = () =>
  within(screen.getByRole("navigation", { name: am.sectionsNav })).getByRole("button", {
    name: am.nav[HOME_SECTION] ?? HOME_SECTION,
  })

describe("resuming the setup from what the computer has", () => {
  it("opens at Welcome when nothing is set up, and shows no step while it checks", async () => {
    startOnboarding({ start: "fresh", agents: [claude], profiles: {}, skills: {} })

    expect(screen.getByText(m.flow.resuming)).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    await waitFor(() => expect(currentStep()).toBe("welcome"))
    expect(screen.queryByText(m.flow.resuming)).not.toBeInTheDocument()
  })

  it("opens at Sign in after Set up later and a restart, when Telegram is installed and not signed in", async () => {
    const { user } = startOnboarding({
      start: "later",
      reached: "install",
      installed: { tg: "1.0.0" },
      agents: [claude],
      skills: { tg: skillIn("current") },
      profiles: { tg: [{ name: "personal", signedIn: false }] },
    })
    expect(setupNav()).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: am.finishSetup }))

    await waitFor(() => expect(currentStep()).toBe("signin"))
    expect(useOnboarding.getState().status).toBe("later")
  })

  it("opens at Agents when a tool is installed and no agent has its skill yet", async () => {
    startOnboarding({
      start: "fresh",
      installed: { tg: "1.0.0" },
      agents: [claude],
      skills: { tg: skillIn("missing") },
      profiles: { tg: [{ name: "personal", signedIn: false }] },
    })

    await waitFor(() => expect(currentStep()).toBe("agents"))
  })

  it("closes the setup and opens the home page when everything is already done", async () => {
    startOnboarding({
      start: "fresh",
      installed: { tg: "1.0.0" },
      agents: [claude],
      skills: { tg: skillIn("current") },
      profiles: { tg: [{ name: "personal", signedIn: true }] },
    })

    await waitFor(() => expect(setupNav()).not.toBeInTheDocument())
    expect(homeLink()).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("button", { name: am.finishSetup })).not.toBeInTheDocument()
    expect(useOnboarding.getState().status).toBe("done")
  })

  it("says so on Done when the owner presses Finish setup and nothing is left", async () => {
    const { user } = startOnboarding({
      start: "later",
      installed: { tg: "1.0.0" },
      agents: [claude],
      skills: { tg: skillIn("current") },
      profiles: { tg: [{ name: "personal", signedIn: true }] },
    })

    await user.click(screen.getByRole("button", { name: am.finishSetup }))

    await waitFor(() => expect(currentStep()).toBe("done"))
  })

  it("opens at Install with the progress when an install started on the Tools page is still running", async () => {
    const { user, npm } = startOnboarding({ start: "later", reached: "choose", profiles: {}, skills: {} })
    void useTools.getState().install("drive")
    await npm.whenStarted("drive")
    await npm.lookUp("drive", 3)

    await user.click(screen.getByRole("button", { name: am.finishSetup }))

    await waitFor(() => expect(currentStep()).toBe("install"))
    expect(within(installRow("Google Drive")).getByRole("progressbar")).toBeInTheDocument()
    expect(rowBar("Google Drive")).not.toBeNull()
  })
})

describe("starting the app", () => {
  const restart = async (saved: object | null) => {
    localStorage.clear()
    if (saved) localStorage.setItem("wirecat.onboarding", JSON.stringify({ state: saved, version: 0 }))
    await useOnboarding.persist.rehydrate()
  }

  it("never shows the setup again once it was finished", async () => {
    await restart({ status: "done", reached: "done" })
    expect(useOnboarding.getState()).toMatchObject({ open: false, resuming: false })

    render(<App />)

    expect(setupNav()).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: am.finishSetup })).not.toBeInTheDocument()
  })

  it("keeps the setup closed after Set up later, with Finish setup in the sidebar", async () => {
    await restart({ status: "later", reached: "signin" })
    expect(useOnboarding.getState()).toMatchObject({ open: false, resuming: false, reached: "signin" })
  })

  it("reads the computer before the first step on a setup never finished", async () => {
    await restart(null)
    expect(useOnboarding.getState()).toMatchObject({ status: "new", open: true, resuming: true, reached: "welcome" })
  })
})
