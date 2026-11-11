import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })

describe("A mail findings batch", () => {
  it("opens a mail batch as each finding with its kind, the email it cites, and an Approve of only the ticked", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /Found in the mail of owner@example.com/ }))
    const findings = await screen.findByText(/What an agent found in the mail of owner@example.com/)
    const list = findings.parentElement as HTMLElement
    expect(within(list).getByText("Invoice")).toBeInTheDocument()
    expect(within(list).getByText("New contact")).toBeInTheDocument()
    expect(within(list).getAllByRole("button", { name: "Open the email" }).length).toBeGreaterThan(0)
    await user.click(within(list).getByRole("checkbox", { name: /Include: Anna Lind/ }))
    expect(within(list).getByText(/Approve keeps the 2 ticked ones/)).toBeInTheDocument()
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const batch = list.closest("[data-row]") as HTMLElement
    await user.click(within(batch).getByRole("button", { name: /^Approve/ }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("action:12", ["t1", "i1"]))
  })
})

describe("A meeting findings batch", () => {
  it("lists each finding and approves only the ticked ones", async () => {
    const read = platform.memoryRead.bind(platform)
    vi.spyOn(platform, "memoryRead").mockImplementation(async (page) => {
      const out = await read(page)
      if (out.kind !== "ready") return out
      const entries = out.entries.map((e) =>
        e.ref === "action:7" ? { ...e, kind: "meeting_findings", verb: "meeting_findings" } : e,
      )
      return { ...out, entries }
    })
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const batch = screen.getByText(/2 facts and 2 tasks to review/).closest("[data-row]") as HTMLElement
    await user.click(within(batch).getByRole("button", { name: "Review 4" }))
    await user.click(screen.getByRole("checkbox", { name: /Ask Tom Becker for read access/ }))
    await user.click(within(batch).getByRole("button", { name: "Approve 3" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("action:7", ["f1", "f2", "f3"]))
  })
})
