import type { Grain } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatDate } from "@/i18n"

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

const NAMES: Record<string, string> = {
  telegram: "Telegram",
  max: "MAX",
  whatsapp: "WhatsApp",
  email: "Email",
  "google-drive": "Google Drive",
  zoom: "Zoom",
}

export const sourceName = (provider: string, notes: string) =>
  NAMES[provider] ?? (provider === "notes" ? notes : provider)

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
