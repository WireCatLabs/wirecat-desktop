import * as v from "valibot"
import type { ToolState } from "@/platform/schemas"
import { safeStorage } from "./safe-storage"

/**
 * The Tools page's last answer, kept for the next app start so the page opens with it while the tools are asked
 * again. Only what the page already shows: versions, `~` paths, the package manager, a masked problem line.
 */
const KEY = "wirecat.tools.last"

// An older app version may have written another shape, so what comes back from storage is checked.
const ToolStatesSchema = v.array(
  v.object({
    id: v.string(),
    installs: v.array(
      v.object({
        path: v.string(),
        version: v.nullable(v.string()),
        manager: v.string(),
        problem: v.nullable(v.string()),
      }),
    ),
  }),
) satisfies v.GenericSchema<unknown, ToolState[]>

const SavedSchema = v.object({
  tools: ToolStatesSchema,
  latest: v.nullable(v.record(v.string(), v.nullable(v.string()))),
})
export type Saved = v.InferOutput<typeof SavedSchema>

export function readSaved(storage: Pick<Storage, "getItem"> = safeStorage): Saved | null {
  try {
    const parsed = v.safeParse(SavedSchema, JSON.parse(storage.getItem(KEY) ?? "null"))
    return parsed.success ? parsed.output : null
  } catch {
    return null
  }
}

export function save(saved: Saved, storage: Pick<Storage, "setItem"> = safeStorage) {
  storage.setItem(KEY, JSON.stringify(saved))
}
