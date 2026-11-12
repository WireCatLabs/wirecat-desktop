import { AlertTriangle, Search, Sparkles, X } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { findTool, tools } from "@/domain/catalog"
import { groupDigits } from "@/domain/format"
import { formatUsd } from "@/domain/mail-agent"
import { formatWhen, parseQuery } from "@/domain/runs"
import {
  clampSpan,
  errorDetail,
  groupHits,
  hitField,
  mergeValues,
  type NameChoices,
  nameChoices,
  queryReason,
  quoteValue,
  suggestSearch,
  toggleSearchTerm,
  type ValueOption,
  valuesInHits,
} from "@/domain/search"
import { QueryBar } from "@/features/query"
import { providerName, useSearchHarder } from "@/features/tools"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { HarderAnswer, SearchAnswer, SearchHit } from "@/platform/search-schemas"
import { accountTitle, useAccountNames } from "@/shared/account-names-store"
import { DemoNote } from "@/shared/DemoNote"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ReportThis } from "@/shared/ReportThis"
import { ToolIcon } from "@/shared/ToolIcon"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { uiMessages } from "@/ui/messages"
import { focusInPlace } from "@/ui/motion"
import { Pager } from "@/ui/Pager"
import { Select } from "@/ui/Select"
import { StableText } from "@/ui/Skeleton"
import { useMessageCounts, useSearchValues } from "./api"
import { HitContext } from "./HitContext"
import { HitsTable } from "./HitsTable"
import { searchMessages } from "./messages"
import { NameChoiceButtons } from "./NameChoices"
import { QueryDraft } from "./QueryDraft"
import { LIMIT, missing, useSearch } from "./store"

/** The site's guide to searching, and its page on the query language every tool shares (cli-core). */
const searchGuide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/search`
const queryDocs = (lang: Lang) => `https://wirecat.dev/${lang}/docs/tg/query-language`

type Words = (typeof searchMessages)["en"]

const searchable = tools.filter((t) => t.search !== null)

export function SearchPage() {
  const m = useMessages(searchMessages)
  const lang = useLang()
  const s = useSearch()
  const names = useAccountNames((n) => n.names)
  const installs = useTools((t) => t.installs)
  const checked = useTools((t) => t.checked)
  const refreshing = useTools((t) => t.refreshing)

  useEffect(() => {
    if (!checked && !refreshing) useTools.getState().refresh()
  }, [checked, refreshing])

  // The tour's example tool is offered even when it is not installed, so its example results read whole.
  const installed = useMemo(
    () => searchable.filter((t) => (installs[t.id]?.length ?? 0) > 0 || (s.demo && t.id === s.tool)),
    [installs, s.demo, s.tool],
  )
  const tool = s.tool ? findTool(s.tool) : undefined
  // Asked as soon as memo is chosen, so the Search harder row is known before the hits arrive.
  useSearchHarder(s.tool ?? "", Boolean(tool?.searchHarder) && !s.demo)
  const version = s.tool ? (installs[s.tool]?.[0]?.version ?? null) : null
  const what = tool?.search?.what ?? "messages"
  const parsed = useMemo(() => parseQuery(s.query), [s.query])
  const { suggest, named, values } = useSuggest(m, version, installed)
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

  // Null until a search could run: the draft is tried on the same tool and profile before it is offered.
  const { tool: chosen, profile, profiles } = s
  const check = useMemo(() => {
    if (!chosen || (profiles !== null && !profile)) return null
    return (query: string) => platform.searchStore(chosen, profiles === null ? null : profile, query, 1, 1)
  }, [chosen, profile, profiles])

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
  const choices =
    answer?.kind === "failed" && current ? nameChoices(s.query, answer.message, answer.candidates, values) : null

  return (
    <Page>
      <PageHeader title={m.title} intro={m.intro} guide={{ label: m.howToSearch, href: searchGuide(lang) }} />

      {s.demo && <DemoNote />}
      {checked && installed.length === 0 && searchable[0] ? (
        <ToolNeeded gap={{ kind: "missing", tool: searchable[0].id, others: searchable.slice(1).map((t) => t.id) }} />
      ) : (
        <div inert={s.demo || undefined} className="contents">
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
                    options={(s.profiles ?? []).map((p) => {
                      const title = s.tool ? accountTitle(names, s.tool, p.name) : p.name
                      return { value: p.name, label: p.signedIn === false ? m.signedOut(title) : title }
                    })}
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

          <div data-tour="search-ask" className="flex flex-col gap-[1.5rem]">
            <QueryDraft
              tool={s.tool}
              example={s.demo ? s.demoAsk : null}
              check={check}
              values={values}
              onNeedTool={() => {
                setTried(true)
                focusInPlace(document.getElementById(ids[s.tool ? "profile" : "tool"]))
              }}
              onWritten={(query, name) => {
                if (name) s.remember(name.field, name.id, name.label)
                s.setQuery(query)
                focusInPlace(document.getElementById(ids.query))
              }}
            />

            <div className="flex flex-wrap items-start gap-[0.7rem]">
              <QueryBar
                inputId={ids.query}
                query={s.query}
                parsed={parsed}
                problems={span ? [span] : choices ? [choices.term] : []}
                problem={
                  queryError
                    ? problemText(m, queryError)
                    : choices
                      ? m.pickOne(
                          choices.field,
                          choices.typed,
                          choices.options.some((o) => o.count),
                        )
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
                docs={queryDocs(lang)}
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
          </div>

          <Results m={m} version={version} toolName={tool?.name ?? s.tool ?? ""} choices={choices} />
        </div>
      )}
    </Page>
  )
}

type SearchTool = (typeof searchable)[number]
type Fields = NonNullable<SearchTool["search"]>["fields"]

/** Before a tool is chosen, the keys of every installed one, once each, so the bar still offers keys to start from. */
function fieldsOf(tool: SearchTool | undefined, installed: readonly SearchTool[]): { fields: Fields; what: string } {
  if (tool?.search) return { fields: tool.search.fields, what: tool.search.what }
  const seen = new Set<string>()
  const fields = installed.flatMap((t) => (t.search?.fields ?? []).filter((f) => !seen.has(f.name) && seen.add(f.name)))
  const what = installed.some((t) => t.search?.what === "messages") ? "messages" : (installed[0]?.search?.what ?? "")
  return { fields, what }
}

/**
 * What the bar offers: the keys the owner uses most, then the tool's others; each key's values from its own lists,
 * the results and the message counts, most messages first; dates.
 */
function useSuggest(m: Words, version: string | null, installed: readonly SearchTool[]) {
  const tool = useSearch((s) => s.tool)
  const profile = useSearch((s) => s.profile)
  const profiles = useSearch((s) => s.profiles)
  const answer = useSearch((s) => s.answer)
  const demo = useSearch((s) => s.demo)
  const used = useSearch((s) => s.usedKeys)
  const lists = useSearchValues({ tool, profile, profiles, version, demo })
  const { fields, what } = useMemo(() => fieldsOf(tool ? findTool(tool) : undefined, installed), [tool, installed])
  const counts = useMessageCounts({
    tool,
    profile: profiles === null ? null : profile,
    messages: Boolean(tool) && what === "messages",
    demo,
  })

  const values = useMemo(() => {
    const seen = valuesInHits(answer?.kind === "hits" ? answer.hits : [])
    const out: Record<string, ValueOption[]> = {}
    for (const f of fields) {
      if (Array.isArray(f.values)) {
        out[f.name] = f.values.map((value) => ({ value }))
        continue
      }
      const counted = f.name === "from" ? counts.sender : f.name === "chat" ? counts.chat : []
      const howMany = new Map(counted.map((c) => [c.value, c.count]))
      // People who write only in groups are missing from the contact list; every chat is in the chat list.
      const extra = f.name === "from" ? counted : []
      const listed = (typeof f.values === "string" ? (lists[f.values] ?? []) : []).map((v) => ({
        ...v,
        count: howMany.get(v.value) ?? null,
      }))
      const inResults = new Set(seen[f.name] ?? [])
      // Without a list the tool can give (wa's contacts are not the people its search knows), the names the results
      // show; a name two people share comes back as a choice of both.
      if (listed.length === 0 && extra.length === 0) {
        out[f.name] = [...inResults].map((value) => ({ value }))
        continue
      }
      out[f.name] = mergeValues(
        listed.filter((v) => v.label && inResults.has(v.label)),
        listed.filter((v) => !(v.label && inResults.has(v.label))),
        extra,
      )
    }
    return out
  }, [fields, answer, lists, counts])

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
        used,
        all,
        now: new Date(),
        what,
        dateWords: m.dates,
        words: {
          group: m.groups,
          // Before a tool is chosen a key may come from another kind of data: notes' title, mail's subject.
          describe: (field) =>
            m.fields[`${area}:${field}`] ??
            Object.entries(m.fields).find(([key]) => key.endsWith(`:${field}`))?.[1] ??
            null,
          more: m.moreFields,
          popularHeading: m.popularHeading,
          datesHeading: m.datesHeading,
          valuesHeading: m.valuesHeading,
          count: m.messageCount,
        },
      }),
    [fields, values, used, what, area, m],
  )
  return { suggest, named, values }
}

/** The tool's own words, folded away as every notice keeps them. */
function RawDetails({ text }: { text: string }) {
  const ui = useMessages(uiMessages)
  return (
    <div className="text-[0.9rem]">
      <Disclosure summary={ui.details}>
        <p className="selectable whitespace-pre-wrap break-words">{text}</p>
      </Disclosure>
    </div>
  )
}

function problemText(m: Words, e: Extract<SearchAnswer, { kind: "queryError" }>): string {
  const reason = queryReason(e.reason)
  if (!reason) return m.toolSaid(e.message)
  const detail = errorDetail(e.message)
  return detail ? `${m.reasons[reason]} ${m.toolSaid(detail)}` : m.reasons[reason]
}

function Results(props: { m: Words; version: string | null; toolName: string; choices: NameChoices | null }) {
  const { m, version, toolName, choices } = props
  const s = useSearch()
  // biome-ignore lint/correctness/useExhaustiveDependencies: each answer's times are told from when it came
  const now = useMemo(() => new Date(), [s.answer])
  const { view, node } = resultsView(m, s, now, version, toolName, choices)
  return <Crossfade swap={view}>{node}</Crossfade>
}

function resultsView(
  m: Words,
  s: ReturnType<typeof useSearch.getState>,
  now: Date,
  version: string | null,
  toolName: string,
  choices: NameChoices | null,
): { view: string; node: ReactNode } {
  const answer = s.answer
  const page = s.asked?.page ?? 1
  if (s.error)
    return {
      view: "error",
      node: (
        <PageError raw={s.error} what={`Searching ${toolName}`} busy={s.loading} onRetry={() => s.search(page)}>
          {m.failed}
        </PageError>
      ),
    }
  if (answer?.kind === "old")
    return {
      view: "old",
      node: s.tool ? (
        <ToolNeeded gap={{ kind: "old", tool: s.tool, version, need: null }}>
          <RawDetails text={answer.message} />
        </ToolNeeded>
      ) : null,
    }
  if (answer?.kind === "failed")
    return {
      view: "failed",
      node: (
        <ErrorNotice
          raw={answer.message}
          action={
            choices ? (
              <NameChoiceButtons
                tool={s.tool}
                choices={choices}
                onPick={(c) => {
                  if (c.label) s.remember(choices.field, c.value, c.label)
                  s.setQuery(c.query)
                  s.search(1)
                }}
              />
            ) : (
              <ReportThis what={`Searching ${toolName}`} error={answer.message} />
            )
          }
        >
          {m.failed}
        </ErrorNotice>
      ),
    }
  if (answer?.kind === "timedOut")
    return {
      view: "timedOut",
      node: (
        <ErrorNotice
          raw={answer.message}
          action={
            <Button size="sm" onClick={() => s.search(page)}>
              {m.tryAgain}
            </Button>
          }
        >
          {m.timedOut(answer.seconds)}
        </ErrorNotice>
      ),
    }
  if (answer?.kind === "queryError")
    return { view: "queryError", node: <EmptyState busy={s.loading}>{m.fixQuery}</EmptyState> }
  const hits = answer?.kind === "hits" ? answer : null
  if (!hits) {
    if (s.loading) return { view: "loading", node: <Table hits={[]} placeholders={8} now={now} busy /> }
    return { view: "start", node: <EmptyState>{s.profiles === null ? m.startNoProfile : m.start}</EmptyState> }
  }
  if (hits.hits.length === 0)
    return {
      view: "empty",
      node: (
        <div className="flex flex-col gap-[0.5rem]">
          <EmptyState busy={s.loading}>{m.noHits(toolName, s.asked?.profile ?? null)}</EmptyState>
          {hits.coverage && (
            <p className="text-[0.9rem] text-ink-dim tabular-nums">
              {m.searched(hits.coverage.messages, hits.coverage.chats)}
            </p>
          )}
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
        {!hits.paged && !s.harder && hits.hits.length >= LIMIT && <p className="text-ink-dim">{m.bestOnly(LIMIT)}</p>}
        {hits.coverage && (
          <p className="text-ink-dim tabular-nums">{m.searched(hits.coverage.messages, hits.coverage.chats)}</p>
        )}
        {hits.notes.map((n) => (
          <p key={n} className="selectable text-ink-dim">
            {n}
          </p>
        ))}
      </div>
      {s.tool && page === 1 && <HarderBar m={m} toolId={s.tool} count={hits.hits.length} />}
      {s.groupBy ? (
        <Grouped hits={hits.hits} field={s.groupBy} now={now} m={m} />
      ) : (
        <Table hits={hits.hits} now={now} busy={s.loading} />
      )}
      {pager && <Pager page={page} hasMore={hits.hasMore} busy={s.loading} onPage={s.search} />}
    </div>
  )
  return { view: "hits", node }
}

function HarderOutcomeText({ m, outcome }: { m: Words; outcome: NonNullable<HarderAnswer["outcome"]> }) {
  const lang = useLang()
  if (outcome.applied) {
    const usd = outcome.costUsd
    const cost = usd === null || usd === 0 ? null : usd < 0.01 ? m.harderLessThanCent : formatUsd(usd, lang)
    return m.harderApplied(providerName(outcome.provider), outcome.model, cost)
  }
  const ours = outcome.reason ? m.harderReasons[outcome.reason] : undefined
  return ours ? m.harderKeptBecause(ours) : m.harderKept(outcome.why ?? outcome.reason ?? "")
}

/**
 * memo's search harder for the shown query: offered only once the owner allowed it in memo's settings, and only for
 * the first page of two or more results. After it, what the model did, in place of the offer.
 */
function HarderBar({ m, toolId, count }: { m: Words; toolId: string; count: number }) {
  const s = useSearch(
    useShallow((s) => ({
      asked: s.asked,
      demo: s.demo,
      harder: s.harder,
      loading: s.loading,
      query: s.query,
      search: s.search,
      searchHarder: s.searchHarder,
    })),
  )
  const allowed = Boolean(findTool(toolId)?.searchHarder)
  const state = useSearchHarder(toolId, allowed && !s.demo)
  const status = state.data?.state === "ready" && state.data.status.on ? state.data.status : null
  const provider = status ? providerName(status.provider) : ""
  // Text typed since the last search is not what the results show, so nothing is offered for it.
  const current = s.asked?.query === s.query
  const offer = Boolean(status) && count >= 2 && current
  return (
    <>
      <Collapse open={s.harder !== null}>
        {s.harder && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem]" aria-live="polite">
            <p className={cx("flex items-start gap-2", s.harder.applied ? "text-ink" : "text-ink-soft")}>
              {s.harder.applied ? (
                <Sparkles className="mt-[0.2rem] size-4 shrink-0 text-brand" aria-hidden />
              ) : (
                <AlertTriangle className="mt-[0.2rem] size-4 shrink-0 text-warn" aria-hidden />
              )}
              <span>
                <HarderOutcomeText m={m} outcome={s.harder} />
              </span>
            </p>
            {current && (
              <Button size="sm" variant="secondary" disabled={s.loading} onClick={() => s.search(1)}>
                {m.usualOrder}
              </Button>
            )}
          </div>
        )}
      </Collapse>
      <Collapse open={s.harder === null && offer}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem]">
          <Button size="sm" variant="secondary" disabled={s.loading || !offer} onClick={() => s.searchHarder()}>
            <Sparkles className="size-4" aria-hidden />
            {m.harder}
          </Button>
          <span className="text-ink-dim" aria-live="polite">
            {s.loading ? m.harderBusy : m.harderNote(status?.candidates ?? 0, provider)}
          </span>
        </div>
      </Collapse>
    </>
  )
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
    <HitsTable
      hits={hits}
      placeholders={placeholders}
      busy={busy}
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
  )
}

function Grouped({ hits, field, now, m }: { hits: SearchHit[]; field: string; now: Date; m: Words }) {
  const lang = useLang()
  const groups = useMemo(() => groupHits(hits, field), [hits, field])
  const max = groups[0]?.count ?? 1
  return (
    <div className="reveal overflow-hidden rounded-rack border border-line-strong bg-app">
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
                    className="flex w-full min-w-0 items-center rounded-pill px-[0.5rem] py-[0.3rem] text-left hover:bg-app-3"
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
              <td className="pr-[0.9rem] text-right font-mono tabular-nums">{groupDigits(g.count)}</td>
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
