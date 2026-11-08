import { replaceAddedTools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { useCatalog } from "@/shared/catalog-store"
import { keepLeftOut } from "@/shared/left-out"

/**
 * After an own tool is added or removed, or the switch for them changes: Rust reloaded its catalog before answering,
 * so this reads the new one. Shared, because Settings and the Tools page both change it.
 */
export async function reloadAddedTools(): Promise<void> {
  try {
    const extra = await platform.extraTools()
    const leftOut = [...extra.rejected, ...replaceAddedTools(extra.tools)]
    keepLeftOut(leftOut)
    for (const why of leftOut) console.error(`A community tool was left out. ${why.text}`)
  } catch (e) {
    console.error("Could not read the community tools again.", e)
  }
  useCatalog.getState().changed()
}
