import { actionSentence, actionTargetOf, byOwner, dayKey, findingsCounts, mailboxOf } from "@/domain/memory"
import { type OwnerRole, relationParts, roleLabel } from "@/domain/relationships"
import { currentLang, formatDate, type Lang } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import type { memoryMessages } from "./messages"
import type { explainedMessages } from "./messages-explained"

export type M = typeof memoryMessages.en
export type X = typeof explainedMessages.en

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
function relationLine(e: MemoryEntry, m: M, roles: readonly OwnerRole[]) {
  const to = e.targetName ?? e.target ?? ""
  return e.role ? `${to} · ${roleLabel(e.role, roles, m.roles, currentLang())}` : to
}

/** A relationship as one sentence: "Kai Moreno is the owner of the document “Sales plan”". */
export function relationSentence(e: MemoryEntry, m: M, x: X, roles: readonly OwnerRole[]) {
  const p = relationParts(e)
  if (p.role) return x.withRole(p, roleLabel(p.role, roles, m.roles, currentLang()))
  const say = x.noRole[p.kind] ?? x.noRole.other
  return say?.(p.from, p.to) ?? relationLine(e, m, roles)
}

/**
 * What the row's text says: the record's own text, for a findings batch how many facts and tasks it holds (a mail
 * batch: how many findings and from which mailbox), for a
 * relationship a sentence (or its other end and role, where the sentence's words are not at hand).
 */
export function textOf(e: MemoryEntry, m: M, roles: readonly OwnerRole[] = [], x?: X) {
  if (e.type === "relationship") return x ? relationSentence(e, m, x, roles) : relationLine(e, m, roles)
  if (e.findings) {
    const c = findingsCounts(e.findings, e.status)
    if (c.reviewed) return m.findingsReviewed(c.first, c.second)
    const mailbox = mailboxOf(e)
    return mailbox === null ? m.findingsTitle(c.first, c.second) : m.mailTitle(e.findings.length, mailbox)
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
