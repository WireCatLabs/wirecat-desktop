import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Settings } from "@/platform/settings-schemas"
import { render, screen, within } from "@/testing/render"
import { DriveTranscripts } from "./DriveTranscripts"

const shown = (transcripts?: string): Settings => ({
  rows: transcripts
    ? [
        {
          key: "transcripts",
          value: transcripts,
          origin: "profile",
          from: null,
          scope: null,
          locked: null,
          masked: false,
          resettable: true,
        },
      ]
    : [],
  configFile: null,
  notice: null,
})

beforeEach(() => {
  vi.spyOn(platform, "driveTranscriptsFind").mockResolvedValue({
    result: "found",
    count: 5,
    titles: ["Planning - Notes by Gemini", "Standup - Transcript", "Client call - Transcript"],
  })
  vi.spyOn(platform, "settingsShow").mockResolvedValue(shown())
})

afterEach(() => vi.restoreAllMocks())

const step = () => screen.getByRole("region", { name: "Meeting transcripts" })

describe("Drive's meeting transcripts", () => {
  it("shows what was found with nothing chosen, and Add saves include and offers the next step", async () => {
    const set = vi.spyOn(platform, "settingsSet").mockResolvedValue()
    render(<DriveTranscripts tool="drive" profile="work" afterInclude={<button type="button">Sync now</button>} />)
    expect(await within(step()).findByText("Found 5 transcripts and Gemini notes")).toBeInTheDocument()
    expect(within(step()).getByText("Planning - Notes by Gemini")).toBeInTheDocument()
    expect(within(step()).getByText("and 2 more")).toBeInTheDocument()
    const choices = await within(step()).findAllByRole("radio")
    expect(choices.map((c) => (c as HTMLInputElement).checked)).toEqual([false, false, false])
    await userEvent.click(within(step()).getByRole("radio", { name: /Add to WireCat/ }))
    expect(set).toHaveBeenCalledWith("drive", "work", false, "transcripts", '"include"')
    expect(await within(step()).findByText(/copied on the next sync/)).toBeInTheDocument()
    expect(within(step()).getByRole("button", { name: "Sync now" })).toBeInTheDocument()
  })

  it("shows the profile's saved choice, and a refused save keeps it", async () => {
    vi.mocked(platform.settingsShow).mockResolvedValue(shown("exclude"))
    vi.spyOn(platform, "settingsSet").mockRejectedValue(new Error("config file is read-only"))
    render(<DriveTranscripts tool="drive" profile="work" />)
    const never = await within(step()).findByRole("radio", { name: /Never add/ })
    expect(never).toBeChecked()
    await userEvent.click(within(step()).getByRole("radio", { name: /Don't add/ }))
    expect(await within(step()).findByText(/The choice was not saved: config file is read-only/)).toBeInTheDocument()
    expect(never).toBeChecked()
  })

  it("says to update a Drive too old to look, and offers no choice it cannot keep", async () => {
    vi.mocked(platform.driveTranscriptsFind).mockResolvedValue({
      result: "failed",
      code: "needs_update",
      reason: null,
      message: "error: unknown command 'transcripts'",
    })
    render(<DriveTranscripts tool="drive" profile="work" />)
    expect(await within(step()).findByText(/cannot find transcripts\. Update it/)).toBeInTheDocument()
    expect(within(step()).queryByRole("radio")).not.toBeInTheDocument()
  })

  it("offers the choices only once the saved one is known, so a quick click is not overwritten", async () => {
    let answer: (s: Settings) => void = () => {}
    vi.mocked(platform.settingsShow).mockReturnValue(new Promise((resolve) => (answer = resolve)))
    render(<DriveTranscripts tool="drive" profile="work" />)
    await within(step()).findByText("Found 5 transcripts and Gemini notes")
    expect(within(step()).queryByRole("radio")).not.toBeInTheDocument()
    answer(shown("skip"))
    expect(await within(step()).findByRole("radio", { name: /Don't add/ })).toBeChecked()
  })

  it("keeps the last choice when an earlier save answers after it", async () => {
    let refuseFirst: (e: Error) => void = () => {}
    vi.spyOn(platform, "settingsSet")
      .mockReturnValueOnce(new Promise((_, reject) => (refuseFirst = reject)))
      .mockResolvedValueOnce()
    render(<DriveTranscripts tool="drive" profile="work" />)
    await userEvent.click(await within(step()).findByRole("radio", { name: /Don't add/ }))
    await userEvent.click(within(step()).getByRole("radio", { name: /Never add/ }))
    expect(await within(step()).findByText(/never copied/)).toBeInTheDocument()
    refuseFirst(new Error("late"))
    await vi.waitFor(() => expect(within(step()).getByRole("radio", { name: /Never add/ })).toBeChecked())
    expect(within(step()).queryByText(/was not saved/)).not.toBeInTheDocument()
  })

  it("lets the surface explain a failed search in its own words", async () => {
    vi.mocked(platform.driveTranscriptsFind).mockResolvedValue({
      result: "failed",
      code: "authentication_error",
      reason: "oauth.expired",
      message: "expired",
    })
    render(<DriveTranscripts tool="drive" profile="work" failed={(f) => <p>Explained {f.reason}</p>} />)
    expect(await within(step()).findByText("Explained oauth.expired")).toBeInTheDocument()
  })

  it("still lets the owner choose when the search failed, and Try again looks again", async () => {
    vi.mocked(platform.driveTranscriptsFind)
      .mockResolvedValueOnce({ result: "failed", code: "rate_limited", reason: null, message: "slow down" })
      .mockResolvedValue({ result: "found", count: 0, titles: [] })
    render(<DriveTranscripts tool="drive" profile="work" />)
    expect(await within(step()).findByText(/Could not look for transcripts/)).toBeInTheDocument()
    expect(within(step()).getAllByRole("radio")).toHaveLength(3)
    await userEvent.click(within(step()).getByRole("button", { name: "Try again" }))
    expect(await within(step()).findByText("No transcripts or Gemini notes found yet.")).toBeInTheDocument()
  })
})
