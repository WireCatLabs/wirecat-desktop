import { Check, Copy } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useMessages } from "@/i18n"
import { EXTERNAL_HREF } from "@/shared/external-href"
import { linkMessages } from "@/shared/messages-links"

const LINKS = `[${EXTERNAL_HREF}], a[href^="https://"], a[href^="http://"]`

type Open = { url: string; x: number; y: number; from: HTMLElement }

/** The address a right-click (or the Menu key) lands on, if it is on something that opens a web page. */
export function linkAt(target: EventTarget | null) {
  const el = target instanceof Element ? target.closest<HTMLElement>(LINKS) : null
  const url = el?.getAttribute(EXTERNAL_HREF) ?? el?.getAttribute("href")
  return el && url ? { el, url } : null
}

/**
 * One right-click menu for every web link and button in the app, with the address to copy. WebKit's own menu knows
 * nothing about a <button> that opens a page, and on an <a> it offers to open the page inside WireCat's window.
 */
export function LinkMenu() {
  const m = useMessages(linkMessages)
  const [open, setOpen] = useState<Open | null>(null)
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const root = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const hit = linkAt(e.target)
      if (!hit) return
      e.preventDefault()
      // The Menu key and Shift+F10 report no pointer: the menu hangs from the element instead.
      const rect = hit.el.getBoundingClientRect()
      const keyboard = e.clientX === 0 && e.clientY === 0
      setState("idle")
      setAt(null)
      setOpen({
        url: hit.url,
        x: keyboard ? rect.left : e.clientX,
        y: keyboard ? rect.bottom : e.clientY,
        from: hit.el,
      })
    }
    document.addEventListener("contextmenu", onMenu, true)
    return () => document.removeEventListener("contextmenu", onMenu, true)
  }, [])

  useLayoutEffect(() => {
    if (!open || !root.current) return
    const { width, height } = root.current.getBoundingClientRect()
    const margin = 8
    setAt({
      left: Math.max(margin, Math.min(open.x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(open.y, window.innerHeight - height - margin)),
    })
    root.current.querySelector<HTMLElement>("[role=menuitem]")?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return
      if (e.key === "Escape") {
        // Escape closes only the menu, not the dialog under it.
        e.preventDefault()
        e.stopPropagation()
      }
      close()
      open.from.focus()
    }
    document.addEventListener("mousedown", onDown, true)
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    return () => {
      document.removeEventListener("mousedown", onDown, true)
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [open])

  useEffect(() => {
    if (state !== "copied") return
    const t = setTimeout(() => {
      setOpen(null)
      open?.from.focus()
    }, 900)
    return () => clearTimeout(t)
  }, [state, open])

  if (!open) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(open.url)
      setState("copied")
    } catch {
      setState("failed")
    }
  }
  // A modal dialog makes everything outside it inert and sits above it: the menu goes inside the link's dialog.
  return createPortal(
    <div
      ref={root}
      style={at ?? { left: open.x, top: open.y, visibility: "hidden" }}
      className="fixed z-50 flex w-max max-w-[min(26rem,calc(100vw-1rem))] flex-col rounded-[0.6rem] border border-line bg-app p-[0.3rem] shadow-panel origin-top-left motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
    >
      <div role="menu" aria-label={m.menu} className="flex flex-col">
        <button
          type="button"
          role="menuitem"
          onClick={copy}
          className="flex h-[2.4rem] w-full items-center gap-[0.7rem] rounded-[0.35rem] px-[0.7rem] pr-[1rem] text-left text-[0.95rem] whitespace-nowrap text-ink hover:bg-app-3 focus-visible:bg-app-3"
        >
          {state === "copied" ? (
            <Check className="size-[1.1rem] text-ok" strokeWidth={1.8} aria-hidden />
          ) : (
            <Copy className="size-[1.1rem] text-ink-soft" strokeWidth={1.8} aria-hidden />
          )}
          {state === "copied" ? m.copiedAddress : m.copyAddress}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? m.copiedAddress : ""}
      </span>
      {state === "failed" && (
        <div className="flex flex-col gap-1 px-[0.7rem] pt-[0.2rem] pb-[0.5rem] text-[0.875rem]">
          <p className="text-bad">{m.copyFailed}</p>
          <code className="selectable font-mono break-all text-ink">{open.url}</code>
        </div>
      )}
    </div>,
    open.from.closest("dialog") ?? document.body,
  )
}
