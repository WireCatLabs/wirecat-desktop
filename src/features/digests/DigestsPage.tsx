import { ArrowLeft } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import type { DigestBook, DigestSpec } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { LinkButton } from "@/ui/LinkButton"
import { RefreshButton } from "@/ui/RefreshButton"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { CreateDialog, draftOf, Starter, type Template } from "./CreateDigest"
import { DigestTable } from "./DigestTable"
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

/** The archive: every digest, and one digest's settings and what it wrote. Reached from the Agents tab, not the sidebar. */
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
  useEffect(() => {
    if (!linked) return
    openDigest(linked)
    useDigestDay.setState({ digest: null })
  }, [linked, openDigest])

  return (
    <Page>
      <PageHeader
        title={m.page}
        section={DIGESTS_SECTION}
        intro={m.intro}
        back={
          // An open digest has its own Back to the list.
          !item && (
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowLeft className="size-4" aria-hidden />}
              onClick={() => useNav.getState().go("agents")}
            >
              {m.backToAgents}
            </Button>
          )
        }
        actions={<ReadAgain view={view} />}
      />
      <Crossfade swap={item ? item.name : "list"}>
        {item ? <DigestView item={item} can={view.can} harness={view.harness} /> : <DigestList view={view} archive />}
      </Crossfade>
    </Page>
  )
}

/**
 * "Schedules and digests" on the Agents tab (owner, NEED-32 A): the presets to make a digest above the digests and
 * their schedules. A digest opens on the archive page, which "All digests" also opens.
 */
export function DigestSchedules() {
  const m = useMessages(digestMessages)
  const view = useBook()
  const heading = useId()
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-[1rem]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[24rem]">
          <SectionTitle id={heading}>{m.schedules}</SectionTitle>
          <p className="mt-2 max-w-[70ch] text-body text-ink-soft">
            {m.schedulesIntro}{" "}
            <LinkButton
              onClick={() => {
                useDigestBook.getState().openDigest(null)
                useNav.getState().go(DIGESTS_SECTION)
              }}
            >
              {m.allDigests}
            </LinkButton>
          </p>
        </div>
        <ReadAgain view={view} />
      </div>
      <DigestList view={view} />
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

/** `archive`: only the digests' table; their presets and other schedules live on the Agents tab (owner, NEED-32 A). */
function DigestList({ view, archive = false }: { view: Book; archive?: boolean }) {
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
        {!archive && <Skeleton className="h-[10.25rem] w-full" label={m.reading} />}
        <div className="flex flex-col gap-[0.7rem]">
          <Skeleton className="h-[2.8rem] w-full" label={archive ? m.reading : undefined} />
          <Skeleton className="h-[16.75rem] w-full" />
        </div>
      </div>
    )
  if (book.state === "noMemo") return <ToolNeeded gap={{ kind: "missing", tool: "memo", others: [] }} />
  if (book.state === "old")
    return <ToolNeeded gap={{ kind: "old", tool: "memo", version: book.version, need: book.need }} />
  return (
    <div className="flex flex-col gap-[1.5rem]">
      <Ready book={book} can={can} harness={harness} onPick={pick} archive={archive} />
      <CreateDialog start={creating} can={can} harness={harness} onClose={() => setCreating(null)} />
    </div>
  )
}

function Ready(props: {
  book: Extract<DigestBook, { state: "ready" }>
  can: Can
  harness: boolean
  onPick: (t: Template) => void
  archive: boolean
}) {
  const { book, can, harness, onPick, archive } = props
  return (
    <>
      {!harness && <NoHarness />}
      {!can.named && <OlderMemo />}
      {book.digests.length === 0 ? (
        <Starter can={can} onPick={onPick} morningRests={book.morningRests} />
      ) : (
        <>
          {/* An older memo keeps one digest: nothing more can be created until it updates. */}
          {can.named && !archive && <Starter can={can} onPick={onPick} morningRests={book.morningRests} compact />}
          <DigestTable digests={book.digests} harness={harness} />
        </>
      )}
      {book.others.length > 0 && !archive && <OtherSchedules others={book.others} />}
    </>
  )
}
