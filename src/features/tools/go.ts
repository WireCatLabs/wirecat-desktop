import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { keep } from "./kept"

export { openTool, openToolAt, type ToolPlace } from "@/shared/go-tool"

/** Opens a tool's "MCP server (or connect web)" section and brings it into view; the section reveals itself. */
export function openConnect(id: string) {
  keep(`mcp:${id}`, "open", true)
  keep(`mcp:${id}`, "reveal", true)
  useNav.getState().go("tools")
  useTools.setState({ expanded: id })
}
