import { useEffect, useState } from "react"
import { InboxSchedules } from "@/features/inbox"
import { useLang, useMessages } from "@/i18n"
import type { DigestSpec } from "@/platform/bindings"
import { Page, PageHeader } from "@/shared/Page"
import { Crossfade } from "@/ui/Crossfade"
import { Skeleton } from "@/ui/Skeleton"
import { type Book, BookGate, ReadAgain, type Ready as ReadyBook, useBook } from "./book"
import { CreateDialog, draftOf, Starter, type Template } from "./CreateDigest"
import { DigestTable } from "./DigestTable"
import { DigestView } from "./DigestView"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { OtherSchedules } from "./OtherSchedules"
import { type Can, NoHarness, OlderMemo } from "./ScheduleCard"
import { DIGEST_SETTINGS, useDigestBook } from "./schedule-store"

/**
 * The Settings tab of Digests: the presets to make a digest above every digest and its schedule, and one digest's
 * settings. What a digest wrote is on the Digests tab.
 */
export function DigestSettingsPage() {
  const m = useMessages(digestMessages)
  const view = useBook()
  const { open, openDigest } = useDigestBook()
  const item = view.ready?.digests.find((d) => d.name === open) ?? null
  // A digest removed elsewhere closes its page.
  useEffect(() => {
    if (open && view.ready && !item) openDigest(null)
  }, [open, view.ready, item, openDigest])

  return (
    <Page>
      <PageHeader title={m.page} section={DIGEST_SETTINGS} intro={m.intro} actions={<ReadAgain view={view} />} />
      <Crossfade swap={item ? item.name : "list"}>
        {item ? <DigestView item={item} can={view.can} harness={view.harness} /> : <DigestList view={view} />}
      </Crossfade>
    </Page>
  )
}

function DigestList({ view }: { view: Book }) {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const lang = useLang()
  const [creating, setCreating] = useState<DigestSpec | null>(null)
  const { ready, can, harness } = view
  const pick = (t: Template) => ready && setCreating(draftOf(t, ready.digests, b, lang))
  // The presets, the search and a table of three digests, at their loaded heights.
  const loading = (
    <div className="flex flex-col gap-[1.5rem]">
      <Skeleton className="h-[10.25rem] w-full" label={m.reading} />
      <div className="flex flex-col gap-[0.7rem]">
        <Skeleton className="h-[2.8rem] w-full" />
        <Skeleton className="h-[16.75rem] w-full" />
      </div>
    </div>
  )
  return (
    <BookGate view={view} loading={loading}>
      {(book) => (
        <div className="flex flex-col gap-[1.5rem]">
          <Ready book={book} can={can} harness={harness} onPick={pick} />
          <CreateDialog start={creating} can={can} harness={harness} onClose={() => setCreating(null)} />
        </div>
      )}
    </BookGate>
  )
}

function Ready(props: { book: ReadyBook; can: Can; harness: boolean; onPick: (t: Template) => void }) {
  const { book, can, harness, onPick } = props
  return (
    <>
      {!harness && <NoHarness />}
      {!can.named && <OlderMemo />}
      {book.digests.length === 0 ? (
        <Starter can={can} onPick={onPick} morningRests={book.morningRests} />
      ) : (
        <>
          {/* An older memo keeps one digest: nothing more can be created until it updates. */}
          {can.named && <Starter can={can} onPick={onPick} morningRests={book.morningRests} compact />}
          <DigestTable digests={book.digests} harness={harness} />
        </>
      )}
      <InboxSchedules />
      {book.others.length > 0 && <OtherSchedules others={book.others} />}
    </>
  )
}
