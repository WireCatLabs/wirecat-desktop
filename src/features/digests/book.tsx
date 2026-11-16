import { type ReactNode, useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import type { DigestBook } from "@/platform/bindings"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { RefreshButton } from "@/ui/RefreshButton"
import { digestMessages } from "./messages"
import { scheduleMessages } from "./messages-schedule"
import type { Can } from "./ScheduleCard"
import { useDigestBook } from "./schedule-store"

export type Ready = Extract<DigestBook, { state: "ready" }>

/** Reads the digests once when the tab opens, and keeps "Read again" beside it. */
export function useBook() {
  const { book, error, load } = useDigestBook()
  const [reading, setReading] = useState(false)
  const read = async () => {
    setReading(true)
    await load()
    setReading(false)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once when the tab opens
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

export type Book = ReturnType<typeof useBook>

export function ReadAgain({ view }: { view: Book }) {
  const m = useMessages(digestMessages)
  // While the page error shows, its Try again is the one retry.
  if (view.error && !view.book) return null
  return (
    <RefreshButton busy={view.reading} onClick={() => void view.read()} label={m.readAgain} busyLabel={m.reading} />
  )
}

/** What both tabs show before the digests are read: the error, the loading shape, or the Memo it needs. */
export function BookGate({
  view,
  loading,
  children,
}: {
  view: Book
  loading: ReactNode
  children: (book: Ready) => ReactNode
}) {
  const s = useMessages(scheduleMessages)
  const { book, error, reading, read } = view
  if (error && !book)
    return (
      <PageError raw={error} what="Reading digests" busy={reading} onRetry={() => void read()}>
        {s.readFailed}
      </PageError>
    )
  if (book === null) return loading
  if (book.state === "noMemo") return <ToolNeeded gap={{ kind: "missing", tool: "memo", others: [] }} />
  if (book.state === "old")
    return <ToolNeeded gap={{ kind: "old", tool: "memo", version: book.version, need: book.need }} />
  return children(book)
}
