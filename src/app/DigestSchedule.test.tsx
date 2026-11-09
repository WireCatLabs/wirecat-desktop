import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDigests } from "@/features/digests"
import { useDigestSchedule } from "@/features/digests/schedule-store"
import { useTasks } from "@/features/tasks"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  useDigestSchedule.setState({ status: null, error: null, busy: null, failed: null, remembered: null, backfill: null })
  useDigests.setState({ days: null, error: null, reading: false, shown: {} })
  vi.spyOn(platform, "listenLinks").mockResolvedValue()
})

afterEach(() => vi.restoreAllMocks())

async function openDigests() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /Digests/ }))
  const card = await screen.findByRole("region", { name: "Morning digest schedule" })
  await within(card).findByText(/Every day at 08:30/, {}, { timeout: 4000 })
  return { user, card }
}

describe("the morning digest's schedule", () => {
  it("shows the time, routes, last run with its cost, today's spend, and memo's other schedules", async () => {
    const { card } = await openDigests()
    expect(card).toHaveTextContent("Telegram bot (personal → user:1001), Mail (work → owner@example.com)")
    expect(card).toHaveTextContent(/finished · cost \$0\.27/)
    expect(card).toHaveTextContent("Spent today: $0.27 of $1.00 a day")
    expect(within(card).getByRole("switch", { name: "Write the digest every morning" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(card).toHaveTextContent(/mail-triage.*every 30m.*skipped .*: the daily cost limit is reached/)
  }, 15000)

  it("changes the time with memo's schedule agent, keeping the routes and caps", async () => {
    const save = vi.spyOn(platform, "digestScheduleSave")
    const { user, card } = await openDigests()
    const time = within(card).getByLabelText("Time")
    await user.clear(time)
    await user.type(time, "07:45")
    await user.click(within(card).getByRole("button", { name: "Change the time" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "07:45",
        ["telegram-bot:personal/user:1001", "email:work/owner@example.com"],
        0.5,
        1,
      ),
    )
    expect(await within(card).findByText(/Every day at 07:45/, {}, { timeout: 4000 })).toBeInTheDocument()
    // The browser build's memo is one for the whole file: give the next test its 08:30 back.
    await user.clear(time)
    await user.type(time, "08:30")
    await user.click(within(card).getByRole("button", { name: "Change the time" }))
    expect(await within(card).findByText(/Every day at 08:30/, {}, { timeout: 4000 })).toBeInTheDocument()
  }, 15000)

  it("names the price before a run now and runs only after the owner confirms", async () => {
    const run = vi.spyOn(platform, "digestScheduleRun")
    const { user, card } = await openDigests()
    await user.click(within(card).getByRole("button", { name: "Run now…" }))
    const dialog = await screen.findByRole("dialog", { name: "Run the morning digest now?" })
    expect(dialog).toHaveTextContent("It costs about $0.27, as the last run did.")
    expect(dialog).toHaveTextContent("Telegram bot (personal → user:1001)")
    expect(run).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Run for about $0.27" }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(await within(card).findByText(/Writing the digest/)).toBeInTheDocument()
  }, 15000)

  it("turns off with schedule remove and back on with the settings it had", async () => {
    const remove = vi.spyOn(platform, "digestScheduleRemove")
    const save = vi.spyOn(platform, "digestScheduleSave")
    const { user, card } = await openDigests()
    const toggle = within(card).getByRole("switch", { name: "Write the digest every morning" })
    await user.click(toggle)
    await waitFor(() => expect(remove).toHaveBeenCalled())
    expect(await within(card).findByRole("button", { name: "Turn on" }, { timeout: 4000 })).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-checked", "false")
    await user.click(toggle)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "08:30",
        ["telegram-bot:personal/user:1001", "email:work/owner@example.com"],
        0.5,
        1,
      ),
    )
  }, 15000)

  it("makes a missing schedule at 08:30 with the routes the owner adds", async () => {
    vi.spyOn(platform, "digestSchedule").mockResolvedValue({
      state: "ready",
      digest: null,
      others: [],
      harness: true,
    })
    const save = vi.spyOn(platform, "digestScheduleSave").mockResolvedValue({
      state: "ready",
      digest: null,
      others: [],
      harness: true,
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Digests/ }))
    const card = await screen.findByRole("region", { name: "Morning digest schedule" })
    const create = await within(card).findByRole("button", { name: "Schedule the digest" }, { timeout: 4000 })
    expect(within(card).getByLabelText("Time")).toHaveValue("08:30")
    await user.type(within(card).getByRole("textbox", { name: "Account" }), "personal")
    await user.type(within(card).getByRole("textbox", { name: "Chat id or user:id" }), "user:1001")
    await user.click(within(card).getByRole("button", { name: "Add" }))
    expect(card).toHaveTextContent("Telegram bot (personal → user:1001)")
    await user.click(create)
    expect(save).toHaveBeenCalledWith("08:30", ["telegram-bot:personal/user:1001"], 0.5, 1)
  }, 15000)
})

describe("the digest history", () => {
  it("marks a day built later and fills history only after showing the price", async () => {
    const backfill = vi.spyOn(platform, "digestBackfill")
    const { user } = await openDigests()
    const days = await screen.findByRole("navigation", { name: "Days" })
    expect(days).toHaveTextContent("built later")

    await user.click(screen.getByRole("button", { name: "Fill history…" }))
    const dialog = await screen.findByRole("dialog", { name: "Fill the history" })
    expect(await within(dialog).findByText(/to build/, {}, { timeout: 4000 })).toHaveTextContent(
      /4 days to build \(3 already have one\), about \$1\.08/,
    )
    expect(backfill.mock.calls.every(([, , yes]) => yes === false)).toBe(true)

    await user.click(within(dialog).getByRole("radio", { name: "14 days" }))
    expect(await within(dialog).findByText(/11 days to build/, {}, { timeout: 4000 })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: /^Build for about/ }))
    expect(backfill).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), true)
    expect(await within(dialog).findByText(/Built 11 days/, {}, { timeout: 8000 })).toBeInTheDocument()
  }, 20000)

  it("shows Fill history off when this memo has no digest backfill", async () => {
    vi.spyOn(platform, "digestBackfill").mockResolvedValue({ state: "unsupported" })
    await openDigests()
    expect(await screen.findByText("Needs a Memo update")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fill history…" })).toBeDisabled()
  }, 15000)
})

describe("a digest item", () => {
  it("opens its details in place: quote, where from, and every reference as a link", async () => {
    const { user } = await openDigests()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getByRole("button", { name: "Details: warehouse lease" }))
    const details = within(today).getByRole("button", { name: "Details: warehouse lease" })
    expect(details).toHaveAttribute("aria-expanded", "true")
    const shown = await within(today).findByText("Where from")
    const list = shown.closest("dl") as HTMLElement
    expect(list).toHaveTextContent("«Can we sign on Friday?»")
    expect(list).toHaveTextContent(/mail · /)
    for (const name of ["Open: the message", "Open: Anna Kotova", "Open: project khimki-warehouse"])
      expect(within(list).getByRole("button", { name })).toBeInTheDocument()
  }, 15000)

  it("links who and the project; a person opens the calm not-yet page", async () => {
    const { user } = await openDigests()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getAllByRole("button", { name: "Open: Anna Kotova" })[0] as HTMLElement)
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
    expect(screen.getByText(/no page for this person yet/)).toBeInTheDocument()
    expect(useNav.getState().active).toBe("open")
  }, 15000)

  it("opens a known project's tasks, and an unknown one on the calm not-yet page", async () => {
    const { user } = await openDigests()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getByRole("button", { name: "Open: project HRB" }))
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"), { timeout: 4000 })
    expect(useTasks.getState().query).toBe("project:HRB")

    act(() => useNav.getState().go("digests"))
    const again = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(again).getByRole("button", { name: "Open: project khimki-warehouse" }))
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
    expect(screen.getByText(/no page for this project yet/)).toBeInTheDocument()
  }, 20000)
})
