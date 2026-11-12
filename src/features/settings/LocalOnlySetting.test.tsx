import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LANGS } from "@/i18n"
import type { LocalOnlyStatus } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { useTools } from "@/shared/tools-store"
import { render, screen, within } from "@/testing/render"
import { LocalOnlySetting } from "./LocalOnlySetting"
import { useLocalOnly } from "./local-only-store"
import { FEATURES, localOnlyMessages, PLACES } from "./messages-local-only"

const feature = (id: string, where: string, address: string | null = null, refused = false) => ({
  id,
  title: `memo's ${id}`,
  where,
  address,
  refused,
})
const off: LocalOnlyStatus = {
  on: false,
  since: null,
  features: [
    feature("ai_model", "this-computer", "http://localhost:11434"),
    feature("enrichment", "elsewhere", "https://api.openai.com/v1"),
    feature("picture_reading", "agent"),
    feature("new_thing", "somewhere"),
  ],
}
const on: LocalOnlyStatus = {
  on: true,
  since: "2026-11-12T09:12:00.000Z",
  features: off.features.map((f) => ({ ...f, refused: f.where === "elsewhere" })),
}

describe("Only this computer", () => {
  beforeEach(() => {
    useLocalOnly.setState(useLocalOnly.getInitialState(), true)
    useTools.setState({
      installs: { memo: [{ path: "/bin/memo", version: "0.132.0", manager: "npm", problem: null }] },
    })
  })

  it("lists where each feature sends data, and turns on with memo's answer as the new state", async () => {
    vi.spyOn(platform, "localOnlyStatus").mockResolvedValue({ state: "ready", status: off })
    const set = vi.spyOn(platform, "localOnlySet").mockResolvedValue(on)
    const show = vi.spyOn(platform, "localOnlyStatus")
    render(<LocalOnlySetting />)

    const toggle = await screen.findByRole("switch", { name: "Keep every model call on this computer" })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    const list = screen.getByRole("list")
    const row = (name: string) => within(list).getByText(name).closest("li") as HTMLElement
    expect(within(row("AI model")).getByText("This computer")).toBeInTheDocument()
    expect(within(row("AI model")).getByText("localhost:11434")).toBeInTheDocument()
    expect(within(row("Rewrite records for better search")).getByText("Another computer")).toBeInTheDocument()
    expect(within(row("Reading pictures")).getByText("Through your agent")).toBeInTheDocument()
    expect(within(row("memo's new_thing")).getByText("Unknown")).toBeInTheDocument()
    expect(screen.queryByText("Refused")).toBeNull()

    await userEvent.setup().click(toggle)

    expect(set).toHaveBeenCalledWith(true)
    expect(
      await screen.findByText(/1 feature now sends nothing until it uses a model on this computer/),
    ).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(within(row("Rewrite records for better search")).getByText("Refused")).toBeInTheDocument()
    expect(show).toHaveBeenCalledTimes(1)
  })

  it("says in plain words that only the owner turns it off", async () => {
    vi.spyOn(platform, "localOnlyStatus").mockResolvedValue({ state: "ready", status: on })
    vi.spyOn(platform, "localOnlySet").mockRejectedValue(new Error("local-only.owner-only"))
    render(<LocalOnlySetting />)

    await userEvent.setup().click(await screen.findByRole("switch"))

    expect(await screen.findByText(/Only you can turn this off/)).toBeInTheDocument()
    expect(screen.queryByText(/local-only\.owner-only/)).toBeNull()
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("shows no date for a setting memo could not read", async () => {
    vi.spyOn(platform, "localOnlyStatus").mockResolvedValue({ state: "ready", status: { ...on, since: null } })
    render(<LocalOnlySetting />)
    expect(await screen.findByText(/^On\./)).toBeInTheDocument()
  })

  it("asks for a memo update while no memo with it is released", async () => {
    vi.spyOn(platform, "localOnlyStatus").mockResolvedValue({ state: "old", version: "0.131.84", need: null })
    render(<LocalOnlySetting />)
    expect(await screen.findByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("asks memo nothing when it is not installed", () => {
    useTools.setState({ installs: { memo: [] } })
    const show = vi.spyOn(platform, "localOnlyStatus")
    render(<LocalOnlySetting />)
    expect(screen.getByRole("button", { name: "Install Memo" })).toBeInTheDocument()
    expect(show).not.toHaveBeenCalled()
  })
})

describe("Only this computer texts", () => {
  it.each(LANGS)("%s names every place and feature, with no semicolons or long dashes", (lang) => {
    const m = localOnlyMessages[lang]
    const lines = [
      m.heading,
      m.intro,
      m.switchLabel,
      m.off,
      m.agentNote,
      m.ownerOnly,
      m.refusedNow(1),
      m.refusedNow(3),
      ...PLACES.map((p) => m.places[p]),
      ...FEATURES.map((f) => m.features[f] ?? ""),
    ]
    for (const line of lines) {
      expect(line, `${lang}: ${line}`).toBeTruthy()
      expect(line).not.toMatch(/[;—ё]/)
    }
  })
})
