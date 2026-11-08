/** What a command asks for with the service and on this computer, as Rust reports it (`OwnCommand`). */
export type OwnLevel = "none" | "read" | "write"
export type OwnCommand = {
  words: string
  remote: OwnLevel
  local: OwnLevel
  summary: string | null
  entity: string | null
}

/** cli-base's standard command roots: every WireCat tool has them, so they are one plain line each, not data access. */
export const STANDARD_ROOTS = [
  "session",
  "doctor",
  "skill",
  "mcp",
  "config",
  "runs",
  "upgrade",
  "commands",
  "store",
  "profile",
  "help",
  "completion",
] as const
export type StandardRoot = (typeof STANDARD_ROOTS)[number]

/** One kind of data the tool says it touches: an entity (`contact`) or, in an older manifest, a command's first word. */
export type AccessGroup = {
  key: string
  /** The entity's fields the manifest names; empty when it names none. */
  fields: string[]
  /** The most each command of the group asks for, with the service and on this computer. */
  remote: OwnLevel
  local: OwnLevel
  summaries: string[]
  commands: OwnCommand[]
}

export type Access = {
  groups: AccessGroup[]
  /** The standard roots the tool has, in `STANDARD_ROOTS` order, with their commands. */
  standard: { root: StandardRoot; commands: OwnCommand[] }[]
  sync: OwnCommand[]
}

const RANK: Record<OwnLevel, number> = { none: 0, read: 1, write: 2 }
const most = (a: OwnLevel, b: OwnLevel): OwnLevel => (RANK[a] >= RANK[b] ? a : b)
const isStandard = (root: string): root is StandardRoot => (STANDARD_ROOTS as readonly string[]).includes(root)

export function groupAccess(commands: readonly OwnCommand[], entities: Record<string, string[]>): Access {
  const groups = new Map<string, AccessGroup>()
  const standard = new Map<StandardRoot, OwnCommand[]>()
  const sync: OwnCommand[] = []
  for (const c of commands) {
    const root = c.words.split(" ")[0] ?? c.words
    if (root === "sync") {
      sync.push(c)
      continue
    }
    if (isStandard(root)) {
      standard.set(root, [...(standard.get(root) ?? []), c])
      continue
    }
    const key = c.entity ?? root
    const g = groups.get(key) ?? {
      key,
      fields: entities[key] ?? [],
      remote: "none",
      local: "none",
      summaries: [],
      commands: [],
    }
    groups.set(key, {
      ...g,
      remote: most(g.remote, c.remote),
      local: most(g.local, c.local),
      summaries: c.summary && !g.summaries.includes(c.summary) ? [...g.summaries, c.summary] : g.summaries,
      commands: [...g.commands, c],
    })
  }
  return {
    groups: [...groups.values()],
    standard: STANDARD_ROOTS.flatMap((root) => {
      const list = standard.get(root)
      return list ? [{ root, commands: list }] : []
    }),
    sync,
  }
}

/** `contact` → `Contact`, `deal_stage` → `Deal stage`: the tool's own word, readable. */
export const entityLabel = (key: string) => {
  const words = key.replaceAll("_", " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
