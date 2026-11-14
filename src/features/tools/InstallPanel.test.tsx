import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { InstallSession } from "@/domain/status"
import { useAgents } from "@/shared/agents-store"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { render, screen, within } from "@/testing/render"
import { useSync } from "./sync-store"
import { ToolRow } from "./ToolRow"

const done = (version: string): InstallSession => ({
  operation: "install",
  step: "verify",
  log: [],
  outcome: { event: "done", version, path: "~/bin/x", shadowedBy: null },
})

const rows = (ids: string[]) =>
  render(
    <ul>
      {ids.map((id) => {
        const tool = findTool(id)
        return tool ? <ToolRow key={id} tool={tool} /> : null
      })}
    </ul>,
  )

const row = (name: string) => screen.getAllByRole("listitem").find((li) => within(li).queryByText(name)) as HTMLElement
const panelOpen = (name: string) => {
  const panel = row(name).querySelector<HTMLElement>('[data-state="open"]')
  return panel !== null && within(panel).queryByRole("button", { name: "Done" }) !== null
}
describe("Done on a finished install", () => {
  it("closes only that tool's panel", async () => {
    useTools.setState({ sessions: { tg: done("0.89.0"), wa: done("0.7.0") } })
    rows(["tg", "wa"])

    await userEvent.click(within(row("Telegram")).getByRole("button", { name: "Done" }))

    expect(panelOpen("Telegram")).toBe(false)
    expect(panelOpen("WhatsApp")).toBe(true)
  })
})

describe("the agent instructions an update refreshed", () => {
  const updated = (skills: { refreshed: ("claude" | "agents")[]; failed: string | null }): InstallSession => ({
    ...done("0.112.0"),
    outcome: { event: "done", version: "0.112.0", path: "~/bin/tg", shadowedBy: null, skills },
  })

  beforeEach(() => {
    useNav.setState({ active: "tools", past: [], next: [] })
  })

  it("names the agents on this computer that read the copies rewritten", () => {
    useAgents.setState({
      agents: [
        { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
        { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
        { id: "gemini", name: "Gemini CLI", foundBy: null, reads: ["agents"] },
      ],
    })
    useTools.setState({ sessions: { tg: updated({ refreshed: ["claude", "agents"], failed: null }) } })
    rows(["tg"])

    expect(screen.getByText("Updated the instructions for Claude Code and Codex to this version.")).toBeTruthy()
  })

  it("warns when they could not be updated, and the button opens Agents from the keyboard", async () => {
    useTools.setState({ sessions: { tg: updated({ refreshed: [], failed: "EACCES" }) } })
    rows(["tg"])

    expect(screen.getByText(/The update is installed, but the instructions for your AI agents/)).toBeTruthy()
    expect(screen.getByText(/is installed and runs/)).toBeTruthy()
    screen.getByRole("button", { name: "Open Agents" }).focus()
    await userEvent.keyboard("{Enter}")
    expect(useNav.getState().active).toBe("agents")
  })
})

describe("the install steps", () => {
  it("are listed before the install starts, as plain text with nothing to go back to", () => {
    useTools.setState({ sessions: { tg: { operation: "install", step: "queued", log: [], outcome: null } } })
    rows(["tg"])

    const steps = within(screen.getByText("Installing").closest("ol") as HTMLElement)
    for (const label of ["Checking requirements", "Installing", "Verifying", "Done"]) {
      expect(steps.getByText(label)).toBeTruthy()
    }
    expect(steps.queryAllByRole("button")).toHaveLength(0)
  })
})

describe("the skill offer after a first install", () => {
  it("adds the skill for the agents found, in one click", async () => {
    useTools.setState({
      installs: { tg: [{ path: "~/bin/tg", version: "0.88.0", manager: "npm", problem: null }] },
      sessions: { tg: done("0.88.0") },
    })
    rows(["tg"])

    const offer = await screen.findByRole("region", { name: "Teach your AI agents to use Telegram" })
    expect(within(offer).getByText("Light on context")).toBeTruthy()
    await userEvent.click(await within(offer).findByRole("button", { name: /^Add the skill for / }))
    expect(await within(offer).findByText(/can now use Telegram\.$/)).toBeTruthy()
  })

  it("is not offered after an update, which refreshes the copies already there", () => {
    const skills = { refreshed: [], failed: null }
    const outcome = { event: "done" as const, version: "0.89.0", path: "~/bin/tg", shadowedBy: null, skills }
    useTools.setState({ sessions: { tg: { ...done("0.89.0"), outcome } } })
    rows(["tg"])
    expect(screen.queryByRole("region", { name: "Teach your AI agents to use Telegram" })).toBeNull()
  })
})

describe("an update refused while the tool syncs", () => {
  const held: InstallSession = {
    operation: "install",
    step: "check",
    log: [],
    outcome: { event: "failed", reason: "syncing", message: "Held by syncing.", hint: null },
  }

  it("says the sync holds it, offers to stop the sync, and does not wait for output that will never come", async () => {
    const stop = vi.fn()
    useSync.setState({
      runs: {
        "bitrix:work": {
          phase: "running",
          startedAt: Date.now(),
          endedAt: null,
          stage: null,
          progress: null,
          stopping: false,
          summary: null,
          failure: null,
        },
      },
      stop,
    })
    useTools.setState({ sessions: { bitrix: held } })
    rows(["bitrix"])
    const panel = row("Bitrix24")
    expect(panel).toHaveTextContent("This tool is syncing right now, so it can't be updated or removed")
    expect(panel).not.toHaveTextContent("Another operation")
    await userEvent.click(within(panel).getByRole("button", { name: "Stop the sync" }))
    expect(stop).toHaveBeenCalledWith("bitrix", "work")
    await userEvent.click(within(panel).getByRole("button", { name: /Show log/ }))
    expect(within(panel).getByRole("log")).toHaveTextContent("Nothing ran, so there is no output.")
  })
})
