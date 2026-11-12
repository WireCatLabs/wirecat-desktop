import { revealIfHidden } from "@/ui/motion"
import { useNav } from "./nav"

/** Settings, at one section: `go` alone does nothing when Settings is already open, so the section is scrolled to. */
export function goSettingsAt(section: string) {
  useNav.getState().go("settings")
  requestAnimationFrame(() => revealIfHidden(document.getElementById(section), "start"))
}

/** Settings, at «AI model». */
export const goAiModel = () => goSettingsAt("ai-model")
