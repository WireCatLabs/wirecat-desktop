import type { ReactNode } from "react"
import * as v from "valibot"
import { bucketDays, meetingStats, PERIOD_DAYS, todayAndWeek } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatDate, formatList, formatNumber, useLang, useMessages } from "@/i18n"
import {
  type Aggregate,
  MailSchema,
  MeetingsListSchema,
  ResponsesSchema,
  TaskSourcesSchema,
  WaitingSchema,
} from "@/platform/analytics-schemas"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { ColumnChart, RankBars, Stat } from "./charts"
import { analyticsMessages } from "./messages"
import { Panel } from "./sections"
import { type AggState, useAggregate, useAnalytics, useExtra } from "./store"

type M = typeof analyticsMessages.en

const toolName = (id: string) => findTool(id)?.name ?? id

/** A span of time as people say it: minutes under an hour, hours under two days, then days. */
export function duration(ms: number, m: M, lang: string): string {
  const min = ms / 60_000
  if (min < 60) return m.minutes(Math.max(1, Math.round(min)))
  const h = min / 60
  if (h < 48) return m.hours(new Intl.NumberFormat(lang, { maximumFractionDigits: h < 10 ? 1 : 0 }).format(h))
  return m.days(Math.round(h / 24))
}

/** Each profile's parsed answer; `old` lists the tools still too old for the command. */
function readParts<T>(states: [string, AggState][], schema: v.GenericSchema<unknown, T>) {
  const ready: { id: string; profile: string | null; body: T }[] = []
  const old: string[] = []
  const failed: string[] = []
  let loading = false
  for (const [id, s] of states) {
    if (s.state === "loading") loading = true
    if (s.state !== "ready") continue
    for (const p of s.parts) {
      const a: Aggregate = p.answer
      if (a.kind === "old") old.push(id)
      else if (a.kind === "failed") failed.push(a.message)
      else {
        const parsed = v.safeParse(schema, a.body)
        if (parsed.success) ready.push({ id, profile: p.profile, body: parsed.output })
        else failed.push(parsed.issues[0]?.message ?? "")
      }
    }
  }
  return { ready, old: [...new Set(old)], failed, loading }
}

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

export function Load() {
  const m = useMessages(analyticsMessages)
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const period = useAnalytics((s) => s.period)
  const days = useExtra({ by: "day", only: "all", previous: false })
  const mail = useAggregate("mail", "memo")
  const meetings = useAggregate("meetings", "zm")
  const msgs = todayAndWeek(Object.values(days.bySource).flat(), today)
  const mailParts = readParts([["memo", mail]], MailSchema)
  const meetParts = readParts([["zm", meetings]], MeetingsListSchema)
  const mails = todayAndWeek(
    mailParts.ready.flatMap((p) => p.body.rows.map((r) => ({ key: r.key, count: r.received }))),
    today,
  )
  const meet = meetingStats(
    meetParts.ready.flatMap((p) => p.body.items),
    period === "7d" ? "7d" : "30d",
    today,
    zone,
  )
  const meetLoad = todayAndWeek(meet.rows, today)
  const cell = (ready: boolean, loading: boolean, state: AggState | null, value: number, old: string[]) =>
    ready ? (
      formatNumber(value)
    ) : loading || state?.state === "loading" ? (
      <Skeleton chars={3} />
    ) : state?.state === "missing" ? (
      "—"
    ) : (
      <span className="text-[0.85rem] font-normal text-ink-dim">
        {old.length ? m.needsUpdate(formatList(old.map(toolName))) : "—"}
      </span>
    )
  const rows: [string, ReactNode, ReactNode][] = [
    [
      m.rowMessages,
      cell(!days.loading, days.loading, null, msgs.today, []),
      cell(!days.loading, days.loading, null, msgs.week, []),
    ],
    [
      m.rowEmails,
      cell(mailParts.ready.length > 0, false, mail, mails.today, mailParts.old),
      cell(mailParts.ready.length > 0, false, mail, mails.week, mailParts.old),
    ],
    [
      m.rowMeetings,
      cell(meetParts.ready.length > 0, false, meetings, meetLoad.today, meetParts.old),
      cell(meetParts.ready.length > 0, false, meetings, meetLoad.week, meetParts.old),
    ],
  ]
  return (
    <Panel id="an-load" title={m.loadTitle} source="stats messages show · stats mail show · meetings list">
      <table className="w-full text-[0.95rem]">
        <caption className="sr-only">{m.loadTitle}</caption>
        <thead className="text-[0.875rem] text-ink-dim">
          <tr>
            <th scope="col" className="pb-2 text-left font-medium">
              <span className="sr-only">{m.when}</span>
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {m.todayCol}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {m.weekCol}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-line border-t">
              <th scope="row" className="py-[0.5rem] text-left font-normal">
                {label}
              </th>
              <td className="py-[0.5rem] pl-3 text-right text-[1.2rem] font-semibold">{a}</td>
              <td className="py-[0.5rem] pl-3 text-right text-[1.2rem] font-semibold">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export function OpenTasks() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const tasks = useAnalytics((s) => s.tasks)
  const sources = useAggregate("taskSources", "memo")
  const r = readParts([["memo", sources]], TaskSourcesSchema)
  const oldest = r.ready
    .flatMap((p) => p.body.items.flatMap((i) => i.rows.map((row) => row.oldest_open_at)))
    .filter((x): x is string => x !== null)
    .sort()[0]
  return (
    <Panel id="an-open" title={m.tasksNowTitle} source="tasks counts · stats tasks show">
      {tasks.state === "missing" ? (
        <p className="text-[0.9rem] text-ink-soft">{m.tasksMissing}</p>
      ) : tasks.state !== "ready" ? (
        <CardSkeleton label={m.tasksNowTitle} />
      ) : (
        <dl className="reveal m-0 grid grid-cols-2 gap-x-[1.2rem] gap-y-4">
          <Stat label={m.openNow} value={formatNumber(tasks.data.open.total)} />
          <Stat
            label={m.overdueNow}
            value={
              <span className={tasks.data.overdue.total > 0 ? "text-warn-ink" : undefined}>
                {formatNumber(tasks.data.overdue.total)}
              </span>
            }
          />
          <Stat
            label={m.dueToday}
            value={formatNumber(tasks.data.open.due.find((d) => d.value === "today")?.count ?? 0)}
          />
          <Stat label={m.oldestOpen} value={oldest ? duration(Date.now() - Date.parse(oldest), m, lang) : "—"} />
        </dl>
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
