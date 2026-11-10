import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Reader } from "@/platform/memory-add-schemas"
import { useReaders } from "@/shared/readers-store"
import { useTools } from "@/shared/tools-store"
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
  beforeEach(() => {
    useReaders.setState(useReaders.getInitialState(), true)
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: "0.131.72", manager: "npm", problem: null }] },
    })
  })

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
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(screen.getByText("Choose a reader first.")).toBeInTheDocument()
    expect(choose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: /Claude Code/ }))
    await user.keyboard("{ArrowDown}")
    await user.click(ollama)
    expect(choose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledTimes(1)
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
    await user.click(submit)
    expect(screen.getByText("Choose a provider first.")).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole("combobox", { name: "Provider" }))
    await user.click(screen.getByRole("option", { name: "OpenAI" }))
    await user.click(submit)
    expect(save).toHaveBeenCalledWith("openai", "sk-test-123")
    expect(field).toHaveValue("")
    expect(await screen.findByRole("status")).toHaveTextContent("Saved in the system keyring.")
    expect(screen.queryByDisplayValue("sk-test-123")).not.toBeInTheDocument()
  })

  it("is not shown, and asks memo nothing, when memo is not installed", () => {
    useTools.setState({ installs: {} })
    const readers = vi.spyOn(platform, "memoryReaders")
    render(<ReadersSetting />)
    expect(screen.queryByRole("region", { name: "Reading for facts" })).not.toBeInTheDocument()
    expect(readers).not.toHaveBeenCalled()
  })

  it("says an older memo cannot do it yet", async () => {
    vi.spyOn(platform, "memoryReaders").mockRejectedValue(new Error("error: unknown command 'readers'"))
    render(<ReadersSetting />)
    expect(await screen.findByText(/cannot read sources for facts yet/)).toBeInTheDocument()
  })
})
