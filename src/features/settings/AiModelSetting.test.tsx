import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LANGS } from "@/i18n"
import type { AiChecked, AiModel } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { useAiModel } from "@/shared/ai-model-store"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor } from "@/testing/render"
import { AiModelSetting } from "./AiModelSetting"
import { aiModelMessages, CHECK_REASONS, SAVE_REASONS } from "./messages-ai-model"

const NONE: AiModel = {
  provider: null,
  model: null,
  baseUrl: null,
  origin: null,
  beta: false,
  images: false,
  key: { stored: false, source: null },
}
const ANTHROPIC: AiModel = {
  ...NONE,
  provider: "anthropic",
  model: "claude-haiku-4-5",
  origin: "https://api.anthropic.com",
  images: true,
  key: { stored: true, source: "keyring" },
}
const checked = (reason: string, over: Partial<AiChecked> = {}): AiChecked => ({
  ok: reason === "ai.ok",
  reason,
  ms: null,
  provider: "anthropic",
  model: "claude-haiku-4-5",
  origin: "https://api.anthropic.com",
  ...over,
})

describe("AI model", () => {
  beforeEach(() => {
    useAiModel.setState(useAiModel.getInitialState(), true)
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: "0.132.0", manager: "npm", problem: null }] },
    })
  })

  it("saves Anthropic with the key handed on once, cleared and never shown back", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(NONE)
    const set = vi.spyOn(platform, "aiModelSet").mockResolvedValue(ANTHROPIC)
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("radio", { name: "Anthropic (Claude)" }))
    expect(screen.queryByLabelText("Address (base URL)")).not.toBeInTheDocument()
    const key = screen.getByLabelText("API key")
    await user.type(key, "sk-ant-test-123")
    await user.type(screen.getByLabelText("Model"), "claude-haiku-4-5")
    expect(screen.getByText(/leave this computer and go to api\.anthropic\.com/)).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Read pictures with this model" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(set).toHaveBeenCalledWith({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      baseUrl: null,
      key: "sk-ant-test-123",
      images: true,
    })
    expect(key).toHaveValue("")
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.")
    expect(screen.queryByDisplayValue("sk-ant-test-123")).not.toBeInTheDocument()
    expect(await screen.findByText(/A key is saved/)).toBeInTheDocument()
    expect(screen.getByText(/system's password store/)).toBeInTheDocument()
  })

  it("sends an OpenAI compatible address, names it in the consent, and keeps the key out when none is typed", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue({
      ...ANTHROPIC,
      provider: "openai",
      model: "openai/gpt-4o-mini",
      images: false,
      key: { stored: true, source: "file" },
    })
    const set = vi.spyOn(platform, "aiModelSet").mockResolvedValue(ANTHROPIC)
    const user = userEvent.setup()
    render(<AiModelSetting />)
    const url = await screen.findByLabelText("Address (base URL)")
    expect(screen.getByText(/only your user can read/)).toBeInTheDocument()
    expect(screen.getByText(/https:\/\/openrouter\.ai\/api\/v1\. Then type the model/)).toBeInTheDocument()
    await user.type(url, "https://openrouter.ai/api/v1")
    expect(screen.getByText(/go to openrouter\.ai/)).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Read pictures with this model" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(set).toHaveBeenCalledWith({
      provider: "openai",
      model: "openai/gpt-4o-mini",
      baseUrl: "https://openrouter.ai/api/v1",
      key: null,
      images: true,
    })
  })

  it("asks Ollama for no key and no address, and says the pictures stay here", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(NONE)
    const set = vi.spyOn(platform, "aiModelSet").mockResolvedValue({ ...ANTHROPIC, provider: "ollama", model: "llava" })
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("radio", { name: "Ollama on this computer (beta)" }))
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Address (base URL)")).not.toBeInTheDocument()
    expect(screen.getByText(/Nothing leaves this computer/)).toBeInTheDocument()
    expect(screen.getByText(/stay on this computer/)).toBeInTheDocument()
    await user.type(screen.getByLabelText("Model"), "llava")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(set).toHaveBeenCalledWith({ provider: "ollama", model: "llava", baseUrl: null, key: null, images: false })
  })

  it("words a refused address, and shows the key field empty again", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue({ ...NONE, provider: "openai", model: "m" })
    vi.spyOn(platform, "aiModelSet").mockRejectedValue(new Error("ai.address-refused"))
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.type(await screen.findByLabelText("Address (base URL)"), "http://example.org/v1")
    await user.type(screen.getByLabelText("API key"), "sk-test")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/This address is not allowed/)
    expect(screen.getByLabelText("API key")).toHaveValue("")
  })

  it("checks only the saved model and says what the check costs", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(ANTHROPIC)
    const check = vi.spyOn(platform, "aiModelCheck").mockResolvedValue(checked("ai.ok", { ms: 840 }))
    const user = userEvent.setup()
    render(<AiModelSetting />)
    const button = await screen.findByRole("button", { name: "Check" })
    expect(screen.getByText(/billed by your provider/)).toBeInTheDocument()
    await user.type(screen.getByLabelText("Model"), "-x")
    expect(button).toBeDisabled()
    expect(screen.getByText(/Save your changes first/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Model"))
    await user.type(screen.getByLabelText("Model"), "claude-haiku-4-5")
    await user.click(button)
    expect(check).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Works: claude-haiku-4-5 answered in 840 ms.")).toBeInTheDocument()
  })

  it.each([
    ["ai.key-rejected", /api\.anthropic\.com refused the key/],
    ["ai.no-credit", /no credit left/],
    ["ai.model-unknown", /no model called claude-haiku-4-5/],
    ["ai.rate-limited", /busy or the limit is reached/],
    ["ai.unreachable", /Cannot reach api\.anthropic\.com/],
    ["ai.provider-error", /problem on its side/],
    ["ai.something-new", /no words for/],
  ])("shows %s as a plain line", async (reason, text) => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(ANTHROPIC)
    vi.spyOn(platform, "aiModelCheck").mockResolvedValue(checked(reason))
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Check" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(text)
  })

  it("tells Ollama's user what to run", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue({ ...ANTHROPIC, provider: "ollama", model: "llava" })
    vi.spyOn(platform, "aiModelCheck").mockResolvedValue(
      checked("ai.unreachable", { provider: "ollama", origin: "http://localhost:11434" }),
    )
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Check" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Ollama is not running. Start it, then check again.")
  })

  it("turns the model off and reads it back", async () => {
    const show = vi.spyOn(platform, "aiModelShow").mockResolvedValueOnce(ANTHROPIC).mockResolvedValue(NONE)
    const off = vi.spyOn(platform, "aiModelOff").mockResolvedValue({ changed: true, keyKept: true })
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(off).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument())
    expect(show).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/No AI model is set/)).toBeInTheDocument()
  })

  it("names the action that failed, and words a refusal memo did not explain", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(ANTHROPIC)
    vi.spyOn(platform, "aiModelOff").mockRejectedValue(new Error("another run holds the store"))
    vi.spyOn(platform, "aiModelCheck").mockRejectedValue(new Error("the process was killed"))
    const set = vi.spyOn(platform, "aiModelSet").mockRejectedValue(new Error("memo.refused"))
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("It was not turned off: another run holds the store")
    await user.click(screen.getByRole("button", { name: "Check" }))
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The check could not run: the process was killed"),
    )
    await user.type(screen.getByLabelText("API key"), "sk-ant-test")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/memo refused the request/))
    expect(set).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("alert")).not.toHaveTextContent("memo.refused")
  })

  it("drops a key, a model name and an address typed for another provider when the provider changes", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(ANTHROPIC)
    const set = vi.spyOn(platform, "aiModelSet").mockResolvedValue(ANTHROPIC)
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.type(await screen.findByLabelText("API key"), "sk-ant-secret")
    await user.click(screen.getByRole("radio", { name: "Ollama on this computer (beta)" }))
    expect(screen.getByLabelText("Model")).toHaveValue("")
    await user.type(screen.getByLabelText("Model"), "llava")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(set).toHaveBeenCalledWith({ provider: "ollama", model: "llava", baseUrl: null, key: null, images: true })
  })

  it("is off even when the read after turning off fails", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValueOnce(ANTHROPIC).mockRejectedValue(new Error("busy"))
    vi.spyOn(platform, "aiModelOff").mockResolvedValue({ changed: true, keyKept: true })
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(await screen.findByText(/The AI model is off/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument()
  })

  it("does not word what memo said about a provider, which may quote a key", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(ANTHROPIC)
    vi.spyOn(platform, "aiModelCheck").mockResolvedValue(checked("constructor"))
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Check" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/no words for/)
  })

  it("says the model is off after it was turned off", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValueOnce(ANTHROPIC).mockResolvedValue(NONE)
    vi.spyOn(platform, "aiModelOff").mockResolvedValue({ changed: true, keyKept: true })
    const user = userEvent.setup()
    render(<AiModelSetting />)
    await user.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(await screen.findByText(/The AI model is off. Your key stays where it is/)).toBeInTheDocument()
  })

  it("asks for a memo update when memo has no models ai", async () => {
    vi.spyOn(platform, "aiModelShow").mockRejectedValue(new Error("error: unknown command 'ai'"))
    render(<AiModelSetting />)
    expect(await screen.findByText(/cannot use an AI model yet/)).toBeInTheDocument()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })

  it("is not shown, and asks memo nothing, when memo is not installed", () => {
    useTools.setState({ installs: {} })
    const show = vi.spyOn(platform, "aiModelShow")
    render(<AiModelSetting />)
    expect(screen.queryByRole("region", { name: "AI model" })).not.toBeInTheDocument()
    expect(show).not.toHaveBeenCalled()
  })
})

describe("AI model texts", () => {
  const said = { host: "api.example.com", model: "m1", ms: 5, ollama: false }

  it.each(LANGS)("%s words every reason of the check and of a save", (lang) => {
    const m = aiModelMessages[lang]
    for (const reason of CHECK_REASONS) {
      expect(m.checkReasons[reason]?.(said), `${lang} ${reason}`).toBeTruthy()
      expect(m.checkReasons[reason]?.({ ...said, ollama: true })).toBeTruthy()
    }
    for (const reason of SAVE_REASONS) expect(m.saveReasons[reason], `${lang} ${reason}`).toBeTruthy()
  })

  it.each(LANGS)("%s keeps the WireCat voice: no semicolons, no long dashes", (lang) => {
    const m = aiModelMessages[lang]
    const lines = [
      ...Object.values(m).filter((v): v is string => typeof v === "string"),
      ...Object.values(m.providers),
      ...Object.values(m.saveReasons),
      ...CHECK_REASONS.map((r) => m.checkReasons[r]?.(said) ?? ""),
      m.imagesConsent("h", true),
      m.imagesConsent("h", false),
    ]
    for (const line of lines) expect(line).not.toMatch(/[;—–]/)
  })
})
