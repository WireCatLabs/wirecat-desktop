import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import type { ContextLine } from "@/domain/search-context"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { TranscriptLine } from "@/platform/bindings"
import { matchesIn, TranscriptLines } from "@/shared/TranscriptLines"
import { Button } from "@/ui/Button"
import { FindBar } from "@/ui/FindBar"
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
 * The transcript read so far, with a find over it: every match marked, the current one centred. It searches what was
 * read (NEED-2362); Show more reads the next lines.
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
  const box = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => lines.map(lineOf), [lines])
  const term = useDeferredValue(find.trim())
  const count = useMemo(() => shown.reduce((n, l) => n + matchesIn(l.text, term), 0), [shown, term])

  useEffect(() => {
    if (!count) return
    box.current?.querySelector(`[data-match="${current}"]`)?.scrollIntoView?.({ block: "center" })
  }, [current, count])

  return (
    <div className="flex min-w-0 flex-col">
      <FindBar
        value={find}
        onChange={(v) => {
          setFind(v)
          setCurrent(0)
        }}
        onStep={(by) => count && setCurrent((c) => (c + by + count) % count)}
        found={count}
        current={current}
        className="rounded-t-control border"
        labels={{
          find: m.find,
          placeholder: m.find,
          none: m.notInTranscript,
          count: m.matchOf,
          previous: m.previousMatch,
          next: m.nextMatch,
        }}
      />
      <div ref={box}>
        <TranscriptLines lines={shown} find={term} current={current} className="rounded-t-none" />
      </div>
      {more && (
        <div className="mt-[0.7rem] flex flex-wrap items-center gap-3">
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
