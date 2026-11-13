import type { InfiniteData } from "@tanstack/react-query"
import { FolderOpen } from "lucide-react"
import { documentName } from "@/domain/documents"
import { formatBytes } from "@/domain/format"
import { formatWhen } from "@/domain/runs"
import { openPerson } from "@/features/people"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { DocumentDetails } from "@/platform/bindings"
import { errorText } from "@/shared/errors"
import { OpenLink } from "@/shared/OpenLink"
import { SourceIcon, sourceOf } from "@/shared/SourceIcon"
import { Button } from "@/ui/Button"
import { CopyRef } from "@/ui/CopyRef"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { LinkButton } from "@/ui/LinkButton"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { useDocument, useReveal } from "./api"
import { kindIcon } from "./DocumentsTable"
import { type DocumentKind, documentMessages } from "./messages"
import { useDocuments } from "./store"

/** One document: where it lives, its text read part by part, and the people and meetings it is linked to. */
export function DocumentDialog() {
  const open = useDocuments((s) => s.open)
  const title = useDocuments((s) => s.title)
  const read = useDocument(open)
  const first = read.data?.pages[0]
  return (
    <Dialog
      open={open !== null}
      title={first ? documentName(first.document) : title || (open ?? "")}
      titleAside={<CopyRef value={open} />}
      onClose={() => useDocuments.getState().reveal(null)}
      wide="xl"
      scroll
      tall
    >
      {open && <Details key={open} read={read} />}
    </Dialog>
  )
}

type Read = ReturnType<typeof useDocument>

function Details({ read }: { read: Read }) {
  const m = useMessages(documentMessages)
  const box = "pb-[1.2rem]"
  if (read.error && !read.data)
    return (
      <div className={box}>
        <ErrorNotice
          raw={errorText(read.error)}
          action={
            <Button size="sm" busy={read.isFetching} onClick={() => void read.refetch()}>
              {m.tryAgain}
            </Button>
          }
        >
          {m.detailsFailed}
        </ErrorNotice>
      </div>
    )
  const doc = read.data?.pages[0]
  if (!doc)
    return (
      <div className={`${box} flex flex-col gap-[0.8rem]`}>
        <Skeleton className="h-[1.2rem] w-[60%]" label={m.reading} />
        <Skeleton className="h-[12rem] w-full rounded-control" />
      </div>
    )
  return (
    <div className={`${box} reveal grid gap-[1.4rem] lg:grid-cols-[minmax(0,1fr)_17rem]`}>
      <div className="flex min-w-0 flex-col gap-[1.2rem]">
        <Facts details={doc} />
        <Text read={read} pages={read.data as InfiniteData<DocumentDetails>} />
      </div>
      <Links doc={doc} />
    </div>
  )
}

function Facts({ details }: { details: DocumentDetails }) {
  const doc = details.document
  const m = useMessages(documentMessages)
  const lang = useLang()
  const reveal = useReveal()
  const at = doc.sourceModifiedAt ?? doc.storedAt
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <p className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-1 text-[0.95rem] text-ink-soft">
        <span className="inline-flex items-center gap-[0.4rem]">
          {kindIcon(doc.kind)}
          {m.kinds[doc.kind as DocumentKind] ?? doc.kind}
        </span>
        <span className="inline-flex min-w-0 items-center gap-[0.4rem]">
          <SourceIcon provider={doc.source.provider} />
          <span className="truncate">{doc.source.label}</span>
        </span>
        {doc.size !== null && <span className="font-mono text-[0.9rem] tabular-nums">{formatBytes(doc.size)}</span>}
        {at && (
          <span>
            {m.changedAt}{" "}
            <span className="font-mono text-[0.9rem] tabular-nums">{formatWhen(at, new Date(), lang)}</span>
          </span>
        )}
      </p>
      {doc.path && <p className="selectable font-mono text-[0.88rem] break-all text-ink-dim">{doc.path}</p>}
      {(doc.url || doc.local) && (
        <div className="flex flex-wrap items-center gap-2">
          {doc.url && <OpenLink url={doc.url}>{m.openIn(sourceOf(doc.source.provider).name)}</OpenLink>}
          {doc.local && (
            <Button
              size="sm"
              busy={reveal.isPending}
              icon={<FolderOpen className="size-4" aria-hidden />}
              onClick={() => reveal.mutate(doc.ref)}
            >
              {m.reveal}
            </Button>
          )}
          {reveal.error && (
            <ErrorNotice inline raw={errorText(reveal.error)}>
              {m.revealFailed}
            </ErrorNotice>
          )}
        </div>
      )}
      {details.tags.length > 0 && (
        <ul aria-label={m.tags} className="flex flex-wrap gap-[0.4rem]">
          {details.tags.map((t) => (
            <li key={t}>
              <Pill>{t}</Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The text as memo holds it, plain: it is the document's own words, never links or markup. */
function Text({ read, pages }: { read: Read; pages: InfiniteData<DocumentDetails> }) {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const first = pages.pages[0] as DocumentDetails
  const text = pages.pages.map((p) => p.text ?? "").join("")
  const shown = (pages.pages.at(-1) as DocumentDetails).nextCursor
  return (
    <section className="flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="font-medium">{m.text}</h3>
      {first.text === null || first.textLength === 0 ? (
        <p className="text-ink-soft">{first.extractionError ? m.extractionFailed : m.noText}</p>
      ) : (
        <>
          <div
            lang={first.language ?? undefined}
            className="selectable max-w-[70ch] rounded-control border border-line bg-app-2 px-[1rem] py-[0.8rem] text-body whitespace-pre-wrap break-words text-ink"
          >
            {text}
          </div>
          {read.hasNextPage && (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" busy={read.isFetchingNextPage} onClick={() => void read.fetchNextPage()}>
                {m.showMore}
              </Button>
              <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">
                {m.textPart(formatNumber(shown, lang), formatNumber(first.textLength, lang), first.textLength)}
              </span>
              {read.error && (
                <ErrorNotice inline raw={errorText(read.error)}>
                  {m.detailsFailed}
                </ErrorNotice>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Links({ doc }: { doc: DocumentDetails }) {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const day = (at: string | null) =>
    at ? new Date(at).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" }) : null
  const linked = (title: string, items: DocumentDetails["meetings"]) =>
    items.length > 0 && (
      <section className="flex flex-col gap-[0.4rem]">
        <h3 className="font-medium">{title}</h3>
        <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
          {items.map((i) => (
            <li key={i.ref} className="flex min-w-0 flex-col">
              <span className="truncate">{i.title ?? i.ref}</span>
              {day(i.at) && <span className="font-mono text-[0.85rem] text-ink-dim">{day(i.at)}</span>}
            </li>
          ))}
        </ul>
      </section>
    )
  return (
    <aside className="flex min-w-0 flex-col gap-[1.2rem]">
      <section className="flex flex-col gap-[0.4rem]">
        <h3 className="font-medium">{m.people}</h3>
        {doc.people.length === 0 ? (
          <p className="text-[0.95rem] text-ink-soft">{m.nobody}</p>
        ) : (
          <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
            {doc.people.map((p) => (
              <li key={p.ref}>
                <LinkButton
                  aria-label={m.openPerson(p.name ?? p.ref)}
                  onClick={() => {
                    useDocuments.getState().reveal(null)
                    openPerson(p.ref)
                  }}
                >
                  {p.name ?? p.ref}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </section>
      {linked(m.meetings, doc.meetings)}
      {linked(m.events, doc.events)}
    </aside>
  )
}
