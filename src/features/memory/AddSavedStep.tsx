import { Check, LoaderCircle } from "lucide-react"
import { useId, useState } from "react"
import { chosenReader, MENDED_IN_SETTINGS } from "@/domain/memory-add"
import { personName } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { AddedSource, Reader } from "@/platform/memory-add-schemas"
import { useReaders } from "@/shared/readers-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { GoAiModel } from "./AddImageLine"
import { ReaderLine } from "./AddReaderLine"
import { Refusal } from "./AddRefusal"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

/** Step 2: what WireCat kept, the names it found in it, and whether to read it for facts, with who reads it. */
/**
 * Never disabled for a missing reader: a click with none chosen says so, and a chosen reader that cannot read yet
 * is still asked, so memo says why in its own reason.
 */
function suggestWith(readers: readonly Reader[]) {
  const reader = chosenReader(readers) ?? readers.find((r) => r.chosen)
  if (reader) void useAddSource.getState().suggest(reader.id)
  else useAddSource.setState({ error: "reader.none-chosen" })
}

export function SavedStep() {
  const m = useMessages(addMessages)
  const added = useAddSource((s) => s.added)
  const busy = useAddSource((s) => s.busy)
  const readers = useReaders((s) => s.readers)
  const { finish } = useAddSource.getState()
  const saveHint = useId()
  if (!added) return null
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
            disabled={!!busy}
            onClick={() => suggestWith(readers ?? [])}
            icon={busy === "suggest" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
          >
            {busy === "suggest" ? m.suggesting : m.suggest}
          </Button>
        )}
        <Button
          variant={readable ? "secondary" : "primary"}
          disabled={!!busy}
          onClick={finish}
          aria-describedby={readable ? saveHint : undefined}
        >
          {readable ? m.onlySave : m.done}
        </Button>
      </div>
      {readable && (
        <p id={saveHint} className="-mt-[0.6rem] text-[0.9rem] text-ink-dim">
          {m.onlySaveHint}
        </p>
      )}
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
  const unread = added.read === "no-text"
  const reason = added.image?.reason ?? null
  const notes = [
    added.duplicateOf ? m.duplicate : added.kept ? m.kept[added.kept] : null,
    unread ? (reason ? (m.imageAfter[reason] ?? m.noText) : m.noText) : null,
    added.image?.readBy && added.read === "extracted" ? m.imageRead(added.image.readBy) : null,
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
      {unread && reason && MENDED_IN_SETTINGS.includes(reason) && <GoAiModel className="mt-[0.4rem] -ml-2" />}
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
                <span>{personName({ name: n.name, contact: n.foundAs[0] }) ?? n.ref}</span>
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
