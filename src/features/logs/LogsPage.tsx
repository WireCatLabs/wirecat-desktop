import { ArrowUp, Settings2, SlidersHorizontal } from "lucide-react"
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { tools } from "@/domain/catalog"
import {
  CONVERSATION,
  conversations,
  FACETS,
  facetCounts,
  formatDay,
  groupRuns,
  inRange,
  matcher,
  NO_COMMAND,
  newestFirst,
  parseQuery,
  RANGES,
  type RangeId,
  type Run,
  STORE_KIND,
  suggest,
  toggleTerm,
  unknownFields,
  withConversations,
  withZeros,
} from "@/domain/runs"
import { QueryBar } from "@/features/query"
import { useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import { Page, PageHeader } from "@/shared/Page"
import { useNow } from "@/shared/use-elapsed"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp } from "@/ui/Lamp"
import { reducedMotion } from "@/ui/motion"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { ProgressBar } from "@/ui/ProgressBar"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { Facets } from "./Facets"
import { Groups } from "./Groups"
import { LogSettings, settingsTone } from "./LogSettings"
import { useLive } from "./live"
import { logsMessages } from "./messages"
import { fieldLabel, logsDocs, problemText, toolName } from "./names"
import { RunsTable } from "./RunsTable"
import { runKey, type Source, useLogs, useShownLogs } from "./store"

const FIELDS = [
  ...Object.keys(logsMessages.en.fields),
  "run_id",
  "operations",
  "codes",
  "duration_ms",
  "requests",
  "provider_error",
  "partial.failures.error_code",
  "unknown_command",
  "error.code",
  "error.provider.key",
  "error.http.endpoint_template",
]
const NONE = new Set<string>()

export function LogsPage() {
  const m = useMessages(logsMessages)
  const lang = useLang()
  const { loadedAt, liveRound, reading, asked, live, query, range, groupBy, expanded, details } = useLogs(
    useShallow((s) => ({
      loadedAt: s.loadedAt,
      liveRound: s.liveRound,
      reading: s.reading,
      asked: s.asked,
      live: s.live,
      query: s.query,
      range: s.range,
      groupBy: s.groupBy,
      expanded: s.expanded,
      details: s.details,
    })),
  )
  const sources = useShownLogs((s) => s.sources)
  const keeping = useShownLogs((s) => s.keeping)
  const { load, setQuery, setRange, setGroupBy, toggle, setLive } = useLogs.getState()
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [facetsOpen, setFacetsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsId = useId()
  const deferred = useDeferredValue(query)
  useLive(live)

  useEffect(() => {
    if (Object.keys(useLogs.getState().sources).length === 0) load()
  }, [load])

  const list = useMemo(() => Object.values(sources), [sources])
  // A tool with no runs yet, Email among them until memo records a mail command, is still a choice in the filter.
  const toolIds = useMemo(() => {
    const owners = Object.keys(sources)
    return [...owners, ...tools.filter((t) => t.partOf && owners.includes(t.partOf)).map((t) => t.id)]
  }, [sources])
  const older = list.filter((s) => s.state === "loading")
  const withLogs = list.filter((s) => s.state !== "none" && s.state !== "missing")
  const firstLoad = loadedAt === null
  const now = useMemo(() => new Date(loadedAt ?? Date.now()), [loadedAt])

  // A live round's new runs go on top. Under a reader who scrolled down or turned the page they wait behind a "new
  // runs" button, because inserting them would push the rows being read out of place.
  const tableRef = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const [released, setReleased] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `released` asks to show held runs again
  const { all, held, fresh } = useMemo(() => {
    const runs = list.flatMap((s) => s.runs)
    const before = seen.current
    if (!liveRound || before === null) return { all: runs, held: 0, fresh: NONE }
    const isNew = (r: Run) => !before.has(runKey(r))
    if (page > 1 || scrolledPast(tableRef.current)) {
      const kept = runs.filter((r) => !isNew(r))
      return { all: kept, held: runs.length - kept.length, fresh: NONE }
    }
    return { all: runs, held: 0, fresh: new Set(runs.filter(isNew).map(runKey)) }
  }, [list, liveRound, released, page])
  useEffect(() => {
    if (held === 0) seen.current = new Set(all.map(runKey))
  }, [all, held])
  const showHeld = () => {
    setPage(1)
    tableRef.current?.closest("main")?.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
    setReleased((n) => n + 1)
  }

  const keyed = useMemo(() => withConversations(all), [all])
  const ranged = useMemo(() => inRange(keyed, range, loadedAt ?? Date.now()), [keyed, range, loadedAt])
  const parsed = useMemo(() => parseQuery(deferred), [deferred])
  const problems = useMemo(() => [...parsed.problems, ...unknownFields(parsed, all)], [parsed, all])
  const suggestRuns = useCallback(
    (q: string, at: number) => {
      const found = suggest(q, at, ranged, FIELDS, m.fields)
      return { ...found, items: found.items.map((i) => ({ label: i.label, insert: i.insert, note: i.hint })) }
    },
    [ranged, m],
  )
  const matched = useMemo(() => {
    const rows = ranged.filter(matcher(parsed.terms))
    rows.sort(newestFirst)
    return newest ? rows : rows.reverse()
  }, [ranged, parsed, newest])
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FACETS.map((f) => {
          const c = facetCounts(ranged, parsed.terms, f)
          return [f, f === "tool" ? withZeros(c, toolIds) : f === "kind" ? withZeros(c, [STORE_KIND]) : c]
        }),
      ),
    [ranged, parsed, toolIds],
  )
  const byConversation = groupBy === CONVERSATION
  const groups = useMemo(
    () => (groupBy && groupBy !== CONVERSATION ? groupRuns(matched, groupBy) : []),
    [matched, groupBy],
  )
  const every = useMemo(() => {
    if (!byConversation) return []
    const found = conversations(matched)
    return newest ? found : found.reverse()
  }, [byConversation, matched, newest])
  // By conversation a page holds whole conversations, so one is never cut in half.
  const rows = byConversation ? every.length : matched.length
  const at = Math.min(page, Math.max(1, Math.ceil(rows / size)))
  const sections = every.slice((at - 1) * size, at * size)
  const bareHidden = useMemo(() => {
    const hides = parsed.terms.some((t) => t.kind === "field" && t.field === NO_COMMAND && t.negate)
    return hides ? ranged.filter(matcher(parsed.terms, NO_COMMAND)).length - matched.length : 0
  }, [parsed, ranged, matched])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new filter starts the list from the top again
  useEffect(() => setPage(1), [deferred, range, newest, groupBy])

  const onFilter = (field: string, value: string, negate: boolean) => setQuery(toggleTerm(query, field, value, negate))
  const onFlip = (field: string, values: readonly string[]) =>
    setQuery(values.reduce((q, v) => toggleTerm(q, field, v), query))
  const failed = all.filter((r) => r.status === "failed").length
  const oldest = all.reduce((min, r) => (r.started_at < min ? r.started_at : min), all[0]?.started_at ?? "")
  const trouble = settingsTone(sources, keeping)

  return (
    // Measured on the page, not the window: the filter column shows only where the runs table still fits beside it.
    <Page className="@container">
      {/* One box for the header and the panel under it, so the page's gap does not appear at once as it opens. */}
      <div>
        <PageHeader
          title={m.title}
          intro={m.intro}
          guide={{ label: m.howToSearch, href: logsDocs(lang) }}
          actions={
            <>
              <Freshness at={loadedAt} reading={reading.length} asked={asked} />
              <Button
                size="sm"
                aria-expanded={settingsOpen}
                aria-controls={settingsId}
                onClick={() => setSettingsOpen(!settingsOpen)}
                icon={<Settings2 className="size-4" aria-hidden />}
              >
                {m.settings}
                {trouble && <Lamp tone={trouble} size="sm" label={m.settingsTrouble} />}
                <ExpandChevron open={settingsOpen} className="-mr-1" />
              </Button>
              <Button
                size="sm"
                aria-pressed={live}
                onClick={() => setLive(!live)}
                title={live ? m.liveStop : m.liveStart}
                icon={
                  <span
                    aria-hidden
                    className={cx(
                      "size-[0.6rem] rounded-full",
                      live
                        ? "animate-[lamp-pulse_1.4s_ease-in-out_infinite] bg-ok"
                        : "ring-[1.5px] ring-idle ring-inset",
                    )}
                  />
                }
              >
                {m.live}
              </Button>
              <RefreshButton
                busy={reading.length > 0}
                onClick={() => load()}
                label={m.readAgain}
                busyLabel={m.reading}
              />
            </>
          }
        />

        <Collapse open={settingsOpen} className="pt-[1.2rem]">
          <LogSettings id={settingsId} />
        </Collapse>
      </div>

      {withLogs.length === 0 && list.length > 0 ? (
        <EmptyState>{m.noLogs}</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <QueryBar
              query={query}
              parsed={parsed}
              problems={problems}
              problem={problems[0] ? problemText(m, problems[0]) : null}
              suggest={suggestRuns}
              words={{ label: m.searchRuns, placeholder: m.placeholder, hint: m.searchHint }}
              docs={logsDocs(lang)}
              onChange={setQuery}
            />
            <Range value={range} onChange={setRange} />
            <GroupBy value={groupBy} onChange={setGroupBy} />
            <Button
              size="sm"
              variant="ghost"
              className="mt-[0.4rem] @min-[71rem]:hidden"
              aria-expanded={facetsOpen}
              onClick={() => setFacetsOpen(!facetsOpen)}
              icon={<SlidersHorizontal className="size-4" aria-hidden />}
            >
              {m.facets}
            </Button>
          </div>

          {firstLoad ? (
            <Loading
              reading={asked ? reading : withLogs.map((s) => s.id)}
              total={asked || withLogs.length}
              facetsOpen={facetsOpen}
              newest={newest}
            />
          ) : (
            <div className="grid gap-[1.5rem] @min-[71rem]:grid-cols-[13.5rem_minmax(0,1fr)]">
              <div className={cx(facetsOpen ? "block" : "hidden", "@min-[71rem]:block")}>
                <Facets
                  counts={counts}
                  terms={parsed.terms}
                  total={ranged.length}
                  groupBy={groupBy}
                  onToggle={onFilter}
                  onFlip={onFlip}
                  onGroup={setGroupBy}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-[0.7rem]">
                <Summary
                  matched={matched.length}
                  total={all.length}
                  failed={failed}
                  since={oldest}
                  reading={older}
                  grouped={byConversation ? every.length : groupBy ? groups.length : null}
                  byConversation={byConversation}
                  bareHidden={bareHidden}
                  onShowBare={() => setQuery(toggleTerm(query, NO_COMMAND, "true", true))}
                />
                <div className="sticky top-[0.8rem] z-10 -mb-[0.7rem] flex h-0 justify-center">
                  {held > 0 && (
                    <Button size="sm" variant="primary" className="reveal shadow-panel" onClick={showHeld}>
                      <ArrowUp className="size-4" aria-hidden />
                      {m.newRuns(held)}
                    </Button>
                  )}
                </div>
                <div ref={tableRef} className="overflow-hidden rounded-rack border border-line-strong bg-app">
                  {matched.length === 0 ? (
                    <p className="flex flex-wrap items-center gap-3 px-[1.3rem] py-[1.6rem] text-[0.95rem] text-ink-soft">
                      {all.length === 0 ? m.nothingRecorded : m.noMatch}
                      {query && (
                        <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                          {m.clearSearch}
                        </Button>
                      )}
                      {range !== "all" && all.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setRange("all")}>
                          {m.lookAtAll}
                        </Button>
                      )}
                    </p>
                  ) : byConversation ? (
                    <RunsTable
                      runs={[]}
                      sections={sections}
                      fresh={fresh}
                      now={now}
                      expanded={expanded}
                      details={details}
                      newest={newest}
                      onSort={() => setNewest(!newest)}
                      onToggle={toggle}
                      onFilter={onFilter}
                      onGroup={setGroupBy}
                    />
                  ) : groupBy ? (
                    <Groups
                      field={groupBy}
                      groups={groups}
                      now={now}
                      onPick={(value) => {
                        setQuery(toggleTerm(query, groupBy, value))
                        setGroupBy(null)
                      }}
                    />
                  ) : (
                    <RunsTable
                      runs={matched.slice((at - 1) * size, at * size)}
                      fresh={fresh}
                      now={now}
                      expanded={expanded}
                      details={details}
                      newest={newest}
                      onSort={() => setNewest(!newest)}
                      onToggle={toggle}
                      onFilter={onFilter}
                      onGroup={setGroupBy}
                    />
                  )}
                </div>
                {(!groupBy || byConversation) && rows > PAGE_SIZES[0] && (
                  <Pager
                    page={at}
                    onPage={setPage}
                    total={rows}
                    size={size}
                    sizes={PAGE_SIZES}
                    onSize={(n) => {
                      setSize(n)
                      setPage(1)
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  )
}

// The table's own header and rows at their real height, so the first tool's runs land where the placeholders were.
const PLACEHOLDER_ROWS = 20

function Loading(props: { reading: string[]; total: number; facetsOpen: boolean; newest: boolean }) {
  const { reading, total, facetsOpen, newest } = props
  const m = useMessages(logsMessages)
  const done = total - reading.length
  return (
    <div className="grid gap-[1.5rem] @min-[71rem]:grid-cols-[13.5rem_minmax(0,1fr)]">
      <div className={cx(facetsOpen ? "flex" : "hidden", "flex-col gap-[1.1rem] @min-[71rem]:flex")}>
        <Skeleton className="h-[2.6rem] w-full" />
        {FACETS.map((f) => (
          <Skeleton key={f} className="h-[9rem] w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-[0.7rem]">
        <p className="flex flex-wrap items-center gap-x-[0.6rem] text-[0.9rem] text-ink-soft">
          <ProgressBar label={m.toolsRead} value={done} max={total} size="line" minShare={8} className="w-[8rem]" />
          <span className="tabular-nums">{m.toolsDone(done, total, reading.map(toolName))}</span>
        </p>
        <div className="overflow-hidden rounded-rack border border-line-strong bg-app">
          <RunsTable
            runs={[]}
            placeholders={PLACEHOLDER_ROWS}
            now={new Date()}
            expanded={null}
            details={{}}
            newest={newest}
            onSort={() => {}}
            onToggle={() => {}}
            onFilter={() => {}}
            onGroup={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

function Summary(props: {
  matched: number
  total: number
  failed: number
  since: string
  reading: Source[]
  grouped: number | null
  byConversation: boolean
  bareHidden: number
  onShowBare: () => void
}) {
  const { matched, total, failed, since, reading, grouped, byConversation, bareHidden, onShowBare } = props
  const m = useMessages(logsMessages)
  const lang = useLang()
  const count = <strong className="font-mono font-semibold text-ink tabular-nums">{matched}</strong>
  return (
    <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-[0.6rem] text-[0.9rem] text-ink-soft">
      <span>
        {grouped === null
          ? m.matches(matched, count)
          : byConversation
            ? m.matchesInConversations(matched, count, grouped)
            : m.matchesInGroups(matched, count, grouped)}
      </span>
      {total > 0 && (
        <span className="text-ink-dim">{m.over(total, since ? formatDay(since, lang) : null, failed)}</span>
      )}
      {bareHidden > 0 && (
        <span className="text-ink-dim tabular-nums">
          {m.bareHidden(bareHidden)}{" "}
          <button type="button" onClick={onShowBare} className="font-medium text-brand hover:text-brand-hover">
            {m.showThem}
          </button>
        </span>
      )}
      {reading.length > 0 && (
        <span className="inline-flex items-center gap-[0.4rem] text-ink-dim">
          <Lamp tone="busy" size="sm" />
          {m.stillReading(reading.map((s) => toolName(s.id)))}
        </span>
      )}
    </p>
  )
}

const scrolledPast = (el: HTMLElement | null) => {
  const main = el?.closest("main")
  return Boolean(el && main && el.getBoundingClientRect().top < main.getBoundingClientRect().top)
}

// Its own one-second clock, so only this line renders again as the time passes.
function Freshness({ at, reading, asked }: { at: number | null; reading: number; asked: number }) {
  const m = useMessages(logsMessages)
  const lang = useLang()
  const now = useNow(true)
  const text = at === null ? "" : reading ? m.readingTools(asked - reading, asked) : m.updated(ago(at, now, lang))
  return <span className="min-w-[10.5rem] text-right text-[0.9rem] text-ink-dim tabular-nums">{text}</span>
}

function Range({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) {
  const m = useMessages(logsMessages)
  return (
    <Segmented<RangeId>
      size="lg"
      label={m.timeRange}
      value={value}
      onChange={onChange}
      options={RANGES.map((r) => ({ value: r.id, label: m.ranges[r.id] }))}
    />
  )
}

const GROUPABLE: string[] = [CONVERSATION, ...FACETS, "cli_version"]

function GroupBy({ value, onChange }: { value: string | null; onChange: (f: string | null) => void }) {
  const m = useMessages(logsMessages)
  const id = useId()
  return (
    <div className="flex h-[2.8rem] items-center gap-[0.5rem]">
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-[0.95rem] text-ink-dim">
        {m.groupBy}
      </label>
      <Select
        id={id}
        size="lg"
        value={value ?? ""}
        onChange={(f) => onChange(f || null)}
        options={[
          { value: "", label: m.nothing },
          ...[...GROUPABLE, ...(value && !GROUPABLE.includes(value) ? [value] : [])].map((f) => ({
            value: f,
            label: fieldLabel(m, f),
          })),
        ]}
        className="min-w-[9rem]"
      />
    </div>
  )
}
