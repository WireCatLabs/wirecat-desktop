import { ChevronDown, Ellipsis } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { cx } from "./cx"
import { useCloseOutside, useListPlacement } from "./popup-list"

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }

type Props = {
  /** The main action; without one, only the menu button shows. */
  main?: { label: string; onClick: () => void; icon?: ReactNode; disabled?: boolean }
  items: MenuItem[]
  menuLabel: string
  disabled?: boolean
  className?: string
}

const enabled = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []),
]

const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, n) => (at + 1) % n,
  ArrowUp: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/**
 * A button with its other actions behind an arrow on its right (WAI-ARIA menu button). The menu floats in a fixed
 * layer, so opening it never moves the row it belongs to.
 */
export function SplitButton({ main, items, menuLabel, disabled, className }: Props) {
  const [open, setOpen] = useState<false | "first" | "last">(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const place = useListPlacement(!!open, box, menu)
  const close = useCallback(() => setOpen(false), [])
  const inside = useMemo(() => [box, menu], [])
  useCloseOutside(!!open, inside, close)

  useEffect(() => {
    if (!open) return
    const all = enabled(menu.current)
    ;(open === "last" ? all.at(-1) : all[0])?.focus({ preventScroll: true })
  }, [open])

  const shut = () => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      return shut()
    }
    if (e.key === "Tab") return setOpen(false)
    const move = MOVES[e.key]
    if (!move) return
    e.preventDefault()
    const all = enabled(menu.current)
    all[move(all.indexOf(document.activeElement as HTMLButtonElement), all.length)]?.focus()
  }

  const part =
    "inline-flex h-[2.4rem] items-center justify-center border border-line-strong bg-app text-ink transition-colors duration-150 hover:bg-app-2 disabled:pointer-events-none disabled:opacity-45"

  return (
    <div ref={box} className={cx("inline-flex shrink-0", className)}>
      {main && (
        <button
          type="button"
          disabled={disabled || main.disabled}
          onClick={main.onClick}
          className={cx(
            part,
            "gap-2 rounded-l-[0.4rem] border-r-0 px-[1rem] text-[0.95rem] font-medium whitespace-nowrap",
          )}
        >
          {main.icon}
          {main.label}
        </button>
      )}
      <button
        ref={trigger}
        type="button"
        aria-label={menuLabel}
        title={menuLabel}
        aria-haspopup="menu"
        aria-expanded={!!open}
        aria-controls={open ? id : undefined}
        disabled={disabled || items.length === 0}
        onClick={() => setOpen((o) => (o ? false : "first"))}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
          e.preventDefault()
          setOpen(e.key === "ArrowDown" ? "first" : "last")
        }}
        className={cx(
          part,
          "w-[2.2rem] text-ink-soft hover:text-ink",
          main ? "rounded-r-[0.4rem]" : "rounded-[0.4rem] border-transparent bg-transparent hover:bg-app-3",
          open && "bg-app-3 text-ink",
        )}
      >
        {main ? <ChevronDown className="size-4" aria-hidden /> : <Ellipsis className="size-4" aria-hidden />}
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={menuLabel}
          tabIndex={-1}
          style={place}
          onKeyDown={onMenuKey}
          className="fixed z-50 flex w-max min-w-[11rem] flex-col rounded-[0.45rem] border border-line bg-app p-1 text-ink shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                shut()
                item.onSelect()
              }}
              className={cx(
                "flex h-[2.2rem] w-full items-center rounded-[0.3rem] px-[0.7rem] text-left text-[0.95rem] whitespace-nowrap hover:bg-app-3 focus-visible:bg-app-3 disabled:opacity-45",
                item.danger ? "text-bad" : "text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
