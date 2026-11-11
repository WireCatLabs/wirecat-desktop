/**
 * Why a card has no numbers from a tool or one of its profiles, in the terms its button acts on: install the tool,
 * update it, sign the profile in, or (a failure the page cannot fix) say so and keep the tool's own words for "Details".
 */
export type Problem =
  | { kind: "missing"; tool: string }
  | { kind: "old"; tool: string; detail: string }
  | { kind: "signedOut"; tool: string; profile: string }
  | { kind: "failed"; tool: string; profile: string | null; detail: string; command?: string }

export function failure(tool: string, profile: string | null, message: string, command?: string): Problem {
  return { kind: "failed", tool, profile, detail: message, ...(command ? { command } : {}) }
}

/** A profile that answered `not_found` holds nothing yet: an empty or test account, not worth a line on this page. */
export const holdsNothing = (code: string | null | undefined) => code === "not_found"

export const problemKey = (p: Problem) => `${p.kind}:${p.tool}:${"profile" in p ? (p.profile ?? "") : ""}`

/** One line per tool and profile, whichever card noticed it first. */
export const uniqueProblems = (list: readonly Problem[]) => [...new Map(list.map((p) => [problemKey(p), p])).values()]

export const MEMO_MISSING: readonly Problem[] = [{ kind: "missing", tool: "memo" }]
