import { X } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { CheckMark } from "./Checkbox"
import { cx } from "./cx"
import { ExpandChevron } from "./ExpandChevron"
import { uiMessages } from "./messages"
import { useCloseOutside, useListPlacement } from "./popup-list"

export type FilterOption = {
  value: string
  label: string
  hint?: string
  count?: number | undefined
  icon?: ReactNode
  /** Opens something of its own (a calendar) each time it is chosen, so choosing it again never clears it. */
  opens?: boolean
}

type Props = {
  label: string
  options: readonly FilterOption[]
  selected: readonly string[]
  onChange: (values: string[]) => void
  /** One choice at a time, as the Due filter. */
  single?: boolean
  /** What the chip says once something is chosen, when the option's own label is too long for it. */
  shown?: string
}

const SEARCH_FROM = 7

/**
 * A filter chip: a button that opens a list of choices with a count beside each. Several may be chosen; a long list
 * gets a field to narrow it. The list floats over the page (`popup-list`), so opening it moves nothing. Once something
 * is chosen the chip says what ("Priority: high") and grows a cross that clears it.
 */
export function FilterMenu({ label, options, selected, onChange, single = false, shown: chipText }: Props) {
  const m = useMessages(uiMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [active, setActive] = useState(0)
  const chip = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const base = useId()
  const searchable = options.length >= SEARCH_FROM
  const shown = options.filter((o) =>
    `${o.label} ${o.hint ?? ""}`.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase()),
  )

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    setText("")
    if (refocus) button.current?.focus()
  }, [])
  const closeOutside = useCallback(() => close(false), [close])
  const inside = useMemo(() => [button, list], [])
  const place = useListPlacement(open, chip, list)
  useCloseOutside(open, inside, closeOutside)

  useEffect(() => {
    if (!open) return
    setActive(0)
    if (searchable) field.current?.focus({ preventScroll: true })
    else list.current?.focus({ preventScroll: true })
  }, [open, searchable])
  useEffect(() => {
    if (open) document.getElementById(`${base}-${active}`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, active, base])

  const toggle = (value: string) => {
    if (single) {
      const opens = options.find((o) => o.value === value)?.opens
      onChange(selected.includes(value) && !opens ? [] : [value])
      close(true)
      return
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const by = e.key === "ArrowDown" ? 1 : -1
      setActive((a) => Math.max(0, Math.min(shown.length - 1, a + by)))
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault()
      const o = shown[active]
      if (o) toggle(o.value)
    } else if (e.key === "Tab") close(false)
  }

  const names = selected.map((v) => options.find((o) => o.value === v)?.label ?? v)
  const listId = `${base}-list`
  const on = selected.length > 0
  return (
    <>
      <span
        ref={chip}
        className={cx(
          "inline-flex h-8 max-w-[20rem] min-w-0 items-stretch rounded-[0.35rem] border text-[0.875rem] transition-colors duration-150",
          on ? "border-brand/50 bg-brand-soft" : "border-line-strong bg-app",
        )}
      >
        <button
          ref={button}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => (open ? close(false) : setOpen(true))}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={cx(
            "flex min-w-0 cursor-pointer items-center gap-[0.35rem] rounded-[0.3rem] pr-[0.4rem] pl-[0.6rem] transition-colors duration-150",
            on
              ? "text-ink-soft hover:bg-brand/10 active:bg-brand/15"
              : "text-ink-soft hover:bg-app-2 hover:text-ink active:bg-app-3",
          )}
        >
          <span className="shrink-0">{on ? `${label}:` : label}</span>
          {on && " "}
          {on && (
            <span className="min-w-0 truncate font-medium text-ink">
              {chipText ?? (names.length > 2 ? m.chosen(names.length) : names.join(", "))}
            </span>
          )}
          <ExpandChevron open={open} className="ml-[0.1rem]" />
        </button>
        {on && (
          <button
            type="button"
            aria-label={m.clearFilter(label)}
            title={m.clearFilter(label)}
            onClick={() => {
              onChange([])
              button.current?.focus()
            }}
            className="grid w-[1.9rem] shrink-0 cursor-pointer place-items-center rounded-r-[0.3rem] border-brand/30 border-l text-ink-dim transition-colors duration-150 hover:bg-brand/10 hover:text-ink active:bg-brand/15"
          >
            <X className="size-[0.9rem]" aria-hidden />
          </button>
        )}
      </span>
      <div
        ref={list}
        hidden={!open}
        style={place}
        className="fixed z-50 w-[17rem] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-[0.45rem] border border-line bg-app p-[0.3rem] font-sans text-ink shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
      >
        {searchable && (
          <input
            ref={field}
            role="combobox"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? `${base}-${active}` : undefined}
            aria-label={m.find(label)}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder={m.find(label)}
            className="selectable inner-field mb-[0.3rem] h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.55rem] text-[0.9rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand"
          />
        )}
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={!single}
          tabIndex={searchable ? -1 : 0}
          aria-activedescendant={!searchable && shown[active] ? `${base}-${active}` : undefined}
          onKeyDown={searchable ? undefined : onKey}
          className="outline-none"
        >
          {shown.map((o, i) => {
            const picked = selected.includes(o.value)
            return (
              <div
                key={o.value}
                id={`${base}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={picked}
                onMouseDown={(e) => e.preventDefault()}
                onMouseUp={() => toggle(o.value)}
                onMouseMove={() => i !== active && setActive(i)}
                className={cx(
                  "flex min-h-[2.1rem] cursor-pointer items-center gap-[0.55rem] rounded-[0.3rem] px-[0.5rem] text-[0.9rem]",
                  i === active && "bg-app-3",
                )}
              >
                <CheckMark on={picked} round={single} />
                {o.icon}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="font-mono text-[0.85rem] text-ink-dim">{o.hint}</span>}
                {o.count !== undefined && (
                  <span className="min-w-[1.6rem] text-right font-mono text-[0.85rem] tabular-nums text-ink-dim">
                    {formatNumber(o.count, lang)}
                  </span>
                )}
              </div>
            )
          })}
          {shown.length === 0 && <p className="px-[0.5rem] py-[0.4rem] text-[0.9rem] text-ink-dim">{m.noChoice}</p>}
        </div>
      </div>
    </>
  )
}
