import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Reader } from "@/platform/memory-add-schemas"
import { useNav } from "@/shared/nav"
import { useReaders } from "@/shared/readers-store"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor } from "@/testing/render"
import { ReadersSetting } from "./ReadersSetting"

const NEW = findTool("memo")?.memory?.minVersion ?? ""

const reader = (id: string, over: Partial<Reader> = {}): Reader => ({
  id,
  available: true,
  signedIn: true,
  model: null,
  provider: null,
  leavesComputer: true,
  readsFiles: false,
  chosen: false,
  problem: null,
  ...over,
})

describe("Reading for facts", () => {
  beforeEach(() => {
    useReaders.setState(useReaders.getInitialState(), true)
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: NEW, manager: "npm", problem: null }] },
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
    await user.click(screen.getByRole("radio", { name: /Claude Code/ }))
    await user.keyboard("{ArrowDown}")
    await user.click(ollama)
    expect(choose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith("ollama")
    await waitFor(() => expect(screen.getByRole("radio", { name: /Ollama/ })).toBeChecked())
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/This reader is already in use/)).toBeInTheDocument()
  })

  it("recommends the AI model reader and has no key field of its own", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([
      reader("ai-model"),
      reader("ollama", { leavesComputer: false }),
    ])
    render(<ReadersSetting />)
    const ai = await screen.findByRole("radio", { name: /^AI model/ })
    expect(ai).toBeEnabled()
    expect(screen.getByText("Recommended")).toBeInTheDocument()
    expect(screen.getByText(/one key you set in AI model above/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Key")).not.toBeInTheDocument()
    expect(screen.queryByText(/Update Memo/)).not.toBeInTheDocument()
  })

  it("points to AI model when the AI model reader or a key reader cannot read yet", async () => {
    const listed = (chosen: boolean) => [
      reader("ai-model", { chosen, available: false, problem: "no AI model is chosen: memo models ai set" }),
      reader("openai", { signedIn: false, problem: "no OpenAI key: memo models keys set openai" }),
      reader("ollama", { available: false, problem: "Ollama is not running on this computer" }),
    ]
    vi.spyOn(platform, "memoryReaders").mockResolvedValue(listed(false))
    useNav.setState({ active: "memory" })
    const user = userEvent.setup()
    render(<ReadersSetting />)
    const choose = vi.spyOn(platform, "memoryReaderChoose").mockResolvedValue(listed(true))
    const ai = await screen.findByRole("radio", { name: /^AI model/ })
    await user.click(ai)
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledWith("ai-model")
    await waitFor(() => expect(screen.getByRole("radio", { name: /^AI model/ })).toBeChecked())
    expect(screen.getByText("Choose a model and its key in AI model first.")).toBeInTheDocument()
    expect(screen.getByText(/Needs its own key/)).toBeInTheDocument()
    expect(screen.getByText("Not found on this computer")).toBeInTheDocument()
    expect(screen.queryByText(/memo models/)).not.toBeInTheDocument()
    const go = screen.getAllByRole("button", { name: "Open AI model" })
    expect(go).toHaveLength(2)
    await user.click(go[0] as HTMLElement)
    expect(useNav.getState().active).toBe("settings")
  })

  it("asks an older memo to update for the AI model reader", async () => {
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: "0.131.75", manager: "npm", problem: null }] },
    })
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama")])
    render(<ReadersSetting />)
    expect(await screen.findByText(/Update Memo on the Tools page/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Key")).not.toBeInTheDocument()
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
