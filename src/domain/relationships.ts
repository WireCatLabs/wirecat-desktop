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
