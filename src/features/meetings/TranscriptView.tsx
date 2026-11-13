import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ContextLine } from "@/domain/search-context"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { TranscriptLine } from "@/platform/bindings"
import { matchesIn, TranscriptLines } from "@/shared/TranscriptLines"
import { Button } from "@/ui/Button"
import { fieldFocus } from "@/ui/field"
import { meetingMessages } from "./messages"

const lineOf = (l: TranscriptLine): ContextLine => ({
  key: String(l.position),
  when: null,
  at: l.offsetMs,
  who: l.person?.name ?? l.speaker,
  fromMe: false,
  text: l.text,
  files: [],
  anchor: false,
})

/**
 * The transcript read so far, with a find over it: every match marked, Enter and Shift+Enter (or the arrows) to the
 * next and previous one, centred. It searches what was read; Show more reads the next lines.
 */
export function TranscriptView({
  lines,
  total,
  more,
  loadingMore,
  onMore,
}: {
  lines: readonly TranscriptLine[]
  total: number
  more: boolean
  loadingMore: boolean
  onMore: () => void
}) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const [find, setFind] = useState("")
  const [current, setCurrent] = useState(0)
  const [pressed, setPressed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => lines.map(lineOf), [lines])
  const term = find.trim()
  const count = useMemo(() => shown.reduce((n, l) => n + matchesIn(l.text, term), 0), [shown, term])

  useEffect(() => {
    if (!count) return
    box.current?.querySelector(`[data-match="${current}"]`)?.scrollIntoView?.({ block: "center" })
  }, [current, count])

  const step = (by: number) => {
    setPressed(true)
    if (count) setCurrent((c) => (c + by + count) % count)
  }

  return (
    <div className="flex min-w-0 flex-col gap-[0.7rem]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex items-center">
          <span className="sr-only">{m.find}</span>
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-ink-dim" aria-hidden />
          <input
            type="search"
            value={find}
            aria-invalid={pressed && term !== "" && count === 0 ? true : undefined}
            onChange={(e) => {
              setFind(e.target.value)
              setCurrent(0)
              setPressed(false)
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              e.preventDefault()
              step(e.shiftKey ? -1 : 1)
            }}
            placeholder={m.find}
            className={`h-8 w-[16rem] rounded-control border border-line-strong bg-app pr-2.5 pl-8 text-[0.95rem] text-ink placeholder:text-ink-dim aria-invalid:border-bad ${fieldFocus}`}
          />
        </label>
        {term && (
          <span className="font-mono text-[0.85rem] text-ink-soft tabular-nums" aria-live="polite">
            {count ? m.matchOf(current + 1, count) : m.notInTranscript}
          </span>
        )}
        {count > 0 && (
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={m.previousMatch}
              icon={<ChevronUp className="size-4" aria-hidden />}
              onClick={() => step(-1)}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={m.nextMatch}
              icon={<ChevronDown className="size-4" aria-hidden />}
              onClick={() => step(1)}
            />
          </span>
        )}
      </div>
      <div ref={box}>
        <TranscriptLines lines={shown} find={term} current={current} className="[content-visibility:auto]" />
      </div>
      {more && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" busy={loadingMore} onClick={onMore}>
            {m.showMore}
          </Button>
          <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">
            {m.linesPart(formatNumber(lines.length, lang), formatNumber(total, lang), total)}
          </span>
        </div>
      )}
    </div>
  )
}
