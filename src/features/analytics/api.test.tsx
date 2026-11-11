import * as v from "valibot"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Aggregate, MessageCounts } from "@/platform/analytics-schemas"
import { platform } from "@/platform/bridge"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@/testing/render"
import { useTaskWeeks } from "./api"
import { MeetingDays } from "./daily"
import { readParts } from "./reads"
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

describe("a profile that holds nothing", () => {
  it("makes no notice: an empty or test account is not a problem", async () => {
    useAnalytics.setState({ profilesOf: { tg: ["test"], max: [], wa: [] }, signedOut: {} })
    vi.spyOn(platform, "messageStats").mockResolvedValue({
      kind: "failed",
      message: "nothing stored",
      code: "not_found",
    })
    const { result } = renderHook(() => useExtra({ by: "hour", only: "close", previous: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.problems).toEqual([])
  })

  it("makes no notice from a tool's aggregate either, and a real failure still does", () => {
    const parts = (code: string) => [{ profile: "test", answer: { kind: "failed", message: "x", code } as const }]
    const schema = v.unknown()
    expect(readParts([["max", { state: "ready", parts: parts("not_found") }]], schema).problems).toEqual([])
    expect(readParts([["max", { state: "ready", parts: parts("busy") }]], schema).problems).toHaveLength(1)
  })
})

describe("closed tasks this week and last", () => {
  it("are null while memo counts, failed when it cannot, then both numbers", async () => {
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
    const chats = vi.spyOn(platform, "analyticsAggregate").mockResolvedValue({
      kind: "ready",
      body: { open: 9, created: 12, closed: 11, median_close_ms: null, mean_open_age_ms: null, rows: [] },
    })
    const failed = renderHook(() => useTaskWeeks("2026-11-05", "UTC"))
    expect(failed.result.current).toBeNull()
    await waitFor(() => expect(failed.result.current).toBe("failed"))
    const { result } = renderHook(() => useTaskWeeks("2026-11-06", "UTC"))
    await waitFor(() =>
      expect(result.current).toEqual({ now: { closed: 14, created: 15 }, last: { closed: 14, created: 15 } }),
    )
    expect(chats).toHaveBeenCalledWith("memo", "taskSources", null, "30d", "UTC", {
      from: "2026-11-02",
      to: "2026-11-06",
    })
    chats.mockResolvedValue({ kind: "old", message: "needs memo" })
    const { result: old } = renderHook(() => useTaskWeeks("2026-11-07", "UTC"))
    await waitFor(() =>
      expect(old.current).toEqual({ now: { closed: 3, created: null }, last: { closed: 3, created: null } }),
    )
  })
})
