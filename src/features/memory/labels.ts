import { actionSentence, actionTargetOf, byOwner, dayKey, findingsCounts } from "@/domain/memory"
import { type OwnerRole, roleLabel } from "@/domain/relationships"
import { formatDate, type Lang } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import type { memoryMessages } from "./messages"

export type M = typeof memoryMessages.en

/** Who an entry is about, as the About field matches it: "You" in the reader's language for the owner. */
export const aboutOf = (e: MemoryEntry, m: M) => (e.subjectIsOwner ? m.you : (e.subjectName ?? e.subject ?? ""))

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

/** A relationship's other end and its role, under the heading of the end it starts from: "Acme Ltd · Manager". */
export function relationLine(e: MemoryEntry, m: M, roles: readonly OwnerRole[]) {
  const to = e.targetName ?? e.target ?? ""
  return e.role ? `${to} · ${roleLabel(e.role, roles, m.roles)}` : to
}

/**
 * What the row's text says: the record's own text, for a findings batch how many facts and tasks it holds, for a
 * relationship its other end and role.
 */
export function textOf(e: MemoryEntry, m: M, roles: readonly OwnerRole[] = []) {
  if (e.type === "relationship") return relationLine(e, m, roles)
  if (e.findings) {
    const c = findingsCounts(e.findings, e.status)
    return c.reviewed ? m.findingsReviewed(c.first, c.second) : m.findingsTitle(c.first, c.second)
  }
  if (e.type === "action") return actionLine(e, m, true)
  return e.text ?? kindOf(e.kind, m)
}

/**
 * An action in the interface's language, from memo's parts: its verb, what it acts on by name and, when asked, its
 * text. A verb the page has no words for falls back to memo's English line.
 */
export function actionLine(e: MemoryEntry, m: M, withText: boolean) {
  const verb = e.verb ? m.verbs[e.verb] : undefined
  if (!verb) return e.summary ?? e.text ?? kindOf(e.kind, m)
  return actionSentence(verb, actionTargetOf(e), withText ? e.text : null)
}
