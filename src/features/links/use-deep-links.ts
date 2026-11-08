import { useEffect, useRef } from "react"
import { platform } from "@/platform/bridge"
import { arrive, openWaiting } from "./open"

/** Listens for wirecat:// links; `ready` is false while the first-run setup holds the window. */
export function useDeepLinks(ready: boolean) {
  const readyNow = useRef(ready)
  readyNow.current = ready
  useEffect(() => {
    let alive = true
    void platform.listenLinks((target) => {
      if (alive) arrive(target, readyNow.current)
    })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (ready) openWaiting()
  }, [ready])
}
