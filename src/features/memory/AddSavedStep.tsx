import { Check, LoaderCircle, TriangleAlert } from "lucide-react"
import { useId, useState } from "react"
import { chosenReader, tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import type { AddedSource } from "@/platform/memory-add-schemas"
import { useNav } from "@/shared/nav"
import { useReaders } from "@/shared/readers-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { Refusal } from "./AddRefusal"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

/** Step 2: what WireCat kept, the names it found in it, and whether to read it for facts, with who reads it. */
export function SavedStep() {
  const m = useMessages(addMessages)
  const added = useAddSource((s) => s.added)
  const busy = useAddSource((s) => s.busy)
  const readers = useReaders((s) => s.readers)
  const { suggest, finish } = useAddSource.getState()
  if (!added) return null
  const reader = chosenReader(readers ?? [])
  const readable = added.read === "extracted"

  return (
    <div className="flex flex-col gap-[1.2rem]">
      <SourceCard added={added} />
      {readable && <Mentions />}
      {readable && <ReaderLine />}
      <Refusal />
      {busy === "suggest" && (
        <p role="status" className="text-[0.95rem] text-ink-soft">
          {m.suggestingHint}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {readable && (
          <Button
            variant="primary"
            disabled={!reader || !!busy}
            onClick={() => reader && void suggest(reader.id)}
            icon={busy === "suggest" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
          >
            {busy === "suggest" ? m.suggesting : m.suggest}
          </Button>
        )}
        <Button variant={readable ? "ghost" : "primary"} disabled={!!busy} onClick={finish}>
          {readable ? m.onlySave : m.done}
        </Button>
      </div>
    </div>
  )
}

export function SourceCard({ added }: { added: AddedSource }) {
  const m = useMessages(addMessages)
  const stored = useAddSource((s) => s.stored)
  const [open, setOpen] = useState(false)
  const text = useId()
  const facts = [m.kinds[added.kind] ?? added.kind, ...(added.mime ? [added.mime] : []), m.chars(added.chars)].join(
    " · ",
  )
  const notes = [
    added.duplicateOf ? m.duplicate : added.kept ? m.kept[added.kept] : null,
    added.read === "no-text" ? m.noText : null,
    added.truncated ? m.truncated : null,
    added.searchableWords ? m.findWords : null,
    added.searchableWords && !added.searchableMeaning ? m.findMeaning : null,
  ].filter((n): n is string => !!n)

  return (
    <div className="rounded-[0.45rem] border border-line bg-app-2/60 px-[1rem] py-[0.8rem]">
      <p className="flex items-center gap-2 font-medium">
        <Check className="size-4 text-ok" aria-hidden />
        {added.title ? m.savedAs(added.title) : m.savedUntitled}
      </p>
      <p className="mt-[0.2rem] font-mono text-[0.85rem] text-ink-dim">{facts}</p>
      {added.url && (
        <p className="selectable mt-[0.2rem] font-mono text-[0.85rem] break-all text-ink-soft">{added.url}</p>
      )}
      <ul className="mt-[0.5rem] flex flex-col gap-[0.15rem] text-[0.9rem] text-ink-soft">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {added.read === "extracted" && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-[0.4rem] -ml-2"
          aria-expanded={open}
          aria-controls={text}
          onClick={() => {
            if (!open) void useAddSource.getState().loadText()
            setOpen(!open)
          }}
        >
          {open ? m.hideText : m.showText}
        </Button>
      )}
      <Collapse open={open} id={text}>
        {!stored || stored.state === "loading" ? (
          <Skeleton className="h-[4rem] w-full rounded-[0.35rem]" label={m.readingText} />
        ) : stored.state === "failed" ? (
          <ErrorNotice inline>
            {m.failed} {stored.error}
          </ErrorNotice>
        ) : (
          <p className="selectable max-h-[16rem] overflow-y-auto rounded-[0.35rem] border border-line bg-app px-[0.8rem] py-[0.6rem] text-[0.95rem] whitespace-pre-line">
            {stored.source.text}
          </p>
        )}
      </Collapse>
    </div>
  )
}

function Mentions() {
  const m = useMessages(addMessages)
  const mentions = useAddSource((s) => s.mentions)
  const subjects = useAddSource((s) => s.subjects)
  const { toggleSubject } = useAddSource.getState()
  const head = useId()
  return (
    <section aria-labelledby={head} className="flex flex-col gap-[0.5rem]">
      <div>
        <h3 id={head} className="font-medium">
          {m.named}
        </h3>
        <p className="text-[0.9rem] text-ink-soft">{m.namedHint}</p>
      </div>
      {!mentions || mentions.state === "loading" ? (
        <Skeleton className="h-[2rem] w-[60%]" label={m.readingNames} />
      ) : mentions.state === "failed" ? (
        <ErrorNotice inline>
          {m.namesFailed} {mentions.error}
        </ErrorNotice>
      ) : mentions.mentions.items.length === 0 ? (
        <p className="text-[0.95rem] text-ink-dim">{m.namedNone}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {mentions.mentions.items.map((n) => (
            <li key={n.ref}>
              <label className="flex cursor-pointer items-center gap-2 text-[0.95rem]">
                <Checkbox checked={subjects.includes(n.ref)} onChange={() => toggleSubject(n.ref)} />
                <span>{n.name ?? n.foundAs[0] ?? n.ref}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {mentions?.state === "ready" && mentions.mentions.partial && (
        <p className="text-[0.85rem] text-ink-dim">{m.namedPartial}</p>
      )}
    </section>
  )
}

/** Who reads the text and whether it leaves this computer, said before anything is sent. */
function ReaderLine() {
  const m = useMessages(addMessages)
  const readers = useReaders((s) => s.readers)
  const error = useReaders((s) => s.error)
  const reader = chosenReader(readers ?? [])
  if (error)
    return tooOldFor(error) ? (
      <p className="text-[0.95rem] text-ink-soft">{m.tooOldReaders}</p>
    ) : (
      <ErrorNotice inline>
        {m.failed} {error}
      </ErrorNotice>
    )
  if (readers === null) return <Skeleton className="h-[1.2rem] w-[50%]" />
  if (!reader)
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-ink-soft">
        {m.noReader}
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("settings")}>
          {m.goSettings}
        </Button>
      </p>
    )
  return (
    <div className="text-[0.95rem]">
      <p>
        {m.reads(m.readerNames[reader.id] ?? reader.id, reader.model)} {reader.leavesComputer ? m.leaves : m.stays}
      </p>
      {reader.readsFiles && (
        <p className="mt-[0.2rem] flex items-center gap-2 text-warn-ink">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {m.readsFiles}
        </p>
      )}
    </div>
  )
}
