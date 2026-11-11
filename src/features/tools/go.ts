import { openTool } from "@/shared/go-tool"
import { keep } from "./kept"

export { openTool, openToolAt, type ToolPlace } from "@/shared/go-tool"

/** Opens a tool's "MCP server (or connect web)" section and brings it into view. */
export function openConnect(id: string) {
  keep(`mcp:${id}`, "open", true)
  keep(`mcp:${id}`, "reveal", true)
  openTool(id)
}
