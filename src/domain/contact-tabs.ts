/** How memo names a bot from cli-core 2.0 on; a memo before it says `sender-bot:<id>`, and Desktop runs either. */
const SENDER_BOT_PREFIXES = ["bot:", "sender-bot:"]

export const isSenderBot = (ref: string | null | undefined) =>
  SENDER_BOT_PREFIXES.some((prefix) => ref?.startsWith(prefix) === true)

/** Contacts' tabs: each sender is on one of them (owner, 2026-11-25). */
export const CONTACT_TABS = ["people", "bots", "organizations"] as const
export type ContactTab = (typeof CONTACT_TABS)[number]

/** What the table lists: one of memo's kinds of people, or the bots `bots list` gives apart from them. */
export type ListKind = "person" | "organization" | "automated" | "stranger" | "unsorted" | "bot"

/** The People tab's filters, each one of memo's kinds; `automated` only once bots are apart from people. */
export const peopleFilters = (senderBots: boolean): ListKind[] =>
  senderBots ? ["person", "stranger", "automated", "unsorted"] : ["person", "stranger", "unsorted"]

/** A memo without `bots list` still marks bots as people of kind `automated`: its Bots tab lists those. */
export const kindOfTab = (tab: ContactTab, senderBots: boolean): ListKind =>
  tab === "people" ? "person" : tab === "organizations" ? "organization" : senderBots ? "bot" : "automated"

export function tabOf(kind: ListKind, senderBots: boolean): ContactTab {
  if (kind === "organization") return "organizations"
  if (kind === "bot" || (kind === "automated" && !senderBots)) return "bots"
  return "people"
}

type Count = { value: number; more: boolean }

/** A tab's count: its kinds together, `incomplete` left out as it is off by default. */
export function tabCount(tab: ContactTab, counts: Partial<Record<ListKind, Count>>, senderBots: boolean): Count | null {
  const kinds: ListKind[] =
    tab === "people" ? peopleFilters(senderBots).filter((k) => k !== "unsorted") : [kindOfTab(tab, senderBots)]
  const known = kinds.flatMap((k) => (counts[k] ? [counts[k]] : []))
  if (known.length === 0) return null
  return { value: known.reduce((n, c) => n + c.value, 0), more: known.some((c) => c.more) }
}
