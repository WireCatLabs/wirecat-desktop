import { ArrowLeft, CalendarCheck, CalendarX, LoaderCircle, Play, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { dayTitle } from "@/domain/digest"
import { formatUsd } from "@/domain/mail-agent"
import { useLang, useMessages } from "@/i18n"
import type { DigestItem, SendTo } from "@/platform/bindings"
import { useDigestDay } from "@/shared/digest-day"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { SplitButton } from "@/ui/SplitButton"
import { BriefCard } from "./BriefCard"
import { nextOf, titleOf } from "./DigestTable"
import { FillHistory } from "./FillHistory"
import { digestMessages } from "./messages"
import { bookMessages } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { ReportView } from "./ReportView"
import { type Can, parsedRoute, routeLabel, ScheduleCard } from "./ScheduleCard"
import { MORNING, useDigestBook } from "./schedule-store"
import { useDigests } from "./store"
import { TemplatesCard } from "./TemplatesCard"

/** One digest: what it is and its two actions on top, its settings on the left, what it wrote on the right. */
export function DigestView({ item, can, harness }: { item: DigestItem; can: Can; harness: boolean }) {
  const m = useMessages(bookMessages)
  const lang = useLang()
  const title = titleOf(item, m)
  const { busy, failed, openDigest } = useDigestBook()
  const working = busy[item.name]
  const name = item.name === MORNING ? undefined : item.name

  return (
    <div className="flex flex-col gap-[1.2rem]">
      <div className="flex flex-col gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDigest(null)}
            icon={<ArrowLeft className="size-4" aria-hidden />}
          >
            {m.one.back}
          </Button>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="text-[1.45rem] font-semibold leading-tight text-ink">{title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.95rem] text-ink-soft">
              <Lamp tone={item.scheduled ? "ok" : "idle"} size="sm" />
              <span>{item.scheduled ? m.when(item.times, item.weekdays) : m.notScheduled}</span>
              {item.scheduled && item.nextAt && (
                <span className="text-ink-dim">· {m.one.nextRun(nextOf(item.nextAt, lang))}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GetNow item={item} can={can} harness={harness} />
            <ScheduleButton item={item} harness={harness} />
            <FillHistory name={item.name} />
            {can.named && <RemoveButton item={item} title={title} />}
          </div>
        </div>
        {working === "run" && (
          <p className="flex items-center gap-2 text-[0.92rem] text-ink-soft" aria-live="polite">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> {m.one.running}
          </p>
        )}
        {failed?.name === item.name && failed.what !== "save" && (
          <ErrorNotice inline>
            {failed.what === "run"
              ? m.one.failedRun(failed.message)
              : failed.what === "remove"
                ? m.one.failedRemove(failed.message)
                : m.one.failedSchedule(failed.message)}
          </ErrorNotice>
        )}
      </div>

      <div className="grid items-start gap-[1.5rem] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[1.2rem]">
          <ScheduleCard item={item} title={title} can={can} harness={harness} />
          <BriefCard name={name} />
          <TemplatesCard name={name} />
        </div>
        <Days name={item.name} />
      </div>
    </div>
  )
}

/** "Get now": the main action sends it as the schedule does; the menu keeps it here, or sends to one route. */
function GetNow({ item, can, harness }: { item: DigestItem; can: Can; harness: boolean }) {
  const m = useMessages(bookMessages)
  const s = useMessages(scheduleMessages)
  const lang = useLang()
  const { busy, run } = useDigestBook()
  const [asked, setAsked] = useState<SendTo | null>(null)
  const label = (route: string) => {
    const p = parsedRoute(route)
    return p ? routeLabel(p, s) : route
  }
  const all = item.routes.map((r) => label(r.value)).join(", ")
  const price = item.last?.costUsd != null ? formatUsd(item.last.costUsd, lang) : null
  const items = can.named
    ? [
        { label: m.one.onlyHere, onSelect: () => setAsked({ kind: "here" }) },
        ...(item.routes.length > 1
          ? item.routes.map((r) => ({
              label: m.one.onlyTo(label(r.value)),
              onSelect: () => setAsked({ kind: "only", routes: [r.value] }),
            }))
          : []),
      ]
    : []
  const body =
    asked?.kind === "here"
      ? m.one.confirmHere
      : asked?.kind === "only"
        ? m.one.confirmOnly(m.one.to(asked.routes.map(label).join(", ")))
        : m.one.confirmAll(m.one.to(all))

  return (
    <>
      <span title={m.one.getNowHint} className="inline-flex">
        <SplitButton
          main={{
            label: m.one.getNow,
            onClick: () => setAsked({ kind: "all" }),
            icon: <Play className="size-4" aria-hidden />,
          }}
          items={items}
          menuLabel={m.one.getNowMenu}
          moreLabel={m.one.more}
          disabled={busy[item.name] !== undefined || !harness}
        />
      </span>
      <Dialog
        open={asked !== null}
        title={m.one.confirmTitle}
        onClose={() => setAsked(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAsked(null)}>
              {m.form.cancel}
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                const to = asked
                setAsked(null)
                if (to) void run(item.name, to)
              }}
            >
              {m.one.run(price)}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-ink-soft">
          <p>{m.one.confirmPrice(price)}</p>
          <p>{body}</p>
        </div>
      </Dialog>
    </>
  )
}

function ScheduleButton({ item, harness }: { item: DigestItem; harness: boolean }) {
  const m = useMessages(bookMessages)
  const { busy, setScheduled } = useDigestBook()
  const on = item.scheduled
  return (
    <Button
      variant="secondary"
      disabled={busy[item.name] !== undefined || (!on && !harness)}
      onClick={() => void setScheduled(item, !on)}
      icon={
        busy[item.name] === "schedule" ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : on ? (
          <CalendarX className="size-4" aria-hidden />
        ) : (
          <CalendarCheck className="size-4" aria-hidden />
        )
      }
    >
      {on ? m.one.takeOff : m.one.putOn}
    </Button>
  )
}

function RemoveButton({ item, title }: { item: DigestItem; title: string }) {
  const all = useMessages(bookMessages)
  const m = all.one
  const { busy, remove } = useDigestBook()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        aria-label={m.remove}
        title={m.remove}
        disabled={busy[item.name] !== undefined}
        onClick={() => setAsking(true)}
        icon={<Trash2 className="size-4" aria-hidden />}
      />
      <Dialog
        open={asking}
        title={m.removeTitle(title)}
        onClose={() => setAsking(false)}
        actions={
          <>
            <Button variant="ghost" data-autofocus onClick={() => setAsking(false)}>
              {all.form.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setAsking(false)
                void remove(item.name)
              }}
            >
              {m.removeConfirm}
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">{m.removeBody}</p>
      </Dialog>
    </>
  )
}

/** The latest report beside the list of past days; a link to a day opens it here. */
function Days({ name }: { name: string }) {
  const m = useMessages(digestMessages)
  const one = useMessages(bookMessages).one
  const later = useMessages(scheduleMessages).history.builtLater
  const lang = useLang()
  const { days, error, load } = useDigests()
  const shownName = useDigests((s) => s.name ?? MORNING)
  const chosen = useDigestDay((s) => s.date)

  useEffect(() => {
    void load(name)
  }, [load, name])
  // A link or a notification can name a day newer than the list read before it.
  useEffect(() => {
    const known = useDigests.getState().days
    if (chosen && known && !known.some((d) => d.date === chosen)) void useDigests.getState().load()
  }, [chosen])

  const mine = shownName === name ? days : null
  const date = mine?.some((d) => d.date === chosen) ? chosen : (mine?.[0]?.date ?? null)

  if (error)
    return (
      <ErrorNotice action={<ReportThis what="Reading digests" error={error} />}>
        {m.readFailed} {error}
      </ErrorNotice>
    )
  if (mine === null) return <Skeleton className="h-[24rem] w-full" label={m.reading} />
  if (mine.length === 0)
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
        <p className="font-medium text-ink">{m.emptyTitle}</p>
        <p className="mt-1 max-w-[70ch]">{m.emptyBody}</p>
      </div>
    )
  return (
    <section aria-label={one.latest} className="flex min-w-0 flex-col gap-[1rem]">
      {date && <Day date={date} />}
      <nav aria-label={m.days} className="flex flex-col gap-[0.2rem] border-line border-t pt-3">
        {mine.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-current={d.date === date ? "page" : undefined}
            onClick={() => useDigestDay.setState({ date: d.date })}
            className={cx(
              "flex cursor-pointer items-baseline gap-3 rounded-[0.3rem] px-[0.7rem] py-[0.45rem] text-left transition-colors hover:bg-app-3",
              d.date === date && "bg-app-3",
            )}
          >
            <span className="w-[9rem] shrink-0 font-medium text-ink first-letter:uppercase">
              {dayTitle(d.date, lang)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink-dim">
              {d.backfill && <span className="italic">{later} · </span>}
              {d.summary}
            </span>
          </button>
        ))}
      </nav>
    </section>
  )
}

function Day({ date }: { date: string }) {
  const m = useMessages(digestMessages)
  const shown = useDigests((s) => s.shown[date])
  const [now] = useState(() => Date.now())
  useEffect(() => {
    void useDigests.getState().show(date)
  }, [date])

  const box = "min-w-0 rounded-[0.2rem] border border-line-strong bg-app px-[1.4rem] py-[1.3rem]"
  if (!shown || shown.state === "loading") return <Skeleton className={cx(box, "h-[24rem]")} label={m.reading} />
  if (shown.state === "failed")
    return (
      <ErrorNotice action={<ReportThis what="Reading a digest" error={shown.error} />}>
        {m.dayFailed} {shown.error}
      </ErrorNotice>
    )
  return (
    <div className={box}>
      {shown.state === "report" ? (
        <ReportView report={shown.report} now={now} />
      ) : (
        <>
          <p className="text-[0.88rem] text-ink-dim">{m.textRun}</p>
          <pre className="mt-3 font-sans text-[0.95rem] whitespace-pre-wrap text-ink-soft">{shown.text}</pre>
        </>
      )}
    </div>
  )
}
