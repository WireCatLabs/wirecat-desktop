import type { NotesFolder, NotesProblem, NotesSetup } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// memo's first run. `?memo=fresh` has no folder and no search model, `?memo=ready` a folder and the model, `?memo=old`
// a memo too old for the card; no value is one folder with the model still to download. `?memo-pick=cancel` closes the
// folder window without a choice. `?memo-fail=folder` (the folder cannot be read), `?memo-fail=sync` (another run holds
// the store), `?memo-fail=download` (no network), `?memo-fail=disk` (no space left), `?memo-fail=old` (the download
// command is unknown to this memo), `?memo-fail=remove` (a sync holds the store), `?memo-fail=remove-old` (this memo has
// no `folders remove`). Progress lines: counts for the sync and the download by default, `?notes-progress=old` for a
// memo that prints none (the bars have no end).
const MODEL = { id: "e5-small", title: "multilingual-e5-small, 8-bit", sizeBytes: 135_391_358 }
const PICKED = "/home/slava/Notes/Work"

export function notesSetupMock(
  params: URLSearchParams,
): Pick<
  Platform,
  | "notesSetupStatus"
  | "notesPickFolder"
  | "notesFolderAdd"
  | "notesFolderRemove"
  | "notesSync"
  | "notesModelDownload"
  | "notesModelStop"
> {
  const scenario = params.get("memo")
  const fail = params.get("memo-fail")
  const counts = params.get("notes-progress") !== "old"
  const folders: NotesFolder[] =
    scenario === "fresh" ? [] : [{ id: "3", name: "Notes", path: "~/Documents/Notes", format: "obsidian" }]
  let downloaded = scenario === "ready"
  let stopped = false
  const problem = (): NotesProblem =>
    fail === "disk" ? "diskFull" : fail === "old" ? "tooOld" : fail === "sync" ? "busy" : "offline"
  return {
    async notesSetupStatus(): Promise<NotesSetup> {
      await delay(400)
      if (scenario === "old") return { state: "old", version: "0.131.2", need: "0.131.14" }
      return { state: "ready", folders: [...folders], model: { ...MODEL, downloaded } }
    },
    async notesPickFolder() {
      await delay(500)
      return params.get("memo-pick") === "cancel" ? null : PICKED
    },
    async notesFolderAdd(_id, path) {
      await delay(700)
      if (fail === "folder") return { result: "failed", problem: "folderUnreadable" }
      const found = folders.find((f) => f.path === path.replace("/home/slava", "~"))
      const folder = found ?? {
        id: String(4 + folders.length),
        name: path.split("/").pop() ?? path,
        path: path.replace("/home/slava", "~"),
        format: "obsidian",
      }
      if (!found) folders.push(folder)
      return { result: "added", folder }
    },
    async notesFolderRemove(_id, folder, deleteNotes) {
      await delay(700)
      if (fail === "remove") return { result: "failed", problem: "busy" }
      if (fail === "remove-old") return { result: "failed", problem: "tooOld" }
      const at = folders.findIndex((f) => f.id === folder)
      if (at >= 0) folders.splice(at, 1)
      return { result: "removed", notesDeleted: deleteNotes ? 38 : null }
    },
    async notesSync(_id, onEvent) {
      onEvent({ event: "stage", stage: "Reading notes" })
      const total = 214
      for (let done = 0; counts && done <= total && fail !== "sync"; done += 16) {
        onEvent({ event: "counted", done: Math.min(done, total), total, unit: "files", label: folders[0]?.id ?? null })
        await delay(180)
      }
      if (!counts) await delay(1800)
      if (fail === "sync")
        return onEvent({
          event: "failed",
          message: "memo stopped with the error conflict.",
          code: "conflict",
          reason: "profile.locked",
          run: null,
          retryAfterMs: null,
        })
      onEvent({
        event: "done",
        summary: { new: 214, places: folders.length, failed: 0, left: 0, complete: true, enrichment: null },
      })
    },
    async notesModelDownload(_id, onEvent) {
      stopped = false
      const until = Date.now() + 6000
      while (!stopped && Date.now() < until) {
        await delay(100)
        if (counts)
          onEvent({
            event: "counted",
            done: Math.round(MODEL.sizeBytes * Math.min(1, 1 - (until - Date.now()) / 6000)),
            total: MODEL.sizeBytes,
            unit: "bytes",
            label: MODEL.id,
          })
      }
      if (stopped) return onEvent({ event: "stopped" })
      if (fail === "download" || fail === "disk" || fail === "old")
        return onEvent({ event: "failed", problem: problem() })
      downloaded = true
      onEvent({ event: "done" })
    },
    async notesModelStop() {
      stopped = true
    },
  }
}
