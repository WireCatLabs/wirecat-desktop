import { revealTarget } from "@/ui/motion"
import { useNav } from "./nav"
import { useTools } from "./tools-store"

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-tool="${CSS.escape(id)}"]`)

const toggleOf = (row: HTMLElement) => row.querySelector<HTMLElement>("[aria-controls]")

/** Takes the owner to a tool's Manage panel on the Tools page, wherever they are, and marks its row there. */
export function openTool(id: string) {
  useNav.getState().go("tools")
  useTools.setState({ expanded: id })
  revealTarget(() => rowOf(id), { focus: toggleOf })
}

export type ToolPlace = "accounts" | "sync" | "service" | "mailAgent"

const placeOf = (id: string, place: ToolPlace) =>
  document.querySelector<HTMLElement>(`[data-place="${place}:${CSS.escape(id)}"]`)

const focusTarget = (id: string, place: ToolPlace, section: HTMLElement) =>
  place === "accounts"
    ? (document.getElementById(`profile-${id}`) ?? section.querySelector<HTMLElement>("button"))
    : section.querySelector<HTMLElement>("button:not([disabled])")

/** Opens a tool's Manage panel and brings one part of it into view, with focus on its first control. */
export function openToolAt(id: string, place: ToolPlace) {
  useNav.getState().go("tools")
  useTools.setState({ expanded: id })
  revealTarget(() => placeOf(id, place), { focus: (section) => focusTarget(id, place, section) })
}
