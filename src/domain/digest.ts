// The digests archive's plain logic: a `wirecat.report/1` document laid out as cli-core's renderer lays it out
// (`src/background/report/view.ts`): sections in a fixed order, one emoji per item type, dates relative to now.

import { type DeepLinkTarget, formatLink, linkTargetOf, parseLink } from "./links"

export const SECTION_ORDER = ["today", "decisions", "money", "meetings", "projects", "crm", "mail"] as const
export type SectionKind = (typeof SECTION_ORDER)[number]

export const SECTION_EMOJI: Record<SectionKind, string> = {
  today: "🔥",
  decisions: "🗳",
  money: "💰",
  meetings: "📅",
  projects: "🚀",
  crm: "🤝",
  mail: "📬",
}
export const HEALTH_EMOJI = "🛠"
export const TITLE_EMOJI = "☀️"
/** A source counts as stale past a day without a named reason, as the renderer has it. */
const STALE_HOURS = 24

type Item = {
  type: "reply" | "question" | "task" | "fact" | "risk" | "money" | "decision" | "meeting"
  priority: "high" | "normal"
  amount: { direction: "in" | "out" } | null
  due: string | null
}

export function isOverdue(item: Item, now: number): boolean {
  if (!item.due || !(item.type === "task" || item.type === "money" || item.type === "risk")) return false
  return momentOf(item.due, now, "en").past
}

export function emojiOf(item: Item, overdue: boolean): string {
  switch (item.type) {
    case "reply":
      return "💬"
    case "question":
      return "❓"
    case "task":
      return overdue ? "⏰" : "📌"
    case "fact":
      return "ℹ️"
    case "risk":
      return item.priority === "high" ? "🔴" : "⚠️"
    case "money":
      return item.amount?.direction === "in" ? "📥" : "📤"
    case "decision":
      return "☑️"
    case "meeting":
      return "👥"
  }
}

export type Moment = {
  /** "7 November", "7 ноября". */
  date: string
  /** "18:00", or null for a date alone. */
  time: string | null
  day: "today" | "yesterday" | "tomorrow" | null
  past: boolean
  /** How far from now in the largest whole unit: "2 days", "5 часов". */
  span: string
}

const DAY_MS = 86_400_000
const localDay = (at: number) => {
  const d = new Date(at)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}
const utcOf = (day: string) => {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function momentOf(iso: string, now: number, lang: string): Moment {
  const dateOnly = iso.length === 10
  const at = dateOnly ? utcOf(iso) : Date.parse(iso)
  const dayUtc = dateOnly ? at : localDay(at)
  const days = Math.round((dayUtc - localDay(now)) / DAY_MS)
  const unit = (count: number, name: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(lang, { style: "unit", unit: name, unitDisplay: "long" }).format(count)
  const distance = Math.abs(at - now)
  const span = dateOnly
    ? unit(Math.abs(days), "day")
    : distance < 3_600_000
      ? unit(Math.floor(distance / 60_000), "minute")
      : distance < DAY_MS
        ? unit(Math.floor(distance / 3_600_000), "hour")
        : unit(Math.floor(distance / DAY_MS), "day")
  return {
    date: new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" }).format(dayUtc),
    time: dateOnly
      ? null
      : new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at),
    day: days === 0 ? "today" : days === -1 ? "yesterday" : days === 1 ? "tomorrow" : null,
    past: dateOnly ? days < 0 : at < now,
    span,
  }
}

/** "Friday, 7 November" in the interface language. */
export const dayTitle = (date: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utcOf(date))

export function amountText(amount: { value: number; currency: string; direction: "in" | "out" }, lang: string) {
  const fraction = Number.isInteger(amount.value) ? 0 : 2
  const money = new Intl.NumberFormat(lang, {
    style: "currency",
    currency: amount.currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(Math.abs(amount.value))
  return `${amount.direction === "in" ? "+" : "−"}${money}`
}

/**
 * A store row a digest names that WireCat opens in its own card: a meeting or calendar event, a document, a CRM deal or
 * lead. cli-core's v1 links name none of these, so they open only from inside the app.
 */
export type RecordTarget = { type: "record"; kind: "meeting" | "document" | "deal" | "lead"; ref: string }

/** What a ref in a digest opens: a link's target, or a row with a card of its own. */
export type ReportTarget = DeepLinkTarget | RecordTarget

const RECORD_KINDS: Record<string, RecordTarget["kind"]> = {
  meeting: "meeting",
  event: "meeting",
  document: "document",
  deal: "deal",
  lead: "lead",
}

/** The target of one ref, or null for a kind nothing here opens (an invoice, a note, an organization…). */
function reportTargetOf(ref: string): ReportTarget | null {
  const linked = linkTargetOf(ref)
  if (linked) return linked
  const text = ref.trim()
  const colon = text.indexOf(":")
  const kind = colon > 0 ? RECORD_KINDS[text.slice(0, colon)] : undefined
  return kind && text.slice(colon + 1).trim() !== "" ? { type: "record", kind, ref: text } : null
}

/** One key per target, for lists and for leaving out a second ref to the same thing. */
export const keyOf = (target: ReportTarget) => (target.type === "record" ? target.ref : formatLink(target))

/** Every target an item's refs name, in their order, each once; refs nothing here opens are left out. */
export function targetsOfRefs(refs: readonly string[]): ReportTarget[] {
  const seen = new Set<string>()
  return refs.flatMap((ref) => {
    const target = reportTargetOf(ref)
    if (!target) return []
    const key = keyOf(target)
    if (seen.has(key)) return []
    seen.add(key)
    return [target]
  })
}

/** The person or project an item names, when its refs name exactly one: its `who` or `topic` then links there. */
export function entityOf(refs: readonly string[], type: "person" | "project"): ReportTarget | null {
  const found = targetsOfRefs(refs).filter((t) => t.type === type)
  return found.length === 1 ? (found[0] ?? null) : null
}

/**
 * What an item's Open opens: the first ref that opens anything, people and projects aside, since its who and topic link
 * to those.
 */
export const targetOfRefs = (refs: readonly string[]): ReportTarget | null =>
  refs.map(reportTargetOf).find((t) => t !== null && t.type !== "person" && t.type !== "project") ?? null

export type TaskGroup = {
  filter: "overdue" | "today" | "tomorrow" | "new"
  count: number
  target: DeepLinkTarget | null
}

export function taskGroups(
  tasks: { overdue: number; today: number; tomorrow: number; new: number; new_since: string | null } | null,
): TaskGroup[] {
  if (!tasks) return []
  const groups: TaskGroup[] = [
    { filter: "overdue", count: tasks.overdue, target: { type: "tasks", filter: "overdue" } },
    { filter: "today", count: tasks.today, target: { type: "tasks", filter: "today" } },
    { filter: "tomorrow", count: tasks.tomorrow, target: { type: "tasks", filter: "tomorrow" } },
    {
      filter: "new",
      count: tasks.new,
      // Read back through the grammar, so a time the link would refuse gives no link rather than a broken one.
      target: tasks.new_since ? parseLink(formatLink({ type: "tasks", filter: "new", since: tasks.new_since })) : null,
    },
  ]
  return groups.filter((g) => g.count > 0)
}

/** The sync problems worth a line: a named reason, or a day without news. */
export const staleHealth = <T extends { reason: string | null; stale_hours: number }>(health: readonly T[]) =>
  health.filter((h) => h.reason !== null || h.stale_hours > STALE_HOURS)

/** Sections in the renderer's order, parts of one kind merged, empty ones left out. */
export function orderedSections<S extends { kind: SectionKind; items: readonly unknown[]; more: number }>(
  sections: readonly S[],
): { kind: SectionKind; items: S["items"][number][]; more: number }[] {
  return SECTION_ORDER.flatMap((kind) => {
    const parts = sections.filter((s) => s.kind === kind)
    const items = parts.flatMap((s) => [...s.items])
    return items.length === 0 ? [] : [{ kind, items, more: parts.reduce((n, s) => n + s.more, 0) }]
  })
}

/** The footer's window: hours below two days or for a part of a day, else days ("24 h", "3 days"). */
export function windowOf(from: string, to: string, lang: string): string {
  const hours = Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000)
  return hours >= 48 && hours % 24 === 0
    ? new Intl.NumberFormat(lang, { style: "unit", unit: "day", unitDisplay: "long" }).format(hours / 24)
    : new Intl.NumberFormat(lang, { style: "unit", unit: "hour", unitDisplay: "short" }).format(hours)
}
