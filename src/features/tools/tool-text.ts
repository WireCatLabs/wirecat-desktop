import type { CatalogTool } from "@/domain/catalog"
import { currentLang, type Lang, useLang } from "@/i18n"
import type { ToolsText } from "./messages"
import { LOCAL_NAMES } from "./messages-tool-text"

export const syncNote = (t: CatalogTool) => t.sync?.note?.replace(" {profile}", "") ?? null

/**
 * A tool's own text in the reader's language: the signed list's first, then the app's translation, then the site's
 * summary for an official tool the app has no words for, then tools.json's English.
 */
export const toolText = (m: ToolsText, t: CatalogTool, lang: Lang = currentLang()) => {
  const listed = t.i18n?.[lang]
  return {
    tagline: listed?.tagline ?? m.tool.tagline[t.id] ?? t.tagline,
    summary: listed?.summary ?? m.tool.summary[t.id] ?? t.summaries?.[lang] ?? t.summary,
    syncNote: listed?.syncNote ?? m.tool.syncNote[t.id] ?? syncNote(t),
    gives: t.signIn ? (listed?.gives ?? m.tool.gives[t.id] ?? t.signIn.gives) : null,
    asks: t.signIn ? (listed?.asks ?? m.tool.asks[t.id] ?? t.signIn.asks) : null,
  }
}

export const groupLabel = (m: ToolsText, key: string, label: string) => m.tool.group[key] ?? label

type Named = Pick<CatalogTool, "id" | "name" | "i18n">

const toolName = (t: Named, lang: Lang) => t.i18n?.[lang]?.name ?? LOCAL_NAMES[t.id]?.[lang] ?? t.name

export function useToolName() {
  const lang = useLang()
  return (t: Named) => toolName(t, lang)
}
