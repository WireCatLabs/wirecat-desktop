import { useEffect, useState } from "react"

/** The time now, ticking every second while `active`; it stands still otherwise. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** Milliseconds since `startedAt`, ticking every second; 0 when nothing runs. */
export function useElapsed(startedAt: number | null): number {
  const now = useNow(startedAt !== null)
  return startedAt === null ? 0 : Math.max(0, now - startedAt)
}
