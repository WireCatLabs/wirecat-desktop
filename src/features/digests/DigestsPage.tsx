import { useEffect, useState } from "react"
import { ToolNeeded } from "@/features/tools"
import { useLang, useMessages } from "@/i18n"
import type { DigestSpec } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { Page, PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { Crossfade } from "@/ui/Crossfade"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"
import { CreateDialog, draftOf, Starter, type Template } from "./CreateDigest"
import { DigestTable } from "./DigestTable"
import { DigestView } from "./DigestView"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { OtherSchedules } from "./OtherSchedules"
import { NoHarness, OlderMemo } from "./ScheduleCard"
import { useDigestBook } from "./schedule-store"

export function DigestsPage() {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const lang = useLang()
  const s = useMessages(scheduleMessages)
  const { book, error, open, load, openDigest } = useDigestBook()
  const [reading, setReading] = useState(false)
  const [creating, setCreating] = useState<DigestSpec | null>(null)

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
  const can = { named: ready?.named ?? false }
  const harness = ready?.harness ?? false
  const item = ready?.digests.find((d) => d.name === open) ?? null
  // A digest removed elsewhere closes its page.
  useEffect(() => {
    if (open && ready && !item) openDigest(null)
  }, [open, ready, item, openDigest])
  const linked = useDigestDay((s) => s.digest)
  useEffect(() => {
    if (!linked) return
    openDigest(linked)
    useDigestDay.setState({ digest: null })
  }, [linked, openDigest])
  const pick = (t: Template) => ready && setCreating(draftOf(t, ready.digests, b, lang))

  return (
    <Page>
      <PageHeader
        title={m.page}
        section="digests"
        intro={m.intro}
        actions={<RefreshButton busy={reading} onClick={() => void read()} label={m.readAgain} busyLabel={m.reading} />}
      />

      {error && !book ? (
        <ErrorNotice raw={error} action={<ReportThis what="Reading digests" error={error} />}>
          {s.readFailed}
        </ErrorNotice>
      ) : book === null ? (
        <Skeleton className="h-[14rem] w-full" label={m.reading} />
      ) : book.state === "noMemo" ? (
        <ToolNeeded gap={{ kind: "missing", tool: "memo", others: [] }} />
      ) : book.state === "old" ? (
        <ToolNeeded gap={{ kind: "old", tool: "memo", version: book.version, need: book.need }} />
      ) : (
        <Crossfade swap={item ? item.name : "list"}>
          {item ? (
            <DigestView item={item} can={can} harness={harness} />
          ) : (
            <div className="flex flex-col gap-[1.5rem]">
              {!harness && <NoHarness />}
              {!can.named && <OlderMemo />}
              {book.digests.length === 0 ? (
                <Starter can={can} onPick={pick} morningRests={book.morningRests} />
              ) : (
                <>
                  {/* An older memo keeps one digest: nothing more can be created until it updates. */}
                  {can.named && <Starter can={can} onPick={pick} morningRests={book.morningRests} compact />}
                  <DigestTable digests={book.digests} harness={harness} />
                </>
              )}
              {book.others.length > 0 && <OtherSchedules others={book.others} />}
            </div>
          )}
        </Crossfade>
      )}
      <CreateDialog start={creating} can={can} harness={harness} onClose={() => setCreating(null)} />
    </Page>
  )
}
