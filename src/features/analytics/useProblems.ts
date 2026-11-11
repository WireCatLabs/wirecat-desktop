import { useMemo } from "react"
import { failure, holdsNothing, type Problem } from "./problems"
import { MESSENGERS, useAnalytics, useShownSources } from "./store"

/**
 * What keeps the messengers' own counts from the page: no profile signed in, one that failed, a copy too old to count.
 * A profile that holds nothing, or a never-used one beside a working one, is no problem. With no messenger installed,
 * each is offered for install.
 */
export function useMessengerProblems(): Problem[] {
  const sources = useShownSources()
  const signedOut = useAnalytics((s) => s.signedOut)
  const profilesOf = useAnalytics((s) => s.profilesOf)
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
      if (!profilesOf[id]?.length)
        for (const profile of signedOut[id] ?? [])
          if (!chosen.length || chosen.includes(profile)) out.push({ kind: "signedOut", tool: id, profile })
      if (s.state === "old") out.push({ kind: "old", tool: id, detail: s.message })
      if (s.state === "ready")
        for (const f of s.failed) if (!holdsNothing(f.code)) out.push(failure(id, f.profile, f.message))
    }
    return out
  }, [sources, signedOut, profilesOf, chosen])
}
