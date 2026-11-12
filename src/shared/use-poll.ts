import { useEffect, useRef } from "react"

/**
 * Runs `run` every `ms` while `active`. Each run starts a tool, so a tick is skipped while the window is hidden, and the
 * next is counted from the end of the last: a slow run is never joined by a second one.
 */
export function usePoll(run: () => Promise<unknown>, ms: number, active: boolean) {
  const latest = useRef(run)
  latest.current = run
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const tick = async () => {
      if (document.visibilityState === "visible") await latest.current().catch(() => undefined)
      if (!stopped) timer = setTimeout(tick, ms)
    }
    timer = setTimeout(tick, ms)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [active, ms])
}
