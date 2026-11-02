import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { forgetRepairSupport } from "./ConfigRepair"
import { Health } from "./Health"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
const FILE = "~/.config/tg-cli/config.json"
const broken = {
  command: "tg work doctor --record --json",
  exitCode: 1,
  durationMs: 300,
  stderr: "",
  report: {
    item: {
      config: {
        issues: [
          { kind: "invalid_json", file: FILE, line: 9, column: 3, what: "The settings file is not valid JSON." },
        ],
      },
    },
  },
}
const healthy = { ...broken, exitCode: 0, report: { item: {} } }

beforeEach(() => {
  forgetRepairSupport()
  vi.spyOn(platform, "listProfiles").mockResolvedValue([{ name: "work", signedIn: true }])
})
afterEach(() => vi.restoreAllMocks())

async function checkWork() {
  const user = userEvent.setup()
  render(<Health tool={tg} />)
  const row = (await screen.findByText("work")).closest("li") as HTMLElement
  await user.click(within(row).getByRole("button", { name: "Check" }))
  await screen.findByText("The settings file is not valid JSON.", {}, { timeout: 3000 })
  return user
}

describe("repairing a settings file that is not valid JSON", () => {
  it("offers no Repair when the installed version has no config repair", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValue(broken)
    const supported = vi.spyOn(platform, "configRepairSupported").mockResolvedValue(false)
    await checkWork()
    expect(supported).toHaveBeenCalledWith("tg", "work")
    expect(screen.queryByRole("button", { name: "Repair the file" })).toBeNull()
  })

  it("runs the tool's repair, says what changed and where the old file is, then checks again", async () => {
    const diagnose = vi.spyOn(platform, "diagnose").mockResolvedValueOnce(broken).mockResolvedValue(healthy)
    vi.spyOn(platform, "configRepairSupported").mockResolvedValue(true)
    const repair = vi.spyOn(platform, "configRepair").mockResolvedValue({
      state: "repaired",
      file: FILE,
      backup: `${FILE}.bak-20261102T171502Z`,
      changes: [{ line: 9, column: 3, what: "added the missing comma before this line" }],
    })
    const user = await checkWork()
    await user.click(await screen.findByRole("button", { name: "Repair the file" }))
    expect(repair).toHaveBeenCalledWith("tg", "work")
    expect(
      await screen.findByText("Repaired the settings file: added the missing comma before this line (line 9)."),
    ).toBeInTheDocument()
    expect(screen.getByText(`${FILE}.bak-20261102T171502Z`)).toBeInTheDocument()
    expect(diagnose).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText("The settings file is not valid JSON.")).toBeNull())
  })

  it("on a refusal, shows the tool's words and the place, and reveals the file in its folder", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValue(broken)
    vi.spyOn(platform, "configRepairSupported").mockResolvedValue(true)
    vi.spyOn(platform, "configRepair").mockResolvedValue({
      state: "refused",
      message: "cannot repair safely: line 9 holds two values",
      file: FILE,
      line: 9,
    })
    const reveal = vi.spyOn(platform, "openFolder").mockResolvedValue()
    const user = await checkWork()
    await user.click(await screen.findByRole("button", { name: "Repair the file" }))
    expect(await screen.findByText(/Telegram did not change the file: cannot repair safely/)).toBeInTheDocument()
    expect(screen.getByText(`${FILE}:9`)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show the file in its folder" }))
    expect(reveal).toHaveBeenCalledWith("tg", "config", "config.json")
  })
})
