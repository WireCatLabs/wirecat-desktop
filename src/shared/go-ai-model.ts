import { revealIfHidden } from "@/ui/motion"
import { useNav } from "./nav"

/** Settings, at «AI model»: `go` alone does nothing when Settings is already open, so the section is scrolled to. */
export function goAiModel() {
  useNav.getState().go("settings")
  requestAnimationFrame(() => revealIfHidden(document.getElementById("ai-model"), "start"))
}
