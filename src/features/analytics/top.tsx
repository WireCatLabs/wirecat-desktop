import { ArrowDown, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import * as v from "valibot"
import { addDays, meetingStats, todayIn, weekOf } from "@/domain/analytics"
import { formatDate, formatNumber, useLang, useMessages } from "@/i18n"
import { MailSchema, MeetingsListSchema } from "@/platform/analytics-schemas"
import { Skeleton } from "@/ui/Skeleton"
import { useTaskWeeks } from "./api"
import { analyticsMessages } from "./messages"
import { problemMessages } from "./messages-problems"
import { useAggregate, useAnalytics, useExtra } from "./store"

/** This week so far (Monday to today) and the same days of last week. */
function sameDays(rows: readonly { key: string; count: number }[], today: string) {
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
            ? "\u00a0"
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
  const p = useMessages(problemMessages)
  const lang = useLang()
  const today = useAnalytics((s) => s.today)
  const zone = useAnalytics((s) => s.zone)
  const syncs = useAnalytics((s) => s.syncs)
  const all = useExtra({ by: "day", only: "all", previous: false, period: "30d" })
  const sent = useExtra({ by: "day", only: "sent", previous: false, period: "30d" })
  const mail = ready(useAggregate("mail", "email", true, "30d"), MailSchema)
  const meetings = ready(useAggregate("meetings", "zm", true, "30d"), MeetingsListSchema)
  const tasks = useTaskWeeks(today, zone)

  const received = sameDays(minus(Object.values(all.bySource).flat(), Object.values(sent.bySource).flat()), today)
  const emails = sameDays(
    mail.bodies.flatMap((b) => b.rows.map((r) => ({ key: r.key, count: r.received }))),
    today,
  )
  const stats = meetingStats(
    meetings.bodies.flatMap((b) => b.items),
    "30d",
    today,
    zone,
  )
  const minutes = sameDays(stats.minuteRows, today)
  const untimed = sameDays(stats.untimedRows, today)
  const now = new Date().toISOString()
  // A sync zm did not record (an agent's, or one run by hand) still leaves its meetings: the newest one counts too.
  const zoomAt =
    syncs.state === "ready"
      ? [
          ...syncs.data.flatMap((s) => (s.id === "zm" && s.at ? [s.at] : [])),
          ...meetings.bodies.flatMap((b) =>
            b.items.flatMap((i) => (i.started_at && i.started_at <= now ? [i.started_at] : [])),
          ),
        ]
          .sort()
          .at(-1)
      : null
  // Zoom loaded before this week began: the store cannot know about this week's meetings, so 0 would be a claim.
  const zoomDay = zoomAt ? todayIn(zone, new Date(zoomAt)) : null
  const zoomBehind = zoomDay !== null && zoomDay < weekOf(today) && minutes.now === 0
  // Last week's same days end a week before today; a load before that may have missed some of them.
  const lastUnknown = zoomDay !== null && zoomDay < addDays(today, -7)
  const zoomNote = zoomBehind
    ? m.meetingsBehind(formatDate(zoomAt ?? 0, { day: "numeric", month: "long" }, lang))
    : minutes.last === 0 && untimed.last > 0
      ? m.meetingsUntimed(untimed.last)
      : null
  const weeks = typeof tasks === "string" ? null : tasks
  const made = weeks?.now.created ?? null
  const hours = (n: number) => m.hours(new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n / 60))
  const busy = all.loading || sent.loading
  return (
    <section aria-label={m.weekTitle} className="grid grid-cols-1 gap-[1rem] sm:grid-cols-2 xl:grid-cols-4">
      <Tile label={m.weekReceived} now={busy ? null : received.now} last={busy ? null : received.last} />
      <Tile
        label={m.weekEmails}
        now={mail.loading ? null : mail.bodies.length ? emails.now : 0}
        last={mail.bodies.length ? emails.last : null}
        {...(!mail.loading && !mail.bodies.length ? { format: () => "—", note: m.needsUpdate("Email") } : {})}
      />
      <Tile
        label={m.weekMeetingHours}
        now={meetings.loading ? null : minutes.now}
        last={meetings.loading || lastUnknown ? null : minutes.last}
        format={(n) => ((zoomBehind || !meetings.bodies.length) && n === 0 ? "—" : hours(n))}
        {...(zoomNote ? { note: zoomNote } : {})}
      />
      {typeof tasks === "string" ? (
        <Tile
          label={m.weekTasks}
          now={0}
          last={null}
          format={() => "—"}
          note={tasks === "missing" ? p.missing("Memo") : p.failed("Memo", null)}
        />
      ) : (
        <Tile
          label={m.weekTasks}
          now={weeks?.now.closed ?? null}
          last={weeks?.last.closed ?? null}
          format={(n) => `${made === null ? "—" : formatNumber(made)} · ${formatNumber(n)}`}
          {...(made === null && weeks ? { note: m.madeLater } : {})}
        />
      )}
    </section>
  )
}
