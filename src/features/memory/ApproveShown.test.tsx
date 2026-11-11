import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { act, render, screen, waitFor } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

// The mock store outlives each test in this file: the second test starts with what the first approved.
afterEach(() => vi.restoreAllMocks())

const status = (ref: string) => useMemory.getState().entries.find((e) => e.ref === ref)?.status
const approved = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((call) => String(call[0])).sort()
const page = async () => {
  render(<MemoryPage />)
  await screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
}

describe("Approve N on the Memory page", () => {
  it("approves only what the filters show; the rows filtered out stay to review", async () => {
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const user = userEvent.setup()
    await page()
    expect(screen.getByRole("button", { name: "Approve all on this page: 4" })).toBeInTheDocument()
    act(() => useMemory.getState().setQuery("Harbour"))
    await user.click(await screen.findByRole("button", { name: "Approve all on this page: 1" }))
    await screen.findByText("Done: 1 record on this page approved.", {}, { timeout: 3000 })
    expect(approved(confirm)).toEqual(["fact:17"])
    for (const ref of ["fact:21", "memory:41", "memory:40", "action:5", "action:7"])
      expect(status(ref)).toBe("proposed")
  }, 40_000)

  it("leaves a folded group's rows, a task and an agent's findings batch to review", async () => {
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const user = userEvent.setup()
    await page()
    expect(screen.getByRole("button", { name: "Approve all on this page: 3" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Kai Moreno/, expanded: true }))
    await user.click(screen.getByRole("button", { name: "Approve all on this page: 2" }))
    await screen.findByText("Done: 2 records on this page approved.", {}, { timeout: 6000 })
    expect(approved(confirm)).toEqual(["fact:21", "memory:40"])
    await waitFor(() => expect(status("fact:21")).not.toBe("proposed"))
    expect(status("memory:41")).toBe("proposed")
    expect(status("action:7")).toBe("proposed")
    expect(status("action:5")).toBe("proposed")
  }, 40_000)
})
