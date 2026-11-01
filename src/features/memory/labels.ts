import { byOwner, dayKey } from "@/domain/memory"
import { formatDate, type Lang } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import type { memoryMessages } from "./messages"

type M = typeof memoryMessages.en

/** Who an entry is about, as the About field matches it: "You" in the reader's language for the owner. */
export const aboutOf = (e: MemoryEntry, m: M) => (e.subjectIsOwner ? m.you : (e.subjectName ?? e.subject ?? ""))

/** The project a record belongs to: a fact's or a batch's own, or a memory whose subject is a project. */
export const projectOf = (e: MemoryEntry) =>
  e.projectName ?? (e.subject?.startsWith("project:") ? (e.subjectName ?? "") : "")

export const authorOf = (e: MemoryEntry, m: M) => (byOwner(e) ? m.you : (e.author?.name ?? m.anAgent))

export const kindOf = (kind: string, m: M) => m.kinds[kind] ?? kind.replaceAll("_", " ")

export function dayLabel(iso: string, m: M, lang: Lang, now = new Date()) {
  const day = dayKey(iso)
  if (day === dayKey(now.toISOString())) return m.today
  if (day === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return m.yesterday
  const sameYear = new Date(iso).getFullYear() === now.getFullYear()
  return formatDate(iso, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }, lang)
}

export const timeOf = (iso: string, lang: Lang) =>
  formatDate(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, lang)

export const savedAt = (iso: string, lang: Lang) =>
  formatDate(
    iso,
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    lang,
  )
