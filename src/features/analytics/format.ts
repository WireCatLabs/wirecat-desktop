import type { Grain } from "@/domain/analytics"
import { providerName } from "@/domain/archive"
import { findTool } from "@/domain/catalog"
import { formatDate, useMessages } from "@/i18n"
import { storageMessages } from "../storage/messages"

/** Each source keeps its hue whatever is filtered or missing, so a reader who learned "Telegram is blue" stays right. */
const COLORS: Record<string, string> = {
  telegram: "var(--series-1)",
  max: "var(--series-2)",
  whatsapp: "var(--series-3)",
  email: "var(--series-4)",
  "google-drive": "var(--series-5)",
  zoom: "var(--series-6)",
}

export const SOURCE_ORDER = Object.keys(COLORS)
export const colorOf = (provider: string) => COLORS[provider] ?? "var(--series-other)"

/** A source by the name Storage gives it, in the interface language: product names, "Notes", "Test data". */
export function useSourceName(): (provider: string) => string {
  const words = useMessages(storageMessages).archiveWords
  return (provider) => providerName(provider, words)
}

/** The source a tool's runs belong to, for the colour of its bar: Email is a part of Memo with its own source. */
const TOOL_SOURCE: Record<string, string> = {
  tg: "telegram",
  max: "max",
  wa: "whatsapp",
  email: "email",
  drive: "google-drive",
  zm: "zoom",
}
export const toolColor = (id: string) => colorOf(TOOL_SOURCE[id] ?? "")
export const toolName = (id: string) => findTool(id)?.name ?? id

/** Keys are calendar days (or a year), already in the owner's zone: read and written at noon UTC so none shifts. */
const asDate = (key: string) => new Date(`${key.length === 4 ? `${key}-07-01` : key}T12:00:00Z`)
const UTC = { timeZone: "UTC" } as const

export function shortKey(key: string, grain: Grain | "year"): string {
  if (grain === "year") return key
  if (grain === "month") return formatDate(asDate(key), { month: "short", year: "2-digit", ...UTC })
  return formatDate(asDate(key), { day: "numeric", month: "short", ...UTC })
}

export function longKey(key: string, grain: Grain | "year", weekOf: (day: string) => string): string {
  if (grain === "year") return key
  if (grain === "month") return formatDate(asDate(key), { month: "long", year: "numeric", ...UTC })
  const day = formatDate(asDate(key), { day: "numeric", month: "long", year: "numeric", ...UTC })
  return grain === "week" ? weekOf(day) : formatDate(asDate(key), { weekday: "short", ...UTC }).concat(", ", day)
}
