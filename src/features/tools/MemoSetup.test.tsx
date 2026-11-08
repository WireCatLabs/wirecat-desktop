import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { NotesFolder, NotesSetup } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { MemoSetup } from "./MemoSetup"
import { syncProblem } from "./notes-setup"

const memo = findTool("memo") as NonNullable<ReturnType<typeof findTool>>
const model = { id: "e5-small", title: "multilingual-e5-small", sizeBytes: 135_391_358, downloaded: false }
const notes: NotesFolder = { id: "3", name: "Notes", path: "~/Notes", format: "obsidian" }
const ready = (folders: NotesFolder[], downloaded = false): NotesSetup => ({
  state: "ready",
  folders,
  model: { ...model, downloaded },
})

beforeEach(() => vi.restoreAllMocks())

it("is offered only for memo, whose catalog names the search model", () => {
  expect(memo.notesSetup?.model).toBe("e5-small")
  expect(findTool("tg")?.notesSetup).toBeNull()
})

it("walks from the system folder window to the first read of the notes", async () => {
  let folders: NotesFolder[] = []
  vi.spyOn(platform, "notesSetupStatus").mockImplementation(async () => ready(folders))
  vi.spyOn(platform, "notesPickFolder").mockResolvedValue("/home/a/Notes")
  const add = vi.spyOn(platform, "notesFolderAdd").mockImplementation(async () => {
    folders = [notes]
    return { result: "added", folder: notes }
  })
  vi.spyOn(platform, "notesSync").mockImplementation(async (_id, onEvent) => {
    onEvent({ event: "done", summary: { new: 214, places: 1, failed: 0, left: 0, complete: true, enrichment: null } })
  })
  render(<MemoSetup tool={memo} />)

  const read = await screen.findByRole("button", { name: "Read my notes" })
  expect(read).toBeDisabled()
  expect(screen.getByText("Download 135 MB")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Choose a folder…" }))
  expect(await screen.findByText("~/Notes")).toBeInTheDocument()
  expect(add).toHaveBeenCalledWith("memo", "/home/a/Notes")

  fireEvent.click(screen.getByRole("button", { name: "Read my notes" }))
  expect(await screen.findByText(/214 notes read\./)).toBeInTheDocument()
})

it("says what to do when memo cannot read the folder", async () => {
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([]))
  vi.spyOn(platform, "notesPickFolder").mockResolvedValue("/home/a/Gone")
  vi.spyOn(platform, "notesFolderAdd").mockResolvedValue({ result: "failed", problem: "folderUnreadable" })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Choose a folder…" }))
  expect(await screen.findByText(/cannot read that folder/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Choose another folder…" })).toBeEnabled()
})

it("shows a failed download with its way out, then prepares the notes after a good one", async () => {
  let downloaded = false
  vi.spyOn(platform, "notesSetupStatus").mockImplementation(async () => ready([notes], downloaded))
  const download = vi
    .spyOn(platform, "notesModelDownload")
    .mockImplementationOnce(async (_id, onEvent) => onEvent({ event: "failed", problem: "offline" }))
    .mockImplementationOnce(async (_id, onEvent) => {
      downloaded = true
      onEvent({ event: "done" })
    })
  const sync = vi.spyOn(platform, "notesSync").mockImplementation(async (_id, onEvent) => {
    onEvent({ event: "done", summary: { new: 0, places: 0, failed: 0, left: 0, complete: true, enrichment: null } })
  })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Download 135 MB" }))
  expect(await screen.findByText(/did not reach the internet/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Download 135 MB" }))
  expect(await screen.findByText(/Search by meaning is on/)).toBeInTheDocument()
  expect(download).toHaveBeenCalledTimes(2)
  expect(sync).toHaveBeenCalledTimes(1)
})

it("sorts a sync's failure into the card's closed list", () => {
  const fail = (code: string | null, reason: string | null = null) => ({ message: "", code, reason, run: null })
  expect(syncProblem(fail("conflict"))).toBe("busy")
  expect(syncProblem(fail("network_error"))).toBe("offline")
  expect(syncProblem(fail("permission_error"))).toBe("folderUnreadable")
  expect(syncProblem(fail("internal_error"))).toBe("other")
})

it("shows how far the first read and the download are, in files and megabytes", async () => {
  let finish: () => void = () => {}
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([notes]))
  vi.spyOn(platform, "notesSync").mockImplementation(async (_id, onEvent) => {
    onEvent({ event: "counted", done: 4, total: 12, unit: "files", label: "3" })
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    onEvent({ event: "done", summary: { new: 12, places: 1, failed: 0, left: 0, complete: true, enrichment: null } })
  })
  vi.spyOn(platform, "notesModelDownload").mockImplementation(async (_id, onEvent) => {
    onEvent({ event: "counted", done: 67_000_000, total: 135_000_000, unit: "bytes", label: "e5-small" })
    await new Promise(() => {})
  })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Read my notes" }))
  expect(await screen.findByText("Notes: 4 of 12 files")).toBeInTheDocument()
  expect(screen.getByRole("progressbar", { name: "Reading your notes" })).toHaveAttribute("aria-valuenow", "4")
  finish()

  fireEvent.click(await screen.findByRole("button", { name: "Download 135 MB" }))
  expect(await screen.findByText("67 of 135 MB")).toBeInTheDocument()
})

it("removes a folder only after the dialog that says its notes are deleted", async () => {
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([notes]))
  const remove = vi
    .spyOn(platform, "notesFolderRemove")
    .mockResolvedValueOnce({ result: "failed", problem: "tooOld" })
    .mockResolvedValueOnce({ result: "removed", notesDeleted: 38 })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Remove Notes and keep its notes searchable" }))
  expect(await screen.findByText(/does not have that command/)).toBeInTheDocument()
  expect(remove).toHaveBeenCalledWith("memo", "3", false)

  fireEvent.click(screen.getByRole("button", { name: "Remove Notes and delete its notes" }))
  expect(remove).toHaveBeenCalledTimes(1)
  fireEvent.click(await screen.findByRole("button", { name: "Remove and delete notes" }))
  expect(await screen.findByText(/deleted 38 notes/)).toBeInTheDocument()
  expect(remove).toHaveBeenLastCalledWith("memo", "3", true)
})
