import type { DriveFolder, FolderAdded, FolderLevel } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// drive-cli PR #335's `folders browse` and `folders add`. `?drive-folders=open` signs Drive in quickly, so the picker
// shows; `fail` refuses the first level (expired sign-in), `old` is a drive before `folders browse`, `partial` says
// Google searched only some drives, `add-fail` refuses one folder on Add (rate limited).

const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = query.get("drive-folders")

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

const added = new Set<string>()
let refused = false

export function driveFoldersMock(): Pick<Platform, "driveFoldersBrowse" | "driveFolderAdd"> {
  return {
    async driveFoldersBrowse(_id, _profile, parent): Promise<FolderLevel> {
      await delay(500)
      if (scenario === "old")
        return { result: "failed", code: "needs_update", reason: null, message: "error: unknown command 'browse'" }
      if (scenario === "fail" && parent === null)
        return {
          result: "failed",
          code: "authentication_error",
          reason: "oauth.expired",
          message: "the Google sign-in expired or was revoked",
        }
      const folders = (LEVELS[parent ?? ""] ?? []).map((f) => ({ ...f, added: f.added || added.has(f.id) }))
      return { result: "listed", folders, partial: scenario === "partial" && parent === null }
    },
    async driveFolderAdd(_id, _profile, id): Promise<FolderAdded> {
      await delay(700)
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
      return { result: "added" }
    },
  }
}
