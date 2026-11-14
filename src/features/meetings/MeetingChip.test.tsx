import { describe, expect, it } from "vitest"
import type { MeetingRow } from "@/platform/bindings"
import { render, screen } from "@/testing/render"
import { MeetingBlock, MeetingLine, MeetingTip } from "./MeetingChip"

const START = new Date(2026, 10, 10, 9, 30)
const meeting = (minutes: number): MeetingRow => ({
  ref: "event:1",
  kind: "meeting",
  title: "Standup",
  startedAt: START.toISOString(),
  endedAt: new Date(START.getTime() + minutes * 60_000).toISOString(),
  durationMs: minutes * 60_000,
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
  seriesId: null,
  recurrence: null,
})
const time = (d: Date) => d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })

describe("MeetingBlock", () => {
  it("prints only the title in a block shorter than two lines", () => {
    const { container } = render(
      <MeetingBlock meeting={meeting(15)} minutes={22.5} fromBefore={false} goesOn={false} />,
    )
    expect(screen.getByText("Standup")).toBeInTheDocument()
    expect(container).not.toHaveTextContent(time(START))
  })

  it("prints the title first and the time under it in a taller block", () => {
    const { container } = render(<MeetingBlock meeting={meeting(60)} minutes={60} fromBefore={false} goesOn={false} />)
    const text = container.textContent ?? ""
    expect(text.indexOf("Standup")).toBe(0)
    expect(text.indexOf(time(START))).toBeGreaterThan(0)
  })
})

describe("MeetingLine", () => {
  it("leaves the start out of a month line, and keeps it in the day's list", () => {
    const { container, rerender } = render(<MeetingLine meeting={meeting(15)} time={false} />)
    expect(container).not.toHaveTextContent(time(START))
    rerender(<MeetingLine meeting={meeting(15)} />)
    expect(container).toHaveTextContent(`${time(START)}Standup`)
  })
})

describe("MeetingTip", () => {
  it("gives the title and the start and end", () => {
    const { container } = render(<MeetingTip meeting={meeting(15)} />)
    expect(container).toHaveTextContent(`Standup${time(START)}–${time(new Date(START.getTime() + 15 * 60_000))}`)
  })
})
