/** The People page's rules: how a person's accounts are grouped and what a split may take. */

type Seen = { account: string; scope: string | null }
type IdentityLike = { identity: string; provider: string; seenIn: Seen[] }

/** A person's accounts by source, in the order memo listed them; each source once. */
export function bySource<T extends IdentityLike>(identities: readonly T[]): { provider: string; identities: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const i of identities) groups.set(i.provider, [...(groups.get(i.provider) ?? []), i])
  return [...groups].map(([provider, list]) => ({ provider, identities: list }))
}

/** Which sides of life saw an account: personal, work, or both. A scope memo does not name is left out. */
export function scopesOf(seenIn: readonly Seen[]): ("personal" | "work")[] {
  const found = new Set(seenIn.map((s) => s.scope))
  return (["personal", "work"] as const).filter((s) => found.has(s))
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

export const matchesFilter = (person: { name: string | null; ref: string }, query: string) => {
  const q = query.trim().toLocaleLowerCase()
  return !q || (person.name ?? "").toLocaleLowerCase().includes(q) || person.ref.includes(q)
}

/** memo's refusals the page words itself. */
export const PEOPLE_REASONS = [
  "identity.stale",
  "identity.owner-only",
  "person.not-found",
  "proposal.wrong-state",
] as const
export type PeopleReason = (typeof PEOPLE_REASONS)[number]
export const reasonOf = (error: string): PeopleReason | null =>
  (PEOPLE_REASONS as readonly string[]).includes(error) ? (error as PeopleReason) : null
