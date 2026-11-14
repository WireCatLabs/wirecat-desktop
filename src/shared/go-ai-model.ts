import { revealTarget } from "@/ui/motion"
import { useNav } from "./nav"

/** Settings, at one section, brought into view and marked once the lazy page has drawn it. */
export function goSettingsAt(section: string) {
  useNav.getState().go("settings")
  revealTarget(() => document.getElementById(section))
}

/** Settings, at «AI model». */
export const goAiModel = () => goSettingsAt("ai-model")
