import { tools } from "@/domain/catalog"
import { setupTools } from "@/domain/onboarding-flow"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"

/** The tools this setup is about: the ones chosen in this flow and the ones already on the computer. */
export function useSetupTools() {
  const installs = useTools((s) => s.installs)
  const chosen = useOnboarding((s) => s.chosen)
  return setupTools(tools, chosen, installs)
}
