import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useMachineSetup } from "@/shared/machine-setup-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSignIn } from "@/shared/signin-store"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, within } from "@/testing/render"
import { MachineChoicesList, MachineSetting } from "./MachineSetup"
import { confirmChoices, useApplyChoices } from "./machine-setup"

afterEach(() => vi.restoreAllMocks())

const copy = [{ path: "~/bin/tg", version: "0.90.0", manager: "npm" as const, problem: null }]

function Watch() {
  useApplyChoices()
  return null
}

const signedIn = (key: string) => act(() => useSignIn.setState({ signedInAt: { [key]: Date.now() } }))

describe("what WireCat does by itself", () => {
  it("asks on the first screen, keeps the answers and turns on opening at login when the owner goes on", async () => {
    const autostart = vi.spyOn(platform, "autostartSet").mockResolvedValue(true)
    const user = userEvent.setup()
    render(<MachineChoicesList applied={false} />)
    expect(screen.getByRole("switch", { name: "Start WireCat when you log in" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Sync everything on a schedule" })).toBeChecked()
    expect(screen.getByLabelText("Time")).toHaveValue("04:45")
    expect(screen.queryByRole("switch", { name: "Get new messages right away" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: "Sync everything on a schedule" }))
    expect(useMachineSetup.getState()).toMatchObject({ nightly: false, answered: false })
    expect(autostart).not.toHaveBeenCalled()

    act(() => confirmChoices())
    expect(useMachineSetup.getState().answered).toBe(true)
    expect(autostart).toHaveBeenCalledWith(true)
  })

  it("asks about serve once a messenger with one is installed", () => {
    useTools.setState({ installs: { tg: copy } })
    render(<MachineChoicesList applied={false} />)
    expect(screen.getByRole("switch", { name: "Get new messages right away" })).not.toBeChecked()
  })

  it("makes the daily sync when an account signs in, runs it once, and offers the fix when the run fails", async () => {
    useTools.setState({ installs: { tg: copy } })
    const profiles = vi.spyOn(platform, "listProfiles").mockResolvedValue([{ name: "personal", signedIn: true }])
    useMachineSetup.setState({ answered: true, nightly: true, time: "05:10", live: false })
    vi.spyOn(platform, "autostartStatus").mockResolvedValue(true)
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({ state: "off" })
    const set = vi
      .spyOn(platform, "syncScheduleSet")
      .mockResolvedValue({ state: "on", when: "daily at 05:10", every: null, daily: "05:10", last: null })
    const test = vi.spyOn(platform, "syncScheduleTest").mockResolvedValue({
      exitCode: 1,
      reason: "authentication_error",
      output: "error: the session has ended",
    })
    const user = userEvent.setup()
    render(
      <>
        <Watch />
        <MachineSetting />
      </>,
    )
    signedIn("tg:personal")

    expect(await screen.findByText("The test run failed.")).toBeInTheDocument()
    expect(set).toHaveBeenCalledWith("tg", "personal", null, "05:10")
    expect(test).toHaveBeenCalledWith("tg", "personal")
    const results = screen.getByRole("region", { name: "What was set up" })
    expect(within(results).getByText("Daily sync of Telegram personal")).toBeInTheDocument()
    await user.click(within(results).getByRole("button", { name: /Fix/ }))
    act(() => useOnboarding.setState({ status: "done" }))
    await vi.waitFor(() => expect(profiles).toHaveBeenCalledWith("tg"))
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(within(results).getByText("The test run failed.")).toBeInTheDocument()
    expect(test).toHaveBeenCalledTimes(1)
    await user.click(within(results).getByText("Do it yourself"))
    expect(within(results).getByRole("region", { name: /fix/i })).toHaveTextContent(
      /schedule run[\s\S]*the session has ended/,
    )
  })

  it("leaves an interval the owner chose, and does nothing for a copy whose owner never answered", async () => {
    const set = vi.spyOn(platform, "syncScheduleSet")
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({
      state: "on",
      when: "every 15m",
      every: "15m",
      daily: null,
      last: null,
    })
    render(<Watch />)
    signedIn("tg:work")
    await act(() => Promise.resolve())
    expect(platform.syncScheduleStatus).not.toHaveBeenCalled()

    useMachineSetup.setState({ answered: true })
    signedIn("max:work")
    await vi.waitFor(() => expect(platform.syncScheduleStatus).toHaveBeenCalledWith("max", "work"))
    expect(set).not.toHaveBeenCalled()
  })

  it("in Settings, keeps serve running for every signed-in messenger account once turned on", async () => {
    useTools.setState({ installs: { tg: copy } })
    useMachineSetup.setState({ answered: true, nightly: false, live: false })
    vi.spyOn(platform, "autostartStatus").mockResolvedValue(false)
    vi.spyOn(platform, "listProfiles").mockResolvedValue([
      { name: "personal", signedIn: true },
      { name: "old", signedIn: false },
    ])
    vi.spyOn(platform, "backgroundStatus").mockResolvedValue({
      state: "stopped",
      unit: false,
      startsAtLogin: false,
      stoppedFor: null,
    })
    const run = vi
      .spyOn(platform, "backgroundRun")
      .mockResolvedValue({ state: { state: "running", connected: true, startsAtLogin: true }, fault: null })
    const user = userEvent.setup()
    render(<MachineSetting />)
    expect(await screen.findByRole("switch", { name: "Start WireCat when you log in" })).not.toBeChecked()

    await user.click(screen.getByRole("switch", { name: "Get new messages right away" }))
    expect(await screen.findByText("Set up.")).toBeInTheDocument()
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith("tg", "personal", "keep")
    expect(screen.getByText("Telegram personal in the background")).toBeInTheDocument()
  })
})
