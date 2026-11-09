import { LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { dayTitle } from "@/domain/digest"
import { useLang, useMessages } from "@/i18n"
import { useDigestDay } from "@/shared/digest-day"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { BriefCard } from "./BriefCard"
import { FillHistory } from "./FillHistory"
import { digestMessages } from "./messages"
import { scheduleMessages } from "./messages-schedule"
import { ReportView } from "./ReportView"
import { ScheduleCard } from "./ScheduleCard"
import { useDigests } from "./store"
import { TemplatesCard } from "./TemplatesCard"

export function DigestsPage() {
  const m = useMessages(digestMessages)
  const later = useMessages(scheduleMessages).history.builtLater
  const lang = useLang()
  const { days, error, reading, load } = useDigests()
  const chosen = useDigestDay((s) => s.date)

  useEffect(() => {
    void load()
  }, [load])
  // A link or a notification can name a day newer than the list read before it.
  useEffect(() => {
    const known = useDigests.getState().days
    if (chosen && known && !known.some((d) => d.date === chosen)) void useDigests.getState().load()
  }, [chosen])

  const date = days?.some((d) => d.date === chosen) ? chosen : (days?.[0]?.date ?? null)

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.page}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <FillHistory />
          <Button
            variant="ghost"
            size="sm"
            disabled={reading}
            onClick={() => void load()}
            icon={
              reading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )
            }
          >
            {reading && days ? m.reading : m.readAgain}
          </Button>
        </div>
      </div>

      <ScheduleCard />
      <div className="grid items-start gap-[1.5rem] xl:grid-cols-2">
        <BriefCard />
        <TemplatesCard />
      </div>

      {error ? (
        <ErrorNotice action={<ReportThis what="Reading digests" error={error} />}>
          {m.readFailed} {error}
        </ErrorNotice>
      ) : days === null ? (
        <Skeleton className="h-[16rem] w-full" label={m.reading} />
      ) : days.length === 0 ? (
        <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
          <p className="font-medium text-ink">{m.emptyTitle}</p>
          <p className="mt-1 max-w-[70ch]">{m.emptyBody}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] items-start gap-[1.5rem]">
          <nav aria-label={m.days} className="flex flex-col gap-[0.2rem]">
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                aria-current={d.date === date ? "page" : undefined}
                onClick={() => useDigestDay.setState({ date: d.date })}
                className={cx(
                  "cursor-pointer rounded-[0.3rem] px-[0.7rem] py-[0.5rem] text-left transition-colors hover:bg-app-3",
                  d.date === date && "bg-app-3",
                )}
              >
                <span className="block font-medium text-ink first-letter:uppercase">{dayTitle(d.date, lang)}</span>
                {d.backfill && <span className="mt-[0.1rem] block text-[0.8rem] text-ink-dim italic">{later}</span>}
                {d.summary && (
                  <span className="mt-[0.1rem] line-clamp-2 block text-[0.85rem] text-ink-dim">{d.summary}</span>
                )}
              </button>
            ))}
          </nav>
          {date && <Day date={date} />}
        </div>
      )}
    </div>
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
