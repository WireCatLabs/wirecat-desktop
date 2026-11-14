import { describe, expect, it, vi } from "vitest"
import type { MeetingDetails, MeetingRow } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { showMeeting } from "@/shared/meeting-open"
import { render, screen, within } from "@/testing/render"
import { MeetingDialog } from "./MeetingDialog"

const row: MeetingRow = {
  ref: "event:665",
  kind: "meeting",
  title: "Board review",
  startedAt: "2026-11-13T11:00:00.000Z",
  endedAt: "2026-11-13T13:00:00.000Z",
  durationMs: 7_200_000,
  allDay: false,
  timezone: null,
  status: "confirmed",
  links: [
    { source: "google-calendar:ana@example.org", url: "https://meet.google.com/abc-defg-hij" },
    { source: "zoom:ana@example.org", url: "https://us02web.zoom.us/j/1" },
  ],
  sources: [
    {
      provider: "google-calendar",
      account: "ana@example.org",
      source: "google-calendar:ana@example.org",
      label: "Google Calendar · ana@example.org",
      via: "calendar",
      calendar: "Work",
    },
  ],
  participants: [
    { name: "Lena Ortiz", email: "lena@example.org", person: { ref: "person:7", name: "Lena Ortiz" }, organizer: true },
  ],
  participantsCount: 1,
  hasRecording: true,
  hasTranscript: false,
  hasSummary: true,
  documents: [],
  pendingFindings: 0,
}

const details = (meeting: MeetingRow, more: Partial<MeetingDetails> = {}): MeetingDetails => ({
  meeting,
  description: null,
  location: null,
  summaries: [],
  transcript: null,
  findings: [],
  ...more,
})

describe("The meeting card", () => {
  it("shows the join links by service, where, the calendar, the recording, people and the notes link", async () => {
    vi.spyOn(platform, "meetingsShow").mockResolvedValue(
      details(row, {
        location: "Atlas room",
        description: "Agenda",
        summaries: [
          {
            source: "meet",
            title: null,
            overview: "Agreed.",
            sections: [],
            nextSteps: [],
            url: "https://docs.google.com/document/d/1",
          },
        ],
      }),
    )
    render(<MeetingDialog />)
    showMeeting("event:665", "Board review")
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByRole("button", { name: /Join on Google Meet/ })).toBeVisible()
    expect(within(dialog).getByRole("button", { name: /Join on Zoom/ })).toBeVisible()
    expect(within(dialog).getByRole("button", { name: /Open the notes/ })).toBeVisible()
    expect(within(dialog).getByText("Atlas room")).toBeVisible()
    expect(within(dialog).getByText("Work · ana@example.org")).toBeVisible()
    expect(within(dialog).getByText("Kept by the meeting service")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Open Lena Ortiz on Contacts" })).toBeVisible()
  })

  it("collapses what memo does not know into one line instead of empty sections", async () => {
    const bare: MeetingRow = {
      ...row,
      ref: "event:700",
      title: "ML Project",
      links: [],
      sources: [{ ...(row.sources[0] as MeetingRow["sources"][number]), calendar: null }],
      participants: [],
      participantsCount: 0,
      hasRecording: false,
      hasSummary: false,
    }
    vi.spyOn(platform, "meetingsShow").mockResolvedValue(details(bare))
    render(<MeetingDialog />)
    showMeeting("event:700", "ML Project")
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText(/The calendar gave only the time of this meeting/)).toBeVisible()
    expect(within(dialog).queryByRole("heading", { name: /Participants|Summary|Details/ })).not.toBeInTheDocument()
  })
})
