import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { failureSuperseded } from "@/domain/sync"
import type { ScheduleRun, SyncSchedule as State } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { SyncSchedule } from "./SyncSchedule"
import { syncKey, useSync } from "./sync-store"

const email = findTool("email") as NonNullable<ReturnType<typeof findTool>>
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const run = (over: Partial<ScheduleRun> = {}): ScheduleRun => ({
  at: ago(3),
  exitCode: 0,
  reason: null,
  failures: null,
  failingSince: null,
  costUsd: null,
  skipped: null,
  deliveries: [],
  ...over,
})

beforeEach(() => {
  useSync.setState({ runs: {}, last: {}, schedules: {}, profiles: {} })
})

describe("an account's sync on a timer", () => {
  it("offers the catalog's intervals and turns it on with the tool's own schedule command", async () => {
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({ state: "off" })
    const set = vi
      .spyOn(platform, "syncScheduleSet")
      .mockResolvedValue({ state: "on", when: "every 15m", every: "15m", last: null })
    const user = userEvent.setup()
    render(<SyncSchedule tool={email} profile="personal" />)
    const region = await screen.findByRole("region", { name: "Sync schedule of Email personal" })
    expect(region).toHaveTextContent("Not on a schedule")
    await user.click(within(region).getByRole("button", { name: "Sync on a schedule…" }))
    const how = within(region).getByRole("combobox", { name: "How often" })
    expect(how).toHaveTextContent("5 min")
    await user.click(how)
    await user.click(screen.getByRole("option", { name: "15 min" }))
    await user.click(within(region).getByRole("button", { name: "Turn on" }))
    expect(set).toHaveBeenCalledWith("email", "personal", "15m")
    expect(await within(region).findByText(/Syncs on its own every 15 min · no run yet/)).toBeInTheDocument()
  })

  it("shows the latest timed run, its failing streak, and turns off with schedule remove", async () => {
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({
      state: "on",
      when: "every 5m",
      every: "5m",
      last: run({ exitCode: 2, reason: "configuration_error", failures: 41, failingSince: ago(600) }),
    })
    const set = vi.spyOn(platform, "syncScheduleSet").mockResolvedValue({ state: "off" })
    const user = userEvent.setup()
    render(<SyncSchedule tool={email} profile="personal" />)
    const region = await screen.findByRole("region", { name: "Sync schedule of Email personal" })
    expect(await within(region).findByText(/failed \(configuration_error\)/)).toBeInTheDocument()
    expect(region).toHaveTextContent(/Scheduled syncs fail since .*, 41 in a row/)
    await user.click(within(region).getByRole("button", { name: "Change…" }))
    await user.click(within(region).getByRole("button", { name: "Turn off" }))
    expect(set).toHaveBeenCalledWith("email", "personal", null)
    expect(await within(region).findByText(/Not on a schedule/)).toBeInTheDocument()
  })

  it("says what the tool answered when it refuses", async () => {
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({ state: "off" })
    vi.spyOn(platform, "syncScheduleSet").mockRejectedValue(new Error("systemctl --user is not available"))
    const user = userEvent.setup()
    render(<SyncSchedule tool={email} profile="personal" />)
    const region = await screen.findByRole("region", { name: "Sync schedule of Email personal" })
    await user.click(within(region).getByRole("button", { name: "Sync on a schedule…" }))
    await user.click(within(region).getByRole("button", { name: "Turn on" }))
    expect(
      await within(region).findByText("Could not change the schedule: systemctl --user is not available"),
    ).toBeInTheDocument()
  })
})

describe("a failed sync from this window", () => {
  const failed = (endedAt: number) =>
    useSync.setState({
      runs: {
        [syncKey("email", "personal")]: {
          phase: "failed",
          startedAt: endedAt - 1000,
          endedAt,
          stage: null,
          progress: null,
          stopping: false,
          summary: null,
          failure: { message: "", code: "configuration_error", reason: null, run: null },
        },
      },
    })

  it("clears once the account's timer ran it again successfully", async () => {
    failed(Date.now() - 60 * 60_000)
    const next: State = { state: "on", when: "every 5m", every: "5m", last: run({ at: ago(2) }) }
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue(next)
    await useSync.getState().loadSchedule("email", "personal")
    expect(useSync.getState().runs[syncKey("email", "personal")]).toBeUndefined()
  })

  it("stays while the timed runs after it fail too, or ran before it", async () => {
    failed(Date.now() - 60 * 60_000)
    vi.spyOn(platform, "syncScheduleStatus").mockResolvedValue({
      state: "on",
      when: "every 5m",
      every: "5m",
      last: run({ at: ago(2), exitCode: 2 }),
    })
    await useSync.getState().loadSchedule("email", "personal")
    expect(useSync.getState().runs[syncKey("email", "personal")]?.phase).toBe("failed")

    expect(failureSuperseded(Date.now(), ago(5), null)).toBe(false)
    expect(failureSuperseded(Date.now() - 10 * 60_000, ago(5), null)).toBe(true)
    expect(failureSuperseded(null, ago(5), null)).toBe(false)
  })

  it("clears when the tool lists a newer successful sync", async () => {
    failed(Date.now() - 60 * 60_000)
    vi.spyOn(platform, "syncLast").mockResolvedValue({ at: ago(1), left: null, known: true })
    await useSync.getState().loadLast("email", "personal")
    await waitFor(() => expect(useSync.getState().runs[syncKey("email", "personal")]).toBeUndefined())
  })
})
