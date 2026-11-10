import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Aggregate, MessageCounts } from "@/platform/analytics-schemas"
import { platform } from "@/platform/bridge"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@/testing/render"
import { useClosedWeeks } from "./api"
import { MeetingDays } from "./daily"
import { useAnalytics, useExtra } from "./store"

afterEach(() => vi.restoreAllMocks())

const MEETING: Aggregate = {
  kind: "ready",
  body: { items: [{ title: "Standup", started_at: "2026-11-02T09:00:00Z", duration_ms: 900_000 }] },
}

const held = <T,>() => {
  let resolve: (v: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("an aggregate card", () => {
  beforeEach(() => useAnalytics.setState({ profilesOf: { zm: ["personal"] } }))

  it("holds its skeleton while the tool counts, then draws the answer", async () => {
    const answer = held<Aggregate>()
    vi.spyOn(platform, "analyticsAggregate").mockReturnValue(answer.promise)
    render(<MeetingDays />)
    expect(screen.getByRole("status")).toHaveTextContent("Meeting time by weekday")
    await act(async () => answer.resolve(MEETING))
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
    expect(screen.queryByText(/Could not count/)).not.toBeInTheDocument()
  })

  it("says the tool did not answer, offers to try again and keeps its words under Details", async () => {
    vi.spyOn(platform, "analyticsAggregate").mockRejectedValue(new Error("zm is not signed in"))
    render(<MeetingDays />)
    expect(await screen.findAllByText("Zoom (personal) did not answer.")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Details"))
    expect(await screen.findByText("zm is not signed in")).toBeInTheDocument()
  })

  it("asks again when the page loads again", async () => {
    const ask = vi.spyOn(platform, "analyticsAggregate").mockRejectedValueOnce(new Error("timed out"))
    ask.mockResolvedValue({ kind: "ready", body: { items: [] } })
    render(<MeetingDays />)
    expect(await screen.findByText("Zoom (personal) did not answer.")).toBeInTheDocument()
    act(() => useAnalytics.getState().load())
    expect(await screen.findByText("No meetings in this period.")).toBeInTheDocument()
  })
})

describe("extra message counts", () => {
  const known = { profilesOf: { tg: ["personal"], max: [], wa: [] } }
  const hours = { by: "hour", only: "all", previous: false } as const
  const counted = (count: number): MessageCounts => ({
    kind: "ready",
    total: count,
    rows: [{ key: "09", name: null, count }],
    more: false,
  })

  it("load once every messenger's profiles are known", async () => {
    const stats = vi.spyOn(platform, "messageStats").mockResolvedValue(counted(4))
    const { result } = renderHook(() => useExtra(hours))
    expect(result.current.loading).toBe(true)
    expect(stats).not.toHaveBeenCalled()
    act(() => useAnalytics.setState(known))
    await waitFor(() => expect(result.current.bySource.tg).toEqual([{ key: "09", name: null, count: 4 }]))
    expect(result.current.loading).toBe(false)
  })

  it("keep the last period's rows, marked stale, while a new period is read", async () => {
    useAnalytics.setState(known)
    const stats = vi.spyOn(platform, "messageStats").mockResolvedValue(counted(4))
    const { result } = renderHook(() => useExtra(hours))
    await waitFor(() => expect(result.current.bySource.tg?.[0]?.count).toBe(4))
    const next = held<MessageCounts>()
    stats.mockReturnValue(next.promise)
    act(() => useAnalytics.setState({ period: "7d" }))
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.bySource.tg?.[0]?.count).toBe(4)
    await act(async () => next.resolve(counted(9)))
    await waitFor(() => expect(result.current.bySource.tg?.[0]?.count).toBe(9))
    expect(result.current.stale).toBe(false)
  })

  it("leave out a profile whose count failed, and say so instead of counting it as no messages", async () => {
    useAnalytics.setState(known)
    vi.spyOn(platform, "messageStats").mockRejectedValue(new Error("locked"))
    const { result } = renderHook(() => useExtra(hours))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.bySource.tg ?? []).toEqual([])
    expect(result.current.problems).toEqual([
      expect.objectContaining({ kind: "failed", tool: "tg", profile: "personal" }),
    ])
  })
})

describe("closed tasks this week and last", () => {
  it("are null while memo counts and when it cannot, then both numbers", async () => {
    const counts = vi.spyOn(platform, "taskCounts").mockRejectedValueOnce(new Error("memo is busy"))
    const none: never[] = []
    counts.mockResolvedValue({
      total: 3,
      project: none,
      assignee: none,
      priority: none,
      state: none,
      due: none,
      agent: none,
    })
    const failed = renderHook(() => useClosedWeeks("2026-11-05"))
    expect(failed.result.current).toBeNull()
    await waitFor(() => expect(counts).toHaveBeenCalledTimes(2))
    expect(failed.result.current).toBeNull()
    const { result } = renderHook(() => useClosedWeeks("2026-11-06"))
    await waitFor(() => expect(result.current).toEqual({ now: 3, last: 3 }))
  })
})
