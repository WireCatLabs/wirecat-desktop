import type { NotesFolder, NotesProblem, NotesSetup } from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import type { Platform } from "./types"

// memo's first run. `?memo=fresh` has no folder and no search model, `?memo=ready` a folder and the model in use
// downloaded, `?memo=old` a memo too old for the card; no value is one folder with the model still to download.
// Search models, as memo 0.131.61 lists them: `?model=gemma` EmbeddingGemma in use and downloaded, `?model=e5` e5-small
// in use and downloaded (EmbeddingGemma offered), `?model=none` EmbeddingGemma in use and not downloaded yet,
// `?model=both` both downloaded with e5-small in use (switching needs no download), `?model-fail=use` makes switching
// fail as another run holding the store. `?memo-pick=cancel` closes the
// folder window without a choice. `?memo-fail=folder` (the folder cannot be read), `?memo-fail=sync` (another run holds
// the store), `?memo-fail=download` (no network), `?memo-fail=disk` (no space left), `?memo-fail=old` (the download
// command is unknown to this memo), `?memo-fail=remove` (a sync holds the store), `?memo-fail=remove-old` (this memo has
// no `folders remove`). Progress lines: counts for the sync and the download by default, `?notes-progress=old` for a
// memo that prints none (the bars have no end). Obsidian: two vaults Obsidian lists by default, `?obsidian=none` lists
// none; `?memo-pick=vault` picks a folder in a vault (added as `obsidian`), any other pick is plain `markdown`.
const GEMMA = {
  id: "embeddinggemma",
  title: "EmbeddingGemma 300M, 4-bit",
  sizeBytes: 218_725_224,
  role: "recommended" as const,
  terms: "https://ai.google.dev/gemma/terms",
}
const E5 = {
  id: "e5-small",
  title: "multilingual-e5-small, 8-bit",
  sizeBytes: 135_391_358,
  role: "alternative" as const,
  terms: null,
}
const PICKED = "/home/slava/Notes/Work"
const PICKED_VAULT = "/home/slava/Obsidian/Personal"
const VAULTS = [
  { name: "Personal", path: PICKED_VAULT, shown: "~/Obsidian/Personal" },
  { name: "Research", path: "/home/slava/Documents/Research", shown: "~/Documents/Research" },
]

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
  | "notesModelUse"
> {
  const scenario = params.get("memo") ?? memoDefault({ old: "old" })
  const fail = params.get("memo-fail")
  const counts = params.get("notes-progress") !== "old"
  const folders: NotesFolder[] =
    scenario === "fresh" ? [] : [{ id: "3", name: "Notes", path: "~/Documents/Notes", format: "obsidian" }]
  const modelScenario = params.get("model")
  const downloaded = new Set<string>(
    modelScenario === "gemma"
      ? ["embeddinggemma"]
      : modelScenario === "e5"
        ? ["e5-small"]
        : modelScenario === "both"
          ? ["embeddinggemma", "e5-small"]
          : scenario === "ready"
            ? ["embeddinggemma"]
            : [],
  )
  const vaults = params.get("obsidian") === "none" ? [] : [...VAULTS]
  let inUse = modelScenario === "e5" || modelScenario === "both" ? "e5-small" : "embeddinggemma"
  const models = () => [GEMMA, E5].map((m) => ({ ...m, downloaded: downloaded.has(m.id), inUse: m.id === inUse }))
  let stopped = false
  const problem = (): NotesProblem =>
    fail === "disk" ? "diskFull" : fail === "old" ? "tooOld" : fail === "sync" ? "busy" : "offline"
  return {
    async notesSetupStatus(): Promise<NotesSetup> {
      await delay(400)
      if (scenario === "old") return { state: "old", version: "0.131.2", need: "0.131.71" }
      return { state: "ready", folders: [...folders], models: models(), vaults: [...vaults] }
    },
    async notesPickFolder() {
      await delay(500)
      const pick = params.get("memo-pick")
      return pick === "cancel" ? null : pick === "vault" ? PICKED_VAULT : PICKED
    },
    async notesFolderAdd(_id, path) {
      await delay(700)
      if (fail === "folder") return { result: "failed", problem: "folderUnreadable" }
      const found = folders.find((f) => f.path === path.replace("/home/slava", "~"))
      const folder = found ?? {
        id: String(4 + folders.length),
        name: path.split("/").pop() ?? path,
        path: path.replace("/home/slava", "~"),
        format: VAULTS.some((v) => path.startsWith(v.path)) ? "obsidian" : "markdown",
      }
      if (!found) folders.push(folder)
      const listed = vaults.findIndex((v) => v.path === path)
      if (listed >= 0) vaults.splice(listed, 1)
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
    async notesModelDownload(_id, model, onEvent) {
      const size = (model === E5.id ? E5 : GEMMA).sizeBytes
      stopped = false
      const until = Date.now() + 6000
      while (!stopped && Date.now() < until) {
        await delay(100)
        if (counts)
          onEvent({
            event: "counted",
            done: Math.round(size * Math.min(1, 1 - (until - Date.now()) / 6000)),
            total: size,
            unit: "bytes",
            label: model,
          })
      }
      if (stopped) return onEvent({ event: "stopped" })
      if (fail === "download" || fail === "disk" || fail === "old")
        return onEvent({ event: "failed", problem: problem() })
      downloaded.add(model)
      onEvent({ event: "done" })
    },
    async notesModelUse(_id, model) {
      await delay(800)
      if (params.get("model-fail") === "use") return { result: "failed", problem: "busy" }
      const previous = inUse
      inUse = model
      return { result: "used", previous, toEmbed: 1840, estimateSeconds: model === GEMMA.id ? 920 : 60 }
    },
    async notesModelStop() {
      stopped = true
    },
  }
}
