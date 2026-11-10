import type { Match } from "@/platform/people-schemas"

export type MatchGroup = {
  key: string
  /** Every match of the group the page holds, decided ones included. */
  matches: Match[]
  /** The people of its open matches as memo names them now; once all are decided, the people they named. */
  people: string[]
  signal: string | null
  /** The shared mailbox all its pairs are about: a company's or a family's, never joined by itself. */
  mailbox: string | null
  /** How many people had the shared phone or address when memo found it, at least the people shown. */
  sharing: number
}

/**
 * memo proposes one match per pair of people who share a phone or an address, each naming the whole set as its
 * `candidates`. The pairs of one set are one card. `candidates` is the set as memo first saw it, so it keys the group
 * only; after a join it may name a person who is gone, and the people shown come from the pairs themselves. The pairs
 * on one shared mailbox are one card too, as memo names no `candidates` for them. memo lists the matches by score and a
 * card keeps the place of its first, so the page never sorts them again.
 */
const keyOf = (m: Match) =>
  m.shared && m.mailbox
    ? `mailbox|${m.mailbox}`
    : m.joins !== "identity" && m.candidates.length > 2
      ? `${m.signal ?? ""}|${[...m.candidates].sort().join(" ")}`
      : m.id

export function groupMatches(matches: readonly Match[], decided: Record<string, unknown>): MatchGroup[] {
  const groups = new Map<string, Match[]>()
  for (const m of matches) groups.set(keyOf(m), [...(groups.get(keyOf(m)) ?? []), m])
  return [...groups].map(([key, list]) => {
    const open = list.filter((m) => !decided[m.id])
    const people = [...new Set((open.length ? open : list).flatMap((m) => m.persons))]
    const first = list[0] as Match
    return {
      key,
      matches: list,
      people,
      signal: first.signal,
      mailbox: first.shared ? first.mailbox : null,
      sharing: Math.max(first.candidates.length, people.length),
    }
  })
}
