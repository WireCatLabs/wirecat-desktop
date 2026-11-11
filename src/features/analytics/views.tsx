import { useMemo, useState } from "react"
import * as v from "valibot"
import {
  addDays,
  bucketDays,
  type Change,
  changes,
  grainOf,
  initials,
  offHours,
  spikes,
  weekHours,
} from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatDate, formatNumber, formatRelative, useLang, useMessages } from "@/i18n"
import { CoverageSchema } from "@/platform/analytics-schemas"
import { cx } from "@/ui/cx"
import { InfoTip } from "@/ui/InfoTip"
import { Lamp } from "@/ui/Lamp"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { NumbersTable, Stat } from "./charts"
import { colorOf, longKey, useSourceName } from "./format"
import { analyticsMessages } from "./messages"
import { MessengerSwitch, useMessengerChoice } from "./messenger-switch"
import { SourceProblems } from "./SourceProblems"
import { MESSENGERS, useAggregate, useAnalytics, useExtra } from "./store"

const MONDAY = "2026-11-02"
const HOURS = Array.from({ length: 24 }, (_, h) => h)

const providerOf = (id: string) => MESSENGERS.find((x) => x.id === id)?.provider ?? id
const byProvider = <T,>(bySource: Record<string, T>) =>
  Object.fromEntries(Object.entries(bySource).map(([id, v]) => [providerOf(id), v]))

/** Messages by weekday and hour: one hue, darker where there is more, so the busy hours stand out at a glance. */
export function WhenYouTalk() {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const [who, setWho] = useState<"close" | "sent">("close")
  const hours = useExtra({ by: "hour", only: who, previous: false })
  const period = useAnalytics((s) => s.period)
  const { ids, picked, choose } = useMessengerChoice(hours.bySource, hours.loading)
  const grid = weekHours(picked === "all" ? Object.values(hours.bySource).flat() : (hours.bySource[picked] ?? []))
  const max = grid.flat().reduce((a, n) => Math.max(a, n), 1)
  const days = grid.map((_, i) =>
    formatDate(new Date(`${addDays(MONDAY, i)}T12:00:00Z`), { weekday: "short", timeZone: "UTC" }, lang),
  )
  const empty = !hours.loading && grid.flat().every((n) => n === 0)
  const off = offHours(grid)
  const pct = (n: number) => (off.total ? Math.round((n / off.total) * 100) : 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<"close" | "sent">
          size="md"
          label={m.whoLabel}
          value={who}
          onChange={setWho}
          options={[
            { value: "close", label: m.whoAll },
            { value: "sent", label: m.whoMine },
          ]}
        />
        <MessengerSwitch ids={ids} value={picked} onChange={choose} />
        <InfoTip label={m.closeLabel}>
          {who === "sent" ? m.mineTip : hours.privateOnly ? m.closeTipOld : m.closeTip}
        </InfoTip>
      </div>
      {hours.loading && Object.keys(hours.bySource).length === 0 ? (
        <Skeleton className="h-[13.5rem] w-full rounded-[0.2rem]" label={m.whenTitle} />
      ) : empty ? (
        // A profile that did not answer is said as such: its silence is not "no messages".
        hours.problems.length ? (
          <SourceProblems problems={hours.problems} />
        ) : (
          <p className="text-[0.9rem] text-ink-soft">{m.noMessages}</p>
        )
      ) : (
        <div
          className={cx("flex flex-col gap-3 transition-opacity duration-(--motion-slow)", hours.stale && "opacity-55")}
        >
          <dl className="m-0 grid grid-cols-2 gap-x-[1.2rem]">
            <Stat label={m.offEvenings} value={`${pct(off.evenings)}%`} note={m.messagesN(off.evenings)} />
            <Stat label={m.offWeekends} value={`${pct(off.weekends)}%`} note={m.messagesN(off.weekends)} />
          </dl>
          <div
            className="grid grid-cols-[2.6rem_repeat(24,minmax(0,1fr))] gap-[2px]"
            role="img"
            aria-label={m.heatTable}
          >
            {grid.map((row, d) => (
              <div key={days[d]} className="contents">
                <span className="pr-2 text-right text-[0.85rem] leading-[1.35rem] text-ink-dim">{days[d]}</span>
                {row.map((n, h) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: the hour is the cell's place in the row
                    key={h}
                    title={`${days[d]} ${String(h).padStart(2, "0")}:00 · ${m.messagesN(n)}`}
                    className="block h-[1.35rem] rounded-[3px]"
                    style={{
                      background:
                        n === 0
                          ? "var(--app-2)"
                          : `color-mix(in oklab, var(--series-1) ${Math.round(15 + (n / max) * 85)}%, var(--app))`,
                    }}
                  />
                ))}
              </div>
            ))}
            <span />
            {HOURS.map((h) => (
              <span key={h} aria-hidden className="text-center font-mono text-[0.8rem] text-ink-dim">
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
          <NumbersTable
            caption={m.heatTable}
            head={[m.hourCol, ...days]}
            rows={HOURS.map((h) => [`${String(h).padStart(2, "0")}:00`, ...grid.map((row) => row[h] ?? 0)])}
          />
          <p className="text-[0.85rem] text-ink-dim">
            {period === "all" ? `${m.offNote} ${m.lastYearOnly}` : m.offNote}
          </p>
          <SourceProblems problems={hours.problems} />
        </div>
      )}
    </div>
  )
}

/**
 * The chats the owner wrote in at least once in the last 30 days (UX-164): a busier group he never writes in is noise.
 * The day is in the query, so the set is read once a day and kept for the session.
 */
function useActiveChats(today: string, enabled: boolean) {
  const range = useMemo(() => ({ from: addDays(today, -30), to: null }), [today])
  const sent = useExtra({ by: "chat", only: "sent", previous: false, range, full: true }, enabled)
  const ids = useMemo(
    () =>
      new Set(
        Object.entries(byProvider(sent.bySource)).flatMap(([source, rows]) => rows.map((r) => `${source}:${r.key}`)),
      ),
    [sent.bySource],
  )
  // A messenger whose count of the owner's own messages failed is not filtered: an empty set would hide every chat.
  const known = useMemo(
    () =>
      new Set(
        Object.keys(sent.bySource)
          .filter((id) => !sent.problems.some((p) => p.tool === id))
          .map(providerOf),
      ),
    [sent.bySource, sent.problems],
  )
  return { ids, known, problems: sent.problems, loading: sent.loading, stale: sent.stale }
}

const onlyActive = <R extends { key: string }>(
  bySource: Record<string, readonly R[]>,
  { ids, known }: { ids: ReadonlySet<string>; known: ReadonlySet<string> },
) =>
  Object.fromEntries(
    Object.entries(bySource).map(([source, rows]) => [
      source,
      known.has(source) ? rows.filter((r) => ids.has(`${source}:${r.key}`)) : rows,
    ]),
  )

/** People who wrote much less than in the period before, and chats that grew most. */
export function WhatChanged() {
  const m = useMessages(analyticsMessages)
  const period = useAnalytics((s) => s.period)
  const hide = useAnalytics((s) => s.hideNames)
  const all = period === "all"
  const today = useAnalytics((s) => s.today)
  const peopleNow = useExtra({ by: "sender", only: "private", previous: false }, !all)
  const peopleBefore = useExtra({ by: "sender", only: "private", previous: true }, !all)
  const chatsNow = useExtra({ by: "chat", only: "all", previous: false }, !all)
  const chatsBefore = useExtra({ by: "chat", only: "all", previous: true }, !all)
  const active = useActiveChats(today, !all)
  const days = useExtra({ by: "day", only: "all", previous: false })
  const grain = grainOf(period)
  const bars = bucketDays(byProvider(days.bySource), period, today)
  const loud = spikes(bars).slice(0, 3)
  const average = bars.length ? Math.round(bars.reduce((s, b) => s + b.total, 0) / bars.length) : 0
  const unusual = (
    <div className="flex flex-col gap-2">
      <h4 className="m-0 text-[0.95rem] font-medium text-ink-dim">{m.spikeDays}</h4>
      {loud.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noSpikes}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.95rem]">
          {loud.map((b) => (
            <li key={b.key} className="flex flex-wrap justify-between gap-x-3">
              <span>{longKey(b.key, grain, m.weekOf)}</span>
              <span className="text-ink-soft">{m.spikeLine(m.messagesN(b.total), formatNumber(average))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
  if (all)
    return (
      <div className="flex flex-col gap-4">
        {unusual}
        <p className="text-[0.9rem] text-ink-soft">{m.changesAll}</p>
      </div>
    )
  const loading = [peopleNow, peopleBefore, chatsNow, chatsBefore, active].some((x) => x.loading)
  const stale = [peopleNow, peopleBefore, chatsNow, chatsBefore, active].some((x) => x.stale)
  if (loading) return <Skeleton className="h-[13.5rem] w-full rounded-[0.2rem]" label={m.changesTitle} />
  const people = changes(byProvider(peopleNow.bySource), byProvider(peopleBefore.bySource))
  const chats = changes(
    onlyActive(byProvider(chatsNow.bySource), active),
    onlyActive(byProvider(chatsBefore.bySource), active),
  )
  const name = (c: Change) => (c.name === null ? m.unnamed : hide ? initials(c.name) : c.name)
  return (
    <div className={cx("flex flex-col gap-3 transition-opacity duration-(--motion-slow)", stale && "opacity-55")}>
      <div className="grid grid-cols-1 gap-[1.5rem] md:grid-cols-2">
        <ChangeList title={m.quieter} rows={people.quieter} name={name} />
        <ChangeList title={m.busier} rows={chats.busier} name={name} />
      </div>
      {unusual}
      <p className="text-[0.85rem] text-ink-dim">{m.changesNote(m.period[period] ?? period)}</p>
    </div>
  )
}

function ChangeList({ title, rows, name }: { title: string; rows: Change[]; name: (c: Change) => string }) {
  const m = useMessages(analyticsMessages)
  const sourceName = useSourceName()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="m-0 text-[0.95rem] font-medium text-ink-dim">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noChanges}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[0.45rem] p-0">
          {rows.map((c) => (
            <li
              key={c.id}
              title={`${name(c)} · ${sourceName(c.source)}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <span className="selectable flex min-w-0 items-center gap-[0.5rem] text-[0.95rem]">
                <span
                  aria-hidden
                  className="size-[0.55rem] shrink-0 rounded-full"
                  style={{ background: colorOf(c.source) }}
                />
                <span className="truncate">{name(c)}</span>
              </span>
              <span className="font-mono text-[0.9rem] text-ink-soft tabular-nums">
                {m.beforeNow(formatNumber(c.before), formatNumber(c.now))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const DAY = 86_400_000

function ago(at: string, lang: ReturnType<typeof useLang>) {
  const ms = Date.now() - Date.parse(at)
  if (ms < 3_600_000) return formatRelative(-Math.max(1, Math.round(ms / 60_000)), "minute", lang)
  if (ms < DAY) return formatRelative(-Math.round(ms / 3_600_000), "hour", lang)
  return formatRelative(-Math.round(ms / DAY), "day", lang)
}

/** When each tool and profile last brought data in; older than three days is amber, never is a hollow lamp. */
export function Health() {
  const m = useMessages(analyticsMessages)
  const syncs = useAnalytics((s) => s.syncs)
  if (syncs.state === "loading") return <Skeleton className="h-[9rem] w-full rounded-[0.2rem]" label={m.health} />
  if (syncs.state === "error") return <p className="text-[0.9rem] text-ink-soft">{syncs.error}</p>
  return (
    <table className="w-full text-[0.95rem]">
      <caption className="sr-only">{m.health}</caption>
      <thead className="text-left text-[0.875rem] text-ink-dim">
        <tr>
          <th scope="col" className="pb-2 font-medium">
            {m.tool}
          </th>
          <th scope="col" className="pb-2 font-medium">
            {m.profileCol}
          </th>
          <th scope="col" className="pb-2 font-medium">
            {m.lastSync}
          </th>
          <th scope="col" className="pb-2 font-medium">
            {m.neverFetched}
          </th>
        </tr>
      </thead>
      <tbody>
        {syncs.data.map((s) => (
          <HealthRow key={`${s.id}/${s.profile ?? ""}`} sync={s} />
        ))}
      </tbody>
    </table>
  )
}

type Sync = { id: string; profile: string | null; at: string | null; known: boolean }

function HealthRow({ sync: s }: { sync: Sync }) {
  const m = useMessages(analyticsMessages)
  const lang = useLang()
  const messenger = MESSENGERS.some((x) => x.id === s.id)
  const coverage = useAggregate("coverage", s.id, messenger)
  const part = coverage.state === "ready" ? coverage.parts.find((p) => p.profile === s.profile)?.answer : undefined
  const parsed = part?.kind === "ready" ? v.safeParse(CoverageSchema, part.body) : null
  const old = s.at !== null && Date.now() - Date.parse(s.at) > 3 * DAY
  const tone = s.at === null ? "idle" : old ? "warn" : "ok"
  const text = s.at !== null ? m.syncedAgo(ago(s.at, lang)) : s.known ? m.never : m.unknownSync
  return (
    <tr className="border-line border-t">
      <td className="py-[0.45rem] pr-3">{findTool(s.id)?.name ?? s.id}</td>
      <td className="py-[0.45rem] pr-3 font-mono text-[0.9rem] text-ink-soft">{s.profile ?? "—"}</td>
      <td className="py-[0.45rem] pr-3">
        <span className="flex items-center gap-2">
          <Lamp tone={tone} size="sm" label={old ? m.staleSync : text} />
          <span className={cx(old ? "text-warn-ink" : "text-ink-soft")}>{text}</span>
        </span>
      </td>
      <td className="py-[0.45rem] text-[0.9rem] text-ink-soft">
        {!messenger ? (
          "—"
        ) : coverage.state === "loading" ? (
          <Skeleton chars={8} />
        ) : parsed?.success ? (
          <span title={m.chatsOf(formatNumber(parsed.output.fetched), formatNumber(parsed.output.chats))}>
            {formatNumber(parsed.output.never)}
          </span>
        ) : part?.kind === "old" ? (
          m.needsUpdate(findTool(s.id)?.name ?? s.id)
        ) : (
          "—"
        )}
      </td>
    </tr>
  )
}
