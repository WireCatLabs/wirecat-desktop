import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, within } from "@/testing/render"
import { DriveFolders } from "./DriveFolders"

beforeEach(() => {
  vi.spyOn(platform, "driveFoldersBrowse").mockResolvedValue({
    result: "listed",
    partial: false,
    folders: [],
  })
  vi.spyOn(platform, "settingsShow").mockResolvedValue({ rows: [], configFile: null, notice: null })
  vi.spyOn(platform, "settingsSet").mockResolvedValue()
})

afterEach(() => vi.restoreAllMocks())

describe("Drive's step after signing in", () => {
  it("offers one Sync now once transcripts are added", async () => {
    vi.spyOn(platform, "driveTranscriptsFind").mockResolvedValue({ result: "found", count: 1, titles: ["Standup"] })
    render(<DriveFolders tool="drive" profile="personal" name="Google Drive" />)
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("radio", { name: /Add to WireCat/ }))
    expect(await screen.findAllByRole("button", { name: "Sync now" })).toHaveLength(1)
  })

  it("explains an expired sign-in the way the folder picker does", async () => {
    vi.spyOn(platform, "driveTranscriptsFind").mockResolvedValue({
      result: "failed",
      code: "authentication_error",
      reason: "oauth.expired",
      message: "the Google sign-in expired or was revoked",
    })
    render(<DriveFolders tool="drive" profile="personal" name="Google Drive" />)
    const step = await screen.findByRole("region", { name: "Meeting transcripts" })
    expect(await within(step).findByText("The sign-in to Google Drive has expired.")).toBeInTheDocument()
  })
})
