import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AiModel } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import type { AddedSource, Reader } from "@/platform/memory-add-schemas"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { useNav } from "@/shared/nav"
import { useReaders } from "@/shared/readers-store"
import { answerAtOnce } from "@/testing/mock-speed"
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
  problem: null,
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
  await user.click(await screen.findByRole("button", { name: "Add to memory" }))
  const panel = screen.getByRole("region", { name: "Add to memory" })
  // The click moves focus to the panel's title on the next frame; typing before that loses keys to the title.
  await waitFor(() => expect(within(panel).getByRole("heading", { name: "Add to memory" })).toHaveFocus())
  return panel
}

describe("Add to memory", () => {
  beforeEach(() => {
    answerAtOnce()
    useAddSource.setState(useAddSource.getInitialState(), true)
    useReaders.setState(useReaders.getInitialState(), true)
    useMemory.setState(useMemory.getInitialState(), true)
  })

  afterEach(() => vi.restoreAllMocks())

  it("says a wrong address while it is typed, before any click", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", true)])
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /Link/ }))
    const url = within(panel).getByRole("textbox", { name: "Web address" })
    await user.type(url, "example")
    expect(url).toHaveAttribute("aria-invalid", "true")
    expect(within(panel).getByText("Give an address that starts with http:// or https://.")).toBeInTheDocument()
    await user.clear(url)
    await user.type(url, "https://example.org")
    expect(url).not.toHaveAttribute("aria-invalid")
  })

  it("saves pasted text, then keeps only the suggested facts the owner ticked", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", true)])
    const add = vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const suggest = vi.spyOn(platform, "memorySourceSuggest").mockResolvedValue({ batch: BATCH, reused: false })
    const confirm = vi.spyOn(platform, "memoryConfirm").mockResolvedValue(BATCH)
    const user = userEvent.setup()
    const panel = await openPanel(user)

    const save = within(panel).getByRole("button", { name: "Save" })
    await user.click(save)
    expect(within(panel).getByText("Write or paste some text to go on.")).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
    expect(within(panel).getByRole("textbox", { name: "Text" })).toHaveFocus()
    expect(within(panel).getByRole("textbox", { name: "Text" })).toHaveAccessibleDescription(
      "Write or paste some text to go on.",
    )
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

  it("ticks and unticks every suggestion at once", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", true)])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    vi.spyOn(platform, "memorySourceSuggest").mockResolvedValue({ batch: BATCH, reused: false })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "We agreed delivery on the 28th with Lena.")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    await user.click(await within(panel).findByRole("button", { name: "Suggest facts" }, { timeout: 3000 }))

    await user.click(await within(panel).findByRole("button", { name: "Untick all" }))
    expect(within(panel).getByRole("button", { name: "Keep none" })).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Untick all" })).toBeDisabled()
    await user.click(within(panel).getByRole("button", { name: "Tick all" }))
    const all = (BATCH.findings ?? []).length
    expect(within(panel).getByRole("button", { name: `Keep ${all}` })).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Tick all" })).toBeDisabled()
  })

  it("sends the owner to AI model when the chosen AI model reader has no model or key", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([
      { ...reader("ai-model", true), problem: "the AI model has no key: memo models ai set" },
      reader("ollama", false),
    ])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const suggest = vi.spyOn(platform, "memorySourceSuggest").mockRejectedValue("reader.ai-not-set")
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    expect(within(panel).getByText(/has no model or key yet/)).toBeInTheDocument()
    await user.click(await within(panel).findByRole("button", { name: "Suggest facts" }))
    expect(suggest).toHaveBeenCalledWith(ADDED.ref, "ai-model", [], false)
    expect(await within(panel).findByText(/No AI model is chosen yet/)).toBeInTheDocument()
    const go = within(panel).getAllByRole("button", { name: "Open AI model settings" })
    await user.click(go[go.length - 1] as HTMLElement)
    expect(useNav.getState().active).toBe("settings")
  })

  it("never picks a reader for the owner, lets them choose one right there, and saves without facts", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", false)])
    const choose = vi.spyOn(platform, "memoryReaderChoose").mockResolvedValue([reader("ollama", true)])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    await user.click(await within(panel).findByRole("button", { name: "Suggest facts" }))
    expect(await within(panel).findByText("Choose in Settings what reads sources for facts.")).toBeInTheDocument()
    await user.click(within(panel).getByRole("combobox", { name: "Reading for facts" }))
    await user.click(screen.getByRole("option", { name: "Ollama" }))
    await user.click(within(panel).getByRole("button", { name: "Use this reader" }))
    expect(choose).toHaveBeenCalledWith("ollama")
    expect(await within(panel).findByRole("button", { name: "Suggest facts" })).toBeEnabled()
    const only = within(panel).getByRole("button", { name: "Save without facts" })
    expect(only).toHaveAccessibleDescription(/No facts are suggested/)
    await user.click(only)
    expect(within(panel).getByText("Kept (0)")).toBeInTheDocument()
  })

  it("points to Settings when no reader exists on this computer", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    expect(await within(panel).findByRole("button", { name: "Open Settings" })).toBeInTheDocument()
  })

  it("shows what a link holds before it is saved", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    const look = vi.spyOn(platform, "memoryLinkPreview").mockResolvedValue({
      url: "https://example.org/plan",
      title: "Q3 plan",
      site: "example.org",
      description: "What ships in July",
      excerpt: "Delivery moves to the 28th.",
      kind: "web-page",
      chars: 3200,
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /Link/ }))
    await user.type(within(panel).getByRole("textbox", { name: "Web address" }), "https://example.org/plan")
    const card = await within(panel).findByRole("region", { name: "What will be saved" }, { timeout: 3000 })
    expect(look).toHaveBeenCalledTimes(1)
    expect(look).toHaveBeenCalledWith("https://example.org/plan")
    expect(within(card).getByText("Q3 plan")).toBeInTheDocument()
    expect(within(card).getByText(/Delivery moves to the 28th/)).toBeInTheDocument()
  })

  const AI: AiModel = {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    baseUrl: null,
    origin: "https://api.anthropic.com",
    beta: false,
    images: true,
    key: { stored: true, source: "keyring" },
  }

  it("shows a picked picture as a thumbnail and says no model will read it, with the way to Settings", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue({ ...AI, provider: null, model: null, images: false })
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memoryPickFile").mockResolvedValue("/home/u/whiteboard.png")
    vi.spyOn(platform, "memoryFilePreview").mockResolvedValue({
      name: "whiteboard.png",
      bytes: 2048,
      mime: "image/png",
      image: "data:image/png;base64,iVBORw==",
      excerpt: null,
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /File/ }))
    await user.click(within(panel).getByRole("button", { name: "Choose a file" }))
    expect(await within(panel).findByRole("img", { name: "Preview of whiteboard.png" })).toHaveAttribute(
      "src",
      "data:image/png;base64,iVBORw==",
    )
    expect(
      await within(panel).findByText(/No AI model is set, so this picture will be kept by its name only/),
    ).toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: "Open AI model settings" }))
    expect(useNav.getState().active).toBe("settings")
  })

  it("says before adding which model reads the picture and where it goes", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(AI)
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memoryPickFile").mockResolvedValue("/home/u/whiteboard.png")
    vi.spyOn(platform, "memoryFilePreview").mockResolvedValue({
      name: "whiteboard.png",
      bytes: 2048,
      mime: "image/png",
      image: "data:image/png;base64,iVBORw==",
      excerpt: null,
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /File/ }))
    await user.click(within(panel).getByRole("button", { name: "Choose a file" }))
    expect(
      await within(panel).findByText(
        /read by anthropic\/claude-haiku-4-5\. The picture is sent to api\.anthropic\.com/,
      ),
    ).toBeInTheDocument()
  })

  it("asks for a memo update, not for a model, when memo has no models ai", async () => {
    vi.spyOn(platform, "aiModelShow").mockRejectedValue(new Error("error: unknown command 'ai'"))
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memoryPickFile").mockResolvedValue("/home/u/whiteboard.png")
    vi.spyOn(platform, "memoryFilePreview").mockResolvedValue({
      name: "whiteboard.png",
      bytes: 2048,
      mime: "image/png",
      image: "data:image/png;base64,iVBORw==",
      excerpt: null,
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /File/ }))
    await user.click(within(panel).getByRole("button", { name: "Choose a file" }))
    expect(await within(panel).findByText(/Pictures cannot be read with an AI model yet/)).toBeInTheDocument()
    expect(within(panel).getByText(/This needs a newer Memo than/)).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(within(panel).queryByText(/No AI model is set/)).not.toBeInTheDocument()
  })

  it("does not claim no model is set when memo could not be asked", async () => {
    vi.spyOn(platform, "aiModelShow").mockRejectedValue(new Error("memo.refused"))
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memoryPickFile").mockResolvedValue("/home/u/whiteboard.png")
    vi.spyOn(platform, "memoryFilePreview").mockResolvedValue({
      name: "whiteboard.png",
      bytes: 2048,
      mime: "image/png",
      image: "data:image/png;base64,iVBORw==",
      excerpt: null,
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /File/ }))
    await user.click(within(panel).getByRole("button", { name: "Choose a file" }))
    expect(await within(panel).findByText(/could not look at the AI model/)).toBeInTheDocument()
    expect(within(panel).queryByText(/No AI model is set/)).not.toBeInTheDocument()
  })

  const picture = (over: Partial<AddedSource>): AddedSource => ({
    ...ADDED,
    kind: "file",
    mime: "image/png",
    title: "whiteboard.png",
    ...over,
  })

  const addPicture = async (added: AddedSource) => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(AI)
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([])
    vi.spyOn(platform, "memoryPickFile").mockResolvedValue("/home/u/whiteboard.png")
    vi.spyOn(platform, "memoryFilePreview").mockResolvedValue(null)
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(added)
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /File/ }))
    await user.click(within(panel).getByRole("button", { name: "Choose a file" }))
    await user.click(await within(panel).findByRole("button", { name: "Save" }))
    return { user, panel }
  }

  it("says who recognised the text of a picture", async () => {
    const { panel } = await addPicture(picture({ image: { readBy: "anthropic/claude-haiku-4-5", reason: null } }))
    expect(await within(panel).findByText("Text recognised by anthropic/claude-haiku-4-5.")).toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: "Open AI model settings" })).not.toBeInTheDocument()
  })

  it.each([
    ["ai.not-set", /No AI model is set, so the picture is kept by its name only/, true],
    ["ai.images-not-allowed", /Reading pictures is off/, true],
    ["ai.key-missing", /no API key saved/, true],
    ["ai.failed", /could not read the picture/, true],
    ["ai.empty-answer", /This model seems not to read pictures/, true],
    ["image.unsupported", /GIF, over 4 MB/, false],
  ])("words %s for a picture kept by its name", async (reason, text, linked) => {
    const { panel } = await addPicture(picture({ read: "no-text", chars: 0, image: { readBy: null, reason } }))
    expect(await within(panel).findByText(text)).toBeInTheDocument()
    expect(!!within(panel).queryByRole("button", { name: "Open AI model settings" })).toBe(linked)
  })

  it("tells the owner to update memo when it cannot list readers yet, and still saves", async () => {
    vi.spyOn(platform, "memoryReaders").mockRejectedValue(new Error("error: unknown command 'readers'"))
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    expect(await within(panel).findByText(/This needs a newer Memo than/)).toBeInTheDocument()
    expect(within(panel).getByText("Sources can be read for facts after the update.")).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Suggest facts" })).toBeEnabled()
  })

  it("reads again with the reader chosen now, says who reads it, and lists only what memo linked", async () => {
    vi.spyOn(platform, "memoryReaders").mockResolvedValue([reader("ollama", true)])
    vi.spyOn(platform, "memorySourceAdd").mockResolvedValue(ADDED)
    const decided = { ...BATCH, status: "approved", model: "codex/gpt-5" } as MemoryEntry
    const suggest = vi.spyOn(platform, "memorySourceSuggest").mockResolvedValue({ batch: decided, reused: true })
    const confirm = vi.spyOn(platform, "memoryConfirm")
    vi.spyOn(platform, "memorySourceShow").mockResolvedValue({
      ref: "document:42",
      title: "Call with Lena",
      kind: "text",
      url: null,
      fileName: null,
      kept: "text",
      chars: 120,
      text: "notes",
      textTruncated: false,
      subjects: [{ ref: "organization:3", confirmed: true }],
    })
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    await user.click(await within(panel).findByRole("checkbox", { name: "Lena Ortiz" }, { timeout: 3000 }))
    await user.click(within(panel).getByRole("button", { name: "Suggest facts" }))

    expect(await within(panel).findByText(/already decided on the Memory page/)).toBeInTheDocument()
    expect(within(panel).getByText(/Ollama \(llama3.2\) reads its text/)).toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: "Read it again" }))
    expect(suggest).toHaveBeenLastCalledWith("document:42", "ollama", ["person:7"], true)
    await user.click(within(panel).getByRole("button", { name: "Done" }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await within(panel).findByText("Northbridge Bench")).toBeInTheDocument()
    expect(within(panel).queryByText("Lena Ortiz")).not.toBeInTheDocument()
  })

  it("words a refusal of pasted text without memo's own message", async () => {
    vi.spyOn(platform, "memorySourceAdd").mockRejectedValue(new Error("memo.refused"))
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.type(within(panel).getByRole("textbox", { name: "Text" }), "notes")
    await user.click(within(panel).getByRole("button", { name: "Save" }))
    expect(await within(panel).findByText(/refused with no reason WireCat can show/)).toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: /Report/ })).not.toBeInTheDocument()
  })

  it("words memo's refusal of a link and stays on the step", async () => {
    vi.spyOn(platform, "memorySourceAdd").mockRejectedValue(new Error("source.needs-sign-in"))
    const user = userEvent.setup()
    const panel = await openPanel(user)
    await user.click(within(panel).getByRole("radio", { name: /Link/ }))
    const save = within(panel).getByRole("button", { name: "Save" })
    await user.type(within(panel).getByRole("textbox", { name: "Web address" }), "docs.google.com/x")
    await user.click(save)
    expect(within(panel).getByText(/Give an address that starts with http/)).toBeInTheDocument()
    await user.clear(within(panel).getByRole("textbox", { name: "Web address" }))
    await user.type(within(panel).getByRole("textbox", { name: "Web address" }), "https://docs.google.com/x")
    await user.click(save)
    await waitFor(() => expect(within(panel).getByText(/The page asks you to sign in/)).toBeInTheDocument())
    expect(within(panel).getByText(/Source · 1 of 4/)).toBeInTheDocument()
  })
})
