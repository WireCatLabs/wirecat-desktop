import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MeetingRow } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

type User = ReturnType<typeof userEvent.setup>

const openMeetings = async (user: User) => {
  render(<App />)
  await user.click(screen.getByRole("button", { name: /^Meetings/ }))
  return screen.findByRole("region", { name: "Week" })
}

const row = (n: number, start: Date): MeetingRow => ({
  ref: `event:${n}`,
  kind: "meeting",
  title: `Synthetic ${n}`,
  startedAt: start.toISOString(),
  endedAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
  durationMs: 30 * 60_000,
  allDay: false,
  timezone: null,
  status: null,
  links: [],
  sources: [],
  participants: [],
  participantsCount: 0,
  hasRecording: false,
  hasTranscript: false,
  hasSummary: false,
  documents: [],
  pendingFindings: 0,
})

describe("Meetings", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("opens on this week, read once as one window, and the next week is one more read", async () => {
    const list = vi.spyOn(platform, "meetingsList")
    const user = userEvent.setup()
    const week = await openMeetings(user)
    expect(await within(week).findByRole("button", { name: /^Board review/ })).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(1)
    const [, window, page, limit] = list.mock.calls[0] ?? []
    expect([page, limit]).toEqual([1, 500])
    expect(window?.from).toMatch(/T00:00:00[+-]\d\d:\d\d$/)

    await user.click(screen.getByRole("button", { name: "Next week" }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(Date.parse(list.mock.calls[1]?.[1]?.from ?? "")).toBe(Date.parse(window?.to ?? ""))
  })

  it("keeps the filters across views, and reads only meetings with a transcript when asked", async () => {
    const list = vi.spyOn(platform, "meetingsList")
    const user = userEvent.setup()
    await openMeetings(user)
    await user.click(screen.getByRole("button", { name: "Only with a transcript" }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("has_transcript:true", expect.anything(), 1, 500))
    await user.click(screen.getByRole("radio", { name: /Month/ }))
    expect(await screen.findByRole("grid", { name: "Month" })).toBeInTheDocument()
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("has_transcript:true", expect.anything(), 1, 500))
  })

  it("pages the table on memo's side, newest first, never cutting a whole list", async () => {
    const list = vi.spyOn(platform, "meetingsList").mockImplementation(async (_q, window, page, limit) => ({
      kind: "ready",
      page: {
        meetings: Array.from({ length: limit }, (_, i) => row((page - 1) * limit + i + 1, new Date())),
        total: window ? limit : 900,
        totalMore: false,
        more: !window && page * limit < 900,
        accounts: [],
      },
    }))
    const user = userEvent.setup()
    await openMeetings(user)
    await user.click(screen.getByRole("radio", { name: /Table/ }))
    const pager = await screen.findByRole("navigation", { name: "Pages" })
    await user.click(within(pager).getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("", null, 2, 25))
  })

  it("says which days a capped window did not reach", async () => {
    vi.spyOn(platform, "meetingsList").mockImplementation(async (_q, window) => {
      const from = new Date(window?.from ?? Date.now())
      const first = new Date(from.getTime() + 10 * 3_600_000)
      return {
        kind: "ready",
        page: { meetings: [row(1, first)], total: 800, totalMore: false, more: true, accounts: [] },
      }
    })
    const user = userEvent.setup()
    await openMeetings(user)
    expect((await screen.findAllByText("Not read")).length).toBe(6)
    expect(screen.getByRole("button", { name: /Read up to/ })).toBeInTheDocument()
  })

  it("opens a meeting from its block, takes a participant to Contacts, and closing returns to the block", async () => {
    const user = userEvent.setup()
    const week = await openMeetings(user)
    const block = await within(week).findByRole("button", { name: /^Board review/ })
    await user.click(block)
    const dialog = await screen.findByRole("dialog", { name: "Board review" })
    expect(await within(dialog).findByText(/3 findings wait for you/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /Open in Zoom/ })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(block).toHaveFocus())

    await user.click(block)
    const again = await screen.findByRole("dialog", { name: "Board review" })
    await user.click(await within(again).findByRole("button", { name: "Open Lena Ortiz on Contacts" }))
    expect(await screen.findByRole("dialog", { name: "Lena Ortiz" })).toBeInTheDocument()
  })

  it("finds words in the transcript and reads more of it", async () => {
    const show = vi.spyOn(platform, "meetingsShow")
    const user = userEvent.setup()
    const week = await openMeetings(user)
    await user.click(await within(week).findByRole("button", { name: /^Board review/ }))
    const dialog = await screen.findByRole("dialog", { name: "Board review" })
    await user.click(await within(dialog).findByRole("tab", { name: /Transcript/ }))
    await user.type(within(dialog).getByRole("searchbox", { name: "Find in transcript" }), "budget")
    expect(within(dialog).getByText(/^1 of \d+$/)).toBeInTheDocument()
    await user.keyboard("{Enter}")
    expect(within(dialog).getByText(/^2 of \d+$/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Show more lines" }))
    await waitFor(() => expect(show).toHaveBeenLastCalledWith("event:665", 100))
  })

  it("opens a document's meeting from the Documents page", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /^Documents/ }))
    const table = await screen.findByRole("table", { name: "Documents" })
    await user.click(await within(table).findByRole("button", { name: /Q4 plan/ }))
    const doc = await screen.findByRole("dialog", { name: "Q4 plan" })
    await user.click(
      (await within(doc).findAllByRole("button", { name: "Open Board review on Meetings" }))[0] as HTMLElement,
    )
    expect(await screen.findByRole("dialog", { name: "Board review" })).toBeInTheDocument()
  })

  it("offers memo's update when memo has no meetings commands yet", async () => {
    vi.spyOn(platform, "meetingsList").mockResolvedValue({ kind: "old", version: "0.132.0", need: "0.133.0" })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /^Meetings/ }))
    expect(await screen.findByText(/needs Memo 0.133.0 or newer/)).toBeInTheDocument()
  })
})
