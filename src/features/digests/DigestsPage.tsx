import { Settings2, TriangleAlert } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { dayTitle } from "@/domain/digest"
import { useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { DigestItem } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { revealTarget } from "@/ui/motion"
import { noticeBox } from "@/ui/notice"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { BookGate, ReadAgain, type Ready, useBook } from "./book"
import { titleOf } from "./DigestTable"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { ReportView } from "./ReportView"
import { DIGEST_SETTINGS, DIGESTS_SECTION, MORNING, readDigest, useDigestBook } from "./schedule-store"
import { useDigests } from "./store"

/**
 * The Digests tab: what each digest wrote, newest day first, and one day's report in full. A link, the bell or a
 * digest's settings open a digest here, on the day they name. Its settings are on the Settings tab.
 */
export function DigestsPage() {
  const m = useMessages(digestMessages)
  const view = useBook()
  return (
    <Page>
      <PageHeader title={m.page} section={DIGESTS_SECTION} intro={m.readIntro} actions={<ReadAgain view={view} />} />
      <BookGate view={view} loading={<Skeleton className="h-[24rem] w-full" label={m.reading} />}>
        {(book) =>
          book.digests.length === 0 ? (
            <NoDigests />
          ) : (
            <>
              <FailedDigests digests={book.digests} />
              <Reports book={book} />
            </>
          )
        }
      </BookGate>
    </Page>
  )
}

/**
 * The digests whose last run failed, above everything else, so a failure the owner heard about is the first thing on
 * the tab. Each opens that digest's newest day, the agent's words on what went wrong.
 */
function FailedDigests({ digests }: { digests: DigestItem[] }) {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const lang = useLang()
  const heading = useId()
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
            <Button size="sm" variant="secondary" onClick={() => readDigest(d.name)}>
              {m.openFailed(titleOf(d, b))}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NoDigests() {
  const m = useMessages(digestMessages)
  return (
    <EmptyState
      title={m.noDigestsTitle}
      action={
        <Button variant="primary" onClick={() => useNav.getState().go(DIGEST_SETTINGS)}>
          {m.setUp}
        </Button>
      }
    >
      {m.noDigestsBody}
    </EmptyState>
  )
}

function Reports({ book }: { book: Ready }) {
  const m = useMessages(digestMessages)
  const b = useMessages(bookMessages)
  const shown = useDigests((s) => s.name ?? MORNING)
  const openDigest = useDigestBook((s) => s.openDigest)
  const item = book.digests.find((d) => d.name === shown) ?? book.digests[0]
  const name = item?.name ?? MORNING

  // Read the days fresh when the tab opens; after that only when the digest shown is gone and another takes its place.
  const first = useRef(true)
  useEffect(() => {
    const loaded = useDigests.getState().name ?? MORNING
    if (first.current || loaded !== name) void useDigests.getState().load(name)
    first.current = false
  }, [name])

  const linked = useDigestDay((s) => s.digest)
  useEffect(() => {
    if (!linked) return
    useDigestDay.setState({ digest: null })
    const known = book.digests.some((d) => d.name === linked)
    if (known) void useDigests.getState().load(linked)
    const date = useDigestDay.getState().date
    revealTarget(() =>
      document.querySelector<HTMLElement>(
        !known ? "[data-digest-reports]" : date ? `[data-digest-report="${date}"]` : "[data-digest-report]",
      ),
    )
  }, [linked, book])

  if (!item) return null
  const title = titleOf(item, b)
  const pick = (to: string) => {
    useDigestDay.setState({ date: null })
    void useDigests.getState().load(to)
  }
  return (
    <section data-digest-reports aria-label={title} className="flex flex-col gap-[1rem]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {book.digests.length > 1 ? (
          <Select
            aria-label={m.which}
            value={item.name}
            onChange={pick}
            options={book.digests.map((d) => ({ value: d.name, label: titleOf(d, b) }))}
            className="min-w-[16rem]"
          />
        ) : (
          <h2 className="text-[1.2rem] font-semibold text-ink">{title}</h2>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={<Settings2 className="size-4" aria-hidden />}
          onClick={() => openDigest(item.name)}
          aria-label={m.settingsOf(title)}
        >
          {m.itsSettings}
        </Button>
      </div>
      <Days name={item.name} lastFailed={item.last !== null && !item.last.ok} />
    </section>
  )
}

/** The chosen day's report beside the list of every day; a link to a day opens it here. */
function Days({ name, lastFailed }: { name: string; lastFailed: boolean }) {
  const m = useMessages(digestMessages)
  const one = useMessages(bookMessages).one
  const later = useMessages(scheduleMessages).history.builtLater
  const lang = useLang()
  const { days, error } = useDigests(useShallow((s) => ({ days: s.days, error: s.error })))
  const shownName = useDigests((s) => s.name ?? MORNING)
  const chosen = useDigestDay((s) => s.date)

  // A link or a notification can name a day newer than the list read before it.
  useEffect(() => {
    const known = useDigests.getState().days
    if (chosen && known && !known.some((d) => d.date === chosen)) void useDigests.getState().load()
  }, [chosen])

  const mine = shownName === name ? days : null
  const date = mine?.some((d) => d.date === chosen) ? chosen : (mine?.[0]?.date ?? null)
  const list = useRef<HTMLElement>(null)
  // A day a link opened may sit far down the list: its own scroll brings it into view, the page stays put.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the day shown or the list changes
  useEffect(() => {
    const nav = list.current
    const day = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !day) return
    const box = nav.getBoundingClientRect()
    const at = day.getBoundingClientRect()
    if (at.top < box.top || at.bottom > box.bottom) nav.scrollTop += at.top - box.top - (box.height - at.height) / 2
  }, [date, mine])

  if (error)
    return (
      <ErrorNotice raw={error} action={<ReportThis what="Reading digests" error={error} />}>
        {m.readFailed}
      </ErrorNotice>
    )
  if (mine === null) return <Skeleton className="h-[24rem] w-full" label={m.reading} />
  if (mine.length === 0) return <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
  return (
    <div className="@container min-w-0">
      <section
        aria-label={one.latest}
        className="grid min-w-0 items-start gap-[1rem] @3xl:grid-cols-[minmax(0,1fr)_15rem]"
      >
        <div className="min-w-0">{date && <Day date={date} failed={lastFailed && date === mine[0]?.date} />}</div>
        {/* Its own scroll: picking an old day moves neither the page nor the list (rule 9). */}
        <nav
          ref={list}
          aria-label={m.days}
          className="flex max-h-[32rem] flex-col gap-[0.2rem] overflow-y-auto overscroll-contain border-line border-t pt-3 @3xl:sticky @3xl:top-4 @3xl:max-h-[calc(100vh-8rem)] @3xl:border-t-0 @3xl:border-l @3xl:pt-0 @3xl:pl-3"
        >
          {mine.map((d) => (
            <button
              key={d.date}
              type="button"
              aria-current={d.date === date ? "page" : undefined}
              onClick={() => useDigestDay.setState({ date: d.date })}
              className={cx(
                "flex shrink-0 cursor-pointer flex-wrap items-baseline gap-x-3 rounded-pill px-[0.7rem] py-[0.45rem] text-left transition-colors hover:bg-app-3 @3xl:flex-col",
                d.date === date && "bg-app-3",
              )}
            >
              <span className="w-[9rem] shrink-0 font-medium text-ink first-letter:uppercase @3xl:w-auto">
                {dayTitle(d.date, lang)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink-dim @3xl:w-full @3xl:flex-none">
                {d.backfill && <span className="italic">{later} · </span>}
                {d.summary}
              </span>
            </button>
          ))}
        </nav>
      </section>
    </div>
  )
}

/** `failed`: the newest day of a digest whose last run failed; its text is the agent's account of why, not a digest. */
function Day({ date, failed }: { date: string; failed: boolean }) {
  const m = useMessages(digestMessages)
  const shown = useDigests((s) => s.shown[date])
  const [now] = useState(() => Date.now())
  useEffect(() => {
    void useDigests.getState().show(date)
  }, [date])

  const box = "min-w-0 rounded-rack border border-line-strong bg-app px-[1.4rem] py-[1.3rem]"
  if (!shown || shown.state === "loading") return <Skeleton className={cx(box, "h-[24rem]")} label={m.reading} />
  if (shown.state === "failed")
    return (
      <ErrorNotice raw={shown.error} action={<ReportThis what="Reading a digest" error={shown.error} />}>
        {m.dayFailed}
      </ErrorNotice>
    )
  return (
    <div data-digest-report={date} className={box}>
      {shown.state === "report" ? (
        <ReportView report={shown.report} now={now} />
      ) : (
        <>
          <p className={cx("text-[0.88rem]", failed ? "font-medium text-bad" : "text-ink-dim")}>
            {failed ? m.failedRun : m.textRun}
          </p>
          <pre className="mt-3 font-sans text-[0.95rem] whitespace-pre-wrap text-ink-soft">{shown.text}</pre>
        </>
      )}
    </div>
  )
}
