import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useMemory } from "./store"

afterEach(() => vi.restoreAllMocks())

describe("the Memory store", () => {
  it("opened again within a minute, reads nothing; later it reads with the entries still on screen", async () => {
    const read = vi.spyOn(platform, "memoryRead")
    await useMemory.getState().load()
    useMemory.getState().visit()
    expect(read).toHaveBeenCalledTimes(1)

    useMemory.setState({ readAt: Date.now() - 61_000 })
    const shown = useMemory.getState().entries
    useMemory.getState().visit()
    expect(useMemory.getState()).toMatchObject({ reading: true, entries: shown })
    expect(read).toHaveBeenCalledTimes(2)
  })
  it("reads only the memo page turned to, even within a minute of the last read", async () => {
    const read = vi.spyOn(platform, "memoryRead")
    await useMemory.getState().load()
    useMemory.getState().turnMemoPage(2)
    await vi.waitFor(() => expect(useMemory.getState().reading).toBe(false))
    expect(read.mock.calls.map(([page]) => page)).toEqual([1, 2])
    useMemory.getState().visit()
    expect(read).toHaveBeenCalledTimes(2)
  })
})
