import { useId } from "react"
import { tools } from "@/domain/catalog"
import { dailyCap, formatUsd, runOutcome } from "@/domain/mail-agent"
import { parseWhen } from "@/domain/schedule-when"
import { ago, openToolAt } from "@/features/tools"
import { formatDate, type Lang, useLang, useMessages } from "@/i18n"
import type { OtherSchedule } from "@/platform/bindings"
import { type Column, DataTable } from "@/ui/DataTable"
import { Lamp } from "@/ui/Lamp"
import { type ScheduleText, scheduleMessages } from "./messages-schedule"
import { TONE } from "./ScheduleCard"

/** The tool whose panel sets a schedule up, by the name the catalog gives it there; null for one made by hand. */
const setUpIn = (name: string) => tools.find((t) => t.mailAgent?.name === name) ?? null

const whenOf = (text: string, m: ScheduleText, lang: Lang) => {
  const w = parseWhen(text)
  if (w.kind === "every") return m.every(w.minutes)
  if (w.kind === "daily") return m.daily(w.at)
  if (w.kind === "once") return m.once(formatDate(w.at, { dateStyle: "medium", timeStyle: "short" }, lang))
  return w.text
}

/** Jobs memo runs on a schedule besides the digests (the mail agent, a command set up by hand), shown only. */
export function OtherSchedules({ others }: { others: OtherSchedule[] }) {
  const m = useMessages(scheduleMessages)
  const lang = useLang()
  const titleId = useId()
  const columns: Column<OtherSchedule>[] = [
    {
      id: "name",
      head: m.othersCol.name,
      width: "minmax(0,1fr)",
      lead: true,
      sortBy: (o) => o.name,
      cell: (o) => (
        <span className="flex min-w-0 items-center gap-[0.55rem]">
          <Lamp tone={o.last ? TONE[runOutcome(o.last)] : "idle"} size="sm" />
          <span className="font-medium text-ink [overflow-wrap:anywhere]">{o.name}</span>
        </span>
      ),
    },
    {
      id: "when",
      head: m.othersCol.when,
      width: "minmax(9rem,1fr)",
      cell: (o) => <span className="text-ink-soft">{whenOf(o.when, m, lang)}</span>,
    },
    {
      id: "last",
      head: m.othersCol.last,
      width: "minmax(12rem,1.5fr)",
      sortBy: (o) => o.last?.skipped?.at ?? o.last?.at ?? "",
      cell: (o) => {
        const last = o.last
        if (!last) return <span className="text-ink-dim">—</span>
        const skip = last.skipped
        const outcome = skip
          ? m.skippedWhy((skip.reason && m.skipReasons[skip.reason]) || skip.why)
          : runOutcome(last) === "failed"
            ? m.failed(last.failures)
            : m.ok
        return (
          <span className="flex min-w-0 flex-col">
            <span className="text-ink-soft tabular-nums">{ago(skip?.at ?? last.at)}</span>
            <span className="line-clamp-2 text-[0.85rem] text-ink-dim first-letter:uppercase">{outcome}</span>
          </span>
        )
      },
    },
    {
      id: "spent",
      head: m.othersCol.spent,
      width: "minmax(11rem,1fr)",
      cell: (o) => {
        if (o.spentTodayUsd === null) return <span className="text-ink-dim">—</span>
        const cap = dailyCap(o.maxCostPerDayUsd)
        // At the cap memo skips the next runs, so the owner sees why before reading the skip.
        const capped = cap !== null && o.spentTodayUsd >= cap
        return (
          <span className="flex flex-col tabular-nums">
            <span className={capped ? "text-warn-ink" : "text-ink-soft"}>{formatUsd(o.spentTodayUsd, lang)}</span>
            {cap !== null && <span className="text-[0.85rem] text-ink-dim">{m.capOf(formatUsd(cap, lang))}</span>}
          </span>
        )
      },
    },
    {
      id: "change",
      head: m.othersCol.change,
      width: "minmax(12rem,1.3fr)",
      cell: (o) => {
        const tool = setUpIn(o.name)
        return tool ? (
          <button
            type="button"
            aria-label={m.changeMailAgent(tool.name)}
            onClick={() => openToolAt(tool.id, "mailAgent")}
            className="cursor-pointer text-left font-medium text-brand underline-offset-2 hover:text-brand-hover hover:underline"
          >
            {m.mailAgentAt(tool.name)}
          </button>
        ) : (
          <span className="text-ink-dim">{m.inTerminal}</span>
        )
      },
    },
  ]
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[0.6rem]">
      <div className="flex flex-col gap-[0.2rem]">
        <h2 id={titleId} className="text-[1.05rem] font-semibold text-ink">
          {m.others}
        </h2>
        <p className="max-w-[80ch] text-[0.9rem] text-ink-soft">{m.othersHint}</p>
      </div>
      <DataTable
        label={m.others}
        rows={others}
        rowKey={(o) => o.name}
        columns={columns}
        minWidth="60rem"
        leadWidth="minmax(9rem,1fr)"
      />
    </section>
  )
}
