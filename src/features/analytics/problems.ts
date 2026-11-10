/**
 * Why a card has no numbers from a tool or one of its profiles, in the terms its button acts on: install the tool,
 * update it, sign the profile in, load what it has, or (a failure the page cannot fix) say so and keep the tool's own
 * words for "Details".
 */
export type Problem =
  | { kind: "missing"; tool: string }
  | { kind: "old"; tool: string; detail: string }
  | { kind: "signedOut"; tool: string; profile: string }
  | { kind: "empty"; tool: string; profile: string; detail: string }
  | { kind: "failed"; tool: string; profile: string | null; detail: string; command?: string }

/**
 * A profile that answered `not_found` is signed in but holds nothing yet: the page always reads with `--offline`, so
 * the tool's advice to run without it is not one the owner can follow from here.
 */
export function failure(
  tool: string,
  profile: string | null,
  message: string,
  code?: string | null,
  command?: string,
): Problem {
  if (code === "not_found" && profile !== null) return { kind: "empty", tool, profile, detail: message }
  return { kind: "failed", tool, profile, detail: message, ...(command ? { command } : {}) }
}

export const problemKey = (p: Problem) => `${p.kind}:${p.tool}:${"profile" in p ? (p.profile ?? "") : ""}`

/** One line per tool and profile, whichever card noticed it first. */
export const uniqueProblems = (list: readonly Problem[]) => [...new Map(list.map((p) => [problemKey(p), p])).values()]

export const MEMO_MISSING: readonly Problem[] = [{ kind: "missing", tool: "memo" }]
