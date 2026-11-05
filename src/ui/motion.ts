import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"

/**
 * Rule 9's one set of durations, in ms. `index.css` carries the same values as `--motion-*`, so CSS and code agree
 * (`motion.test.tsx` checks). Exits are shorter than arrivals: leaving should never hold the eye. Doubled on
 * 2026-11-05: in the real app the owner found steps, screens and dialogs changing too fast to follow.
 */
export const MOTION = {
  /** Hover, press, a label that changes. */
  fast: 150,
  /** Something leaving: a dialog closing, the old screen fading out under the new one. */
  exit: 200,
  /** One view replacing another, a page arriving, a dialog opening. */
  normal: 280,
  /** A panel opening or closing, a height following its content. */
  slow: 300,
  /** A whole view trading places with another in a dialog (one sign-in method for the other). */
  swap: 450,
  /** A setup step arriving: a longer travel than a page, since the whole step is new. */
  step: 560,
  /** A progress bar moving to its new value. */
  progress: 600,
  /** The least time a finished state stays on screen before the next one replaces it. Pacing, not animation. */
  hold: 1200,
} as const

export const PANEL_MS = MOTION.slow

export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

export function scrollerOf(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === "auto" || overflowY === "scroll") return node
  }
  return null
}

/** Scrolls only when `el` is out of sight: as little as needed, or to the top for a section the owner was sent to. */
export function revealIfHidden(el: Element | null, block: ScrollLogicalPosition = "nearest") {
  if (!el) return
  const box = el.getBoundingClientRect()
  const view = scrollerOf(el)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
  if (box.top >= view.top && box.bottom <= view.bottom) return
  el.scrollIntoView?.({ block, behavior: reducedMotion() ? "auto" : "smooth" })
}

/** Focus for keyboard and screen readers that never moves the page by itself: `focus()` alone scrolls. */
export function focusInPlace(el: HTMLElement | null, block: ScrollLogicalPosition = "nearest") {
  if (!el) return
  el.focus({ preventScroll: true })
  revealIfHidden(el, block)
}

/**
 * Keeps `el` where it is on screen while panels around it open and close. A panel closing above it would pull it up;
 * one closing below it would shrink the page and clamp the scroll, which reads as "jumped to the top". The page keeps
 * the room it had until the reader scrolls back up into it, so neither happens.
 */
export function holdInPlace(el: HTMLElement, ms = PANEL_MS + 100) {
  const scroller = keepRoom(el)
  if (!scroller) return
  const top = el.getBoundingClientRect().top
  const end = performance.now() + ms
  const tick = () => {
    if (!el.isConnected) return
    const drift = el.getBoundingClientRect().top - top
    if (Math.abs(drift) >= 1) scroller.scrollTop += drift
    if (performance.now() < end) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** Lets content inside `el`'s page shrink without the page scrolling: the room stays until the reader scrolls up. */
export function keepRoom(el: Element): HTMLElement | null {
  const scroller = scrollerOf(el)
  const page = scroller?.firstElementChild
  if (!scroller || !(page instanceof HTMLElement)) return null
  // At the top there is no scroll to clamp; the room would only hold a dialog at its old height until a scroll.
  if (scroller.scrollTop <= 0) return scroller
  reserve(scroller, page, scroller.scrollTop + scroller.clientHeight)
  return scroller
}

const reserved = new WeakMap<HTMLElement, () => void>()

function reserve(scroller: HTMLElement, page: HTMLElement, height: number) {
  reserved.get(scroller)?.()
  page.style.minHeight = `${height}px`
  const shrink = () => {
    const need = scroller.scrollTop + scroller.clientHeight
    if (scroller.scrollTop <= 0 || !page.isConnected) return release()
    if (need < Number.parseFloat(page.style.minHeight)) page.style.minHeight = `${need}px`
  }
  const release = () => {
    page.style.minHeight = ""
    scroller.removeEventListener("scroll", shrink)
    reserved.delete(scroller)
  }
  scroller.addEventListener("scroll", shrink, { passive: true })
  reserved.set(scroller, release)
}

/**
 * Plays an arrival on an element that just replaced another (a section's page): a fade with a short rise. Through the
 * Web Animations API, so it needs no wrapper around the page and leaves no class behind. Nothing under reduced motion.
 */
export function arrive(el: Element, rise = "0.4rem", ms: number = MOTION.normal) {
  if (reducedMotion() || typeof el.animate !== "function") return
  el.animate(
    [
      { opacity: 0, transform: `translateY(${rise})` },
      { opacity: 1, transform: "none" },
    ],
    {
      duration: ms,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  )
}

/**
 * Leaves a still copy of what a switch just took away, fading out over what replaced it, so a screen never cuts to the
 * next. The copy is a clone, out of the flow, inert and clipped to `box` (in `host`'s coordinates, `host` positioned);
 * nothing of React's stays alive. `shift` is how far the old content was scrolled when it left. Nothing under reduced
 * motion.
 */
export function leaveBehind(
  gone: readonly Element[],
  host: HTMLElement,
  box: { top: number; left: number; width: number; height: number },
  shift = 0,
) {
  if (gone.length === 0 || reducedMotion() || typeof host.animate !== "function") return
  const ghost = document.createElement("div")
  ghost.dataset.leaving = ""
  ghost.setAttribute("aria-hidden", "true")
  ghost.inert = true
  Object.assign(ghost.style, {
    position: "absolute",
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${Math.max(0, box.height)}px`,
    overflow: "hidden",
    pointerEvents: "none",
  })
  const inner = document.createElement("div")
  inner.style.transform = `translateY(${-shift}px)`
  for (const el of gone) inner.append(el.cloneNode(true))
  ghost.append(inner)
  host.append(ghost)
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: MOTION.exit,
    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    fill: "forwards",
  })
  fade.onfinish = () => ghost.remove()
  fade.oncancel = () => ghost.remove()
}

/**
 * The children `host` had before its last change. React has already removed them when a layout effect runs, so an
 * observer keeps the list; its callback runs after the effect, so the effect still sees the old children.
 */
export function useLastChildren(host: RefObject<HTMLElement | null>): RefObject<Element[]> {
  const last = useRef<Element[]>([])
  const watching = useRef<{ el: HTMLElement; observer: MutationObserver } | null>(null)
  useLayoutEffect(() => {
    const el = host.current
    if (watching.current?.el === el) return
    watching.current?.observer.disconnect()
    watching.current = null
    if (!el || typeof MutationObserver === "undefined") return
    const keep = () => {
      last.current = [...el.children].filter((c) => !(c instanceof HTMLElement && c.dataset.leaving !== undefined))
    }
    keep()
    const observer = new MutationObserver(keep)
    observer.observe(el, { childList: true })
    watching.current = { el, observer }
  })
  useEffect(() => () => watching.current?.observer.disconnect(), [])
  return last
}

/** One change at a time: the first entry that differs from `target` takes its new value, the rest wait their turn. */
export function paceStep<T>(shown: readonly T[], target: readonly T[]): readonly T[] {
  if (shown.length !== target.length) return target
  const i = shown.findIndex((v, k) => v !== target[k])
  if (i < 0) return shown
  return shown.map((v, k) => (k === i ? (target[k] as T) : v))
}

/**
 * The states of a list of rows as the eye can follow them: one row changes at a time, and each change stays at least
 * `ms` before the next is shown. Only the picture waits; the work behind it is never delayed. A tool that installs in
 * a second still shows "Installed" before the next row starts.
 */
export function usePaced(target: readonly string[], ms: number = MOTION.hold): readonly string[] {
  const key = JSON.stringify(target)
  const [shown, setShown] = useState<readonly string[]>(target)
  const changedAt = useRef(Number.NEGATIVE_INFINITY)
  useLayoutEffect(() => {
    const goal = JSON.parse(key) as string[]
    if (JSON.stringify(shown) === key) return
    const step = () => {
      changedAt.current = Date.now()
      setShown((s) => paceStep(s, goal))
    }
    const wait = changedAt.current + ms - Date.now()
    if (wait <= 0) return step()
    const t = setTimeout(step, wait)
    return () => clearTimeout(t)
  }, [key, shown, ms])
  return shown
}

/**
 * `on`, kept true for `ms` after it turns false: a finished state that stays in sight long enough to read (an install's
 * full green bar) before it folds away. Pacing, so it holds under reduced motion too.
 */
export function useLinger(on: boolean, ms: number = MOTION.hold): boolean {
  const [lingering, setLingering] = useState(false)
  const was = useRef(on)
  if (was.current !== on) {
    was.current = on
    if (!on) setLingering(true)
    else if (lingering) setLingering(false)
  }
  useEffect(() => {
    if (!lingering) return
    const t = setTimeout(() => setLingering(false), ms)
    return () => clearTimeout(t)
  }, [lingering, ms])
  return on || lingering
}

/**
 * How far through a step that reports no count, from the time it has taken: quick at first, then ever slower, never
 * past 90%. Only for a part between two real signals (a step that began, a step that ended), so the bar keeps moving
 * without claiming the step is done; the real end moves it the rest of the way.
 */
export const creep = (elapsedMs: number, typicalMs: number) => 0.9 * (1 - Math.exp(-Math.max(0, elapsedMs) / typicalMs))

/** `creep` for the step named `key`, timed from when `key` last changed, updated a few times a second. */
export function useCreep(key: string | null, typicalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  const began = useRef({ key, at: Date.now() })
  if (began.current.key !== key) began.current = { key, at: Date.now() }
  useEffect(() => {
    if (key === null) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [key])
  return key === null ? 0 : creep(now - began.current.at, typicalMs)
}
