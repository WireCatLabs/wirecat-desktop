/**
 * How each relationship stands (CRM relations plan §2.4), as memo derives it: the owner wrote or confirmed it, a
 * source such as a CRM says so, an agent proposed it, or it no longer holds.
 */
export const STANDINGS = ["proposed", "confirmed", "reported", "ended"] as const
export type Standing = (typeof STANDINGS)[number]

export const standingOf = (s: string | null | undefined): Standing | null =>
  STANDINGS.includes(s as Standing) ? (s as Standing) : null

/** Waiting for the owner warns; the owner's own stands out; what a source reports or what ended stays quiet. */
export const standingTone = (s: Standing): "warn" | "brand" | "neutral" =>
  s === "proposed" ? "warn" : s === "confirmed" ? "brand" : "neutral"

export type OwnerRole = { list: string; id: string; label: string | null; builtIn: boolean }

/**
 * A role in the reader's language: a built-in one the app has words for, the owner's own by the label the owner gave
 * it, anything else by its id. Built-in ids are memo's (`decision-maker`), so a newer memo's role still reads.
 */
export function roleLabel(role: string, roles: readonly OwnerRole[], words: Readonly<Record<string, string>>): string {
  const own = roles.find((r) => r.id === role && !r.builtIn)?.label
  return own ?? words[role] ?? role.replaceAll("-", " ")
}

type RelationLike = {
  kind: string
  subject: string | null
  subjectName: string | null
  target: string | null
  targetName: string | null
  role?: string | null | undefined
}

export type RelationEnd = { ref: string | null; name: string; kind: string }

const endOf = (ref: string | null, name: string | null): RelationEnd => ({
  ref,
  name: name ?? ref ?? "",
  kind: ref?.slice(0, Math.max(0, ref.indexOf(":"))) ?? "",
})

/**
 * A relationship as a sentence needs to know whose role it is. A role always describes the person: a member's part in
 * an organization, a person's part in a deal, and a source's "owner" of a document (Drive writes the document first).
 */
export function relationParts(e: RelationLike) {
  const from = endOf(e.subject, e.subjectName)
  const to = endOf(e.target, e.targetName)
  const holderIsTo = to.kind === "person" && from.kind !== "person"
  return {
    kind: e.kind,
    role: e.role ?? null,
    from,
    to,
    holder: holderIsTo ? to : from,
    other: holderIsTo ? from : to,
  }
}

export type RelationParts = ReturnType<typeof relationParts>

/** The role lists memo offers for a relationship, by the end that is not the person; free text elsewhere. */
export function roleListFor(p: RelationParts): "organization" | "project" | "deal" | "contract" | null {
  const k = p.other.kind
  return k === "organization" || k === "project" || k === "deal" || k === "contract" ? k : null
}
