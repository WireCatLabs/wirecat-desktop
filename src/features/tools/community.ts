import { addCommunityTools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"

/** Never fails: without its community tools the app still has every built-in one. */
export async function loadCommunityTools(): Promise<void> {
  try {
    const extra = await platform.extraTools()
    for (const why of [...extra.rejected, ...addCommunityTools(extra.tools)]) {
      console.error(`A community tool was left out. ${why}`)
    }
  } catch (e) {
    console.error("Could not read the community tools.", e)
  }
}
