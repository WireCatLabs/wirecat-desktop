import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { usePoll } from "./use-poll"

const hidden = (yes: boolean) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(yes ? "hidden" : "visible")

describe("usePoll", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does not run while the window is hidden", async () => {
    vi.useFakeTimers()
    const run = vi.fn().mockResolvedValue(undefined)
    hidden(true)
    renderHook(() => usePoll(run, 1000, true))
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).not.toHaveBeenCalled()

    hidden(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("does not start a second run before the first ends", async () => {
    vi.useFakeTimers()
    let finish = () => {}
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    renderHook(() => usePoll(run, 1000, true))
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).toHaveBeenCalledTimes(1)

    finish()
    await vi.advanceTimersByTimeAsync(1000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("stops when no longer active", async () => {
    vi.useFakeTimers()
    const run = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ on }) => usePoll(run, 1000, on), { initialProps: { on: true } })
    await vi.advanceTimersByTimeAsync(1000)
    rerender({ on: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
