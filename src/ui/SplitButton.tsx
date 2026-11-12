import { ChevronDown, Ellipsis } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { cx } from "./cx"
import { ExpandChevron } from "./ExpandChevron"
import { useCloseOutside, useListPlacement } from "./popup-list"

export type MenuItem = {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** A second, quieter line under the label. */
  note?: string
}

type Props = {
  /** The main action; without one, only the menu button shows. */
  main?: {
    label: string
    onClick: () => void
    icon?: ReactNode
    disabled?: boolean
    /** Set when the main action opens something: the button then ends with the chevron that says so. */
    expanded?: boolean
  }
  items: MenuItem[]
  menuLabel: string
  /** The words on the menu button when there is no main action, so it reads as a button and not as decoration. */
  moreLabel: string
  disabled?: boolean
  className?: string
  /** Only "⋯", the size of a small button, for a row of a list; `menuLabel` names it. */
  compact?: boolean
}

const enabled = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []),
]

/** Where each menu key moves the focus among `count` items (WAI-ARIA menu). */
export const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, n) => (at + 1) % n,
  ArrowUp: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/**
 * A button with its other actions behind an arrow on its right (WAI-ARIA menu button). The menu floats in a fixed
 * layer, so opening it never moves the row it belongs to.
 */
export function SplitButton({ main, items, menuLabel, moreLabel, disabled, className, compact }: Props) {
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

  const hasMenu = items.length > 0
  const part =
    "inline-flex items-center justify-center border border-line-strong bg-app text-ink transition-colors duration-(--motion-fast) hover:bg-app-2 disabled:pointer-events-none disabled:opacity-45"

  if (!main && !hasMenu) return null

  return (
    <div ref={box} className={cx("inline-flex shrink-0", className)}>
      {main && (
        <button
          type="button"
          disabled={disabled || main.disabled}
          onClick={main.onClick}
          aria-expanded={main.expanded}
          className={cx(
            part,
            "h-[2.4rem] gap-2 px-[1rem] text-[0.95rem] font-medium whitespace-nowrap",
            hasMenu ? "rounded-l-button border-r-0" : "rounded-button",
          )}
        >
          {main.icon}
          {main.label}
          {main.expanded !== undefined && <ExpandChevron open={main.expanded} />}
        </button>
      )}
      {hasMenu && (
        <button
          ref={trigger}
          type="button"
          aria-label={menuLabel}
          title={menuLabel}
          aria-haspopup="menu"
          aria-expanded={!!open}
          aria-controls={open ? id : undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => (o ? false : "first"))}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
            e.preventDefault()
            setOpen(e.key === "ArrowDown" ? "first" : "last")
          }}
          className={cx(
            part,
            compact
              ? "h-8 w-8 rounded-control border-transparent bg-transparent text-ink-soft hover:bg-app-3 hover:text-ink"
              : main
                ? "h-[2.4rem] w-[2.2rem] rounded-r-button text-ink-soft hover:text-ink"
                : "h-[2.4rem] gap-[0.45rem] rounded-button px-[0.85rem] text-[0.95rem] font-medium whitespace-nowrap",
            open && "bg-app-3 text-ink",
          )}
        >
          {compact ? (
            <Ellipsis className="size-4" aria-hidden />
          ) : main ? (
            <ChevronDown className="size-4" aria-hidden />
          ) : (
            <>
              <Ellipsis className="size-4 text-ink-soft" aria-hidden />
              {moreLabel}
            </>
          )}
        </button>
      )}
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={menuLabel}
          tabIndex={-1}
          style={place}
          onKeyDown={onMenuKey}
          className="fixed z-50 flex w-max min-w-[11rem] flex-col overflow-y-auto overscroll-contain rounded-inset border border-line bg-app p-1 text-ink shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
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
                "flex w-full items-center gap-[0.6rem] rounded-pill px-[0.7rem] text-left text-[0.95rem] whitespace-nowrap hover:bg-app-3 focus-visible:bg-app-3 disabled:opacity-45",
                item.note ? "py-[0.4rem]" : "h-[2.2rem]",
                item.danger ? "text-bad" : "text-ink",
              )}
            >
              {item.icon}
              {item.note ? (
                <span className="flex flex-col">
                  {item.label}
                  <span className="text-[0.85rem] text-ink-dim">{item.note}</span>
                </span>
              ) : (
                item.label
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
