import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Reader } from "@/platform/memory-add-schemas"
import { useReaders } from "@/shared/readers-store"
import { render, screen, waitFor } from "@/testing/render"
import { ReadersSetting } from "./ReadersSetting"

const reader = (id: string, over: Partial<Reader> = {}): Reader => ({
  id,
  available: true,
  signedIn: true,
  model: null,
  provider: null,
  leavesComputer: true,
  readsFiles: false,
  chosen: false,
  ...over,
})

describe("Reading for facts", () => {
  beforeEach(() => useReaders.setState(useReaders.getInitialState(), true))

  it("starts with nothing chosen and saves the owner's pick", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([
      reader("claude-code"),
      reader("codex", { readsFiles: true }),
      reader("ollama", { leavesComputer: false }),
    ])
    const choose = vi
      .spyOn(platform, "memoryReaderChoose")
      .mockResolvedValue([reader("claude-code"), reader("codex"), reader("ollama", { chosen: true })])
    const user = userEvent.setup()
    render(<ReadersSetting />)
    const ollama = await screen.findByRole("radio", { name: /Ollama/ })
    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false)
    expect(screen.getByText(/Codex can also open files/)).toBeInTheDocument()
    await user.click(ollama)
    expect(choose).toHaveBeenCalledWith("ollama")
    await waitFor(() => expect(screen.getByRole("radio", { name: /Ollama/ })).toBeChecked())
  })

  it("hands the key on once and never shows it back", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("key", { available: false })])
    const save = vi.spyOn(platform, "memoryReaderKey").mockResolvedValue({ provider: "openai", source: "keyring" })
    const user = userEvent.setup()
    render(<ReadersSetting />)
    const field = await screen.findByLabelText("Key")
    await user.type(field, "sk-test-123")
    const submit = screen.getByRole("button", { name: "Save key" })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole("combobox", { name: "Provider" }))
    await user.click(screen.getByRole("option", { name: "OpenAI" }))
    await user.click(submit)
    expect(save).toHaveBeenCalledWith("openai", "sk-test-123")
    expect(field).toHaveValue("")
    expect(await screen.findByRole("status")).toHaveTextContent("Saved in the system keyring.")
    expect(screen.queryByDisplayValue("sk-test-123")).not.toBeInTheDocument()
  })

  it("says an older memo cannot do it yet", async () => {
    vi.spyOn(platform, "memoryReaders").mockRejectedValue(new Error("error: unknown command 'readers'"))
    render(<ReadersSetting />)
    expect(await screen.findByText(/cannot read sources for facts yet/)).toBeInTheDocument()
  })
})
