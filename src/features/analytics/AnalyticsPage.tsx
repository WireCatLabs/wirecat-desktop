import "./analytics.css"
import { LoaderCircle } from "lucide-react"
import { useEffect } from "react"
import type { Period } from "@/domain/analytics"
import { findTool } from "@/domain/catalog"
import { formatList, useMessages } from "@/i18n"
import { PERIODS } from "@/platform/analytics-schemas"
import { ToggleChip } from "@/ui/FilterBar"
import { Segmented } from "@/ui/Segmented"
import { analyticsMessages } from "./messages"
import { Activity, Helps, Memory, Overview, People, Projects, Tasks } from "./sections"
import { MESSENGERS, useAnalytics } from "./store"

export function AnalyticsPage() {
  const m = useMessages(analyticsMessages)
  const period = useAnalytics((s) => s.period)
  const refreshing = useAnalytics((s) => s.refreshing)
  const hideNames = useAnalytics((s) => s.hideNames)

  useEffect(() => {
    useAnalytics.getState().load()
  }, [])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-[1.2rem]">
            <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
            <p aria-live="polite" className="flex items-center gap-1.5 text-[0.9rem] text-ink-soft">
              {refreshing && (
                <>
                  <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
                  {m.refreshing}
                </>
              )}
            </p>
          </div>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
        </div>
        <Segmented<Period>
          label={m.periodLabel}
          value={period}
          options={PERIODS.map((p) => ({ value: p, label: m.period[p] ?? p, icon: null }))}
          onChange={(p) => useAnalytics.getState().setPeriod(p)}
          labelClass=""
        />
      </div>

      <div className="flex min-h-[2rem] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Scope />
        <ToggleChip on={hideNames} onChange={(on) => useAnalytics.getState().setHideNames(on)}>
          {m.hideNames}
        </ToggleChip>
      </div>

      <Overview />
      <Activity />
      <div className="grid grid-cols-1 gap-[1.5rem] xl:grid-cols-2">
        <People />
        <Projects />
      </div>
      <div className="grid grid-cols-1 gap-[1.5rem] xl:grid-cols-2">
        <Tasks />
        <Memory />
      </div>
      <Helps />
    </div>
  )
}

/** Which profiles the message numbers add up, so a total is never read as one account's. */
function Scope() {
  const m = useMessages(analyticsMessages)
  const sources = useAnalytics((s) => s.sources)
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
