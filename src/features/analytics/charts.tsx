import { type KeyboardEvent, type PointerEvent, type ReactNode, useId, useRef, useState } from "react"
import type { Bucket } from "@/domain/analytics"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { analyticsMessages } from "./messages"

export type Series = { id: string; label: string; color: string }

/** A round top for the axis: 1, 2, 2.5 or 5 times a power of ten, so the gridlines fall on numbers people read. */
export function niceMax(v: number): number {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= v) ?? 10) * pow
}

const compact = (n: number, lang: string) =>
  new Intl.NumberFormat(lang, { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)

/** Which bars get a label under them: about six, counted back from the newest so today is always named. */
export function labelled(n: number, most = 6): Set<number> {
  const step = Math.max(1, Math.ceil(n / most))
  const out = new Set<number>()
  for (let i = n - 1; i >= 0; i -= step) out.add(i)
  return out
}

type ColumnProps = {
  title: string
  buckets: readonly Bucket[]
  series: readonly Series[]
  /** Under a bar. */
  short: (key: string) => string
  /** In the tooltip and the table. */
  long: (key: string) => string
  unit: (n: number) => string
  /** Dimmed while a new period is read. */
  stale?: boolean
  /** Series the reader switched off in the legend; they leave the bars and the table, and keep their colours. */
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
}

/**
 * Stacked columns over time, one hue per series in a fixed order. Hover or the arrow keys pick a bar; its numbers
 * show above it and are read out. Every number is also in the table under the chart.
 */
export function ColumnChart({
  title,
  buckets: all,
  series: every,
  short,
  long,
  unit,
  stale = false,
  hidden,
  onToggle,
}: ColumnProps) {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const [active, setActive] = useState<number | null>(null)
  const plot = useRef<HTMLDivElement>(null)
  const series = hidden ? every.filter((s) => !hidden.has(s.id)) : every
  const buckets = hidden?.size
    ? all.map((b) => {
        const values = Object.fromEntries(Object.entries(b.values).filter(([k]) => !hidden.has(k)))
        return { ...b, values, total: Object.values(values).reduce((a, v) => a + v, 0) }
      })
    : all
  const max = niceMax(buckets.reduce((a, b) => Math.max(a, b.total), 0))
  const n = buckets.length
  const shown = labelled(n)
  const picked = active === null ? null : buckets[active]

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = plot.current?.getBoundingClientRect()
    if (!box || n === 0) return
    setActive(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * n))))
  }
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = { ArrowLeft: (active ?? n) - 1, ArrowRight: (active ?? -1) + 1, Home: 0, End: n - 1 }[e.key]
    if (to === undefined || n === 0) return
    e.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, to)))
  }
  const say = (b: Bucket) =>
    `${long(b.key)}: ${unit(b.total)}${series.length > 1 ? ` (${series.map((s) => `${s.label} ${formatNumber(b.values[s.id] ?? 0)}`).join(", ")})` : ""}`

  return (
    <figure className={cx("m-0 flex flex-col gap-3 transition-opacity duration-300", stale && "opacity-55")}>
      {every.length > 1 && (
        <Legend series={every} {...(hidden ? { hidden } : {})} {...(onToggle ? { onToggle } : {})} />
      )}
      <div className="grid grid-cols-[3.6rem_minmax(0,1fr)]">
        <div aria-hidden className="relative h-[11rem] font-mono text-[0.85rem] text-ink-dim tabular-nums">
          {[1, 0.5, 0].map((f) => (
            <span key={f} className="absolute right-[0.6rem] -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {compact(max * f, lang)}
            </span>
          ))}
        </div>
        <div className="relative">
          {[1, 0.5].map((f) => (
            <span
              key={f}
              aria-hidden
              className="absolute inset-x-0 h-px bg-[var(--grid)]"
              style={{ top: `${(1 - f) * 11}rem` }}
            />
          ))}
          <span aria-hidden className="absolute inset-x-0 top-[11rem] h-px bg-line-strong" />
          <div
            ref={plot}
            role="slider"
            tabIndex={n > 0 ? 0 : -1}
            aria-label={m.chartKeys(title)}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, n - 1)}
            aria-valuenow={active ?? n - 1}
            aria-valuetext={picked ? say(picked) : buckets.length ? say(buckets[n - 1] as Bucket) : ""}
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
            onKeyDown={keys}
            onBlur={() => setActive(null)}
            className="relative flex h-[11rem] items-end rounded-[0.2rem] outline-offset-4"
          >
            {buckets.map((b, i) => (
              <div key={b.key} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className={cx(
                    "flex w-[min(1.5rem,68%)] flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity duration-150",
                    active !== null && active !== i && "opacity-45",
                  )}
                  style={{ height: `${(b.total / max) * 100}%` }}
                >
                  {series.map((s) =>
                    (b.values[s.id] ?? 0) > 0 ? (
                      <span
                        key={s.id}
                        className="block min-h-[2px]"
                        style={{ flexGrow: b.values[s.id], flexBasis: 0, background: s.color }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ))}
            {picked && active !== null && (
              <Tip at={(active + 0.5) / n}>
                <p className="text-[0.85rem] text-ink-dim">{long(picked.key)}</p>
                <p className="font-semibold">{unit(picked.total)}</p>
                {series.length > 1 &&
                  series.map((s) => (
                    <p key={s.id} className="flex items-center gap-2 text-[0.875rem]">
                      <span aria-hidden className="h-[2px] w-3 rounded-full" style={{ background: s.color }} />
                      <span className="font-mono tabular-nums">{formatNumber(picked.values[s.id] ?? 0)}</span>
                      <span className="text-ink-soft">{s.label}</span>
                    </p>
                  ))}
              </Tip>
            )}
          </div>
          <div aria-hidden className="relative mt-2 h-[1.3rem] text-[0.85rem] text-ink-dim">
            {buckets.map((b, i) =>
              shown.has(i) ? (
                <span
                  key={b.key}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${((i + 0.5) / n) * 100}%` }}
                >
                  {short(b.key)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <NumbersTable
        caption={title}
        head={[m.when, ...(series.length > 1 ? series.map((s) => s.label) : []), m.total]}
        rows={buckets.map((b) => [
          long(b.key),
          ...(series.length > 1 ? series.map((s) => b.values[s.id] ?? 0) : []),
          b.total,
        ])}
      />
    </figure>
  )
}

/** The tooltip over a chart: `at` is the bar's centre as a share of the plot's width; it stays inside the plot. */
function Tip({ at, children }: { at: number; children: ReactNode }) {
  const side = at < 0.25 ? "left" : at > 0.75 ? "right" : "middle"
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-[0.45rem] border border-line bg-app px-3 py-2 shadow-panel",
        side === "middle" && "-translate-x-1/2",
        side === "right" && "-translate-x-full",
      )}
      style={{ left: `${at * 100}%` }}
    >
      {children}
    </div>
  )
}

export function Legend({
  series,
  values,
  hidden,
  onToggle,
}: {
  series: readonly Series[]
  values?: Record<string, ReactNode>
  /** With `onToggle`, each entry is a button that shows or hides its series. */
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-[1.1rem] gap-y-1 p-0 text-[0.9rem] text-ink-soft">
      {series.map((s) => {
        const off = hidden?.has(s.id) ?? false
        const body = (
          <>
            <span
              aria-hidden
              className={cx("size-[0.65rem] rounded-[2px] border transition-opacity duration-150", off && "opacity-30")}
              style={{ background: off ? "transparent" : s.color, borderColor: s.color }}
            />
            <span className={cx(off && "text-ink-dim line-through")}>{s.label}</span>
            {values?.[s.id] !== undefined && <span className="font-mono text-ink tabular-nums">{values[s.id]}</span>}
          </>
        )
        return (
          <li key={s.id}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(s.id)}
                className="flex cursor-pointer items-center gap-[0.45rem] rounded-[0.3rem] px-1 -mx-1 hover:bg-app-2 hover:text-ink"
              >
                {body}
              </button>
            ) : (
              <span className="flex items-center gap-[0.45rem]">{body}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export type Part = { id: string; label: string; value: number; color: string }

/** One whole split into parts: a thin bar with a 2px gap between parts, and a legend with each part's number. */
export function PartsBar({ parts, label }: { parts: readonly Part[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const some = parts.filter((p) => p.value > 0)
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <div className="flex flex-col gap-[0.65rem]">
      <div
        role="img"
        aria-label={`${label}: ${some.map((p) => `${p.label} ${formatNumber(p.value)} (${share(p.value)}%)`).join(", ")}`}
        className="flex h-[0.7rem] gap-[2px] overflow-hidden rounded-full bg-app-3"
      >
        {some.map((p) => (
          <span key={p.id} className="block h-full" style={{ flexGrow: p.value, flexBasis: 0, background: p.color }} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-[1.2rem] gap-y-1 p-0 text-[0.9rem] text-ink-soft">
        {parts.map((p) => (
          <li key={p.id} className="flex items-center gap-[0.45rem]">
            <span aria-hidden className="size-[0.65rem] rounded-[2px]" style={{ background: p.color }} />
            {p.label}
            <span className="font-mono text-ink tabular-nums">{formatNumber(p.value)}</span>
            <span className="font-mono text-ink-dim tabular-nums">{share(p.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type RankRow = { id: string; label: ReactNode; detail?: ReactNode; value: number; color: string; title: string }

/** Ranked horizontal bars from one baseline, the value at the tip. */
export function RankBars({
  rows,
  label,
  unit,
  stale = false,
}: {
  rows: readonly RankRow[]
  label: string
  unit: (n: number) => string
  stale?: boolean
}) {
  const max = rows.reduce((a, r) => Math.max(a, r.value), 1)
  return (
    <ol
      aria-label={label}
      className={cx(
        "m-0 flex list-none flex-col gap-[0.55rem] p-0 transition-opacity duration-300",
        stale && "opacity-55",
      )}
    >
      {rows.map((r) => (
        <li
          key={r.id}
          title={`${r.title}: ${unit(r.value)}`}
          className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem] items-center gap-x-3"
        >
          <span className="selectable flex min-w-0 items-center gap-[0.5rem] text-[0.95rem]">
            <span aria-hidden className="size-[0.55rem] shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="truncate">{r.label}</span>
            {r.detail}
          </span>
          <span aria-hidden className="block h-[0.6rem]">
            <span
              className="block h-full rounded-r-[4px]"
              style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%`, background: r.color }}
            />
          </span>
          <span className="text-right font-mono text-[0.95rem] tabular-nums">
            {formatNumber(r.value)}
            <span className="sr-only"> {unit(r.value)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** A figure: its label, the number in proportional figures, and a line under it. */
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[0.9rem] text-ink-dim">{label}</dt>
      <dd className="selectable m-0 text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">{value}</dd>
      {note !== undefined && <dd className="m-0 text-[0.875rem] text-ink-soft">{note}</dd>}
    </div>
  )
}

/** Every number of a chart as a table, folded away until asked for. */
export function NumbersTable({
  caption,
  head,
  rows,
}: {
  caption: string
  head: readonly string[]
  rows: readonly (readonly (string | number)[])[]
}) {
  const m = useMessages(analyticsMessages)
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-1 rounded-[0.35rem] text-[0.9rem] text-brand hover:text-brand-hover"
      >
        {open ? m.hideNumbers : m.showNumbers}
        <ExpandChevron open={open} />
      </button>
      <Collapse open={open} id={id}>
        <div className="mt-2 max-h-[16rem] overflow-auto rounded-[0.45rem] border border-line">
          <table className="w-full text-[0.9rem]">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-app-2 text-left text-ink-dim">
              <tr>
                {head.map((h, i) => (
                  <th key={h} scope="col" className={cx("px-3 py-1.5 font-medium", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="selectable">
              {rows.map((r) => (
                <tr key={String(r[0])} className="border-line border-t">
                  {r.map((c, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: a row's cells are its columns, in a fixed order
                      key={i}
                      className={cx("px-3 py-1", i > 0 && "text-right font-mono tabular-nums")}
                    >
                      {typeof c === "number" ? formatNumber(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapse>
    </div>
  )
}
