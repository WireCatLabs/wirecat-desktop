import { X } from "lucide-react"
import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { useCloseOutside, useListPlacement } from "./popup-list"

type Props = {
  value: string
  onChange: (value: string) => void
  /** Suggestions; the list shows those that contain what is typed. */
  options: readonly string[]
  placeholder?: string
  id?: string
  className?: string
  "aria-label"?: string
}

const contains = (option: string, typed: string) =>
  option.toLocaleLowerCase().includes(typed.trim().toLocaleLowerCase())

/**
 * An editable combobox with a list that filters as one types (WAI-ARIA APG, list autocomplete). Focus stays in the
 * field; the list follows it with aria-activedescendant. The typed text is the value, so a partial name filters too.
 */
export function Combobox({ value, onChange, options, placeholder, id, className, ...aria }: Props) {
  const m = useMessages(uiMessages)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const field = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const base = useId()
  const listId = `${base}-list`
  const optionId = (i: number) => `${base}-${i}`
  // An exact pick shows every option again, so the owner can switch to another without clearing first.
  const shown = options.includes(value) ? options : options.filter((o) => contains(o, value))

  const close = useCallback(() => {
    setOpen(false)
    setActive(-1)
  }, [])
  const inside = useMemo(() => [wrap, list], [])
  const place = useListPlacement(open && shown.length > 0, wrap, list)
  useCloseOutside(open, inside, close)

  const pick = (i: number) => {
    const o = shown[i]
    if (o === undefined) return
    onChange(o)
    close()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const { key } = e
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(key === "ArrowDown" ? 0 : shown.length - 1)
        return
      }
      if (e.altKey && key === "ArrowUp") return close()
      setActive((a) => {
        if (shown.length === 0) return -1
        if (key === "ArrowDown") return a + 1 >= shown.length ? 0 : a + 1
        return a <= 0 ? shown.length - 1 : a - 1
      })
    } else if (key === "Enter" && open && active >= 0) {
      e.preventDefault()
      pick(active)
    } else if (key === "Escape") {
      // The native <dialog> would close on this Escape too.
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (value !== "") {
        e.preventDefault()
        onChange("")
      }
    } else if (key === "Tab") close()
  }

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${base}-${active}`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, active, base])

  const expanded = open && shown.length > 0

  return (
    <div
      ref={wrap}
      className={cx(
        "relative flex h-[2.4rem] min-w-0 items-center rounded-[0.35rem] border border-line-strong bg-app",
        "hover:border-ink-dim/60 focus-within:border-brand",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
        className,
      )}
    >
      <input
        ref={field}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        {...aria}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        onBlur={close}
        className="selectable inner-field h-full min-w-0 flex-1 bg-transparent pr-1 pl-2.5 text-[0.95rem] text-ink placeholder:text-ink-dim"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={m.clear}
        title={m.clear}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onChange("")
          field.current?.focus()
        }}
        className={cx(
          "mr-1 grid size-7 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink",
          value === "" && "invisible",
        )}
      >
        <X className="size-4" aria-hidden />
      </button>
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label={aria["aria-label"]}
        hidden={!expanded}
        style={place}
        onMouseDown={(e) => e.preventDefault()}
        className={cx(
          "fixed z-50 max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-[0.45rem] border border-line bg-app p-1 font-sans text-ink shadow-panel",
          "motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]",
        )}
      >
        {shown.map((o, i) => (
          <div
            key={o}
            id={optionId(i)}
            role="option"
            tabIndex={-1}
            aria-selected={o === value}
            onMouseMove={() => i !== active && setActive(i)}
            onMouseUp={() => pick(i)}
            className={cx(
              "flex min-h-[2.1rem] cursor-pointer items-center rounded-[0.3rem] px-1.5 py-1 text-[0.95rem] text-ink",
              i === active && "bg-app-3",
              o === value && "font-medium",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{o}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
