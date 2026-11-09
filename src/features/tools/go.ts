import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { revealIfHidden } from "@/ui/motion"
import { keep } from "./kept"

/** Takes the owner to a tool's Manage panel on the Tools page, wherever they are. */
export function openTool(id: string) {
  useNav.getState().go("tools")
  useTools.setState({ expanded: id })
}

/** Opens a tool's "MCP server (or connect web)" section and brings it into view. */
export function openConnect(id: string) {
  keep(`mcp:${id}`, "open", true)
  keep(`mcp:${id}`, "reveal", true)
  openTool(id)
}

export type ToolPlace = "accounts" | "sync" | "service" | "mailAgent"

// The Tools page loads lazily and the panel reads its profiles first, so the place shows up a moment later.
const PLACE_WAIT_MS = 4000

const placeOf = (id: string, place: ToolPlace) =>
  document.querySelector<HTMLElement>(`[data-place="${place}:${CSS.escape(id)}"]`)

const focusTarget = (id: string, place: ToolPlace, section: HTMLElement) =>
  place === "accounts"
    ? (document.getElementById(`profile-${id}`) ?? section.querySelector<HTMLElement>("button"))
    : section.querySelector<HTMLElement>("button:not([disabled])")

/** Opens a tool's Manage panel and brings one part of it into view, with focus on its first control. */
export function openToolAt(id: string, place: ToolPlace) {
  openTool(id)
  const until = performance.now() + PLACE_WAIT_MS
  const look = () => {
    const section = placeOf(id, place)
    if (section) {
      revealIfHidden(section, "start")
      focusTarget(id, place, section)?.focus({ preventScroll: true })
    } else if (performance.now() < until) requestAnimationFrame(look)
  }
  requestAnimationFrame(look)
}
