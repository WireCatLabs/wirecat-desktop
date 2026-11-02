import { ArrowDown, ArrowUp } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import * as v from "valibot"
import { addDays, meetingStats, weekOf } from "@/domain/analytics"
import { formatList, formatNumber, useLang, useMessages } from "@/i18n"
import { MailSchema, MeetingsListSchema, WaitingSchema } from "@/platform/analytics-schemas"
import { platform } from "@/platform/bridge"
import { Skeleton } from "@/ui/Skeleton"
import { analyticsMessages } from "./messages"
import { useAggregate, useAnalytics, useExtra } from "./store"

/** This week so far (Monday to today) and the same days of last week. */
export function sameDays(rows: readonly { key: string; count: number }[], today: string) {
  const monday = weekOf(today)
  const before = [addDays(monday, -7), addDays(today, -7)] as const
  let now = 0
  let last = 0
  for (const r of rows) {
    if (r.key >= monday && r.key <= today) now += r.count
    if (r.key >= before[0] && r.key <= before[1]) last += r.count
  }
  return { now, last }
}

const minus = (a: { key: string; count: number }[], b: { key: string; count: number }[]) => {
  const sent = new Map<string, number>()
  for (const r of b) sent.set(r.key, (sent.get(r.key) ?? 0) + r.count)
  const all = new Map<string, number>()
  for (const r of a) all.set(r.key, (all.get(r.key) ?? 0) + r.count)
  return [...all].map(([key, count]) => ({ key, count: Math.max(0, count - (sent.get(key) ?? 0)) }))
}

function ready<T>(state: ReturnType<typeof useAggregate>, schema: v.GenericSchema<unknown, T>) {
  if (state.state !== "ready") return { bodies: [] as T[], old: false, loading: state.state === "loading" }
  const bodies: T[] = []
  let old = false
  for (const p of state.parts) {
    if (p.answer.kind === "old") old = true
    if (p.answer.kind !== "ready") continue
    const parsed = v.safeParse(schema, p.answer.body)
    if (parsed.success) bodies.push(parsed.output)
  }
  return { bodies, old, loading: false }
}

/** Closed tasks this week and on the same days last week, from memo's own counts. */
function useClosedWeeks(today: string) {
  const [closed, setClosed] = useState<{ now: number; last: number } | null>(null)
  useEffect(() => {
    const monday = weekOf(today)
    const range = (from: string, to: string) => `state:(done OR dismissed) closed:[${from} TO ${to}]`
    void Promise.all([
      platform.taskCounts(range(monday, today)),
      platform.taskCounts(range(addDays(monday, -7), addDays(today, -7))),
    ])
      .then(([a, b]) => setClosed({ now: a.total, last: b.total }))
      .catch(() => setClosed(null))
  }, [today])
  return closed
}

function Tile({
  label,
  now,
  last,
  format,
  note,
}: {
  label: string
  now: number | null
  last: number | null
  format?: (n: number) => string
  note?: ReactNode
}) {
  const m = useMessages(analyticsMessages)
  const show = format ?? formatNumber
  const change = now !== null && last !== null && last > 0 ? Math.round(((now - last) / last) * 100) : null
  const Arrow = change === null || change === 0 ? null : change > 0 ? ArrowUp : ArrowDown
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[0.2rem] border border-line-strong bg-app px-[1.1rem] py-[0.9rem]">
      <span className="text-[0.9rem] text-ink-dim">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-[1.75rem] font-semibold leading-tight">
          {now === null ? <Skeleton chars={4} /> : show(now)}
        </span>
        {Arrow && (
          <span className="flex items-center gap-0.5 text-[0.9rem] text-ink-soft">
            <Arrow className="size-3.5" aria-hidden />
            {Math.abs(change ?? 0)}%
          </span>
        )}
      </span>
      <span className="text-[0.85rem] text-ink-dim">
        {note ??
          (now === null || last === null
            ? " "
            : last === 0
              ? m.noLastWeek
              : change === 0
                ? m.sameAsLastWeek
                : m.vsLastWeek(`${change && change > 0 ? "+" : "−"}${Math.abs(change ?? 0)}%`))}
      </span>
    </div>
  )
}

/** This week against the same days of last week: messages, emails, meeting hours, tasks. */
export function WeekTiles() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const preview = useAnalytics((s) => s.preview)
  const all = useExtra({ by: "day", only: "all", previous: false, period: "30d" })
  const sent = useExtra({ by: "day", only: "sent", previous: false, period: "30d" })
  const mail = ready(useAggregate("mail", "memo", true, "30d"), MailSchema)
  const meetings = ready(useAggregate("meetings", "zm", true, "30d"), MeetingsListSchema)
  const closed = useClosedWeeks(today)

  const received = sameDays(minus(Object.values(all.bySource).flat(), Object.values(sent.bySource).flat()), today)
  const emails = sameDays(
    mail.bodies.flatMap((b) => b.rows.map((r) => ({ key: r.key, count: r.received }))),
    today,
  )
  const minutes = sameDays(
    meetingStats(
      meetings.bodies.flatMap((b) => b.items),
      "30d",
      today,
      zone,
    ).minuteRows,
    today,
  )
  const made = preview?.taskWeeks.at(-1)?.created ?? null
  const hours = (n: number) => m.hours(new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n / 60))
  const busy = all.loading || sent.loading
  return (
    <section aria-label={m.weekTitle} className="grid grid-cols-1 gap-[1rem] sm:grid-cols-2 xl:grid-cols-4">
      <Tile label={m.weekReceived} now={busy ? null : received.now} last={busy ? null : received.last} />
      <Tile
        label={m.weekEmails}
        now={mail.loading ? null : mail.bodies.length ? emails.now : 0}
        last={mail.bodies.length ? emails.last : null}
        {...(!mail.loading && !mail.bodies.length ? { format: () => "—", note: m.needsUpdate("Memo") } : {})}
      />
      <Tile
        label={m.weekMeetingHours}
        now={meetings.loading ? null : minutes.now}
        last={meetings.loading ? null : minutes.last}
        format={hours}
      />
      <Tile
        label={m.weekTasks}
        now={closed?.now ?? null}
        last={closed?.last ?? null}
        format={(n) => `${made === null ? "—" : formatNumber(made)} · ${formatNumber(n)}`}
        {...(made === null && closed ? { note: m.madeLater } : {})}
      />
    </section>
  )
}

/** What needs the owner now, each a link to the card that explains it. */
export function Attention() {
  const m = useMessages(analyticsMessages)
  const preview = useAnalytics((s) => s.preview)
  const today = useAnalytics((s) => s.today)
  const waiting = [
    ready(useAggregate("waiting", "tg"), WaitingSchema),
    ready(useAggregate("waiting", "max"), WaitingSchema),
    ready(useAggregate("waiting", "wa"), WaitingSchema),
  ]
  const [old, setOld] = useState<number | null>(null)
  useEffect(() => {
    const cutoff = addDays(today, -14)
    void platform
      .taskList("")
      .then((r) =>
        setOld(
          r.kind === "ready"
            ? r.tasks.filter((t) => !["done", "dismissed"].includes(t.state) && t.createdAt.slice(0, 10) < cutoff)
                .length
            : null,
        ),
      )
      .catch(() => setOld(null))
  }, [today])
  const chats = waiting.flatMap((w) => w.bodies).reduce((s, b) => s + b.chats, 0)
  const anyWaiting = waiting.some((w) => w.bodies.length)
  const items: [string, string, ReactNode][] = [
    [
      "#an-waiting",
      m.waitingLink(anyWaiting ? m.waitingChats(chats) : "—"),
      anyWaiting ? null : m.needsUpdate(formatList(["Telegram", "MAX", "WhatsApp"])),
    ],
    ["#an-open", m.oldTasksLink(old === null ? "—" : formatNumber(old)), null],
    [
      "#an-meetings",
      m.tomorrowLink(preview ? formatNumber(preview.meetingsTomorrow) : "—"),
      preview ? null : m.needsUpdate("Zoom"),
    ],
  ]
  return (
    <section
      aria-label={m.attention}
      className="grid grid-cols-1 gap-[1rem] rounded-[0.2rem] border border-warn/40 bg-warn/10 px-[1.1rem] py-[0.9rem] md:grid-cols-3"
    >
      {items.map(([href, text, note]) => (
        <a key={href} href={href} className="flex flex-col gap-0.5 text-[1rem] font-medium text-ink hover:text-brand">
          {text}
          {note && <span className="text-[0.85rem] font-normal text-ink-soft">{note}</span>}
        </a>
      ))}
    </section>
  )
}
