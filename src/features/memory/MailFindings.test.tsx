import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" })

describe("A mail findings batch", () => {
  it("opens a mail batch as each finding with its kind and the email it cites, and saves only the approved ones", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /Found in the mail of owner@example.com/ }))
    const batch = (await screen.findByRole("heading", { name: "Found in the mail of owner@example.com" })).closest(
      "[data-row]",
    ) as HTMLElement
    expect(within(batch).getByText("Invoice")).toBeInTheDocument()
    expect(within(batch).getByText("New contact")).toBeInTheDocument()
    expect(within(batch).getAllByRole("button", { name: "Open the email" }).length).toBeGreaterThan(0)
    expect(within(batch).queryByText(/msg:email/)).not.toBeInTheDocument()
    const anna = within(batch).getByRole("group", { name: /Decision on: Anna Lind/ })
    await user.click(within(anna).getByRole("button", { name: "Reject" }))
    const confirm = vi.spyOn(platform, "memoryConfirm")
    await user.click(within(batch).getByRole("button", { name: "Save: create 2, reject 1" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("action:12", ["t1", "i1"]))
  })
})

describe("A meeting findings batch", () => {
  it("lists each finding and saves only the approved ones", async () => {
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
    const tom = within(batch).getByRole("group", { name: /Decision on: Ask Tom Becker for read access/ })
    await user.click(within(tom).getByRole("button", { name: "Reject" }))
    await user.click(within(batch).getByRole("button", { name: "Save: create 3, reject 1" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("action:7", ["f1", "f2", "f3"]))
  })
})
