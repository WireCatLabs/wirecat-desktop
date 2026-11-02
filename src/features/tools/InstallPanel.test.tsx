import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import type { InstallSession } from "@/domain/status"
import { useAgents } from "../agents/store"
import { useNav } from "../nav"
import { useTools } from "./store"
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

beforeEach(() => useTools.setState(useTools.getInitialState(), true))

describe("Done on a finished install", () => {
  it("closes only that tool's panel", async () => {
    useTools.setState({ sessions: { tg: done("0.89.0"), wa: done("0.7.0") } })
    rows(["tg", "wa"])

    await userEvent.click(within(row("Telegram")).getByRole("button", { name: "Done" }))

    expect(panelOpen("Telegram")).toBe(false)
    expect(panelOpen("WhatsApp")).toBe(true)
  })

  it("leaves the other row of a shared package open until it is closed too", async () => {
    useTools.setState({ sessions: { memo: done("0.95.0") } })
    rows(["memo", "email"])

    await userEvent.click(within(row("Memo")).getByRole("button", { name: "Done" }))
    expect(panelOpen("Memo")).toBe(false)
    expect(panelOpen("Email")).toBe(true)

    await userEvent.click(within(row("Email")).getByRole("button", { name: "Done" }))
    expect(useTools.getState().sessions).toEqual({})
  })
})

describe("the agent instructions an update refreshed", () => {
  const updated = (skills: { refreshed: ("claude" | "agents")[]; failed: string | null }): InstallSession => ({
    ...done("0.112.0"),
    outcome: { event: "done", version: "0.112.0", path: "~/bin/tg", shadowedBy: null, skills },
  })

  beforeEach(() => {
    useAgents.setState(useAgents.getInitialState(), true)
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
