import "./analytics.css"
import { useEffect } from "react"
import type { Period } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatList, useMessages } from "@/i18n"
import { Page, PageHeader } from "@/shared/Page"
import { ToggleChip } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { Segmented } from "@/ui/Segmented"
import { Cards } from "./cards"
import { Group } from "./group"
import { LAYOUT, TOP } from "./layout"
import { analyticsMessages } from "./messages"
import { MESSENGERS, useAnalytics, useShownSources } from "./store"

/** A week or a month: the page is about now, the archive section keeps the longer view (NEED-256 A). */
const WEEK_OR_MONTH = ["7d", "30d"] as const

export function AnalyticsPage() {
  const m = useMessages(analyticsMessages)
  const period = useAnalytics((s) => s.period)
  const refreshing = useAnalytics((s) => s.refreshing)
  const hideNames = useAnalytics((s) => s.hideNames)

  useEffect(() => {
    useAnalytics.getState().load()
  }, [])

  return (
    <Page>
      <PageHeader
        title={m.title}
        status={refreshing ? m.refreshing : null}
        intro={m.intro}
        actions={
          <Segmented<Period>
            size="md"
            label={m.periodLabel}
            value={period}
            options={WEEK_OR_MONTH.map((p) => ({ value: p, label: m.period[p] ?? p, icon: null }))}
            onChange={(p) => useAnalytics.getState().setPeriod(p)}
          />
        }
      />

      <div className="flex min-h-[2rem] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Scope />
        <div className="flex flex-wrap items-center gap-[0.5rem]">
          <Filters />
          <ToggleChip on={hideNames} onChange={(on) => useAnalytics.getState().setHideNames(on)}>
            {m.hideNames}
          </ToggleChip>
        </div>
      </div>

      <Cards ids={TOP} />
      {LAYOUT.map((g) => (
        <Group key={g.id} id={g.id} title={m.groups[g.id] ?? g.id} closed={g.closed ?? false}>
          <Cards ids={g.cards} />
        </Group>
      ))}
    </Page>
  )
}

/** Which messengers and profiles the message numbers add up; nothing chosen is every one of them. */
function Filters() {
  const m = useMessages(analyticsMessages)
  const sources = useAnalytics((s) => s.sources)
  const onlySources = useAnalytics((s) => s.onlySources)
  const onlyProfiles = useAnalytics((s) => s.onlyProfiles)
  const present = MESSENGERS.filter((x) => sources[x.id]?.state === "ready")
  const profiles = [
    ...new Set(
      present.flatMap((x) => {
        const s = sources[x.id]
        return s?.state === "ready" ? s.profiles : []
      }),
    ),
  ].sort()
  if (present.length === 0) return null
  return (
    <>
      <FilterMenu
        label={m.sourceChip}
        options={present.map((x) => ({ value: x.id, label: findTool(x.id)?.name ?? x.id }))}
        selected={onlySources}
        onChange={(ids) => useAnalytics.getState().setOnlySources(ids)}
      />
      {profiles.length > 1 && (
        <FilterMenu
          label={m.profileChip}
          options={profiles.map((p) => ({ value: p, label: p }))}
          selected={onlyProfiles}
          onChange={(names) => useAnalytics.getState().setOnlyProfiles(names)}
        />
      )}
    </>
  )
}

/** Which profiles the message numbers add up, so a total is never read as one account's. */
function Scope() {
  const m = useMessages(analyticsMessages)
  const sources = useShownSources()
  const parts = MESSENGERS.flatMap((x) => {
    const s = sources[x.id]
    return s?.state === "ready" && s.profiles.length
      ? [`${findTool(x.id)?.name ?? x.id}: ${formatList(s.profiles)}`]
      : []
  })
  const loading = MESSENGERS.some((x) => sources[x.id]?.state === "loading")
  return (
    <p className="text-[0.9rem] text-ink-soft">
      {parts.length
        ? m.countedFor(<span className="font-mono">{parts.join(" · ")}</span>)
        : loading
          ? ""
          : m.noProfilesYet}
    </p>
  )
}
