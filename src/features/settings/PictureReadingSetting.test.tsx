import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LANGS } from "@/i18n"
import type { PictureReadingSetting as Setting } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { fileActionMessages } from "@/shared/messages-file-actions"
import { useTools } from "@/shared/tools-store"
import { render, screen } from "@/testing/render"
import { pictureReadingMessages } from "./messages-picture-reading"
import { PictureReadingSetting } from "./PictureReadingSetting"

const never: Setting = { mode: "never", agent: null, model: null, extractor: null, since: null }
const codex: Setting = {
  mode: "request",
  agent: "codex",
  model: "gpt-5",
  extractor: "agent:codex/gpt-5",
  since: "2026-11-12T09:12:00.000Z",
}

describe("Reading pictures", () => {
  beforeEach(() => {
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: "0.131.86", manager: "npm", problem: null }] },
    })
  })

  it("turns on only once the owner picks an agent, saying so at the agents when pressed before, with the warning shown and memo's answer kept", async () => {
    vi.spyOn(platform, "pictureReadingStatus").mockResolvedValue({ state: "ready", setting: never })
    const set = vi.spyOn(platform, "pictureReadingSet").mockResolvedValue(codex)
    const user = userEvent.setup()
    render(<PictureReadingSetting />)

    expect(await screen.findByRole("radio", { name: "Never" })).toBeChecked()
    expect(screen.getByText(/No picture leaves this computer/)).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "On request" }))

    expect(screen.getByText(/goes to Claude Code or Codex and from there to its provider/)).toBeVisible()
    expect(screen.getByText(/“Only this computer” setting does not stop it/)).toBeInTheDocument()
    const turnOn = screen.getByRole("button", { name: "Turn on" })
    expect(turnOn).toBeEnabled()
    await user.click(turnOn)
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the agent that reads")
    expect(screen.getByRole("radio", { name: "Claude Code" })).toHaveFocus()
    expect(screen.getByRole("radio", { name: "Claude Code" })).not.toBeChecked()
    expect(set).not.toHaveBeenCalled()

    await user.click(screen.getByRole("radio", { name: "Codex" }))
    await user.type(screen.getByRole("textbox", { name: "Model" }), " gpt-5 ")
    await user.click(turnOn)

    expect(set).toHaveBeenCalledWith("request", "codex", "gpt-5")
    expect(await screen.findByText(/On request, read by Codex with gpt-5 since/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })

  it("turns off at once, sending nothing else", async () => {
    vi.spyOn(platform, "pictureReadingStatus").mockResolvedValue({ state: "ready", setting: codex })
    const set = vi.spyOn(platform, "pictureReadingSet").mockResolvedValue(never)
    render(<PictureReadingSetting />)

    await userEvent.setup().click(await screen.findByRole("radio", { name: "Never" }))

    expect(set).toHaveBeenCalledWith("never", null, null)
    expect(await screen.findByText(/No picture leaves this computer/)).toBeInTheDocument()
  })

  it.each([
    ["picture-reading.owner-only", /Only you can turn this on/],
    ["picture-reading.agent-missing", /Choose the agent that reads: Claude Code or Codex/],
  ])("words memo's %s", async (reason, text) => {
    vi.spyOn(platform, "pictureReadingStatus").mockResolvedValue({ state: "ready", setting: never })
    vi.spyOn(platform, "pictureReadingSet").mockRejectedValue(new Error(reason))
    const user = userEvent.setup()
    render(<PictureReadingSetting />)

    await user.click(await screen.findByRole("radio", { name: "On request" }))
    await user.click(screen.getByRole("radio", { name: "Claude Code" }))
    await user.click(screen.getByRole("button", { name: "Turn on" }))

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(reason)).toBeNull()
  })

  it("says an unknown refusal in its own words and folds memo's text under Details", async () => {
    vi.spyOn(platform, "pictureReadingStatus").mockResolvedValue({ state: "ready", setting: never })
    vi.spyOn(platform, "pictureReadingSet").mockRejectedValue(new Error("store.busy: another process holds it"))
    const user = userEvent.setup()
    render(<PictureReadingSetting />)

    await user.click(await screen.findByRole("radio", { name: "On request" }))
    await user.click(screen.getByRole("radio", { name: "Claude Code" }))
    await user.click(screen.getByRole("button", { name: "Turn on" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Could not change it\./)
    expect(screen.queryByText(/store\.busy/)).toBeNull()
    await user.click(screen.getByRole("button", { name: "Details" }))
    expect(screen.getByText("store.busy: another process holds it")).toBeInTheDocument()
  })

  it("asks for a memo update while no memo with it is released", async () => {
    vi.spyOn(platform, "pictureReadingStatus").mockResolvedValue({ state: "old", version: "0.131.85", need: null })
    render(<PictureReadingSetting />)
    expect(await screen.findByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(screen.queryByRole("radio")).toBeNull()
  })
})

describe("Reading pictures texts", () => {
  it.each(LANGS)("%s has no semicolons, long dashes or ё", (lang) => {
    const m = pictureReadingMessages[lang]
    const f = fileActionMessages[lang]
    const lines = [
      m.heading,
      m.intro,
      m.warning,
      m.modelHint,
      m.off,
      m.ownerOnly,
      m.agentMissing,
      m.onSince("Codex", "gpt-5", "12 Nov"),
      f.read,
      f.open,
      f.reading,
      f.off,
      f.unavailable("codex"),
      f.notPicture,
      f.unavailableFile,
      f.failed,
      f.timeout,
    ]
    for (const line of lines) {
      expect(line, `${lang}: ${line}`).toBeTruthy()
      expect(line).not.toMatch(/[;—ё]/)
    }
  })
})
