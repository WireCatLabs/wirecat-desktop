import type { ChosenFolders, DriveFolder, FolderAdded, FolderLevel, FolderRemoved, TranscriptsFound } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// drive-cli PR #335's `folders browse` and `folders add`. `?drive-folders=open` signs Drive in quickly, so the picker
// shows; `fail` refuses the first level (expired sign-in), `old` is a drive before `folders browse`, `partial` says
// Google searched only some drives, `add-fail` refuses one folder on Add (rate limited). The profile starts with Meeting
// notes chosen and synced; a folder added here has no name until a sync copies it, as drive answers.

const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = query.get("drive-folders")
// drive's `transcripts list`: `?drive-transcripts=none` finds nothing, `fail` refuses (rate limited), `old` is a drive
// before the command. Without it, five are found, the newest three named.
const transcriptsScenario = query.get("drive-transcripts")
const TRANSCRIPTS = ["Planning sync - Notes by Gemini", "Weekly standup - Transcript", "Client call - Transcript"]

const folder = (
  id: string,
  name: string,
  parent: string,
  childFolders: number | null,
  extra: Partial<DriveFolder> = {},
) =>
  ({
    id,
    name,
    kind: "folder",
    parent,
    location: "my_drive",
    driveId: null,
    childFolders,
    added: false,
    ...extra,
  }) satisfies DriveFolder

const LEVELS: Record<string, DriveFolder[]> = {
  "": [
    { ...folder("root", "My Drive", "", 4), kind: "my_drive", parent: null },
    {
      ...folder("shared-with-me", "Shared with me", "", null),
      kind: "shared_with_me",
      parent: null,
      location: "shared_with_me",
    },
    {
      ...folder("0AShared1", "Team handbook", "", 2),
      kind: "shared_drive",
      parent: null,
      location: "shared_drive",
      driveId: "0AShared1",
    },
  ],
  root: [
    folder("1Budget", "Budget", "root", 0),
    folder("1Clients", "Clients", "root", 3),
    folder("1Notes", "Meeting notes", "root", 0, { added: true }),
    folder("1Photos", "Photos", "root", 0),
  ],
  "1Clients": [
    folder("2Acme", "Acme", "1Clients", 0),
    folder("2Globex", "Globex", "1Clients", 0),
    folder("2Initech", "Initech", "1Clients", 1),
  ],
  "2Initech": [folder("3Contracts", "Contracts", "2Initech", 0)],
  "shared-with-me": [
    folder("4Recipes", "Family recipes", "shared-with-me", 0, { location: "shared_with_me" }),
    folder("4Trip", "Trip 2026", "shared-with-me", 2, { location: "shared_with_me" }),
  ],
  "4Trip": [
    folder("5Tickets", "Tickets", "4Trip", 0, { location: "shared_with_me" }),
    folder("5Plans", "Plans", "4Trip", 0, { location: "shared_with_me" }),
  ],
  "0AShared1": [
    folder("6Policies", "Policies", "0AShared1", 0, { location: "shared_drive", driveId: "0AShared1" }),
    folder("6Onboarding", "Onboarding", "0AShared1", 0, { location: "shared_drive", driveId: "0AShared1" }),
  ],
}

// notion-cli PR #15's `folders browse`: pages and databases, the top in pages of 8 with `nextCursor`, the second page
// empty as notion's can be. `?notion-folders=cut` says Notion's search was cut at 10,000, `old` is a notion before 0.4.0.
// Nothing is chosen at first, so `folders list` gives the whole workspace.
const notionScenario = query.get("notion-folders")
const WORKSPACE = "notion-workspace"
const NOTION_PAGE = 8
const notionItem = (id: string, name: string, kind: "page" | "database", parent: string | null) =>
  ({
    id,
    name,
    kind,
    parent,
    location: null,
    driveId: null,
    childFolders: null,
    added: false,
  }) satisfies DriveFolder
const TOP_NAMES = [
  "Roadmap",
  "Team wiki",
  "Meeting notes",
  "Hiring",
  "Design reviews",
  "Reading list",
  "Travel",
  "Recipes",
  "Garden",
  "Home renovation",
  "Side projects",
  "Archive 2025",
]
const NOTION_TOP = [
  ...TOP_NAMES.map((name, i) => notionItem(`n-top-${i}`, name, "page", null)),
  notionItem("n-db-tasks", "Tasks", "database", null),
  notionItem("n-db-contacts", "Contacts", "database", null),
]
const NOTION_LEVELS: Record<string, DriveFolder[]> = {
  "n-top-0": [
    notionItem("n-q1", "Q1 plan", "page", "n-top-0"),
    notionItem("n-q2", "Q2 plan", "page", "n-top-0"),
    notionItem("n-db-milestones", "Milestones", "database", "n-top-0"),
  ],
  "n-q1": [notionItem("n-q1-launch", "Launch checklist", "page", "n-q1")],
}
/** Page 1 holds the first eight, page 2 nothing (notion read past blocks without pages), page 3 the rest. */
function notionLevel(parent: string | null, cursor: string | null, chosen: string[]): FolderLevel {
  const mark = (f: DriveFolder) => ({ ...f, added: chosen.includes(f.id) })
  if (parent !== null)
    return { result: "listed", folders: (NOTION_LEVELS[parent] ?? []).map(mark), partial: false, nextCursor: null }
  const page = cursor === null ? 0 : Number(cursor.split(".")[1])
  const folders = page === 0 ? NOTION_TOP.slice(0, NOTION_PAGE) : page === 1 ? [] : NOTION_TOP.slice(NOTION_PAGE)
  return {
    result: "listed",
    folders: folders.map(mark),
    partial: notionScenario === "cut" && page === 0,
    nextCursor: page < 2 ? `notion-browse1.${page + 1}` : null,
  }
}

// ydisk 0.2.0's `folders browse`. `folders add` takes the Disk path, but `folders list` and `folders remove` take
// Yandex's resource id, so the mock keeps both. `?ydisk-folders=open` signs in with a sample token and opens the
// picker; `fail` refuses the top (Yandex no longer accepts the token), `add-fail` refuses one folder on Add.
const ydiskScenario = query.get("ydisk-folders")
const ydiskItem = (path: string) =>
  ({
    id: `disk:${path}`,
    name: path.split("/").at(-1) ?? path,
    kind: "folder",
    parent: null,
    location: null,
    driveId: null,
    childFolders: `disk:${path}` in YDISK_LEVELS ? null : 0,
    added: false,
  }) satisfies DriveFolder
const YDISK_LEVELS: Record<string, string[]> = {
  "": ["/Документы", "/Работа", "/Фото", "/Загрузки", "/Scans"],
  "disk:/Работа": ["/Работа/Клиенты", "/Работа/Отчёты 2026", "/Работа/Договоры"],
  "disk:/Работа/Клиенты": ["/Работа/Клиенты/Acme", "/Работа/Клиенты/Ромашка"],
  "disk:/Документы": ["/Документы/Паспорт и визы", "/Документы/Налоги"],
}
/** The resource id ydisk lists a chosen folder by: Yandex's own, the owner's uid and a hash. */
const resourceId = (path: string) =>
  `4000000000:${[...path].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16)}`
const ydiskAdded = new Map<string, string>()
let ydiskRefused = false

const added = new Set<string>()
const removed = new Set<string>()
let refused = false

const chosenNow = () => [...new Set(["1Notes", ...added])].filter((id) => !removed.has(id) && !id.startsWith("n-"))

export function driveFoldersMock(): Pick<
  Platform,
  "driveFoldersBrowse" | "driveFolderAdd" | "driveFoldersChosen" | "driveFolderRemove" | "driveTranscriptsFind"
> {
  return {
    async driveFoldersBrowse(id, _profile, parent, cursor): Promise<FolderLevel> {
      await delay(500)
      if (id === "ydisk") {
        if (ydiskScenario === "fail" && parent === null)
          return {
            result: "failed",
            code: "authentication_error",
            reason: "auth.failed",
            message: "Yandex Disk refused the token; sign in again with ydisk personal session start",
          }
        const chosen = [...ydiskAdded.values()]
        const folders = (YDISK_LEVELS[parent ?? ""] ?? []).map((path) => {
          const f = ydiskItem(path)
          return { ...f, added: chosen.includes(f.id) }
        })
        return { result: "listed", folders, partial: false, nextCursor: null }
      }
      if (id === "notion") {
        if (notionScenario === "old")
          return {
            result: "failed",
            code: "needs_update",
            reason: null,
            message: "This version cannot list folders yet. Update it on the Tools page.",
          }
        return notionLevel(
          parent,
          cursor,
          [...added].filter((f) => !removed.has(f)),
        )
      }
      if (scenario === "old")
        return { result: "failed", code: "needs_update", reason: null, message: "error: unknown command 'browse'" }
      if (scenario === "fail" && parent === null)
        return {
          result: "failed",
          code: "authentication_error",
          reason: "oauth.expired",
          message: "the Google sign-in expired or was revoked",
        }
      const chosen = chosenNow()
      const folders = (LEVELS[parent ?? ""] ?? []).map((f) => ({ ...f, added: chosen.includes(f.id) }))
      return { result: "listed", folders, partial: scenario === "partial" && parent === null, nextCursor: null }
    },
    async driveFolderAdd(tool, _profile, id): Promise<FolderAdded> {
      await delay(700)
      if (tool === "ydisk") {
        if (ydiskScenario === "add-fail" && !ydiskRefused) {
          ydiskRefused = true
          return {
            result: "failed",
            code: "rate_limited",
            reason: "provider.rate-limited",
            message: "Yandex Disk asks to slow down",
          }
        }
        ydiskAdded.set(resourceId(id), id)
        return { result: "added" }
      }
      if (scenario === "add-fail" && !refused) {
        refused = true
        return {
          result: "failed",
          code: "rate_limited",
          reason: "provider.rate-limited",
          message: "Google asks to slow down",
        }
      }
      added.add(id)
      removed.delete(id)
      return { result: "added" }
    },
    async driveFoldersChosen(id): Promise<ChosenFolders> {
      await delay(450)
      if (id === "ydisk")
        return {
          result: "listed",
          folders: [...ydiskAdded].map(([folder, path]) => ({ id: folder, name: path.split("/").at(-1) ?? null })),
        }
      if (id === "notion") {
        const ids = [...added].filter((f) => f.startsWith("n-") && !removed.has(f))
        const named = (f: string) =>
          [...NOTION_TOP, ...Object.values(NOTION_LEVELS).flat()].find((n) => n.id === f)?.name
        return {
          result: "listed",
          folders: ids.length ? ids.map((f) => ({ id: f, name: named(f) ?? null })) : [{ id: WORKSPACE, name: null }],
        }
      }
      return {
        result: "listed",
        folders: chosenNow().map((id) => ({ id, name: id === "1Notes" ? "Meeting notes" : null })),
      }
    },
    async driveFolderRemove(_id, _profile, id): Promise<FolderRemoved> {
      await delay(600)
      ydiskAdded.delete(id)
      removed.add(id)
      added.delete(id)
      return { result: "removed" }
    },
    async driveTranscriptsFind(): Promise<TranscriptsFound> {
      await delay(700)
      if (transcriptsScenario === "old")
        return { result: "failed", code: "needs_update", reason: null, message: "error: unknown command 'transcripts'" }
      if (transcriptsScenario === "fail")
        return {
          result: "failed",
          code: "rate_limited",
          reason: "provider.rate-limited",
          message: "Google asks to slow down",
        }
      if (transcriptsScenario === "none") return { result: "found", count: 0, titles: [] }
      return { result: "found", count: 5, titles: TRANSCRIPTS }
    },
  }
}
