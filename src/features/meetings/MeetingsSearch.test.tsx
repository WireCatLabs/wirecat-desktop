import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { MeetingRow } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { render, screen } from "@/testing/render"
import { MeetingsPage } from "./MeetingsPage"
import { useMeetings } from "./store"

const row = (ref: string, title: string, person?: { ref: string; name: string }): MeetingRow => ({
  ref,
  kind: "meeting",
  title,
  startedAt: "2026-11-13T11:00:00.000Z",
  endedAt: "2026-11-13T12:00:00.000Z",
  durationMs: 3_600_000,
  allDay: false,
  timezone: null,
  status: "confirmed",
  links: [],
  sources: [],
  participants: person ? [{ name: person.name, email: null, person, organizer: false, response: null }] : [],
  participantsCount: person ? 1 : 0,
  hasRecording: false,
  hasTranscript: false,
  hasSummary: false,
  documents: [],
  pendingFindings: 0,
  seriesId: null,
  recurrence: null,
})

describe("Searching meetings", () => {
  it("suggests titles for a plain word and people for person:, and takes one with the arrows", async () => {
    useMeetings.setState({ view: "table" })
    vi.spyOn(platform, "meetingsList").mockResolvedValue({
      kind: "ready",
      page: {
        meetings: [
          row("event:1", "Board review", { ref: "person:7", name: "Lena Ortiz" }),
          row("event:2", "Budget check-in"),
          row("event:3", "Standup"),
        ],
        total: 3,
        totalMore: false,
        more: false,
        accounts: ["zoom:ana@example.org"],
      },
    })
    const user = userEvent.setup()
    render(<MeetingsPage />)
    const field = await screen.findByRole("combobox", { name: "Search meetings" })
    await screen.findByText("Board review")

    await user.type(field, "bo")
    expect(screen.getByRole("option", { name: /Board review/ })).toBeVisible()
    expect(screen.queryByRole("option", { name: /Standup/ })).not.toBeInTheDocument()
    await user.keyboard("{ArrowDown}{Enter}")
    expect(field).toHaveValue('"Board review" ')

    await user.type(field, "person:le")
    await user.keyboard("{ArrowDown}{Enter}")
    expect(field).toHaveValue('"Board review" person:"person:7" ')
    expect(screen.getByText(/Lena Ortiz/, { selector: "[id$='-named'] *, [id$='-named']" })).toBeVisible()
  })
})
