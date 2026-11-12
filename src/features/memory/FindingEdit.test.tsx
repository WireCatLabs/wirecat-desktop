import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { MemoryRead } from "@/platform/memory-schemas"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
const SPANISH = "Add 40 Spanish queries to the evaluation set before the 12 November review"

/** The memo the page reads, changed as `change` says. */
const reading = (change: (read: Extract<MemoryRead, { kind: "ready" }>) => MemoryRead) => {
  const read = platform.memoryRead.bind(platform)
  vi.spyOn(platform, "memoryRead").mockImplementation(async (page) => {
    const out = await read(page)
    return out.kind === "ready" ? change(out) : out
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

const openBatch = async (count = 4) => {
  const user = userEvent.setup()
  render(<MemoryPage />)
  await rack()
  const batch = document.querySelector('[data-ref="action:7"]') as HTMLElement
  await user.click(within(batch).getByRole("button", { name: `Review ${count}` }))
  return { user, batch }
}

describe("Editing a finding before deciding it", () => {
  it("changes a task's title at the batch's fingerprint, and the next edit names the new one", async () => {
    const edit = vi.spyOn(platform, "memoryFindingEdit")
    const { user, batch } = await openBatch()
    await user.click(within(batch).getByRole("button", { name: `Edit the finding: ${SPANISH}` }))
    const title = within(batch).getByRole("textbox", { name: "Title" })
    expect(title).toHaveFocus()
    expect(within(batch).getByRole("textbox", { name: "Why" })).toHaveValue(
      "Lena Ortiz asked for Spanish coverage in the review thread and nobody took it.",
    )
    await user.clear(title)
    await user.type(title, "Add 30 Spanish queries")
    await user.click(within(batch).getByRole("button", { name: "Save the change" }))
    await waitFor(() => expect(within(batch).queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument())
    expect(edit).toHaveBeenCalledWith("action:7", "f2", "5adf3e", [{ name: "title", value: "Add 30 Spanish queries" }])
    expect(within(batch).getByText("Add 30 Spanish queries")).toBeInTheDocument()
    const answered = (await edit.mock.results[0]?.value)?.fingerprint

    await user.click(within(batch).getByRole("button", { name: /Edit the finding: Ask Tom Becker/ }))
    await user.type(within(batch).getByRole("textbox", { name: "Title" }), " today")
    await user.click(within(batch).getByRole("button", { name: "Save the change" }))
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2))
    expect(answered).not.toBe("5adf3e")
    expect(edit.mock.calls[1]?.[2]).toBe(answered)
  })

  it("empties an optional field and refuses an empty title", async () => {
    const edit = vi.spyOn(platform, "memoryFindingEdit")
    const { user, batch } = await openBatch()
    await user.click(within(batch).getByRole("button", { name: /Edit the finding: Add 30 Spanish/ }))
    await user.clear(within(batch).getByRole("textbox", { name: "Title" }))
    await user.click(within(batch).getByRole("button", { name: "Save the change" }))
    expect(await within(batch).findByText("Title cannot be empty.")).toBeInTheDocument()
    expect(edit).not.toHaveBeenCalled()

    await user.type(within(batch).getByRole("textbox", { name: "Title" }), "Add 30 Spanish queries")
    await user.clear(within(batch).getByRole("textbox", { name: "Why" }))
    await user.click(within(batch).getByRole("button", { name: "Save the change" }))
    await waitFor(() =>
      expect(edit).toHaveBeenCalledWith("action:7", "f2", expect.any(String), [{ name: "reason", value: null }]),
    )
  })

  it("reads a batch that changed meanwhile again and says so", async () => {
    vi.spyOn(platform, "memoryFindingEdit").mockRejectedValueOnce(new Error("findings.stale"))
    const show = vi.spyOn(platform, "memoryShow")
    const { user, batch } = await openBatch()
    await user.click(within(batch).getByRole("button", { name: /Edit the finding: Add 30 Spanish/ }))
    await user.type(within(batch).getByRole("textbox", { name: "Title" }), " now")
    await user.click(within(batch).getByRole("button", { name: "Save the change" }))
    expect(await within(batch).findByText(/These findings changed since you opened them/)).toBeInTheDocument()
    await waitFor(() => expect(within(batch).queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument())
    expect(show).toHaveBeenCalledWith("action:7")
  })

  it("is not offered by a memo without actions edit", async () => {
    reading((out) => ({ ...out, findingsEdit: false }))
    const { batch } = await openBatch()
    expect(within(batch).queryByRole("button", { name: /Edit the finding/ })).not.toBeInTheDocument()
  })
})

describe("A batch decided in part", () => {
  it("shows the decided finding as decided and saves only the ones still waiting", async () => {
    reading((out) => ({
      ...out,
      entries: out.entries.map((e) =>
        e.ref === "action:7" && e.findings
          ? {
              ...e,
              findings: e.findings.map((f, i) =>
                i === 0 ? { ...f, outcome: "accepted", created: "fact:22", edits: [] } : f,
              ),
            }
          : e,
      ),
    }))
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const { user, batch } = await openBatch(3)
    expect(
      within(batch).queryByRole("group", { name: /Decision on: The evaluation set moves/ }),
    ).not.toBeInTheDocument()
    expect(within(batch).getByText("Created")).toBeInTheDocument()
    const tom = within(batch).getByRole("group", { name: /Decision on: Ask Tom Becker/ })
    await user.click(within(tom).getByRole("button", { name: "Reject" }))
    await user.click(within(batch).getByRole("button", { name: "Save: create 2, reject 1" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("action:7", ["f2", "f3"]))
  })
})
