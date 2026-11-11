import "./analytics.css"
import { useEffect } from "react"
import type { Period } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { ServiceIcon } from "@/shared/ServiceIcon"
import { ToolIcon } from "@/shared/ToolIcon"
import { Button } from "@/ui/Button"
import { ToggleChip } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { Segmented } from "@/ui/Segmented"
import { Cards } from "./cards"
import { Group } from "./group"
import { LAYOUT, TOP } from "./layout"
import { analyticsMessages } from "./messages"
import { MESSENGERS, useAnalytics } from "./store"

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
      <PageHeader title={m.title} status={refreshing ? m.refreshing : null} intro={m.intro} />

      <section aria-label={m.weekHead} className="flex flex-col gap-2">
        <h2 className="m-0 text-[0.9rem] font-medium text-ink-dim">{m.weekHead}</h2>
        <Cards ids={TOP} />
      </section>

      {/* The tiles above always compare this week with the last; the switch sits with the cards it changes (BUG-701). */}
      <div className="flex min-h-[2rem] flex-wrap items-center gap-[0.5rem]">
        <Segmented<Period>
          size="md"
          label={m.periodLabel}
          value={period}
          options={WEEK_OR_MONTH.map((p) => ({ value: p, label: m.period[p] ?? p, icon: null }))}
          onChange={(p) => useAnalytics.getState().setPeriod(p)}
        />
        <Filters />
        <ToggleChip on={hideNames} onChange={(on) => useAnalytics.getState().setHideNames(on)}>
          {m.hideNames}
        </ToggleChip>
      </div>
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
  const toolsOf = new Map<string, string[]>()
  for (const x of present) {
    const s = sources[x.id]
    for (const p of s?.state === "ready" ? s.profiles : []) toolsOf.set(p, [...(toolsOf.get(p) ?? []), x.id])
  }
  const profiles = [...toolsOf.keys()].sort()
  if (present.length === 0)
    return MESSENGERS.some((x) => sources[x.id]?.state === "loading") ? null : (
      <>
        <span className="text-[0.9rem] text-ink-soft">{m.noProfilesYet}</span>
        <Button size="sm" variant="secondary" onClick={() => useNav.getState().go("tools")}>
          {m.openTools}
        </Button>
      </>
    )
  return (
    <>
      <FilterMenu
        label={m.sourceChip}
        options={present.map((x) => ({
          value: x.id,
          label: findTool(x.id)?.name ?? x.id,
          icon: <ToolIcon id={x.id} className="size-4 shrink-0" />,
        }))}
        selected={onlySources}
        onChange={(ids) => useAnalytics.getState().setOnlySources(ids)}
      />
      {profiles.length > 0 && (
        <FilterMenu
          label={m.profileChip}
          options={profiles.map((p) => ({
            value: p,
            label: p,
            terms: (toolsOf.get(p) ?? []).map((id) => findTool(id)?.name ?? id).join(" "),
            icon: (
              <span className="flex shrink-0 items-center gap-[0.3rem]">
                {(toolsOf.get(p) ?? []).map((id) => (
                  <ServiceIcon key={id} id={id} className="size-4" />
                ))}
              </span>
            ),
          }))}
          selected={onlyProfiles}
          onChange={(names) => useAnalytics.getState().setOnlyProfiles(names)}
        />
      )}
    </>
  )
}
