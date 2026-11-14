import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Rows3 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { dayOf, shift, shiftMonth, weekStart } from "@/domain/days"
import { instantOf, monthWindow, weekWindow } from "@/domain/meeting-layout"
import { gapFromRead } from "@/domain/needs"
import { setField, valuesOf } from "@/domain/query-terms"
import { parseQuery } from "@/domain/runs"
import { QueryBar } from "@/features/query"
import { formatNumber, type Lang, useLang, useMessages } from "@/i18n"
import type { MeetingRow, MeetingsRead } from "@/platform/bindings"
import { errorText } from "@/shared/errors"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { SourceIcon } from "@/shared/SourceIcon"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { Calendar, CalendarFooter, DatePopover } from "@/ui/Calendar"
import { EmptyState } from "@/ui/EmptyState"
import { ToggleChip } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { NoticeChips } from "@/ui/NoticeChips"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { readAgain, useMeetingsPage, useMeetingsWindow } from "./api"
import { MeetingDialog } from "./MeetingDialog"
import { MeetingsTable } from "./MeetingsTable"
import { MonthView } from "./MonthView"
import { MEETING_KINDS, meetingMessages } from "./messages"
import { useMeetings, type View } from "./store"
import { meetingValues, suggestMeetings } from "./suggest"
import { WeekView } from "./WeekView"

/** The query language the bar speaks, shared by every WireCat tool. */
const queryDocs = (lang: Lang) => `https://wirecat.dev/${lang}/docs/tg/query-language`

const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export function MeetingsPage() {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const view = useMeetings((s) => s.view)
  const anchor = useMeetings((s) => s.anchor)
  const query = useMeetings((s) => s.query)
  const asked = useMeetings((s) => s.asked)
  const page = useMeetings((s) => s.page)
  const size = useMeetings((s) => s.size)
  const { setView, setAnchor, type, setQuery, setPage, setSize } = useMeetings.getState()
  const [jump, setJump] = useState(0)
  const [accounts, setAccounts] = useState<readonly string[]>([])

  const first = weekStart(lang)
  const calendar = view !== "table"
  const window = useMemo(
    () => (view === "month" ? monthWindow(anchor, first) : weekWindow(anchor, first)),
    [view, anchor, first],
  )
  const windowRead = useMeetingsWindow(window, asked, calendar)
  const tableRead = useMeetingsPage(asked, page, size, !calendar)
  const read = calendar ? windowRead : tableRead
  const data: MeetingsRead | undefined = read.data
  const gap = gapFromRead(data?.kind === "missing" || data?.kind === "old" ? data : null)
  const ready = data?.kind === "ready" ? data.page : null

  // The Source menu offers what memo read last with no account chosen: memo refuses an account it does not hold.
  useEffect(() => {
    if (ready && valuesOf(asked, "source").length === 0) setAccounts(ready.accounts)
  }, [ready, asked])

  // Rows come oldest first; when the cap cut the window, nothing after the last row read is known.
  const last = ready?.meetings.at(-1)?.startedAt
  const cutAt = calendar && ready?.more ? (last ? instantOf(last) : new Date(window.from)) : null
  const cutDay = cutAt ? dayOf(cutAt) : null
  const unread = (day: string) => cutDay !== null && day > cutDay
  const step = (by: -1 | 1) => setAnchor(view === "month" ? shiftMonth(anchor, by) : shift(anchor, by * 7))

  const title = (() => {
    if (view === "month")
      return capital(new Date(`${anchor}T12:00:00`).toLocaleDateString(lang, { month: "long", year: "numeric" }))
    const from = new Date(`${window.days[0]}T12:00:00`)
    const to = new Date(`${window.days.at(-1)}T12:00:00`)
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).formatRange(from, to)
  })()

  const field = (name: string, values: string[]) => setQuery(setField(query, name, values))
  const parsed = useMemo(() => parseQuery(query), [query])
  // Every meeting read in this visit, so suggestions do not shrink to what the query already narrowed the page to.
  const [seen, setSeen] = useState<ReadonlyMap<string, MeetingRow>>(new Map())
  useEffect(() => {
    if (ready?.meetings.some((r) => !seen.has(r.ref)))
      setSeen((s) => new Map([...s, ...ready.meetings.map((r) => [r.ref, r] as const)]))
  }, [ready, seen])
  const values = useMemo(() => meetingValues([...seen.values()], accounts, m), [seen, accounts, m])
  const suggest = useCallback(
    (q: string, cursor: number, all: boolean) => suggestMeetings(q, cursor, all, values, m),
    [values, m],
  )
  const named = useCallback(
    (name: string, value: string) => values.person.find((p) => name === "person" && p.value === value)?.label ?? null,
    [values],
  )
  const filtering = asked !== ""
  const kind = view === "month" ? "month" : "week"

  return (
    <Page fill={calendar}>
      <PageHeader
        title={m.title}
        section="meetings"
        intro={m.intro}
        compact
        actions={
          !gap && (
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<View>
                size="md"
                label={m.view}
                value={view}
                onChange={setView}
                options={[
                  { value: "table", label: m.views.table, icon: <Rows3 className="size-4" aria-hidden /> },
                  { value: "week", label: m.views.week, icon: <CalendarRange className="size-4" aria-hidden /> },
                  { value: "month", label: m.views.month, icon: <CalendarDays className="size-4" aria-hidden /> },
                ]}
              />
              {!read.error && (
                <RefreshButton
                  busy={read.isFetching}
                  onClick={() => void readAgain()}
                  label={m.readAgain}
                  busyLabel={m.readingNow}
                />
              )}
            </div>
          )
        }
      />
      {read.error ? (
        <PageError
          raw={errorText(read.error)}
          what="Reading meetings"
          busy={read.isFetching}
          onRetry={() => void read.refetch()}
        >
          {m.readFailed}
        </PageError>
      ) : gap ? (
        <ToolNeeded gap={gap} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[0.8rem]">
          {calendar && (
            <Toolbar
              title={title}
              anchor={anchor}
              view={kind}
              onToday={() => {
                setAnchor(dayOf(new Date()))
                setJump((j) => j + 1)
              }}
              onStep={step}
              onPick={setAnchor}
              summary={
                ready ? (ready.meetings.length === 0 ? (filtering ? m.noneMatch[kind] : m.none[kind]) : null) : null
              }
              onClear={filtering ? () => setQuery("") : null}
              announce={ready ? m.range(title, ready.meetings.length) : ""}
            />
          )}
          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <QueryBar
              query={query}
              parsed={parsed}
              problems={parsed.problems}
              problem={null}
              suggest={suggest}
              words={{ label: m.search, placeholder: m.searchHint, hint: m.queryHint }}
              docs={queryDocs(lang)}
              onChange={type}
              named={named}
            />
            <div className="flex flex-wrap items-center gap-[0.7rem] pt-[0.3rem]">
              <FilterMenu
                label={m.kind}
                options={MEETING_KINDS.map((k) => ({ value: k, label: m.kinds[k] }))}
                selected={valuesOf(query, "kind")}
                onChange={(v) => field("kind", v)}
              />
              <FilterMenu
                label={m.source}
                single
                options={accounts.map((a) => {
                  const [provider = a, account = ""] = a.split(/:(.*)/s)
                  return { value: a, label: account || provider, icon: <SourceIcon provider={provider} labelled /> }
                })}
                selected={valuesOf(query, "source")}
                onChange={(v) => field("source", v)}
              />
              <ToggleChip
                on={valuesOf(query, "has_transcript").includes("true")}
                onChange={(on) => field("has_transcript", on ? ["true"] : [])}
              >
                {m.withTranscript}
              </ToggleChip>
              {ready && !calendar && (
                <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">
                  {m.found(ready.total, `${formatNumber(ready.total, lang)}${ready.totalMore ? "+" : ""}`)}
                </span>
              )}
            </div>
          </div>
          {cutDay && (
            <NoticeChips
              label={m.views[kind]}
              notices={[
                {
                  id: "cut",
                  tone: "neutral",
                  label: m.cut(
                    (cutAt as Date).toLocaleString(lang, {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  ),
                  body: (
                    <Button size="sm" onClick={() => setView("table")}>
                      {m.views.table}
                    </Button>
                  ),
                },
              ]}
            />
          )}
          {calendar && !ready && <Skeleton className="min-h-[20rem] flex-1 rounded-rack" label={m.reading} />}
          {view === "week" && ready && (
            <WeekView
              days={window.days}
              meetings={ready.meetings}
              unread={unread}
              jump={jump}
              onDay={(day) => {
                setAnchor(day)
                setView("month")
              }}
            />
          )}
          {view === "month" && ready && (
            <MonthView
              days={window.days}
              month={anchor.slice(0, 7)}
              active={window.days.includes(anchor) ? anchor : (window.days[0] as string)}
              meetings={ready.meetings}
              unread={unread}
              onMove={setAnchor}
              onPage={step}
              onDay={(day) => {
                setAnchor(day)
                setView("week")
              }}
            />
          )}
          {view === "table" &&
            (ready && ready.meetings.length === 0 ? (
              filtering ? (
                <EmptyState
                  action={
                    <Button size="sm" onClick={() => setQuery("")}>
                      {m.clear}
                    </Button>
                  }
                >
                  {m.noMatch}
                </EmptyState>
              ) : (
                <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
              )
            ) : (
              <>
                <MeetingsTable rows={ready?.meetings ?? null} busy={read.isFetching} loading={m.reading} />
                {ready && (page > 1 || ready.more || ready.total > PAGE_SIZES[0]) && (
                  <Pager
                    page={page}
                    onPage={setPage}
                    busy={read.isFetching}
                    total={ready.total}
                    totalMore={ready.totalMore}
                    size={size}
                    sizes={PAGE_SIZES}
                    onSize={setSize}
                  />
                )}
              </>
            ))}
        </div>
      )}
      <MeetingDialog />
    </Page>
  )
}

/** Today, back and forward, and the range as a button that opens a calendar to jump to any date. */
function Toolbar(props: {
  title: string
  anchor: string
  view: "week" | "month"
  onToday: () => void
  onStep: (by: -1 | 1) => void
  onPick: (day: string) => void
  summary: string | null
  onClear: (() => void) | null
  announce: string
}) {
  const m = useMessages(meetingMessages)
  const [picking, setPicking] = useState(false)
  const button = useRef<HTMLSpanElement>(null)
  const close = (refocus: boolean) => {
    setPicking(false)
    if (refocus) button.current?.querySelector("button")?.focus()
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={props.onToday}>
        {m.today}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={m.previous[props.view]}
        icon={<ChevronLeft className="size-4" aria-hidden />}
        onClick={() => props.onStep(-1)}
      />
      <Button
        size="sm"
        variant="ghost"
        aria-label={m.next[props.view]}
        icon={<ChevronRight className="size-4" aria-hidden />}
        onClick={() => props.onStep(1)}
      />
      <span ref={button}>
        <Button
          size="sm"
          variant="ghost"
          aria-haspopup="dialog"
          aria-expanded={picking}
          aria-label={`${props.title}, ${m.pickDate}`}
          onClick={() => setPicking((p) => !p)}
          className="text-[1.05rem] text-ink"
        >
          {props.title}
        </Button>
      </span>
      <DatePopover open={picking} anchor={button} label={m.pickDate} onClose={close}>
        <Calendar
          label={m.pickDate}
          selected={{ from: props.anchor }}
          autoFocus
          onPick={(day) => {
            props.onPick(day)
            close(true)
          }}
        />
        <CalendarFooter
          onToday={() => {
            props.onToday()
            close(true)
          }}
        />
      </DatePopover>
      {props.summary && (
        <span className="text-[0.9rem] text-ink-soft">
          {props.summary}
          {props.onClear && (
            <>
              {" "}
              <Button size="sm" variant="secondary" onClick={props.onClear}>
                {m.clear}
              </Button>
            </>
          )}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {props.announce}
      </span>
    </div>
  )
}
