import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { AddedSource, Reader } from "@/platform/memory-add-schemas"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { useReaders } from "@/shared/readers-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { useAddSource } from "./add-store"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

const ADDED: AddedSource = {
  ref: "document:42",
  created: true,
  duplicateOf: null,
  title: "Call with Lena",
  kind: "text",
  mime: null,
  bytes: 120,
  chars: 120,
  truncated: false,
  read: "extracted",
  url: null,
  kept: "text",
  searchableWords: true,
  searchableMeaning: false,
  subjects: [],
}

const reader = (id: string, chosen: boolean): Reader => ({
  id,
  available: true,
  signedIn: null,
  model: "llama3.2",
  provider: null,
  leavesComputer: false,
  readsFiles: false,
  chosen,
})

const finding = (id: string, kind: string, text: string) => ({
  id,
  kind,
  text,
  reason: null,
  evidence: ["document:42"],
  outcome: null,
  created: null,
})

const BATCH = {
  ref: "action:950",
  type: "action",
  kind: "evidence_findings",
  status: "proposed",
  findings: [
    finding("f1", "fact", "Delivery is on the 28th."),
    finding("f2", "fact", "The eval set moves to 120 queries."),
    finding("f3", "task", "Send Lena the new query list"),
  ],
} as unknown as MemoryEntry

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<MemoryPage />)
  await user.click(await screen.findByRole("button", { name: "Add to memory" }, { timeout: 4000 }))
  return screen.getByRole("region", { name: "Add to memory" })
}

describe("Add to memory", () => {
  beforeEach(() => {
    useAddSource.setState(useAddSource.getInitialState(), true)
    useReaders.setState(useReaders.getInitialState(), true)
    useMemory.setState(useMemory.getInitialState(), true)
  })

  it("saves pasted text, then keeps only the suggested facts the owner ticked", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", true)])
    const add = vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const suggest = vi.spyOn(platform, "memorySourceSuggest").mockResolvedValue({ batch: BATCH, reused: false })
    const confirm = vi.spyOn(platform, "memoryConfirm").mockResolvedValue(BATCH)
    const user = userEvent.setup()
    const panel = await openPanel(user)

    const save = within(panel).getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "We agreed delivery on the 28th with Lena.")
    await user.click(save)
    expect(add).toHaveBeenCalledWith({
      given: { kind: "text", text: "We agreed delivery on the 28th with Lena." },
      title: null,
      subjects: [],
    })
    expect(await within(panel).findByText(/“Call with Lena” is saved in WireCat/)).toBeInTheDocument()
    expect(
      within(panel).getByText(/Ollama \(llama3.2\) reads its text. It does not leave this computer./),
    ).toBeVisible()

    await user.click(await within(panel).findByRole("checkbox", { name: "Lena Ortiz" }, { timeout: 3000 }))
    await user.click(within(panel).getByRole("button", { name: "Suggest facts" }))
    expect(suggest).toHaveBeenCalledWith("document:42", "ollama", ["person:7"], false)

    const task = await within(panel).findByRole("checkbox", { name: /Send Lena the new query list/ })
    expect(task).not.toBeChecked()
    await user.click(within(panel).getByRole("checkbox", { name: /The eval set moves/ }))
    await user.click(within(panel).getByRole("button", { name: "Keep 1" }))
    expect(confirm).toHaveBeenCalledWith("action:950", ["f1"])
    expect(await within(panel).findByRole("status")).toHaveTextContent("Saved in WireCat")
    expect(within(panel).getByText("Kept (1)")).toBeInTheDocument()
  })

  it("never picks a reader the owner did not choose, and points to Settings", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", false)])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    expect(await within(panel).findByRole("button", { name: "Suggest facts" })).toBeDisabled()
    expect(within(panel).getByRole("button", { name: "Open Settings" })).toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: "Only save it" }))
    expect(within(panel).getByText("Kept (0)")).toBeInTheDocument()
  })

  it("words memo's refusal of a link and stays on the step", async () => {
    vi.spyOn(platform, "memorySourceAdd").mockRejectedValue(new Error("source.needs-sign-in"))
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /Link/ }))
    const save = within(panel).getByRole("button", { name: "Save" })
    await user.type(within(panel).getByRole("textbox", { name: "Web address" }), "docs.google.com/x")
    expect(save).toBeDisabled()
    await user.clear(within(panel).getByRole("textbox", { name: "Web address" }))
    await user.type(within(panel).getByRole("textbox", { name: "Web address" }), "https://docs.google.com/x")
    await user.click(save)
    await waitFor(() => expect(within(panel).getByText(/The page asks you to sign in/)).toBeInTheDocument())
    expect(within(panel).getByText(/Source · 1 of 4/)).toBeInTheDocument()
  })
})
