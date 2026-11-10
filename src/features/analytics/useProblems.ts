import { useMemo } from "react"
import { failure, type Problem } from "./problems"
import { MESSENGERS, useAnalytics, useShownSources } from "./store"

/**
 * What keeps the messengers' own counts from the page: a profile never signed in, one that holds nothing yet, one that
 * failed, a copy too old to count. With no messenger installed, each is offered for install.
 */
export function useMessengerProblems(): Problem[] {
  const sources = useShownSources()
  const signedOut = useAnalytics((s) => s.signedOut)
  const chosen = useAnalytics((s) => s.onlyProfiles)
  return useMemo(() => {
    const out: Problem[] = []
    const none = MESSENGERS.every((x) => sources[x.id]?.state === "missing")
    for (const { id } of MESSENGERS) {
      const s = sources[id]
      if (!s) continue
      if (s.state === "missing") {
        if (none) out.push({ kind: "missing", tool: id })
        continue
      }
      for (const profile of signedOut[id] ?? [])
        if (!chosen.length || chosen.includes(profile)) out.push({ kind: "signedOut", tool: id, profile })
      if (s.state === "old") out.push({ kind: "old", tool: id, detail: s.message })
      if (s.state === "ready") for (const f of s.failed) out.push(failure(id, f.profile, f.message, f.code))
    }
    return out
  }, [sources, signedOut, chosen])
}
