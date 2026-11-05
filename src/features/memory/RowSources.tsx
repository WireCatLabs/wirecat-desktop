import { ChevronDown, ExternalLink, FileText, Mail, MessagesSquare, Video } from "lucide-react"
import { useId, useState } from "react"
import { refKind, sourceKindOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { savedAt } from "./labels"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

const SOURCE_ICONS = { meeting: Video, mail: Mail, message: MessagesSquare, note: FileText }

const sourceIcon = (kind: string) => {
  const Icon = SOURCE_ICONS[sourceKindOf(kind)]
  return <Icon className="size-[1.1rem]" aria-hidden />
}

/** One source; clicked, it opens what it says in place: the message among its neighbours, or the note. */
function SourceItem({ source: s }: { source: MemorySource }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const id = useId()
  const head = (
    <>
      <span className="mt-[0.15rem] text-ink-soft">{sourceIcon(s.kind)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="selectable text-[0.9rem] font-medium">
            {s.sender ?? s.title ?? s.ref ?? s.kind}
            {s.sender && s.title && <span className="font-normal text-ink-soft"> · {s.title}</span>}
          </span>
          {s.at && <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{savedAt(s.at, lang)}</span>}
        </span>
        {s.missing ? (
          <span className="mt-[0.1rem] block text-[0.9rem] text-ink-dim">{m.deletedSince}</span>
        ) : (
          s.excerpt && <span className="selectable mt-[0.1rem] block text-[0.95rem] text-ink-soft">“{s.excerpt}”</span>
        )}
      </span>
    </>
  )
  if (!s.ref || s.missing)
    return <li className="flex gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t">{head}</li>
  const ref = s.ref
  return (
    <li className="border-line not-first:border-t">
      <TextButton
        as="div"
        aria-expanded={open}
        aria-controls={id}
        aria-label={m.showContext(s.sender ?? s.title ?? ref)}
        onClick={() => {
          if (!open) useMemory.getState().loadContext(ref)
          setOpen(!open)
        }}
        className="group flex cursor-pointer gap-[0.8rem] px-[0.9rem] py-[0.7rem] transition-colors duration-(--motion-fast) hover:bg-app-2"
      >
        {head}
        <ChevronDown
          className={cx(
            "mt-[0.2rem] size-4 shrink-0 text-ink-dim transition-transform duration-(--motion-fast)",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </TextButton>
      <Collapse open={open} id={id}>
        <SourceContextView reference={ref} />
      </Collapse>
    </li>
  )
}

/** What memo reads back for a cited ref. Each kind memo cannot read says so instead of failing. */
export function SourceContextView({ reference }: { reference: string }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const ctx = useMemory((s) => s.contexts[reference])
  const [opening, setOpening] = useState<string | null>(null)
  const box = "border-line border-t bg-app-2/70 px-[0.9rem] py-[0.75rem] text-[0.95rem]"
  if (!ctx || ctx.state === "loading")
    return (
      <div className={box}>
        <Skeleton className="h-[3rem] w-full rounded-[0.35rem]" label={m.readingContext} />
      </div>
    )
  if (ctx.state === "failed")
    return (
      <div className={box}>
        <ErrorNotice inline>
          {m.contextFailed} {ctx.error}
        </ErrorNotice>
      </div>
    )
  const c = ctx.context
  if (c.kind === "unsupported") return <p className={cx(box, "reveal text-ink-dim")}>{m.noContext(c.prefix)}</p>
  if (c.kind === "note")
    return (
      <div className={cx(box, "reveal flex flex-col gap-[0.5rem]")}>
        {c.title && <p className="font-medium">{c.title}</p>}
        <p className="selectable max-h-[16rem] overflow-y-auto whitespace-pre-line text-ink-soft">{c.text}</p>
        {c.file && (
          <span className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={opening === "busy"}
              onClick={() => {
                setOpening("busy")
                platform
                  .memoryOpenSource(reference)
                  .then(() => setOpening(null))
                  .catch((e: unknown) => setOpening(e instanceof Error ? e.message : String(e)))
              }}
              icon={<ExternalLink className="size-4" aria-hidden />}
            >
              {m.openFile}
            </Button>
            {opening && opening !== "busy" && (
              <ErrorNotice inline>
                {m.contextFailed} {opening}
              </ErrorNotice>
            )}
          </span>
        )}
      </div>
    )
  return (
    <ol className={cx(box, "reveal flex flex-col gap-[0.45rem]")}>
      {c.items.map((msg, i) => (
        <li
          key={msg.ref ?? i}
          className={cx(
            "rounded-[0.35rem] px-[0.6rem] py-[0.35rem]",
            msg.anchor ? "bg-brand-soft/60 text-ink" : "text-ink-soft",
          )}
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.9rem]">
            <span className="font-medium text-ink">{msg.sender ?? "—"}</span>
            {msg.at && (
              <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{savedAt(msg.at, lang)}</span>
            )}
          </span>
          <span className="selectable block whitespace-pre-line">{msg.text}</span>
        </li>
      ))}
    </ol>
  )
}

export function Sources({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const sources = useMemory((s) => s.sources[entry.ref])
  if (!sources || sources.state === "loading")
    return (
      <div className="flex flex-col gap-[0.6rem]">
        <Skeleton className="h-[1rem] w-[14rem]" />
        <Skeleton className="h-[4.2rem] w-full rounded-[0.45rem]" />
      </div>
    )
  if (sources.state === "failed")
    return (
      <ErrorNotice inline>
        {m.sourcesFailed} {sources.error}
      </ErrorNotice>
    )
  return (
    <div data-tour="memory-sources" className="reveal flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.restsOn(sources.sources.length)}</h3>
      {sources.sources.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noSources}</p>
      ) : (
        <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
          {sources.sources.map((s: MemorySource) => (
            <SourceItem key={s.ref ?? `${s.kind}|${s.title ?? ""}|${s.at ?? ""}`} source={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function CitedRef({ reference, shown, onToggle }: { reference: string; shown: boolean; onToggle: () => void }) {
  const m = useMessages(memoryMessages)
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={m.showContext(reference)}
      onClick={onToggle}
      className={cx(
        "inline-flex cursor-pointer items-center gap-[0.3rem] rounded-[0.25rem] font-mono transition-colors duration-(--motion-fast) hover:text-brand",
        shown && "text-brand",
      )}
    >
      {sourceIcon(refKind(reference))}
      {reference}
      <ExpandChevron open={shown} className="size-[0.85rem]" />
    </button>
  )
}
