import { LoaderCircle, Plus, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { ToolNeeded } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { DigestSpec } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { CreateDialog, draftOf, Starter, type Template, takenNames } from "./CreateDigest"
import { DigestTable } from "./DigestTable"
import { DigestView } from "./DigestView"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { NoHarness, OtherSchedules } from "./ScheduleCard"
import { useDigestBook } from "./schedule-store"

export function DigestsPage() {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
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
  const pick = (t: Template) => ready && setCreating(draftOf(t, takenNames(ready.digests), b))

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.page}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={reading}
            onClick={() => void read()}
            icon={
              reading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )
            }
          >
            {reading && book ? m.reading : m.readAgain}
          </Button>
          {ready && (ready.named || ready.digests.length === 0) && (
            <Button
              // The one purple action: while a digest is open its own Save is the purple one.
              variant={item ? "secondary" : "primary"}
              disabled={!harness}
              onClick={() => pick(ready.digests.length === 0 ? "daily" : "own")}
              icon={<Plus className="size-4" aria-hidden />}
            >
              {b.create}
            </Button>
          )}
        </div>
      </div>

      {error && !book ? (
        <ErrorNotice action={<ReportThis what="Reading digests" error={error} />}>{s.readFailed(error)}</ErrorNotice>
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
              {book.digests.length === 0 ? (
                <Starter can={can} onPick={pick} />
              ) : (
                <DigestTable digests={book.digests} harness={harness} />
              )}
              {book.others.length > 0 && <OtherSchedules others={book.others} />}
            </div>
          )}
        </Crossfade>
      )}
      <CreateDialog start={creating} can={can} harness={harness} onClose={() => setCreating(null)} />
    </div>
  )
}
