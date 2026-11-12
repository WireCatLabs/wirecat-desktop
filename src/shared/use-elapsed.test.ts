import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useNow } from "./use-elapsed"

describe("useNow", () => {
  afterEach(() => vi.useRealTimers())

  it("ticks every second while active and stands still otherwise", () => {
    vi.useFakeTimers({ now: 1_000_000 })
    const { result, rerender } = renderHook(({ active }) => useNow(active), { initialProps: { active: true } })
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBe(1_003_000)

    rerender({ active: false })
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(1_003_000)
  })
})
