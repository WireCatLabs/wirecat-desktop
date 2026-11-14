import { TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { DigestBook, DigestItem, DigestSpec } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { revealTarget } from "@/ui/motion"
import { noticeBox } from "@/ui/notice"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"
import { CreateDialog, draftOf, Starter, type Template } from "./CreateDigest"
import { DigestTable, titleOf } from "./DigestTable"
import { DigestView } from "./DigestView"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { OtherSchedules } from "./OtherSchedules"
import { type Can, NoHarness, OlderMemo } from "./ScheduleCard"
import { DIGESTS_SECTION, useDigestBook } from "./schedule-store"

/** Reads the digests once when the page or section opens, and keeps "Read again" beside it. */
function useBook() {
  const { book, error, load } = useDigestBook()
  const [reading, setReading] = useState(false)
  const read = async () => {
    setReading(true)
    await load()
    setReading(false)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once when the page opens
  useEffect(() => {
    void read()
  }, [])
  const ready = book?.state === "ready" ? book : null
  const can: Can = {
    named: ready?.named ?? false,
    agent: ready?.agent ?? false,
    moreSources: ready?.moreSources ?? false,
    agentConsent: ready?.agentConsent ?? false,
  }
  return { book, error, reading, read, ready, can, harness: ready?.harness ?? false }
}

type Book = ReturnType<typeof useBook>

/**
 * The Digests tab of Tools: the presets to make a digest above every digest and its schedule, and one digest's settings
 * and what it wrote. A link, the bell or a notice opens a digest here and marks it.
 */
export function DigestsPage() {
  const m = useMessages(digestMessages)
  const view = useBook()
  const { open, openDigest } = useDigestBook()
  const item = view.ready?.digests.find((d) => d.name === open) ?? null
  // A digest removed elsewhere closes its page.
  useEffect(() => {
    if (open && view.ready && !item) openDigest(null)
  }, [open, view.ready, item, openDigest])
  const linked = useDigestDay((s) => s.digest)
  const ready = view.ready
  useEffect(() => {
    if (!linked || !ready) return
    useDigestDay.setState({ digest: null })
    // A link names the morning digest; a computer with only named digests has none, so the list is where it lands.
    const known = ready.digests.some((d) => d.name === linked)
    openDigest(known ? linked : null)
    revealTarget(() =>
      document.querySelector<HTMLElement>(known ? "[data-digest-view]" : "[data-digest-failures], [data-digest-table]"),
    )
  }, [linked, ready, openDigest])

  return (
    <Page>
      <PageHeader title={m.page} section={DIGESTS_SECTION} intro={m.intro} actions={<ReadAgain view={view} />} />
      <Crossfade swap={item ? item.name : "list"}>
        {item ? <DigestView item={item} can={view.can} harness={view.harness} /> : <DigestList view={view} />}
      </Crossfade>
    </Page>
  )
}

/**
 * The digests whose last run failed, above everything else, so a failure the owner heard about is the first thing on
 * the tab. Each opens its digest, where the agent's words and Get now are.
 */
function FailedDigests({ digests }: { digests: DigestItem[] }) {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const lang = useLang()
  const heading = useId()
  const openDigest = useDigestBook((s) => s.openDigest)
  const failed = digests.filter((d) => d.last && !d.last.ok)
  if (failed.length === 0) return null
  return (
    <section data-digest-failures aria-labelledby={heading} className={noticeBox("bad")}>
      <h2 id={heading} className="sr-only">
        {m.failures}
      </h2>
      <ul className="flex flex-col gap-2">
        {failed.map((d) => (
          <li key={d.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <TriangleAlert className="size-4 shrink-0 text-bad" aria-hidden />
            <span className="min-w-0 flex-1 basis-[20rem] text-body">
              <span className="font-medium text-ink">
                {m.failedLine(titleOf(d, b), ago(d.last?.at ?? 0, Date.now(), lang))}
              </span>{" "}
              <span className="text-ink-soft">{m.failedHint}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => openDigest(d.name)}>
              {m.openFailed(titleOf(d, b))}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReadAgain({ view }: { view: Book }) {
  const m = useMessages(digestMessages)
  // While the page error shows, its Try again is the one retry.
  if (view.error && !view.book) return null
  return (
    <RefreshButton busy={view.reading} onClick={() => void view.read()} label={m.readAgain} busyLabel={m.reading} />
  )
}

function DigestList({ view }: { view: Book }) {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const s = useMessages(scheduleMessages)
  const lang = useLang()
  const [creating, setCreating] = useState<DigestSpec | null>(null)
  const { book, error, reading, read, ready, can, harness } = view
  const pick = (t: Template) => ready && setCreating(draftOf(t, ready.digests, b, lang))

  if (error && !book)
    return (
      <PageError raw={error} what="Reading digests" busy={reading} onRetry={() => void read()}>
        {s.readFailed}
      </PageError>
    )
  // The presets, the search and a table of three digests, at their loaded heights.
  if (book === null)
    return (
      <div className="flex flex-col gap-[1.5rem]">
        <Skeleton className="h-[10.25rem] w-full" label={m.reading} />
        <div className="flex flex-col gap-[0.7rem]">
          <Skeleton className="h-[2.8rem] w-full" />
          <Skeleton className="h-[16.75rem] w-full" />
        </div>
      </div>
    )
  if (book.state === "noMemo") return <ToolNeeded gap={{ kind: "missing", tool: "memo", others: [] }} />
  if (book.state === "old")
    return <ToolNeeded gap={{ kind: "old", tool: "memo", version: book.version, need: book.need }} />
  return (
    <div className="flex flex-col gap-[1.5rem]">
      <Ready book={book} can={can} harness={harness} onPick={pick} />
      <CreateDialog start={creating} can={can} harness={harness} onClose={() => setCreating(null)} />
    </div>
  )
}

function Ready(props: {
  book: Extract<DigestBook, { state: "ready" }>
  can: Can
  harness: boolean
  onPick: (t: Template) => void
}) {
  const { book, can, harness, onPick } = props
  return (
    <>
      {!harness && <NoHarness />}
      {!can.named && <OlderMemo />}
      <FailedDigests digests={book.digests} />
      {book.digests.length === 0 ? (
        <Starter can={can} onPick={onPick} morningRests={book.morningRests} />
      ) : (
        <>
          {/* An older memo keeps one digest: nothing more can be created until it updates. */}
          {can.named && <Starter can={can} onPick={onPick} morningRests={book.morningRests} compact />}
          <DigestTable digests={book.digests} harness={harness} />
        </>
      )}
      {book.others.length > 0 && <OtherSchedules others={book.others} />}
    </>
  )
}
