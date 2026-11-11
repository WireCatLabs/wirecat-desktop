import { useEffect } from "react"
import { ALL, type Member } from "@/domain/groups"
import { useGroups } from "./store"

/** The Memo account behind a tool's profile, when Memo can say whether it is personal or work. */
export function useAccountScope(bin: string, profile: string): Member | null {
  const read = useGroups((s) => s.read)
  useEffect(() => {
    void useGroups.getState().ensure()
  }, [])
  if (read?.kind !== "ready") return null
  const every = read.groups.find((g) => g.name === ALL)?.members ?? []
  const member = every.find((x) => x.profiles.includes(`${bin} ${profile}`))
  return member && member.scope !== null ? member : null
}
