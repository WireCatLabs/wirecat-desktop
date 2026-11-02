import { ChevronLeft, ChevronRight, ExternalLink, Search, X } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { formatWhen, parseQuery } from "@/domain/runs"
import {
  ambiguousTerm,
  clampSpan,
  errorDetail,
  groupHits,
  hitField,
  queryReason,
  quoteValue,
  suggestSearch,
  toggleSearchTerm,
  type ValueOption,
  valuesInHits,
} from "@/domain/search"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { SearchAnswer, SearchHit } from "@/platform/search-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { focusInPlace } from "@/ui/motion"
import { Select } from "@/ui/Select"
import { StableText } from "@/ui/Skeleton"
import { QueryBar } from "../query/QueryBar"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { HitContext } from "./HitContext"
import { HitsTable } from "./HitsTable"
import { searchMessages } from "./messages"
import { QueryDraft } from "./QueryDraft"
import { LIMIT, listKey, missing, useSearch } from "./store"

export const SEARCH_DOCS = "https://github.com/WireCatLabs/cli-core/blob/main/docs/search/query-language.md"

type Words = (typeof searchMessages)["en"]

const searchable = tools.filter((t) => t.search !== null)

export function SearchPage() {
  const m = useMessages(searchMessages)
  const s = useSearch()
  const installs = useTools((t) => t.installs)
  const checked = useTools((t) => t.checked)
  const refreshing = useTools((t) => t.refreshing)

  useEffect(() => {
    if (!checked && !refreshing) useTools.getState().refresh()
  }, [checked, refreshing])

  const installed = searchable.filter((t) => (installs[t.id]?.length ?? 0) > 0)
  const tool = s.tool ? findTool(s.tool) : undefined
  const version = s.tool ? (installs[s.tool]?.[0]?.version ?? null) : null
  const what = tool?.search?.what ?? "messages"
  const parsed = useMemo(() => parseQuery(s.query), [s.query])
  const { suggest, named } = useSuggest(m, version)
  const ids = { tool: useId(), profile: useId(), query: useId(), hint: useId() }
  // Shown only after a search was asked for, and only while the thing is still missing.
  const [tried, setTried] = useState(false)
  const gap = tried ? missing(s) : null
  const noProfiles = Boolean(s.tool) && s.profiles?.length === 0
  const pickerHint = noProfiles
    ? s.profilesError
      ? m.profilesFailed
      : m.noProfiles(tool?.name ?? s.tool ?? "")
    : gap === "tool"
      ? m.needTool
      : gap === "profile"
        ? m.needProfile
        : null

  const submit = () => {
    const now = useSearch.getState()
    if (now.loading) return
    const gone = missing(now)
    setTried(gone !== null)
    if (gone === null) {
      now.search(1)
      return
    }
    if (gone !== "profiles") focusInPlace(document.getElementById(ids[gone]))
  }

  // A query error belongs to the text it was given for; one keystroke later it points at the wrong place.
  const answer = s.answer
  const current = s.asked !== null && s.asked.query === s.query
  const queryError = answer?.kind === "queryError" && current ? answer : null
  const span = queryError ? clampSpan(queryError.span, s.query.length) : null
  const ambiguous = answer?.kind === "failed" && current ? choicesFor(s.query, answer.candidates) : null

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
        <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
          {m.intro}{" "}
          <button
            type="button"
            onClick={() => platform.openUrl(SEARCH_DOCS)}
            className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
          >
            {m.howToSearch}
            <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
          </button>
        </p>
      </div>

      {checked && installed.length === 0 ? (
        <Empty>{m.noTools}</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <Picker id={ids.tool} label={m.tool}>
              {(id) => (
                <Select
                  id={id}
                  size="lg"
                  aria-invalid={gap === "tool"}
                  aria-describedby={gap === "tool" ? ids.hint : undefined}
                  value={s.tool ?? ""}
                  placeholder={m.chooseTool}
                  onChange={(v) => v && s.chooseTool(v)}
                  options={installed.map((t) => {
                    const old = s.old[t.id] === (installs[t.id]?.[0]?.version ?? null)
                    return {
                      value: t.id,
                      label: old ? `${t.name} — ${m.tooOldShort}` : t.name,
                      disabled: old && t.id !== s.tool,
                      icon: <ToolIcon id={t.id} className="size-[1rem] text-ink-soft" />,
                    }
                  })}
                  className="min-w-[12rem]"
                />
              )}
            </Picker>
            {s.profiles !== null && s.tool && (
              <Picker id={ids.profile} label={m.profile}>
                {(id) => (
                  <Select
                    id={id}
                    size="lg"
                    aria-invalid={gap === "profile"}
                    aria-describedby={pickerHint ? ids.hint : undefined}
                    value={s.profile ?? ""}
                    placeholder={s.profiles === undefined ? m.readingProfiles : m.chooseProfile}
                    disabled={!s.profiles?.length}
                    onChange={(v) => v && s.chooseProfile(v)}
                    options={(s.profiles ?? []).map((p) => ({
                      value: p.name,
                      label: p.signedIn === false ? m.signedOut(p.name) : p.name,
                    }))}
                    className="min-w-[12rem]"
                  />
                )}
              </Picker>
            )}
          </div>
          <Collapse open={pickerHint !== null}>
            <ErrorNotice inline>
              <span id={ids.hint}>{pickerHint}</span>
            </ErrorNotice>
          </Collapse>

          {platform.kind === "mock" && (
            <QueryDraft
              tool={s.tool}
              onNeedTool={() => {
                setTried(true)
                focusInPlace(document.getElementById(ids.tool))
              }}
              onWritten={(query) => {
                s.setQuery(query)
                focusInPlace(document.getElementById(ids.query))
              }}
            />
          )}

          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <QueryBar
              inputId={ids.query}
              query={s.query}
              parsed={parsed}
              problems={span ? [span] : ambiguous ? [ambiguous.term] : []}
              problem={
                queryError
                  ? problemText(m, queryError)
                  : ambiguous
                    ? m.pickOne(ambiguous.field)
                    : gap === "query"
                      ? m.needQuery
                      : null
              }
              suggest={suggest}
              named={named}
              words={{
                label: m.searchLabel[what],
                placeholder: m.placeholder[what],
                hint: s.tool === "zm" ? m.wordsOnlyHint : m.hint,
              }}
              docs={SEARCH_DOCS}
              onChange={s.setQuery}
              onSubmit={submit}
            />
            <Button
              variant="primary"
              size="lg"
              className="h-[2.8rem]"
              aria-busy={s.loading}
              onClick={submit}
              icon={<Search className="size-4" aria-hidden />}
            >
              <StableText value={s.loading ? m.searching : m.search} variants={[m.searching, m.search]} />
            </Button>
          </div>

          <Results m={m} version={version} toolName={tool?.name ?? s.tool ?? ""} />
        </>
      )}
    </div>
  )
}

const NO_FIELDS: NonNullable<NonNullable<ReturnType<typeof findTool>>["search"]>["fields"] = []

/** What the bar offers: the tool's fields, their values from its own lists and the results, dates and examples. */
function useSuggest(m: Words, version: string | null) {
  const tool = useSearch((s) => s.tool)
  const profile = useSearch((s) => s.profile)
  const profiles = useSearch((s) => s.profiles)
  const answer = useSearch((s) => s.answer)
  const lists = useSearch((s) => s.lists)
  const search = tool ? findTool(tool)?.search : null
  const fields = search?.fields ?? NO_FIELDS
  const what = search?.what ?? "messages"

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new tool, profile or version asks for its lists
  useEffect(() => useSearch.getState().loadLists(), [tool, profile, profiles, version])

  const values = useMemo(() => {
    const seen = valuesInHits(answer?.kind === "hits" ? answer.hits : [])
    const out: Record<string, ValueOption[]> = {}
    for (const f of fields) {
      if (Array.isArray(f.values)) {
        out[f.name] = f.values.map((value) => ({ value }))
        continue
      }
      const listed =
        typeof f.values === "string" && tool ? (lists[listKey(tool, profile, version, f.values)] ?? []) : []
      const inResults = new Set(seen[f.name] ?? [])
      // Without a list the tool can give (wa's contacts are not the people its search knows), the names the results
      // show; a name two people share comes back as a choice of both.
      if (listed.length === 0) {
        out[f.name] = [...inResults].map((value) => ({ value }))
        continue
      }
      out[f.name] = [
        ...listed.filter((v) => v.label && inResults.has(v.label)),
        ...listed.filter((v) => !(v.label && inResults.has(v.label))),
      ]
    }
    return out
  }, [fields, answer, lists, tool, profile, version])

  const picked = useSearch((s) => s.named)
  const named = useCallback(
    (field: string, value: string) =>
      picked[`${field}:${value}`] ??
      values[field]?.find((v) => v.value === value && v.label && v.label !== value)?.label ??
      null,
    [values, picked],
  )

  const area = what === "documents" ? "notes" : what
  const suggest = useCallback(
    (query: string, cursor: number, all: boolean) =>
      suggestSearch(query, cursor, {
        fields,
        values,
        all,
        now: new Date(),
        what,
        dateWords: m.dates,
        exampleWords: m.examples,
        words: {
          group: m.groups,
          describe: (field) => m.fields[`${area}:${field}`] ?? null,
          more: m.moreFields,
          examplesHeading: m.tryHeading,
          datesHeading: m.datesHeading,
          valuesHeading: m.valuesHeading,
        },
      }),
    [fields, values, what, area, m],
  )
  return { suggest, named }
}

type Candidate = { id: string; label: string | null; field: "chat" | "from" | null }

/** Each candidate as the query with the refused term naming it by id, for a refusal that lists them. */
function choicesFor(query: string, candidates: readonly Candidate[]) {
  const field = candidates.find((c) => c.field)?.field
  if (!field) return null
  const term = ambiguousTerm(
    query,
    field,
    candidates.map((c) => c.label),
  )
  if (!term) return null
  const options = candidates.map((c) => ({
    ...c,
    query: `${query.slice(0, term.start)}${term.sign}${field}:${quoteValue(c.id)}${query.slice(term.end)}`,
  }))
  return { field, term, options }
}

function problemText(m: Words, e: Extract<SearchAnswer, { kind: "queryError" }>): string {
  const reason = queryReason(e.reason)
  if (!reason) return m.toolSaid(e.message)
  const detail = errorDetail(e.message)
  return detail ? `${m.reasons[reason]} ${m.toolSaid(detail)}` : m.reasons[reason]
}

function Results({ m, version, toolName }: { m: Words; version: string | null; toolName: string }) {
  const s = useSearch()
  // biome-ignore lint/correctness/useExhaustiveDependencies: each answer's times are told from when it came
  const now = useMemo(() => new Date(), [s.answer])
  const { view, node } = resultsView(m, s, now, version, toolName)
  return <Crossfade swap={view}>{node}</Crossfade>
}

function resultsView(
  m: Words,
  s: ReturnType<typeof useSearch.getState>,
  now: Date,
  version: string | null,
  toolName: string,
): { view: string; node: ReactNode } {
  const answer = s.answer
  const page = s.asked?.page ?? 1
  if (s.error)
    return {
      view: "error",
      node: (
        <ErrorNotice detail={s.error} action={<ReportThis what={`Searching ${toolName}`} error={s.error} />}>
          {m.failed}
        </ErrorNotice>
      ),
    }
  if (answer?.kind === "old")
    return { view: "old", node: <ErrorNotice detail={answer.message}>{m.tooOld(toolName, version)}</ErrorNotice> }
  if (answer?.kind === "failed") {
    const choices = s.asked?.query === s.query ? choicesFor(s.query, answer.candidates) : null
    return {
      view: "failed",
      node: (
        <ErrorNotice
          detail={<span className="whitespace-pre-line">{answer.message}</span>}
          action={
            choices ? (
              <span className="flex flex-wrap gap-2">
                {choices.options.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    onClick={() => {
                      if (c.label && choices.field) s.remember(choices.field, c.id, c.label)
                      s.setQuery(c.query)
                      s.search(1)
                    }}
                  >
                    {c.label ?? c.id}
                    <span className="font-mono text-[0.85rem] text-ink-dim">{c.id}</span>
                  </Button>
                ))}
              </span>
            ) : (
              <ReportThis what={`Searching ${toolName}`} error={answer.message} />
            )
          }
        >
          {m.failed}
        </ErrorNotice>
      ),
    }
  }
  if (answer?.kind === "queryError") return { view: "queryError", node: <Empty busy={s.loading}>{m.fixQuery}</Empty> }
  const hits = answer?.kind === "hits" ? answer : null
  if (!hits) {
    if (s.loading) return { view: "loading", node: <Table hits={[]} placeholders={8} now={now} busy /> }
    return { view: "start", node: <Empty>{s.profiles === null ? m.startNoProfile : m.start}</Empty> }
  }
  if (hits.hits.length === 0)
    return {
      view: "empty",
      node: (
        <div className="flex flex-col gap-[0.5rem]">
          <Empty busy={s.loading}>{m.noHits(toolName, s.asked?.profile ?? null)}</Empty>
          {hits.notes.map((n) => (
            <p key={n} className="selectable text-[0.9rem] text-ink-dim">
              {n}
            </p>
          ))}
        </div>
      ),
    }

  const pager = hits.paged && (page > 1 || hits.hasMore)
  const node = (
    <div className="flex min-w-0 flex-col gap-[0.7rem]">
      <div aria-live="polite" className="flex flex-col gap-[0.2rem] text-[0.9rem]">
        <p className="text-ink-soft tabular-nums">
          {hits.total
            ? m.shownOf(
                (page - 1) * LIMIT + 1,
                (page - 1) * LIMIT + hits.hits.length,
                hits.total.value,
                hits.total.relation === "gte",
              )
            : m.results(hits.hits.length, page)}
        </p>
        {!hits.paged && hits.hits.length >= LIMIT && <p className="text-ink-dim">{m.bestOnly(LIMIT)}</p>}
        {hits.notes.map((n) => (
          <p key={n} className="selectable text-ink-dim">
            {n}
          </p>
        ))}
      </div>
      {s.groupBy ? (
        <Grouped hits={hits.hits} field={s.groupBy} now={now} m={m} />
      ) : (
        <Table hits={hits.hits} now={now} busy={s.loading} />
      )}
      {pager && (
        <nav aria-label={m.pages} className="flex items-center justify-center gap-3 text-[0.9rem] text-ink-dim">
          <Button
            size="sm"
            disabled={page <= 1 || s.loading}
            onClick={() => s.search(page - 1)}
            icon={<ChevronLeft className="size-4" aria-hidden />}
          >
            {m.previous}
          </Button>
          <span className="min-w-[6rem] text-center tabular-nums">{m.pageN(page)}</span>
          <Button size="sm" disabled={!hits.hasMore || s.loading} onClick={() => s.search(page + 1)}>
            {m.next}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
  return { view: "hits", node }
}

/** Adds the term and searches again: a filter from a result is a new search, not a filter of this page. */
function filterBy(field: string, value: string, negate: boolean) {
  const s = useSearch.getState()
  s.setQuery(toggleSearchTerm(s.query, field, value, negate))
  s.setGroupBy(null)
  s.search(1)
}

function Table(props: { hits: SearchHit[]; placeholders?: number; now: Date; busy: boolean }) {
  const { hits, placeholders = 0, now, busy } = props
  const expanded = useSearch((s) => s.expanded)
  const toggle = useSearch((s) => s.toggle)
  const tool = useSearch((s) => s.tool)
  const known = useMemo(() => (tool ? (findTool(tool)?.search?.fields ?? []).map((f) => f.name) : []), [tool])
  const fieldOf = useCallback((path: string[]) => hitField(path, known), [known])
  return (
    <div
      aria-busy={busy}
      className={cx(
        "overflow-hidden rounded-[0.2rem] border border-line-strong bg-app transition-opacity duration-200",
        busy && hits.length > 0 && "opacity-60",
      )}
    >
      <HitsTable
        hits={hits}
        placeholders={placeholders}
        now={now}
        expanded={expanded}
        onToggle={toggle}
        fieldOf={fieldOf}
        onFilter={filterBy}
        onGroup={useSearch.getState().setGroupBy}
        actions={(hit) =>
          tool ? (
            <HitContext hit={hit} tool={tool} profile={useSearch.getState().asked?.profile ?? null} now={now} />
          ) : null
        }
      />
    </div>
  )
}

function Grouped({ hits, field, now, m }: { hits: SearchHit[]; field: string; now: Date; m: Words }) {
  const lang = useLang()
  const groups = useMemo(() => groupHits(hits, field), [hits, field])
  const max = groups[0]?.count ?? 1
  return (
    <div className="reveal overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex items-center justify-between gap-3 border-line border-b px-[1.3rem] py-[0.5rem] text-[0.9rem]">
        <span className="text-ink-soft">{m.groupedBy(field, hits.length)}</span>
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="size-4" aria-hidden />}
          onClick={() => useSearch.getState().setGroupBy(null)}
        >
          {m.ungroup}
        </Button>
      </div>
      <table className="w-full table-fixed border-collapse text-[0.95rem]">
        <colgroup>
          <col />
          <col className="w-[30%]" />
          <col className="w-[6rem]" />
          <col className="w-[9rem]" />
        </colgroup>
        <thead>
          <tr className="border-line-strong border-b text-left text-[0.9rem] text-ink-dim">
            <th className="py-[0.55rem] pl-[1.3rem] font-medium font-mono">{field}</th>
            <th>
              <span className="sr-only">{m.share}</span>
            </th>
            <th className="pr-[0.9rem] text-right font-medium">{m.count}</th>
            <th className="pr-[1.3rem] font-medium">{m.latest}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.value} className="h-[2.6rem] border-line border-b last:border-b-0">
              <td className="pl-[0.8rem]">
                {g.value === "" ? (
                  <span className="px-[0.5rem] text-ink-dim">{m.without(field)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterBy(field, g.value, false)}
                    title={m.showOnly(`${field}:${quoteValue(g.value)}`)}
                    className="flex w-full min-w-0 items-center rounded-[0.3rem] px-[0.5rem] py-[0.3rem] text-left hover:bg-app-3"
                  >
                    <span className="truncate">{g.value}</span>
                  </button>
                )}
              </td>
              <td aria-hidden>
                <span className="block h-[0.45rem] rounded-full bg-app-3">
                  <span
                    className="block h-full rounded-full bg-ink-soft/45"
                    style={{ width: `${Math.max(2, (g.count / max) * 100)}%` }}
                  />
                </span>
              </td>
              <td className="pr-[0.9rem] text-right font-mono tabular-nums">{g.count}</td>
              <td className="truncate pr-[1.3rem] font-mono text-[0.9rem] text-ink-soft tabular-nums">
                {g.last ? formatWhen(g.last, now, lang) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Picker({ id, label, children }: { id: string; label: string; children: (id: string) => ReactNode }) {
  return (
    <div className="flex h-[2.8rem] items-center gap-[0.5rem]">
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-[0.95rem] text-ink-dim">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function Empty({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <p
      aria-busy={busy}
      className={cx(
        "rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.6rem] text-[0.95rem] text-ink-soft transition-opacity duration-200",
        busy && "opacity-60",
      )}
    >
      {children}
    </p>
  )
}
