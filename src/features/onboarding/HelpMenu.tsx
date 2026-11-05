import { BookOpenText, CircleHelp, Compass, Cpu, ExternalLink, Info, ShieldCheck, Sparkles } from "lucide-react"
import { type KeyboardEvent, useCallback, useEffect, useId, useRef } from "react"
import { create } from "zustand"
import { ComputerFacts, ManagedNodeDialog, useComputerTrouble } from "@/features/system/ComputerFacts"
import { useSystem } from "@/features/system/store"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { onboardingMessages } from "./messages"

export type HelpActions = {
  onDocs: () => void
  onTour: () => void
  onWelcome: () => void
  onPrivacy: () => void
  onAbout: () => void
}

/** The two places the same menu opens from: the Help button in the top bar, and the version number in the sidebar. */
export type HelpPlace = "help" | "version"

/** Which copy is open, and the button that opened it: Escape and a pick give focus back to that one. */
export const useHelpMenu = create<{
  open: HelpPlace | null
  opener: HTMLElement | null
  nodeOpen: boolean
  toggle(place: HelpPlace, opener: HTMLElement): void
  close(): void
  setNodeOpen(open: boolean): void
}>((set, get) => ({
  open: null,
  opener: null,
  nodeOpen: false,
  toggle: (place, opener) => set(get().open === place ? { open: null } : { open: place, opener }),
  close: () => set({ open: null }),
  setNodeOpen: (nodeOpen) => set({ nodeOpen }),
}))

/** Marks a button outside the menu that toggles it, so the press on it is not taken for a click outside. */
export const HELP_OPENER = "data-help-opener"

const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, n) => (at + 1) % n,
  ArrowUp: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/** The Help button and its copy of the menu. WireCat's Node.js dialog lives here, whichever copy opened it. */
export function HelpMenu(actions: HelpActions) {
  const open = useHelpMenu((s) => s.open === "help")
  const nodeOpen = useHelpMenu((s) => s.nodeOpen)
  const trouble = useComputerTrouble()
  const listId = useId()
  const m = useMessages(onboardingMessages).help
  const toggle = (e: { currentTarget: HTMLElement }) => useHelpMenu.getState().toggle("help", e.currentTarget)

  return (
    <div className="relative flex h-full items-center">
      <button
        type="button"
        data-tour="help"
        {...{ [HELP_OPENER]: "" }}
        aria-label={trouble ? m.trouble : m.help}
        title={trouble ? m.trouble : m.help}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" || open) return
          e.preventDefault()
          toggle(e)
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
            "absolute top-[0.35rem] right-[0.35rem] size-[0.5rem] rounded-full bg-bad ring-2 ring-wall transition-[opacity,scale] duration-(--motion-slow)",
            trouble ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
        />
      </button>
      {open && <HelpPanel place="help" listId={listId} {...actions} />}
      <ManagedNodeDialog open={nodeOpen} onClose={() => useHelpMenu.getState().setNodeOpen(false)} />
    </div>
  )
}

const PLACES: Record<HelpPlace, string> = {
  help: "top-[calc(100%-0.3rem)] right-0 origin-top-right motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]",
  // The version number sits at the foot of the sidebar: its copy rises from there, over the page beside it.
  version:
    "bottom-[calc(100%+0.4rem)] left-0 origin-bottom-left motion-safe:animate-[select-up_120ms_var(--ease-out-quart)]",
}

/** The menu itself, the same items and facts wherever it opens; `place` only says where it hangs. */
export function HelpPanel({
  place,
  listId,
  onDocs,
  onTour,
  onWelcome,
  onPrivacy,
  onAbout,
}: HelpActions & { place: HelpPlace; listId: string }) {
  const { close, setNodeOpen } = useHelpMenu.getState()
  const managed = useSystem((s) => s.readiness?.managed ?? null)
  const root = useRef<HTMLDivElement>(null)
  const factsId = useId()
  const m = useMessages(onboardingMessages).help

  const backToOpener = useCallback(() => useHelpMenu.getState().opener?.focus(), [])
  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])]

  useEffect(() => {
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
  }, [close, backToOpener])

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
    <div
      ref={root}
      className={cx(
        "absolute z-30 flex w-max min-w-[15rem] flex-col rounded-[0.6rem] border border-line bg-app p-[0.3rem] shadow-panel",
        PLACES[place],
      )}
    >
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
        <button type="button" role="menuitem" className={item} onClick={pick(onDocs)}>
          <BookOpenText className={icon} strokeWidth={1.8} aria-hidden />
          {m.docs}
          <ExternalLink className="ml-auto size-[0.85rem] text-ink-dim" aria-hidden />
        </button>
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
  )
}
