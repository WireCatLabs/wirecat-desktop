import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { CommandError, TOO_OLD } from "@/platform/command-error"
import type { Reader } from "@/platform/memory-add-schemas"
import { useNav } from "@/shared/nav"
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

const pick = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole("combobox", { name: "Reading for facts" }))
  await user.click(screen.getByRole("option", { name }))
}

describe("Reading for facts", () => {
  beforeEach(() => {
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
    const select = await screen.findByRole("combobox", { name: "Reading for facts" })
    expect(select).toHaveTextContent("Choose who reads")
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(screen.getByText("Choose a reader first.")).toBeInTheDocument()
    await pick(user, "Codex")
    expect(screen.getByText(/Codex can also open files/)).toBeInTheDocument()
    await pick(user, "Ollama")
    expect(screen.getByText("The text does not leave this computer.")).toBeInTheDocument()
    expect(choose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith("ollama")
    await waitFor(() => expect(select).toHaveTextContent("Ollama"))
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    await waitFor(() => expect(screen.getByText(/This reader is already in use/)).toBeInTheDocument())
    expect(choose).toHaveBeenCalledTimes(1)
  })

  it("recommends the AI model reader and has no key field of its own", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([
      reader("ai-model"),
      reader("ollama", { leavesComputer: false }),
    ])
    const user = userEvent.setup()
    render(<ReadersSetting />)
    await pick(user, "AI model (recommended)")
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
    await pick(user, "AI model (recommended)")
    await user.click(screen.getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledWith("ai-model")
    expect(await screen.findByText("Choose a model and its key in AI model first.")).toBeInTheDocument()
    expect(screen.queryByText(/memo models/)).not.toBeInTheDocument()
    await pick(user, "OpenAI")
    expect(screen.getByText(/Needs its own key/)).toBeInTheDocument()
    await pick(user, "Ollama")
    expect(screen.getByText("Not found on this computer")).toBeInTheDocument()
    await pick(user, "OpenAI")
    const go = screen.getAllByRole("button", { name: "Open AI model" })
    expect(go).toHaveLength(1)
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

  it("says memo is needed, and asks memo nothing, once the tools show it is not installed", () => {
    useTools.setState({ installs: { memo: [] } })
    const readers = vi.spyOn(platform, "memoryReaders")
    render(<ReadersSetting />)
    expect(screen.getByRole("region", { name: "Reading for facts" })).toHaveTextContent(
      "This page reads Memo, which is not installed.",
    )
    expect(readers).not.toHaveBeenCalled()
  })

  it("says an older memo cannot do it yet", async () => {
    vi.spyOn(platform, "memoryReaders").mockRejectedValue(new CommandError(TOO_OLD, "error: unknown command 'readers'"))
    render(<ReadersSetting />)
    expect(await screen.findByText(/This needs a newer Memo than/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
  })
})
