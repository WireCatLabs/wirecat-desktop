import { useCallback, useLayoutEffect, useState } from "react"
import { create } from "zustand"
import { greetOnArrival, useGuideStart } from "@/features/guides"
import { useLang, useMessages } from "@/i18n"
import { HOME_SECTION, useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { Callout } from "@/ui/Callout"
import { focusInPlace, reducedMotion } from "@/ui/motion"
import { type DemoPage, type DemoScene, hideDemo, showDemo, stageDemo } from "./demo"
import { onboardingMessages, type TourStop } from "./messages"

/**
 * `anchor` null is a stop about no one element (how WireCat works with an agent): the panel sits in the middle.
 * `section` is the page the stop opens; without one the stop stays on the page before it (Help is in the top bar).
 */
type Stop = {
  key: TourStop
  anchor: string | null
  fallback?: string
  side?: "bottom" | "right"
  section?: string
  demo?: DemoPage
  scene?: DemoScene
}

// Anchors are data-tour attributes on the real elements, so the tour follows the interface instead of a copy of it.
// It walks the sidebar top to bottom and ends on the first guide, where the work starts (owner, 2026-11-05).
export const STOPS: readonly Stop[] = [
  { key: "tools", anchor: '[data-tour="nav-tools"]', side: "right", section: "tools" },
  { key: "lamps", anchor: '[data-tour="tool"] [role="img"]', section: "tools" },
  { key: "action", anchor: '[data-tour="tool-action"]', section: "tools" },
  { key: "agents", anchor: '[data-tour="nav-agents"]', side: "right", section: "agents" },
  { key: "how", anchor: null, section: "agents" },
  { key: "search", anchor: '[data-tour="nav-search"]', side: "right", section: "search", demo: "search" },
  { key: "searchAsk", anchor: '[data-tour="search-ask"]', section: "search", demo: "search" },
  { key: "searchHit", anchor: '[data-tour="search-hit"]', section: "search", demo: "search", scene: "hit" },
  { key: "tasks", anchor: '[data-tour="nav-tasks"]', side: "right", section: "tasks", demo: "tasks" },
  { key: "tasksView", anchor: '[data-tour="tasks-view"]', section: "tasks", demo: "tasks" },
  { key: "tasksRow", anchor: '[data-row="EX-3"]', section: "tasks", demo: "tasks" },
  { key: "memory", anchor: '[data-tour="nav-memory"]', side: "right", section: "memory", demo: "memory" },
  {
    key: "memoryReview",
    anchor: '[data-ref="memory:example-1"] [data-tour="memory-actions"]',
    section: "memory",
    demo: "memory",
  },
  {
    key: "memorySources",
    anchor: '[data-ref="memory:example-1"] [data-tour="memory-sources"]',
    section: "memory",
    demo: "memory",
    scene: "sources",
  },
  { key: "system", anchor: '[data-tour="nav-system"]', side: "right", section: "storage" },
  { key: "help", anchor: '[data-tour="help"]' },
  // With no guide the tools can run yet there is no "Start here"; the page's own heading stands in.
  { key: "guide", anchor: '[data-tour="guide-start"]', fallback: '[data-tour="guides"]', section: "guides" },
]

// A page draws its rows a few frames after it opens; a stop whose element never shows is passed over.
const FRAMES = 30

type TourState = {
  open: boolean
  returnTo: HTMLElement | null
  start(from?: "setup"): void
  close(): void
}

export const useTour = create<TourState>((set, get) => ({
  open: false,
  returnTo: null,
  start: (from) => {
    if (from === "setup") greetOnArrival()
    useNav.getState().go(STOPS[0]?.section ?? HOME_SECTION)
    set({ open: true, returnTo: document.activeElement instanceof HTMLElement ? document.activeElement : null })
  },
  close: () => {
    // Started from the setup's last step, the button that opened it is gone by now.
    const back = get().returnTo
    const fallback = document.querySelector<HTMLElement>('[data-tour="help"]')
    ;(back?.isConnected ? back : fallback)?.focus()
    set({ open: false, returnTo: null })
  },
}))

export function Tour() {
  const open = useTour((s) => s.open)
  return open ? <TourSteps /> : null
}

function TourSteps() {
  const close = useTour((s) => s.close)
  const active = useNav((s) => s.active)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [shown, setShown] = useState<{ index: number; el: Element | null } | null>(null)
  const all = useMessages(onboardingMessages)
  const lang = useLang()
  const m = all.tour
  const stop = STOPS[index]
  const demo = stop?.demo
  const scene = stop?.scene ?? null

  // Before the page opens, so it never reads the owner's records for a stop that shows examples. Leaving the stop,
  // closing the tour or Escape takes them away; a restart never had them, they are kept in memory only.
  useLayoutEffect(() => {
    if (!demo) return
    showDemo(demo, lang)
    return () => hideDemo(demo)
  }, [demo, lang])

  // Stops on one page share its examples; each opens only what it points at, and closes it on the way on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new language puts the examples back closed, so it opens again
  useLayoutEffect(() => {
    if (demo) stageDemo(demo, scene)
  }, [demo, scene, lang])

  useLayoutEffect(() => {
    if (!stop) return
    if (stop.section && active !== stop.section) {
      useNav.getState().go(stop.section)
      return
    }
    const { anchor, fallback } = stop
    if (anchor === null) {
      setShown({ index, el: null })
      return
    }
    let frame = 0
    let tries = 0
    const find = () => {
      const el = document.querySelector(anchor)
      if (el) {
        el.scrollIntoView?.({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" })
        setShown({ index, el })
        return
      }
      if (++tries < FRAMES) {
        frame = requestAnimationFrame(find)
        return
      }
      const stand = fallback ? document.querySelector(fallback) : null
      if (stand) setShown({ index, el: stand })
      else if (STOPS[index + dir]) setIndex(index + dir)
      else close()
    }
    find()
    return () => cancelAnimationFrame(frame)
  }, [stop, index, active, dir, close])

  const onClose = useCallback(() => close(), [close])
  const step = (by: 1 | -1) => {
    setDir(by)
    setIndex((i) => Math.min(STOPS.length - 1, Math.max(0, i + by)))
  }
  // The last stop holds until its own element is found, so the panel never points at the page left behind.
  const current = shown && STOPS[shown.index]
  if (!shown || !current) return null

  const starter = shown.el?.matches('[data-tour="guide-start"]') ?? false
  const tryGuide = () => {
    const start = document.querySelector('[data-tour="guide-start"]')
    close()
    // A guide just swapped out by Next guide is still fading, inert, ahead of the new one.
    const buttons = [...(start?.querySelectorAll<HTMLElement>("article button") ?? [])]
    focusInPlace(buttons.find((b) => !b.closest("[inert]")) ?? null)
  }

  return (
    <Callout
      anchor={shown.el}
      side={current.side}
      title={m[current.key].title}
      index={shown.index}
      count={STOPS.length}
      onBack={() => step(-1)}
      onNext={() => step(1)}
      onClose={onClose}
      finish={
        <>
          {starter && (
            <>
              <Button data-primary size="sm" onClick={tryGuide}>
                {all.tourEnd.tryGuide}
              </Button>
              <Button size="sm" onClick={() => useGuideStart.getState().next()}>
                {all.tourEnd.nextGuide}
              </Button>
            </>
          )}
          <Button
            {...(starter ? {} : { "data-primary": "" })}
            size="sm"
            variant={starter ? "ghost" : "primary"}
            onClick={() => {
              close()
              useNav.getState().go(HOME_SECTION)
            }}
          >
            {all.tourEnd.openTools}
          </Button>
        </>
      }
    >
      {m[current.key].text}
    </Callout>
  )
}
