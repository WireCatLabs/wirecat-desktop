import type { ContextLine } from "@/domain/search-context"
import { cx } from "@/ui/cx"

/** Time into the meeting: `m:ss`, `h:mm:ss` past an hour. */
export const offsetText = (ms: number | null) => {
  if (ms === null) return null
  const s = Math.round(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  const h = Math.floor(s / 3600)
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** `text` with every case-insensitive `find` marked; the match at `current` gets the stronger mark. */
function marked(text: string, find: string, first: number, current: number) {
  if (!find) return text
  const parts: (string | { at: number; text: string })[] = []
  const lower = text.toLocaleLowerCase()
  const needle = find.toLocaleLowerCase()
  let from = 0
  let n = first
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
    parts.push(text.slice(from, i), { at: n++, text: text.slice(i, i + needle.length) })
    from = i + needle.length
  }
  parts.push(text.slice(from))
  return parts.map((p) =>
    typeof p === "string" ? (
      p
    ) : (
      <mark
        key={p.at}
        data-match={p.at}
        className={cx("rounded-[2px] text-ink", p.at === current ? "bg-brand/45" : "bg-brand-soft")}
      >
        {p.text}
      </mark>
    ),
  )
}

/** Count of `find` in a line's text, in the same terms `marked` uses. */
export const matchesIn = (text: string | null, find: string) => {
  if (!find || !text) return 0
  const lower = text.toLocaleLowerCase()
  const needle = find.toLocaleLowerCase()
  let n = 0
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) n++
  return n
}

/** A transcript as the app draws one everywhere (Contacts' calls, a meeting): time, speaker, words, selectable. */
export function TranscriptLines({
  lines,
  find = "",
  current = -1,
  className,
}: {
  lines: readonly ContextLine[]
  find?: string
  current?: number
  className?: string
}) {
  let seen = 0
  return (
    <ol className={cx("flex flex-col gap-[0.35rem] rounded-control bg-app-2 p-[0.6rem]", className)}>
      {lines.map((l) => {
        const first = seen
        seen += matchesIn(l.text, find)
        return (
          <li
            key={l.key}
            className="selectable grid grid-cols-[3.8rem_minmax(0,1fr)] gap-x-[0.6rem] [contain-intrinsic-size:auto_1.6rem] [content-visibility:auto]"
          >
            <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{offsetText(l.at)}</span>
            <span>
              {l.who && <span className="font-medium">{l.who}: </span>}
              {marked(l.text ?? "", find, first, current)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
