import { knownReason } from "./reasons"

/** The Contacts page's rules: how a person's accounts are grouped and what a split may take. */

type Seen = { account: string; scope: string | null }
type IdentityLike = { identity: string; provider: string; seenIn: Seen[] }

/** A person's accounts by source, in the order memo listed them; each source once. */
export function bySource<T extends IdentityLike>(identities: readonly T[]): { provider: string; identities: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const i of identities) groups.set(i.provider, [...(groups.get(i.provider) ?? []), i])
  return [...groups].map(([provider, list]) => ({ provider, identities: list }))
}

/**
 * A bot account: the source says so, or it is a Telegram username ending in "bot", which Telegram requires of every
 * bot (core.telegram.org/bots/features#botfather) and of no person.
 */
const isBotAccount = (i: { provider: string; bot: boolean; username: string | null }) =>
  i.bot || (i.provider === "telegram" && /bot$/i.test(i.username?.trim() ?? ""))

/** A person is a bot only when every account of theirs is one: a person may also run a bot. */
export const allBots = (identities: readonly { provider: string; bot: boolean; username: string | null }[]) =>
  identities.length > 0 && identities.every(isBotAccount)

/**
 * Whether a work account saw this one. Only work is marked: memo files every new account as personal and has no command
 * to change it, so a «personal» mark sat on every account and read as "this address is private".
 */
export const seenAtWork = (seenIn: readonly Seen[]) => seenIn.some((s) => s.scope === "work")

/**
 * The owner's profiles an account was seen in, by the account groups' members: memo's `seen_in` names the owner's
 * account by its bare id, the groups by `<provider>:<id>` with the profiles that use it (`tg work`). The profile word
 * is enough under the account's own source; another source's keeps its tool (`zm work`). An account no app named a
 * profile for is shown by its id.
 */
export function profilesOf(
  identity: { provider: string; seenIn: readonly Seen[] },
  members: readonly { source: string; provider: string; profiles: readonly string[] }[],
): string[] {
  const names = identity.seenIn.flatMap((s) => {
    const same = members.filter((m) => m.source.slice(m.source.indexOf(":") + 1) === s.account)
    const member = same.find((m) => m.provider === identity.provider) ?? (same.length === 1 ? same[0] : undefined)
    if (!member) return []
    if (member.profiles.length === 0) return [s.account]
    const own = member.provider === identity.provider
    return member.profiles.map((p) => (own && p.includes(" ") ? p.slice(p.indexOf(" ") + 1) : p))
  })
  return [...new Set(names)]
}

/**
 * A split moves some of a person's accounts to a new person; moving all of them would only rename the person, and an
 * account memo cannot be handed back safely is never moved.
 */
export const canSplit = (chosen: readonly string[], all: readonly (IdentityLike & { movable: boolean })[]) =>
  chosen.length > 0 && chosen.length < all.length && chosen.every((c) => all.some((i) => i.identity === c && i.movable))

/** The person's name as the list read it; `null` when memo knows no name, or the list does not hold them. */
export const nameOf = (people: readonly { ref: string; name: string | null }[], ref: string) =>
  people.find((p) => p.ref === ref)?.name ?? null

/** A search that names an account rather than a person: `telegram:4411`, `@kai_m` with a messenger, or an address. */
export const looksLikeAccount = (query: string) => /^[a-z][a-z0-9-]*:\S+$|^\S+@\S+\.\S+$/.test(query.trim())

/** Every person a write touched: their cached details are read again. */
export const touched = (...refs: (string | null | undefined)[]) => [...new Set(refs.filter((r): r is string => !!r))]

const QUOTES = "\"'`«»“”„‘’"

/** Words a source writes for a missing name, and a bare `#123` id: never a name. memo's display_name can hold them. */
const PLACEHOLDER = /(^|\s)(null|undefined|Без имени|Deleted Account|#\d+)(?=\s|$)/giu

/**
 * memo keeps a name as the first source typed it (`"CZECH AIRLINES "`, `!`). Until cli-core cleans names itself, the
 * page trims them, drops quotes that wrap the whole name and gives `null` for a name with no letter in it.
 */
export function cleanName(name: string | null | undefined): string | null {
  let s = (name ?? "").replace(PLACEHOLDER, " ").replace(/\s+/g, " ").trim()
  while (s.length > 1 && QUOTES.includes(s[0] ?? "") && QUOTES.includes(s.at(-1) ?? "")) s = s.slice(1, -1).trim()
  return /\p{L}/u.test(s) ? s : null
}

/** For a value that is already memo's display_name, which falls back to a phone number: that number stays. */
export const nameOrNumber = (name: string | null | undefined) =>
  cleanName(name) ?? (/^\+?[\d\s()-]*\d[\d\s()-]*$/.test(name ?? "") ? (name ?? "").trim() : null)

/**
 * The one way the app names a person from a list row: memo's display_name, else a cleaned name, else their phone,
 * address or handle. `null` when there is none, so the caller picks its own word; never «null #97365».
 */
export function personName(p: {
  displayName?: string | null | undefined
  name?: string | null | undefined
  contact?: string | null | undefined
}) {
  return cleanName(p.displayName) ?? cleanName(p.name) ?? (p.contact?.trim() || null)
}

const letters = (s: string) => s.match(/\p{L}/gu)?.length ?? 0
/** A name of one or two letters, such as «Вр»: the person's accounts may know them better. */
export const isFragment = (name: string | null | undefined) => {
  const clean = cleanName(name)
  return clean !== null && letters(clean) <= 2
}
const wordsOf = (s: string) =>
  s
    .toLocaleLowerCase()
    .split(/[\s.,]+/)
    .filter(Boolean)

/**
 * The fullest of a person's name and their accounts' names. A fragment of one or two letters («Вр») gives way to the
 * longest account name, and a name gives way to an account name that holds all its words and more («Ярослав» to
 * «Ярослав Орлов»). Any other name is kept: accounts of one person may carry someone else's name.
 */
export function fullerName(name: string | null, accountNames: readonly (string | null | undefined)[]): string | null {
  const names = accountNames.map(cleanName).filter((n): n is string => n !== null && letters(n) > 2)
  if (!name || letters(name) <= 2)
    return names.reduce<string | null>((best, n) => (!best || letters(n) > letters(best) ? n : best), null) ?? name
  const own = wordsOf(name)
  const longer = names.filter((n) => {
    const words = wordsOf(n)
    return words.length > own.length && own.every((w) => words.includes(w))
  })
  return longer.reduce((best, n) => (letters(n) > letters(best) ? n : best), name)
}

/** For a person with no usable name: the first account name that has letters, else their first handle. */
export function handleOf(identities: readonly { name: string | null; username: string | null }[]): string | null {
  for (const i of identities) {
    const name = cleanName(i.name)
    if (name) return name
  }
  const username = identities.find((i) => i.username?.trim())?.username?.trim()
  return username ? `@${username.replace(/^@/, "")}` : null
}

export const matchesFilter = (
  person: { name: string | null; ref: string; displayName?: string | null; contact?: string | null },
  query: string,
) => {
  const q = query.trim().toLocaleLowerCase()
  const words = [cleanName(person.name), person.displayName, person.contact].filter(Boolean).join(" ")
  return !q || words.toLocaleLowerCase().includes(q) || person.ref.includes(q)
}

/** A WhatsApp id is a phone only as `<digits>@s.whatsapp.net` or `@c.us`, or bare digits; `@lid` is no number. */
export const WHATSAPP_PHONE = /^(\d{7,15})(?:@s\.whatsapp\.net|@c\.us)?$/

/**
 * The contact an older memo does not give, from the person's accounts: a phone, else an email, else a handle. A person
 * whose only account has none of these, such as a WhatsApp `@lid`, still gets its source, with no value.
 */
export function contactOf(
  identities: readonly { identity: string; provider: string; username: string | null }[],
): { provider: string; value: string | null } | null {
  const id = (i: { identity: string }) => i.identity.slice(i.identity.indexOf(":") + 1)
  const number = (i: { identity: string; provider: string }) =>
    i.provider === "phone"
      ? id(i).replace(/^\+/, "")
      : i.provider === "whatsapp"
        ? WHATSAPP_PHONE.exec(id(i))?.[1]
        : null
  const phone = identities.find((i) => number(i))
  if (phone) return { provider: phone.provider, value: `+${number(phone)}` }
  const email = identities.find((i) => i.provider === "email")
  if (email) return { provider: email.provider, value: id(email) }
  const handle = identities.find((i) => i.username?.trim())
  if (handle) return { provider: handle.provider, value: `@${handle.username?.trim().replace(/^@/, "")}` }
  const first = identities[0]
  return first ? { provider: first.provider, value: null } : null
}

/**
 * One account in words: its name when it has a letter (MAX gives «.» for some), else its handle, phone or address.
 * `null` when none of these is known, so the caller shows the account id or its own word.
 */
export function accountLabel(i: {
  name: string | null
  username?: string | null
  phone?: string | null
  email?: string | null
}): string | null {
  const handle = i.username?.trim().replace(/^@/, "")
  return cleanName(i.name) ?? (handle ? `@${handle}` : null) ?? (i.phone?.trim() || null) ?? (i.email?.trim() || null)
}

/**
 * What narrows the People table. Memo's coming "real people" read adds its own switch here, beside these, and the
 * hidden count the page shows with it.
 */
export type PeopleFilter = { query: string; withTasks: boolean; named: boolean }

export const filterPeople = <T extends { name: string | null; ref: string; tasks: number; owner: boolean }>(
  people: readonly T[],
  { query, withTasks, named }: PeopleFilter,
) =>
  people.filter(
    (p) => matchesFilter(p, query) && (!withTasks || p.tasks > 0) && (!named || p.owner || cleanName(p.name) !== null),
  )

/** memo's refusals the page words itself. */
export const PEOPLE_REASONS = [
  "identity.stale",
  "identity.owner-only",
  "person.not-found",
  "proposal.wrong-state",
  "person.unknown",
  "person.no-doubt",
  "person.test-data",
  "person.owner",
  "memo.too-old",
] as const
export type PeopleReason = (typeof PEOPLE_REASONS)[number]
export const reasonOf = (error: string) => knownReason(PEOPLE_REASONS, error)
