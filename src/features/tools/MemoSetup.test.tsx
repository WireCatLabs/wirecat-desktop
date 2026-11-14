import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { NotesFolder, NotesSetup, ObsidianVault } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { MemoSetup } from "./MemoSetup"
import { syncProblem } from "./notes-setup"

const memo = findTool("memo") as NonNullable<ReturnType<typeof findTool>>
const gemma = {
  id: "embeddinggemma",
  title: "EmbeddingGemma 300M, 4-bit",
  sizeBytes: 218_725_224,
  role: "recommended" as const,
  terms: "https://ai.google.dev/gemma/terms",
}
const e5 = {
  id: "e5-small",
  title: "multilingual-e5-small, 8-bit",
  sizeBytes: 135_391_358,
  role: "alternative" as const,
  terms: null,
}
const notes: NotesFolder = { id: "3", name: "Notes", path: "~/Notes", format: "obsidian" }
const ready = (
  folders: NotesFolder[],
  downloaded = false,
  { inUse = "embeddinggemma", e5Downloaded = false, vaults = [] as ObsidianVault[] } = {},
): NotesSetup => ({
  state: "ready",
  folders,
  vaults,
  models: [
    { ...gemma, downloaded, inUse: inUse === gemma.id },
    { ...e5, downloaded: e5Downloaded, inUse: inUse === e5.id },
  ],
})

beforeEach(() => vi.restoreAllMocks())

it("is offered only for memo, whose catalog names the best search model", () => {
  expect(memo.notesSetup?.recommended).toBe("embeddinggemma")
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
  expect(screen.getByText("Download 219 MB")).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Choose a folder…" }))
  expect(await screen.findByText("~/Notes")).toBeInTheDocument()
  expect(add).toHaveBeenCalledWith("memo", "/home/a/Notes", false)

  fireEvent.click(screen.getByRole("button", { name: "Read my notes" }))
  expect(await screen.findByText(/214 notes read\./)).toBeInTheDocument()
})

it("connects a vault Obsidian lists, and shows it among the folders as Obsidian", async () => {
  const vault = { name: "Personal", path: "/home/a/Obsidian/Personal", shown: "~/Obsidian/Personal" }
  const added: NotesFolder = { id: "4", name: "Personal", path: "~/Obsidian/Personal", format: "obsidian" }
  let setup = ready([], false, { vaults: [vault] })
  vi.spyOn(platform, "notesSetupStatus").mockImplementation(async () => setup)
  const pick = vi.spyOn(platform, "notesPickFolder")
  const add = vi.spyOn(platform, "notesFolderAdd").mockImplementation(async () => {
    setup = ready([added])
    return { result: "added", folder: added }
  })
  render(<MemoSetup tool={memo} />)

  expect(await screen.findByRole("list", { name: "Obsidian vaults on this computer" })).toHaveTextContent(
    "~/Obsidian/Personal",
  )
  fireEvent.click(screen.getByRole("button", { name: "Connect the Obsidian vault Personal" }))
  expect(await screen.findByText("Added Personal as Obsidian notes. The next step reads it.")).toBeInTheDocument()
  expect(add).toHaveBeenCalledWith("memo", "/home/a/Obsidian/Personal", true)
  expect(pick).not.toHaveBeenCalled()
  expect(screen.getByRole("list", { name: "Folders Memo reads" })).toHaveTextContent("Obsidian")
})

it("says a folder picked as a vault is read as plain Markdown when it has no .obsidian folder", async () => {
  const plain: NotesFolder = { id: "5", name: "Work", path: "~/Notes/Work", format: "markdown" }
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([]))
  vi.spyOn(platform, "notesPickFolder").mockResolvedValue("/home/a/Notes/Work")
  vi.spyOn(platform, "notesFolderAdd").mockResolvedValue({ result: "added", folder: plain })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Connect an Obsidian vault…" }))
  expect(await screen.findByText(/Added Work as plain Markdown: it has no \.obsidian folder/)).toBeInTheDocument()
})

it("offers the vaults inside a plain folder one by one, or the folder itself as Markdown", async () => {
  const inside = [
    { name: "Personal", path: "/home/a/Obsidian/Personal", shown: "~/Obsidian/Personal" },
    { name: "Team", path: "/home/a/Obsidian/Team", shown: "~/Obsidian/Team" },
  ]
  const folder = (name: string, format: string): NotesFolder => ({ id: name, name, path: `~/Obsidian/${name}`, format })
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([]))
  vi.spyOn(platform, "notesPickFolder").mockResolvedValue("/home/a/Obsidian")
  const add = vi.spyOn(platform, "notesFolderAdd").mockImplementation(async (_id, path, plain) => {
    if (path === "/home/a/Obsidian")
      return plain
        ? { result: "added", folder: folder("Obsidian", "markdown") }
        : { result: "holdsVaults", vaults: inside }
    return { result: "added", folder: folder(path.split("/").pop() as string, "obsidian") }
  })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Choose a folder…" }))
  const offered = await screen.findByRole("list", { name: "Obsidian vaults in Obsidian" })
  expect(screen.getByText(/Obsidian is no Obsidian vault, but it holds 2 vaults/)).toBeInTheDocument()
  expect(offered).toHaveTextContent("~/Obsidian/Team")

  fireEvent.click(screen.getByRole("button", { name: "Connect the Obsidian vault Personal" }))
  await act(async () => {})
  expect(add).toHaveBeenLastCalledWith("memo", "/home/a/Obsidian/Personal", true)
  expect(screen.getByRole("list", { name: "Obsidian vaults in Obsidian" })).not.toHaveTextContent("Personal")
  expect(screen.queryByRole("button", { name: "Add Obsidian as plain Markdown" })).toBeNull()
})

it("adds a plain folder that holds vaults as Markdown when the owner chooses that first", async () => {
  const inside = [{ name: "Team", path: "/home/a/Obsidian/Team", shown: "~/Obsidian/Team" }]
  const plainFolder: NotesFolder = { id: "9", name: "Obsidian", path: "~/Obsidian", format: "markdown" }
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([]))
  vi.spyOn(platform, "notesPickFolder").mockResolvedValue("/home/a/Obsidian")
  const add = vi
    .spyOn(platform, "notesFolderAdd")
    .mockImplementation(async (_id, _path, plain) =>
      plain ? { result: "added", folder: plainFolder } : { result: "holdsVaults", vaults: inside },
    )
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Choose a folder…" }))
  fireEvent.click(await screen.findByRole("button", { name: "Add Obsidian as plain Markdown" }))
  expect(await screen.findByText("Added Obsidian as plain Markdown files. The next step reads it.")).toBeInTheDocument()
  expect(add).toHaveBeenLastCalledWith("memo", "/home/a/Obsidian", true)
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
    .mockImplementationOnce(async (_id, _model, onEvent) => onEvent({ event: "failed", problem: "offline" }))
    .mockImplementationOnce(async (_id, _model, onEvent) => {
      downloaded = true
      onEvent({ event: "done" })
    })
  const sync = vi.spyOn(platform, "notesSync").mockImplementation(async (_id, onEvent) => {
    onEvent({ event: "done", summary: { new: 0, places: 0, failed: 0, left: 0, complete: true, enrichment: null } })
  })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Download 219 MB" }))
  expect(await screen.findByText(/did not reach the internet/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Download 219 MB" }))
  expect(await screen.findByText(/Search by meaning is on/)).toBeInTheDocument()
  expect(download).toHaveBeenCalledTimes(2)
  expect(download).toHaveBeenLastCalledWith("memo", "embeddinggemma", expect.any(Function))
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
  vi.spyOn(platform, "notesModelDownload").mockImplementation(async (_id, _model, onEvent) => {
    onEvent({ event: "counted", done: 67_000_000, total: 219_000_000, unit: "bytes", label: "embeddinggemma" })
    await new Promise(() => {})
  })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Read my notes" }))
  expect(await screen.findByText("Notes: 4 of 12 files")).toBeInTheDocument()
  expect(screen.getByRole("progressbar", { name: "Reading your notes" })).toHaveAttribute("aria-valuenow", "4")
  finish()

  fireEvent.click(await screen.findByRole("button", { name: "Download 219 MB" }))
  expect(await screen.findByText("67 of 219 MB")).toBeInTheDocument()
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

it("names the recommended model only as the best local model, its word model linking to the terms", async () => {
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([notes]))
  const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
  render(<MemoSetup tool={memo} />)

  const models = await screen.findByRole("list", { name: "Search models" })
  expect(models).toHaveTextContent("Best local model")
  expect(models).toHaveTextContent("Lighter, faster model")
  expect(models).not.toHaveTextContent("Gemma")
  fireEvent.click(screen.getByRole("link", { name: "model" }))
  expect(open).toHaveBeenCalledWith("https://ai.google.dev/gemma/terms")
})

it("switches to a downloaded model with memo's own set and says re-indexing keeps search working", async () => {
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([notes], true, { e5Downloaded: true }))
  const download = vi.spyOn(platform, "notesModelDownload")
  const use = vi
    .spyOn(platform, "notesModelUse")
    .mockResolvedValue({ result: "used", previous: "embeddinggemma", toEmbed: 1840, estimateSeconds: 930 })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Use this model" }))

  expect(
    await screen.findByText(/Re-indexing takes about 16 min at the next syncs; search keeps working/),
  ).toBeInTheDocument()
  expect(use).toHaveBeenCalledWith("memo", "e5-small")
  expect(download).not.toHaveBeenCalled()
})

it("downloads a model that is not here yet before switching to it", async () => {
  vi.spyOn(platform, "notesSetupStatus").mockResolvedValue(ready([notes], true))
  const download = vi.spyOn(platform, "notesModelDownload").mockImplementation(async (_id, _model, onEvent) => {
    onEvent({ event: "done" })
  })
  const use = vi
    .spyOn(platform, "notesModelUse")
    .mockResolvedValue({ result: "used", previous: "embeddinggemma", toEmbed: null, estimateSeconds: null })
  render(<MemoSetup tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Download 135 MB and use" }))

  expect(await screen.findByText(/memo re-indexes your notes and mail at the next syncs/i)).toBeInTheDocument()
  expect(download).toHaveBeenCalledWith("memo", "e5-small", expect.any(Function))
  expect(use).toHaveBeenCalledWith("memo", "e5-small")
})

it("keeps the setup of the tool shown now when the one shown before answers later", async () => {
  const answers: Record<string, (s: NotesSetup) => void> = {}
  vi.spyOn(platform, "notesSetupStatus").mockImplementation((id) => new Promise((resolve) => (answers[id] = resolve)))
  const { rerender } = render(<MemoSetup tool={memo} />)
  rerender(<MemoSetup tool={{ ...memo, id: "memo-b" }} />)
  await act(async () => answers["memo-b"]?.(ready([notes])))
  await act(async () => answers.memo?.(ready([])))
  expect(screen.getByText("~/Notes")).toBeInTheDocument()
})
