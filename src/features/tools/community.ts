import { addCommunityTools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { reloadAddedTools } from "@/shared/added-tools"
import { keepLeftOut } from "@/shared/left-out"

/** Never fails: without its community tools the app still has every built-in one. */
export async function loadCommunityTools(): Promise<void> {
  try {
    const extra = await platform.extraTools()
    const leftOut = [...extra.rejected, ...addCommunityTools(extra.tools)]
    keepLeftOut(leftOut)
    for (const why of leftOut) console.error(`A community tool was left out. ${why.text}`)
  } catch (e) {
    console.error("Could not read the community tools.", e)
  }
  // The tools' own descriptions can take seconds after start; the interface does not wait for them.
  void platform
    .describedTools()
    .then((changed) => (changed ? reloadAddedTools() : undefined))
    .catch(() => undefined)
}
