import { Check, ChevronDown } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { useCloseOutside, useListPlacement } from "@/ui/popup-list"
import { taskMessages } from "./messages"

export type FilterOption = {
  value: string
  label: string
  hint?: string
  count?: number | undefined
  icon?: ReactNode
}

type Props = {
  label: string
  options: readonly FilterOption[]
  selected: readonly string[]
  onChange: (values: string[]) => void
  /** One choice at a time, as the Due filter. */
  single?: boolean
}

const SEARCH_FROM = 7

/**
 * A filter: a button that opens a list of choices with memo's count beside each. Several may be chosen; a long list
 * gets a field to narrow it. The list floats over the page (`popup-list`), so opening it moves nothing.
 */
export function FilterMenu({ label, options, selected, onChange, single = false }: Props) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [active, setActive] = useState(0)
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
  const place = useListPlacement(open, button, list)
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
      onChange(selected.includes(value) ? [] : [value])
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
  return (
    <>
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
          "flex h-8 max-w-[18rem] cursor-pointer items-center gap-[0.4rem] rounded-[0.35rem] border pr-[0.4rem] pl-[0.6rem] text-[0.875rem] transition-colors duration-150",
          selected.length > 0
            ? "border-brand/50 bg-brand-soft text-ink"
            : "border-line-strong bg-app text-ink-soft hover:bg-app-2",
        )}
      >
        <span className="shrink-0">{label}</span>
        {names.length > 0 && (
          <span className="min-w-0 truncate font-medium text-ink">
            {names.length > 2 ? m.chosen(names.length) : names.join(", ")}
          </span>
        )}
        <ChevronDown
          className={cx("size-4 shrink-0 text-ink-dim transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </button>
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
            className="selectable mb-[0.3rem] h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.55rem] text-[0.9rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand focus-visible:outline-none"
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
            const on = selected.includes(o.value)
            return (
              <div
                key={o.value}
                id={`${base}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={on}
                onMouseDown={(e) => e.preventDefault()}
                onMouseUp={() => toggle(o.value)}
                onMouseMove={() => i !== active && setActive(i)}
                className={cx(
                  "flex min-h-[2.1rem] cursor-pointer items-center gap-[0.55rem] rounded-[0.3rem] px-[0.5rem] text-[0.9rem]",
                  i === active && "bg-app-3",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "grid size-[1rem] shrink-0 place-items-center border",
                    single ? "rounded-full" : "rounded-[0.25rem]",
                    on ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
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
