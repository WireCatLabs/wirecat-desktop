import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { Finding } from "@/domain/doctor"
import { platform } from "@/platform/bridge"
import { ConfigFix, forgetDetectedAgents } from "./ConfigFix"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
const broken: Finding = {
  tone: "bad",
  text: "The settings file is not valid JSON.",
  config: { kind: "invalid_json", file: "~/.config/tg-cli/config.json", line: 9, column: 3 },
}

beforeEach(() => {
  forgetDetectedAgents()
  vi.spyOn(platform, "detectAgents").mockResolvedValue([
    { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
    { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
    { id: "gemini", name: "Gemini CLI", foundBy: "folder", reads: ["agents"] },
    { id: "hermes", name: "Hermes Agent", foundBy: "program", reads: ["hermes"] },
  ])
})
afterEach(() => vi.restoreAllMocks())

describe("a settings problem handed to an agent", () => {
  it("copies a prompt that names the file and the place", async () => {
    const user = userEvent.setup()
    render(<ConfigFix tool={tg} finding={broken} profile="work" />)
    await user.click(screen.getByRole("button", { name: "Copy prompt for an agent" }))
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain("File: ~/.config/tg-cli/config.json")
    expect(copied).toContain("Where: line 9, column 3")
    expect(screen.getByRole("button", { name: "Prompt copied" })).toBeInTheDocument()
  })

  it("offers only agents found as a program that take a first prompt, and starts the chosen one with it", async () => {
    const fix = vi.spyOn(platform, "fixInAgent").mockResolvedValue()
    const user = userEvent.setup()
    render(<ConfigFix tool={tg} finding={broken} profile="work" />)
    await user.click(await screen.findByRole("button", { name: "Fix in another agent" }))
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent)
    expect(items).toEqual(["Fix in Codex"])
    await user.click(screen.getByRole("menuitem", { name: "Fix in Codex" }))
    expect(fix).toHaveBeenCalledWith("codex", "tg", expect.stringContaining("Where: line 9, column 3"))
    expect(await screen.findByText(/This is the browser preview, so nothing opens/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fix in Claude Code" })).toBeInTheDocument()
  })

  it("with no such agent, offers the prompt to copy and no Fix button", async () => {
    vi.mocked(platform.detectAgents).mockResolvedValue([])
    render(<ConfigFix tool={tg} finding={broken} profile="work" />)
    expect(await screen.findByRole("button", { name: "Copy prompt for an agent" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Fix in/ })).toBeNull()
  })
})
