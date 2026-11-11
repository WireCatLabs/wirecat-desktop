import { isNewer } from "./status"

/** What a page cannot work without: a tool, at least a version, and signed in where the page reads an account. */
export type Need = { anyOf: readonly string[]; minVersion?: string | null; signedIn?: boolean }

/** What stands between the page and its need, said about one tool the owner can act on. */
export type Gap =
  | { kind: "missing"; tool: string; others: readonly string[] }
  | { kind: "old"; tool: string; version: string | null; need: string | null }
  | { kind: "signedOut"; tool: string }

/**
 * What the page knows of each tool: `version` is undefined until the tools are found and null when the tool is not
 * installed; `profiles` is undefined until read and null for a tool without profiles.
 */
export type ToolFacts = (id: string) => {
  version: string | null | undefined
  profiles?: readonly string[] | null | undefined
}

/** `unknown` until every fact the need asks about is in, so a page never flashes a gap that is not there. */
export function gapOf(need: Need, facts: ToolFacts): Gap | null | "unknown" {
  const found = need.anyOf.map((id) => ({ id, ...facts(id) }))
  if (found.some((t) => t.version === undefined)) return "unknown"
  const installed = found.filter((t) => t.version !== null)
  const [first] = need.anyOf
  if (installed.length === 0) return first ? { kind: "missing", tool: first, others: need.anyOf.slice(1) } : null
  const { minVersion } = need
  const fresh = installed.filter((t) => !minVersion || !t.version || !isNewer(minVersion, t.version))
  const [stale] = installed
  if (fresh.length === 0 && stale && minVersion)
    return { kind: "old", tool: stale.id, version: stale.version ?? null, need: minVersion }
  if (!need.signedIn) return null
  if (fresh.some((t) => t.profiles === undefined)) return "unknown"
  const signed = fresh.some((t) => t.profiles === null || (t.profiles?.length ?? 0) > 0)
  const [out] = fresh
  return signed || !out ? null : { kind: "signedOut", tool: out.id }
}

/** A page's own read already says Memo is missing or too old; it is the same gap, in the same words. */
export function gapFromRead(
  read: { kind: string; version?: string | null; need?: string | null } | null | undefined,
  tool = "memo",
): Gap | null {
  if (read?.kind === "missing") return { kind: "missing", tool, others: [] }
  // A read that cannot name the version it needs still says memo is too old.
  if (read?.kind === "old") return { kind: "old", tool, version: read.version ?? null, need: read.need ?? null }
  return null
}
