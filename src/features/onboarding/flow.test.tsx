import { render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { appMessages } from "@/app/messages"
import { runMockScenario } from "@/app/scenarios"
import {
  currentStep,
  endInstalls,
  m,
  noNodeComputer,
  primaryButton,
  progressOf,
  readyComputer,
  sidebarStep,
  sm,
  startOnboarding,
} from "@/testing/onboarding"
import { uiMessages } from "@/ui/messages"
import { useOnboarding } from "./store"

// Every answer the mock gives comes at once; the tests wait only for what they drive.
vi.mock("@/platform/mock-delay", () => ({ delay: () => new Promise((r) => setTimeout(r, 0)) }))

afterEach(async () => {
  await endInstalls()
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/")
})

const ui = uiMessages.en

/** The managed Node.js setup's step in this state, by the words a screen reader hears after its label. */
function nodeStepIn(state: string): string | undefined {
  const region = screen.getByRole("region", { name: sm.nodeForTools })
  const item = within(region)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.endsWith(state))
  return item?.textContent?.slice(0, -state.length)
}

const heading = () => screen.getByRole("heading", { level: 1 })
const KEY = "wirecat.onboarding"
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "{}").state?.status

/** A new start of the app: the store begins from scratch and reads what the last run saved. */
async function restart() {
  const saved = localStorage.getItem(KEY)
  useOnboarding.setState(useOnboarding.getInitialState(), true)
  if (saved) localStorage.setItem(KEY, saved)
  await useOnboarding.persist.rehydrate()
}

describe("walking the setup", () => {
  it("goes welcome, your computer, choose, install, agents, sign in, done, and back again", async () => {
    const { user } = startOnboarding()
    expect(currentStep()).toBe("welcome")
    expect(heading()).toHaveTextContent(m.pages.welcome.title)
    expect(screen.queryByRole("button", { name: m.flow.back })).not.toBeInTheDocument()

    await user.click(primaryButton(m.flow.getStarted))
    expect(currentStep()).toBe("computer")
    expect(heading()).toHaveTextContent(m.pages.computer.title)

    await user.click(primaryButton(m.flow.continue))
    expect(screen.getByRole("navigation", { name: m.flow.stepsNav })).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Google Drive/ }))
    await user.click(primaryButton(m.flow.installTools(1)))
    expect(currentStep()).toBe("install")

    for (const step of ["agents", "signin", "done"] as const) {
      await user.click(primaryButton(m.flow.continue))
      expect(currentStep()).toBe(step)
      expect(heading()).toHaveTextContent(m.pages[step].title)
    }

    for (const step of ["signin", "agents", "install", "choose", "computer", "welcome"] as const) {
      await user.click(screen.getByRole("button", { name: m.flow.back }))
      expect(currentStep()).toBe(step)
    }
  })

  it("moves focus to the new step's heading, so a screen reader announces it", async () => {
    const { user } = startOnboarding()
    await user.click(primaryButton(m.flow.getStarted))
    expect(heading()).toHaveFocus()
  })

  it("goes from Choose to Agents when nothing is chosen, as Continue and as Skip", async () => {
    const { user } = startOnboarding({ step: "choose" })
    await user.click(primaryButton(m.flow.continue))
    expect(currentStep()).toBe("agents")

    useOnboarding.setState({ step: "choose", chosen: ["drive"] })
    await user.click(await screen.findByRole("button", { name: m.flow.skip }))
    expect(currentStep()).toBe("agents")
  })

  it("offers Skip only where a step can be left out", async () => {
    startOnboarding()
    for (const step of ["welcome", "computer", "choose", "install", "agents", "signin", "done"] as const) {
      useOnboarding.setState({ step })
      const skip = await waitFor(() => {
        expect(currentStep()).toBe(step)
        return screen.queryByRole("button", { name: m.flow.skip })
      })
      if (step === "welcome" || step === "computer" || step === "done") expect(skip, step).toBeNull()
      else expect(skip, step).not.toBeNull()
    }
  })

  it("lets the sidebar open any step once the computer is ready", async () => {
    const { user } = startOnboarding({ computer: readyComputer })
    await user.click(sidebarStep("signin"))
    expect(currentStep()).toBe("signin")
    await user.click(sidebarStep("computer"))
    expect(currentStep()).toBe("computer")
  })

  it("keeps the sidebar from jumping past Your computer while Node.js is missing", async () => {
    const { user } = startOnboarding({ computer: noNodeComputer })
    await user.click(sidebarStep("choose"))
    expect(currentStep()).toBe("welcome")
    expect(sidebarStep("install")).toHaveAttribute("aria-disabled", "true")
    expect(sidebarStep("computer")).not.toHaveAttribute("aria-disabled")

    await user.click(sidebarStep("computer"))
    expect(currentStep()).toBe("computer")
    await user.click(screen.getByRole("button", { name: sm.installMyself }))
    expect(sidebarStep("install")).not.toHaveAttribute("aria-disabled")
    await user.click(sidebarStep("install"))
    expect(currentStep()).toBe("install")
  })
})

describe("the Node.js gate on Your computer", () => {
  const continueButton = () => primaryButton(m.flow.continue)

  it("holds Continue while the computer is checked, and opens when it is ready", async () => {
    const { facts } = startOnboarding({ step: "computer", computer: null })
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")
    expect(continueButton()).toHaveAccessibleDescription(m.flow.blockedChecking)
    facts.current = readyComputer
    await waitFor(() => expect(continueButton()).not.toHaveAttribute("aria-disabled"))
    expect(continueButton()).not.toHaveAccessibleDescription()
  })

  it("holds Continue without Node.js and says why; a click does nothing", async () => {
    const { user } = startOnboarding({ step: "computer", computer: noNodeComputer })
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")
    expect(continueButton()).toHaveAccessibleDescription(m.flow.blockedNode)
    await user.click(continueButton())
    expect(currentStep()).toBe("computer")
  })

  it("holds Continue when npm needs administrator rights", () => {
    startOnboarding({ step: "computer", computer: { ...readyComputer, npmPrefixWritable: false } })
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByText(sm.adminTitle)).toBeInTheDocument()
  })

  it("lets the owner go on when he installs Node.js himself, and holds again if he changes his mind", async () => {
    const { user } = startOnboarding({ step: "computer", computer: noNodeComputer })
    const myself = screen.getByRole("button", { name: sm.installMyself })
    await user.click(myself)
    expect(myself).toHaveAttribute("aria-expanded", "true")
    expect(continueButton()).not.toHaveAttribute("aria-disabled")
    await user.click(myself)
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")
  })

  it("walks the managed setup through check, download, verify, unpack and PATH, then opens Continue", async () => {
    const { user, node } = startOnboarding({ step: "computer", computer: noNodeComputer })
    await user.click(screen.getByRole("button", { name: sm.setUp }))
    expect(node.setup).toHaveBeenCalledOnce()
    expect(continueButton()).toHaveAccessibleDescription(m.flow.blockedSettingUp)

    const active = () => nodeStepIn(ui.stepActive)
    node.send({ event: "step", step: "check" })
    expect(active()).toBe(sm.steps.check)

    node.send({ event: "step", step: "download" }, { event: "progress", received: 25, total: 100 })
    expect(active()).toBe(sm.steps.download)
    expect(progressOf(screen.getByRole("progressbar", { name: sm.downloading }))).toBe(25)

    node.send({ event: "step", step: "verify" })
    expect(active()).toBe(sm.steps.verify)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()

    node.send({ event: "step", step: "unpack" }, { event: "progress", received: 3, total: 4 })
    expect(progressOf(screen.getByRole("progressbar", { name: sm.unpacking }))).toBe(75)
    expect(screen.getByText(sm.ofArchive(75))).toBeInTheDocument()

    node.send({ event: "step", step: "path" })
    expect(active()).toBe(sm.steps.path)
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")

    await node.finish()
    await waitFor(() => expect(continueButton()).not.toHaveAttribute("aria-disabled"))
    await user.click(continueButton())
    expect(screen.getByRole("navigation", { name: m.flow.stepsNav })).toBeInTheDocument()
  })

  it("shows a failed setup with its reason and tries again", async () => {
    const { user, node } = startOnboarding({ step: "computer", computer: noNodeComputer })
    await user.click(screen.getByRole("button", { name: sm.setUp }))
    node.send({ event: "step", step: "download" }, { event: "step", step: "verify" })
    await node.fail("The download does not match the checksum.", "Try again later.")

    expect(nodeStepIn(ui.stepFailed)).toBe(sm.steps.verify)
    expect(screen.getByText("The download does not match the checksum.")).toBeInTheDocument()
    expect(screen.getByText("Try again later.")).toBeInTheDocument()
    expect(continueButton()).toHaveAttribute("aria-disabled", "true")
    expect(continueButton()).toHaveAccessibleDescription(m.flow.blockedNode)

    await user.click(screen.getByRole("button", { name: sm.tryAgain }))
    expect(node.setup).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("The download does not match the checksum.")).not.toBeInTheDocument()
  })

  it("cancels the setup and offers the choices again", async () => {
    const { user, node } = startOnboarding({ step: "computer", computer: noNodeComputer })
    await user.click(screen.getByRole("button", { name: sm.setUp }))
    node.send({ event: "step", step: "download" })
    await user.click(screen.getByRole("button", { name: sm.cancel }))

    expect(node.cancel).toHaveBeenCalledOnce()
    expect(await screen.findByRole("button", { name: sm.setUp })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: sm.installMyself })).toBeInTheDocument()
    expect(continueButton()).toHaveAccessibleDescription(m.flow.blockedNode)
  })
})

describe("choosing tools", () => {
  it("counts the chosen tools on the Install button and goes back to Continue when none is left", async () => {
    const { user } = startOnboarding({ step: "choose", installed: { tg: "0.88.0" } })
    expect(primaryButton(m.flow.continue)).toBeInTheDocument()

    const drive = await screen.findByRole("checkbox", { name: /Google Drive/ })
    await user.click(drive)
    expect(drive).toBeChecked()
    expect(primaryButton(m.flow.installTools(1))).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Zoom/ }))
    expect(primaryButton(m.flow.installTools(2))).toBeInTheDocument()

    await user.click(drive)
    await user.click(screen.getByRole("checkbox", { name: /Zoom/ }))
    expect(drive).not.toBeChecked()
    expect(primaryButton(m.flow.continue)).toBeInTheDocument()
  })

  it("gives an installed tool no checkbox, so it cannot be chosen twice", async () => {
    startOnboarding({ step: "choose", installed: { tg: "0.88.0" } })
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /Telegram/ })).not.toBeInTheDocument())
    expect(screen.getByRole("checkbox", { name: /Google Drive/ })).toBeInTheDocument()
  })

  it("does not count a chosen tool that turns out installed", async () => {
    const { user } = startOnboarding({ step: "choose", chosen: ["tg"], installed: { tg: "0.88.0" } })
    await waitFor(() => expect(primaryButton(m.flow.continue)).toBeInTheDocument())
    await user.click(screen.getByRole("checkbox", { name: /Google Drive/ }))
    expect(primaryButton(m.flow.installTools(1))).toBeInTheDocument()
  })

  it("installs nothing and says so when Install is reached with nothing chosen", async () => {
    const { user, npm } = startOnboarding({ step: "install" })
    expect(screen.getByText(m.install.none)).toBeInTheDocument()
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: m.install.choose }))
    expect(screen.getByRole("navigation", { name: m.flow.stepsNav })).toBeInTheDocument()
    expect(npm.started).toEqual([])
  })

  it("does not install from Choose without Node.js, though tools are chosen", async () => {
    const { user, npm } = startOnboarding({ step: "choose", chosen: ["drive"], computer: noNodeComputer })
    await user.click(primaryButton(m.flow.continue))
    expect(currentStep()).toBe("install")
    expect(npm.started).toEqual([])
    expect(screen.getByRole("region", { name: sm.nodeForTools })).toBeInTheDocument()
  })
})

describe("finishing the setup", () => {
  it("lands on Tools, remembers it, and does not open again on the next start", async () => {
    const { user, view } = startOnboarding({ step: "done" })
    expect(screen.getByText(m.done.moreLater)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: m.flow.openTools }))
    expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument()
    expect(stored()).toBe("done")

    view.unmount()
    await restart()
    render(<App />)
    expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument()
  })

  it("opens the guides from Done, and finishes the setup", async () => {
    const { user } = startOnboarding({ step: "done" })
    await user.click(primaryButton(m.done.guides))
    expect(stored()).toBe("done")
    expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument()
  })

  it("is put off by Set up later and stays closed on the next start, with a way back in", async () => {
    const { user, view } = startOnboarding({ step: "choose" })
    await user.click(screen.getByRole("button", { name: m.flow.later }))
    expect(stored()).toBe("later")

    view.unmount()
    await restart()
    expect(useOnboarding.getState()).toMatchObject({ status: "later", open: false })
    render(<App />)
    expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: appMessages.en.finishSetup }))
    expect(screen.getByRole("navigation", { name: m.flow.stepsNav })).toBeInTheDocument()
  })

  it("stays hidden for one load with ?onboarding=off, without counting as finished", async () => {
    startOnboarding()
    window.history.replaceState(null, "", "/?onboarding=off")
    await runMockScenario()
    await waitFor(() => expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument())
    expect(useOnboarding.getState().status).toBe("new")
  })

  it("opens at a named step with ?onboarding=<step>", async () => {
    useOnboarding.setState({ open: false })
    startOnboarding()
    window.history.replaceState(null, "", "/?onboarding=signin")
    await runMockScenario()
    await waitFor(() => expect(currentStep()).toBe("signin"))
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toHaveTextContent(m.pages.signin.title)
  })
})
