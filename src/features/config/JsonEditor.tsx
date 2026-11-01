import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { configMessages } from "./messages"

const TOKEN = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const [whole, str, colon, num, word] = m
    const tone = str
      ? colon
        ? "text-brand"
        : str.includes("•••")
          ? "text-ink-dim"
          : "text-ink"
      : num || word
        ? "text-warn-ink"
        : "text-ink-dim"
    out.push(
      <span key={at} className={tone}>
        {str ?? whole}
      </span>,
    )
    if (colon) out.push(colon)
    last = at + whole.length
  }
  out.push(text.slice(last))
  // A trailing newline needs a character after it, or the overlay is one line shorter than the textarea.
  out.push(" ")
  return out
}

/** Where `query` occurs in `text`, ignoring case; an empty query finds nothing. */
export function findAll(text: string, query: string): number[] {
  const q = query.toLowerCase()
  if (!q) return []
  const hay = text.toLowerCase()
  const at: number[] = []
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) at.push(i)
  return at
}

function matchLayer(text: string, at: readonly number[], length: number, current: number): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  at.forEach((start, i) => {
    out.push(text.slice(last, start))
    out.push(
      <mark
        key={start}
        className={cx("rounded-[0.15rem] text-transparent", i === current ? "bg-warn/55" : "bg-warn/22")}
      >
        {text.slice(start, start + length)}
      </mark>,
    )
    last = start + length
  })
  out.push(text.slice(last), " ")
  return out
}

type Props = {
  label: string
  value: string
  onChange: (text: string) => void
  onSave: () => void
  marks: ReadonlyMap<number, string>
  readOnly?: boolean
}

/** A textarea with a highlighted copy underneath: native editing, undo and selection, at no bundle cost. */
export function JsonEditor({ label, value, onChange, onSave, marks, readOnly }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const under = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const marksLayer = useRef<HTMLPreElement>(null)
  const findBox = useRef<HTMLInputElement>(null)
  const findId = useId()
  const m = useMessages(configMessages)
  const lines = value.split("\n").length
  const [query, setQuery] = useState("")
  const [current, setCurrent] = useState(0)
  const found = useMemo(() => findAll(value, query), [value, query])
  const shown = found.length === 0 ? 0 : Math.min(current, found.length - 1)

  const sync = useCallback(() => {
    const a = area.current
    if (!a) return
    for (const layer of [under.current, marksLayer.current]) {
      if (!layer) continue
      layer.scrollTop = a.scrollTop
      layer.scrollLeft = a.scrollLeft
    }
    if (gutter.current) gutter.current.scrollTop = a.scrollTop
  }, [])

  // Brings the current match into view by its line; the textarea keeps its own selection and focus stays in the box.
  useEffect(() => {
    const a = area.current
    const start = found[shown]
    if (!a || start === undefined) return
    const line = value.slice(0, start).split("\n").length - 1
    const height = Number.parseFloat(getComputedStyle(a).lineHeight) || 0
    const top = line * height
    if (top < a.scrollTop || top > a.scrollTop + a.clientHeight - height * 2)
      a.scrollTop = Math.max(0, top - a.clientHeight / 3)
    sync()
  }, [found, shown, value, sync])

  const step = (by: number) => {
    if (found.length === 0) return
    setCurrent((shown + by + found.length) % found.length)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault()
      onSave()
    }
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault()
      findBox.current?.focus()
      findBox.current?.select()
    }
  }

  const onFindKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      step(e.shiftKey ? -1 : 1)
    }
    if (e.key === "Escape" && query) {
      e.preventDefault()
      setQuery("")
    }
  }

  const box = "m-0 px-3 py-2.5 font-mono text-[0.9rem] leading-[1.6] whitespace-pre"

  return (
    <div>
      <search className="flex items-center gap-2 border-line border-b bg-app-2 px-3 py-1.5">
        <Search className="size-4 shrink-0 text-ink-dim" aria-hidden />
        <label htmlFor={findId} className="sr-only">
          {m.find}
        </label>
        <input
          ref={findBox}
          id={findId}
          type="search"
          value={query}
          placeholder={m.findPlaceholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setCurrent(0)
          }}
          onKeyDown={onFindKey}
          autoComplete="off"
          spellCheck={false}
          className="h-8 min-w-0 flex-1 bg-transparent font-mono text-[0.9rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim"
        />
        {query && (
          <span aria-live="polite" className="shrink-0 font-mono text-[0.85rem] text-ink-dim tabular-nums">
            {found.length === 0 ? m.findNone : m.findCount(shown + 1, found.length)}
          </span>
        )}
        <button
          type="button"
          aria-label={m.findPrevious}
          disabled={found.length === 0}
          onClick={() => step(-1)}
          className="grid size-8 place-items-center rounded-[0.35rem] text-ink-soft hover:bg-app-3 hover:text-ink disabled:opacity-40"
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={m.findNext}
          disabled={found.length === 0}
          onClick={() => step(1)}
          className="grid size-8 place-items-center rounded-[0.35rem] text-ink-soft hover:bg-app-3 hover:text-ink disabled:opacity-40"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </search>
      <div className="grid h-[min(60vh,34rem)] min-h-[16rem] grid-cols-[auto_minmax(0,1fr)] overflow-hidden bg-app">
        <div
          ref={gutter}
          aria-hidden
          className="overflow-hidden border-line border-r bg-app-2 py-2.5 font-mono text-[0.9rem] leading-[1.6] text-ink-dim tabular-nums select-none"
        >
          {Array.from({ length: lines }, (_, i) => {
            const mark = marks.get(i + 1)
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: a line number is its own identity
                key={i}
                title={mark}
                className={cx("min-w-[3.2rem] px-3 text-right", mark && "bg-bad/12 font-semibold text-bad")}
              >
                {i + 1}
              </div>
            )
          })}
        </div>
        <div className="relative min-w-0">
          <pre
            ref={marksLayer}
            aria-hidden
            className={cx(box, "pointer-events-none absolute inset-0 overflow-hidden text-transparent")}
          >
            {matchLayer(value, found, query.length, shown)}
          </pre>
          <pre
            ref={under}
            aria-hidden
            className={cx(box, "pointer-events-none absolute inset-0 overflow-hidden text-ink")}
          >
            {highlight(value)}
          </pre>
          <textarea
            ref={area}
            aria-label={label}
            aria-invalid={marks.size > 0}
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            onScroll={sync}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            className={cx(
              box,
              "selectable absolute inset-0 block size-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-ink outline-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
            )}
          />
        </div>
      </div>
    </div>
  )
}
