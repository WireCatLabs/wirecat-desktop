import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useTools } from "@/shared/tools-store"
import {
  agent,
  currentStep,
  endInstalls,
  type FakeInstaller,
  fm,
  installRow,
  m,
  overviewBar,
  pm,
  primaryButton,
  progressOf,
  rowBar,
  startOnboarding,
} from "@/testing/onboarding"
import { act, fireEvent, render, screen, waitFor, within } from "@/testing/render"
import { MOTION } from "@/ui/motion"
import { failureWordsEn } from "../tools/failure-words"
import { preflightMessages } from "../tools/messages-preflight"
import { InstallTips } from "./InstallWait"

afterEach(async () => {
  vi.useRealTimers()
  await endInstalls()
  vi.restoreAllMocks()
})

const DRIVE = "Google Drive"
const sm = preflightMessages.en

/** Opens Choose with these tools ticked and presses Install, as the owner does. */
async function installFromChoose(chosen: string[], opts: Parameters<typeof startOnboarding>[0] = {}) {
  const started = startOnboarding({ step: "choose", chosen, ...opts })
  await started.user.click(primaryButton(m.flow.installTools(chosen.length)))
  expect(currentStep()).toBe("install")
  return started
}

/** Every value the overview showed, so a test can say it never went back. */
function track(read: () => number) {
  const seen: number[] = []
  return {
    seen,
    take() {
      const v = read()
      seen.push(v)
      return v
    },
  }
}

const nonDecreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x >= (xs[i - 1] as number))

describe("one tool installing", () => {
  it("shows the same percent in its row as in the overview, and neither goes back", async () => {
    const { npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    const overview = track(() => progressOf(overviewBar()))
    const agree = async () => {
      await waitFor(() => expect(rowBar(DRIVE)).not.toBeNull())
      expect(progressOf(rowBar(DRIVE) as HTMLElement)).toBe(overview.take())
    }

    const steps: ((n: FakeInstaller) => unknown)[] = [
      (n) => n.check("drive"),
      (n) => n.lookUp("drive", 30),
      (n) => n.lookUp("drive", 60),
      (n) => n.download("drive", 0, 10),
      (n) => n.download("drive", 4, 10),
      (n) => n.download("drive", 9, 10),
      (n) => n.download("drive", 10, 10),
      (n) => n.added("drive", 10),
      (n) => n.verify("drive"),
    ]
    for (const step of steps) {
      await step(npm)
      await agree()
    }
    expect(overview.seen[0]).toBeLessThan(overview.seen.at(-1) as number)
    expect(nonDecreasing(overview.seen)).toBe(true)

    await npm.finish("drive", "0.30.0")
    await waitFor(() => expect(progressOf(overviewBar())).toBe(100))
    expect(within(installRow(DRIVE)).getByText(/0\.30\.0/)).toBeInTheDocument()
    // The finished bar stays full for a moment before it folds away.
    expect(progressOf(rowBar(DRIVE) as HTMLElement)).toBe(100)
    await waitFor(() => expect(rowBar(DRIVE)).toBeNull(), { timeout: MOTION.hold + MOTION.slow + 1000 })
  })

  it("names the tool, its place in the batch and a time estimate", async () => {
    const { npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.check("drive")
    const text = () => overviewBar().getAttribute("aria-valuetext") ?? ""
    expect(text()).toContain(`${m.wait.installing(DRIVE)} · ${m.wait.of(1, 1)}`)
    expect(text()).toContain(m.wait.typical)

    await npm.lookUp("drive", 10)
    await npm.download("drive", 5, 10)
    const estimates = [m.wait.left.almost, m.wait.left.underMinute, m.wait.left.minutes(1), m.wait.left.minutes(2)]
    expect(estimates.some((e) => text().includes(e))).toBe(true)
  })

  it("says everything is installed, that more can be installed later, and to restart open apps", async () => {
    const { npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    expect(screen.getByText(m.install.note)).toBeInTheDocument()
    expect(screen.queryByText(m.wait.restart)).not.toBeInTheDocument()

    await npm.finish("drive", "0.30.0", 'export PATH="$HOME/.local/bin:$PATH"')
    expect(await screen.findByText(new RegExp(m.install.moreLater))).toBeInTheDocument()
    expect(screen.getByText(m.wait.restart)).toBeInTheDocument()
    expect(screen.getByText('export PATH="$HOME/.local/bin:$PATH"')).toBeInTheDocument()
  })
})

describe("several tools installing", () => {
  it("installs one at a time in the order they are listed, counting n of N, and the overview never goes back", async () => {
    // Ticked in the opposite order to the list on screen.
    const { npm } = await installFromChoose(["drive", "tg"])
    await waitFor(() => expect(npm.started).toHaveLength(1))
    const [first] = npm.started as [string]
    const second = first === "tg" ? "drive" : "tg"
    const name = (id: string) => (id === "tg" ? "Telegram" : DRIVE)
    const text = () => overviewBar().getAttribute("aria-valuetext") ?? ""
    const overview = track(() => progressOf(overviewBar()))

    await npm.check(first)
    expect(text()).toContain(`${m.wait.installing(name(first))} · ${m.wait.of(1, 2)}`)
    expect(within(installRow(name(second))).getByText(m.install.queued)).toBeInTheDocument()
    overview.take()
    await npm.lookUp(first, 40)
    overview.take()
    await npm.download(first, 10, 10)
    overview.take()
    await npm.finish(first)
    await npm.whenStarted(second)
    expect(npm.isRunning(first)).toBe(false)
    overview.take()

    await npm.check(second)
    expect(text()).toContain(`${m.wait.installing(name(second))} · ${m.wait.of(2, 2)}`)
    overview.take()
    await npm.download(second, 3, 10)
    overview.take()
    await npm.finish(second)
    await waitFor(() => expect(overview.take()).toBe(100))
    expect(nonDecreasing(overview.seen)).toBe(true)
  })
})

describe("a tool that fails to install", () => {
  it("says it did not install, why and what to do, offers Fix, and keeps the batch below 100%", async () => {
    const { npm } = await installFromChoose(["drive", "tg"])
    await waitFor(() => expect(npm.started).toHaveLength(1))
    const failing = npm.started[0] as string
    const other = failing === "tg" ? "drive" : "tg"
    const failingName = failing === "tg" ? "Telegram" : DRIVE

    await npm.fail(failing, "network", "getaddrinfo ENOTFOUND registry.npmjs.org")
    await npm.whenStarted(other)
    await npm.finish(other)

    const row = installRow(failingName)
    const [error, hint] = failureWordsEn(
      { event: "failed", reason: "network", message: "", hint: null },
      "install",
    ) as [string, string]
    expect(within(row).getByText(m.install.notInstalledFailed)).toBeInTheDocument()
    expect(within(row).getByText(error)).toBeInTheDocument()
    expect(within(row).getByText(hint)).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: fm.fix })).toHaveAttribute("aria-expanded", "false")
    expect(within(row).getByRole("button", { name: m.install.tryAgain })).toBeInTheDocument()

    await waitFor(() => expect(overviewBar().getAttribute("aria-valuetext")).toContain(m.wait.failed(1)))
    expect(progressOf(overviewBar())).toBe(50)
    expect(screen.queryByText(new RegExp(m.install.allDone))).not.toBeInTheDocument()
  })

  it.each(["disk", "proxy", "longPath"])("names the %s failure in its own words", async (reason) => {
    const { npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.fail("drive", reason, "raw npm output")
    const [error, hint] = failureWordsEn({ event: "failed", reason, message: "", hint: null } as never, "install")
    const row = installRow(DRIVE)
    expect(within(row).getByText(error)).toBeInTheDocument()
    expect(within(row).getByText(hint as string)).toBeInTheDocument()
    expect(within(row).queryByText("raw npm output")).not.toBeInTheDocument()
  })

  it("installs on Try again after the network came back", async () => {
    const { user, npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.fail("drive", "network")
    await user.click(within(installRow(DRIVE)).getByRole("button", { name: m.install.tryAgain }))
    await npm.whenStarted("drive")
    expect(npm.started).toEqual(["drive", "drive"])
    expect(within(installRow(DRIVE)).queryByText(m.install.notInstalledFailed)).not.toBeInTheDocument()

    await npm.finish("drive", "0.30.0")
    await waitFor(() => expect(progressOf(overviewBar())).toBe(100))
    expect(within(installRow(DRIVE)).getByText(/0\.30\.0/)).toBeInTheDocument()
  })
})

describe("the store check before installing", () => {
  const cannotOpen = { drive: { version: "0.30.0", known: true, cannotOpen: { speaks: 31, needs: 32 } } }

  it("warns inside the Install step when the tool cannot open the store, and installs on Install anyway", async () => {
    const { user, npm } = await installFromChoose(["drive"], { preflight: cannotOpen })
    const alert = await within(installRow(DRIVE)).findByRole("alert")
    expect(alert).toHaveTextContent(sm.title("install", `${DRIVE} 0.30.0`))
    expect(within(installRow(DRIVE)).getByText(m.install.asked)).toBeInTheDocument()
    expect(overviewBar().getAttribute("aria-valuetext")).toBe(m.install.asked)
    expect(within(alert).getByRole("button", { name: sm.notNow })).toHaveFocus()
    expect(npm.started).toEqual([])

    await user.click(within(alert).getByRole("button", { name: sm.anyway("install") }))
    await npm.whenStarted("drive")
    await waitFor(() => expect(primaryButton(m.flow.continue)).toHaveFocus())
  })

  it("does not tell later steps that a tool waiting for the answer is still installing", async () => {
    const { user } = await installFromChoose(["drive"], { preflight: cannotOpen })
    await within(installRow(DRIVE)).findByRole("alert")
    await user.click(primaryButton(m.flow.continue))
    expect(currentStep()).toBe("agents")
    expect(screen.queryByText(new RegExp(pm.still(DRIVE, "", 0)))).not.toBeInTheDocument()
  })

  it("leaves the tool out on Not now and asks again on Install the rest", async () => {
    const { user, npm } = await installFromChoose(["drive"], { preflight: cannotOpen })
    const alert = await within(installRow(DRIVE)).findByRole("alert")
    await user.click(within(alert).getByRole("button", { name: sm.notNow }))
    await waitFor(() => expect(within(installRow(DRIVE)).getByText(m.install.notInstalled)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole("button", { name: m.install.rest })).toHaveFocus())
    expect(npm.started).toEqual([])

    await user.click(screen.getByRole("button", { name: m.install.rest }))
    expect(await within(installRow(DRIVE)).findByRole("alert")).toBeInTheDocument()
  })

  it("updates an installed tool alongside without asking, and says so under the progress", async () => {
    const { npm } = await installFromChoose(["drive"], {
      installed: { tg: "0.88.0" },
      preflight: { drive: { known: true, alsoUpdate: [{ id: "tg", version: "0.89.0" }] } },
    })
    await npm.whenStarted("drive")
    expect(within(installRow(DRIVE)).queryByRole("alert")).not.toBeInTheDocument()
    expect(await within(installRow(DRIVE)).findByText(sm.alongside("Telegram", false))).toBeInTheDocument()
    expect(npm.isRunning("tg")).toBe(false)

    await npm.finish("drive")
    await npm.whenStarted("tg")
  })

  it("asks a tool's check on its turn, after the tool before it installed", async () => {
    const { npm } = await installFromChoose(["tg", "max"])
    const asked = vi.mocked(platform.storePreflight)
    const installsWhenAsked: Record<string, string | null | undefined> = {}
    const answer = asked.getMockImplementation()
    asked.mockImplementation(async (id) => {
      installsWhenAsked[id] = useTools.getState().installs.tg?.[0]?.version
      return answer ? answer(id) : Promise.reject(new Error("no answer"))
    })
    await npm.whenStarted("tg")
    expect(asked.mock.calls.map(([id]) => id)).toEqual(["tg"])

    await npm.finish("tg", "0.89.0")
    await npm.whenStarted("max")
    expect(asked.mock.calls.map(([id]) => id)).toEqual(["tg", "max"])
    expect(installsWhenAsked.max).toBe("0.89.0")
  })

  it("holds a tool whose check warns and installs the next one meanwhile", async () => {
    const { npm } = await installFromChoose(["tg", "max", "drive"], {
      preflight: { max: { version: "0.75.0", known: true, cannotOpen: { speaks: 31, needs: 32 } } },
    })
    await npm.finish("tg")
    expect(await within(installRow("MAX")).findByRole("alert")).toBeInTheDocument()
    await npm.whenStarted("drive")
    expect(npm.started).toEqual(["tg", "drive"])
  })
})

describe("the Fix panel under a failed install", () => {
  const failDrive = async (agents: ReturnType<typeof agent>[]) => {
    const started = await installFromChoose(["drive"], { agents })
    await started.npm.whenStarted("drive")
    await started.npm.fail("drive", "disk", "ENOSPC")
    const row = installRow(DRIVE)
    await started.user.click(within(row).getByRole("button", { name: fm.fix }))
    const panel = await within(row).findByRole("region", { name: fm.panel })
    return { ...started, panel }
  }

  it("opens a found agent with a prompt about this install", async () => {
    const run = vi
      .spyOn(platform, "runAgent")
      .mockResolvedValue({ started: true, agent: "claude", file: "/tmp/p", reason: null, message: null })
    const { user, panel } = await failDrive([agent("claude", "Claude Code"), agent("cursor", "Cursor")])
    expect(within(installRow(DRIVE)).getByRole("button", { name: fm.fix })).toHaveAttribute("aria-expanded", "true")
    expect(within(panel).queryByRole("button", { name: fm.open("Cursor") })).not.toBeInTheDocument()

    await user.click(await within(panel).findByRole("button", { name: fm.open("Claude Code") }))
    expect(run).toHaveBeenCalledWith("claude", expect.stringContaining(DRIVE))
    expect(await within(panel).findByText(fm.started("Claude Code"))).toBeInTheDocument()
  })

  it("says why the agent did not start and opens Do it yourself with the prompt", async () => {
    vi.spyOn(platform, "runAgent").mockResolvedValue({
      started: false,
      agent: "claude",
      file: "",
      reason: "terminal",
      message: null,
    })
    const { user, panel } = await failDrive([agent("claude", "Claude Code")])
    const yourself = within(panel).getByRole("button", { name: fm.yourself })
    expect(yourself).toHaveAttribute("aria-expanded", "false")

    await user.click(await within(panel).findByRole("button", { name: fm.open("Claude Code") }))
    expect(await within(panel).findByText(fm.failed("Claude Code"))).toBeInTheDocument()
    expect(within(panel).getByText(fm.why.terminal)).toBeInTheDocument()
    expect(yourself).toHaveAttribute("aria-expanded", "true")
    expect(within(panel).getByText(/There is not enough free space/)).toBeInTheDocument()
  })

  it("opens Do it yourself at once when no agent can be started", async () => {
    const { panel } = await failDrive([])
    expect(await within(panel).findByText(fm.none)).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: fm.yourself })).toHaveAttribute("aria-expanded", "true")
  })
})

describe("leaving Install before it is done", () => {
  it("keeps installing, says so on later steps, and stops saying it once done", async () => {
    const { user, npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.lookUp("drive", 20)
    await npm.download("drive", 5, 10)
    const pct = progressOf(overviewBar())

    await user.click(primaryButton(m.flow.continue))
    expect(currentStep()).toBe("agents")
    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent(pm.still(DRIVE, pm.percent(pct), 0))

    await user.click(primaryButton(m.flow.continue))
    expect(currentStep()).toBe("signin")
    expect(screen.getByRole("status")).toHaveTextContent(pm.still(DRIVE, pm.percent(pct), 0))
    expect(npm.isRunning("drive")).toBe(true)
    expect(platform.cancelInstall).not.toHaveBeenCalled()

    await npm.finish("drive")
    await waitFor(() => expect(screen.queryByText(new RegExp(pm.still(DRIVE, "", 0)))).not.toBeInTheDocument())
  })

  it("shows the same progress on the Tools page, until it is done", async () => {
    const { user, npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.lookUp("drive", 20)
    await npm.download("drive", 6, 10)
    const pct = progressOf(overviewBar())

    await user.click(screen.getByRole("button", { name: m.flow.later }))
    const bar = await screen.findByRole("progressbar", { name: pm.labelFor(DRIVE) })
    expect(progressOf(bar)).toBe(pct)
    await npm.download("drive", 8, 10)
    await waitFor(() => expect(progressOf(bar)).toBeGreaterThan(pct))

    await npm.finish("drive")
    await waitFor(() => expect(screen.queryByRole("progressbar", { name: pm.labelFor(DRIVE) })).not.toBeInTheDocument())
  })

  it("shows Install's progress again on return, where it left off", async () => {
    const { user, npm } = await installFromChoose(["drive"])
    await npm.whenStarted("drive")
    await npm.lookUp("drive", 20)
    await npm.download("drive", 5, 10)
    const pct = progressOf(overviewBar())
    await user.click(primaryButton(m.flow.continue))
    await user.click(screen.getByRole("button", { name: m.flow.back }))
    expect(currentStep()).toBe("install")
    expect(progressOf(overviewBar())).toBe(pct)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})

describe("tips while installing", () => {
  const busy = () =>
    useTools.setState({
      sessions: { drive: { operation: "install", step: "install", log: [], outcome: null, began: { check: 0 } } },
    })
  const tipOf = (region: HTMLElement) => within(region).getByText(/^\d+ \/ \d+$/).textContent

  it("turn every few seconds, stop while the pointer or focus is on them, and turn by hand", () => {
    vi.useFakeTimers()
    busy()
    render(<InstallTips chosen={["drive"]} />)
    const tips = screen.getByRole("region", { name: m.wait.hints })
    expect(tipOf(tips)).toBe(m.wait.hintOf(1, 5))
    expect(within(tips).getByText(m.wait.tips.agents.title)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(9_000))
    expect(tipOf(tips)).toBe(m.wait.hintOf(2, 5))
    expect(within(tips).getByText(m.wait.tips.drive.title)).toBeInTheDocument()

    fireEvent.pointerEnter(tips)
    act(() => vi.advanceTimersByTime(30_000))
    expect(tipOf(tips)).toBe(m.wait.hintOf(2, 5))
    fireEvent.pointerLeave(tips)
    act(() => vi.advanceTimersByTime(9_000))
    expect(tipOf(tips)).toBe(m.wait.hintOf(3, 5))

    fireEvent.focus(within(tips).getByRole("button", { name: m.wait.next }))
    act(() => vi.advanceTimersByTime(30_000))
    expect(tipOf(tips)).toBe(m.wait.hintOf(3, 5))

    fireEvent.click(within(tips).getByRole("button", { name: m.wait.previous }))
    expect(tipOf(tips)).toBe(m.wait.hintOf(2, 5))
    fireEvent.click(within(tips).getByRole("button", { name: m.wait.next }))
    fireEvent.click(within(tips).getByRole("button", { name: m.wait.next }))
    fireEvent.click(within(tips).getByRole("button", { name: m.wait.next }))
    fireEvent.click(within(tips).getByRole("button", { name: m.wait.next }))
    expect(tipOf(tips)).toBe(m.wait.hintOf(1, 5))
    useTools.setState({ sessions: {} })
  })

  it("are not shown when nothing installs", () => {
    useTools.setState({ sessions: {} })
    render(<InstallTips chosen={["drive"]} />)
    expect(screen.queryByRole("region", { name: m.wait.hints })).not.toBeInTheDocument()
  })
})
