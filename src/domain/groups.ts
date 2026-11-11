/** The default group: every account. Memo computes it; it is never saved and never changed. */
export const ALL = "all"
const RESERVED = [ALL, "bots"]
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export type Member = { source: string; provider: string; profiles: string[]; alsoIn: string[]; scope: string | null }
export type Group = { name: string; members: Member[]; suggested: string[] }

export type Change =
  | { kind: "add"; group: string; source: string }
  | { kind: "remove"; group: string; source: string }
  | { kind: "move"; source: string; from: string; to: string }

/** `all` first, as the place every card comes from, then the saved groups in Memo's order. */
export const columnsOf = (groups: readonly Group[]): Group[] => [
  ...groups.filter((g) => g.name === ALL),
  ...groups.filter((g) => g.name !== ALL),
]

export const editable = (group: string) => group !== ALL

/** How the page names an account: its profiles, or the source Memo gave when no tool recorded a profile. */
export const accountName = (m: Member) => m.profiles.join(", ") || m.source

/** In two saved groups at once: allowed, and shown. Being in `all` and one saved group is the usual case. */
export const isDuplicate = (group: string, m: Member) => group !== ALL && m.alsoIn.length > 0

/**
 * What dropping a card does. Out of `all` nothing ever leaves, so a drag from it puts the account in the other group
 * as a copy does. Into `all`, or into a group that already holds it, a copy changes nothing; a move there only takes
 * it out of where it was.
 */
export function changeOf(
  groups: readonly Group[],
  source: string,
  from: string,
  to: string,
  copy: boolean,
): Change | null {
  if (from === to || !editable(to)) return null
  const there = groups.find((g) => g.name === to)?.members.some((m) => m.source === source) ?? false
  if (!editable(from) || copy) return there ? null : { kind: "add", group: to, source }
  return there ? { kind: "remove", group: from, source } : { kind: "move", source, from, to }
}

/** `alsoIn` again from who is where now, as Memo computes it: the other saved groups only. */
function withAlsoIn(groups: Group[]): Group[] {
  const holding = new Map<string, string[]>()
  for (const g of groups.filter((x) => editable(x.name)))
    for (const m of g.members) holding.set(m.source, [...(holding.get(m.source) ?? []), g.name])
  return groups.map((g) => ({
    ...g,
    members: g.members.map((m) => ({ ...m, alsoIn: (holding.get(m.source) ?? []).filter((n) => n !== g.name) })),
  }))
}

/**
 * The groups as they will be once Memo makes the change: what the page shows while Memo works, and puts back if Memo
 * refuses. A new group goes before `all`, where Memo lists it.
 */
export function applyChange(groups: readonly Group[], change: Change): Group[] {
  const member = groups.flatMap((g) => g.members).find((m) => m.source === change.source)
  if (!member) return [...groups]
  const add = change.kind === "add" ? change.group : change.kind === "move" ? change.to : null
  const drop = change.kind === "remove" ? change.group : change.kind === "move" ? change.from : null
  let next = groups.map((g) => ({
    ...g,
    members: g.name === drop ? g.members.filter((m) => m.source !== change.source) : g.members,
    suggested: g.name === add ? g.suggested.filter((s) => s !== change.source) : g.suggested,
  }))
  if (add !== null) {
    if (!next.some((g) => g.name === add)) {
      const at = next.findIndex((g) => g.name === ALL)
      next.splice(at < 0 ? next.length : at, 0, { name: add, members: [], suggested: [] })
    }
    next = next.map((g) =>
      g.name === add && !g.members.some((m) => m.source === change.source)
        ? { ...g, members: [...g.members, member] }
        : g,
    )
  }
  return withAlsoIn(next)
}

export type NameProblem = "empty" | "reserved" | "chars" | "taken"

/** The words Memo takes for a group (WC-ACCT-4), checked before Memo is asked. */
export function nameProblem(name: string, taken: readonly string[]): NameProblem | null {
  const n = name.trim()
  if (!n) return "empty"
  if (RESERVED.includes(n.toLowerCase())) return "reserved"
  if (!NAME.test(n)) return "chars"
  return taken.includes(n) ? "taken" : null
}

/** The app and profile words of `tg work`: what a card shows, the app's icon from the first word. */
export function profileParts(profile: string): { app: string; name: string } {
  const at = profile.indexOf(" ")
  return at < 0 ? { app: profile, name: "" } : { app: profile.slice(0, at), name: profile.slice(at + 1) }
}
