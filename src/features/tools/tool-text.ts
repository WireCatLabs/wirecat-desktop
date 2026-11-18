import type { CatalogTool } from "@/domain/catalog"
import { type Lang, useLang } from "@/i18n"
import type { ToolsText } from "./messages"
import { LOCAL_NAMES } from "./messages-tool-text"

export const syncNote = (t: CatalogTool) => t.sync?.note?.replace(" {profile}", "") ?? null

/** A tool's own text in the reader's language, or tools.json's English for a tool not translated yet. */
export const toolText = (m: ToolsText, t: CatalogTool) => ({
  tagline: m.tool.tagline[t.id] ?? t.tagline,
  summary: m.tool.summary[t.id] ?? t.summary,
  syncNote: m.tool.syncNote[t.id] ?? syncNote(t),
})

export const groupLabel = (m: ToolsText, key: string, label: string) => m.tool.group[key] ?? label

type Named = Pick<CatalogTool, "id" | "name">

const toolName = (t: Named, lang: Lang) => LOCAL_NAMES[t.id]?.[lang] ?? t.name

export function useToolName() {
  const lang = useLang()
  return (t: Named) => toolName(t, lang)
}
