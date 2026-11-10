import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { Select } from "./Select"

type Props = {
  page: number
  /** Names the pager when a screen holds more than one. */
  label?: string
  onPage: (page: number) => void
  busy?: boolean
  /** The rows there are; numbers the pages and says "1–50 of 1,234". Without it the pager steps by `hasMore`. */
  total?: number
  /** There are more rows than `total`, which is then a floor: "of 5,000+". */
  totalMore?: boolean
  size?: number
  /** Page sizes the owner may choose; with `onSize`, a select. */
  sizes?: readonly number[]
  onSize?: (size: number) => void
  /** For a source that pages with a cursor and does not say its total. */
  hasMore?: boolean
}

/** The page sizes a table offers. */
export const PAGE_SIZES = [25, 50, 100] as const

/** First, last, the page and its neighbours; a gap where pages are left out, never a gap of one page. */
export function pageList(at: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, at - 1, at, at + 1])
  if (at <= 4) for (let p = 2; p <= 5; p++) wanted.add(p)
  if (at >= pages - 3) for (let p = pages - 4; p < pages; p++) wanted.add(p)
  const list = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  return list.flatMap((p, i) => {
    const before = list[i - 1]
    if (before === undefined || p === before + 1) return [p]
    return p === before + 2 ? [before + 1, p] : ["gap" as const, p]
  })
}

/** Numbered pages with Previous and Next, the rows shown of how many, and the page size; the caller keeps the page. */
export function Pager({
  page,
  onPage,
  label,
  busy = false,
  total,
  totalMore = false,
  size,
  sizes,
  onSize,
  hasMore,
}: Props) {
  const m = useMessages(uiMessages)
  const lang = useLang()
  const known = total !== undefined && size !== undefined
  const pages = known ? Math.max(1, Math.ceil(total / size)) : page + (hasMore ? 1 : 0)
  const at = Math.min(page, pages)
  const next = known ? at < pages : !!hasMore
  const n = (x: number) => formatNumber(x, lang)
  // Plain buttons: Button's own padding would squeeze a 2rem square and its icon.
  const cell = (current = false) =>
    cx(
      "inline-grid h-8 min-w-8 place-items-center rounded-[0.35rem] border px-2 text-[0.875rem] tabular-nums",
      "transition-colors duration-(--motion-fast) disabled:pointer-events-none disabled:opacity-45",
      current
        ? "border-line-strong bg-app font-semibold text-ink"
        : "border-transparent text-ink-soft hover:bg-app-3 hover:text-ink",
    )
  return (
    <nav
      aria-label={label ?? m.pages}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[0.9rem]"
    >
      <span className="min-w-[8rem] text-ink-dim tabular-nums" aria-live="polite">
        {known && total > 0
          ? m.range(n((at - 1) * size + 1), n(Math.min(at * size, total)), `${n(total)}${totalMore ? "+" : ""}`)
          : null}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          className={cell()}
          aria-label={m.previousPage}
          disabled={at <= 1 || busy}
          onClick={() => onPage(at - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {!known ? (
          <span aria-current="page" className="min-w-8 px-2 text-center font-semibold tabular-nums">
            <span className="sr-only">{m.pageN(at)}</span>
            <span aria-hidden>{n(at)}</span>
          </span>
        ) : (
          pageList(at, pages).map((p, i) =>
            p === "gap" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity but its place
              <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-ink-dim">
                …
              </span>
            ) : (
              <button
                type="button"
                key={p}
                className={cell(p === at)}
                aria-label={m.pageN(p)}
                aria-current={p === at ? "page" : undefined}
                disabled={busy}
                onClick={() => p !== at && onPage(p)}
              >
                {n(p)}
              </button>
            ),
          )
        )}
        <button
          type="button"
          className={cell()}
          aria-label={m.nextPage}
          disabled={!next || busy}
          onClick={() => onPage(at + 1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </span>
      <span className="flex min-w-[8rem] justify-end">
        {size !== undefined && sizes && onSize && (
          <Select
            size="sm"
            aria-label={m.pageSize}
            value={String(size)}
            onChange={(v) => onSize(Number(v))}
            options={sizes.map((s) => ({ value: String(s), label: m.perPage(n(s)) }))}
          />
        )}
      </span>
    </nav>
  )
}
