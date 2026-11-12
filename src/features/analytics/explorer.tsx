import { useState } from "react"
import { type Bucket, bucketDays, entryBuckets, type Grain, grainOf, taskGrain } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { CountRow, Only } from "@/platform/analytics-schemas"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { ColumnChart, type Series } from "./charts"
import { colorOf, longKey, shortKey } from "./format"
import { analyticsMessages } from "./messages"
import { MESSENGERS, useAnalytics, useExtra } from "./store"

const MESSAGE_MEASURES = ["messages", "sent", "received", "photo", "voice", "video", "file", "link"] as const
type Measure = (typeof MESSAGE_MEASURES)[number] | "tasks" | "memory"
type Split = "source" | "profile" | "chatType" | "none"

const ONLY: Partial<Record<Measure, Only>> = {
  messages: "all",
  received: "all",
  sent: "sent",
  photo: "photo",
  voice: "voice",
  video: "video",
  file: "file",
  link: "link",
}

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"]
const CHAT_TYPES = ["private", "group", "channel"] as const

const isMessages = (m: Measure) => (MESSAGE_MEASURES as readonly string[]).includes(m)

/** `a` less `b`, day by day: what was received is every message less the owner's own. */
function minus(a: readonly CountRow[], b: readonly CountRow[]): CountRow[] {
  const sent = new Map(b.map((r) => [r.key, r.count]))
  return a.map((r) => ({ ...r, count: Math.max(0, r.count - (sent.get(r.key) ?? 0)) }))
}

/**
 * One chart, the reader's choice of what it shows: a measure, how it is split, and the bar's length. The period, the
 * source and profile filters and the names stay the page's own, so this chart and the others always agree.
 */
export function Explorer() {
  const m = useMessages(analyticsMessages)
  const period = useAnalytics((s) => s.period)
  const today = useAnalytics((s) => s.today)
  const tasks = useAnalytics((s) => s.tasks)
  const memory = useAnalytics((s) => s.memory)
  const [measure, setMeasure] = useState<Measure>("messages")
  const [split, setSplit] = useState<Split>("source")
  const [step, setStep] = useState<Grain | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

  const messages = isMessages(measure)
  const byType = messages && split === "chatType" && measure === "messages"
  const main = useExtra({ by: "day", only: ONLY[measure] ?? "all", previous: false }, messages && !byType)
  const sent = useExtra({ by: "day", only: "sent", previous: false }, measure === "received")
  const privateChats = useExtra({ by: "day", only: "private", previous: false }, byType)
  const groups = useExtra({ by: "day", only: "group", previous: false }, byType)
  const channels = useExtra({ by: "day", only: "channel", previous: false }, byType)

  const steps: Grain[] = period === "7d" ? ["day"] : period === "all" ? ["week", "month"] : ["day", "week", "month"]
  const grain: Grain = measure === "tasks" ? taskGrain(period) : step && steps.includes(step) ? step : grainOf(period)

  const splits: Split[] = !messages
    ? ["none"]
    : measure === "messages"
      ? ["source", "profile", "chatType", "none"]
      : ["source", "profile", "none"]
  const shownSplit: Split = splits.includes(split) ? split : (splits[0] ?? "none")

  const rowsOf = (bySource: Record<string, CountRow[]>, id: string) =>
    measure === "received" ? minus(bySource[id] ?? [], sent.bySource[id] ?? []) : (bySource[id] ?? [])

  let series: Series[] = []
  let buckets: Bucket[] = []
  let loading = false
  let stale = false
  let unit = m.messagesN

  if (messages) {
    const parts = byType ? [privateChats, groups, channels] : measure === "received" ? [main, sent] : [main]
    loading = parts.some((p) => p.loading)
    stale = parts.some((p) => p.stale)
    const ids = Object.keys(main.bySource)
    const total = (bySource: Record<string, CountRow[]>) => Object.keys(bySource).flatMap((id) => bySource[id] ?? [])
    let rows: Record<string, CountRow[]> = {}
    if (byType) {
      rows = { private: total(privateChats.bySource), group: total(groups.bySource), channel: total(channels.bySource) }
      series = CHAT_TYPES.map((t, i) => ({ id: t, label: m.chatTypes[t] ?? t, color: SLOTS[i] ?? "" }))
    } else if (shownSplit === "source") {
      const order = MESSENGERS.filter((x) => ids.includes(x.id))
      rows = Object.fromEntries(order.map((x) => [x.provider, rowsOf(main.bySource, x.id)]))
      series = order.map((x) => ({ id: x.provider, label: findTool(x.id)?.name ?? x.id, color: colorOf(x.provider) }))
    } else if (shownSplit === "profile") {
      const keys = Object.keys(main.byProfile).sort()
      rows = Object.fromEntries(
        keys.map((k) => [
          k,
          measure === "received" ? minus(main.byProfile[k] ?? [], sent.byProfile[k] ?? []) : (main.byProfile[k] ?? []),
        ]),
      )
      series = keys.map((k, i) => {
        const [id = "", profile = ""] = k.split("/")
        return { id: k, label: `${findTool(id)?.name ?? id} · ${profile}`, color: SLOTS[i % SLOTS.length] ?? "" }
      })
    } else {
      rows = { all: ids.flatMap((id) => rowsOf(main.bySource, id)) }
      series = [{ id: "all", label: m.measures[measure] ?? measure, color: "var(--series-1)" }]
    }
    buckets = bucketDays(rows, period, today, grain)
  } else if (measure === "tasks") {
    unit = m.tasksN
    loading = tasks.state === "loading"
    series = [{ id: "closed", label: m.closedSeries, color: "var(--series-3)" }]
    buckets =
      tasks.state === "ready"
        ? tasks.data.bars.map((b) => ({ key: b.key, values: { closed: b.count }, total: b.count }))
        : []
  } else {
    unit = m.entriesN
    loading = memory.state === "loading"
    series = [
      { id: "memory", label: m.memorySeries, color: "var(--series-1)" },
      { id: "fact", label: m.factSeries, color: "var(--series-2)" },
    ]
    buckets =
      memory.state === "ready" && memory.data.kind === "ready"
        ? entryBuckets(memory.data.entries, period, today, grain)
        : []
  }

  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const measureOptions = [
    {
      label: m.measureGroups.messages ?? "",
      options: (["messages", "sent", "received"] as const).map((v) => ({
        value: v as Measure,
        label: m.measures[v] ?? v,
      })),
    },
    {
      label: m.measureGroups.media ?? "",
      options: (["photo", "voice", "video", "file", "link"] as const).map((v) => ({
        value: v as Measure,
        label: m.measures[v] ?? v,
      })),
    },
    {
      label: m.measureGroups.work ?? "",
      options: (["tasks", "memory"] as const).map((v) => ({ value: v as Measure, label: m.measures[v] ?? v })),
    },
  ]

  return (
    <div className="flex flex-col gap-[1rem]">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Control label={m.measureLabel}>
          <Select<Measure>
            size="sm"
            aria-label={m.measureLabel}
            value={measure}
            options={measureOptions}
            onChange={(v) => {
              setMeasure(v)
              setHidden(new Set())
            }}
          />
        </Control>
        <Control label={m.splitLabel}>
          <Select<Split>
            size="sm"
            aria-label={m.splitLabel}
            value={shownSplit}
            options={splits.map((v) => ({ value: v, label: m.splits[v] ?? v }))}
            onChange={(v) => {
              setSplit(v)
              setHidden(new Set())
            }}
          />
        </Control>
        {measure !== "tasks" && steps.length > 1 && (
          <Control label={m.stepLabel}>
            <Select<Grain>
              size="sm"
              aria-label={m.stepLabel}
              value={grain}
              options={steps.map((v) => ({ value: v, label: m.steps[v] ?? v }))}
              onChange={setStep}
            />
          </Control>
        )}
      </div>
      {loading && buckets.every((b) => b.total === 0) ? (
        <Skeleton className="h-[16.2rem] w-full rounded-rack" />
      ) : measure === "tasks" && period === "all" ? (
        <p className="text-[0.9rem] text-ink-soft">{m.allTimeClosed}</p>
      ) : (
        <ColumnChart
          title={m.measures[measure] ?? measure}
          buckets={buckets}
          series={series}
          short={(k) => shortKey(k, grain)}
          long={(k) => longKey(k, grain, m.weekOf)}
          unit={unit}
          stale={stale || (loading && buckets.some((b) => b.total > 0))}
          hidden={hidden}
          onToggle={toggle}
        />
      )}
      {series.length > 1 && <p className="text-[0.85rem] text-ink-dim">{m.exploreNote}</p>}
    </div>
  )
}

/** The explorer while the first numbers are read: its three controls and the chart's box, as it will stand. */
export function ExplorerSkeleton() {
  const m = useMessages(analyticsMessages)
  return (
    <div className="flex flex-col gap-[1rem]">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {[m.measureLabel, m.splitLabel, m.stepLabel].map((label) => (
          <Control key={label} label={label}>
            <Skeleton className="h-8 w-28" />
          </Control>
        ))}
      </div>
      <Skeleton className="h-[16.2rem] w-full rounded-rack" />
    </div>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden className="text-[0.85rem] text-ink-dim">
        {label}
      </span>
      {children}
    </div>
  )
}
