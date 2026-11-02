import { CircleHelp, Compass, Cpu, Info, ShieldCheck, Sparkles } from "lucide-react"
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react"
import { create } from "zustand"
import { ComputerFacts, ManagedNodeDialog, useComputerTrouble } from "@/features/system/ComputerFacts"
import { useSystem } from "@/features/system/store"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { onboardingMessages } from "./messages"

type Props = { onTour: () => void; onWelcome: () => void; onPrivacy: () => void; onAbout: () => void }

/**
 * Open or closed, and the button that opened it: the Help button, or the version number in the sidebar. Escape and a
 * pick give focus back to that one.
 */
export const useHelpMenu = create<{
  open: boolean
  opener: HTMLElement | null
  toggle(opener: HTMLElement): void
  close(): void
}>((set, get) => ({
  open: false,
  opener: null,
  toggle: (opener) => set(get().open ? { open: false } : { open: true, opener }),
  close: () => set({ open: false }),
}))

/** Marks a button outside the menu that toggles it, so the press on it is not taken for a click outside. */
export const HELP_OPENER = "data-help-opener"

const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, n) => (at + 1) % n,
  ArrowUp: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

export function HelpMenu({ onTour, onWelcome, onPrivacy, onAbout }: Props) {
  const open = useHelpMenu((s) => s.open)
  const { toggle, close } = useHelpMenu.getState()
  const [nodeOpen, setNodeOpen] = useState(false)
  const managed = useSystem((s) => s.readiness?.managed ?? null)
  const trouble = useComputerTrouble()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const factsId = useId()
  const m = useMessages(onboardingMessages).help

  const backToOpener = useCallback(() => (useHelpMenu.getState().opener ?? trigger.current)?.focus(), [])
  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])]

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (!root.current?.contains(target) && !target.closest?.(`[${HELP_OPENER}]`)) close()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      close()
      backToOpener()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close, backToOpener])

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Tab") return close()
    const move = MOVES[e.key]
    if (!move) return
    e.preventDefault()
    const all = items()
    all[move(all.indexOf(document.activeElement as HTMLButtonElement), all.length)]?.focus()
  }

  const pick = (action: () => void) => () => {
    close()
    backToOpener()
    action()
  }

  const item =
    "flex h-[2.4rem] w-full items-center gap-[0.7rem] rounded-[0.35rem] px-[0.7rem] pr-[1rem] text-left text-[0.95rem] whitespace-nowrap text-ink hover:bg-app-3 focus-visible:bg-app-3"
  const icon = "size-[1.1rem] text-ink-soft"

  return (
    <div ref={root} className="relative flex h-full items-center">
      <button
        ref={trigger}
        type="button"
        data-tour="help"
        aria-label={trouble ? m.trouble : m.help}
        title={trouble ? m.trouble : m.help}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={(e) => toggle(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" || open) return
          e.preventDefault()
          toggle(e.currentTarget)
        }}
        className={cx(
          "relative grid size-[2.2rem] place-items-center rounded-[0.4rem] text-ink-soft hover:bg-app-3 hover:text-ink",
          open && "bg-app-3 text-ink",
        )}
      >
        <CircleHelp className="size-[1.2rem]" strokeWidth={1.8} aria-hidden />
        <span
          aria-hidden
          className={cx(
            "absolute top-[0.35rem] right-[0.35rem] size-[0.5rem] rounded-full bg-bad ring-2 ring-wall transition-[opacity,scale] duration-300",
            trouble ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
        />
      </button>
      {open && (
        <div className="absolute top-[calc(100%-0.3rem)] right-0 z-30 flex w-max min-w-[15rem] flex-col rounded-[0.6rem] border border-line bg-app p-[0.3rem] shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]">
          <ComputerFacts id={factsId} />
          <hr className="mx-[0.4rem] mb-[0.3rem] border-line" />
          <div
            id={listId}
            role="menu"
            aria-label={m.help}
            aria-describedby={factsId}
            tabIndex={-1}
            onKeyDown={onMenuKey}
            className="flex flex-col"
          >
            {managed && (
              <>
                <button type="button" role="menuitem" className={item} onClick={pick(() => setNodeOpen(true))}>
                  <Cpu className={icon} strokeWidth={1.8} aria-hidden />
                  {m.node}
                </button>
                <hr className="mx-[0.4rem] my-[0.3rem] border-line" />
              </>
            )}
            <button type="button" role="menuitem" className={item} onClick={pick(onTour)}>
              <Compass className={icon} strokeWidth={1.8} aria-hidden />
              {m.tour}
            </button>
            <button type="button" role="menuitem" className={item} onClick={pick(onWelcome)}>
              <Sparkles className={icon} strokeWidth={1.8} aria-hidden />
              {m.welcome}
            </button>
            <hr className="mx-[0.4rem] my-[0.3rem] border-line" />
            <button type="button" role="menuitem" className={item} onClick={pick(onPrivacy)}>
              <ShieldCheck className={icon} strokeWidth={1.8} aria-hidden />
              {m.privacy}
            </button>
            <button type="button" role="menuitem" className={item} onClick={pick(onAbout)}>
              <Info className={icon} strokeWidth={1.8} aria-hidden />
              {m.about}
            </button>
          </div>
        </div>
      )}
      <ManagedNodeDialog open={nodeOpen} onClose={() => setNodeOpen(false)} />
    </div>
  )
}
