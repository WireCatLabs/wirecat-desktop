import { advice, type SyncFailure } from "@/domain/sync"
import type { NotesProblem } from "@/platform/bindings"

/** The notes sync is memo's ordinary sync, so its failures arrive as a sync's; the card names them like the others. */
export function syncProblem(f: SyncFailure): NotesProblem {
  if (f.code === "permission_error") return "folderUnreadable"
  switch (advice(f).kind) {
    case "busy":
      return "busy"
    case "update":
      return "tooOld"
    case "unreachable":
      return "offline"
    default:
      return "other"
  }
}

/** The way memo and the download page write sizes (megabytes of 1,000,000 bytes), not the 129 MiB a binary unit gives. */
export const megabytes = (bytes: number) => Math.round(bytes / 1_000_000)
