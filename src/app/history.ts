import { type RefObject, useEffect, useLayoutEffect, useRef } from "react"
import { useNav } from "@/features/nav"
import { platform } from "@/platform/bridge"
import { arrive } from "@/ui/motion"

const BACK = 3
const FORWARD = 4

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

const dialogOpen = () => document.querySelector("dialog[open]") !== null

const scrolled = new Map<string, number>()

/**
 * A new section arrives with a short rise instead of a cut, and each section keeps where the owner left it: back on
 * Tools, the list is where it was; a section not seen yet opens at its top. One scroller serves every page, so
 * without this a page would open at the last page's offset.
 */
export function useSectionSwitch(scroller: RefObject<HTMLElement | null>, active: string | null) {
  const shown = useRef(active)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || active === null) return
    const save = () => scrolled.set(active, el.scrollTop)
    el.addEventListener("scroll", save, { passive: true })
    return () => el.removeEventListener("scroll", save)
  }, [scroller, active])
  useLayoutEffect(() => {
    const el = scroller.current
    if (shown.current === active) return
    shown.current = active
    // null while the setup holds the window; leaving it brings the page back like any other switch.
    if (!el || active === null) return
    const top = scrolled.get(active) ?? 0
    el.scrollTop = top
    for (const page of el.children) arrive(page)
    if (top === 0) return
    // Rows that load a frame later make the page short at first, which clamps the offset; set it again once they are in.
    const frame = requestAnimationFrame(() => {
      el.scrollTop = top
    })
    return () => cancelAnimationFrame(frame)
  }, [scroller, active])
}

/** The mouse's back and forward buttons, Alt+Left/Right, and Cmd+[ / Cmd+] on macOS step through visited sections. */
export function useSectionHistory(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const step = (dir: "back" | "forward") => {
      if (dialogOpen()) return
      const nav = useNav.getState()
      if (dir === "back") nav.back()
      else nav.forward()
    }
    // The browser and some webviews act on mousedown or mouseup; stopping both keeps them from leaving the page.
    const swallow = (e: MouseEvent) => {
      if (e.button === BACK || e.button === FORWARD) e.preventDefault()
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== BACK && e.button !== FORWARD) return
      e.preventDefault()
      step(e.button === BACK ? "back" : "forward")
    }
    const mac = platform.os === "macos"
    const onKey = (e: KeyboardEvent) => {
      if (editable(e.target)) return
      const alt = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      const cmd = mac && e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey
      const dir =
        (alt && e.key === "ArrowLeft") || (cmd && e.key === "[")
          ? "back"
          : (alt && e.key === "ArrowRight") || (cmd && e.key === "]")
            ? "forward"
            : null
      if (!dir) return
      e.preventDefault()
      step(dir)
    }
    window.addEventListener("mousedown", swallow)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", swallow)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("keydown", onKey)
    }
  }, [enabled])
}
