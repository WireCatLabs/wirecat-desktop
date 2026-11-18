import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DriveFolder, FolderLevel } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { render, screen, within } from "@/testing/render"
import { DriveFolders } from "./DriveFolders"

beforeEach(() => {
  vi.spyOn(platform, "driveFoldersBrowse").mockResolvedValue({
    result: "listed",
    partial: false,
    folders: [],
    nextCursor: null,
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

const notion = (id: string, name: string, kind: "page" | "database"): DriveFolder => ({
  id,
  name,
  kind,
  parent: null,
  location: null,
  driveId: null,
  childFolders: null,
  added: false,
})

describe("Notion's step after signing in", () => {
  it("lists pages and databases page after page, reads past an empty page, and says when search was cut", async () => {
    const pages: Record<string, FolderLevel> = {
      start: {
        result: "listed",
        folders: [notion("p1", "Roadmap", "page")],
        partial: true,
        nextCursor: "notion-browse1.a",
      },
      "notion-browse1.a": { result: "listed", folders: [], partial: false, nextCursor: "notion-browse1.b" },
      "notion-browse1.b": {
        result: "listed",
        folders: [notion("d1", "Tasks", "database")],
        partial: false,
        nextCursor: "notion-browse1.c",
      },
      "notion-browse1.c": {
        result: "listed",
        folders: [notion("p1", "Roadmap", "page"), notion("p2", "Wiki", "page")],
        partial: false,
        nextCursor: null,
      },
    }
    const browse = vi
      .spyOn(platform, "driveFoldersBrowse")
      .mockImplementation(async (_id, _profile, _parent, cursor) => pages[cursor ?? "start"] as FolderLevel)
    const transcripts = vi.spyOn(platform, "driveTranscriptsFind")
    render(<DriveFolders tool="notion" profile="personal" name="Notion" />)

    expect(await screen.findByText("Roadmap")).toBeInTheDocument()
    expect(screen.getByText("Page")).toBeInTheDocument()
    expect(screen.getByText(/This list is incomplete/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(await screen.findByText("Tasks")).toBeInTheDocument()
    expect(screen.getByText("Database")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open Tasks" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Roadmap" })).toBeInTheDocument()
    expect(screen.getByText(/This list is incomplete/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(await screen.findByText("Wiki")).toBeInTheDocument()
    expect(screen.getAllByText("Roadmap")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
    expect(browse.mock.calls.map((c) => c[3])).toEqual([
      null,
      "notion-browse1.a",
      "notion-browse1.b",
      "notion-browse1.c",
    ])
    expect(transcripts).not.toHaveBeenCalled()
  })
  it("keeps what it listed when Show more fails, and reads the same page again", async () => {
    const first: FolderLevel = {
      result: "listed",
      folders: [notion("p1", "Roadmap", "page")],
      partial: false,
      nextCursor: "notion-browse1.a",
    }
    const browse = vi
      .spyOn(platform, "driveFoldersBrowse")
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ result: "failed", message: "Notion asks to slow down", code: null, reason: null })
      .mockResolvedValueOnce({
        result: "listed",
        folders: [notion("p2", "Wiki", "page")],
        partial: false,
        nextCursor: null,
      })
    render(<DriveFolders tool="notion" profile="personal" name="Notion" />)
    await userEvent.click(await screen.findByRole("button", { name: "Show more" }))
    expect(await screen.findByText("Could not read more.")).toBeInTheDocument()
    expect(screen.getByText("Roadmap")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(await screen.findByText("Wiki")).toBeInTheDocument()
    expect(browse.mock.calls.map((c) => c[3])).toEqual([null, "notion-browse1.a", "notion-browse1.a"])
  })
})

const disk = (path: string): DriveFolder => ({
  id: `disk:${path}`,
  name: path.split("/").at(-1) ?? path,
  kind: "folder",
  parent: null,
  location: null,
  driveId: null,
  childFolders: null,
  added: false,
})

describe("Yandex Disk's step after signing in", () => {
  it("opens and adds folders by their Disk path, in its own words, and opens only a folder that may hold folders", async () => {
    const levels: Record<string, DriveFolder[]> = {
      "": [disk("/Работа"), { ...disk("/Фото"), childFolders: 0 }],
      "disk:/Работа": [disk("/Работа/Отчёты 2026")],
    }
    const browse = vi.spyOn(platform, "driveFoldersBrowse").mockImplementation(async (_tool, _profile, parent) => ({
      result: "listed",
      partial: false,
      folders: levels[parent ?? ""] ?? [],
      nextCursor: null,
    }))
    const add = vi.spyOn(platform, "driveFolderAdd").mockResolvedValue({ result: "added" })
    render(<DriveFolders tool="ydisk" profile="personal" name="Yandex Disk" />)
    expect(await screen.findByRole("heading", { name: "Choose what Yandex Disk imports" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Folders" })).toHaveTextContent("Yandex Disk")
    expect(await screen.findByRole("checkbox", { name: "Фото" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open Фото" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open Работа" }))
    await userEvent.click(await screen.findByRole("checkbox", { name: "Отчёты 2026" }))
    await userEvent.click(screen.getByRole("button", { name: "Add 1 folder" }))
    expect(await screen.findByText("1 folder added. Sync to copy their files.")).toBeInTheDocument()
    expect(browse.mock.calls.map((c) => c[2])).toEqual([null, "disk:/Работа"])
    expect(add).toHaveBeenCalledWith("ydisk", "personal", "disk:/Работа/Отчёты 2026")
    expect(screen.queryByRole("region", { name: "Meeting transcripts" })).not.toBeInTheDocument()
  })
})
