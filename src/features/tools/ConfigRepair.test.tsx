import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Health } from "./Health"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
const FILE = "~/.config/tg-cli/config.json"
const doctor = (fix?: string) => ({
  command: "tg work doctor --record --json",
  exitCode: 1,
  durationMs: 300,
  stderr: "",
  report: {
    item: {
      config: {
        issues: [
          {
            kind: "invalid_json",
            file: FILE,
            line: 9,
            column: 3,
            what: "The settings file is not valid JSON.",
            ...(fix ? { fix } : {}),
          },
        ],
      },
    },
  },
})
const healthy = { ...doctor(), exitCode: 0, report: { item: {} } }

beforeEach(() => vi.spyOn(platform, "listProfiles").mockResolvedValue([{ name: "work", signedIn: true }]))
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
  it("offers no Repair when doctor does not name the repair as the fix", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValue(doctor())
    await checkWork()
    expect(screen.queryByRole("button", { name: "Repair the file" })).toBeNull()
  })

  it("runs the tool's repair, says in plain words what changed and where the old file is, then checks again", async () => {
    const diagnose = vi
      .spyOn(platform, "diagnose")
      .mockResolvedValueOnce(doctor("tg config repair"))
      .mockResolvedValue(healthy)
    const repair = vi.spyOn(platform, "configRepair").mockResolvedValue({
      state: "repaired",
      file: FILE,
      backup: `${FILE}.bak-20261102T171502Z`,
      changes: [
        { line: 9, kind: "missing_comma" },
        { line: 14, kind: "trailing_comma" },
      ],
    })
    const user = await checkWork()
    expect(screen.queryByRole("button", { name: "Copy the fix command" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Repair the file" }))
    expect(repair).toHaveBeenCalledWith("tg", "work")
    expect(
      await screen.findByText(
        "Repaired the settings file: added a missing comma (line 9); removed a comma after the last entry (line 14).",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(`${FILE}.bak-20261102T171502Z`)).toBeInTheDocument()
    expect(diagnose).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText("The settings file is not valid JSON.")).toBeNull())
  })

  it("on config.unrepairable, shows the place and reveals the file in its folder, never opens it", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValue(doctor("tg config repair"))
    vi.spyOn(platform, "configRepair").mockResolvedValue({
      state: "refused",
      message: "two entries on one line",
      file: FILE,
      line: 12,
      column: 7,
    })
    const reveal = vi.spyOn(platform, "openFolder").mockResolvedValue()
    const user = await checkWork()
    await user.click(screen.getByRole("button", { name: "Repair the file" }))
    expect(await screen.findByText("Telegram did not change the file: two entries on one line")).toBeInTheDocument()
    expect(screen.getByText(`${FILE}:12:7`)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show the file in its folder" }))
    expect(reveal).toHaveBeenCalledWith("tg", "config", "config.json")
  })

  it("says so when there was nothing to repair", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValueOnce(doctor("tg config repair")).mockResolvedValue(healthy)
    vi.spyOn(platform, "configRepair").mockResolvedValue({ state: "unchanged", reason: "nothing to repair" })
    const user = await checkWork()
    await user.click(screen.getByRole("button", { name: "Repair the file" }))
    expect(await screen.findByText("The file needed no repair: it reads correctly now.")).toBeInTheDocument()
  })
})
