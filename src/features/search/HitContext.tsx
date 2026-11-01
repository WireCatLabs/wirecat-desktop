import { ExternalLink, MessagesSquare, Paperclip, ScrollText } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { findTool } from "@/domain/catalog"
import { formatWhen } from "@/domain/runs"
import { type ContextLine, contextLines, hitLink } from "@/domain/search-context"
import { clock } from "@/domain/sync"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { SearchContext, SearchHit } from "@/platform/search-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Skeleton } from "@/ui/Skeleton"
import { searchMessages } from "./messages"

type State = { kind: "loading" } | SearchContext

/** What a result leads to: the messages or transcript around it, read by the tool, and the original to open. */
export function HitContext(props: { hit: SearchHit; tool: string; profile: string | null; now: Date }) {
  const { hit, tool, profile, now } = props
  const m = useMessages(searchMessages)
  const search = findTool(tool)?.search
  const ref = typeof hit.ref === "string" ? hit.ref : null
  const link = hitLink(hit)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const what = search?.what ?? "messages"
  const toolName = findTool(tool)?.name ?? tool

  const load = () => {
    if (!ref) return
    setState({ kind: "loading" })
    platform
      .searchContext(tool, profile, ref)
      .then(setState, (e) => setState({ kind: "failed", message: e instanceof Error ? e.message : String(e) }))
  }
  const toggle = () => {
    if (!open && (state === null || state.kind === "failed")) load()
    setOpen(!open)
  }

  if (!(search?.context && ref) && !link) return null
  const Icon = what === "meetings" ? ScrollText : MessagesSquare
  return (
    <div className="mb-[0.8rem] flex flex-col gap-[0.6rem] font-sans">
      <div className="flex flex-wrap gap-2">
        {search?.context && ref && (
          <Button size="sm" aria-expanded={open} onClick={toggle} icon={<Icon className="size-4" aria-hidden />}>
            {m.contextAction[what] ?? m.contextAction.messages}
            <ExpandChevron open={open} />
          </Button>
        )}
        {link && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => platform.openUrl(link)}
            icon={<ExternalLink className="size-4" aria-hidden />}
          >
            {m.openOriginal}
          </Button>
        )}
      </div>
      <Collapse open={open}>
        <AutoHeight swap={state?.kind}>
          {state?.kind === "found" ? (
            <Lines lines={contextLines(what, state.body, hit)} meeting={what === "meetings"} now={now} />
          ) : state?.kind === "old" ? (
            <ErrorNotice inline detail={state.message}>
              {m.contextOld(toolName)}
            </ErrorNotice>
          ) : state?.kind === "failed" ? (
            <ErrorNotice
              inline
              detail={state.message}
              action={
                <Button size="sm" onClick={load}>
                  {m.tryAgain}
                </Button>
              }
            >
              {m.contextFailed}
            </ErrorNotice>
          ) : (
            <Skeleton className="h-[6rem] w-full" label={m.readingContext} />
          )}
        </AutoHeight>
      </Collapse>
    </div>
  )
}

function Lines({ lines, meeting, now }: { lines: ContextLine[]; meeting: boolean; now: Date }) {
  const m = useMessages(searchMessages)
  const lang = useLang()
  const box = useRef<HTMLOListElement>(null)
  // The hit sits in the middle of its own box; the page itself never scrolls for it (rule 9).
  useLayoutEffect(() => {
    const el = box.current
    const anchor = el?.querySelector<HTMLElement>("[data-anchor]")
    if (el && anchor) el.scrollTop = anchor.offsetTop - el.clientHeight / 2 + anchor.clientHeight / 2
  }, [])
  if (lines.length === 0) return <p className="text-[0.9rem] text-ink-soft">{m.contextEmpty}</p>
  return (
    <ol
      ref={box}
      aria-label={meeting ? m.contextLabel.meetings : m.contextLabel.messages}
      className="selectable relative max-h-[20rem] overflow-y-auto rounded-[0.45rem] border border-line bg-app py-1"
    >
      {lines.map((l) => (
        <li
          key={l.key}
          data-anchor={l.anchor || undefined}
          aria-current={l.anchor || undefined}
          className={cx(
            "grid grid-cols-[7.2rem_9rem_minmax(0,1fr)] gap-3 border-l-2 px-[0.8rem] py-[0.3rem] text-[0.9rem]",
            l.anchor ? "border-brand bg-brand-soft" : "border-transparent",
          )}
        >
          <span className="whitespace-nowrap font-mono text-ink-dim tabular-nums">
            {l.at !== null ? clock(l.at) : l.when ? formatWhen(l.when, now, lang) : ""}
          </span>
          <span className="truncate text-ink-soft">{l.fromMe ? m.you : (l.who ?? "")}</span>
          <span className="min-w-0">
            <span className="text-ink">{l.text ?? ""}</span>
            {l.files.map((f) => (
              <span key={f} className="ml-2 inline-flex items-center gap-1 text-ink-soft">
                <Paperclip className="size-[0.8rem]" aria-label={m.attached} />
                <span className="font-mono text-[0.85rem]">{f}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ol>
  )
}
