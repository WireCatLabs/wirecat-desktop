import { ExternalLink, FileText, Mail, MessagesSquare, Video } from "lucide-react"
import { useId, useState } from "react"
import { citedLabelOf, sourceKindOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyRef } from "@/ui/CopyRef"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { savedAt } from "./labels"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

/** One list frame and one item inset for a record's sources and a batch's findings, so the two read as one kind. */
export const ITEM_LIST = "flex flex-col rounded-[0.45rem] border border-line bg-app"
export const ITEM_PAD = "px-[1rem] py-[0.8rem]"

const SOURCE_ICONS = { meeting: Video, mail: Mail, message: MessagesSquare, note: FileText }

const sourceIcon = (kind: string) => {
  const Icon = SOURCE_ICONS[sourceKindOf(kind)]
  return <Icon className="size-[1.1rem] shrink-0" aria-hidden />
}

/** One source; clicked, it opens what it says in place: the message among its neighbours, or the note. */
export function SourceItem({ source: s }: { source: MemorySource }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const id = useId()
  const opens = !!s.ref && !s.missing
  const head = (
    <>
      <span className="mt-[0.15rem] text-ink-soft">{sourceIcon(s.kind)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="flex min-w-0 items-baseline gap-[0.35rem]">
            <span className="selectable min-w-0 text-[0.9rem] font-medium [overflow-wrap:anywhere]">
              {s.sender ?? s.title ?? (s.ref ? citedLabelOf(s.ref).short : s.kind)}
              {s.sender && s.title && <span className="font-normal text-ink-soft"> · {s.title}</span>}
            </span>
            {opens && <ExpandChevron open={open} className="translate-y-[0.2rem] group-hover:text-ink" />}
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
    return (
      <li className={cx("flex gap-[0.8rem] border-line not-first:border-t", ITEM_PAD)}>
        {head}
        <CopyRef value={s.ref} className="-mr-[0.4rem]" />
      </li>
    )
  const ref = s.ref
  return (
    <li className="border-line not-first:border-t">
      <div className="group flex items-start transition-colors duration-(--motion-fast) hover:bg-app-2">
        <TextButton
          as="div"
          aria-expanded={open}
          aria-controls={id}
          aria-label={m.showContext(s.sender ?? s.title ?? ref)}
          onClick={() => {
            if (!open) useMemory.getState().loadContext(ref)
            setOpen(!open)
          }}
          className={cx("flex min-w-0 flex-1 cursor-pointer gap-[0.8rem]", ITEM_PAD)}
        >
          {head}
        </TextButton>
        <CopyRef value={ref} className="mt-[0.7rem] mr-[0.6rem]" />
      </div>
      <Collapse open={open} id={id}>
        <SourceContextView reference={ref} withRef />
      </Collapse>
    </li>
  )
}

/** What memo reads back for a cited ref. Each kind memo cannot read says so instead of failing. */
export function SourceContextView({ reference, withRef = false }: { reference: string; withRef?: boolean }) {
  return (
    <>
      {withRef && (
        <p className="flex min-w-0 items-center gap-[0.4rem] border-line border-t bg-app-2/70 py-[0.2rem] pr-[0.4rem] pl-[0.9rem]">
          <span className="selectable min-w-0 flex-1 font-mono text-[0.85rem] text-ink-dim [overflow-wrap:anywhere]">
            {reference}
          </span>
          <CopyRef value={reference} />
        </p>
      )}
      <ContextBody reference={reference} />
    </>
  )
}

function ContextBody({ reference }: { reference: string }) {
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
        <ErrorNotice raw={ctx.error} inline>
          {m.contextFailed}
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
              <ErrorNotice raw={opening} inline>
                {m.contextFailed}
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
      <ErrorNotice raw={sources.error} inline>
        {m.sourcesFailed}
      </ErrorNotice>
    )
  return (
    <div data-tour="memory-sources" className="reveal flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.restsOn(sources.sources.length)}</h3>
      {sources.sources.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noSources}</p>
      ) : (
        <ul className={ITEM_LIST}>
          {sources.sources.map((s: MemorySource) => (
            <SourceItem key={s.ref ?? `${s.kind}|${s.title ?? ""}|${s.at ?? ""}`} source={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** A cited source in words: memo's sender and title when the batch's sources name it, else what and where it is. */
export function citedText(
  reference: string,
  sources: readonly MemorySource[] | undefined,
  kinds: Record<string, string>,
) {
  const known = sources?.find((s) => s.ref === reference)
  const named = [known?.sender, known?.title].filter(Boolean).join(" · ")
  if (named) return named
  const l = citedLabelOf(reference)
  return [kinds[l.kind], l.where, l.short].filter(Boolean).join(" · ")
}

export function CitedRef({
  reference,
  label,
  shown,
  onToggle,
}: {
  reference: string
  label: string
  shown: boolean
  onToggle: () => void
}) {
  const m = useMessages(memoryMessages)
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={m.showContext(label)}
      onClick={onToggle}
      className={cx(
        "inline-flex min-w-0 max-w-full cursor-pointer items-center gap-[0.35rem] rounded-[0.25rem] text-ink-soft transition-colors duration-(--motion-fast) hover:text-brand",
        shown && "text-brand",
      )}
    >
      {sourceIcon(citedLabelOf(reference).kind)}
      <span className="min-w-0 truncate">{label}</span>
      <ExpandChevron open={shown} className="size-[0.9rem] text-current" />
    </button>
  )
}
