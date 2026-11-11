import { Check, ChevronRight, Group, Minus } from "lucide-react"
import { type MouseEvent, useState } from "react"
import { agentName, type Count, FACETS, isBareCommand, statusTone, type Term, termState } from "@/domain/runs"
import { useMessages } from "@/i18n"
import { ToolIcon } from "@/shared/ToolIcon"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { FilterMenu } from "@/ui/FilterMenu"
import { Lamp } from "@/ui/Lamp"
import { SEARCH_FROM } from "@/ui/popup-list"
import { logsMessages } from "./messages"
import { commandLabel, fieldLabel, type LogsWords, toolName, viaName } from "./names"

type Props = {
  counts: Record<string, Count[]>
  terms: Term[]
  total: number
  groupBy: string | null
  onToggle: (field: string, value: string, negate: boolean) => void
  /** Ticks or unticks several values in one change, as clearing a long field's list does. */
  onFlip: (field: string, values: readonly string[]) => void
  onGroup: (field: string | null) => void
}

export function Facets({ counts, terms, total, groupBy, onToggle, onFlip, onGroup }: Props) {
  const m = useMessages(logsMessages)
  return (
    <nav aria-label={m.facets} className="flex flex-col gap-[1.1rem]">
      <p className="text-[0.9rem] text-ink-dim">{m.countsOver(total)}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] items-start gap-x-[1.5rem] gap-y-[1.1rem]">
        {FACETS.map((field) => (
          <Facet
            key={field}
            field={field}
            counts={counts[field] ?? []}
            terms={terms}
            grouped={groupBy === field}
            onToggle={onToggle}
            onFlip={onFlip}
            onGroup={onGroup}
          />
        ))}
      </div>
    </nav>
  )
}

function Facet(
  props: { field: string; counts: Count[]; grouped: boolean } & Pick<
    Props,
    "terms" | "onToggle" | "onFlip" | "onGroup"
  >,
) {
  const { field, terms, grouped, onToggle, onFlip, onGroup } = props
  // Runs without the field can't be picked: `-field:*` is a negated term, so it would AND with the ticked values
  // instead of widening them like every other checkbox. The Groups table still shows them, so totals add up.
  const counts = props.counts.filter((c) => c.value !== "")
  const m = useMessages(logsMessages)
  const [open, setOpen] = useState(true)
  const label = fieldLabel(m, field)
  const long = counts.length > SEARCH_FROM
  const kept = counts.filter((c) => termState(terms, field, c.value) === "include").map((c) => c.value)

  return (
    <section aria-label={label}>
      <div className="group/facet flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-[0.3rem] text-left text-[0.95rem] font-medium text-ink-dim hover:text-ink"
        >
          <ChevronRight
            aria-hidden
            className={cx("size-[0.95rem] transition-transform duration-(--motion-fast)", open && "rotate-90")}
          />
          {label}
          <span className="ml-[0.2rem] font-normal tabular-nums">{counts.length || ""}</span>
        </button>
        <button
          type="button"
          onClick={() => onGroup(grouped ? null : field)}
          aria-pressed={grouped}
          aria-label={grouped ? m.stopGroupingBy(label) : m.groupByField(label)}
          title={grouped ? m.stopGrouping : m.groupByThis}
          className={cx(
            "grid size-[1.5rem] shrink-0 place-items-center rounded-[0.3rem] hover:bg-app-3 hover:text-ink focus-visible:opacity-100",
            grouped ? "text-brand" : "text-ink-dim opacity-0 group-hover/facet:opacity-100",
          )}
        >
          <Group className="size-[0.9rem]" aria-hidden />
        </button>
      </div>
      <Collapse open={open} className="pt-[0.35rem]">
        {long ? (
          // A field with many values (commands, clients) is a list to search, not a column the page grows by.
          <FilterMenu
            label={label}
            empty={m.anyOf(counts.length)}
            search
            options={counts.map((c) => ({
              value: c.value,
              label: field === "tool" ? toolName(c.value) : valueTitle(m, field, c.value),
              count: c.count,
              ...(field === "tool"
                ? { icon: <ToolIcon id={c.value} className="size-4 shrink-0 text-ink-soft" /> }
                : {}),
              ...(field === "status" ? { icon: <Lamp tone={statusTone(c.value)} size="sm" /> } : {}),
            }))}
            selected={kept}
            onChange={(next) =>
              onFlip(field, [...next.filter((x) => !kept.includes(x)), ...kept.filter((x) => !next.includes(x))])
            }
          />
        ) : (
          <ul className="flex flex-col">
            {counts.length === 0 && <li className="py-1 pl-[1.2rem] text-[0.9rem] text-ink-dim">{m.noValues}</li>}
            {counts.map((c) => (
              <Value
                key={c.value}
                field={field}
                count={c}
                state={termState(terms, field, c.value)}
                onToggle={onToggle}
              />
            ))}
          </ul>
        )}
      </Collapse>
    </section>
  )
}

function Value(props: {
  field: string
  count: Count
  state: "include" | "exclude" | null
  onToggle: Props["onToggle"]
}) {
  const { field, count, state, onToggle } = props
  const m = useMessages(logsMessages)
  const click = (e: MouseEvent) => onToggle(field, count.value, e.altKey || e.shiftKey)
  return (
    <li className="group/value relative flex items-center">
      <button
        type="button"
        onClick={click}
        aria-pressed={state === "include"}
        title={(state === "include" ? m.stopKeeping : m.keepOnly)(valueTitle(m, field, count.value))}
        className={cx(
          "flex min-h-[1.9rem] w-full min-w-0 items-center gap-[0.45rem] rounded-[0.3rem] pr-[1.8rem] pl-[0.15rem] text-left text-[0.95rem]",
          "hover:bg-app-3",
          state === "exclude" && "text-ink-dim line-through decoration-ink-dim",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "grid size-[0.95rem] shrink-0 place-items-center rounded-[0.2rem] border",
            state === "include" && "border-brand bg-brand text-brand-ink",
            state === "exclude" && "border-bad bg-bad/15 text-bad",
            !state && "border-line-strong bg-app",
          )}
        >
          {state === "include" && <Check className="size-[0.7rem]" strokeWidth={3} />}
          {state === "exclude" && <Minus className="size-[0.7rem]" strokeWidth={3} />}
        </span>
        <ValueLabel field={field} value={count.value} />
        <span className="shrink-0 text-[0.9rem] text-ink-dim tabular-nums">{count.count}</span>
      </button>
      <button
        type="button"
        onClick={() => onToggle(field, count.value, true)}
        aria-label={state === "exclude" ? m.showAgainValue(count.value) : m.hideValue(count.value)}
        title={state === "exclude" ? m.showAgain : m.hideThese}
        className="absolute right-[0.2rem] grid size-[1.4rem] place-items-center rounded-[0.3rem] text-ink-dim opacity-0 hover:bg-app hover:text-bad focus-visible:opacity-100 group-hover/value:opacity-100"
      >
        <Minus className="size-[0.8rem]" aria-hidden />
      </button>
    </li>
  )
}

export function ValueLabel({ field, value }: { field: string; value: string }) {
  const m = useMessages(logsMessages)
  if (value === "") return <span className="min-w-0 wrap-break-word text-ink-dim italic">{m.none}</span>
  if (field === "tool")
    return (
      <span className="flex min-w-0 items-center gap-[0.4rem]">
        <ToolIcon id={value} className="size-[0.95rem] shrink-0 text-ink-soft" />
        <span className="min-w-0 wrap-break-word">{toolName(value)}</span>
      </span>
    )
  if (field === "status")
    return (
      <span className="flex min-w-0 items-center gap-[0.45rem]">
        <Lamp tone={statusTone(value)} size="sm" />
        <span className="min-w-0 wrap-break-word">{value}</span>
      </span>
    )
  if (field === "agent") return <span className="min-w-0 wrap-break-word">{agentName(value, m.mcpApp)}</span>
  if (field === "via") return <span className="min-w-0 wrap-break-word">{viaName(m, value)}</span>
  if (field === "client") return <span className="min-w-0 wrap-break-word">{value}</span>
  if (field === "cli_command" && isBareCommand(value))
    return (
      <span className="min-w-0 wrap-break-word font-mono text-[0.9rem]" title={m.bareHint}>
        {value} <span className="font-sans text-ink-dim">{m.noCommand}</span>
      </span>
    )
  return <span className="min-w-0 wrap-break-word font-mono text-[0.9rem]">{value}</span>
}

export const valueTitle = (m: LogsWords, field: string, value: string) =>
  field === "cli_command" && isBareCommand(value) ? `${commandLabel(m, value)}. ${m.bareHint}` : value
