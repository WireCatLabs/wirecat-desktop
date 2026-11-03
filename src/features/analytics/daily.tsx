import { addDays, bucketDays, meetingStats, meetingWeekdays, PERIOD_DAYS } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatDate, formatList, formatNumber, useLang, useMessages } from "@/i18n"
import { MeetingsListSchema, ResponsesSchema, TaskSourcesSchema, WaitingSchema } from "@/platform/analytics-schemas"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { ColumnChart, RankBars, Stat } from "./charts"
import { analyticsMessages } from "./messages"
import { duration, readParts } from "./reads"
import { Panel } from "./sections"
import { type AggState, useAggregate, useAnalytics } from "./store"

const toolName = (id: string) => findTool(id)?.name ?? id

function Missing({ old, failed }: { old: string[]; failed: string[] }) {
  const m = useMessages(analyticsMessages)
  return (
    <p className="text-[0.9rem] text-ink-soft">
      {old.length ? m.needsUpdate(formatList(old.map(toolName))) : m.countFailed(failed[0] ?? "")}
    </p>
  )
}

const CardSkeleton = ({ label }: { label: string }) => (
  <Skeleton className="h-[8.5rem] w-full rounded-[0.2rem]" label={label} />
)

export function ReplyTime() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const states: [string, AggState][] = [
    ["tg", useAggregate("responses", "tg")],
    ["max", useAggregate("responses", "max")],
    ["wa", useAggregate("responses", "wa")],
  ]
  const live = states.filter(([, s]) => s.state !== "missing")
  const r = readParts(live, ResponsesSchema)
  return (
    <Panel id="an-reply" title={m.replyTitle} source="stats messages responses --who me">
      {r.loading && !r.ready.length ? (
        <CardSkeleton label={m.replyTitle} />
      ) : !r.ready.length ? (
        live.length ? (
          <Missing old={r.old} failed={r.failed} />
        ) : (
          <p className="text-[0.9rem] text-ink-soft">{m.noMessengers}</p>
        )
      ) : (
        <div className="reveal flex flex-col gap-3">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.ready.map((p) => (
              <li key={`${p.id}/${p.profile}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-[0.95rem]">
                  {toolName(p.id)}
                  {p.profile && <span className="ml-2 font-mono text-[0.85rem] text-ink-dim">{p.profile}</span>}
                </span>
                <span className="flex gap-4 text-[0.95rem]">
                  <span>
                    <span className="text-ink-dim">{m.replyMedian} </span>
                    <strong className="font-semibold">
                      {p.body.median_ms === null ? "—" : duration(p.body.median_ms, m, lang)}
                    </strong>
                  </span>
                  <span>
                    <span className="text-ink-dim">{m.replyP90} </span>
                    <strong className="font-semibold">
                      {p.body.p90_ms === null ? "—" : duration(p.body.p90_ms, m, lang)}
                    </strong>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[0.85rem] text-ink-dim">{m.replyNote}</p>
          {r.old.length > 0 && <Missing old={r.old} failed={[]} />}
        </div>
      )}
    </Panel>
  )
}

export function WaitingOnYou() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const states: [string, AggState][] = [
    ["tg", useAggregate("waiting", "tg")],
    ["max", useAggregate("waiting", "max")],
    ["wa", useAggregate("waiting", "wa")],
  ]
  const live = states.filter(([, s]) => s.state !== "missing")
  const r = readParts(live, WaitingSchema)
  const chats = r.ready.reduce((s, p) => s + p.body.chats, 0)
  const oldest = r.ready
    .map((p) => p.body.oldest_at)
    .filter((x): x is string => x !== null)
    .sort()[0]
  return (
    <Panel id="an-waiting" title={m.waitingTitle} source="stats messages waiting">
      {r.loading && !r.ready.length ? (
        <CardSkeleton label={m.waitingTitle} />
      ) : !r.ready.length ? (
        live.length ? (
          <Missing old={r.old} failed={r.failed} />
        ) : (
          <p className="text-[0.9rem] text-ink-soft">{m.noMessengers}</p>
        )
      ) : (
        <div className="reveal flex flex-col gap-2">
          <dl className="m-0">
            <Stat
              label={m.waitingNote}
              value={m.waitingChats(chats)}
              note={oldest ? m.oldestWait(formatDate(oldest, { day: "numeric", month: "long" }, lang)) : undefined}
            />
          </dl>
          {r.old.length > 0 && <Missing old={r.old} failed={[]} />}
        </div>
      )}
    </Panel>
  )
}

export function Meetings() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const state = useAggregate("meetings", "zm")
  const r = readParts([["zm", state]], MeetingsListSchema)
  const stats = meetingStats(
    r.ready.flatMap((p) => p.body.items),
    period,
    today,
    zone,
  )
  const weeks = Math.max(1, (PERIOD_DAYS[period] ?? Math.max(7, stats.rows.length)) / 7)
  const perWeek = stats.minutes / 60 / weeks
  const buckets = bucketDays({ meetings: stats.rows }, period, today, "week")
  const hoursFmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
  return (
    <>
      <Panel id="an-meetings" title={m.meetingsTitle} source="zm meetings list">
        {state.state === "missing" ? (
          <p className="text-[0.9rem] text-ink-soft">{m.needsUpdate("Zoom")}</p>
        ) : r.loading ? (
          <CardSkeleton label={m.meetingsTitle} />
        ) : !r.ready.length ? (
          <Missing old={r.old} failed={r.failed} />
        ) : stats.count === 0 ? (
          <p className="text-[0.9rem] text-ink-soft">{m.noMeetings}</p>
        ) : (
          <div className="reveal flex flex-col gap-4">
            <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-[1.2rem] gap-y-4">
              <Stat label={m.meetingsCount} value={formatNumber(stats.count)} note={m.period[period]} />
              <Stat
                label={m.meetingHours}
                value={m.hours(hoursFmt.format(perWeek))}
                note={m.ofWeek(Math.round((perWeek / 40) * 100))}
              />
              {stats.meanMinutes !== null && <Stat label={m.meanLength} value={m.minutes(stats.meanMinutes)} />}
            </dl>
            <ColumnChart
              title={m.meetingsPerWeek}
              buckets={buckets}
              series={[{ id: "meetings", label: m.meetingsPerWeek, color: "var(--series-6)" }]}
              short={(k) =>
                formatDate(new Date(`${k}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" }, lang)
              }
              long={(k) =>
                m.weekOf(
                  formatDate(new Date(`${k}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" }, lang),
                )
              }
              unit={(n) => `${formatNumber(n)} · ${m.meetingsCount}`}
            />
          </div>
        )}
      </Panel>
      <Panel id="an-series" title={m.seriesTitle} source="zm meetings list">
        {r.loading ? (
          <CardSkeleton label={m.seriesTitle} />
        ) : stats.series.length === 0 ? (
          <p className="text-[0.9rem] text-ink-soft">{m.noMeetings}</p>
        ) : (
          <div className="reveal flex flex-col gap-3">
            <RankBars
              label={m.seriesTitle}
              unit={(n) => m.minutes(n)}
              rows={stats.series.map((s) => ({
                id: s.title,
                title: `${s.title} · ${s.count}`,
                label: s.title,
                detail: <span className="shrink-0 font-mono text-[0.85rem] text-ink-dim">×{s.count}</span>,
                value: s.minutes,
                color: "var(--series-6)",
              }))}
            />
            <p className="text-[0.85rem] text-ink-dim">{m.seriesNote}</p>
          </div>
        )}
      </Panel>
    </>
  )
}

export function TaskSources() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const hide = useAnalytics((s) => s.hideNames)
  const state = useAggregate("taskSources", "memo")
  const r = readParts([["memo", state]], TaskSourcesSchema)
  const rows = r.ready
    .flatMap((p) => p.body.items.flatMap((i) => i.rows))
    .filter((x) => x.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, 8)
  const label = (row: (typeof rows)[number]) =>
    hide || !row.name ? row.chat.replace(/^(chat|meeting):([a-z]+)\/.*$/, "$2") : row.name
  return (
    <Panel id="an-sources" title={m.taskSourcesTitle} source="stats tasks show">
      {state.state === "missing" ? (
        <p className="text-[0.9rem] text-ink-soft">{m.tasksMissing}</p>
      ) : r.loading ? (
        <CardSkeleton label={m.taskSourcesTitle} />
      ) : !r.ready.length ? (
        <Missing old={r.old} failed={r.failed} />
      ) : rows.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noTaskSources}</p>
      ) : (
        <div className="reveal flex flex-col gap-3">
          <table className="w-full text-[0.95rem]">
            <caption className="sr-only">{m.taskSourcesTitle}</caption>
            <thead className="text-[0.875rem] text-ink-dim">
              <tr>
                <th scope="col" className="pb-2 text-left font-medium">
                  {m.fromCol}
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">
                  {m.open}
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">
                  {m.oldestOpen}
                </th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">
                  {m.medianClose}
                </th>
              </tr>
            </thead>
            <tbody className="selectable">
              {rows.map((row) => (
                <tr key={row.chat} className="border-line border-t">
                  <th scope="row" className={cx("max-w-[14rem] truncate py-[0.45rem] text-left font-normal")}>
                    {label(row)}
                  </th>
                  <td className="py-[0.45rem] pl-3 text-right font-mono tabular-nums">{formatNumber(row.open)}</td>
                  <td className="py-[0.45rem] pl-3 text-right text-ink-soft">
                    {row.oldest_open_at ? duration(Date.now() - Date.parse(row.oldest_open_at), m, lang) : "—"}
                  </td>
                  <td className="py-[0.45rem] pl-3 text-right text-ink-soft">
                    {row.median_close_ms === null ? "—" : duration(row.median_close_ms, m, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[0.85rem] text-ink-dim">{m.taskSourcesNote}</p>
        </div>
      )}
    </Panel>
  )
}

/** Meeting minutes per weekday, split by the titles that take the most time. From `zm meetings list`. */
export function MeetingDays() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const state = useAggregate("meetings", "zm")
  const r = readParts([["zm", state]], MeetingsListSchema)
  const { buckets, series } = meetingWeekdays(
    r.ready.flatMap((p) => p.body.items),
    period,
    today,
    zone,
  )
  const day = (k: string) =>
    formatDate(new Date(`${addDays("2026-11-02", Number(k))}T12:00:00Z`), { weekday: "short", timeZone: "UTC" }, lang)
  const longDay = (k: string) =>
    formatDate(new Date(`${addDays("2026-11-02", Number(k))}T12:00:00Z`), { weekday: "long", timeZone: "UTC" }, lang)
  const slots = ["var(--series-6)", "var(--series-1)", "var(--series-2)", "var(--series-5)"]
  return (
    <Panel id="an-meeting-days" title={m.meetingDaysTitle} source="zm meetings list">
      {state.state === "missing" ? (
        <p className="text-[0.9rem] text-ink-soft">{m.needsUpdate("Zoom")}</p>
      ) : r.loading ? (
        <CardSkeleton label={m.meetingDaysTitle} />
      ) : !r.ready.length ? (
        <Missing old={r.old} failed={r.failed} />
      ) : buckets.every((b) => b.total === 0) ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noMeetings}</p>
      ) : (
        <div className="reveal flex flex-col gap-2">
          <ColumnChart
            title={m.meetingDaysTitle}
            buckets={buckets}
            series={series.map((t, i) => ({
              id: t,
              label: t === "other" ? m.otherSeries : t,
              color: t === "other" ? "var(--series-other)" : (slots[i] ?? "var(--series-other)"),
            }))}
            short={day}
            long={longDay}
            unit={(n) => m.minutes(n)}
          />
          <p className="text-[0.85rem] text-ink-dim">{m.meetingDaysNote}</p>
        </div>
      )}
    </Panel>
  )
}
