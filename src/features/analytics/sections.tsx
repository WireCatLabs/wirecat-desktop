import { type ReactNode, useState } from "react"
import {
  bucketDays,
  entryBuckets,
  FACT_STATUSES,
  grainOf,
  helped,
  initials,
  MEDIA,
  MEMORY_STATUSES,
  mediaTotals,
  ownersData,
  PERIOD_DAYS,
  projectRows,
  sentByMe,
  statusBuckets,
  statusCounts,
  tableRows,
  taskGrain,
  topRows,
} from "@/domain/analytics"
import { TOTALS } from "@/domain/archive"
import { findTool } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { formatDate, formatNumber, useLang, useMessages } from "@/i18n"
import { ProjectActivitySchema } from "@/platform/analytics-schemas"
import type { StoreInfo } from "@/platform/archive-schemas"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Pager } from "@/ui/Pager"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { ColumnChart, Legend, PartsBar, RankBars, type Series, Stat } from "./charts"
import { Explorer } from "./explorer"
import { colorOf, longKey, SOURCE_ORDER, shortKey, toolColor, toolName, useSourceName } from "./format"
import { analyticsMessages } from "./messages"
import { MessengerSwitch, useMessengerChoice } from "./messenger-switch"
import { MEMO_MISSING } from "./problems"
import { duration, readParts, useInboxTotals, useOldestOpen } from "./reads"
import { SourceProblems } from "./SourceProblems"
import { MESSENGERS, useAggregate, useAnalytics, useExtra, useShownSources } from "./store"
import { useMessengerProblems } from "./useProblems"

type M = typeof analyticsMessages.en

export function Panel({
  id,
  title,
  source,
  badge,
  children,
}: {
  id: string
  title: string
  /** The tool command the numbers come from, so a reader can trace them. */
  source: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-line border-b px-[1.3rem] py-[0.9rem]">
        <h3 id={id} className="m-0 flex items-center gap-2 text-[1.08rem] font-semibold">
          {title}
          {badge}
        </h3>
        <code className="font-mono text-[0.85rem] text-ink-dim">{source}</code>
      </div>
      <div className="flex flex-col gap-[1.3rem] px-[1.3rem] py-[1.1rem]">{children}</div>
    </section>
  )
}

const Note = ({ children }: { children: ReactNode }) => <p className="text-[0.9rem] text-ink-soft">{children}</p>

function Stats({ children }: { children: ReactNode }) {
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-[1.2rem] gap-y-4">{children}</dl>
  )
}

const SLOTS = ["a", "b", "c", "d", "e", "f"]

function StatsSkeleton({ n, label }: { n: number; label?: string }) {
  return (
    <Stats>
      {SLOTS.slice(0, n).map((slot, i) => (
        <div key={slot} className="flex flex-col gap-1">
          <dt className="text-[0.9rem]">
            <Skeleton chars={10} {...(i === 0 && label ? { label } : {})} />
          </dt>
          <dd className="m-0 text-[1.75rem] leading-tight">
            <Skeleton chars={5} />
          </dd>
        </div>
      ))}
    </Stats>
  )
}

/** The chart's final box, so the page does not grow when it arrives: legend, plot, axis and the numbers link. */
const ChartSkeleton = () => <Skeleton className="h-[16.2rem] w-full rounded-[0.2rem]" />

const Sub = ({ children }: { children: ReactNode }) => (
  <h3 className="text-[0.95rem] font-medium text-ink-dim">{children}</h3>
)

function PreviewPill() {
  const m = useMessages(analyticsMessages)
  return (
    <span title={m.previewNote}>
      <Pill tone="warn">{m.preview}</Pill>
    </span>
  )
}

export function Overview() {
  const m = useMessages(analyticsMessages)
  const volume = useAnalytics((s) => s.volume)
  return (
    <Panel id="an-overview" title={m.overview} source="store info">
      {volume.state === "loading" ? (
        <>
          <StatsSkeleton n={6} label={m.overview} />
          <Skeleton className="h-[7rem] w-full rounded-[0.2rem]" />
        </>
      ) : volume.state === "error" ? (
        <ErrorNotice inline>{m.storeError(volume.error)}</ErrorNotice>
      ) : volume.data === null ? (
        <Note>{m.noTool}</Note>
      ) : !volume.data.exists || volume.data.problem ? (
        <Note>{volume.data.problem ? m.storeError(volume.data.problem) : m.noStore}</Note>
      ) : (
        <OverviewBody info={volume.data} />
      )}
    </Panel>
  )
}

/** Where the stored data comes from and how it grew by year, from the same `store info` as the totals. */
export function StorageBreakdown() {
  const m = useMessages(analyticsMessages)
  const volume = useAnalytics((s) => s.volume)
  const sourceName = useSourceName()
  return (
    <Panel id="an-breakdown" title={m.bySource} source="store info">
      {volume.state === "loading" ? (
        <Skeleton className="h-[19rem] w-full rounded-[0.2rem]" label={m.bySource} />
      ) : volume.state !== "ready" || volume.data === null || !volume.data.breakdown ? (
        <Note>{m.noBreakdown}</Note>
      ) : (
        (() => {
          const info = volume.data
          const mine = ownersData(info.rows, info.breakdown?.providers ?? [], info.breakdown?.years ?? [])
          const providers = [...mine.providers].sort(
            (a, b) => order(a.provider) - order(b.provider) || a.provider.localeCompare(b.provider),
          )
          const years = mine.years
          const yearKeys = [...new Set(years.map((y) => y.key ?? ""))].filter(Boolean).sort()
          const yearBuckets = yearKeys.map((key) => {
            const values: Record<string, number> = {}
            for (const y of years) if (y.key === key) values[y.provider] = (values[y.provider] ?? 0) + y.messages
            return { key, values, total: Object.values(values).reduce((a, b) => a + b, 0) }
          })
          const yearSeries: Series[] = providers
            .filter((p) => years.some((y) => y.provider === p.provider && y.messages > 0))
            .map((p) => ({ id: p.provider, label: sourceName(p.provider), color: colorOf(p.provider) }))
          return (
            <div className="reveal flex flex-col gap-[1.3rem]">
              <PartsBar
                label={m.bySource}
                parts={providers.map((p) => ({
                  id: p.provider,
                  label: sourceName(p.provider),
                  value: p.messages + p.emails + p.documents + p.meetings,
                  color: colorOf(p.provider),
                }))}
              />
              {yearBuckets.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Sub>{m.byYear}</Sub>
                  <ColumnChart
                    title={m.byYear}
                    buckets={yearBuckets}
                    series={yearSeries}
                    short={(k) => shortKey(k, "year")}
                    long={(k) => longKey(k, "year", m.weekOf)}
                    unit={m.messagesN}
                  />
                </div>
              )}
            </div>
          )
        })()
      )}
    </Panel>
  )
}

const order = (provider: string) => {
  const i = SOURCE_ORDER.indexOf(provider)
  return i === -1 ? SOURCE_ORDER.length : i
}

function OverviewBody({ info }: { info: StoreInfo }) {
  const m = useMessages(analyticsMessages)
  const mine = ownersData(info.rows, info.breakdown?.providers ?? [], info.breakdown?.years ?? [])
  const totals = TOTALS.filter((k) => k !== "accounts" && k !== "attachments" && k in mine.rows)
  return (
    <div className="reveal flex flex-col gap-[1.3rem]">
      <Stats>
        {totals.map((k) => (
          <Stat key={k} label={m.totals[k] ?? k} value={formatNumber(mine.rows[k] ?? 0)} />
        ))}
        <Stat label={m.size} value={formatBytes(info.fileBytes + info.walBytes)} />
      </Stats>
      <MediaRow kinds={info.breakdown?.attachmentKinds ?? []} />
    </div>
  )
}

function MediaRow({ kinds }: { kinds: readonly { kind: string; count: number; bytes: number }[] }) {
  const m = useMessages(analyticsMessages)
  const tables = useAnalytics((s) => s.tables)
  const media = mediaTotals(kinds)
  const list = tables?.tables ?? []
  const transcripts = tableRows(list, ["message_transcripts", "meeting_transcripts"])
  const links = tableRows(list, ["message_links"])
  const shown = MEDIA.filter((k) => media[k].count > 0)
  if (!shown.length && transcripts === null && links === null && tables !== undefined) return null
  return (
    <div className="flex flex-col gap-2">
      <Sub>{m.mediaHead}</Sub>
      <Stats>
        {shown.map((k) => (
          <Stat
            key={k}
            label={m.media[k] ?? k}
            value={formatNumber(media[k].count)}
            note={media[k].bytes > 0 ? formatBytes(media[k].bytes) : undefined}
          />
        ))}
        {tables === undefined ? (
          <Stat label={m.transcripts} value={<Skeleton chars={4} />} />
        ) : (
          <>
            {transcripts !== null && (
              <Stat label={m.transcripts} value={formatNumber(transcripts)} note={m.transcriptsNote} />
            )}
            {links !== null && <Stat label={m.links} value={formatNumber(links)} note={m.linksNote} />}
          </>
        )}
      </Stats>
    </div>
  )
}

const messengerName = (id: string) => findTool(id)?.name ?? id

export function Activity() {
  const m = useMessages(analyticsMessages)
  const sources = useShownSources()
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const loading = MESSENGERS.some((x) => sources[x.id]?.state === "loading")
  const ready = MESSENGERS.flatMap((x) => {
    const s = sources[x.id]
    return s?.state === "ready" ? [{ ...x, s }] : []
  })
  const none = !loading && MESSENGERS.every((x) => sources[x.id]?.state === "missing")
  const grain = grainOf(period)
  const buckets = bucketDays(Object.fromEntries(ready.map((r) => [r.provider, r.s.days])), period, today)
  const total = buckets.reduce((s, b) => s + b.total, 0)
  const mine = ready.reduce((s, r) => s + sentByMe(r.s.senders), 0)
  const days = PERIOD_DAYS[period] ?? Math.max(1, buckets.length * 30)
  const busiest = buckets.reduce<(typeof buckets)[number] | null>(
    (a, b) => (a === null || b.total > a.total ? b : a),
    null,
  )

  return (
    <Panel id="an-activity" title={m.activity} source="stats messages show · tasks counts · memories list">
      {none ? (
        <Note>{m.noMessengers}</Note>
      ) : loading && ready.length === 0 ? (
        <>
          <StatsSkeleton n={4} label={m.activity} />
          <ChartSkeleton />
        </>
      ) : (
        <div className="reveal flex flex-col gap-[1.3rem]">
          <Stats>
            <Stat label={m.inPeriod} value={formatNumber(total)} note={m.period[period]} />
            {mine > 0 && (
              <Stat
                label={m.youSent}
                value={formatNumber(mine)}
                note={m.ofThem(total ? Math.round((mine / total) * 100) : 0)}
              />
            )}
            <Stat label={m.perDay} value={formatNumber(Math.round(total / days))} />
            {busiest && busiest.total > 0 && (
              <Stat
                label={m.busiest[grain] ?? ""}
                value={formatNumber(busiest.total)}
                note={longKey(busiest.key, grain, m.weekOf)}
              />
            )}
          </Stats>
          <Explorer />
          <SourceNotes m={m} />
        </div>
      )}
    </Panel>
  )
}

function SourceNotes({ m }: { m: M }) {
  const sources = useShownSources()
  const signedOut = useAnalytics((s) => s.signedOut)
  const problems = useMessengerProblems()
  const lines = MESSENGERS.flatMap((x) => {
    const s = sources[x.id]
    const name = messengerName(x.id)
    if (s?.state === "noProfiles" && !signedOut[x.id]?.length) return [m.sourceNoProfiles(name)]
    return s?.state === "ready" && s.more ? [m.sourceMore(name)] : []
  })
  if (!lines.length && !problems.length) return null
  return (
    <div className="flex flex-col gap-3">
      <SourceProblems problems={problems} />
      {lines.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9rem] text-warn-ink">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function People() {
  const m = useMessages(analyticsMessages)
  const sources = useShownSources()
  const hide = useAnalytics((s) => s.hideNames)
  const [by, setBy] = useState<"senders" | "chats">("senders")
  const counts = useExtra({ by: by === "senders" ? "sender" : "chat", only: "close", previous: false })
  const loading = MESSENGERS.some((x) => sources[x.id]?.state === "loading")
  const none = !loading && !MESSENGERS.some((x) => sources[x.id]?.state === "ready")
  const { ids, picked, choose } = useMessengerChoice(counts.bySource, counts.loading)
  const rows = topRows(
    Object.fromEntries(
      MESSENGERS.filter((x) => picked === "all" || picked === x.id).map((x) => [
        x.provider,
        counts.bySource[x.id] ?? [],
      ]),
    ),
    10,
  )
  const shownSources = MESSENGERS.filter((x) => rows.some((r) => r.source === x.provider))
  const sourceName = useSourceName()
  const names = (n: string | null) => (n === null ? m.unnamed : hide ? initials(n) : n)

  return (
    <Panel id="an-people" title={m.people} source={`stats messages show --by ${by === "senders" ? "sender" : "chat"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<"senders" | "chats">
            size="md"
            label={m.people}
            value={by}
            onChange={setBy}
            options={[
              { value: "senders", label: m.byPeople },
              { value: "chats", label: m.byChats },
            ]}
          />
          <MessengerSwitch ids={ids} value={picked} onChange={choose} />
          <InfoTip label={m.closeLabel}>{counts.privateOnly ? m.closeTipOld : m.closeTip}</InfoTip>
        </div>
        <p className="text-[0.85rem] text-ink-dim">{m.namesStay}</p>
      </div>
      {none ? (
        <Note>{m.noMessengers}</Note>
      ) : counts.loading ? (
        <Skeleton className="h-[15rem] w-full rounded-[0.2rem]" label={m.people} />
      ) : rows.length === 0 ? (
        counts.problems.length ? (
          <SourceProblems problems={counts.problems} />
        ) : (
          <Note>{m.nobody}</Note>
        )
      ) : (
        <div className="reveal flex min-h-[15rem] flex-col gap-3">
          <Legend
            series={shownSources.map((r) => ({
              id: r.provider,
              label: messengerName(r.id),
              color: colorOf(r.provider),
            }))}
          />
          <RankBars
            label={by === "senders" ? m.peopleLabel : m.chatsLabel}
            unit={m.messagesN}
            stale={counts.stale}
            rows={rows.map((r) => ({
              id: r.id,
              title: `${names(r.name)} · ${sourceName(r.source)}`,
              label: names(r.name),
              value: r.count,
              color: colorOf(r.source),
            }))}
          />
        </div>
      )}
    </Panel>
  )
}

/** Rows per page: a table of every project would push the sections below it off the screen. */
const PROJECT_PAGE = 8

export function Projects() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const tasks = useAnalytics((s) => s.tasks)
  const memory = useAnalytics((s) => s.memory)
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const refreshing = useAnalytics((s) => s.refreshing)
  const projects = useAnalytics((s) => s.projects)
  const activity = readParts([["memo", useAggregate("projectActivity", "memo")]], ProjectActivitySchema)
  const [page, setPage] = useState(1)
  const keyOf = (p: string) => projects.find((x) => x.ref === p)?.key ?? p
  const entries = memory.state === "ready" && memory.data.kind === "ready" ? memory.data.entries : []
  const chats = activity.ready[0]?.body.items ?? null
  const cutShort = activity.ready[0]?.body.page.has_more ?? false
  const rows =
    tasks.state === "ready"
      ? projectRows(
          tasks.data.open.project,
          tasks.data.overdue.project,
          tasks.data.closed.project,
          entries,
          period,
          today,
          chats,
          keyOf,
        )
      : []
  const pages = Math.max(1, Math.ceil(rows.length / PROJECT_PAGE))
  const at = Math.min(page, pages)
  const shown = rows.slice((at - 1) * PROJECT_PAGE, at * PROJECT_PAGE)
  const head = [m.open, m.overdue, m.closed, m.memoryCol]

  return (
    <Panel id="an-projects" title={m.projects} source="tasks counts · stats projects show">
      {tasks.state === "missing" ? (
        <SourceProblems problems={MEMO_MISSING} />
      ) : tasks.state === "error" ? (
        <ErrorNotice inline>{m.tasksError(tasks.error)}</ErrorNotice>
      ) : tasks.state === "loading" ? (
        <Skeleton className="h-[15rem] w-full rounded-[0.2rem]" label={m.projects} />
      ) : rows.length === 0 ? (
        <Note>{m.noProjects}</Note>
      ) : (
        <div
          className={cx(
            "reveal flex min-h-[15rem] flex-col gap-3 transition-opacity duration-(--motion-slow)",
            refreshing && "opacity-55",
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[0.95rem]">
              <caption className="sr-only">{m.projectsTable}</caption>
              <thead className="text-[0.875rem] text-ink-dim">
                <tr>
                  <th scope="col" className="pb-2 text-left font-medium">
                    {m.project}
                  </th>
                  {head.map((h) => (
                    <th key={h} scope="col" className="pb-2 pl-3 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="selectable">
                {shown.map((r) => (
                  <tr key={r.key} className="border-line border-t align-top">
                    <th scope="row" className="max-w-[22rem] py-[0.45rem] text-left font-normal">
                      <span className="block truncate">{r.name ?? r.key}</span>
                      {!r.key.startsWith("project:") && (
                        <span className="block font-mono text-[0.85rem] text-ink-dim">{r.key}</span>
                      )}
                      {r.chats !== null && r.messages !== null && r.chats > 0 && (
                        <span className="block text-[0.85rem] text-ink-soft">
                          {m.chatLine(
                            formatNumber(r.chats, lang),
                            formatNumber(r.messages, lang),
                            r.lastAt ? formatDate(r.lastAt, { dateStyle: "medium" }, lang) : null,
                          )}
                          {r.partial && ` · ${m.partialProject}`}
                        </span>
                      )}
                      {r.top.length > 0 && (
                        <span className="block truncate text-[0.85rem] text-ink-dim">
                          {r.top
                            .map((t) => `${t.title ?? m.untitledChat} ${formatNumber(t.messages, lang)}`)
                            .join(" · ")}
                        </span>
                      )}
                    </th>
                    <Num value={r.open} />
                    <Num value={r.overdue} warn />
                    <Num value={r.closed} />
                    <Num value={r.memories} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && <Pager page={at} onPage={setPage} total={rows.length} size={PROJECT_PAGE} />}
          {chats ? (
            <Note>
              {m.chatsNote}
              {cutShort && ` ${m.projectsCut}`}
            </Note>
          ) : (
            activity.problems.length > 0 && <SourceProblems problems={activity.problems} />
          )}
        </div>
      )}
    </Panel>
  )
}

function Num({ value, warn = false }: { value: number; warn?: boolean }) {
  return (
    <td
      className={cx(
        "py-[0.45rem] pl-3 text-right font-mono tabular-nums",
        value === 0 ? "text-ink-dim" : warn ? "text-warn-ink" : "text-ink",
      )}
    >
      {formatNumber(value)}
    </td>
  )
}

export function Tasks() {
  const m = useMessages(analyticsMessages)
  const tasks = useAnalytics((s) => s.tasks)
  const period = useAnalytics((s) => s.period)
  const preview = useAnalytics((s) => s.preview)
  const refreshing = useAnalytics((s) => s.refreshing)
  const lang = useLang()
  const oldest = useOldestOpen()
  // Tasks found in messages and meetings stay in each account's inbox until sorted; the board counts projects only.
  const inbox = useInboxTotals()
  const unsorted = inbox?.open ?? null
  const grain = taskGrain(period)
  return (
    <Panel id="an-tasks" title={m.tasks} source="tasks counts · stats tasks show">
      {tasks.state === "missing" ? (
        <SourceProblems problems={MEMO_MISSING} />
      ) : tasks.state === "error" ? (
        <ErrorNotice inline>{m.tasksError(tasks.error)}</ErrorNotice>
      ) : tasks.state === "loading" ? (
        <>
          <StatsSkeleton n={5} label={m.tasks} />
          <ChartSkeleton />
        </>
      ) : (
        <div className="reveal flex flex-col gap-[1.3rem]">
          <Stats>
            <Stat label={m.openNow} value={formatNumber(tasks.data.open.total)} />
            {unsorted !== null && <Stat label={m.unsortedOpen} value={formatNumber(unsorted)} note={m.unsortedNote} />}
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
            <Stat
              label={m.closedIn}
              value={formatNumber(tasks.data.closed.total + (inbox?.closed ?? 0))}
              note={m.period[period]}
            />
            {inbox && (
              <Stat
                label={m.madeIn}
                value={formatNumber(tasks.data.created.total + inbox.created)}
                note={m.period[period]}
              />
            )}
          </Stats>
          {preview ? (
            <div className="flex flex-col gap-2">
              <Sub>
                <span className="flex items-center gap-2">
                  {m.madeChart}
                  <PreviewPill />
                </span>
              </Sub>
              <ColumnChart
                title={m.madeChart}
                buckets={preview.taskWeeks.map((w) => ({
                  key: w.week,
                  values: { made: w.created, closed: w.closed },
                  total: w.created + w.closed,
                }))}
                series={[
                  { id: "made", label: m.madeSeries, color: "var(--series-1)" },
                  { id: "closed", label: m.closedSeries, color: "var(--series-3)" },
                ]}
                short={(k) => shortKey(k, "week")}
                long={(k) => longKey(k, "week", m.weekOf)}
                unit={m.tasksN}
                stale={refreshing}
              />
            </div>
          ) : period === "all" ? (
            <Note>{m.allTimeClosed}</Note>
          ) : (
            <div className="flex flex-col gap-2">
              <Sub>{m.closedChart}</Sub>
              <ColumnChart
                title={m.closedChart}
                buckets={tasks.data.bars.map((b) => ({ key: b.key, values: { closed: b.count }, total: b.count }))}
                series={[{ id: "closed", label: m.closedSeries, color: "var(--series-3)" }]}
                short={(k) => shortKey(k, grain)}
                long={(k) => longKey(k, grain, m.weekOf)}
                unit={m.tasksN}
                stale={refreshing}
              />
              <Note>{m.madeLater}</Note>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

export function Memory() {
  const m = useMessages(analyticsMessages)
  const memory = useAnalytics((s) => s.memory)
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const grain = grainOf(period)
  const palette = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"]
  return (
    <Panel id="an-memory" title={m.memory} source="memories list · facts list">
      {memory.state === "loading" ? (
        <>
          <Skeleton className="h-[5.5rem] w-full rounded-[0.2rem]" label={m.memory} />
          <ChartSkeleton />
        </>
      ) : memory.state === "error" ? (
        <ErrorNotice inline>{m.memoryError(memory.error)}</ErrorNotice>
      ) : memory.data.kind === "missing" ? (
        <SourceProblems problems={MEMO_MISSING} />
      ) : memory.data.kind === "old" ? (
        <Note>{m.memoryOld}</Note>
      ) : memory.data.entries.length === 0 ? (
        <Note>{m.noMemory}</Note>
      ) : (
        (() => {
          const entries = memory.data.entries
          const mem = statusCounts(entries, "memory")
          const facts = statusCounts(entries, "fact")
          const buckets = entryBuckets(entries, period, today)
          return (
            <div className="reveal flex flex-col gap-[1.3rem]">
              <div className="flex flex-col gap-2">
                <Sub>{m.memories}</Sub>
                <PartsBar
                  label={m.memories}
                  parts={MEMORY_STATUSES.map((st, i) => ({
                    id: st,
                    label: m.memoryStatus[st] ?? st,
                    value: mem[st] ?? 0,
                    color: palette[i] ?? "var(--series-other)",
                  }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Sub>{m.facts}</Sub>
                <PartsBar
                  label={m.facts}
                  parts={FACT_STATUSES.map((st, i) => ({
                    id: st,
                    label: m.memoryStatus[st] ?? st,
                    value: facts[st] ?? 0,
                    color: palette[i] ?? "var(--series-other)",
                  }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Sub>{m.newEntries}</Sub>
                <ColumnChart
                  title={m.newEntries}
                  buckets={buckets}
                  series={[
                    { id: "memory", label: m.memorySeries, color: "var(--series-1)" },
                    { id: "fact", label: m.factSeries, color: "var(--series-2)" },
                  ]}
                  short={(k) => shortKey(k, grain)}
                  long={(k) => longKey(k, grain, m.weekOf)}
                  unit={m.entriesN}
                />
              </div>
              {memory.data.more && <Note>{m.latest500}</Note>}
            </div>
          )
        })()
      )}
    </Panel>
  )
}

export function Helps() {
  const m = useMessages(analyticsMessages)
  const runs = useAnalytics((s) => s.runs)
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const h = runs.state === "ready" ? helped(runs.data, period, today) : null
  const waiting =
    runs.state === "loading" ? (
      <Skeleton className="h-[12rem] w-full rounded-[0.2rem]" label={m.helps} />
    ) : runs.state === "error" ? (
      <ErrorNotice inline>{m.runsError(runs.error)}</ErrorNotice>
    ) : null
  return (
    <>
      <Panel id="an-helps" title={m.helps} source="runs list">
        {waiting ??
          (h && (
            <div className="reveal flex flex-col gap-[1.3rem]">
              <Stats>
                <Stat label={m.agentRuns} value={formatNumber(h.agentRuns)} note={m.period[period]} />
                <Stat label={m.mcpCalls} value={formatNumber(h.mcpCalls)} note={m.mcpNote} />
                <Stat label={m.yourRuns} value={formatNumber(h.yourRuns)} note={m.yourNote} />
              </Stats>
              <Note>{m.helpsNote}</Note>
            </div>
          ))}
      </Panel>
      <Panel id="an-helps-by" title={m.byAgent} source="runs list">
        {waiting ??
          (h &&
            (h.agentRuns === 0 ? (
              <Note>{m.noRuns}</Note>
            ) : (
              <div className="reveal flex flex-col gap-[1.3rem]">
                <RankBars
                  label={m.byAgent}
                  unit={m.runsN}
                  rows={h.byAgent.slice(0, 6).map((a) => ({
                    id: a.name,
                    title: a.name,
                    label: a.name,
                    value: a.count,
                    color: "var(--series-1)",
                  }))}
                />
                <div className="flex flex-col gap-2">
                  <Sub>{m.byTool}</Sub>
                  <RankBars
                    label={m.byTool}
                    unit={m.runsN}
                    rows={h.byTool.slice(0, 7).map((t) => ({
                      id: t.tool,
                      title: toolName(t.tool),
                      label: toolName(t.tool),
                      value: t.count,
                      color: toolColor(t.tool),
                    }))}
                  />
                </div>
              </div>
            )))}
      </Panel>
    </>
  )
}

/** Facts per week by what became of each: accepted, still waiting, rejected. From the same 500 facts as Memory. */
export function MemoryWeeks() {
  const m = useMessages(analyticsMessages)
  const memory = useAnalytics((s) => s.memory)
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const grain = period === "7d" ? "day" : "week"
  const palette = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"]
  return (
    <Panel id="an-fact-weeks" title={m.factWeeksTitle} source="facts list">
      {memory.state === "loading" ? (
        <ChartSkeleton />
      ) : memory.state === "error" ? (
        <ErrorNotice inline>{m.memoryError(memory.error)}</ErrorNotice>
      ) : memory.data.kind !== "ready" ? (
        <Note>{memory.data.kind === "missing" ? m.memoryMissing : m.memoryOld}</Note>
      ) : (
        <div className="reveal flex flex-col gap-2">
          <ColumnChart
            title={m.factWeeksTitle}
            buckets={statusBuckets(memory.data.entries, "fact", period, today, grain)}
            series={FACT_STATUSES.map((st, i) => ({
              id: st,
              label: m.memoryStatus[st] ?? st,
              color: palette[i] ?? "var(--series-other)",
            }))}
            short={(k) => shortKey(k, grain)}
            long={(k) => longKey(k, grain, m.weekOf)}
            unit={m.entriesN}
          />
          <Note>{m.factWeeksNote}</Note>
        </div>
      )}
    </Panel>
  )
}
