import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Rows3 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { dayOf, shift, shiftMonth, weekStart } from "@/domain/days"
import { monthWindow, weekWindow } from "@/domain/meeting-layout"
import { gapFromRead } from "@/domain/needs"
import { setField, valuesOf } from "@/domain/query-terms"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { MeetingsRead } from "@/platform/bindings"
import { errorText } from "@/shared/errors"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { SourceIcon } from "@/shared/SourceIcon"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { Calendar, DatePopover } from "@/ui/Calendar"
import { EmptyState } from "@/ui/EmptyState"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { NoticeChips } from "@/ui/NoticeChips"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { readAgain, useMeetingsPage, useMeetingsWindow } from "./api"
import { MeetingDialog } from "./MeetingDialog"
import { MeetingsTable } from "./MeetingsTable"
import { MonthView } from "./MonthView"
import { MEETING_KINDS, meetingMessages } from "./messages"
import { useMeetings, type View } from "./store"
import { WeekView } from "./WeekView"

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

  // Rows come oldest first; when the cap cut the window, the days after the last row read are not known.
  const cutDay = calendar && ready?.more ? dayOf(new Date(ready.meetings.at(-1)?.startedAt ?? window.from)) : null
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
          !gap &&
          !read.error && (
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
              <RefreshButton
                busy={read.isFetching}
                onClick={() => void readAgain()}
                label={m.readAgain}
                busyLabel={m.readingNow}
              />
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
          <FilterBar
            inline
            query={query}
            onQuery={type}
            onClear={() => setQuery("")}
            label={m.search}
            placeholder={m.searchHint}
          >
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
              <span className="ml-auto font-mono text-[0.85rem] text-ink-dim tabular-nums">
                {m.found(ready.total, `${formatNumber(ready.total, lang)}${ready.totalMore ? "+" : ""}`)}
              </span>
            )}
          </FilterBar>
          {cutDay && (
            <NoticeChips
              label={m.views[kind]}
              notices={[
                {
                  id: "cut",
                  tone: "neutral",
                  label: m.cut(
                    new Date(`${cutDay}T12:00:00`).toLocaleDateString(lang, { day: "numeric", month: "long" }),
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
          {view === "week" && (
            <WeekView
              days={window.days}
              meetings={ready?.meetings ?? []}
              unread={unread}
              jump={jump}
              onDay={(day) => {
                setAnchor(day)
                setView("month")
              }}
            />
          )}
          {view === "month" && (
            <MonthView
              days={window.days}
              month={anchor.slice(0, 7)}
              active={window.days.includes(anchor) ? anchor : (window.days[0] as string)}
              meetings={ready?.meetings ?? []}
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
  const button = useRef<HTMLButtonElement>(null)
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
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={picking}
        aria-label={`${props.title}, ${m.pickDate}`}
        onClick={() => setPicking((p) => !p)}
        className="cursor-pointer rounded-control px-[0.4rem] font-medium text-[1.05rem] hover:bg-app-2"
      >
        {props.title}
      </button>
      <DatePopover
        open={picking}
        anchor={button}
        label={m.pickDate}
        onClose={(refocus) => {
          setPicking(false)
          if (refocus) button.current?.focus()
        }}
      >
        <Calendar
          label={m.pickDate}
          selected={{ from: props.anchor }}
          autoFocus
          onPick={(day) => {
            props.onPick(day)
            setPicking(false)
            button.current?.focus()
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
