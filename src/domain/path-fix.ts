import type { Problem } from "./fix-prompt"

/** The parts of Rust's `PathFix` these rules read. */
export type PathFix = {
  unreachable: readonly string[]
  file: string | null
  manual: string | null
  shells: readonly {
    name: string
    program: string | null
    files: readonly string[]
    finds: boolean | null
    primary: boolean
  }[]
}

/**
 * What the owner sees after Fix wrote the PATH line: nothing left to do, a question about which shell their terminal
 * runs (asked once, never on Windows, where the PATH lives in the registry), or the line to add by hand.
 * `picked` is the shell the owner chose, or "hand" when they skipped the question.
 */
export type PathFixPhase = "reached" | "pick" | "hand"

export function pathFixPhase(fix: PathFix, picked: string | null, windows: boolean): PathFixPhase {
  if (fix.unreachable.length === 0) return "reached"
  if (windows || picked !== null) return "hand"
  return "pick"
}

/** The shells to offer: every listed one but plain `sh`, which no terminal app starts by default. */
export function shellOptions(listed: readonly string[]): string[] {
  const named = listed.filter((p) => !/\/sh$/.test(p))
  return named.length ? named : [...listed]
}

export const shellName = (program: string) => program.split("/").pop() ?? program

/** The prompt for an agent: which files hold the block, which shells find the tools, and the line. */
export function pathFixProblem(fix: PathFix, bins: readonly string[]): Problem {
  const shells = fix.shells.map((s) => {
    const finds = s.finds === null ? "did not answer" : s.finds ? "finds them" : "does not find them"
    const role = s.primary ? ", the terminal's shell" : ""
    return `${s.program ?? s.name}${role}: ${s.files.join(", ") || "no file"}; a new terminal ${finds}`
  })
  const error = [
    `A new terminal still does not find: ${bins.join(", ")}.`,
    ...(fix.shells.length
      ? [
          'WireCat added a marked block ("# Added by WireCat Desktop: ...") that puts the folders in front of PATH, in:',
          ...shells.map((s) => `- ${s}`),
        ]
      : []),
  ].join("\n")
  return {
    what: "Putting the folders of WireCat tools on the PATH of new terminals",
    error,
    hint: fix.manual ? `Add this line${fix.file ? ` to ${fix.file}` : ""}: ${fix.manual}` : null,
  }
}
