import { addCommunityTools, replaceAddedTools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { useCatalog } from "@/shared/catalog-store"
import { keepLeftOut } from "@/shared/left-out"

const report = (leftOut: { text: string }[]) => {
  for (const why of leftOut) console.error(`A community tool was left out. ${why.text}`)
}

/** Never fails: without its community tools the app still has every built-in one. */
export async function loadCommunityTools(): Promise<void> {
  try {
    const extra = await platform.extraTools()
    const leftOut = [...extra.rejected, ...addCommunityTools(extra.tools)]
    keepLeftOut(leftOut)
    report(leftOut)
  } catch (e) {
    console.error("Could not read the community tools.", e)
  }
}

/** After an own tool is added or removed: Rust reloaded its catalog before answering, so this reads the new one. */
export async function reloadAddedTools(): Promise<void> {
  try {
    const extra = await platform.extraTools()
    const leftOut = [...extra.rejected, ...replaceAddedTools(extra.tools)]
    keepLeftOut(leftOut)
    report(leftOut)
  } catch (e) {
    console.error("Could not read the community tools again.", e)
  }
  useCatalog.getState().changed()
}
